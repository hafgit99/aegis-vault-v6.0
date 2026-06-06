import { describe, expect, it } from 'vitest';
import {
  isAllowedAirGapRequestUrl,
  isApprovedAirGapExternalUrl,
  isLocalRequestUrl,
} from '../../src/lib/airgapNetworkPolicy';

describe('airgap network policy', () => {
  it('allows local runtime URLs while blocking arbitrary external origins', () => {
    expect(isLocalRequestUrl('/assets/index.js')).toBe(true);
    expect(isLocalRequestUrl('http://localhost:3000')).toBe(true);
    expect(isLocalRequestUrl('http://127.0.0.1:3000')).toBe(true);
    expect(isLocalRequestUrl('blob:https://app.local/id')).toBe(true);
    expect(isAllowedAirGapRequestUrl('https://example.com/api')).toBe(false);
  });

  it('allows only the HIBP Pwned Passwords range endpoint as an approved external request', () => {
    expect(isApprovedAirGapExternalUrl('https://api.pwnedpasswords.com/range/5BAA6')).toBe(true);
    expect(isAllowedAirGapRequestUrl('https://api.pwnedpasswords.com/range/ABCDE')).toBe(true);
    expect(isAllowedAirGapRequestUrl('https://api.pwnedpasswords.com/other/ABCDE')).toBe(false);
    expect(isAllowedAirGapRequestUrl('https://pwnedpasswords.com/range/ABCDE')).toBe(false);
    expect(isAllowedAirGapRequestUrl('https://api.pwnedpasswords.com.evil.test/range/ABCDE')).toBe(false);
  });
});
