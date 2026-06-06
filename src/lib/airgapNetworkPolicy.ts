const HIBP_RANGE_ORIGIN = 'https://api.pwnedpasswords.com';
const HIBP_RANGE_PATH_PREFIX = '/range/';

export function isLocalRequestUrl(url: string): boolean {
  return !url
    || url.startsWith('/')
    || url.includes('localhost')
    || url.includes('127.0.0.1')
    || url.includes('::1')
    || url.startsWith('data:')
    || url.startsWith('blob:');
}

export function isApprovedAirGapExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.origin === HIBP_RANGE_ORIGIN
      && parsed.pathname.startsWith(HIBP_RANGE_PATH_PREFIX);
  } catch {
    return false;
  }
}

export function isAllowedAirGapRequestUrl(url: string): boolean {
  return isLocalRequestUrl(url) || isApprovedAirGapExternalUrl(url);
}
