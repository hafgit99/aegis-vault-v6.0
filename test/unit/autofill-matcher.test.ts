import { describe, expect, it } from 'vitest';
import { getAutofillCandidates, normalizeAutofillDomain } from '../../src/lib/autofillMatcher';
import { VaultEntry } from '../../src/types';

const entry = (overrides: Partial<VaultEntry>): VaultEntry => ({
  id: overrides.id ?? 'entry-1',
  title: overrides.title ?? 'GitHub',
  subtitle: overrides.subtitle ?? overrides.username ?? 'octo@example.com',
  username: overrides.username ?? 'octo@example.com',
  password: overrides.password ?? 'CorrectHorseBatteryStaple123!',
  url: overrides.url ?? 'https://github.com/login',
  strength: overrides.strength ?? 'EXCELLENT',
  themeColor: overrides.themeColor ?? 'primary',
  type: overrides.type ?? 'login',
  createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('autofillMatcher', () => {
  it('normalizes origins and stored URLs into comparable domains', () => {
    expect(normalizeAutofillDomain('https://www.Example.com/login')).toBe('example.com');
    expect(normalizeAutofillDomain('example.com:443/sign-in')).toBe('example.com');
    expect(normalizeAutofillDomain('')).toBe('');
  });

  it('returns ranked candidates without exposing password values', () => {
    const candidates = getAutofillCandidates([
      entry({ id: 'sub', title: 'Accounts Example', url: 'https://accounts.example.com/login' }),
      entry({ id: 'exact', title: 'Example', url: 'https://example.com/login', totpSecret: 'SECRET' }),
      entry({ id: 'other', title: 'Other', url: 'https://other.test', password: 'Secret123456!' }),
    ], {
      platform: 'android',
      origin: 'https://example.com/session',
      formHints: ['username', 'password'],
    });

    expect(candidates.map(candidate => candidate.id)).toEqual(['exact', 'sub']);
    expect(candidates[0]).toMatchObject({
      domain: 'example.com',
      hasPassword: true,
      hasTotp: true,
      reason: 'exact-domain',
      score: 100,
    });
    expect(JSON.stringify(candidates)).not.toContain('CorrectHorseBatteryStaple123!');
  });

  it('filters deleted, unsupported, and irrelevant entries', () => {
    const candidates = getAutofillCandidates([
      entry({ id: 'deleted', deletedAt: '2026-01-02T00:00:00.000Z' }),
      entry({ id: 'note', type: 'note', password: undefined, url: 'https://example.com' }),
      entry({ id: 'empty-login', password: undefined, url: 'https://example.com' }),
      entry({ id: 'valid', url: 'https://example.com' }),
    ], {
      platform: 'desktop',
      webDomain: 'example.com',
    });

    expect(candidates.map(candidate => candidate.id)).toEqual(['valid']);
  });

  it('supports passkey domain matching and ignores unrelated form hints', () => {
    expect(getAutofillCandidates([
      entry({
        id: 'passkey',
        type: 'passkey',
        password: undefined,
        passkeyDomain: 'login.example.com',
        passkeyUser: 'passkey@example.com',
      }),
    ], {
      platform: 'android',
      origin: 'https://login.example.com',
      formHints: ['username'],
    })).toEqual([
      expect.objectContaining({
        id: 'passkey',
        reason: 'passkey-domain',
        username: 'passkey@example.com',
        hasPassword: false,
      }),
    ]);

    expect(getAutofillCandidates([
      entry({ id: 'valid', url: 'https://example.com' }),
    ], {
      platform: 'android',
      origin: 'https://example.com',
      formHints: ['postalAddress'],
    })).toEqual([]);
  });
});
