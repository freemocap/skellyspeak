package com.freemocap.skellyspeak

import android.app.Activity
import android.content.ClipData
import android.content.Intent
import android.os.Build
import android.os.Process
import android.webkit.WebView
import androidx.core.content.FileProvider
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import org.json.JSONArray
import org.json.JSONObject

@InvokeArg
class DiagnosticShareArgs {
    lateinit var root: String
    lateinit var nativeVersion: String
}

@TauriPlugin
class DiagnosticSharePlugin(private val activity: Activity) : Plugin(activity) {
    private val busy = AtomicBoolean(false)

    @Command
    fun share(invoke: Invoke) {
        if (!busy.compareAndSet(false, true)) {
            invoke.reject("Log sharing is already in progress.", "busy")
            return
        }
        // Compression and filesystem reads must never block recording or the UI thread.
        Thread {
            var archive: File? = null
            var stage = "locate_logs"
            try {
                val args = invoke.parseArgs(DiagnosticShareArgs::class.java)
                val root = File(args.root).canonicalFile
                require(root == File(activity.applicationInfo.dataDir, "logs").canonicalFile)
                val logs = DiagnosticArchive.files(root)
                stage = "create_archive"
                val directory = File(activity.cacheDir, "diagnostic-shares")
                check(directory.isDirectory || directory.mkdirs())
                // Unique files keep a later share from changing an earlier recipient's attachment.
                archive = File.createTempFile("skellyspeak-logs-", ".zip", directory)
                stage = "collect_metadata"
                val graphics = graphicsSnapshot()
                val manifest = JSONObject()
                    .put("formatVersion", 1)
                    .put("createdAtMs", System.currentTimeMillis())
                    .put("appVersion", activity.packageManager.getPackageInfo(activity.packageName, 0).versionName)
                    .put("nativeVersion", args.nativeVersion)
                    .put("androidVersion", Build.VERSION.RELEASE)
                    .put("deviceModel", Build.MODEL)
                    .put("webViewVersion", if (Build.VERSION.SDK_INT >= 26) WebView.getCurrentWebViewPackage()?.versionName else JSONObject.NULL)
                    .put("rendering", "software_activity")
                    .put("logFileCount", logs.size)
                    .put("content", "Structured app diagnostics; no conversation database, audio, credentials or raw system log.")
                    .put("snapshot", "All retained diagnostic runs. Active files may end with an incomplete final record.")
                    .put("graphics", graphics)
                stage = "write_archive"
                ZipOutputStream(archive.outputStream().buffered()).use { zip ->
                    zip.putNextEntry(ZipEntry("manifest.json"))
                    zip.write(manifest.toString(2).toByteArray(Charsets.UTF_8))
                    zip.closeEntry()
                    DiagnosticArchive.copyLogs(root, logs, zip)
                }
                stage = "create_share_uri"
                val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", archive)
                activity.runOnUiThread {
                    try {
                        val intent = Intent(Intent.ACTION_SEND).apply {
                            type = "application/zip"
                            putExtra(Intent.EXTRA_STREAM, uri)
                            clipData = ClipData.newRawUri("SkellySpeak logs", uri)
                            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        }
                        activity.startActivity(Intent.createChooser(intent, "Share SkellySpeak logs"))
                        // This means the sheet opened, not that the user sent the attachment.
                        invoke.resolve()
                    } catch (_: Exception) {
                        invoke.reject("Could not open the Android share sheet.", "open_share_sheet")
                    } finally { busy.set(false) }
                }
            } catch (_: Exception) {
                archive?.delete()
                busy.set(false)
                invoke.reject("Could not prepare diagnostic logs ($stage).", stage)
            }
        }.start()
    }

    private fun graphicsSnapshot(): JSONObject {
        val result = JSONObject().put("scope", "Recent app-UID logcat buffer; fixed graphics codes only")
            .put("rawContentOmitted", true).put("maxInputLines", 4000)
        val executor = Executors.newSingleThreadExecutor()
        var process: java.lang.Process? = null
        try {
            process = ProcessBuilder("/system/bin/logcat", "-d", "-v", "threadtime", "--uid=${Process.myUid()}", "-t", "4000")
                .redirectErrorStream(true).start()
            val running = process
            val read = executor.submit<JSONArray> {
                val records = JSONArray()
                running.inputStream.bufferedReader().useLines { lines ->
                    lines.forEach { line ->
                        val code = DiagnosticArchive.graphicsCode(line)
                        val header = Regex("^(\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}\\.\\d{3})\\s+(\\d+)\\s+(\\d+)\\s+[VDIWEF]\\s+(chromium|RustStdoutStderr):").find(line)
                        if (code != null && header != null) {
                            records.put(JSONObject().put("time", header.groupValues[1])
                                .put("pid", header.groupValues[2].toLong()).put("code", code))
                        }
                    }
                }
                records
            }
            result.put("records", read.get(5, TimeUnit.SECONDS))
            // Process.waitFor(timeout, unit) requires API 26; the app supports API 24.
            val deadline = android.os.SystemClock.elapsedRealtime() + 1000
            var exitCode: Int? = null
            while (exitCode == null && android.os.SystemClock.elapsedRealtime() < deadline) {
                try { exitCode = running.exitValue() }
                catch (_: IllegalThreadStateException) { Thread.sleep(10) }
            }
            check(exitCode == 0)
            result.put("status", "captured")
        } catch (_: Exception) {
            // App logs remain shareable; the manifest explicitly marks this additional source unavailable.
            result.put("status", "unavailable").put("reason", "System buffer inaccessible, timed out or command failed")
        } finally {
            process?.destroy()
            executor.shutdownNow()
        }
        return result
    }
}
