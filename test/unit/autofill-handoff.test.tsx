import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutofillHandoff } from '../../src/hooks/useAutofillHandoff';
import {
  clearPendingAndroidAutofillContext,
  createApprovedAndroidAutofillPayload,
  readPendingAndroidAutofillContext,
  writeApprovedAndroidAutofillPayload,
} from '../../src/lib/autofillNativeBridge';
import type { VaultEntry } from '../../src/types';

vi.mock('../../src/lib/autofillNativeBridge', () => ({
  clearPendingAndroidAutofillContext: vi.fn(),
  createApprovedAndroidAutofillPayload: vi.fn(),
  readPendingAndroidAutofillContext: vi.fn(),
  writeApprovedAndroidAutofillPayload: vi.fn(),
}));

const loginEntry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
  id: 'entry-1',
  title: 'Example',
  subtitle: 'octo@example.com',
  username: 'octo@example.com',
  password: 'Secret123!',
  url: 'https://example.com/login',
  notes: '',
  strength: 'EXCELLENT',
  themeColor: 'primary',
  type: 'login',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('useAutofillHandoff', () => {
  beforeEach(() => {
    vi.mocked(readPendingAndroidAutofillContext).mockReset();
    vi.mocked(clearPendingAndroidAutofillContext).mockReset();
    vi.mocked(createApprovedAndroidAutofillPayload).mockReset();
    vi.mocked(writeApprovedAndroidAutofillPayload).mockReset();
    vi.mocked(clearPendingAndroidAutofillContext).mockResolvedValue(true);
    vi.mocked(writeApprovedAndroidAutofillPayload).mockResolvedValue(true);
  });

  it('keeps pending Android Autofill requests available while the vault is locked', async () => {
    vi.mocked(readPendingAndroidAutofillContext).mockResolvedValue({
      platform: 'android',
      webDomain: 'example.com',
      packageName: 'com.android.chrome',
      hasUsernameField: true,
      hasPasswordField: true,
    });

    const showToast = vi.fn();
    const addSecurityLog = vi.fn();
    const { rerender } = renderHook(
      ({ isLocked }) => useAutofillHandoff({
        entries: [loginEntry()],
        isLocked,
        onOpenEntry: vi.fn(),
        showToast,
        addSecurityLog,
      }),
      { initialProps: { isLocked: true } },
    );

    await waitFor(() => expect(readPendingAndroidAutofillContext).toHaveBeenCalled());
    rerender({ isLocked: true });

    await waitFor(() => expect(showToast).toHaveBeenCalledWith(expect.any(String)));
    expect(addSecurityLog).toHaveBeenCalledWith(expect.any(String), 'warning');
    expect(clearPendingAndroidAutofillContext).not.toHaveBeenCalled();
  });

  it('opens the matched entry, writes an approved fill payload, and clears the pending request', async () => {
    const entry = loginEntry();
    const approvedPayload = {
      platform: 'android' as const,
      webDomain: 'example.com',
      packageName: 'com.android.chrome',
      title: 'Example',
      username: 'octo@example.com',
      password: 'Secret123!',
      expiresAt: 61_000,
    };
    vi.mocked(readPendingAndroidAutofillContext).mockResolvedValue({
      platform: 'android',
      webDomain: 'example.com',
      packageName: 'com.android.chrome',
      hasUsernameField: true,
      hasPasswordField: true,
    });
    vi.mocked(createApprovedAndroidAutofillPayload).mockReturnValue(approvedPayload);

    const onOpenEntry = vi.fn();
    const showToast = vi.fn();
    const addSecurityLog = vi.fn();
    const { rerender } = renderHook(
      ({ entries }) => useAutofillHandoff({
        entries,
        isLocked: false,
        onOpenEntry,
        showToast,
        addSecurityLog,
      }),
      { initialProps: { entries: [] as VaultEntry[] } },
    );

    await waitFor(() => expect(readPendingAndroidAutofillContext).toHaveBeenCalled());
    rerender({ entries: [entry] });

    await waitFor(() => expect(onOpenEntry).toHaveBeenCalledWith(entry));
    expect(createApprovedAndroidAutofillPayload).toHaveBeenCalledWith(expect.any(Object), entry);
    expect(writeApprovedAndroidAutofillPayload).toHaveBeenCalledWith(approvedPayload);
    await waitFor(() => expect(showToast).toHaveBeenCalledWith(expect.any(String)));
    expect(addSecurityLog).toHaveBeenCalledWith(expect.any(String), 'info');
    expect(clearPendingAndroidAutofillContext).toHaveBeenCalled();
  });

  it('falls back to ready feedback when approved payload creation is unavailable', async () => {
    const entry = loginEntry();
    vi.mocked(readPendingAndroidAutofillContext).mockResolvedValue({
      platform: 'android',
      webDomain: 'example.com',
      packageName: 'com.android.chrome',
      hasUsernameField: true,
      hasPasswordField: true,
    });
    vi.mocked(createApprovedAndroidAutofillPayload).mockReturnValue(null);

    const onOpenEntry = vi.fn();
    const showToast = vi.fn();
    const addSecurityLog = vi.fn();
    const { rerender } = renderHook(
      ({ entries }) => useAutofillHandoff({
        entries,
        isLocked: false,
        onOpenEntry,
        showToast,
        addSecurityLog,
      }),
      { initialProps: { entries: [] as VaultEntry[] } },
    );

    await waitFor(() => expect(readPendingAndroidAutofillContext).toHaveBeenCalled());
    rerender({ entries: [entry] });

    await waitFor(() => expect(onOpenEntry).toHaveBeenCalledWith(entry));
    expect(writeApprovedAndroidAutofillPayload).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.any(String));
    expect(addSecurityLog).toHaveBeenCalledWith(expect.any(String), 'info');
  });

  it('reports no-match requests and clears stale Android Autofill context', async () => {
    vi.mocked(readPendingAndroidAutofillContext).mockResolvedValue({
      platform: 'android',
      webDomain: 'unknown.example',
      packageName: 'com.android.chrome',
      hasUsernameField: true,
      hasPasswordField: true,
    });

    const showToast = vi.fn();
    const addSecurityLog = vi.fn();
    const { rerender } = renderHook(
      ({ entries }) => useAutofillHandoff({
        entries,
        isLocked: false,
        onOpenEntry: vi.fn(),
        showToast,
        addSecurityLog,
      }),
      { initialProps: { entries: [] as VaultEntry[] } },
    );

    await waitFor(() => expect(readPendingAndroidAutofillContext).toHaveBeenCalled());
    rerender({ entries: [loginEntry()] });

    await waitFor(() => expect(showToast).toHaveBeenCalledWith(expect.any(String)));
    expect(addSecurityLog).toHaveBeenCalledWith(expect.any(String), 'warning');
    expect(clearPendingAndroidAutofillContext).toHaveBeenCalled();
  });
});
