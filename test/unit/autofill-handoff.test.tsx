import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutofillHandoff } from '../../src/hooks/useAutofillHandoff';
import {
  clearPendingAndroidAutofillSaveRequest,
  clearPendingAndroidAutofillContext,
  createApprovedAndroidAutofillPayload,
  readPendingAndroidAutofillSaveRequest,
  readPendingAndroidAutofillContext,
  writeApprovedAndroidAutofillPayload,
  writeCanceledAndroidAutofillPayload,
} from '../../src/lib/autofillNativeBridge';
import type { VaultEntry } from '../../src/types';

vi.mock('../../src/lib/autofillNativeBridge', () => ({
  clearPendingAndroidAutofillSaveRequest: vi.fn(),
  clearPendingAndroidAutofillContext: vi.fn(),
  createApprovedAndroidAutofillPayload: vi.fn(),
  readPendingAndroidAutofillSaveRequest: vi.fn(),
  readPendingAndroidAutofillContext: vi.fn(),
  writeApprovedAndroidAutofillPayload: vi.fn(),
  writeCanceledAndroidAutofillPayload: vi.fn(),
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
    vi.mocked(readPendingAndroidAutofillSaveRequest).mockReset();
    vi.mocked(clearPendingAndroidAutofillContext).mockReset();
    vi.mocked(clearPendingAndroidAutofillSaveRequest).mockReset();
    vi.mocked(createApprovedAndroidAutofillPayload).mockReset();
    vi.mocked(writeApprovedAndroidAutofillPayload).mockReset();
    vi.mocked(writeCanceledAndroidAutofillPayload).mockReset();
    vi.mocked(readPendingAndroidAutofillSaveRequest).mockResolvedValue(null);
    vi.mocked(clearPendingAndroidAutofillContext).mockResolvedValue(true);
    vi.mocked(clearPendingAndroidAutofillSaveRequest).mockResolvedValue(true);
    vi.mocked(writeApprovedAndroidAutofillPayload).mockResolvedValue(true);
    vi.mocked(writeCanceledAndroidAutofillPayload).mockResolvedValue(true);
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

  it('writes an approved fill payload without opening the entry detail panel', async () => {
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
    renderHook(
      () => useAutofillHandoff({
        entries: [entry],
        isLocked: false,
        onOpenEntry,
        showToast,
        addSecurityLog,
      }),
    );

    await waitFor(() => expect(readPendingAndroidAutofillContext).toHaveBeenCalled());

    await waitFor(() => expect(writeApprovedAndroidAutofillPayload).toHaveBeenCalledWith(approvedPayload));
    expect(onOpenEntry).not.toHaveBeenCalled();
    expect(createApprovedAndroidAutofillPayload).toHaveBeenCalledWith(expect.any(Object), entry);
    await waitFor(() => expect(showToast).toHaveBeenCalledWith(expect.any(String)));
    expect(addSecurityLog).toHaveBeenCalledWith(expect.any(String), 'info');
    await waitFor(() => expect(clearPendingAndroidAutofillContext).toHaveBeenCalled());
  });

  it('refreshes pending Android Autofill requests when the app receives focus again', async () => {
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
    vi.mocked(readPendingAndroidAutofillContext)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        platform: 'android',
        webDomain: 'example.com',
        packageName: 'com.android.chrome',
        hasUsernameField: true,
        hasPasswordField: true,
      });
    vi.mocked(createApprovedAndroidAutofillPayload).mockReturnValue(approvedPayload);

    const onOpenEntry = vi.fn();
    renderHook(() => useAutofillHandoff({
      entries: [entry],
      isLocked: false,
      onOpenEntry,
      showToast: vi.fn(),
      addSecurityLog: vi.fn(),
    }));

    await waitFor(() => expect(readPendingAndroidAutofillContext).toHaveBeenCalledTimes(1));

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => expect(readPendingAndroidAutofillContext).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(writeApprovedAndroidAutofillPayload).toHaveBeenCalledWith(approvedPayload));
    expect(onOpenEntry).not.toHaveBeenCalled();
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
    renderHook(
      () => useAutofillHandoff({
        entries: [entry],
        isLocked: false,
        onOpenEntry,
        showToast,
        addSecurityLog,
      }),
    );

    await waitFor(() => expect(readPendingAndroidAutofillContext).toHaveBeenCalled());

    await waitFor(() => expect(onOpenEntry).toHaveBeenCalledWith(entry));
    expect(writeApprovedAndroidAutofillPayload).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.any(String));
    expect(addSecurityLog).toHaveBeenCalledWith(expect.any(String), 'info');
  });

  it('waits for an explicit user choice when multiple Android Autofill matches are available', async () => {
    const firstEntry = loginEntry({ id: 'entry-1', title: 'GitHub Personal', url: 'https://github.com/login' });
    const secondEntry = loginEntry({ id: 'entry-2', title: 'GitHub Work', username: 'work@example.com', url: 'https://github.com/session' });
    const approvedPayload = {
      platform: 'android' as const,
      webDomain: 'github.com',
      packageName: 'com.android.chrome',
      title: 'GitHub Work',
      username: 'work@example.com',
      password: 'Secret123!',
      expiresAt: 61_000,
    };
    vi.mocked(readPendingAndroidAutofillContext).mockResolvedValue({
      platform: 'android',
      webDomain: 'github.com',
      packageName: 'com.android.chrome',
      hasUsernameField: true,
      hasPasswordField: true,
    });
    vi.mocked(createApprovedAndroidAutofillPayload).mockReturnValue(approvedPayload);

    const { result } = renderHook(() => useAutofillHandoff({
      entries: [firstEntry, secondEntry],
      isLocked: false,
      onOpenEntry: vi.fn(),
      showToast: vi.fn(),
      addSecurityLog: vi.fn(),
    }));

    await waitFor(() => expect(result.current.selectionRequest?.options).toHaveLength(2));
    expect(writeApprovedAndroidAutofillPayload).not.toHaveBeenCalled();

    act(() => {
      result.current.approveAutofillEntry(result.current.selectionRequest!.options[1]);
    });

    await waitFor(() => expect(writeApprovedAndroidAutofillPayload).toHaveBeenCalledWith(approvedPayload));
    await waitFor(() => expect(clearPendingAndroidAutofillContext).toHaveBeenCalled());
  });

  it('cancels pending Android Autofill authentication when selection is dismissed', async () => {
    vi.mocked(readPendingAndroidAutofillContext).mockResolvedValue({
      platform: 'android',
      webDomain: 'github.com',
      packageName: 'com.android.chrome',
      hasUsernameField: true,
      hasPasswordField: true,
    });

    const { result } = renderHook(() => useAutofillHandoff({
      entries: [
        loginEntry({ id: 'entry-1', title: 'GitHub Personal', url: 'https://github.com/login' }),
        loginEntry({ id: 'entry-2', title: 'GitHub Work', url: 'https://github.com/session' }),
      ],
      isLocked: false,
      onOpenEntry: vi.fn(),
      showToast: vi.fn(),
      addSecurityLog: vi.fn(),
    }));

    await waitFor(() => expect(result.current.selectionRequest?.options).toHaveLength(2));

    act(() => {
      result.current.cancelAutofillSelection();
    });

    await waitFor(() => expect(writeCanceledAndroidAutofillPayload).toHaveBeenCalledWith(expect.objectContaining({
      webDomain: 'github.com',
      packageName: 'com.android.chrome',
    })));
    await waitFor(() => expect(clearPendingAndroidAutofillContext).toHaveBeenCalled());
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

  it('creates a new login record from an explicit Android Autofill save approval', async () => {
    vi.mocked(readPendingAndroidAutofillContext).mockResolvedValue(null);
    vi.mocked(readPendingAndroidAutofillSaveRequest).mockResolvedValue({
      platform: 'android',
      webDomain: 'github.com',
      packageName: 'com.android.chrome',
      username: 'octo@example.com',
      password: 'Secret123!',
      formHints: ['username', 'password'],
      expiresAt: Date.now() + 60_000,
    });

    const onSaveAutofillEntry = vi.fn();
    const addSecurityLog = vi.fn();
    const { result } = renderHook(() => useAutofillHandoff({
      entries: [],
      isLocked: false,
      onOpenEntry: vi.fn(),
      onSaveAutofillEntry,
      showToast: vi.fn(),
      addSecurityLog,
    }));

    await waitFor(() => expect(result.current.saveRequest?.targetLabel).toBe('github.com'));
    expect(addSecurityLog).toHaveBeenCalledWith(expect.any(String), 'warning');

    await act(async () => {
      await result.current.createAutofillSaveEntry();
    });

    expect(onSaveAutofillEntry).toHaveBeenCalledWith(expect.objectContaining({
      title: 'github.com',
      username: 'octo@example.com',
      password: 'Secret123!',
      url: 'https://github.com',
      type: 'login',
    }));
    expect(clearPendingAndroidAutofillSaveRequest).toHaveBeenCalled();
  });

  it('updates an existing matching login from an explicit Android Autofill save approval', async () => {
    const existing = loginEntry({
      id: 'github-entry',
      title: 'GitHub',
      username: 'octo@example.com',
      url: 'https://github.com',
      password: 'OldPassword123!',
    });
    vi.mocked(readPendingAndroidAutofillContext).mockResolvedValue(null);
    vi.mocked(readPendingAndroidAutofillSaveRequest).mockResolvedValue({
      platform: 'android',
      webDomain: 'github.com',
      packageName: 'com.android.chrome',
      username: 'octo@example.com',
      password: 'NewPassword123!',
      formHints: ['username', 'password'],
      expiresAt: Date.now() + 60_000,
    });

    const onUpdateAutofillEntry = vi.fn();
    const { result } = renderHook(() => useAutofillHandoff({
      entries: [existing],
      isLocked: false,
      onOpenEntry: vi.fn(),
      onUpdateAutofillEntry,
      showToast: vi.fn(),
      addSecurityLog: vi.fn(),
    }));

    await waitFor(() => expect(result.current.saveRequest?.existingEntry?.id).toBe(existing.id));

    await act(async () => {
      await result.current.updateAutofillSaveEntry();
    });

    expect(onUpdateAutofillEntry).toHaveBeenCalledWith(expect.objectContaining({
      id: existing.id,
      title: 'GitHub',
      username: 'octo@example.com',
      password: 'NewPassword123!',
      url: 'https://github.com',
    }));
    expect(clearPendingAndroidAutofillSaveRequest).toHaveBeenCalled();
  });
});
