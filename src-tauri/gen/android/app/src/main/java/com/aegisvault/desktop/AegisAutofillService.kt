package com.aegisvault.desktop

import android.app.PendingIntent
import android.content.Intent
import android.service.autofill.Dataset
import android.service.autofill.AutofillService
import android.service.autofill.FillCallback
import android.service.autofill.FillRequest
import android.service.autofill.FillResponse
import android.service.autofill.SaveCallback
import android.service.autofill.SaveInfo
import android.service.autofill.SaveRequest
import android.util.Log
import android.view.autofill.AutofillValue
import android.view.autofill.AutofillId
import android.widget.RemoteViews
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

private const val TAG = "AegisAutofillService"
private const val APPROVED_AUTOFILL_PAYLOAD_FILE = "approved_autofill_payload.json"
private const val PENDING_AUTOFILL_SAVE_REQUEST_FILE = "pending_autofill_save_request.json"
private const val SAVE_REQUEST_TTL_MS = 300_000L
private val BROWSER_PACKAGES_REQUIRING_WEB_DOMAIN = setOf(
  "com.android.chrome",
  "com.chrome.beta",
  "com.chrome.dev",
  "com.chrome.canary",
  "com.aloha.browser",
  "org.mozilla.firefox",
  "org.mozilla.firefox_beta",
  "com.microsoft.emmx",
  "com.brave.browser",
  "com.opera.browser",
  "com.duckduckgo.mobile.android",
  "com.vivaldi.browser"
)

class AegisAutofillService : AutofillService() {
  override fun onFillRequest(
    request: FillRequest,
    cancellationSignal: android.os.CancellationSignal,
    callback: FillCallback
  ) {
    if (cancellationSignal.isCanceled) {
      callback.onSuccess(null)
      return
    }

    val context = AegisAutofillRequestParser.parse(request)
    if (context == null || !context.canRequestCredentials) {
      Log.i(TAG, "Autofill request ignored; no credential fields were detected.")
      callback.onSuccess(null)
      return
    }

    if (context.webDomain.isNullOrBlank() && isBrowserPackage(context.packageName)) {
      Log.i(TAG, "Autofill request ignored; browser package did not expose a web domain.")
      callback.onSuccess(null)
      return
    }

    val approvedResponse = buildApprovedFillResponse(context)
    if (approvedResponse != null) {
      Log.i(TAG, "Approved Autofill payload consumed for package=${context.packageName}, domain=${context.webDomain ?: "none"}.")
      callback.onSuccess(approvedResponse)
      return
    }

    Log.i(
      TAG,
      "Autofill context detected for package=${context.packageName}, domain=${context.webDomain ?: "none"}, fields=${context.fields.size}; requesting app authentication."
    )
    callback.onSuccess(buildAuthenticationResponse(context))
  }

  override fun onSaveRequest(request: SaveRequest, callback: SaveCallback) {
    val context = request.fillContexts.lastOrNull()?.structure?.let(AegisAutofillRequestParser::parse)
    if (context == null || !context.hasPasswordField) {
      Log.i(TAG, "Autofill save request ignored; no password field was detected.")
      callback.onSuccess()
      return
    }

    val password = context.fields
      .firstOrNull { it.role == AegisAutofillFieldRole.Password && !it.value.isNullOrBlank() }
      ?.value
      ?.trim()
      .orEmpty()
    if (password.isBlank()) {
      Log.i(TAG, "Autofill save request ignored; password value was empty.")
      callback.onSuccess()
      return
    }

    if (context.webDomain.isNullOrBlank() && isBrowserPackage(context.packageName)) {
      Log.i(TAG, "Autofill save request ignored; browser package did not expose a web domain.")
      callback.onSuccess()
      return
    }

    val username = context.fields
      .firstOrNull { it.role == AegisAutofillFieldRole.Username && !it.value.isNullOrBlank() }
      ?.value
      ?.trim()
      .orEmpty()
    if (context.webDomain.isNullOrBlank() && context.packageName.isBlank()) {
      Log.i(TAG, "Autofill save request ignored; no domain or package target was detected.")
      callback.onSuccess()
      return
    }

    val payload = JSONObject()
      .put("platform", "android")
      .put("webDomain", context.webDomain)
      .put("packageName", context.packageName)
      .put("username", username)
      .put("password", password)
      .put("formHints", JSONArray(context.formHints))
      .put("expiresAt", System.currentTimeMillis() + SAVE_REQUEST_TTL_MS)

    try {
      File(filesDir, PENDING_AUTOFILL_SAVE_REQUEST_FILE).writeText(payload.toString(), Charsets.UTF_8)
      Log.i(TAG, "Autofill save request staged for explicit in-app approval; target=${context.webDomain ?: context.packageName}.")
      callback.onSuccess(buildSaveApprovalIntentSender(context))
      return
    } catch (error: Exception) {
      Log.w(TAG, "Autofill save request could not be staged.", error)
    }
    callback.onSuccess()
  }

  private fun buildSaveApprovalIntentSender(context: AegisAutofillContext) =
    PendingIntent.getActivity(
      this,
      7002,
      Intent(this, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        putExtra("aegis_autofill_save_request", true)
        putExtra("aegis_autofill_web_domain", context.webDomain)
        putExtra("aegis_autofill_package", context.packageName)
      },
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    ).intentSender

