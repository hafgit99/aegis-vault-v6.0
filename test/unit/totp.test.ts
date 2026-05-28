import { describe, expect, it } from 'vitest';
import {
  decodeBase32,
  generateTOTP,
  generateTotpSecret,
  getTotpRemainingSeconds,
  normalizeTotpSecret,
} from '../../src/lib/totp';

describe('totp', () => {
  it('generates RFC 6238 compatible SHA-1, SHA-256, and SHA-512 codes', async () => {
    const sha1Secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
    const sha256Secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZA';
    const sha512Secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNA';

    await expect(generateTOTP({ secret: sha1Secret, digits: 8, timestamp: 59_000 })).resolves.toBe('94287082');
    await expect(generateTOTP({ secret: sha256Secret, algorithm: 'SHA-256', digits: 8, timestamp: 59_000 })).resolves.toBe('46119246');
    await expect(generateTOTP({ secret: sha512Secret, algorithm: 'SHA-512', digits: 8, timestamp: 59_000 })).resolves.toBe('90693936');
  });

  it('normalizes, decodes, and generates local Base32 secrets', () => {
    expect(normalizeTotpSecret(' jbsw y3dp ehpk3pxp== ')).toBe('JBSWY3DPEHPK3PXP');
    expect(Array.from(decodeBase32('JBSWY3DPEHPK3PXP'))).toEqual([72, 101, 108, 108, 111, 33, 222, 173, 190, 239]);

    const secret = generateTotpSecret(16);
    expect(secret).toHaveLength(16);
    expect(secret).toMatch(/^[A-Z2-7]+$/);
  });

  it('validates invalid secrets, digit counts, and periods', async () => {
    expect(() => decodeBase32('')).toThrow(/empty/);
    expect(() => decodeBase32('BAD!')).toThrow(/Base32/);
    await expect(generateTOTP({ secret: 'JBSWY3DPEHPK3PXP', digits: 5 })).rejects.toThrow(/digits/);
    await expect(generateTOTP({ secret: 'JBSWY3DPEHPK3PXP', period: 0 })).rejects.toThrow(/period/);
  });

  it('calculates remaining seconds in the active period', () => {
    expect(getTotpRemainingSeconds(30, 59_000)).toBe(1);
    expect(getTotpRemainingSeconds(30, 60_000)).toBe(30);
    expect(getTotpRemainingSeconds(0, 59_000)).toBe(1);
  });
});
