package com.aegisvault.desktop

import android.os.Bundle
import android.view.WindowManager
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
    WebView.setWebContentsDebuggingEnabled(false)
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }
}
