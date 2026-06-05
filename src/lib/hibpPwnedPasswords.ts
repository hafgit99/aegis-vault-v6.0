import type { VaultEntry } from '../types';

const HIBP_RANGE_ENDPOINT = 'https://api.pwnedpasswords.com/range/';
const SHA1_HEX_LENGTH = 40;
const HIBP_PREFIX_LENGTH = 5;

type Fetcher = typeof fetch;

export interface PwnedPasswordCheck {
  sha1: string;
  prefix: string;
  suffix: string;
  count: number;
}

export interface PwnedVaultEntryResult {
  entryId: string;
  count: number;
}

export interface PwnedVaultScanResult {
  checkedCount: number;
  breachedCount: number;
  results: PwnedVaultEntryResult[];
}

export async function sha1Hex(value: string): Promise<string> {
  const digest = await window.crypto.subtle.digest('SHA-1', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

export function parsePwnedPasswordRangeResponse(body: string, suffix: string): number {
  const normalizedSuffix = suffix.toUpperCase();
  for (const line of body.split(/\r?\n/)) {
    const [candidateSuffix, rawCount] = line.trim().split(':');
    if (!candidateSuffix || candidateSuffix.toUpperCase() !== normalizedSuffix) continue;
    const count = Number.parseInt(rawCount || '0', 10);
    return Number.isFinite(count) ? count : 0;
  }
  return 0;
}

export async function checkPwnedPassword(
  password: string,
  fetcher: Fetcher = fetch
): Promise<PwnedPasswordCheck> {
  const sha1 = await sha1Hex(password);
  if (sha1.length !== SHA1_HEX_LENGTH) {
    throw new Error('Unexpected SHA-1 digest length.');
  }

  const prefix = sha1.slice(0, HIBP_PREFIX_LENGTH);
  const suffix = sha1.slice(HIBP_PREFIX_LENGTH);
  const response = await fetcher(`${HIBP_RANGE_ENDPOINT}${prefix}`, {
    headers: {
      'Add-Padding': 'true',
    },
  });

  if (!response.ok) {
    throw new Error(`HIBP range query failed with HTTP ${response.status}.`);
  }

  const body = await response.text();
  return {
    sha1,
    prefix,
    suffix,
    count: parsePwnedPasswordRangeResponse(body, suffix),
  };
}

export async function scanVaultPasswordsForBreaches(
  entries: VaultEntry[],
  fetcher: Fetcher = fetch
): Promise<PwnedVaultScanResult> {
  const passwordCache = new Map<string, number>();
  const results: PwnedVaultEntryResult[] = [];
  const activeLoginEntries = entries.filter((entry) => (
    !entry.isDeleted
    && entry.type === 'login'
    && !!entry.password?.trim()
  ));

  for (const entry of activeLoginEntries) {
    const password = entry.password?.trim() || '';
    if (!passwordCache.has(password)) {
      const check = await checkPwnedPassword(password, fetcher);
      passwordCache.set(password, check.count);
    }
    results.push({
      entryId: entry.id,
      count: passwordCache.get(password) || 0,
    });
  }

  return {
    checkedCount: results.length,
    breachedCount: results.filter((result) => result.count > 0).length,
    results,
  };
}
