package com.freemocap.skellyspeak

import android.content.Context
import org.json.JSONObject

/** Same policy as Rust, TypeScript and Python; never emit raw URI or file content. */
internal class DiagnosticPrivacy(context: Context) {
    private val policy = JSONObject(context.assets.open("diagnostic-policy.json").bufferedReader().use { it.readText() })
    fun scrub(message: String): String {
        var result = message
        val rules = policy.getJSONArray("rules")
        for (index in 0 until rules.length()) {
            val rule = rules.getJSONObject(index)
            val pattern = java.util.regex.Pattern.compile(rule.getString("pattern"), if (rule.getString("flags").contains('i')) java.util.regex.Pattern.CASE_INSENSITIVE else 0)
            val tag = policy.getString(if (rule.getString("kind") == "secret") "secretTag" else "contentTag")
            result = pattern.matcher(result).replaceAll((if (rule.optBoolean("prefix")) "$1" else "") + java.util.regex.Matcher.quoteReplacement(tag))
        }
        val limit = policy.getJSONObject("limits").getInt("string")
        return if (result.length > limit) result.take(limit) + "[truncated: string limit]" else result
    }
}
