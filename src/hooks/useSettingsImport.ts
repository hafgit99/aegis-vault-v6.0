import { ChangeEvent, DragEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  convertImportedToVaultEntry,
  ImporterLabels,
} from '../lib/importer';
import { parseVaultImportFile } from '../lib/importWorkflow';
import { VaultEntry } from '../types';
import type { ImportConflictMode, ImportFeedback, ImportParseReport, ImportResultReport, ImportReview, ImportSource } from '../types/import';

interface UseSettingsImportOptions {
  importerLabels: ImporterLabels;
  onImport: (importedEntries: VaultEntry[], overwrite?: boolean) => void;
  onAddLog: (action: string, severity?: 'info' | 'warning' | 'critical') => void;
}

export function useSettingsImport({ importerLabels, onImport, onAddLog }: UseSettingsImportOptions) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importSource, setImportSource] = useState<ImportSource>('aegis_encrypted');
  const [importPassword, setImportPassword] = useState('');
  const [showImportPassword, setShowImportPassword] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedEntries, setParsedEntries] = useState<Partial<VaultEntry>[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [importConflictMode, setImportConflictMode] = useState<ImportConflictMode>('merge');
  const [importFeedback, setImportFeedback] = useState<ImportFeedback | null>(null);
  const [importReview, setImportReview] = useState<ImportReview | null>(null);
  const [importResult, setImportResult] = useState<ImportResultReport | null>(null);

  const buildImportReview = (
    report: ImportParseReport,
    rawItems: Partial<VaultEntry>[],
    selectedCount = rawItems.length,
  ): ImportReview => {
    const countByType = (type: VaultEntry['type']) => rawItems.filter((entry) => entry.type === type).length;
    const knownCount = countByType('login') + countByType('card') + countByType('note') + countByType('identity') + countByType('passkey');

    return {
      ...report,
      totalRecords: rawItems.length,
      selectedRecords: selectedCount,
      loginCount: countByType('login'),
      cardCount: countByType('card'),
      noteCount: countByType('note'),
      identityCount: countByType('identity'),
      passkeyCount: countByType('passkey'),
      otherCount: Math.max(0, rawItems.length - knownCount),
    };
  };

  const resetImportSelection = (file: File) => {
    setImportFile(file);
    setParsedEntries([]);
    setSelectedIndices(new Set());
    setImportFeedback(null);
    setImportReview(null);
    setImportResult(null);
  };

  const clearImportWorkspace = () => {
    setParsedEntries([]);
    setSelectedIndices(new Set());
    setImportFeedback(null);
    setImportReview(null);
    setImportResult(null);
    setImportFile(null);
    setImportPassword('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    resetImportSelection(file);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    resetImportSelection(file);
  };

  const handleParseFile = async () => {
    if (!importFile) return;
    setIsParsing(true);
    setImportFeedback(null);
    setImportResult(null);

    try {
      let parseReport: ImportParseReport | null = null;
      const rawItems = await parseVaultImportFile({
        file: importFile,
        source: importSource,
        password: importPassword,
        importerLabels,
        messages: {
          encryptedExpected: t('app.settingsPage.importErrors.encryptedExpected'),
          secureShareExpected: t('app.settingsPage.importErrors.secureShareExpected'),
          importPasswordRequired: t('app.settingsPage.importErrors.importPasswordRequired'),
          legacyKdfConfirm: t('app.settingsPage.importErrors.legacyKdfConfirm'),
          legacyKdfRejected: t('app.settingsPage.importErrors.legacyKdfRejected'),
          fileIsEncrypted: t('app.settingsPage.importErrors.fileIsEncrypted'),
        },
        onReport: (report) => {
          parseReport = report;
        },
      });

      if (rawItems.length === 0) {
        throw new Error(t('app.settingsPage.importErrors.noCompatibleData'));
      }

      setParsedEntries(rawItems);
      const nextSelectedIndices = new Set(Array.from({ length: rawItems.length }, (_, i) => i));
      setSelectedIndices(nextSelectedIndices);
      setImportReview(buildImportReview(
        parseReport || {
          source: importSource,
          fileName: importFile.name,
          fileSizeKb: (importFile.size / 1024).toFixed(1),
          encrypted: importSource === 'aegis_encrypted' || importSource === 'secure_share',
          legacyKdf: false,
          secureShare: importSource === 'secure_share',
        },
        rawItems,
        nextSelectedIndices.size,
      ));
      onAddLog(t('app.settingsPage.logs.importParsed', { source: importSource.toUpperCase(), count: rawItems.length }), 'info');
    } catch (err: any) {
      setImportFeedback({
        success: false,
        msg: t('app.settingsPage.importErrors.parse', { message: err.message }),
      });
      setImportReview(null);
      onAddLog(t('app.settingsPage.logs.importParseError', { message: err.message }), 'warning');
    } finally {
      setIsParsing(false);
    }
  };

  const handleExecuteImport = () => {
    if (selectedIndices.size === 0) {
      alert(t('app.settingsPage.alerts.selectImportRecord'));
      return;
    }

    try {
      const selectedPartials = parsedEntries.filter((_, idx) => selectedIndices.has(idx));
      const convertedEntries = selectedPartials.map((entry) => convertImportedToVaultEntry(entry, importerLabels));

      if (importConflictMode === 'replace') {
        onImport(convertedEntries, true);
        onAddLog(t('app.settingsPage.logs.importReplace', { count: convertedEntries.length }), 'warning');
      } else {
        onImport(convertedEntries, false);
        onAddLog(t('app.settingsPage.logs.importMerge', { count: convertedEntries.length }), 'info');
      }

      setImportFeedback({
        success: true,
        msg: t('app.settingsPage.importSuccess', { count: convertedEntries.length }),
      });
      setImportResult(importReview
        ? {
            ...importReview,
            selectedRecords: convertedEntries.length,
            importedRecords: convertedEntries.length,
            skippedRecords: Math.max(0, importReview.totalRecords - convertedEntries.length),
            conflictMode: importConflictMode,
            completedAt: new Date().toLocaleString(),
          }
        : null);
      setImportReview((current) => current
        ? { ...current, selectedRecords: convertedEntries.length }
        : null);

      setParsedEntries([]);
      setImportFile(null);
      setImportPassword('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setImportFeedback({
        success: false,
        msg: t('app.settingsPage.importErrors.app', { message: err.message }),
      });
      setImportResult(null);
    }
  };

  const toggleSelectIndex = (idx: number) => {
    const updated = new Set(selectedIndices);
    if (updated.has(idx)) {
      updated.delete(idx);
    } else {
      updated.add(idx);
    }
    setSelectedIndices(updated);
    setImportReview((current) => current ? { ...current, selectedRecords: updated.size } : null);
  };

  const toggleSelectAll = () => {
    if (selectedIndices.size === parsedEntries.length) {
      setSelectedIndices(new Set());
      setImportReview((current) => current ? { ...current, selectedRecords: 0 } : null);
    } else {
      const nextSelectedIndices = new Set(Array.from({ length: parsedEntries.length }, (_, i) => i));
      setSelectedIndices(nextSelectedIndices);
      setImportReview((current) => current ? { ...current, selectedRecords: nextSelectedIndices.size } : null);
    }
  };

  return {
    fileInputRef,
    importSource,
    setImportSource,
    importPassword,
    setImportPassword,
    showImportPassword,
    setShowImportPassword,
    importFile,
    setImportFile,
    isParsing,
    parsedEntries,
    setParsedEntries,
    selectedIndices,
    importConflictMode,
    setImportConflictMode,
    importFeedback,
    importReview,
    importResult,
    clearImportWorkspace,
    handleFileChange,
    handleDragOver,
    handleDrop,
    handleParseFile,
    handleExecuteImport,
    toggleSelectIndex,
    toggleSelectAll,
  };
}
