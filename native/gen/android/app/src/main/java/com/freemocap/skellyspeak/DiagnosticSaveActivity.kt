package com.freemocap.skellyspeak

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.os.Bundle

/** A save destination inside the system share chooser, not a second app button. */
class DiagnosticSaveActivity : Activity() {
    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        val source = intent.data
        if (source?.scheme != "content" || source.authority != "$packageName.fileprovider") {
            showFailure(IllegalArgumentException("Diagnostic archive unavailable"))
            return
        }
        if (state == null) {
            try {
                startActivityForResult(Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "application/zip"
                    putExtra(Intent.EXTRA_TITLE, source.lastPathSegment ?: "skellyspeak-logs.zip")
                }, 1)
            } catch (error: Exception) { showFailure(error) }
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != 1) return
        if (resultCode != RESULT_OK) { finish(); return }
        val source = intent.data
        val destination = data?.data
        Thread {
            try {
                val input = checkNotNull(contentResolver.openInputStream(checkNotNull(source)))
                input.use { from ->
                    val output = checkNotNull(contentResolver.openOutputStream(checkNotNull(destination), "wt"))
                    output.use { to -> from.copyTo(to) }
                }
                runOnUiThread { finish() }
            } catch (error: Exception) { runOnUiThread { showFailure(error) } }
        }.start()
    }

    private fun showFailure(error: Exception) {
        val privacy = DiagnosticPrivacy(this)
        val details = generateSequence(error as Throwable?) { it.cause }.take(8)
            .joinToString("\n") { "${it.javaClass.simpleName}: ${privacy.scrub(it.message ?: "No exception message")}" }
        android.util.Log.e("SkellySpeak", "Diagnostic save failed: $details")
        AlertDialog.Builder(this).setTitle("Could not save logs").setMessage(details)
            .setPositiveButton(android.R.string.ok) { _, _ -> finish() }
            .setOnCancelListener { finish() }.show()
    }
}
