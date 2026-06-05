import { describe, expect, it } from 'vitest';
import {
  AegisSecurityError,
  classifySecurityError,
  createSecurityError,
  isSecurityError,
  publicSecurityErrorMessage,
  SECURITY_ERROR_DEFINITIONS,
} from '../../src/lib/securityErrors';

describe('security error taxonomy', () => {
  it('creates typed security errors with stable code, category, and severity', () => {
    const error = createSecurityError('SECURE_SHARE_EXPIRED');

    expect(error).toBeInstanceOf(AegisSecurityError);
    expect(error).toMatchObject({
      name: 'AegisSecurityError',
      code: 'SECURE_SHARE_EXPIRED',
      category: 'validation',
      severity: 'warning',
      safeForUser: true,
    });
    expect(error.message).toContain('expired');
    expect(isSecurityError(error)).toBe(true);
    expect(classifySecurityError(error)).toBe(SECURITY_ERROR_DEFINITIONS.SECURE_SHARE_EXPIRED);
  });

  it('preserves safe localized messages while keeping canonical error codes', () => {
    const error = createSecurityError('BACKUP_DECRYPTION_FAILED', 'Parola yanlis veya yedek dosyasi bozuk.');

    expect(error.code).toBe('BACKUP_DECRYPTION_FAILED');
    expect(error.category).toBe('crypto');
    expect(publicSecurityErrorMessage(error)).toBe('Parola yanlis veya yedek dosyasi bozuk.');
  });

  it('redacts unknown secret-bearing errors from public display', () => {
    const rawError = new Error('secret transfer password token leaked in stack detail');

    expect(classifySecurityError(rawError)).toBe(SECURITY_ERROR_DEFINITIONS.UNKNOWN_SECURITY_ERROR);
    expect(publicSecurityErrorMessage(rawError)).toBe('A security-sensitive operation failed.');
  });
});
