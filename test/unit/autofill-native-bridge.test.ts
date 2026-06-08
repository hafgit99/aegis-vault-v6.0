import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  autofillNativeBridgeInternals,
  clearPendingAndroidAutofillSaveRequest,
  clearPendingAndroidAutofillContext,
  clearApprovedAndroidAutofillPayload,
  createApprovedAndroidAutofillPayload,
  readPendingAndroidAutofillSaveRequest,
  readPendingAndroidAutofillContext,
  writeApprovedAndroidAutofillPayload,
  writeCanceledAndroidAutofillPayload,
} from '../../src/lib/autofillNativeBridge';

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

function setUserAgent(value: string) {
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value,
  });
}

function setTauriRuntime(enabled: boolean) {
  Object.defineProperty(window, '__TAURI_INTERNALS__', {
    configurable: true,
    value: enabled ? { invoke: invokeMock } : undefined,
  });
}

describe('autofillNativeBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUserAgent('Mozilla/5.0');
    setTauriRuntime(false);
  });

  it('parses pending Android Autofill request payloads safely', () => {
    expect(autofillNativeBridgeInternals.parsePendingAutofillRequest(JSON.stringify({
      platform: 'android',
      webDomain: 'example.com',
      packageName: 'com.android.chrome',
      formHints: ['username', 1, 'password'],
      hasUsernameField: true,
      hasPasswordField: true,
    }))).toEqual({
      platform: 'android',
      webDomain: 'example.com',
      packageName: 'com.android.chrome',
      formHints: ['username', 'password'],
      hasUsernameField: true,
      hasPasswordField: true,
    });

    expect(autofillNativeBridgeInternals.parsePendingAutofillRequest('{bad json')).toBeNull();
    expect(autofillNativeBridgeInternals.parsePendingAutofillRequest(JSON.stringify({ platform: 'desktop' }))).toBeNull();
  });

  it('parses pending Android Autofill save requests only when complete and unexpired', () => {
    expect(autofillNativeBridgeInternals.parsePendingAutofillSaveRequest(JSON.stringify({
      platform: 'android',
      webDomain: 'github.com',
      packageName: 'com.android.chrome',
      username: 'octo@example.com',
      password: 'Secret123!',
      formHints: ['username', 7, 'password'],
      expiresAt: 16_000,
    }), 1_000)).toEqual({
      platform: 'android',
      webDomain: 'github.com',
      packageName: 'com.android.chrome',
      username: 'octo@example.com',
      password: 'Secret123!',
      formHints: ['username', 'password'],
      expiresAt: 16_000,
    });

    expect(autofillNativeBridgeInternals.parsePendingAutofillSaveRequest('{bad json', 1_000)).toBeNull();
    expect(autofillNativeBridgeInternals.parsePendingAutofillSaveRequest(JSON.stringify({ platform: 'desktop' }), 1_000)).toBeNull();
    expect(autofillNativeBridgeInternals.parsePendingAutofillSaveRequest(JSON.stringify({
      platform: 'android',
      webDomain: 'github.com',
      password: 'Secret123!',
      expiresAt: 999,
    }), 1_000)).toBeNull();
    expect(autofillNativeBridgeInternals.parsePendingAutofillSaveRequest(JSON.stringify({
      platform: 'android',
      webDomain: '',
      packageName: '',
      password: 'Secret123!',
      expiresAt: 16_000,
    }), 1_000)).toBeNull();
    expect(autofillNativeBridgeInternals.parsePendingAutofillSaveRequest(JSON.stringify({
      platform: 'android',
      webDomain: 'github.com',
      password: '',
      expiresAt: 16_000,
    }), 1_000)).toBeNull();
  });

  it('does not call native commands outside Android Tauri runtime', async () => {
    await expect(readPendingAndroidAutofillContext()).resolves.toBeNull();
    await expect(clearPendingAndroidAutofillContext()).resolves.toBe(false);
    await expect(readPendingAndroidAutofillSaveRequest()).resolves.toBeNull();
    await expect(clearPendingAndroidAutofillSaveRequest()).resolves.toBe(false);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('reads and clears pending requests through Android Tauri commands', async () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 15)');
    setTauriRuntime(true);
    invokeMock.mockResolvedValueOnce(JSON.stringify({
      platform: 'android',
      webDomain: 'login.example.com',
      packageName: 'org.mozilla.firefox',
      formHints: ['username'],
      hasUsernameField: true,
      hasPasswordField: false,
    }));
    invokeMock.mockResolvedValueOnce(undefined);

    await expect(readPendingAndroidAutofillContext()).resolves.toMatchObject({
      webDomain: 'login.example.com',
      packageName: 'org.mozilla.firefox',
      hasUsernameField: true,
    });
    await expect(clearPendingAndroidAutofillContext()).resolves.toBe(true);

    expect(invokeMock).toHaveBeenCalledWith('read_pending_autofill_request');
    expect(invokeMock).toHaveBeenCalledWith('clear_pending_autofill_request');
  });

  it('reads and clears pending save requests through Android Tauri commands', async () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 15)');
    setTauriRuntime(true);
    invokeMock.mockResolvedValueOnce(JSON.stringify({
      platform: 'android',
      webDomain: 'github.com',
      packageName: 'com.android.chrome',
      username: 'octo@example.com',
      password: 'Secret123!',
      formHints: ['username', 'password'],
      expiresAt: Date.now() + 60_000,
    }));
    invokeMock.mockResolvedValueOnce(undefined);

    await expect(readPendingAndroidAutofillSaveRequest()).resolves.toMatchObject({
      webDomain: 'github.com',
      packageName: 'com.android.chrome',
      username: 'octo@example.com',
      password: 'Secret123!',
    });
    await expect(clearPendingAndroidAutofillSaveRequest()).resolves.toBe(true);

    expect(invokeMock).toHaveBeenCalledWith('read_pending_autofill_save_request');
    expect(invokeMock).toHaveBeenCalledWith('clear_pending_autofill_save_request');
  });

  it('creates short-lived approved fill payloads only for active password entries', () => {
    expect(createApprovedAndroidAutofillPayload({
      platform: 'android',
      webDomain: 'example.com',
      packageName: 'com.android.chrome',
    }, {
      id: 'entry',
      title: 'Example',
      subtitle: 'octo@example.com',
      username: 'octo@example.com',
      password: 'Secret123!',
      url: 'https://example.com',
      strength: 'EXCELLENT',
      themeColor: 'primary',
      type: 'login',
      createdAt: '2026-01-01T00:00:00.000Z',
    }, 1_000)).toEqual({
      platform: 'android',
      webDomain: 'example.com',
      packageName: 'com.android.chrome',
      title: 'Example',
      username: 'octo@example.com',
      password: 'Secret123!',
      expiresAt: 16_000,
    });

    expect(createApprovedAndroidAutofillPayload({
      platform: 'android',
      webDomain: 'example.com',
    }, {
      id: 'deleted',
      title: 'Deleted',
      subtitle: '',
      username: '',
      password: 'Secret123!',
      url: 'https://example.com',
      strength: 'EXCELLENT',
      themeColor: 'primary',
      type: 'login',
      createdAt: '2026-01-01T00:00:00.000Z',
      isDeleted: true,
    })).toBeNull();
  });

  it('writes and clears approved fill payloads through Android Tauri commands', async () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 15)');
    setTauriRuntime(true);
    invokeMock.mockResolvedValue(undefined);

    const payload = {
      platform: 'android' as const,
      webDomain: 'example.com',
      packageName: 'com.android.chrome',
      title: 'Example',
      username: 'octo@example.com',
      password: 'Secret123!',
      expiresAt: 16_000,
    };

    await expect(writeApprovedAndroidAutofillPayload(payload)).resolves.toBe(true);
    await expect(clearApprovedAndroidAutofillPayload()).resolves.toBe(true);

    expect(invokeMock).toHaveBeenCalledWith('write_approved_autofill_payload', {
      payload: JSON.stringify(payload),
    });
    expect(invokeMock).toHaveBeenCalledWith('clear_approved_autofill_payload');
  });

  it('writes canceled Autofill payloads through the approved handoff channel', async () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 15)');
    setTauriRuntime(true);
    invokeMock.mockResolvedValue(undefined);

    await expect(writeCanceledAndroidAutofillPayload({
      platform: 'android',
      webDomain: 'example.com',
      packageName: 'com.android.chrome',
    }, 1_000)).resolves.toBe(true);

    expect(invokeMock).toHaveBeenCalledWith('write_approved_autofill_payload', {
      payload: JSON.stringify({
        platform: 'android',
        status: 'canceled',
        webDomain: 'example.com',
        packageName: 'com.android.chrome',
        expiresAt: 16_000,
      }),
    });
  });
});
