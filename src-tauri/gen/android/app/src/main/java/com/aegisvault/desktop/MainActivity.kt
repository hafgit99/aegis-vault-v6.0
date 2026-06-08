package com.aegisvault.desktop

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.WindowManager
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import org.json.JSONArray
import org.json.JSONObject

private const val TAG = "AegisMainActivity"
private const val PENDING_AUTOFILL_REQUEST_FILE = "pending_autofill_request.json"
private const val EXTRA_AUTOFILL_HANDOFF_KEY = "aegis_autofill_handoff_key"

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
    WebView.setWebContentsDebuggingEnabled(false)
    enableEdgeToEdge()
    persistAutofillRequest(intent)
    super.onCreate(savedInstanceState)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    persistAutofillRequest(intent)
  }

  private fun persistAutofillRequest(intent: Intent?) {
    if (intent?.getBooleanExtra("aegis_autofill_request", false) != true) return

    val hints = intent.getStringArrayExtra("aegis_autofill_form_hints") ?: emptyArray()
    val payload = JSONObject()
      .put("platform", "android")
      .put("webDomain", intent.getStringExtra("aegis_autofill_web_domain"))
      .put("packageName", intent.getStringExtra("aegis_autofill_package"))
      .put("hasUsernameField", intent.getBooleanExtra("aegis_autofill_has_username", false))
      .put("hasPasswordField", intent.getBooleanExtra("aegis_autofill_has_password", false))
      .put("formHints", JSONArray(hints.toList()))
      .put("handoffKeyB64", intent.getStringExtra(EXTRA_AUTOFILL_HANDOFF_KEY))
      .put("receivedAt", System.currentTimeMillis())

    try {
      openFileOutput(PENDING_AUTOFILL_REQUEST_FILE, MODE_PRIVATE).use { output ->
        output.write(payload.toString().toByteArray(Charsets.UTF_8))
      }
      Log.i(TAG, "Pending Autofill request stored for AegisVault handoff.")
    } catch (error: Exception) {
      Log.w(TAG, "Pending Autofill request could not be stored.", error)
    }
  }
}
