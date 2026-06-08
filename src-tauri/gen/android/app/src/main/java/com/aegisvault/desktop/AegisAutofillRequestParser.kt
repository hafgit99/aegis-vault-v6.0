package com.aegisvault.desktop

import android.app.assist.AssistStructure
import android.service.autofill.FillRequest
import android.text.InputType
import android.view.autofill.AutofillId

data class AegisAutofillField(
  val autofillId: AutofillId,
  val role: AegisAutofillFieldRole,
  val hints: List<String>,
  val value: String? = null
)

enum class AegisAutofillFieldRole {
  Username,
  Password,
  Unknown
}

data class AegisAutofillContext(
  val packageName: String,
  val webDomain: String?,
  val fields: List<AegisAutofillField>
) {
  val formHints: List<String> = fields.flatMap { it.hints }.distinct()
  val hasUsernameField: Boolean = fields.any { it.role == AegisAutofillFieldRole.Username }
  val hasPasswordField: Boolean = fields.any { it.role == AegisAutofillFieldRole.Password }
  val canRequestCredentials: Boolean = hasPasswordField || hasUsernameField
}

object AegisAutofillRequestParser {
  fun parse(request: FillRequest): AegisAutofillContext? {
    val structure = request.fillContexts.lastOrNull()?.structure ?: return null
    return parse(structure)
  }

  fun parse(structure: AssistStructure): AegisAutofillContext {
    val fields = mutableListOf<AegisAutofillField>()
    var webDomain: String? = null

    for (windowIndex in 0 until structure.windowNodeCount) {
      val root = structure.getWindowNodeAt(windowIndex).rootViewNode
      webDomain = webDomain ?: normalizeDomain(root.webDomain)
      collectFields(root, fields) { candidateDomain ->
        if (webDomain == null) webDomain = candidateDomain
      }
    }

    return AegisAutofillContext(
      packageName = structure.activityComponent?.packageName.orEmpty(),
      webDomain = webDomain,
      fields = fields
    )
  }

  private fun collectFields(
    node: AssistStructure.ViewNode,
    fields: MutableList<AegisAutofillField>,
    onWebDomain: (String?) -> Unit
  ) {
    onWebDomain(normalizeDomain(node.webDomain))

    val role = inferRole(node)
    val id = node.autofillId
    if (id != null && role != AegisAutofillFieldRole.Unknown) {
      fields.add(AegisAutofillField(id, role, normalizedHints(node), textValue(node)))
    }

    for (childIndex in 0 until node.childCount) {
      collectFields(node.getChildAt(childIndex), fields, onWebDomain)
    }
  }

  private fun inferRole(node: AssistStructure.ViewNode): AegisAutofillFieldRole {
    val hints = normalizedHints(node)
    if (hints.any { it.contains("password") }) return AegisAutofillFieldRole.Password
    if (hints.any { it.contains("username") || it == "email" || it.contains("e-mail") }) {
      return AegisAutofillFieldRole.Username
    }

    val hint = node.hint?.lowercase().orEmpty()
    val idEntry = node.idEntry?.lowercase().orEmpty()
    val combined = "$hint $idEntry"
    if (combined.contains("password") || isPasswordInputType(node.inputType)) {
      return AegisAutofillFieldRole.Password
    }
    if (combined.contains("username") || combined.contains("email") || combined.contains("login")) {
      return AegisAutofillFieldRole.Username
    }

    return AegisAutofillFieldRole.Unknown
  }

  private fun normalizedHints(node: AssistStructure.ViewNode): List<String> =
    node.autofillHints
      ?.map { it.trim().lowercase() }
      ?.filter { it.isNotEmpty() }
      ?.distinct()
      ?: emptyList()

  private fun textValue(node: AssistStructure.ViewNode): String? =
    node.autofillValue
      ?.takeIf { it.isText }
      ?.textValue
      ?.toString()
      ?.trim()
      ?.takeIf { it.isNotEmpty() }

  private fun normalizeDomain(value: String?): String? {
    val trimmed = value?.trim()?.lowercase()?.removePrefix("www.") ?: return null
    return trimmed.takeIf { it.isNotEmpty() }
  }

  private fun isPasswordInputType(inputType: Int): Boolean {
    val variation = inputType and InputType.TYPE_MASK_VARIATION
    return variation == InputType.TYPE_TEXT_VARIATION_PASSWORD ||
      variation == InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD ||
      variation == InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD ||
      variation == InputType.TYPE_NUMBER_VARIATION_PASSWORD
  }
}
