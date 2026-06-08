package com.aegisvault.desktop

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.service.autofill.Dataset
import android.util.Log
import android.view.autofill.AutofillId
import android.view.autofill.AutofillManager
import android.view.autofill.AutofillValue
import android.widget.RemoteViews
import android.util.Base64
import org.json.JSONObject
import java.io.File
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

private const val AUTOFILL_AUTH_TAG = "AegisAutofillAuth"
private const val APPROVED_AUTOFILL_PAYLOAD_FILE = "approved_autofill_payload.json"
private const val EXTRA_AUTOFILL_IDS = "aegis_autofill_ids"
private const val EXTRA_AUTOFILL_ROLES = "aegis_autofill_roles"
private const val EXTRA_AUTOFILL_WEB_DOMAIN = "aegis_autofill_web_domain"
private const val EXTRA_AUTOFILL_PACKAGE = "aegis_autofill_package"
private const val EXTRA_AUTOFILL_HANDOFF_KEY = "aegis_autofill_handoff_key"
private const val POLL_INTERVAL_MS = 500L
private const val POLL_TIMEOUT_MS = 300_000L

class AutofillAuthActivity : Activity() {
  private val handler = Handler(Looper.getMainLooper())
  private val startedAt = System.currentTimeMillis()
  private var completed = false

