import { VaultEntry } from '../types';
import { createAndroidAutofillMatchRequest, NativeAutofillContext } from './autofillBridge';
import { AutofillCandidate, getAutofillCandidates } from './autofillMatcher';

export type AutofillProviderStatus =
  | 'ready'
  | 'locked'
  | 'unsupported-request'
  | 'no-match';

export interface AutofillProviderResult {
  status: AutofillProviderStatus;
  candidates: AutofillCandidate[];
  targetLabel?: string;
}

export function getAndroidAutofillProviderResult(
  context: NativeAutofillContext,
  entries: VaultEntry[],
  isLocked: boolean,
): AutofillProviderResult {
  const request = createAndroidAutofillMatchRequest(context);
  const targetLabel = context.webDomain?.trim() || context.packageName?.trim() || undefined;

  if (!request) {
    return { status: 'unsupported-request', candidates: [], targetLabel };
  }

  if (isLocked) {
    return { status: 'locked', candidates: [], targetLabel };
  }

  const candidates = getAutofillCandidates(entries, request);
  return {
    status: candidates.length > 0 ? 'ready' : 'no-match',
    candidates,
    targetLabel,
  };
}

export function readAndroidAutofillContextFromSearchParams(
  params: URLSearchParams,
): NativeAutofillContext | null {
  if (params.get('aegis_autofill_request') !== 'true') return null;

  return {
    platform: 'android',
    webDomain: params.get('web_domain'),
    packageName: params.get('package_name'),
    formHints: params.get('form_hints')?.split(',').filter(Boolean) ?? [],
    hasUsernameField: params.get('has_username') === 'true',
    hasPasswordField: params.get('has_password') === 'true',
  };
}
