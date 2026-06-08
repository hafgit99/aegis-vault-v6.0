import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearStoredSecretKey,
  getStoredSecretKey,
  hasLocalSecretConfiguration,
  persistSecretKey,
} from '../../src/lib/secureSecretStore';

describe('secureSecretStore', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    delete (window as any).__TAURI__;
    delete (window as any).__TAURI_INTERNALS__;
    vi.clearAllMocks();
  });

  it('uses session storage and optional local fallback on the web', async () => {
    await persistSecretKey('A3-WEB-SECRET', false);

    expect(sessionStorage.getItem('aegis_session_secret_key')).toBe('A3-WEB-SECRET');
    expect(localStorage.getItem('aegis_remembered_secret_key')).toBeNull();
    await expect(getStoredSecretKey()).resolves.toBe('A3-WEB-SECRET');

    await persistSecretKey('A3-REMEMBERED-SECRET', true);
    expect(sessionStorage.getItem('aegis_session_secret_key')).toBe('A3-REMEMBERED-SECRET');
    expect(localStorage.getItem('aegis_remembered_secret_key')).toBeNull();
    expect(localStorage.getItem('aegis_secret_key_session_only_warning')).toBe('session-only');
    expect(hasLocalSecretConfiguration()).toBe(true);
  });

  it('stores remembered desktop secrets in the OS keychain instead of localStorage', async () => {
    const invoke = vi.fn(async (command: string) => {
      if (command === 'get_secret_key') return 'A3-KEYCHAIN-SECRET';
      return undefined;
    });
    (window as any).__TAURI__ = { core: { invoke } };

    await persistSecretKey('A3-KEYCHAIN-SECRET', true);

    expect(invoke).toHaveBeenCalledWith('store_secret_key', { secretKey: 'A3-KEYCHAIN-SECRET' });
    expect(localStorage.getItem('aegis_remembered_secret_key')).toBeNull();
    await expect(getStoredSecretKey()).resolves.toBe('A3-KEYCHAIN-SECRET');
  });

  it('supports the legacy Tauri invoke bridge and falls back when keychain is empty', async () => {
    const invoke = vi.fn(async (command: string) => {
      if (command === 'get_secret_key') return null;
      return undefined;
    });
    (window as any).__TAURI__ = { invoke };
    localStorage.setItem('aegis_remembered_secret_key', 'A3-LOCAL-SECRET');

    await expect(getStoredSecretKey()).resolves.toBe('A3-LOCAL-SECRET');
    expect(sessionStorage.getItem('aegis_session_secret_key')).toBe('A3-LOCAL-SECRET');
    expect(localStorage.getItem('aegis_remembered_secret_key')).toBeNull();
    expect(invoke).toHaveBeenCalledWith('get_secret_key', undefined);
  });

  it('falls back to session-only storage when the desktop keychain rejects writes', async () => {
    const invoke = vi.fn(async (command: string) => {
      if (command === 'store_secret_key') throw new Error('keychain unavailable');
      return null;
    });
    (window as any).__TAURI__ = { core: { invoke } };

    await persistSecretKey('A3-FALLBACK-SECRET', true);

    expect(sessionStorage.getItem('aegis_session_secret_key')).toBe('A3-FALLBACK-SECRET');
    expect(localStorage.getItem('aegis_remembered_secret_key')).toBeNull();
    expect(localStorage.getItem('aegis_secret_key_session_only_warning')).toBe('session-only');
  });

  it('removes remembered desktop secrets when remember device is disabled', async () => {
    const invoke = vi.fn(async () => undefined);
    (window as any).__TAURI__ = { core: { invoke } };
    localStorage.setItem('aegis_remembered_secret_key', 'remembered');

    await persistSecretKey('A3-SESSION-ONLY', false);

    expect(sessionStorage.getItem('aegis_session_secret_key')).toBe('A3-SESSION-ONLY');
    expect(localStorage.getItem('aegis_remembered_secret_key')).toBeNull();
    expect(invoke).toHaveBeenCalledWith('delete_secret_key', undefined);
  });

  it('clears session, legacy local, remembered local, and keychain secrets', async () => {
    const invoke = vi.fn(async () => undefined);
    (window as any).__TAURI_INTERNALS__ = { invoke };
    sessionStorage.setItem('aegis_session_secret_key', 'session');
    localStorage.setItem('aegis_remembered_secret_key', 'remembered');
    localStorage.setItem('aegis_secret_key', 'legacy');

    await clearStoredSecretKey();

    expect(sessionStorage.getItem('aegis_session_secret_key')).toBeNull();
    expect(localStorage.getItem('aegis_remembered_secret_key')).toBeNull();
    expect(localStorage.getItem('aegis_secret_key')).toBeNull();
    expect(localStorage.getItem('aegis_secret_key_session_only_warning')).toBeNull();
    expect(invoke).toHaveBeenCalledWith('delete_secret_key', undefined);
  });
});
