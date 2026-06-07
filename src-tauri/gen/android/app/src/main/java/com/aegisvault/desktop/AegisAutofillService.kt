package com.aegisvault.desktop

import android.service.autofill.AutofillService
import android.service.autofill.FillCallback
import android.service.autofill.FillRequest
import android.service.autofill.SaveCallback
import android.service.autofill.SaveRequest
import android.util.Log

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
      "Autofill context detected for package=${context.packageName}, domain=${context.webDomain ?: "none"}, fields=${context.fields.size}; vault bridge is not enabled yet."
    )
    callback.onSuccess(null)
  }

  override fun onSaveRequest(request: SaveRequest, callback: SaveCallback) {
    Log.i(TAG, "Autofill save request ignored; explicit in-app save flow is required.")
    callback.onSuccess()
  }
}
