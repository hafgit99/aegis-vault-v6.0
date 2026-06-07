import { VaultEntry } from '../types';

export type AutofillPlatform = 'desktop' | 'android';

export interface AutofillMatchRequest {
  platform: AutofillPlatform;
  origin?: string;
  webDomain?: string;
  packageName?: string;
  formHints?: string[];
}

export interface AutofillCandidate {
  id: string;
  title: string;
  username: string;
  domain: string;
  score: number;
  reason: 'exact-domain' | 'subdomain' | 'passkey-domain' | 'title-fallback';
  hasPassword: boolean;
  hasTotp: boolean;
}

const MAX_AUTOFILL_CANDIDATES = 8;
const KNOWN_WEB_HINTS = new Set(['username', 'email', 'password', 'newPassword', 'currentPassword']);

export function normalizeAutofillDomain(value?: string): string {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) return '';

  const withoutScheme = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const candidate = withoutScheme.includes('/') ? withoutScheme : `${withoutScheme}/`;

  try {
    const parsed = new URL(`https://${candidate}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return withoutScheme.split('/')[0].split(':')[0].replace(/^www\./, '');
  }
}

function requestDomain(request: AutofillMatchRequest): string {
  return normalizeAutofillDomain(request.webDomain || request.origin);
}

function entryDomain(entry: VaultEntry): string {
  return normalizeAutofillDomain(entry.type === 'passkey'
    ? entry.passkeyDomain || entry.url
    : entry.url || entry.passkeyDomain);
}

function isSubdomainOf(candidate: string, parent: string): boolean {
  return candidate.endsWith(`.${parent}`) || parent.endsWith(`.${candidate}`);
}

function hasUsefulFormHint(request: AutofillMatchRequest): boolean {
  if (!request.formHints || request.formHints.length === 0) return true;
  return request.formHints.some(hint => KNOWN_WEB_HINTS.has(hint));
}

export function getAutofillCandidates(
  entries: VaultEntry[],
  request: AutofillMatchRequest,
): AutofillCandidate[] {
  const domain = requestDomain(request);
  const packageName = request.packageName?.trim().toLowerCase() || '';

  if (!hasUsefulFormHint(request)) return [];
  if (!domain && !packageName) return [];

  return entries
    .filter(entry => !entry.isDeleted && !entry.deletedAt)
    .filter(entry => (entry.type === 'login' && !!entry.password) || entry.type === 'passkey')
    .map(entry => {
      const candidateDomain = entryDomain(entry);
      const title = entry.title.trim();
      const lowerTitle = title.toLowerCase();

      let score = 0;
      let reason: AutofillCandidate['reason'] | null = null;

      if (domain && candidateDomain === domain) {
        score = 100;
        reason = entry.type === 'passkey' ? 'passkey-domain' : 'exact-domain';
      } else if (domain && candidateDomain && isSubdomainOf(candidateDomain, domain)) {
        score = 86;
        reason = 'subdomain';
      } else if (domain && lowerTitle.includes(domain.split('.')[0])) {
        score = 48;
        reason = 'title-fallback';
      } else if (packageName && lowerTitle.includes(packageName.split('.').at(-1) || packageName)) {
        score = 42;
        reason = 'title-fallback';
      }

      if (!reason || score < 40) return null;

      return {
        id: entry.id,
        title,
        username: entry.type === 'passkey'
          ? entry.passkeyUser || entry.username || entry.subtitle || ''
          : entry.username || entry.subtitle || entry.passkeyUser || '',
        domain: candidateDomain,
        score,
        reason,
        hasPassword: !!entry.password,
        hasTotp: !!entry.totpSecret,
      };
    })
    .filter((candidate): candidate is AutofillCandidate => candidate !== null)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, MAX_AUTOFILL_CANDIDATES);
}
