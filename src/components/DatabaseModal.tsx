import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Database, Download, Trash2, 
  AlertTriangle, CheckCircle2, ShieldCheck, PieChart,
  Lock, Key, Eye, EyeOff, Radio, CheckSquare, Square,
  Sparkles, FileText, FileSpreadsheet, FileJson, Info, Upload, RefreshCw, ClipboardCheck
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { VaultEntry } from '../types';
import { encryptData } from '../lib/backupCrypto';
import { convertImportedToVaultEntry } from '../lib/importer';
import { parseVaultImportFile } from '../lib/importWorkflow';
import { recordPlaintextExportAudit } from '../lib/vaultHealth';
import type { ImportConflictMode, ImportParseReport, ImportResultReport, ImportReview, ImportSource } from '../types/import';

interface DatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: VaultEntry[];
  onImportBackup: (imported: VaultEntry[], overwrite?: boolean) => Promise<void> | void;
  onClearStorage: () => void;
  onAddLog: (action: string) => void;
}

export default function DatabaseModal({
  isOpen,
  onClose,
  entries,
  onImportBackup,
  onClearStorage,
  onAddLog
}: DatabaseModalProps) {
  const { t } = useTranslation();
  const importerLabels = {
    accessLogin: t('app.importer.accessLogin'),
    login: t('app.importer.login'),
    creditCard: t('app.importer.creditCard'),
    secureNote: t('app.importer.secureNote'),
    cryptoWalletKey: t('app.importer.cryptoWalletKey'),
    passkey: t('app.importer.passkey'),
    identity: t('app.importer.identity'),
    idCard: t('app.importer.idCard'),
    untitledImport: t('app.importer.untitledImport'),
    loginTitle: t('app.importer.loginTitle'),
    recordTitle: t('app.importer.recordTitle'),
    international: t('app.importer.international'),
    notSpecified: t('app.importer.notSpecified'),
    onePasswordRecord: t('app.importer.onePasswordRecord')
  };
  const [activeSubTab, setActiveSubTab] = useState<'analytics' | 'export' | 'import' | 'wipe'>('export');
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Export States
  const [exportMethod, setExportMethod] = useState<'encrypted' | 'plain'>('encrypted');
  const [exportPassword, setExportPassword] = useState('');
  const [exportConfirmPassword, setExportConfirmPassword] = useState('');
  const [showExportPassword, setShowExportPassword] = useState(false);
  const [plainWarningAccepted, setPlainWarningAccepted] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessPreview, setExportSuccessPreview] = useState<{
    fileName: string;
    sampleData: string;
  } | null>(null);

  // Import States
  const [importSource, setImportSource] = useState<ImportSource>('aegis_encrypted');
  const [importPassword, setImportPassword] = useState('');
  const [showImportPassword, setShowImportPassword] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedEntries, setParsedEntries] = useState<Partial<VaultEntry>[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [importConflictMode, setImportConflictMode] = useState<ImportConflictMode>('merge');
  const [importReview, setImportReview] = useState<ImportReview | null>(null);
  const [importResult, setImportResult] = useState<ImportResultReport | null>(null);
  
  // Wipe Database Confirm States
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Approximate database footprint size in bytes
  const serialized = JSON.stringify(entries);
  const dbSizeInBytes = new Blob([serialized]).size;
  const importSourceOptions = [
    { id: 'aegis_encrypted', label: t('app.database.import.sourceLabels.aegisEncrypted'), icon: Lock },
    { id: 'secure_share', label: t('app.database.import.sourceLabels.secureShare'), icon: ShieldCheck },
    { id: 'bitwarden', label: 'Bitwarden', icon: FileSpreadsheet },
    { id: 'onepassword', label: '1Password', icon: FileSpreadsheet },
    { id: 'keepass', label: 'KeePass', icon: FileSpreadsheet },
    { id: 'lastpass', label: 'LastPass', icon: FileSpreadsheet },
    { id: 'chrome', label: t('app.database.import.sourceLabels.chrome'), icon: FileSpreadsheet },
    { id: 'generic_csv', label: t('app.database.import.sourceLabels.genericCsv'), icon: FileText }
  ] satisfies Array<{ id: ImportSource; label: string; icon: typeof Lock }>;
  const selectedPercent = importReview && importReview.totalRecords > 0
    ? Math.round((selectedIndices.size / importReview.totalRecords) * 100)
    : 0;
  const typeSummary = importReview
    ? [
        { key: 'login', count: importReview.loginCount },
        { key: 'card', count: importReview.cardCount },
        { key: 'note', count: importReview.noteCount },
        { key: 'identity', count: importReview.identityCount },
        { key: 'passkey', count: importReview.passkeyCount },
        { key: 'other', count: importReview.otherCount },
      ].filter((item) => item.count > 0)
    : [];

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

  const showStatus = (text: string, isError: boolean = false) => {
    setStatusMessage({ text, isError });
    setTimeout(() => {
      setStatusMessage(null);
    }, 4500);
  };

  // Secure Cryptographic Export Helper
  const handleExportActualBackup = async () => {
    setIsExporting(true);
    try {
      let actualPassword = '';
      
      if (exportMethod === 'encrypted') {
        const pass = exportPassword.trim();
        const confirmPass = exportConfirmPassword.trim();
        
        if (!pass) {
          throw new Error(t('app.database.errors.exportPasswordRequired'));
        }
        if (pass.length < 4) {
          throw new Error(t('app.database.errors.exportPasswordTooShort'));
        }
        if (pass !== confirmPass) {
          throw new Error(t('app.database.errors.exportPasswordMismatch'));
        }
        actualPassword = pass;
      } else {
        if (!plainWarningAccepted) {
          throw new Error(t('app.database.errors.plainWarningRequired'));
        }
      }

      const activeEntries = entries.filter(e => !e.isDeleted);
      const rawJson = JSON.stringify(activeEntries);
      let backupObject: any = {};

      if (exportMethod === 'encrypted') {
        const encrypted = await encryptData(rawJson, actualPassword);
        backupObject = {
          app: "AegisVault",
          encrypted: true,
          version: "1.1.0",
          timestamp: new Date().toISOString(),
          kdf: encrypted.kdf,
          salt: encrypted.salt,
          iv: encrypted.iv,
          data: encrypted.data
        };
      } else {
        backupObject = {
          app: "AegisVault",
          encrypted: false,
          version: "1.1.0",
          timestamp: new Date().toISOString(),
          vault: JSON.parse(rawJson)
        };
      }

      const fileData = JSON.stringify(backupObject, null, 2);
      const blob = new Blob([fileData], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      
      const prefix = exportMethod === 'encrypted' ? t('app.database.exportFile.encryptedPrefix') : t('app.database.exportFile.plainPrefix');
      const fileName = `${prefix}_${new Date().toISOString().split('T')[0]}.json`;
      link.download = fileName;
      link.click();
      if (exportMethod === 'plain') {
        recordPlaintextExportAudit();
      }

      onAddLog(t('app.database.logs.backupDownloaded', { method: exportMethod === 'encrypted' ? t('app.database.logs.encrypted') : t('app.database.logs.plain') }));
      showStatus(t('app.database.status.exported'));

      // Prepare preview evidence of encryption
      let sampleText = "";
      if (exportMethod === 'encrypted') {
        sampleText = `{
  "app": "AegisVault",
  "encrypted": true,
  "timestamp": "${backupObject.timestamp}",
  "kdf": "${backupObject.kdf?.algorithm || 'argon2id'}",
  "salt": "${backupObject.salt.substring(0, 12)}...",
  "iv": "${backupObject.iv}",
  "data": "${backupObject.data.substring(0, 36)}..."
}`;
      } else {
        sampleText = `{
  "app": "AegisVault",
  "encrypted": false,
  "timestamp": "${backupObject.timestamp}",
  "vault": [
     { "title": "...", "username": "...", "password": "..." } // ${t('app.database.exportFile.totalRecordsComment', { count: backupObject.vault?.length || 0 })}
  ]
}`;
      }

      setExportSuccessPreview({
        fileName,
        sampleData: sampleText
      });

    } catch (err: any) {
      showStatus(err.message, true);
    } finally {
      setIsExporting(false);
    }
  };

  // Drag and drop event handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setImportFile(file);
    setParsedEntries([]);
    setSelectedIndices(new Set());
    setImportReview(null);
    setImportResult(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setParsedEntries([]);
    setSelectedIndices(new Set());
    setImportReview(null);
    setImportResult(null);
  };

  // Decrypt and Parse uploaded file
  const handleParseFile = async () => {
    if (!importFile) return;
    setIsParsing(true);
    setStatusMessage(null);
    setImportResult(null);

    try {
      let parseReport: ImportParseReport | null = null;
      const rawItems = await parseVaultImportFile({
        file: importFile,
        source: importSource,
        password: importPassword,
        importerLabels,
        messages: {
          encryptedExpected: t('app.database.errors.encryptedFileExpected'),
          secureShareExpected: t('app.database.errors.secureShareExpected'),
          importPasswordRequired: t('app.database.errors.importPasswordRequired'),
          legacyKdfConfirm: t('app.database.errors.legacyKdfConfirm'),
          legacyKdfRejected: t('app.database.errors.legacyKdfRejected'),
          fileIsEncrypted: t('app.database.errors.fileIsEncrypted'),
        },
        onReport: (report) => {
          parseReport = report;
        },
      });

      if (rawItems.length === 0) {
        throw new Error(t('app.database.errors.noCompatibleData'));
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
      showStatus(t('app.database.status.parsed', { count: rawItems.length }));
      
    } catch (err: any) {
      setImportReview(null);
      showStatus(t('app.database.errors.wizardError', { message: err.message }), true);
    } finally {
      setIsParsing(false);
    }
  };

  // Run bulk import execution
  const handleExecuteImport = async () => {
    if (selectedIndices.size === 0) {
      alert(t('app.database.selectImportRecord'));
      return;
    }

    try {
      const selectedPartials = parsedEntries.filter((_, idx) => selectedIndices.has(idx));
      const convertedEntries = selectedPartials.map(p => convertImportedToVaultEntry(p, importerLabels));

      const isOverwrite = importConflictMode === 'replace';
      await onImportBackup(convertedEntries, isOverwrite);

      onAddLog(t('app.database.logs.imported', { count: selectedIndices.size, strategy: importConflictMode }));
      showStatus(t('app.database.status.imported', { count: convertedEntries.length }));
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

      // Reset
      setParsedEntries([]);
      setImportFile(null);
      setImportPassword('');
      setImportReview((current) => current
        ? { ...current, selectedRecords: convertedEntries.length }
        : null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setImportResult(null);
      showStatus(t('app.database.errors.writeError', { message: err.message }), true);
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

  const handleShatterEverything = () => {
    onClearStorage();
    onAddLog(t('app.database.wipeLog'));
    showStatus(t('app.database.wipeDone'), false);
    setParsedEntries([]);
    setShowWipeConfirm(false);
    setWipeConfirmText("");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div id="database-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-neutral-950/85 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-xl bg-surface-container-high border border-white/10 rounded-[1.5rem] shadow-2xl overflow-hidden z-10 flex flex-col my-8 max-h-[85vh]"
          >
            {/* Header decor flare */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-12 bg-primary/10 rounded-full blur-2xl pointer-events-none" />

            {/* Title Bar */}
            <div className="p-6 border-b border-white/5 flex justify-between items-center relative z-10 bg-surface-container-highest">
              <div className="flex items-center gap-2.5">
                <Database className="text-primary w-5 h-5" />
                <div>
                  <h3 className="text-md font-outfit text-on-surface font-semibold leading-none">{t('app.database.title')}</h3>
                  <p className="text-[10px] text-on-surface-variant/60 mt-1">{t('app.database.subtitle')}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-white/10 text-on-surface-variant transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex bg-surface-container-highest/60 border-b border-white/5 px-4">
              {([
                { id: 'export', label: t('app.database.tabs.export'), icon: Download },
                { id: 'import', label: t('app.database.tabs.import'), icon: Sparkles },
                { id: 'analytics', label: t('app.database.tabs.analytics'), icon: PieChart },
                { id: 'wipe', label: t('app.database.tabs.wipe'), icon: Trash2 }
              ] satisfies Array<{ id: typeof activeSubTab; label: string; icon: typeof Download }>).map((tab) => {
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveSubTab(tab.id);
                      setExportSuccessPreview(null);
                    }}
                    className={`flex items-center gap-1.5 py-3 px-3.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                      activeSubTab === tab.id
                        ? 'text-primary border-primary bg-white/5'
                        : 'text-on-surface-variant border-transparent hover:text-on-surface'
                    }`}
                  >
                    <TabIcon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Scrollable Content Workspace */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              
              {/* Status Banner */}
              {statusMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
                    statusMessage.isError 
                      ? 'bg-error/15 border-error/30 text-error animate-shake' 
                      : 'bg-tertiary/15 border-tertiary/30 text-on-surface'
                  }`}
                >
                  {statusMessage.isError ? (
                    <AlertTriangle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-4.5 h-4.5 text-tertiary shrink-0 mt-0.5" />
                  )}
                  <span>{statusMessage.text}</span>
                </motion.div>
              )}

              {/* TAB 1: Secure backup */}
              {activeSubTab === 'export' && (
                <div className="space-y-4">
                  {exportSuccessPreview ? (
                    /* Real cryptology proof visualizer */
                    <div className="space-y-4 animate-fade-in bg-tertiary/5 p-4 rounded-xl border border-tertiary/20">
                      <div className="flex justify-between items-center bg-[#0d111d] p-3 rounded-lg border border-white/5">
                        <div>
                          <span className="text-[10px] text-tertiary font-bold block uppercase tracking-wider">{t('app.database.export.downloadedDocument')}</span>
                          <span className="text-xs text-on-surface font-mono font-bold">{exportSuccessPreview.fileName}</span>
                        </div>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-tertiary/10 text-tertiary uppercase border border-tertiary/20">{t('app.database.export.sealed')}</span>
                      </div>

                      <div className="space-y-1.5 text-left">
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">{t('app.database.export.proof')}</span>
                        <div className="bg-[#0b0e17] p-3 rounded-lg border border-white/5 font-mono text-[10px] text-on-surface-variant leading-relaxed select-all">
                          <pre className="whitespace-pre-wrap">{exportSuccessPreview.sampleData}</pre>
                        </div>
                        <p className="text-[10px] text-on-surface-variant/60 italic leading-relaxed text-center mt-2 block">
                          {t('app.database.export.proofNote')}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setExportSuccessPreview(null)}
                        className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-xs font-bold text-on-surface rounded-xl border border-white/10 transition-colors cursor-pointer"
                      >
                        {t('app.database.export.newBackup')}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 bg-tertiary/5 rounded-xl border border-tertiary/15 space-y-1">
                        <span className="text-xs font-bold text-tertiary block font-outfit uppercase">{t('app.database.export.sealedEncryption')}</span>
                        <p className="text-xs text-on-surface-variant/80 leading-relaxed">
                          {t('app.database.export.sealedDescription')}
                        </p>
                      </div>
                      <div className="rounded-xl border border-tertiary/15 bg-tertiary/5 p-4 flex gap-3">
                        <ShieldCheck className="w-5 h-5 text-tertiary shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">{t('app.database.export.guideTitle')}</h4>
                          <p className="text-[11px] leading-relaxed text-on-surface-variant/80">{t('app.database.export.guideDescription')}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setExportMethod('encrypted')}
                          className={`p-3.5 rounded-xl border flex flex-col items-start gap-1 transition-all text-left cursor-pointer ${
                            exportMethod === 'encrypted'
                              ? 'bg-tertiary/10 border-tertiary/40 text-on-surface'
                              : 'border-white/5 hover:bg-white/5 text-on-surface-variant'
                          }`}
                        >
                          <Lock className="w-4.5 h-4.5 text-tertiary mb-1" />
                          <span className="text-xs font-bold font-outfit uppercase leading-none">{t('app.database.export.encryptedRecommended')}</span>
                          <span className="text-[9px] opacity-70 mt-1">{t('app.database.export.encryptedDescription')}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setExportMethod('plain');
                          }}
                          className={`p-3.5 rounded-xl border flex flex-col items-start gap-1 transition-all text-left cursor-pointer ${
                            exportMethod === 'plain'
                              ? 'bg-error/10 border-error/40 text-on-surface'
                              : 'border-white/5 hover:bg-white/5 text-on-surface-variant'
                          }`}
                        >
                          <AlertTriangle className="w-4.5 h-4.5 text-error mb-1" />
                          <span className="text-xs font-bold font-outfit text-error uppercase leading-none">{t('app.database.export.plainJson')}</span>
                          <span className="text-[9px] opacity-75 mt-1 text-on-surface-variant/80">{t('app.database.export.plainDescription')}</span>
                        </button>
                      </div>

                      {exportMethod === 'encrypted' ? (
                        <div className="space-y-3.5 animate-fade-in">
                          <div className="space-y-2.5 text-left pt-1">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">{t('app.database.export.passwordLabel')}</label>
                              <div className="relative">
                                <input
                                  type={showExportPassword ? 'text' : 'password'}
                                  value={exportPassword}
                                  onChange={(e) => setExportPassword(e.target.value)}
                                  placeholder={t('app.database.export.passwordPlaceholder')}
                                  className="w-full bg-surface-container-high border border-white/5 focus:border-tertiary/40 rounded-xl px-4 py-3 text-xs outline-none text-on-surface pr-10"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowExportPassword(!showExportPassword)}
                                  className="absolute right-3 top-3.5 text-on-surface-variant/60 hover:text-on-surface"
                                  aria-label={showExportPassword ? t('app.lockScreen.hidePassword') : t('app.lockScreen.showPassword')}
                                >
                                  {showExportPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">{t('app.database.export.confirmPassword')}</label>
                              <input
                                  type={showExportPassword ? 'text' : 'password'}
                                  value={exportConfirmPassword}
                                  onChange={(e) => setExportConfirmPassword(e.target.value)}
                                  placeholder={t('app.database.export.confirmPasswordPlaceholder')}
                                  className="w-full bg-surface-container-high border border-white/5 focus:border-tertiary/40 rounded-xl px-4 py-3 text-xs outline-none text-on-surface"
                              />
                            </div>

                            {exportPassword && exportConfirmPassword && exportPassword !== exportConfirmPassword && (
                              <span className="text-[10px] text-error font-semibold block animate-flash">
                                {t('app.database.export.passwordMismatchInline')}
                              </span>
                            )}
                          </div>

                          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex gap-2.5 text-[11px] text-yellow-500/90 leading-relaxed text-left">
                            <AlertTriangle className="w-4.5 h-4.5 flex-shrink-0 mt-0.5" />
                            <span>
                              <strong>{t('app.database.export.responsibility')}</strong> {t('app.database.export.responsibilityText')}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3.5 animate-fade-in text-left">
                          <div className="p-3.5 bg-error/10 border border-error/20 rounded-xl flex gap-3 text-error">
                            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <div>
                              <span className="text-xs font-bold uppercase tracking-wider block">{t('app.database.export.danger')}</span>
                              <p className="text-[11px] leading-relaxed mt-1 opacity-90">
                                {t('app.database.export.plainDangerText')}
                              </p>
                            </div>
                          </div>

                          <div 
                            onClick={() => setPlainWarningAccepted(!plainWarningAccepted)}
                            className={`p-3 rounded-xl border cursor-pointer flex items-start gap-3 transition-all ${
                              plainWarningAccepted ? 'bg-error-container/15 border-error/30' : 'border-white/5 hover:bg-white/5'
                            }`}
                          >
                            <div className="mt-0.5">
                              {plainWarningAccepted ? (
                                <CheckSquare className="w-4 h-4 text-error" />
                              ) : (
                                <Square className="w-4 h-4 text-on-surface-variant/40" />
                              )}
                            </div>
                            <div className="select-none">
                              <span className="text-xs font-bold text-on-surface block">{t('app.database.export.acceptDanger')}</span>
                              <span className="text-[10px] text-on-surface-variant/60 block mt-0.5 leading-relaxed">
                                {t('app.database.export.plainAcceptanceText')}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={
                          isExporting || 
                          (exportMethod === 'encrypted' && (!exportPassword || exportPassword !== exportConfirmPassword || exportPassword.length < 4)) || 
                          (exportMethod === 'plain' && !plainWarningAccepted)
                        }
                        onClick={handleExportActualBackup}
                        className="w-full py-3.5 bg-primary text-[#02050A] hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer text-sm"
                      >
                        <Download className="w-4 h-4" />
                        {isExporting ? t('app.database.export.encrypting') : t('app.database.export.encryptAndDownload')}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Universal import wizard */}
              {activeSubTab === 'import' && (
                <div className="space-y-4">
                  <p className="text-xs text-on-surface-variant/80 leading-relaxed text-left">
                    {t('app.database.import.description')}
                  </p>
                  <div className="rounded-xl border border-primary/15 bg-primary/5 p-4 flex gap-3">
                    <Upload className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">{t('app.database.import.guideTitle')}</h4>
                      <p className="text-[11px] leading-relaxed text-on-surface-variant/80">{t('app.database.import.guideDescription')}</p>
                    </div>
                  </div>

                  {/* Sources Selection */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block text-left">{t('app.database.import.source')}</span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {importSourceOptions.map((src) => {
                        const IconComponent = src.icon;
                        return (
                          <button
                            key={src.id}
                            type="button"
                            onClick={() => {
                              setImportSource(src.id);
                              setParsedEntries([]);
                              setImportFile(null);
                              setSelectedIndices(new Set());
                              setImportReview(null);
                              setImportResult(null);
                            }}
                            className={`p-2.5 border rounded-xl flex items-center gap-2 text-xs font-semibold text-left transition-all cursor-pointer ${
                              importSource === src.id 
                                ? 'bg-tertiary/10 text-tertiary border-tertiary/40' 
                                : 'border-white/5 hover:bg-white/5 text-on-surface-variant hover:text-on-surface'
                            }`}
                          >
                            <IconComponent className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{src.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Drag drop upload area */}
                  <div 
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all hover:bg-white/5 ${
                      importFile ? 'border-primary bg-primary/5' : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      accept=".json,.csv"
                      className="hidden" 
                    />
                    
                    {importFile ? (
                      <div className="space-y-1.5">
                        <FileJson className="w-9 h-9 text-primary mx-auto" />
                        <span className="text-xs text-on-surface font-semibold block">{importFile.name}</span>
                        <span className="text-[10px] text-on-surface-variant/60">{(importFile.size / 1024).toFixed(1)} KB</span>
                        <span className="text-[10px] text-primary block font-bold">{t('app.database.import.changeFile')}</span>
                      </div>
                    ) : (
                      <div className="space-y-1.5 text-on-surface-variant/70">
                        <Upload className="w-8 h-8 mx-auto opacity-50" />
                        <span className="text-xs font-semibold block">{t('app.database.import.dropFile')}</span>
                        <span className="text-[10px]">{t('app.database.import.supported')}</span>
                      </div>
                    )}
                  </div>

                  {/* Decrypt Password input if AegisVault Encrypted backup */}
                  {(importSource === 'aegis_encrypted' || importSource === 'secure_share') && importFile && (
                    <div className="p-3.5 bg-[#121625]/30 rounded-xl border border-white/5 space-y-1.5 text-left animate-fade-in">
                      <div className="flex justify-between items-center text-[10px]">
                        <label className="font-bold text-on-surface-variant uppercase tracking-wider">{t('app.database.import.decryptKey')}</label>
                      </div>
                      <div className="relative">
                        <input
                          type={showImportPassword ? 'text' : 'password'}
                          value={importPassword}
                          onChange={(e) => setImportPassword(e.target.value)}
                          placeholder={t('app.database.import.decryptPlaceholder')}
                          className="w-full bg-surface-container-high border border-white/5 focus:border-tertiary/40 rounded-xl px-4 py-2.5 text-xs outline-none text-on-surface pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowImportPassword(!showImportPassword)}
                          aria-label={showImportPassword ? t('app.lockScreen.hidePassword') : t('app.lockScreen.showPassword')}
                          className="absolute right-3 top-3 text-on-surface-variant/60 hover:text-on-surface"
                        >
                          {showImportPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {importFile && parsedEntries.length === 0 && (
                    <button
                      type="button"
                      disabled={isParsing}
                      onClick={handleParseFile}
                      className="w-full py-3 bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-xs font-bold text-on-surface rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isParsing ? 'animate-spin' : ''}`} />
                      {isParsing ? t('app.database.import.parsing') : t('app.database.import.parse')}
                    </button>
                  )}

                  {importResult && (
                    <div className="rounded-2xl border border-tertiary/25 bg-tertiary/10 p-4 space-y-3 text-left">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-tertiary shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">{t('app.settingsPage.importResult.title')}</h4>
                          <p className="text-[11px] text-on-surface-variant/75 leading-relaxed mt-1">
                            {t('app.settingsPage.importResult.description', {
                              count: importResult.importedRecords,
                              file: importResult.fileName,
                              mode: importResult.conflictMode === 'replace' ? t('app.database.import.replace') : t('app.database.import.merge'),
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-white/5 bg-[#0d111d]/60 p-3">
                          <span className="text-[9px] text-on-surface-variant/60 uppercase tracking-wider block">{t('app.settingsPage.importResult.imported')}</span>
                          <strong className="text-lg font-mono text-tertiary">{importResult.importedRecords}</strong>
                        </div>
                        <div className="rounded-xl border border-white/5 bg-[#0d111d]/60 p-3">
                          <span className="text-[9px] text-on-surface-variant/60 uppercase tracking-wider block">{t('app.settingsPage.importResult.skipped')}</span>
                          <strong className="text-lg font-mono text-on-surface">{importResult.skippedRecords}</strong>
                        </div>
                        <div className="rounded-xl border border-white/5 bg-[#0d111d]/60 p-3">
                          <span className="text-[9px] text-on-surface-variant/60 uppercase tracking-wider block">{t('app.settingsPage.importReview.records')}</span>
                          <strong className="text-lg font-mono text-on-surface">{importResult.totalRecords}</strong>
                        </div>
                        <div className="rounded-xl border border-white/5 bg-[#0d111d]/60 p-3">
                          <span className="text-[9px] text-on-surface-variant/60 uppercase tracking-wider block">{t('app.settingsPage.importReview.mode')}</span>
                          <strong className={`text-sm font-bold ${importResult.conflictMode === 'replace' ? 'text-error' : 'text-tertiary'}`}>
                            {importResult.conflictMode === 'replace' ? t('app.database.import.replace') : t('app.database.import.merge')}
                          </strong>
                        </div>
                        <div className="rounded-xl border border-white/5 bg-[#0d111d]/60 p-3">
                          <span className="text-[9px] text-on-surface-variant/60 uppercase tracking-wider block">{t('app.settingsPage.importResult.completedAt')}</span>
                          <strong className="text-[11px] font-mono text-on-surface break-words">{importResult.completedAt}</strong>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2 text-[11px]">
                        <div className={`rounded-xl border p-3 ${
                          importResult.secureShare
                            ? 'border-tertiary/20 bg-tertiary/5 text-on-surface'
                            : 'border-white/5 bg-white/5 text-on-surface'
                        }`}>
                          <span className="font-bold block">{importResult.secureShare ? t('app.settingsPage.importResult.secureShare') : t('app.settingsPage.importResult.standardImport')}</span>
                          <span className="text-on-surface-variant/70">{importResult.fileName}</span>
                          {importResult.secureShare && (
                            <span className="mt-1 block text-on-surface-variant/70">
                              {t(
                                importResult.secureShareManifestVerified
                                  ? 'app.settingsPage.importReview.manifestVerified'
                                  : 'app.settingsPage.importReview.legacyManifest',
                                {
                                  version: importResult.secureShareVersion || '1.0',
                                  checksum: importResult.secureShareManifestChecksum?.slice(0, 12) || t('app.settingsPage.importReview.noChecksum'),
                                },
                              )}
                            </span>
                          )}
                        </div>
                        <div className={`rounded-xl border p-3 ${
                          importResult.legacyKdf
                            ? 'border-error/25 bg-error-container/15 text-error'
                            : 'border-tertiary/20 bg-tertiary/5 text-on-surface'
                        }`}>
                          <span className="font-bold block">{importResult.legacyKdf ? t('app.settingsPage.importReview.legacyKdf') : t('app.settingsPage.importReview.modernKdf')}</span>
                          <span className="text-on-surface-variant/70">{importResult.kdfAlgorithm || t('app.settingsPage.importReview.noKdf')}</span>
                        </div>
                      </div>
                      <div className={`rounded-xl border p-3 text-[11px] ${
                        importResult.legacyKdf
                          ? 'border-error/25 bg-error-container/15 text-error'
                          : 'border-tertiary/20 bg-tertiary/5 text-on-surface'
                      }`}>
                        <span className="font-bold block">{t('app.settingsPage.importResult.securitySummary')}</span>
                        <span className="text-on-surface-variant/75 leading-relaxed">
                          {t('app.settingsPage.importResult.securitySummaryDetail', {
                            encrypted: importResult.encrypted ? t('app.settingsPage.importResult.encryptedYes') : t('app.settingsPage.importResult.encryptedNo'),
                            manifest: importResult.secureShare
                              ? (importResult.secureShareManifestVerified ? t('app.settingsPage.importResult.manifestVerified') : t('app.settingsPage.importResult.manifestLegacy'))
                              : t('app.settingsPage.importResult.manifestNotApplicable'),
                            kdf: importResult.kdfAlgorithm || t('app.settingsPage.importReview.noKdf'),
                          })}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Checklist and options preview */}
                  {parsedEntries.length > 0 && (
                    <div className="space-y-4 pt-3 border-t border-white/5">
                      {importReview && (
                        <div className="rounded-2xl border border-tertiary/20 bg-tertiary/5 p-4 space-y-3 text-left">
                          <div className="flex items-start gap-3">
                            <ClipboardCheck className="w-5 h-5 text-tertiary shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">{t('app.settingsPage.importReview.title')}</h4>
                              <p className="text-[11px] text-on-surface-variant/75 leading-relaxed mt-1">
                                {t('app.settingsPage.importReview.description', {
                                  file: importReview.fileName,
                                  source: importSourceOptions.find((source) => source.id === importReview.source)?.label || importReview.source,
                                })}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-xl border border-white/5 bg-[#0d111d]/60 p-3">
                              <span className="text-[9px] text-on-surface-variant/60 uppercase tracking-wider block">{t('app.settingsPage.importReview.records')}</span>
                              <strong className="text-lg font-mono text-on-surface">{importReview.totalRecords}</strong>
                            </div>
                            <div className="rounded-xl border border-white/5 bg-[#0d111d]/60 p-3">
                              <span className="text-[9px] text-on-surface-variant/60 uppercase tracking-wider block">{t('app.settingsPage.importReview.selected')}</span>
                              <strong className="text-lg font-mono text-tertiary">{selectedIndices.size}</strong>
                              <span className="text-[9px] text-on-surface-variant/55 ml-1">{selectedPercent}%</span>
                            </div>
                            <div className="rounded-xl border border-white/5 bg-[#0d111d]/60 p-3">
                              <span className="text-[9px] text-on-surface-variant/60 uppercase tracking-wider block">{t('app.settingsPage.importReview.size')}</span>
                              <strong className="text-lg font-mono text-on-surface">{importReview.fileSizeKb}</strong>
                              <span className="text-[9px] text-on-surface-variant/55 ml-1">KB</span>
                            </div>
                            <div className="rounded-xl border border-white/5 bg-[#0d111d]/60 p-3">
                              <span className="text-[9px] text-on-surface-variant/60 uppercase tracking-wider block">{t('app.settingsPage.importReview.mode')}</span>
                              <strong className={`text-sm font-bold ${importConflictMode === 'replace' ? 'text-error' : 'text-tertiary'}`}>
                                {importConflictMode === 'replace' ? t('app.database.import.replace') : t('app.database.import.merge')}
                              </strong>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {typeSummary.map((item) => (
                              <span key={item.key} className="rounded-lg border border-white/5 bg-white/5 px-2.5 py-1 text-[10px] font-bold text-on-surface-variant">
                                {t(`app.settingsPage.importReview.types.${item.key}`)}: <span className="text-on-surface">{item.count}</span>
                              </span>
                            ))}
                          </div>

                          <div className="grid grid-cols-1 gap-2 text-[11px]">
                            <div className={`rounded-xl border p-3 ${
                              importReview.encrypted
                                ? 'border-tertiary/20 bg-tertiary/5 text-on-surface'
                                : 'border-error/25 bg-error-container/15 text-error'
                            }`}>
                              <span className="font-bold block">{importReview.encrypted ? t('app.settingsPage.importReview.encrypted') : t('app.settingsPage.importReview.plaintext')}</span>
                              <span className="text-on-surface-variant/70">{importReview.kdfAlgorithm || t('app.settingsPage.importReview.noKdf')}</span>
                            </div>
                            <div className={`rounded-xl border p-3 ${
                              importReview.legacyKdf
                                ? 'border-error/25 bg-error-container/15 text-error'
                                : 'border-tertiary/20 bg-tertiary/5 text-on-surface'
                            }`}>
                              <span className="font-bold block">{importReview.legacyKdf ? t('app.settingsPage.importReview.legacyKdf') : t('app.settingsPage.importReview.modernKdf')}</span>
                              <span className="text-on-surface-variant/70">
                                {importReview.secureShare
                                  ? t('app.settingsPage.importReview.secureShareMeta', {
                                      count: importReview.secureShareItemCount || importReview.totalRecords,
                                      expires: importReview.secureShareExpiresAt || t('app.settingsPage.importReview.noExpiry'),
                                    })
                                  : t('app.settingsPage.importReview.kdfNote')}
                              </span>
                              {importReview.secureShare && (
                                <span className="mt-1 block text-on-surface-variant/70">
                                  {t(
                                    importReview.secureShareManifestVerified
                                      ? 'app.settingsPage.importReview.manifestVerified'
                                      : 'app.settingsPage.importReview.legacyManifest',
                                    {
                                      version: importReview.secureShareVersion || '1.0',
                                      checksum: importReview.secureShareManifestChecksum?.slice(0, 12) || t('app.settingsPage.importReview.noChecksum'),
                                    },
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-on-surface-variant uppercase block text-left">{t('app.database.import.documentRecords', { count: parsedEntries.length })}</span>
                          <span className="text-[9px] text-on-surface-variant/50 block text-left">{t('app.database.import.markToImport')}</span>
                        </div>
                        <button
                          type="button"
                          onClick={toggleSelectAll}
                          className="text-[10px] font-bold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 px-2 py-0.5 rounded transition-all cursor-pointer"
                        >
                          {selectedIndices.size === parsedEntries.length ? t('app.database.import.deselect') : t('app.database.import.selectAll')}
                        </button>
                      </div>

                      {/* Scrollable list item checkboxes */}
                      <div className="max-h-[170px] overflow-y-auto rounded-xl border border-white/5 divide-y divide-white/5 bg-[#121625]/20 font-mono text-[10px] select-none pr-1">
                        {parsedEntries.map((item, index) => {
                          const isSelected = selectedIndices.has(index);
                          return (
                            <div 
                              key={index}
                              onClick={() => toggleSelectIndex(index)}
                              className={`flex items-center justify-between p-2.5 cursor-pointer hover:bg-white/5 transition-colors ${
                                isSelected ? 'bg-primary/5' : ''
                              }`}
                            >
                              <div className="min-w-0 pr-4 flex-1 flex items-center gap-2.5">
                                {isSelected ? (
                                  <CheckSquare className="w-4.5 h-4.5 text-primary flex-shrink-0" />
                                ) : (
                                  <Square className="w-4.5 h-4.5 text-on-surface-variant/40 flex-shrink-0" />
                                )}
                                <div className="min-w-0 flex-1 text-left">
                                  <span className="text-on-surface font-bold text-xs truncate block font-sans">{item.title || t('app.database.import.untitled')}</span>
                                  <span className="text-on-surface-variant/60 text-[9px] truncate block">
                                    {item.type === 'card' 
                                      ? `${t('app.addEntry.categories.card')}: ${item.cardNumber ? '••••' + item.cardNumber.slice(-4) : t('app.database.import.unknown')}`
                                      : item.username || item.url || t('app.database.import.dataEntry')}
                                  </span>
                                </div>
                              </div>
                              <span className="py-0.5 px-2 bg-white/5 rounded text-[8px] uppercase font-bold text-on-surface-variant tracking-wider shrink-0 font-sans">
                                {item.type || 'login'}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Import strategy controls */}
                      <div className="space-y-2.5 bg-[#121625]/30 p-3.5 rounded-xl border border-white/5 text-left">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">{t('app.database.import.strategy')}</label>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          <div 
                            onClick={() => setImportConflictMode('merge')}
                            className={`p-2.5 rounded-lg border cursor-pointer flex gap-2.5 transition-all ${
                              importConflictMode === 'merge'
                                ? 'bg-primary/5 border-primary/30'
                                : 'border-white/5 hover:border-white/10'
                            }`}
                          >
                            <Radio className={`w-4 h-4 mt-0.5 ${importConflictMode === 'merge' ? 'text-primary' : 'opacity-30'}`} />
                            <div>
                              <span className="text-xs font-bold text-on-surface block">{t('app.database.import.merge')}</span>
                              <span className="text-[9px] text-on-surface-variant/60 block mt-0.5 leading-tight">{t('app.database.import.mergeDescription')}</span>
                            </div>
                          </div>

                          <div 
                            onClick={() => setImportConflictMode('replace')}
                            className={`p-2.5 rounded-lg border cursor-pointer flex gap-2.5 transition-all ${
                              importConflictMode === 'replace'
                                ? 'bg-error/10 border-error/20'
                                : 'border-white/5 hover:border-white/10'
                            }`}
                          >
                            <Radio className={`w-4 h-4 mt-0.5 ${importConflictMode === 'replace' ? 'text-error' : 'opacity-30'}`} />
                            <div>
                              <span className="text-xs font-bold text-on-surface text-error block">{t('app.database.import.replace')}</span>
                              <span className="text-[9px] text-on-surface-variant/60 block mt-0.5 leading-tight text-error-container">{t('app.database.import.replaceDescription')}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Execution button */}
                      <button
                        type="button"
                        onClick={handleExecuteImport}
                        className="w-full py-3 bg-primary text-[#02050A] font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer text-xs"
                      >
                        <Download className="w-4 h-4" />
                        {t('app.database.import.execute', { count: selectedIndices.size })}
                      </button>
                    </div>
                  )}

                </div>
              )}

              {/* TAB 3: Anomaly and data metrics */}
              {activeSubTab === 'analytics' && (
                <div className="space-y-4 animate-fade-in text-left">
                  <div className="bg-surface-container/50 border border-white/5 p-4 rounded-xl space-y-3.5">
                    <div className="flex items-center gap-1.5 text-on-surface font-semibold text-xs uppercase tracking-wider">
                      <PieChart className="w-4 h-4 text-primary animate-pulse" />
                      <span>{t('app.database.analyticsTitle')}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2.5 text-center">
                      <div className="bg-[#121625]/45 p-3 rounded-lg border border-white/5">
                        <p className="text-xl font-bold font-mono text-on-surface">{entries.length}</p>
                        <p className="text-[9px] text-on-surface-variant/80 uppercase mt-0.5">{t('app.database.totalItems')}</p>
                      </div>
                      <div className="bg-[#121625]/45 p-3 rounded-lg border border-white/5">
                        <p className="text-xl font-bold font-mono text-primary">{entries.filter(e => !e.isDeleted).length}</p>
                        <p className="text-[9px] text-on-surface-variant/80 uppercase mt-0.5">{t('app.database.activeItems')}</p>
                      </div>
                    </div>

                    <div className="space-y-2 border-t border-white/5 pt-3">
                      <div className="flex justify-between items-center text-xs text-on-surface-variant">
                        <span>{t('app.database.loginPasswords')}</span>
                        <strong className="text-on-surface font-mono">{t('app.database.records', { count: entries.filter(e => !e.isDeleted && e.type === 'login').length })}</strong>
                      </div>
                      <div className="flex justify-between items-center text-xs text-on-surface-variant">
                        <span>{t('app.database.creditCards')}</span>
                        <strong className="text-on-surface font-mono">{t('app.database.records', { count: entries.filter(e => !e.isDeleted && e.type === 'card').length })}</strong>
                      </div>
                      <div className="flex justify-between items-center text-xs text-on-surface-variant">
                        <span>{t('app.database.secureNotes')}</span>
                        <strong className="text-on-surface font-mono">{t('app.database.records', { count: entries.filter(e => !e.isDeleted && e.type === 'note').length })}</strong>
                      </div>
                      <div className="flex justify-between items-center text-xs text-on-surface-variant border-t border-white/5 pt-2">
                        <span>{t('app.database.trashPending')}</span>
                        <strong className="text-error font-mono">{t('app.database.items', { count: entries.filter(e => e.isDeleted).length })}</strong>
                      </div>
                      <div className="flex justify-between items-center text-xs text-on-surface-variant">
                        <span>{t('app.database.physicalSize')}</span>
                        <strong className="text-tertiary font-mono">{dbSizeInBytes} Byte / 10 MB</strong>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-white/5 bg-[#121625]/40 text-xs text-on-surface-variant space-y-2 leading-relaxed">
                    <span className="font-bold text-on-surface block">{t('app.database.whyNotCloud')}</span>
                    <p>
                      {t('app.database.whyNotCloudText')}
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 4: Factory reset */}
              {activeSubTab === 'wipe' && (
                <div className="space-y-4 animate-fade-in text-left">
                  {!showWipeConfirm ? (
                    <>
                      <div className="bg-error/10 border border-error/20 p-4 rounded-xl space-y-3">
                        <h4 className="text-xs font-bold text-error uppercase tracking-wider">{t('app.database.wipeTitle')}</h4>
                        <p className="text-[11px] text-on-surface-variant leading-relaxed">
                          {t('app.database.wipeDescription')}
                        </p>
                        <p className="text-[11px] text-error font-bold italic">
                          {t('app.database.wipeBackupWarning')}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setShowWipeConfirm(true);
                          setWipeConfirmText("");
                        }}
                        className="w-full py-3.5 bg-error/20 hover:bg-error/30 text-error border border-error/30 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer text-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                        {t('app.database.startWipe')}
                      </button>
                    </>
                  ) : (
                    <div className="bg-error/10 border border-error/30 p-5 rounded-xl space-y-4 animate-scale-up">
                      <div className="flex items-center gap-2 text-error">
                        <AlertTriangle className="w-5 h-5 shrink-0" />
                        <h4 className="text-xs font-bold uppercase tracking-wider">{t('app.database.wipeConfirmTitle')}</h4>
                      </div>
                      
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">
                        {t('app.database.wipeConfirmText', { count: entries.length })}
                      </p>

                      <div className="space-y-1.5">
                        <input
                          type="text"
                          value={wipeConfirmText}
                          onChange={(e) => setWipeConfirmText(e.target.value)}
                          placeholder={t('app.database.wipePlaceholder')}
                          className="w-full bg-surface-container-high border border-error/40 focus:border-error rounded-xl px-4 py-3 text-xs outline-none text-on-surface text-center font-bold tracking-widest placeholder:font-sans placeholder:tracking-normal placeholder:font-normal"
                        />
                      </div>

                      <div className="flex gap-2.5 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setShowWipeConfirm(false);
                            setWipeConfirmText("");
                          }}
                          className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-xs font-bold text-on-surface border border-white/10 rounded-xl transition-colors cursor-pointer"
                        >
                          {t('app.database.cancel')}
                        </button>

                        <button
                          type="button"
                          disabled={wipeConfirmText !== 'SİL' && wipeConfirmText !== 'SIL'}
                          onClick={handleShatterEverything}
                          className="flex-1 py-2.5 bg-error text-white font-bold rounded-xl transition-all cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed text-xs flex items-center justify-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {t('app.database.deleteForever')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Actions Footer */}
            <div className="p-4 border-t border-white/5 flex items-center justify-between bg-surface-container-highest/60 text-[10px] text-on-surface-variant/70">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-tertiary" />
                <span>{t('app.database.footer')}</span>
              </div>
              <span>{t('app.database.version')}</span>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
