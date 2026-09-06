package com.freemocap.skellyspeak

import android.os.Bundle
import android.content.Context

class MainActivity : TauriActivity() {
  companion object {
    init { System.loadLibrary("skellyspeak_lib") }
  }

  private external fun initializeCredentials(context: Context)

  override fun onCreate(savedInstanceState: Bundle?) {
    initializeCredentials(applicationContext)
    // NOTE: the stock template calls enableEdgeToEdge() here. That forces
    // Android 15+ edge-to-edge, which silently disables adjustResize — the
    // keyboard then floats OVER the composer instead of shrinking the
    // window. SkellySpeak is a chat-style app and needs the classic resize.
    super.onCreate(savedInstanceState)
  }
}
