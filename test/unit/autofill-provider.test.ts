import { describe, expect, it } from 'vitest';
import {
  getAndroidAutofillProviderResult,
  readAndroidAutofillContextFromSearchParams,
} from '../../src/lib/autofillProvider';
import { VaultEntry } from '../../src/types';

const entry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
  id: overrides.id ?? 'entry-1',
  title: overrides.title ?? 'Example',
  subtitle: overrides.subtitle ?? 'octo@example.com',
  username: overrides.username ?? 'octo@example.com',
  password: overrides.password ?? 'CorrectHorseBatteryStaple123!',
  url: overrides.url ?? 'https://example.com/login',
  strength: overrides.strength ?? 'EXCELLENT',
  themeColor: overrides.themeColor ?? 'primary',
  type: overrides.type ?? 'login',
  createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('autofillProvider', () => {
  it('returns locked status without candidates until the vault is unlocked', () => {
    expect(getAndroidAutofillProviderResult({
      platform: 'android',
      webDomain: 'example.com',
      packageName: 'com.android.chrome',
      formHints: ['username', 'password'],
      hasUsernameField: true,
      hasPasswordField: true,
    }, [entry()], true)).toEqual({
      status: 'locked',
      candidates: [],
      targetLabel: 'example.com',
    });
  });

  it('returns metadata-only candidates when unlocked and matched', () => {
    const result = getAndroidAutofillProviderResult({
      platform: 'android',
      webDomain: 'example.com',
      formHints: ['username', 'password'],
      hasUsernameField: true,
      hasPasswordField: true,
    }, [entry()], false);

    expect(result.status).toBe('ready');
    expect(result.candidates).toEqual([
      expect.objectContaining({
        id: 'entry-1',
        title: 'Example',
        username: 'octo@example.com',
        hasPassword: true,
      }),
    ]);
    expect(JSON.stringify(result)).not.toContain('CorrectHorseBatteryStaple123!');
  });

  it('excludes passkey-only records from Android password field fill results', () => {
    const result = getAndroidAutofillProviderResult({
      platform: 'android',
      webDomain: 'github.com',
      formHints: ['username', 'password'],
      hasUsernameField: true,
      hasPasswordField: true,
    }, [
      entry({
        id: 'passkey-1',
        title: 'GitHub Passkey',
        type: 'passkey',
        password: undefined,
        url: undefined,
        passkeyDomain: 'github.com',
        passkeyUser: 'octo@example.com',
      }),
      entry({
        id: 'login-1',
        title: 'GitHub Login',
        url: 'https://github.com/login',
      }),
    ], false);

    expect(result.status).toBe('ready');
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toEqual(expect.objectContaining({
      id: 'login-1',
      hasPassword: true,
    }));
  });

  it('returns no-match when Android password fields only match records without passwords', () => {
    const result = getAndroidAutofillProviderResult({
      platform: 'android',
      webDomain: 'github.com',
      formHints: ['password'],
      hasUsernameField: false,
      hasPasswordField: true,
    }, [
      entry({
        id: 'passkey-1',
        title: 'GitHub Passkey',
        type: 'passkey',
        password: undefined,
        url: undefined,
        passkeyDomain: 'github.com',
        passkeyUser: 'octo@example.com',
      }),
    ], false);

    expect(result).toEqual({
      status: 'no-match',
      candidates: [],
      targetLabel: 'github.com',
    });
  });

  it('rejects title-only fallback matches when an Android web domain is available', () => {
    const result = getAndroidAutofillProviderResult({
      platform: 'android',
      webDomain: 'github.com',
      packageName: 'com.android.chrome',
      formHints: ['username', 'password'],
      hasUsernameField: true,
      hasPasswordField: true,
    }, [
      entry({
        id: 'lookalike-title',
        title: 'GitHub Admin',
        url: 'https://example.com/login',
      }),
    ], false);

    expect(result).toEqual({
      status: 'no-match',
      candidates: [],
      targetLabel: 'github.com',
    });
  });

  it('keeps package-only title fallback available for app forms without web domains', () => {
    const result = getAndroidAutofillProviderResult({
      platform: 'android',
      webDomain: null,
      packageName: 'com.github.android',
      formHints: ['username', 'password'],
      hasUsernameField: true,
      hasPasswordField: true,
    }, [
      entry({
        id: 'github-app',
        title: 'GitHub Mobile',
        url: '',
      }),
    ], false);

    expect(result.status).toBe('ready');
    expect(result.candidates[0]).toEqual(expect.objectContaining({
      id: 'github-app',
      reason: 'title-fallback',
    }));
  });

  it('distinguishes unsupported and no-match requests', () => {
    expect(getAndroidAutofillProviderResult({
      platform: 'android',
      webDomain: 'example.com',
      hasUsernameField: false,
      hasPasswordField: false,
    }, [entry()], false).status).toBe('unsupported-request');

    expect(getAndroidAutofillProviderResult({
      platform: 'android',
      webDomain: 'missing.example',
      hasUsernameField: true,
      hasPasswordField: true,
    }, [entry()], false).status).toBe('no-match');
  });

  it('reads Android autofill context from query parameters for app handoff flows', () => {
    const params = new URLSearchParams({
      aegis_autofill_request: 'true',
      web_domain: 'example.com',
      package_name: 'com.android.chrome',
      form_hints: 'username,password',
      has_username: 'true',
      has_password: 'true',
    });

    expect(readAndroidAutofillContextFromSearchParams(params)).toEqual({
      platform: 'android',
      webDomain: 'example.com',
      packageName: 'com.android.chrome',
      formHints: ['username', 'password'],
      hasUsernameField: true,
      hasPasswordField: true,
    });
    expect(readAndroidAutofillContextFromSearchParams(new URLSearchParams())).toBeNull();
  });
});
