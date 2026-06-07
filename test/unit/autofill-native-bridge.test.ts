import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  autofillNativeBridgeInternals,
  clearPendingAndroidAutofillContext,
  readPendingAndroidAutofillContext,
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
});
