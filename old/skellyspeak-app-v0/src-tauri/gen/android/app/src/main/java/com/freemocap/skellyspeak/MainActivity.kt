package com.freemocap.skellyspeak

import android.os.Bundle
import android.content.Context
import android.view.View
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  companion object {
    init { System.loadLibrary("skellyspeak_lib") }
  }

  private external fun initializeCredentials(context: Context)

  override fun onCreate(savedInstanceState: Bundle?) {
    initializeCredentials(applicationContext)
    super.onCreate(savedInstanceState)
    // Keep the WebView inside system bars and cutouts, including edge-to-edge
    // Android windows. Only zero the insets handled here; IME resizing remains
    // owned by the window and WebView.
    val content = findViewById<View>(android.R.id.content)
    ViewCompat.setOnApplyWindowInsetsListener(content) { view, windowInsets ->
      val types = WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
      val insets = windowInsets.getInsets(types)
      view.setPadding(insets.left, insets.top, insets.right, insets.bottom)
      WindowInsetsCompat.Builder(windowInsets)
        .setInsets(types, Insets.NONE)
        .build()
    }
    ViewCompat.requestApplyInsets(content)
  }
}
