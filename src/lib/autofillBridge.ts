import { AutofillMatchRequest } from './autofillMatcher';

export interface NativeAutofillContext {
  platform: 'android' | 'desktop';
  webDomain?: string | null;
  origin?: string | null;
  url?: string | null;
  packageName?: string | null;
  formHints?: string[] | null;
  hasUsernameField?: boolean;
  hasPasswordField?: boolean;
}

export function createAndroidAutofillMatchRequest(
  context: NativeAutofillContext,
): AutofillMatchRequest | null {
  const hasCredentialField = context.hasUsernameField === true || context.hasPasswordField === true;
  const webDomain = context.webDomain?.trim() || context.origin?.trim() || undefined;
  const packageName = context.packageName?.trim() || undefined;
  const formHints = context.formHints
    ?.map(hint => hint.trim())
    .filter(Boolean);

  if (!hasCredentialField) return null;
  if (!webDomain && !packageName) return null;

  return {
    platform: context.platform,
    webDomain,
    origin: context.origin?.trim() || webDomain,
    packageName,
    formHints,
  };
}

export function createDesktopAutofillMatchRequest(query: string): AutofillMatchRequest | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  return {
    platform: 'desktop',
    origin: trimmed,
    formHints: ['username', 'password'],
  };
}