  private val pollRunnable = object : Runnable {
    override fun run() {
      if (completed) return

      val result = tryBuildAuthenticationResult()
      if (result != null) {
        completed = true
        setResult(RESULT_OK, result)
        finish()
        return
      }

      if (System.currentTimeMillis() - startedAt >= POLL_TIMEOUT_MS) {
        Log.w(AUTOFILL_AUTH_TAG, "Autofill authentication timed out before an approved payload was created.")
        completed = true
        setResult(RESULT_CANCELED)
        finish()
        return
      }

      handler.postDelayed(this, POLL_INTERVAL_MS)
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    Log.i(
      AUTOFILL_AUTH_TAG,
      "Autofill authentication activity started for domain=${intent.getStringExtra(EXTRA_AUTOFILL_WEB_DOMAIN) ?: "none"}, package=${intent.getStringExtra(EXTRA_AUTOFILL_PACKAGE) ?: "none"}."
    )
    startAegisVaultForCredentialApproval()
    handler.post(pollRunnable)
  }

  override fun onResume() {
    super.onResume()
    Log.i(AUTOFILL_AUTH_TAG, "Autofill authentication activity resumed; completed=$completed.")
  }

  override fun onPause() {
    Log.i(AUTOFILL_AUTH_TAG, "Autofill authentication activity paused; completed=$completed.")
    super.onPause()
  }

  override fun onStop() {
    Log.i(AUTOFILL_AUTH_TAG, "Autofill authentication activity stopped; completed=$completed.")
    super.onStop()
  }

  override fun onDestroy() {
    handler.removeCallbacks(pollRunnable)
    Log.i(AUTOFILL_AUTH_TAG, "Autofill authentication activity destroyed; completed=$completed.")
    super.onDestroy()
  }

  private fun startAegisVaultForCredentialApproval() {
    val launchIntent = Intent(this, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
      putExtra("aegis_autofill_request", true)
      putExtra("aegis_autofill_web_domain", intent.getStringExtra(EXTRA_AUTOFILL_WEB_DOMAIN))
      putExtra("aegis_autofill_package", intent.getStringExtra(EXTRA_AUTOFILL_PACKAGE))
      putExtra("aegis_autofill_has_username", roleList().contains(AegisAutofillFieldRole.Username.name))
      putExtra("aegis_autofill_has_password", roleList().contains(AegisAutofillFieldRole.Password.name))
      putExtra("aegis_autofill_form_hints", emptyArray<String>())
      putExtra(EXTRA_AUTOFILL_HANDOFF_KEY, intent.getStringExtra(EXTRA_AUTOFILL_HANDOFF_KEY))
    }
    Log.i(AUTOFILL_AUTH_TAG, "Launching AegisVault approval UI for domain=${intent.getStringExtra(EXTRA_AUTOFILL_WEB_DOMAIN) ?: "none"}.")
    startActivity(launchIntent)
  }

  private fun tryBuildAuthenticationResult(): Intent? {
    val payloadFile = File(filesDir, APPROVED_AUTOFILL_PAYLOAD_FILE)
    if (!payloadFile.exists()) return null

    Log.i(AUTOFILL_AUTH_TAG, "Approved Autofill payload file detected; validating before result handoff.")
    val payload = try {
      readApprovedPayload(payloadFile)
    } catch (error: Exception) {
      payloadFile.delete()
      Log.w(AUTOFILL_AUTH_TAG, "Approved Autofill payload was malformed and has been cleared.", error)
      return null
    }

    if (payload.optLong("expiresAt", 0L) < System.currentTimeMillis()) {
      payloadFile.delete()
      Log.w(AUTOFILL_AUTH_TAG, "Approved Autofill payload expired before authentication result could be returned.")
      return null
    }

    if (!matchesTarget(payload)) {
      payloadFile.delete()
      Log.w(AUTOFILL_AUTH_TAG, "Approved Autofill payload target did not match the original request.")
      return null
    }

    if (payload.optString("status", "") == "canceled") {
      payloadFile.delete()
      Log.i(AUTOFILL_AUTH_TAG, "Autofill authentication was canceled by the approval UI.")
      completed = true
      setResult(RESULT_CANCELED)
      finish()
      return null
    }

    val username = payload.optString("username", "")
    val password = payload.optString("password", "")
    if (password.isBlank()) {
      payloadFile.delete()
      return null
    }

    val ids = autofillIdList()
    val roles = roleList()
    if (ids.isEmpty() || ids.size != roles.size) {
      payloadFile.delete()
      Log.w(AUTOFILL_AUTH_TAG, "Autofill authentication cannot continue; ids=${ids.size}, roles=${roles.size}.")
      return null
    }

    val presentation = RemoteViews(packageName, android.R.layout.simple_list_item_1)
    presentation.setTextViewText(android.R.id.text1, payload.optString("title", "AegisVault"))

    val dataset = Dataset.Builder(presentation)
    var hasValue = false
    ids.forEachIndexed { index, autofillId ->
      when (roles[index]) {
        AegisAutofillFieldRole.Username.name -> {
          if (username.isNotBlank()) {
            dataset.setValue(autofillId, AutofillValue.forText(username))
            hasValue = true
          }
        }
        AegisAutofillFieldRole.Password.name -> {
          dataset.setValue(autofillId, AutofillValue.forText(password))
          hasValue = true
        }
      }
    }

    payloadFile.delete()
    if (!hasValue) return null

    val approvedDataset = dataset.build()

    Log.i(AUTOFILL_AUTH_TAG, "Returning authenticated Autofill response with ${ids.size} candidate fields and hasValue=$hasValue.")
    return Intent().putExtra(AutofillManager.EXTRA_AUTHENTICATION_RESULT, approvedDataset)
  }

  private fun readApprovedPayload(payloadFile: File): JSONObject {
    val raw = JSONObject(payloadFile.readText(Charsets.UTF_8))
    if (raw.optInt("version", 1) != 2) return raw
    if (raw.optString("algorithm", "") != "AES-256-GCM") {
      throw IllegalArgumentException("Unsupported Autofill handoff envelope.")
    }

    val handoffKey = intent.getStringExtra(EXTRA_AUTOFILL_HANDOFF_KEY)
      ?: throw IllegalArgumentException("Missing Autofill handoff key.")
    val keyBytes = Base64.decode(handoffKey, Base64.NO_WRAP)
    if (keyBytes.size != 32) {
      throw IllegalArgumentException("Invalid Autofill handoff key length.")
    }

    val iv = Base64.decode(raw.getString("iv"), Base64.NO_WRAP)
    val ciphertext = Base64.decode(raw.getString("ciphertext"), Base64.NO_WRAP)
    try {
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(keyBytes, "AES"), GCMParameterSpec(128, iv))
      val plaintext = cipher.doFinal(ciphertext)
      try {
        return JSONObject(String(plaintext, Charsets.UTF_8))
      } finally {
        plaintext.fill(0)
      }
    } finally {
      keyBytes.fill(0)
    }
  }

  private fun matchesTarget(payload: JSONObject): Boolean {
    val payloadDomain = payload.optString("webDomain", "").trim().lowercase()
    val requestDomain = intent.getStringExtra(EXTRA_AUTOFILL_WEB_DOMAIN)?.trim()?.lowercase().orEmpty()
    if (payloadDomain.isNotBlank() && requestDomain.isNotBlank() && payloadDomain == requestDomain) {
      return true
    }

    val payloadPackage = payload.optString("packageName", "").trim().lowercase()
    val requestPackage = intent.getStringExtra(EXTRA_AUTOFILL_PACKAGE)?.trim()?.lowercase().orEmpty()
    return payloadPackage.isNotBlank() && requestPackage.isNotBlank() && payloadPackage == requestPackage
  }

  private fun autofillIdList(): List<AutofillId> {
    @Suppress("DEPRECATION")
    val ids = intent.getParcelableArrayListExtra<AutofillId>(EXTRA_AUTOFILL_IDS)
    return ids?.filterNotNull().orEmpty()
  }

  private fun roleList(): List<String> =
    intent.getStringArrayExtra(EXTRA_AUTOFILL_ROLES)?.toList().orEmpty()
}
