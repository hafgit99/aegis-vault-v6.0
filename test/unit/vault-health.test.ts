import { beforeEach, describe, expect, it } from 'vitest';
import { MASTER_PASSWORD_AUDIT_KEY } from '../../src/lib/passwordStrength';
import {
  calculateVaultHealth,
  PLAINTEXT_EXPORT_AUDIT_KEY,
  recordPlaintextExportAudit,
} from '../../src/lib/vaultHealth';
import type { VaultEntry } from '../../src/types';

const entry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
  id: 'entry-1',
  title: 'GitHub',
  subtitle: 'octo',
  username: 'octo',
  password: 'VeryStrongPassword123!',
  url: 'https://github.com',
  notes: '',
  strength: 'EXCELLENT',
  themeColor: 'primary',
  type: 'login',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('vault health', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('calculates category, MFA, passkey, master audit, and plaintext export signals', () => {
    localStorage.setItem(MASTER_PASSWORD_AUDIT_KEY, JSON.stringify({
      score: 95,
      zxcvbnScore: 4,
      label: 'strong',
      length: 20,
      updatedAt: '2026-05-29T00:00:00.000Z',
    }));
    recordPlaintextExportAudit(new Date('2026-05-29T10:00:00.000Z'));

    const health = calculateVaultHealth([
      entry({ id: 'login-1', totpSecret: 'JBSWY3DPEHPK3PXP' }),
      entry({ id: 'login-2', title: 'Mail', password: 'Short1!' }),
      entry({ id: 'card-1', type: 'card', password: undefined }),
      entry({ id: 'identity-1', type: 'identity', password: undefined }),
      entry({
        id: 'passkey-1',
        type: 'passkey',
        password: undefined,
        passkeyCredentialId: '',
        passkeyPublicKey: undefined,
      }),
    ]);

    expect(health.loginCount).toBe(2);
    expect(health.cardCount).toBe(1);
    expect(health.identityCount).toBe(1);
    expect(health.sensitiveCategoryCount).toBe(2);
    expect(health.totpMissingCount).toBe(1);
    expect(health.passkeyUpgradeCount).toBe(2);
    expect(health.incompletePasskeyCount).toBe(1);
    expect(health.masterPasswordStrong).toBe(true);
    expect(health.plaintextExportRisk).toBe(true);
    expect(health.plaintextExportLastAt).toBe('2026-05-29T10:00:00.000Z');
    expect(health.overallScore).toBeLessThan(100);
  });

  it('keeps empty vaults healthy while exposing missing audit defaults', () => {
    const health = calculateVaultHealth([]);

    expect(health.totalCount).toBe(0);
    expect(health.masterPasswordStrong).toBe(false);
    expect(health.plaintextExportRisk).toBe(false);
    expect(health.overallScore).toBe(100);
  });

  it('uses persisted zxcvbn-backed strength labels instead of the synchronous fallback', () => {
    const health = calculateVaultHealth([
      entry({
        id: 'numeric-pattern',
        password: '1234567890ab',
        strength: 'GOOD',
      }),
      entry({
        id: 'zxcvbn-strong',
        password: 'Correct-Horse-Battery-Staple-2026!',
        strength: 'EXCELLENT',
      }),
    ]);

    expect(health.weakEntries.map((item) => item.id)).toEqual(['numeric-pattern']);
    expect(health.weakCount).toBe(1);
  });

  it('records plaintext export audit as local evidence', () => {
    recordPlaintextExportAudit(new Date('2026-05-29T12:30:00.000Z'));

    expect(sessionStorage.getItem(PLAINTEXT_EXPORT_AUDIT_KEY)).toBe('2026-05-29T12:30:00.000Z');
    expect(localStorage.getItem(PLAINTEXT_EXPORT_AUDIT_KEY)).toBeNull();
  });
});
