import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppStateProvider, useAppState } from '../../src/context/AppStateContext';
import { CLIPBOARD_CLEAR_FAILED_EVENT } from '../../src/lib/clipboard';
import { vaultService } from '../../src/lib/vaultService';
import { useAppNotifications } from '../../src/hooks/useAppNotifications';
import { useAutoLock } from '../../src/hooks/useAutoLock';
import { useSecurityLogs } from '../../src/hooks/useSecurityLogs';
import { useVaultEntries } from '../../src/hooks/useVaultEntries';
import type { VaultEntry } from '../../src/types';

vi.mock('../../src/lib/vaultService', () => ({
  vaultService: {
    getPasswords: vi.fn(),
    savePassword: vi.fn(),
    deletePassword: vi.fn(),
    wipeAllData: vi.fn(),
    sqliteDb: {
      clearPasswords: vi.fn(),
      flushToOPFS: vi.fn(),
    },
  },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AppStateProvider defaultUserName="Test User">{children}</AppStateProvider>
);

const entry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
  id: 'entry-1',
  title: 'GitHub',
  subtitle: 'octo',
  username: 'octo',
  password: 'correct horse battery staple',
  url: 'https://github.com',
  notes: '',
  strength: 'EXCELLENT',
  themeColor: 'primary',
  type: 'login',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const emptyInitialEntries: VaultEntry[] = [];

describe('app hooks', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.mocked(vaultService.getPasswords).mockReset();
    vi.mocked(vaultService.savePassword).mockReset();
    vi.mocked(vaultService.deletePassword).mockReset();
    vi.mocked(vaultService.wipeAllData).mockReset();
    vi.mocked(vaultService.sqliteDb!.clearPasswords).mockReset();
    vi.mocked(vaultService.sqliteDb!.flushToOPFS).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('useSecurityLogs', () => {
    it('normalizes stored logs and falls back when persisted logs are malformed', async () => {
      const storedLogs = Array.from({ length: 205 }, (_, index) => ({
        id: `stored-${index}`,
        timestamp: `2026-01-01T00:00:${String(index % 60).padStart(2, '0')}.000Z`,
        action: `Stored ${index}`,
        severity: 'info',
      }));
      localStorage.setItem('aegis_security_logs', JSON.stringify([
        { id: 'bad' },
        ...storedLogs,
      ]));

      const { result, unmount } = renderHook(() => useSecurityLogs(), { wrapper });

      await waitFor(() => expect(result.current.logs).toHaveLength(200));
      expect(result.current.logs[0].action).toBe('Stored 5');
      unmount();

      localStorage.setItem('aegis_security_logs', '{not-json');
      const fallback = renderHook(() => useSecurityLogs(), { wrapper });

      await waitFor(() => expect(fallback.result.current.logs).toHaveLength(1));
      expect(fallback.result.current.logs[0].id).toBe('default');
    });

    it('initializes, persists, appends, and clears bounded security logs', async () => {
      const { result } = renderHook(() => useSecurityLogs(), { wrapper });

      await waitFor(() => expect(result.current.logs).toHaveLength(2));
      expect(sessionStorage.getItem('aegis_security_logs')).toContain(result.current.logs[0].action);
      expect(localStorage.getItem('aegis_security_logs')).toBeNull();

      act(() => {
        result.current.addSecurityLog('Custom warning', 'warning');
      });

      await waitFor(() => expect(result.current.logs).toHaveLength(3));
      expect(result.current.logs.at(-1)).toMatchObject({
        action: 'Custom warning',
        severity: 'warning',
      });

      const showToast = vi.fn();
      act(() => {
        result.current.clearLogs(showToast);
      });

      await waitFor(() => expect(result.current.logs).toHaveLength(1));
      expect(result.current.logs[0].severity).toBe('warning');
      expect(showToast).toHaveBeenCalledWith(expect.any(String));
    });
  });

  describe('useAppNotifications', () => {
    it('shows toast messages, clears them after timeout, and logs clipboard clear failures', async () => {
      vi.useFakeTimers();
      const addSecurityLog = vi.fn();
      const { result } = renderHook(() => useAppNotifications(addSecurityLog), { wrapper });

      act(() => {
        result.current.showToast('Saved');
      });

      expect(result.current.toastMessage).toBe('Saved');

      act(() => {
        window.dispatchEvent(new Event(CLIPBOARD_CLEAR_FAILED_EVENT));
      });

      expect(addSecurityLog).toHaveBeenCalledWith(expect.stringContaining('Pano'), 'warning');
      expect(result.current.toastMessage).toContain('Pano');

      act(() => {
        vi.advanceTimersByTime(3500);
      });

      expect(result.current.toastMessage).toBeNull();
    });
  });

  describe('useAutoLock', () => {
    it('locks an unlocked vault after the configured inactivity window', () => {
      vi.useFakeTimers();
      localStorage.setItem('aegis_auto_lock', '1');
      const onLock = vi.fn();
      const addSecurityLog = vi.fn();

      renderHook(() => useAutoLock({ isLocked: false, onLock, addSecurityLog }));

      act(() => {
        vi.advanceTimersByTime(60_000);
      });

      expect(onLock).toHaveBeenCalledTimes(1);
      expect(addSecurityLog).toHaveBeenCalledWith(expect.stringContaining('1 dakika'), 'warning');
    });

    it('does not schedule a lock when auto-lock is disabled or vault is already locked', () => {
      vi.useFakeTimers();
      localStorage.setItem('aegis_auto_lock', 'never');
      const onLock = vi.fn();
      const addSecurityLog = vi.fn();

      renderHook(() => useAutoLock({ isLocked: false, onLock, addSecurityLog }));

      act(() => {
        vi.advanceTimersByTime(10 * 60_000);
      });

      expect(onLock).not.toHaveBeenCalled();
      expect(addSecurityLog).not.toHaveBeenCalled();
    });

    it('resets the auto-lock timer after user activity and cleans listeners on unmount', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
      localStorage.setItem('aegis_auto_lock', '1');
      const onLock = vi.fn();
      const addSecurityLog = vi.fn();

      const { unmount } = renderHook(() => useAutoLock({ isLocked: false, onLock, addSecurityLog }));

      act(() => {
        vi.advanceTimersByTime(30_000);
        vi.setSystemTime(new Date('2026-01-01T00:00:30.000Z'));
        window.dispatchEvent(new Event('mousemove'));
        vi.advanceTimersByTime(31_000);
      });

      expect(onLock).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(29_000);
      });

      expect(onLock).toHaveBeenCalledTimes(1);

      unmount();
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(onLock).toHaveBeenCalledTimes(1);
    });
  });

  describe('useVaultEntries', () => {
    const renderVaultEntriesHook = (showToast = vi.fn(), addSecurityLog = vi.fn()) => (
      renderHook(() => {
        const appState = useAppState();
        const vaultEntries = useVaultEntries({ initialEntries: emptyInitialEntries, showToast, addSecurityLog });
        return { appState, vaultEntries, showToast, addSecurityLog };
      }, { wrapper })
    );

    it('loads entries when unlocked and moves an entry to trash through the service', async () => {
      const existingEntry = entry();
      const trashedEntry = { ...existingEntry, isDeleted: true };
      vi.mocked(vaultService.getPasswords)
        .mockResolvedValueOnce([existingEntry])
        .mockResolvedValueOnce([trashedEntry]);
      vi.mocked(vaultService.savePassword).mockResolvedValue(undefined);

      const showToast = vi.fn();
      const addSecurityLog = vi.fn();
      const { result } = renderHook(() => {
        const appState = useAppState();
        const vaultEntries = useVaultEntries({ initialEntries: emptyInitialEntries, showToast, addSecurityLog });
        return { appState, vaultEntries };
      }, { wrapper });

      act(() => {
        result.current.appState.actions.setIsLocked(false);
      });

      await waitFor(() => expect(result.current.appState.state.entries).toHaveLength(1));

      await act(async () => {
        await result.current.vaultEntries.handleDeleteEntry(existingEntry.id);
      });

      expect(vaultService.savePassword).toHaveBeenCalledWith(expect.objectContaining({
        id: existingEntry.id,
        isDeleted: true,
      }));
      expect(addSecurityLog).toHaveBeenCalledWith(expect.stringContaining('GitHub'), 'warning');
      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('GitHub'));
    });

    it('seeds bundled entries when the unlocked vault is empty', async () => {
      const sampleEntry = entry({ id: 'sample-1', title: 'Sample' });
      const sampleEntries = [sampleEntry];
      vi.mocked(vaultService.getPasswords)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([sampleEntry]);
      vi.mocked(vaultService.savePassword).mockResolvedValue(undefined);

      const { result } = renderHook(() => {
        const appState = useAppState();
        const vaultEntries = useVaultEntries({ initialEntries: sampleEntries, showToast: vi.fn(), addSecurityLog: vi.fn() });
        return { appState, vaultEntries };
      }, { wrapper });

      act(() => {
        result.current.appState.actions.setIsLocked(false);
      });

      await waitFor(() => expect(result.current.appState.state.entries).toEqual([sampleEntry]));
      expect(vaultService.savePassword).toHaveBeenCalledWith(sampleEntry);
    });

    it('ignores delete, restore, and favorite requests for missing entries', async () => {
      const hook = renderVaultEntriesHook();

      await act(async () => {
        await hook.result.current.vaultEntries.handleDeleteEntry('missing');
        await hook.result.current.vaultEntries.handleRestoreEntry('missing');
        await hook.result.current.vaultEntries.handleToggleFavorite('missing');
      });

      expect(vaultService.savePassword).not.toHaveBeenCalled();
      expect(hook.result.current.showToast).not.toHaveBeenCalled();
    });

    it('imports backups with replace mode and locks after storage wipe', async () => {
      const importedEntry = entry({ id: 'imported-1', title: 'Imported' });
      vi.mocked(vaultService.getPasswords).mockResolvedValue([importedEntry]);
      vi.mocked(vaultService.savePassword).mockResolvedValue(undefined);
      vi.mocked(vaultService.wipeAllData).mockResolvedValue(undefined);
      vi.mocked(vaultService.sqliteDb!.flushToOPFS).mockResolvedValue(undefined);

      const showToast = vi.fn();
      const addSecurityLog = vi.fn();
      const { result } = renderHook(() => {
        const appState = useAppState();
        const vaultEntries = useVaultEntries({ initialEntries: emptyInitialEntries, showToast, addSecurityLog });
        return { appState, vaultEntries };
      }, { wrapper });

      act(() => {
        result.current.appState.actions.setIsLocked(false);
      });

      await act(async () => {
        await result.current.vaultEntries.handleImportBackup([importedEntry], true);
      });

      expect(vaultService.sqliteDb!.clearPasswords).toHaveBeenCalled();
      expect(vaultService.savePassword).toHaveBeenCalledWith(importedEntry, false);
      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('1'));

      await act(async () => {
        await result.current.vaultEntries.handleClearStorage();
      });

      expect(vaultService.wipeAllData).toHaveBeenCalled();
      expect(result.current.appState.state.isLocked).toBe(true);
      expect(addSecurityLog).toHaveBeenCalledWith(expect.stringContaining('Kasa'), 'critical');
      expect(showToast).toHaveBeenCalledWith(expect.any(String));
    });

    it('updates an entry, refreshes selected entry, and records feedback', async () => {
      const existingEntry = entry();
      const updatedEntry = entry({ title: 'GitHub Enterprise', username: 'admin' });
      vi.mocked(vaultService.savePassword).mockResolvedValue(undefined);
      vi.mocked(vaultService.getPasswords).mockResolvedValue([updatedEntry]);

      const hook = renderVaultEntriesHook();
      act(() => {
        hook.result.current.appState.actions.setEntries([existingEntry]);
        hook.result.current.appState.actions.setSelectedEntry(existingEntry);
      });

      await act(async () => {
        await hook.result.current.vaultEntries.handleUpdateEntry(updatedEntry);
      });

      expect(vaultService.savePassword).toHaveBeenCalledWith(updatedEntry);
      expect(hook.result.current.appState.state.selectedEntry).toMatchObject({
        title: 'GitHub Enterprise',
      });
      expect(hook.result.current.addSecurityLog).toHaveBeenCalledWith(expect.stringContaining('GitHub Enterprise'), 'info');
      expect(hook.result.current.showToast).toHaveBeenCalledWith(expect.stringContaining('GitHub Enterprise'));
    });

    it('toggles favorite state and keeps selected entry in sync', async () => {
      const existingEntry = entry({ favorite: false });
      const favoriteEntry = { ...existingEntry, favorite: true };
      vi.mocked(vaultService.savePassword).mockResolvedValue(undefined);
      vi.mocked(vaultService.getPasswords).mockResolvedValue([favoriteEntry]);

      const hook = renderVaultEntriesHook();
      act(() => {
        hook.result.current.appState.actions.setEntries([existingEntry]);
        hook.result.current.appState.actions.setSelectedEntry(existingEntry);
      });

      await act(async () => {
        await hook.result.current.vaultEntries.handleToggleFavorite(existingEntry.id);
      });

      expect(vaultService.savePassword).toHaveBeenCalledWith(expect.objectContaining({
        id: existingEntry.id,
        favorite: true,
      }));
      expect(hook.result.current.appState.state.selectedEntry).toMatchObject({ favorite: true });
      expect(hook.result.current.addSecurityLog).toHaveBeenCalledWith(expect.stringContaining('GitHub'), 'info');
      expect(hook.result.current.showToast).toHaveBeenCalledWith(expect.stringContaining('GitHub'));
    });

    it('toggles favorite off without changing an unrelated selected entry', async () => {
      const favoriteEntry = entry({ favorite: true });
      const unrelatedEntry = entry({ id: 'entry-2', title: 'Mail' });
      vi.mocked(vaultService.savePassword).mockResolvedValue(undefined);
      vi.mocked(vaultService.getPasswords).mockResolvedValue([{ ...favoriteEntry, favorite: false }, unrelatedEntry]);

      const hook = renderVaultEntriesHook();
      act(() => {
        hook.result.current.appState.actions.setEntries([favoriteEntry, unrelatedEntry]);
        hook.result.current.appState.actions.setSelectedEntry(unrelatedEntry);
      });

      await act(async () => {
        await hook.result.current.vaultEntries.handleToggleFavorite(favoriteEntry.id);
      });

      expect(vaultService.savePassword).toHaveBeenCalledWith(expect.objectContaining({ favorite: false }));
      expect(hook.result.current.appState.state.selectedEntry).toMatchObject({ id: 'entry-2' });
      expect(hook.result.current.addSecurityLog).toHaveBeenCalledWith(expect.stringContaining('GitHub'), 'info');
    });

    it('restores trashed entries and permanently deletes records', async () => {
      const trashedEntry = entry({ isDeleted: true, deletedAt: '2026-01-02T00:00:00.000Z' });
      const restoredEntry = { ...trashedEntry, isDeleted: false, deletedAt: undefined };
      vi.mocked(vaultService.savePassword).mockResolvedValue(undefined);
      vi.mocked(vaultService.deletePassword).mockResolvedValue(undefined);
      vi.mocked(vaultService.getPasswords)
        .mockResolvedValueOnce([restoredEntry])
        .mockResolvedValueOnce([]);

      const hook = renderVaultEntriesHook();
      act(() => {
        hook.result.current.appState.actions.setEntries([trashedEntry]);
      });

      await act(async () => {
        await hook.result.current.vaultEntries.handleRestoreEntry(trashedEntry.id);
      });

      expect(vaultService.savePassword).toHaveBeenCalledWith(expect.objectContaining({
        id: trashedEntry.id,
        isDeleted: false,
        deletedAt: undefined,
      }));
      expect(hook.result.current.addSecurityLog).toHaveBeenCalledWith(expect.stringContaining('GitHub'), 'info');

      act(() => {
        hook.result.current.appState.actions.setEntries([trashedEntry]);
      });

      await act(async () => {
        await hook.result.current.vaultEntries.handlePermanentDelete(trashedEntry.id);
      });

      expect(vaultService.deletePassword).toHaveBeenCalledWith(trashedEntry.id);
      expect(hook.result.current.addSecurityLog).toHaveBeenCalledWith(expect.stringContaining('GitHub'), 'critical');
    });

    it('clears trash, resets sample entries, and records both actions', async () => {
      const activeEntry = entry({ id: 'active' });
      const deletedEntry = entry({ id: 'deleted', isDeleted: true });
      const sampleEntry = entry({ id: 'sample', title: 'Sample' });
      const sampleEntries = [sampleEntry];
      vi.mocked(vaultService.deletePassword).mockResolvedValue(undefined);
      vi.mocked(vaultService.savePassword).mockResolvedValue(undefined);
      vi.mocked(vaultService.getPasswords)
        .mockResolvedValueOnce([activeEntry])
        .mockResolvedValueOnce([sampleEntry]);
      vi.mocked(vaultService.sqliteDb!.flushToOPFS).mockResolvedValue(undefined);

      const showToast = vi.fn();
      const addSecurityLog = vi.fn();
      const { result } = renderHook(() => {
        const appState = useAppState();
        const vaultEntries = useVaultEntries({ initialEntries: sampleEntries, showToast, addSecurityLog });
        return { appState, vaultEntries };
      }, { wrapper });

      act(() => {
        result.current.appState.actions.setEntries([activeEntry, deletedEntry]);
      });

      await act(async () => {
        await result.current.vaultEntries.handleClearTrash();
      });

      expect(vaultService.deletePassword).toHaveBeenCalledWith('deleted');
      expect(vaultService.deletePassword).not.toHaveBeenCalledWith('active');
      expect(addSecurityLog).toHaveBeenCalledWith(expect.any(String), 'warning');

      await act(async () => {
        await result.current.vaultEntries.handleResetEntries();
      });

      expect(vaultService.sqliteDb!.clearPasswords).toHaveBeenCalled();
      expect(vaultService.sqliteDb!.flushToOPFS).toHaveBeenCalled();
      expect(vaultService.savePassword).toHaveBeenCalledWith(sampleEntry);
      expect(showToast).toHaveBeenCalledWith(expect.any(String));
    });

    it('persists pwned-password counts, logs breach totals, and rethrows failures', async () => {
      const cleanEntry = entry({ id: 'clean', title: 'Clean' });
      const breachedEntry = entry({ id: 'breached', title: 'Breached' });
      vi.mocked(vaultService.savePassword).mockResolvedValue(undefined);
      vi.mocked(vaultService.sqliteDb!.flushToOPFS).mockResolvedValue(undefined);
      const hook = renderVaultEntriesHook();

      act(() => {
        hook.result.current.appState.actions.setEntries([cleanEntry, breachedEntry]);
      });

      await act(async () => {
        await hook.result.current.vaultEntries.handleUpdatePwnedCounts([
          { entryId: 'clean', count: 0 },
          { entryId: 'breached', count: 12 },
        ]);
      });

      expect(vaultService.savePassword).toHaveBeenCalledWith(expect.objectContaining({ id: 'clean', pwned_count: 0 }), false);
      expect(vaultService.savePassword).toHaveBeenCalledWith(expect.objectContaining({ id: 'breached', pwned_count: 12 }), false);
      expect(hook.result.current.appState.state.entries).toEqual([
        expect.objectContaining({ id: 'clean', pwned_count: 0 }),
        expect.objectContaining({ id: 'breached', pwned_count: 12 }),
      ]);
      expect(hook.result.current.addSecurityLog).toHaveBeenCalledWith(expect.any(String), 'warning');

      vi.mocked(vaultService.savePassword).mockRejectedValueOnce(new Error('write failed'));
      await expect(act(async () => {
        await hook.result.current.vaultEntries.handleUpdatePwnedCounts([{ entryId: 'clean', count: 3 }]);
      })).rejects.toThrow('write failed');
      expect(hook.result.current.showToast).toHaveBeenCalledWith(expect.any(String));
    });

    it('shows error feedback when service operations fail without writing logs', async () => {
      vi.mocked(vaultService.savePassword).mockRejectedValue(new Error('disk full'));
      const hook = renderVaultEntriesHook();

      await act(async () => {
        await hook.result.current.vaultEntries.handleAddEntry(entry());
      });

      expect(hook.result.current.showToast).toHaveBeenCalledWith(expect.any(String));
      expect(hook.result.current.addSecurityLog).not.toHaveBeenCalled();
    });
  });
});
