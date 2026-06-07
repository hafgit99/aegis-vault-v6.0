package com.aegisvault.desktop

import android.app.PendingIntent
import android.content.Intent
import android.service.autofill.Dataset
import android.service.autofill.AutofillService
import android.service.autofill.FillCallback
import android.service.autofill.FillRequest
import android.service.autofill.FillResponse
import android.service.autofill.SaveCallback
import android.service.autofill.SaveRequest
import android.util.Log
import android.view.autofill.AutofillValue
import android.view.autofill.AutofillId
import android.widget.RemoteViews
import org.json.JSONObject
import java.io.File

private const val TAG = "AegisAutofillService"
private const val APPROVED_AUTOFILL_PAYLOAD_FILE = "approved_autofill_payload.json"

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
    Log.i(TAG, "Autofill save request ignored; explicit in-app save flow is required.")
    callback.onSuccess()
  }

  @Suppress("DEPRECATION")
  private fun buildAuthenticationResponse(context: AegisAutofillContext): FillResponse? {
    val autofillIds = context.fields.map { it.autofillId }.toTypedArray()
    if (autofillIds.isEmpty()) return null

    val intent = Intent(this, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
      putExtra("aegis_autofill_request", true)
      putExtra("aegis_autofill_web_domain", context.webDomain)
      putExtra("aegis_autofill_package", context.packageName)
      putExtra("aegis_autofill_has_username", context.hasUsernameField)
      putExtra("aegis_autofill_has_password", context.hasPasswordField)
      putExtra("aegis_autofill_form_hints", context.formHints.toTypedArray())
    }

    val pendingIntent = PendingIntent.getActivity(
      this,
      7001,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    return FillResponse.Builder()
      .setAuthentication(
        autofillIds as Array<AutofillId>,
        pendingIntent.intentSender,
        authenticationPresentation(context)
      )
      .build()
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

    return FillResponse.Builder()
      .addDataset(dataset.build())
      .build()
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
}