  @Suppress("DEPRECATION")
  private fun buildAuthenticationResponse(context: AegisAutofillContext): FillResponse? {
    if (context.fields.isEmpty()) return null

    val intent = Intent(this, AutofillAuthActivity::class.java).apply {
      putExtra("aegis_autofill_request", true)
      putExtra("aegis_autofill_web_domain", context.webDomain)
      putExtra("aegis_autofill_package", context.packageName)
      putExtra("aegis_autofill_has_username", context.hasUsernameField)
      putExtra("aegis_autofill_has_password", context.hasPasswordField)
      putExtra("aegis_autofill_form_hints", context.formHints.toTypedArray())
      putParcelableArrayListExtra("aegis_autofill_ids", ArrayList(context.fields.map { it.autofillId }))
      putExtra("aegis_autofill_roles", context.fields.map { it.role.name }.toTypedArray())
    }

    val pendingIntent = PendingIntent.getActivity(
      this,
      7001,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
    )

    val presentation = authenticationPresentation(context)
    val dataset = Dataset.Builder(presentation)
      .setAuthentication(pendingIntent.intentSender)
    for (field in context.fields) {
      dataset.setValue(field.autofillId, null)
    }

    val response = FillResponse.Builder()
      .addDataset(dataset.build())
    buildSaveInfo(context)?.let { response.setSaveInfo(it) }
    return response.build()
  }

  private fun authenticationPresentation(context: AegisAutofillContext): RemoteViews {
    val presentation = RemoteViews(packageName, android.R.layout.simple_list_item_1)
    val target = context.webDomain ?: context.packageName.ifBlank { "this sign-in form" }
    presentation.setTextViewText(android.R.id.text1, "Fill with AegisVault for $target")
    return presentation
  }

  @Suppress("DEPRECATION")
  private fun buildApprovedFillResponse(context: AegisAutofillContext): FillResponse? {
    val payloadFile = File(filesDir, APPROVED_AUTOFILL_PAYLOAD_FILE)
    if (!payloadFile.exists()) return null

    val payload = try {
      JSONObject(payloadFile.readText(Charsets.UTF_8))
    } catch (error: Exception) {
      payloadFile.delete()
      Log.w(TAG, "Approved Autofill payload was malformed and has been cleared.", error)
      return null
    }

    if (payload.optLong("expiresAt", 0L) < System.currentTimeMillis()) {
      payloadFile.delete()
      Log.i(TAG, "Expired approved Autofill payload cleared.")
      return null
    }

    if (!matchesApprovedTarget(context, payload)) return null

    val username = payload.optString("username", "")
    val password = payload.optString("password", "")
    if (password.isBlank()) {
      payloadFile.delete()
      return null
    }

    val presentation = RemoteViews(packageName, android.R.layout.simple_list_item_1)
    presentation.setTextViewText(android.R.id.text1, payload.optString("title", "AegisVault"))

    val dataset = Dataset.Builder(presentation)
    var hasValue = false
    for (field in context.fields) {
      when (field.role) {
        AegisAutofillFieldRole.Username -> {
          if (username.isNotBlank()) {
            dataset.setValue(field.autofillId, AutofillValue.forText(username))
            hasValue = true
          }
        }
        AegisAutofillFieldRole.Password -> {
          dataset.setValue(field.autofillId, AutofillValue.forText(password))
          hasValue = true
        }
        AegisAutofillFieldRole.Unknown -> Unit
      }
    }

    payloadFile.delete()
    if (!hasValue) return null

    val response = FillResponse.Builder()
      .addDataset(dataset.build())
    buildSaveInfo(context)?.let { response.setSaveInfo(it) }
    return response.build()
  }

  private fun buildSaveInfo(context: AegisAutofillContext): SaveInfo? {
    if (!context.hasPasswordField) return null
    if (context.webDomain.isNullOrBlank() && isBrowserPackage(context.packageName)) return null

    val passwordIds = context.fields
      .filter { it.role == AegisAutofillFieldRole.Password }
      .map { it.autofillId }
      .distinct()
    if (passwordIds.isEmpty()) return null
    val requiredPasswordIds = arrayOf(passwordIds.first())

    val usernameIds = context.fields
      .filter { it.role == AegisAutofillFieldRole.Username }
      .map { it.autofillId }
      .distinct()

    @Suppress("DEPRECATION")
    val builder = SaveInfo.Builder(SaveInfo.SAVE_DATA_TYPE_PASSWORD, requiredPasswordIds as Array<AutofillId>)
      .setFlags(SaveInfo.FLAG_SAVE_ON_ALL_VIEWS_INVISIBLE)
    val optionalIds = (usernameIds + passwordIds.drop(1)).distinct().toTypedArray()
    if (optionalIds.isNotEmpty()) {
      builder.setOptionalIds(optionalIds as Array<AutofillId>)
    }
    Log.i(TAG, "Autofill response includes SaveInfo; target=${context.webDomain ?: context.packageName}, requiredPasswordFields=${requiredPasswordIds.size}, optionalFields=${optionalIds.size}.")
    return builder.build()
  }

  private fun matchesApprovedTarget(context: AegisAutofillContext, payload: JSONObject): Boolean {
    val payloadDomain = payload.optString("webDomain", "").trim().lowercase()
    val contextDomain = context.webDomain?.trim()?.lowercase().orEmpty()
    if (payloadDomain.isNotBlank() && contextDomain.isNotBlank() && payloadDomain == contextDomain) {
      return true
    }

    val payloadPackage = payload.optString("packageName", "").trim().lowercase()
    val contextPackage = context.packageName.trim().lowercase()
    return payloadPackage.isNotBlank() && contextPackage.isNotBlank() && payloadPackage == contextPackage
  }

  private fun isBrowserPackage(packageName: String): Boolean =
    BROWSER_PACKAGES_REQUIRING_WEB_DOMAIN.contains(packageName.trim().lowercase())
}
