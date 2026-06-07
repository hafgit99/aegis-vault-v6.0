import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  autofillNativeBridgeInternals,
  clearPendingAndroidAutofillContext,
  clearApprovedAndroidAutofillPayload,
  createApprovedAndroidAutofillPayload,
  readPendingAndroidAutofillContext,
  writeApprovedAndroidAutofillPayload,
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

  it('does not call native commands outside Android Tauri runtime', async () => {
    await expect(readPendingAndroidAutofillContext()).resolves.toBeNull();
    await expect(clearPendingAndroidAutofillContext()).resolves.toBe(false);
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
      expiresAt: 61_000,
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
      expiresAt: 61_000,
    };

    await expect(writeApprovedAndroidAutofillPayload(payload)).resolves.toBe(true);
    await expect(clearApprovedAndroidAutofillPayload()).resolves.toBe(true);

    expect(invokeMock).toHaveBeenCalledWith('write_approved_autofill_payload', {
      payload: JSON.stringify(payload),
    });
    expect(invokeMock).toHaveBeenCalledWith('clear_approved_autofill_payload');
  });
});
