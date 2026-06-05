import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { SecurityLog } from '../components/SecurityLogsModal';
import { useAppState } from '../context/AppStateContext';
import { localizedMessage } from '../i18n/localizedMessages';
import { vaultService } from '../lib/vaultService';
import { VaultEntry } from '../types';

interface UseVaultEntriesArgs {
  initialEntries: VaultEntry[];
  showToast: (message: string) => void;
  addSecurityLog: (action: string, severity?: SecurityLog['severity']) => void;
}

const getErrorMessage = (error: unknown): string => (
  error instanceof Error ? error.message : String(error)
);

export function useVaultEntries({ initialEntries, showToast, addSecurityLog }: UseVaultEntriesArgs) {
  const { t } = useTranslation();
  const {
    state: { entries, isLocked, selectedEntry },
    actions: { setEntries, setIsLocked, setSelectedEntry },
  } = useAppState();

  useEffect(() => {
    if (!isLocked) {
      vaultService.getPasswords().then((loaded) => {
        if (loaded.length === 0) {
          Promise.all(initialEntries.map((entry) => vaultService.savePassword(entry)))
            .then(() => vaultService.getPasswords())
            .then((newLoaded) => setEntries(newLoaded))
            .catch(console.error);
        } else {
          setEntries(loaded);
        }
      }).catch((error) => {
        console.error('Failed to load entries from SQLite:', error);
      });
    } else {
      setEntries([]);
    }
  }, [initialEntries, isLocked, setEntries]);

  const reloadEntries = async () => {
    const loaded = await vaultService.getPasswords();
    setEntries(loaded);
    return loaded;
  };

  const handleAddEntry = async (entry: VaultEntry) => {
    try {
      await vaultService.savePassword(entry);
      await reloadEntries();
      addSecurityLog(t('app.logs.entryCreated', { title: entry.title }), 'info');
      showToast(t('app.logs.entryAdded', { title: entry.title }));
    } catch (error) {
      console.error(error);
      showToast(t('app.logs.entryAddError'));
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      const entryToDelete = entries.find((entry) => entry.id === id);
      if (!entryToDelete) return;

      const title = entryToDelete.title;
      const updatedEntry = { ...entryToDelete, isDeleted: true, deletedAt: new Date().toISOString() };
      await vaultService.savePassword(updatedEntry);
      await reloadEntries();
      addSecurityLog(t('app.logs.entryMovedToTrashLog', { title }), 'warning');
      showToast(t('app.logs.entryMovedToTrash', { title }));
    } catch (error) {
      console.error(error);
      showToast(t('app.logs.entryTrashError'));
    }
  };

  const handleUpdateEntry = async (updatedEntry: VaultEntry) => {
    try {
      await vaultService.savePassword(updatedEntry);
      await reloadEntries();
      setSelectedEntry(updatedEntry);
      addSecurityLog(t('app.logs.entryUpdatedLog', { title: updatedEntry.title }), 'info');
      showToast(t('app.logs.entryUpdated', { title: updatedEntry.title }));
    } catch (error) {
      console.error(error);
      showToast(t('app.logs.entryUpdateError'));
    }
  };

  const handleToggleFavorite = async (id: string) => {
    try {
      const entryToToggle = entries.find((entry) => entry.id === id);
      if (!entryToToggle) return;

      const updated = { ...entryToToggle, favorite: !entryToToggle.favorite };
      await vaultService.savePassword(updated);
      await reloadEntries();

      if (selectedEntry?.id === id) {
        setSelectedEntry(updated);
      }

      if (updated.favorite) {
        addSecurityLog(t('app.logs.favoriteAddedLog', { title: updated.title }), 'info');
        showToast(t('app.logs.favoriteAdded', { title: updated.title }));
      } else {
        addSecurityLog(t('app.logs.favoriteRemovedLog', { title: updated.title }), 'info');
        showToast(t('app.logs.favoriteRemoved', { title: updated.title }));
      }
    } catch (error) {
      console.error(error);
      showToast(t('app.logs.favoriteError'));
    }
  };

  const handleRestoreEntry = async (id: string) => {
    try {
      const entryToRestore = entries.find((entry) => entry.id === id);
      if (!entryToRestore) return;

      const title = entryToRestore.title;
      const updatedEntry = { ...entryToRestore, isDeleted: false, deletedAt: undefined };
      await vaultService.savePassword(updatedEntry);
      await reloadEntries();
      addSecurityLog(t('app.logs.entryRestoredLog', { title }), 'info');
      showToast(t('app.logs.entryRestored', { title }));
    } catch (error) {
      console.error(error);
      showToast(t('app.logs.entryRestoreError'));
    }
  };

  const handlePermanentDelete = async (id: string) => {
    try {
      const entryToDelete = entries.find((entry) => entry.id === id);
      const title = entryToDelete ? entryToDelete.title : t('app.logs.unknownItem');
      await vaultService.deletePassword(id);
      await reloadEntries();
      addSecurityLog(t('app.logs.entryDeletedLog', { title }), 'critical');
      showToast(t('app.logs.entryDeleted', { title }));
    } catch (error) {
      console.error(error);
      showToast(t('app.logs.entryDeleteError'));
    }
  };

  const handleClearTrash = async () => {
    try {
      const deletedEntries = entries.filter((entry) => entry.isDeleted);
      const count = deletedEntries.length;
      for (const entry of deletedEntries) {
        await vaultService.deletePassword(entry.id);
      }
      await reloadEntries();
      addSecurityLog(t('app.logs.trashClearedLog', { count }), 'warning');
      showToast(t('app.logs.trashCleared'));
    } catch (error) {
      console.error(error);
      showToast(t('app.logs.trashClearError'));
    }
  };

  const handleResetEntries = async () => {
    try {
      if (vaultService.sqliteDb) {
        vaultService.sqliteDb.clearPasswords();
        await vaultService.sqliteDb.flushToOPFS();
      }
      for (const entry of initialEntries) {
        await vaultService.savePassword(entry);
      }
      await reloadEntries();
      addSecurityLog(t('app.logs.vaultFactoryReset'), 'warning');
      showToast(t('app.logs.vaultSamplesLoaded'));
    } catch (error) {
      console.error(error);
      showToast(t('app.logs.vaultResetError'));
    }
  };

  const handleImportBackup = async (importedEntries: VaultEntry[], overwrite = false) => {
    try {
      if (overwrite && vaultService.sqliteDb) {
        vaultService.sqliteDb.clearPasswords();
      }
      for (const entry of importedEntries) {
        await vaultService.savePassword(entry, false);
      }
      if (vaultService.sqliteDb) {
        await vaultService.sqliteDb.flushToOPFS();
      }
      await reloadEntries();
      showToast(t('app.logs.importSuccess', { count: importedEntries.length }));
    } catch (error) {
      console.error(localizedMessage('backupImportError'), error);
      showToast(t('app.logs.importError', { message: getErrorMessage(error) }));
    }
  };

  const handleClearStorage = async () => {
    try {
      await vaultService.wipeAllData();
      setEntries([]);
      setIsLocked(true);
      addSecurityLog(t('app.logs.databaseWipedLog'), 'critical');
      showToast(t('app.logs.databaseWiped'));
    } catch (error) {
      console.error(error);
      showToast(t('app.logs.dataDeleteError'));
    }
  };

  const handleUpdatePwnedCounts = async (results: { entryId: string; count: number }[]) => {
    try {
      const resultMap = new Map(results.map((result) => [result.entryId, result.count]));
      const updatedEntries = entries.map((entry) => (
        resultMap.has(entry.id)
          ? { ...entry, pwned_count: resultMap.get(entry.id) || 0 }
          : entry
      ));

      for (const entry of updatedEntries) {
        if (resultMap.has(entry.id)) {
          await vaultService.savePassword(entry, false);
        }
      }
      if (vaultService.sqliteDb) {
        await vaultService.sqliteDb.flushToOPFS();
      }
      setEntries(updatedEntries);
      addSecurityLog(t('app.logs.pwnedScanCompleted', {
        count: results.length,
        breached: results.filter((result) => result.count > 0).length,
      }), 'warning');
      showToast(t('app.logs.pwnedScanSaved'));
    } catch (error) {
      console.error(error);
      showToast(t('app.logs.pwnedScanError'));
      throw error;
    }
  };

  return {
    handleAddEntry,
    handleDeleteEntry,
    handleUpdateEntry,
    handleToggleFavorite,
    handleRestoreEntry,
    handlePermanentDelete,
    handleClearTrash,
    handleResetEntries,
    handleImportBackup,
    handleClearStorage,
    handleUpdatePwnedCounts,
  };
}
