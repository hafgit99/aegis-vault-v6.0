package com.aegisvault.desktop

import android.app.PendingIntent
import android.content.Intent
import android.service.autofill.AutofillService
import android.service.autofill.FillCallback
import android.service.autofill.FillRequest
import android.service.autofill.FillResponse
import android.service.autofill.SaveCallback
import android.service.autofill.SaveRequest
import android.util.Log
import android.view.autofill.AutofillId
import android.widget.RemoteViews

private const val TAG = "AegisAutofillService"

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
    presentation.setTextViewText(android.R.id.text1, "Unlock AegisVault for $target")
    return presentation
  }
}
