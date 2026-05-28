import React, { useState, useRef } from 'react';
import { 
  ShieldCheck, Lock, Download, Trash2, 
  ToggleLeft, ToggleRight, Radio, RefreshCw, Key, ShieldAlert,
  Upload, Copy, Check, Eye, EyeOff, AlertTriangle, FileSpreadsheet, FileJson, 
  FileText, Sparkles, Database, CheckSquare, Square, Info, Languages
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { VaultEntry } from '../types';
import { encryptData, decryptData } from '../lib/backupCrypto';
import { vaultService } from '../lib/vaultService';
import { supportedLanguages, SupportedLanguage } from '../i18n';
import { 
  convertImportedToVaultEntry, 
  parseImportedCSV, 
  parseBitwardenJSON, 
  parse1PasswordJSON 
} from '../lib/importer';

interface SettingsProps {
  onReset: () => void;
  entries: VaultEntry[];
  onImport: (importedEntries: VaultEntry[], overwrite?: boolean) => void;
  onAddLog: (action: string, severity?: 'info' | 'warning' | 'critical') => void;
}

type ImportSource = 'aegis_encrypted' | 'aegis_plain' | 'bitwarden' | 'onepassword' | 'lastpass' | 'chrome' | 'generic_csv';

export default function Settings({ onReset, entries, onImport, onAddLog }: SettingsProps) {
  const { t, i18n } = useTranslation();
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
  const [autoLock, setAutoLock] = useState(() => {
    return localStorage.getItem('aegis_auto_lock') || '15';
  });

  const handleSetLanguage = (language: SupportedLanguage) => {
    i18n.changeLanguage(language);
  };

  const handleSetAutoLock = (val: string) => {
    setAutoLock(val);
    localStorage.setItem('aegis_auto_lock', val);
    onAddLog(t('app.settingsPage.logs.autoLockUpdated', { value: val === 'never' ? t('app.settingsPage.never') : t('app.settingsPage.minutesShort', { count: Number(val) }) }), 'info');
  };
  const [offlineMode, setOfflineMode] = useState(() => {
    try {
      const stored = localStorage.getItem('aegis_airgap');
      return stored !== null ? stored === 'true' : true;
    } catch (e) {
      return true;
    }
  });

  const handleSetOfflineMode = (val: boolean) => {
    setOfflineMode(val);
    try {
      localStorage.setItem('aegis_airgap', String(val));
      onAddLog(t('app.settingsPage.logs.airgapChanged', { state: val ? t('app.settingsPage.logs.enabled') : t('app.settingsPage.logs.disabled') }), val ? 'warning' : 'info');
      
      if (val) {
        alert(t('app.settingsPage.alerts.airgapEnabled'));
        window.location.reload();
      } else {
        alert(t('app.settingsPage.alerts.airgapDisabled'));
        window.location.reload();
      }
    } catch (e) {}
  };
  const [encryptionType, setEncryptionType] = useState(() => {
    try {
      const stored = localStorage.getItem('aegis_cipher_suite');
      return stored === 'AES-256-GCM' ? stored : 'AES-256-GCM';
    } catch (e) {
      return 'AES-256-GCM';
    }
  });

  const handleSetEncryptionType = async (val: string) => {
    if (val !== 'AES-256-GCM' || val === encryptionType) return;
    
    try {
      if (vaultService.isUnlocked()) {
        const confirmChange = confirm(
          t('app.settingsPage.alerts.encryptionConfirm', { value: val })
        );
        if (!confirmChange) return;

        const activeEntries = await vaultService.getPasswords();

        localStorage.setItem('aegis_cipher_suite', val);
        setEncryptionType(val);

        for (const entry of activeEntries) {
          await vaultService.savePassword(entry);
        }

        onAddLog(t('app.settingsPage.logs.encryptionChanged', { value: val }), 'warning');
        alert(t('app.settingsPage.alerts.encryptionChanged', { value: val }));
      } else {
        localStorage.setItem('aegis_cipher_suite', val);
        setEncryptionType(val);
      }
    } catch (e: any) {
      localStorage.setItem('aegis_cipher_suite', encryptionType);
      alert(t('app.settingsPage.alerts.encryptionError', { message: e.message }));
    }
  };
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosticLogs, setDiagnosticLogs] = useState<string[]>([]);
  const [diagnosticResult, setDiagnosticResult] = useState<{
    score: number;
    dbHealth: string;
    cryptoEngine: string;
    airgapStatus: string;
    weakCount: number;
    duplicateCount: number;
  } | null>(null);

  // Backup Export States
  const [exportMethod, setExportMethod] = useState<'encrypted' | 'plain'>('encrypted');
  const [exportPassword, setExportPassword] = useState('');
  const [exportConfirmPassword, setExportConfirmPassword] = useState('');
  const [showExportPassword, setShowExportPassword] = useState(false);
  const [plainWarningAccepted, setPlainWarningAccepted] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
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
  const [importConflictMode, setImportConflictMode] = useState<'merge' | 'replace'>('merge');
  const [importFeedback, setImportFeedback] = useState<{ success: boolean; msg: string } | null>(null);

  // local wipe confirmation states
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState("");
  const [wipeSuccessMsg, setWipeSuccessMsg] = useState(false);

  // Master Password Change States
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordChangeFeedback, setPasswordChangeFeedback] = useState<{ success: boolean; msg: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmNewPassword) return;

    if (newPassword.length < 8) {
      setPasswordChangeFeedback({ success: false, msg: t('app.settingsPage.passwordChange.tooShort') });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordChangeFeedback({ success: false, msg: t('app.settingsPage.passwordChange.mismatch') });
      return;
    }

    setIsChangingPassword(true);
    setPasswordChangeFeedback(null);

    try {
      await vaultService.changeMasterPassword(oldPassword, newPassword);
      setPasswordChangeFeedback({ success: true, msg: t('app.settingsPage.passwordChange.success') });
      onAddLog(t('app.settingsPage.logs.passwordChanged'), 'warning');
      
      // Reset fields
      setOldPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      console.error(err);
      setPasswordChangeFeedback({ success: false, msg: err.message || t('app.settingsPage.passwordChange.error') });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const runDiagnostic = () => {
    setDiagnosing(true);
    setDiagnosticResult(null);
    setDiagnosticLogs([]);

    const logMessages = t('app.settingsPage.diagnostics.steps', { returnObjects: true }) as string[];

    logMessages.forEach((msg, index) => {
      setTimeout(() => {
        setDiagnosticLogs(prev => [...prev, `[${t('app.settingsPage.diagnostics.prefix')}] ${msg}`]);
      }, (index + 1) * 400);
    });

    setTimeout(() => {
      const dbHealth = vaultService.sqliteDb ? t('app.settingsPage.diagnostics.dbHealthy') : t('app.settingsPage.diagnostics.dbLocked');
      const storedCipher = localStorage.getItem('aegis_cipher_suite');
      const cryptoEngine = storedCipher === 'AES-256-GCM' ? storedCipher : "AES-256-GCM";
      const airgapActive = localStorage.getItem('aegis_airgap') !== 'false';
      const airgapStatus = airgapActive ? t('app.settingsPage.diagnostics.airgapActive') : t('app.settingsPage.diagnostics.airgapPassive');

      const weakCount = entries.filter(e => !e.isDeleted && e.password && (e.password.length < 10 || e.strength === 'GOOD')).length;

      const passwordCounts: Record<string, number> = {};
      entries.forEach(e => {
        if (!e.isDeleted && e.password) {
          passwordCounts[e.password] = (passwordCounts[e.password] || 0) + 1;
        }
      });
      const duplicateCount = Object.values(passwordCounts).filter(c => c > 1).reduce((a, b) => a + b, 0);

      let score = 100;
      score -= weakCount * 6;
      score -= duplicateCount * 4;
      if (!airgapActive) score -= 20;
      if (!vaultService.sqliteDb) score -= 30;
      score = Math.max(0, Math.min(100, score));

      setDiagnosticResult({
        score,
        dbHealth,
        cryptoEngine,
        airgapStatus,
        weakCount,
        duplicateCount
      });

      setDiagnosing(false);
      onAddLog(t('app.settingsPage.logs.diagnosticComplete', { score }), 'info');
    }, 2400);
  };

  // Trigger the customized Backup Export Approval Modal
  const handleExportBackup = () => {
    // Reset states
    setExportConfirmPassword('');
    setPlainWarningAccepted(false);
    setExportSuccessPreview(null);
    
    setShowExportModal(true);
  };

  // Actual Backup Export execution after confirmation and password set
  const handleExportActualBackup = async () => {
    setIsExporting(true);
    try {
      let actualPassword = '';
      
      if (exportMethod === 'encrypted') {
        const pass = exportPassword.trim();
        const confirmPass = exportConfirmPassword.trim();
        
        if (!pass) {
          throw new Error(t('app.settingsPage.backupErrors.passwordRequired'));
        }
        if (pass.length < 4) {
          throw new Error(t('app.settingsPage.backupErrors.passwordTooShort'));
        }
        if (pass !== confirmPass) {
          throw new Error(t('app.settingsPage.backupErrors.passwordMismatch'));
        }
        actualPassword = pass;
      } else {
        // Plaintext mode
        if (!plainWarningAccepted) {
          throw new Error(t('app.settingsPage.backupErrors.plainWarningRequired'));
        }
      }

      const rawJson = JSON.stringify(entries.filter(e => !e.isDeleted));
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

      onAddLog(t('app.settingsPage.logs.backupExported', { method: exportMethod === 'encrypted' ? t('app.settingsPage.logs.encryptedWithPassword') : t('app.settingsPage.logs.plainText') }), 'info');
      
      // Update preview to show the user EXACTLY what they downloaded
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
        const sampleCount = backupObject.vault?.length || 0;
        sampleText = `{
  "app": "AegisVault",
  "encrypted": false,
  "timestamp": "${backupObject.timestamp}",
  "vault": [
     { "title": "...", "username": "...", "password": "..." } // ${t('app.database.exportFile.totalRecordsComment', { count: sampleCount })}
  ]
}`;
      }

      setExportSuccessPreview({
        fileName,
        sampleData: sampleText
      });

    } catch (err: any) {
      alert(t('app.settingsPage.backupErrors.generic', { message: err.message }));
    } finally {
      setIsExporting(false);
    }
  };

  // Clean-up and setup file import
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setParsedEntries([]);
    setSelectedIndices(new Set());
    setImportFeedback(null);
  };

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
    setImportFeedback(null);
  };

  // Run File Parser with Smart Heuristics based on Import Source
  const handleParseFile = async () => {
    if (!importFile) return;
    setIsParsing(true);
    setImportFeedback(null);

    try {
      const text = await importFile.text();
      let rawItems: Partial<VaultEntry>[] = [];

      if (importSource === 'aegis_encrypted') {
        const payload = JSON.parse(text);
        if (!payload.encrypted || !payload.data) {
          throw new Error(t('app.settingsPage.importErrors.encryptedExpected'));
        }
        
        const actualPassword = importPassword.trim();
        if (!actualPassword) {
          throw new Error(t('app.settingsPage.importErrors.importPasswordRequired'));
        }

        const decryptedText = await decryptData(payload.data, payload.salt, payload.iv, actualPassword, payload.kdf);
        rawItems = JSON.parse(decryptedText);

      } else if (importSource === 'aegis_plain') {
        const payload = JSON.parse(text);
        if (payload.encrypted) {
          throw new Error(t('app.settingsPage.importErrors.fileIsEncrypted'));
        }
        rawItems = payload.vault || (Array.isArray(payload) ? payload : []);

      } else if (importSource === 'bitwarden') {
        if (importFile.name.endsWith('.json')) {
          rawItems = parseBitwardenJSON(text, importerLabels);
        } else {
          rawItems = parseImportedCSV(text, importerLabels);
        }
      } else if (importSource === 'onepassword') {
        if (importFile.name.endsWith('.json')) {
          rawItems = parse1PasswordJSON(text, importerLabels);
        } else {
          rawItems = parseImportedCSV(text, importerLabels);
        }
      } else if (importSource === 'lastpass') {
        rawItems = parseImportedCSV(text, importerLabels);
      } else if (importSource === 'chrome') {
        rawItems = parseImportedCSV(text, importerLabels);
      } else if (importSource === 'generic_csv') {
        rawItems = parseImportedCSV(text, importerLabels);
      }

      if (rawItems.length === 0) {
        throw new Error(t('app.settingsPage.importErrors.noCompatibleData'));
      }

      setParsedEntries(rawItems);
      // Auto select all parsed items at start
      setSelectedIndices(new Set(Array.from({ length: rawItems.length }, (_, i) => i)));
      onAddLog(t('app.settingsPage.logs.importParsed', { source: importSource.toUpperCase(), count: rawItems.length }), 'info');
    } catch (err: any) {
      setImportFeedback({
        success: false,
        msg: t('app.settingsPage.importErrors.parse', { message: err.message })
      });
      onAddLog(t('app.settingsPage.logs.importParseError', { message: err.message }), 'warning');
    } finally {
      setIsParsing(false);
    }
  };

  // Convert and Save Selected Entries to Database (Merge or Replace)
  const handleExecuteImport = () => {
    if (selectedIndices.size === 0) {
      alert(t('app.settingsPage.alerts.selectImportRecord'));
      return;
    }

    try {
      const selectedPartials = parsedEntries.filter((_, idx) => selectedIndices.has(idx));
      const convertedEntries = selectedPartials.map(p => convertImportedToVaultEntry(p, importerLabels));

      if (importConflictMode === 'replace') {
        // Truncate previous active vault and insert
        onImport(convertedEntries, true);
        onAddLog(t('app.settingsPage.logs.importReplace', { count: convertedEntries.length }), 'warning');
      } else {
        // Merge mode - append items
        onImport(convertedEntries, false);
        onAddLog(t('app.settingsPage.logs.importMerge', { count: convertedEntries.length }), 'info');
      }

      setImportFeedback({
        success: true,
        msg: t('app.settingsPage.importSuccess', { count: convertedEntries.length })
      });

      // Clear layout
      setParsedEntries([]);
      setImportFile(null);
      setImportPassword('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setImportFeedback({
        success: false,
        msg: t('app.settingsPage.importErrors.app', { message: err.message })
      });
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
  };

  const toggleSelectAll = () => {
    if (selectedIndices.size === parsedEntries.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(Array.from({ length: parsedEntries.length }, (_, i) => i)));
    }
  };

  const getSourceLabel = (src: ImportSource) => {
    switch(src) {
      case 'aegis_encrypted': return t('app.settingsPage.sourceLabels.aegisEncrypted');
      case 'aegis_plain': return t('app.settingsPage.sourceLabels.aegisPlain');
      case 'bitwarden': return 'Bitwarden (.json/.csv)';
      case 'onepassword': return '1Password (.json/.csv)';
      case 'lastpass': return 'LastPass (.csv)';
      case 'chrome': return 'Google Chrome (.csv)';
      case 'generic_csv': return t('app.settingsPage.sourceLabels.genericCsv');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-8 pb-10"
    >
      <div>
        <h2 className="text-display-lg text-on-surface mb-2 font-outfit tracking-tight">{t('app.settings.title')}</h2>
        <p className="text-body-base text-on-surface-variant/80">
          {t('app.settingsPage.description')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Config Panel */}
        <div className="lg:col-span-8 space-y-8">
          <div className="glass-panel p-6 rounded-[1.25rem] space-y-4">
            <div className="flex items-start gap-3 border-b border-white/5 pb-4">
              <div className="p-2.5 bg-primary/10 rounded-xl text-primary border border-primary/15">
                <Languages className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-item-title text-on-surface">{t('app.language.title')}</h3>
                <p className="text-xs text-on-surface-variant/70 leading-relaxed mt-1">
                  {t('app.language.description')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {supportedLanguages.map((language) => (
                <button
                  key={language.code}
                  type="button"
                  onClick={() => handleSetLanguage(language.code)}
                  className={`py-2.5 px-3 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    i18n.language === language.code
                      ? 'bg-secondary-container/40 text-secondary border-secondary/50'
                      : 'border-white/5 hover:border-white/20 text-on-surface-variant hover:text-on-surface bg-transparent'
                  }`}
                >
                  {t(language.labelKey)}
                </button>
              ))}
            </div>
          </div>
          
          {/* Section: Security */}
          <div className="glass-panel p-6 rounded-[1.25rem] space-y-6">
            <h3 className="text-item-title text-on-surface border-b border-white/5 pb-3">{t('app.settings.securityControls')}</h3>
            
            {/* Auto Lock Selector */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-on-surface block">{t('app.settingsPage.autoLock')}</label>
              <p className="text-xs text-on-surface-variant/70 leading-relaxed mb-2">
                {t('app.settingsPage.autoLockDescription')}
              </p>
              <div className="grid grid-cols-4 gap-2">
                {["5", "15", "30", "never"].map((time) => (
                  <button
                    key={time}
                    onClick={() => handleSetAutoLock(time)}
                    className={`py-2 px-3 border rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                      autoLock === time 
                        ? 'bg-secondary-container/40 text-secondary border-secondary/50' 
                        : 'border-white/5 hover:border-white/20 text-on-surface-variant hover:text-on-surface bg-transparent'
                    }`}
                  >
                    {time === 'never' ? t('app.settingsPage.never') : t('app.settingsPage.minutesShort', { count: Number(time) })}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggle Switch Mode */}
            <div className="flex items-center justify-between py-4 border-t border-b border-white/5">
              <div className="pr-4">
                <span className="text-sm font-semibold text-on-surface block">{t('app.settingsPage.airgap')}</span>
                <span className="text-xs text-on-surface-variant/70 leading-relaxed mt-1 block">
                  {t('app.settingsPage.airgapDescription')}
                </span>
              </div>
              <div 
                onClick={() => handleSetOfflineMode(!offlineMode)}
                className="cursor-pointer text-tertiary select-none transition-transform active:scale-95 flex-shrink-0"
              >
                {offlineMode ? <ToggleRight className="w-12 h-12 text-tertiary" /> : <ToggleLeft className="w-12 h-12 text-on-surface-variant/40" />}
              </div>
            </div>

            {/* Encryption Mode Selector */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-on-surface block">{t('app.settingsPage.cipherSuite')}</label>
              <div className="space-y-2">
                {[
                  { id: "AES-256-GCM", title: t('app.settingsPage.cipherOptions.aesTitle'), desc: t('app.settingsPage.cipherOptions.aesDescription') }
                ].map((cipher) => (
                  <div 
                    key={cipher.id}
                    onClick={() => handleSetEncryptionType(cipher.id)}
                    className={`p-4 rounded-xl border cursor-pointer flex gap-3 transition-all ${
                      encryptionType === cipher.id
                        ? 'bg-secondary-container/20 border-secondary/40 text-on-surface'
                        : 'border-white/5 hover:border-white/10 text-on-surface-variant'
                    }`}
                  >
                    <Radio className={`w-5 h-5 flex-shrink-0 mt-0.5 ${encryptionType === cipher.id ? 'text-secondary' : 'opacity-30'}`} />
                    <div>
                      <span className="text-sm font-bold block">{cipher.title}</span>
                      <span className="text-xs opacity-70 mt-0.5 block leading-relaxed">{cipher.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Section: Encrypted Backup Export */}
          <div className="glass-panel p-6 rounded-[1.25rem] space-y-6">
            <h3 className="text-item-title text-on-surface border-b border-white/5 pb-3">{t('app.settingsPage.encryptedBackup')}</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setExportMethod('encrypted')}
                  className={`p-4 rounded-xl border flex flex-col items-start gap-1 transition-all text-left ${
                    exportMethod === 'encrypted'
                      ? 'bg-tertiary/10 border-tertiary/40 text-on-surface'
                      : 'border-white/5 hover:bg-white/5 text-on-surface-variant'
                  }`}
                >
                  <Lock className="w-5 h-5 text-tertiary mb-1" />
                  <span className="text-xs font-bold font-outfit uppercase">{t('app.settingsPage.encryptedRecommended')}</span>
                  <span className="text-[10px] opacity-70">{t('app.settingsPage.encryptedBackupDescription')}</span>
                </button>

                <button
                  onClick={() => setExportMethod('plain')}
                  className={`p-4 rounded-xl border flex flex-col items-start gap-1 transition-all text-left ${
                    exportMethod === 'plain'
                      ? 'bg-error-container/20 border-error/40 text-on-surface'
                      : 'border-white/5 hover:bg-white/5 text-on-surface-variant'
                  }`}
                >
                  <FileText className="w-5 h-5 text-error mb-1" />
                  <span className="text-xs font-bold font-outfit text-error uppercase">{t('app.settingsPage.plainJson')}</span>
                  <span className="text-[10px] opacity-70">{t('app.settingsPage.plainJsonDescription')}</span>
                </button>
              </div>

              {exportMethod === 'encrypted' && (
                <div className="p-4 bg-[#121625]/30 rounded-xl border border-white/5 space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{t('app.settingsPage.backupPassword')}</label>
                    <span className="text-[10px] text-on-surface-variant/60">{t('app.settingsPage.backupPasswordHint')}</span>
                  </div>
                  <div className="relative">
                    <input
                      type={showExportPassword ? 'text' : 'password'}
                      value={exportPassword}
                      onChange={(e) => setExportPassword(e.target.value)}
                      placeholder={t('app.settingsPage.backupPasswordPlaceholder')}
                      className="w-full bg-surface-container-high/60 border border-white/5 focus:border-tertiary/40 rounded-xl px-4 py-3 text-[14px] outline-none text-on-surface pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowExportPassword(!showExportPassword)}
                      className="absolute right-3 top-3.5 text-on-surface-variant/60 hover:text-on-surface"
                    >
                      {showExportPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-white/5 pt-4">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-tertiary" />
                  <span className="text-xs font-semibold text-on-surface-variant">{t('app.settingsPage.entriesToBackup', { count: entries.length })}</span>
                </div>
                <button 
                  onClick={handleExportBackup}
                  disabled={isExporting}
                  className="py-3 px-5 bg-tertiary hover:bg-tertiary-hover text-[#0E121E] bg-tertiary/90 disabled:opacity-50 hover:bg-tertiary rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  {isExporting ? t('app.settingsPage.calculating') : t('app.settingsPage.generateBackup')}
                </button>
              </div>
            </div>
          </div>

          {/* New Section: Cross-Platform Universal Import Wizard */}
          <div className="glass-panel p-6 rounded-[1.25rem] space-y-6 border border-tertiary/15">
            <div className="flex items-center gap-3 border-b border-white/5 pb-3">
              <Sparkles className="text-tertiary w-5 h-5" />
              <h3 className="text-item-title text-on-surface">{t('app.settingsPage.importWizard')}</h3>
            </div>

            <p className="text-xs text-on-surface-variant/80 leading-relaxed">
              {t('app.settingsPage.importWizardDescription')}
            </p>

            <div className="space-y-4">
              
              {/* Step 1: select source */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">{t('app.settingsPage.selectBackupSource')}</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'aegis_encrypted', label: t('app.database.import.sourceLabels.aegisEncrypted'), icon: Lock },
                    { id: 'bitwarden', label: 'Bitwarden', icon: FileSpreadsheet },
                    { id: 'onepassword', label: '1Password', icon: FileSpreadsheet },
                    { id: 'lastpass', label: 'LastPass', icon: FileSpreadsheet },
                    { id: 'chrome', label: t('app.settingsPage.sourceLabels.chrome'), icon: FileSpreadsheet },
                    { id: 'generic_csv', label: t('app.settingsPage.sourceLabels.genericCsvShort'), icon: FileText }
                  ].map((src) => {
                    const IconComp = src.icon;
                    return (
                      <button
                        key={src.id}
                        onClick={() => {
                          setImportSource(src.id as ImportSource);
                          setParsedEntries([]);
                          setImportFile(null);
                        }}
                        className={`p-3 border rounded-xl flex items-center gap-2 text-xs font-semibold text-left transition-all cursor-pointer ${
                          importSource === src.id 
                            ? 'bg-tertiary/10 text-tertiary border-tertiary/40' 
                            : 'border-white/5 hover:bg-white/5 text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        <IconComp className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{src.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Drag drop slot / File picker */}
              <div 
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all hover:bg-white/5 ${
                  importFile ? 'border-tertiary/40 bg-tertiary/5' : 'border-white/10 hover:border-white/20'
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
                  <div className="space-y-2">
                    <FileJson className="w-10 h-10 text-tertiary mx-auto" />
                    <span className="text-sm text-on-surface font-semibold block">{importFile.name}</span>
                    <span className="text-xs text-on-surface-variant/60">Dosya boyutu: {(importFile.size / 1024).toFixed(1)} KB</span>
                    <span className="text-[11px] text-tertiary block font-bold">{t('app.database.import.changeFile')}</span>
                  </div>
                ) : (
                  <div className="space-y-2 text-on-surface-variant/70">
                    <Upload className="w-10 h-10 mx-auto opacity-50" />
                    <span className="text-sm font-semibold block">{t('app.database.import.dropFile')}</span>
                    <span className="text-xs">{t('app.database.import.supported')}</span>
                  </div>
                )}
              </div>

              {/* Require Password if Source is AegisVault Encrypted */}
              {importSource === 'aegis_encrypted' && importFile && (
                <div className="p-4 bg-[#121625]/30 rounded-xl border border-white/5 space-y-2 animate-fade-in">
                  <div className="flex justify-between items-center text-xs">
                    <label className="font-bold text-on-surface-variant uppercase tracking-wider">{t('app.database.import.decryptKey')}</label>
                    <span className="text-on-surface-variant/60">{t('app.settingsPage.importDecryptDefault')}</span>
                  </div>
                  <div className="relative">
                    <input
                      type={showImportPassword ? 'text' : 'password'}
                      value={importPassword}
                      onChange={(e) => setImportPassword(e.target.value)}
                      placeholder={t('app.database.import.decryptPlaceholder')}
                      className="w-full bg-surface-container-high/60 border border-white/5 focus:border-tertiary/40 rounded-xl px-4 py-3 text-[14px] outline-none text-on-surface pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowImportPassword(!showImportPassword)}
                      className="absolute right-3 top-3.5 text-on-surface-variant/60 hover:text-on-surface"
                    >
                      {showImportPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Action buttons (Parse phase) */}
              {importFile && parsedEntries.length === 0 && (
                <div className="flex-shrink-0">
                  <button
                    type="button"
                    onClick={handleParseFile}
                    disabled={isParsing}
                    className="w-full py-3 bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-sm font-bold text-on-surface rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${isParsing ? 'animate-spin' : ''}`} />
                    {isParsing ? t('app.database.import.parsing') : t('app.database.import.parse')}
                  </button>
                </div>
              )}

              {/* Feedback Alert */}
              {importFeedback && (
                <div className={`p-4 rounded-xl flex gap-3 text-xs leading-relaxed border ${
                  importFeedback.success 
                    ? 'bg-tertiary/10 border-tertiary/20 text-on-surface' 
                    : 'bg-error-container/20 border-error/20 text-error'
                }`}>
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <span className="font-bold block mb-0.5">{importFeedback.success ? t('app.settingsPage.importFeedbackSuccess') : t('app.settingsPage.importFeedbackError')}</span>
                    <span>{importFeedback.msg}</span>
                  </div>
                </div>
              )}

              {/* Step 2: Display preview and resolve conflicts */}
              {parsedEntries.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-on-surface-variant uppercase block">{t('app.database.import.documentRecords', { count: parsedEntries.length })}</span>
                      <span className="text-[10px] text-on-surface-variant/60">{t('app.database.import.markToImport')}</span>
                    </div>
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="text-xs font-bold text-tertiary bg-tertiary/10 hover:bg-tertiary/20 border border-tertiary/20 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                    >
                      {selectedIndices.size === parsedEntries.length ? t('app.database.import.deselect') : t('app.database.import.selectAll')}
                    </button>
                  </div>

                  {/* Scrollable checklist */}
                  <div className="max-h-[250px] overflow-y-auto rounded-xl border border-white/5 divide-y divide-white/5 bg-[#121625]/20 font-mono text-[11px] select-none pr-1">
                    {parsedEntries.map((item, index) => {
                      const isSelected = selectedIndices.has(index);
                      return (
                        <div 
                          key={index}
                          onClick={() => toggleSelectIndex(index)}
                          className={`flex items-center justify-between p-3 cursor-pointer hover:bg-white/5 transition-colors ${
                            isSelected ? 'bg-tertiary/5' : ''
                          }`}
                        >
                          <div className="min-w-0 pr-4 flex-1 flex items-center gap-3">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-tertiary flex-shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-on-surface-variant/40 flex-shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <span className="text-on-surface font-bold text-xs truncate block font-sans">{item.title || t('app.database.import.untitled')}</span>
                              <span className="text-on-surface-variant/60 text-[10px] truncate block">
                                {item.type === 'card' 
                                  ? `Kart: ${item.cardNumber ? '••••' + item.cardNumber.slice(-4) : 'Bilinmeyen'}`
                                  : item.username || item.url || 'Veri / Not'}
                              </span>
                            </div>
                          </div>
                          <span className="py-0.5 px-2 bg-white/5 rounded text-[9px] uppercase font-bold text-on-surface-variant tracking-wider shrink-0 font-sans">
                            {item.type || 'login'}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Import strategy controls */}
                  <div className="space-y-3 bg-[#121625]/30 p-4 rounded-xl border border-white/5">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">{t('app.database.import.strategy')}</label>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div 
                        onClick={() => setImportConflictMode('merge')}
                        className={`p-3 rounded-lg border cursor-pointer flex gap-3 transition-all ${
                          importConflictMode === 'merge'
                            ? 'bg-tertiary/5 border-tertiary/30'
                            : 'border-white/5 hover:border-white/10'
                        }`}
                      >
                        <Radio className={`w-4 h-4 mt-0.5 ${importConflictMode === 'merge' ? 'text-tertiary' : 'opacity-30'}`} />
                        <div>
                          <span className="text-xs font-bold text-on-surface block">{t('app.database.import.merge')}</span>
                          <span className="text-[10px] text-on-surface-variant/60 block mt-0.5">{t('app.database.import.mergeDescription')}</span>
                        </div>
                      </div>

                      <div 
                        onClick={() => setImportConflictMode('replace')}
                        className={`p-3 rounded-lg border cursor-pointer flex gap-3 transition-all ${
                          importConflictMode === 'replace'
                            ? 'bg-error-container/10 border-error/20'
                            : 'border-white/5 hover:border-white/10'
                        }`}
                      >
                        <Radio className={`w-4 h-4 mt-0.5 ${importConflictMode === 'replace' ? 'text-error' : 'opacity-30'}`} />
                        <div>
                          <span className="text-xs font-bold text-on-surface block text-error">{t('app.database.import.replace')}</span>
                          <span className="text-[10px] text-on-surface-variant/60 block mt-0.5 text-error-container">{t('app.database.import.replaceDescription')}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Execution button */}
                  <button
                    type="button"
                    onClick={handleExecuteImport}
                    className="w-full py-3 bg-tertiary hover:bg-tertiary-hover text-[#0E121E] font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    {t('app.database.import.execute', { count: selectedIndices.size })}
                  </button>
                </div>
              )}

            </div>
          </div>

          {/* Section: Master Password Change */}
          <div className="glass-panel p-6 rounded-[1.25rem] space-y-6">
            <h3 className="text-item-title text-on-surface border-b border-white/5 pb-3 font-outfit">{t('app.settingsPage.masterPassword.title')}</h3>
            
            <p className="text-xs text-on-surface-variant/80 leading-relaxed">
              {t('app.settingsPage.masterPassword.description')}
            </p>

            <form onSubmit={handleChangePassword} className="space-y-4">
              {/* Old password */}
              <div className="space-y-2 text-left">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">{t('app.settingsPage.masterPassword.current')}</label>
                <div className="relative">
                  <input
                    type={showPasswordChange ? 'text' : 'password'}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder={t('app.settingsPage.masterPassword.currentPlaceholder')}
                    required
                    className="w-full bg-surface-container-high/60 border border-white/5 focus:border-tertiary/40 focus:ring-1 focus:ring-tertiary/50 rounded-xl px-4 py-3 text-xs outline-none text-on-surface pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordChange(!showPasswordChange)}
                    className="absolute right-3 top-3.5 text-on-surface-variant/60 hover:text-on-surface"
                  >
                    {showPasswordChange ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New password & confirm */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 text-left">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">{t('app.settingsPage.masterPassword.new')}</label>
                  <input
                    type={showPasswordChange ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t('app.settingsPage.masterPassword.newPlaceholder')}
                    required
                    className="w-full bg-surface-container-high/60 border border-white/5 focus:border-tertiary/40 focus:ring-1 focus:ring-tertiary/50 rounded-xl px-4 py-3 text-xs outline-none text-on-surface"
                  />
                </div>
                <div className="space-y-2 text-left">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">{t('app.settingsPage.masterPassword.confirm')}</label>
                  <input
                    type={showPasswordChange ? 'text' : 'password'}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder={t('app.settingsPage.masterPassword.confirmPlaceholder')}
                    required
                    className="w-full bg-surface-container-high/60 border border-white/5 focus:border-tertiary/40 focus:ring-1 focus:ring-tertiary/50 rounded-xl px-4 py-3 text-xs outline-none text-on-surface"
                  />
                </div>
              </div>

              {passwordChangeFeedback && (
                <div className={`p-3.5 rounded-xl flex gap-2.5 text-xs border ${
                  passwordChangeFeedback.success 
                    ? 'bg-tertiary/10 border-tertiary/20 text-on-surface' 
                    : 'bg-error-container/20 border-error/20 text-error'
                }`}>
                  <AlertTriangle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                  <span>{passwordChangeFeedback.msg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isChangingPassword || !oldPassword || !newPassword || !confirmNewPassword}
                className="w-full py-3.5 bg-primary hover:bg-primary/95 disabled:opacity-40 disabled:cursor-not-allowed text-[#02050A] font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-primary/10 cursor-pointer text-xs"
              >
                <RefreshCw className={`w-4 h-4 ${isChangingPassword ? 'animate-spin' : ''}`} />
                {isChangingPassword ? t('app.settingsPage.masterPassword.rekeying') : t('app.settingsPage.masterPassword.update')}
              </button>
            </form>
          </div>

          {/* Section: Device Wipe (Unchanged) */}
          <div className="glass-panel p-6 rounded-[1.25rem] space-y-6">
            <h3 className="text-item-title text-on-surface border-b border-white/5 pb-3 font-outfit text-error">{t('app.settingsPage.wipe.title')}</h3>
            
            <div className="border-t border-white/5 pt-2 flex flex-col items-stretch gap-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="text-sm font-semibold text-error block">{t('app.settingsPage.wipe.deleteTitle')}</span>
                  <span className="text-xs text-on-surface-variant/70 leading-relaxed mt-1 block">
                    {t('app.settingsPage.wipe.description')}
                  </span>
                </div>
                {!showWipeConfirm && !wipeSuccessMsg && (
                  <button 
                    onClick={() => {
                      setShowWipeConfirm(true);
                      setWipeConfirmText("");
                    }}
                    className="py-3 px-5 bg-error-container/20 hover:bg-error-container/40 border border-error/20 text-error rounded-xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer max-w-xs self-start md:self-auto"
                  >
                    <Trash2 className="w-4 h-4" />
                    {t('app.settingsPage.wipe.resetSystem')}
                  </button>
                )}
              </div>

              {wipeSuccessMsg && (
                <div className="bg-tertiary/10 border border-tertiary/20 p-4 rounded-xl flex items-start gap-3 text-on-surface animate-fade-in">
                  <ShieldCheck className="w-5 h-5 text-tertiary shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <span className="font-bold text-tertiary block">{t('app.settingsPage.wipe.successTitle')}</span>
                    <p className="text-on-surface-variant">{t('app.settingsPage.wipe.successDescription')}</p>
                    <button
                      onClick={() => setWipeSuccessMsg(false)}
                      className="mt-2 text-[10px] font-bold text-primary hover:underline hover:text-primary-hover"
                    >
                      {t('app.settingsPage.exportModal.close')}
                    </button>
                  </div>
                </div>
              )}

              {showWipeConfirm && (
                <div className="bg-error/10 border border-error/20 p-5 rounded-2xl space-y-4 animate-scale-up text-left">
                  <div className="flex items-center gap-2 text-error">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <h4 className="text-xs font-bold uppercase tracking-wider">{t('app.settingsPage.wipe.confirmTitle')}</h4>
                  </div>
                  
                  <p className="text-xs text-on-surface-variant/90 leading-relaxed">
                    {t('app.settingsPage.wipe.confirmText')} <strong className="text-error font-mono">{t('app.settingsPage.wipe.confirmWord')}</strong>.
                  </p>

                  <div className="space-y-1">
                    <input
                      type="text"
                      value={wipeConfirmText}
                      onChange={(e) => setWipeConfirmText(e.target.value)}
                      placeholder={t('app.settingsPage.wipe.placeholder')}
                      className="w-full max-w-md bg-surface-container-high border border-error/30 focus:border-error rounded-xl px-4 py-2.5 text-xs outline-none text-on-surface text-center font-bold tracking-widest placeholder:font-sans placeholder:tracking-normal placeholder:font-normal"
                    />
                  </div>

                  <div className="flex gap-2.5 pt-1 max-w-md">
                    <button
                      type="button"
                      onClick={() => {
                        setShowWipeConfirm(false);
                        setWipeConfirmText("");
                      }}
                      className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-xs font-bold text-on-surface border border-white/10 rounded-xl transition-colors cursor-pointer"
                    >
                      {t('app.settingsPage.wipe.cancel')}
                    </button>

                    <button
                      type="button"
                      disabled={wipeConfirmText !== 'SIFIRLA'}
                      onClick={() => {
                        onReset();
                        setShowWipeConfirm(false);
                        setWipeConfirmText("");
                        setWipeSuccessMsg(true);
                      }}
                      className="flex-1 py-2 bg-error text-white font-bold rounded-xl transition-all cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed text-xs flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {t('app.settingsPage.wipe.resetVault')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Column: Storage & Health Details */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Storage & Live Security Diagnostics Card */}
          <div className="glass-panel p-6 rounded-[1.25rem] space-y-4">
            <h3 className="text-item-title text-on-surface font-outfit select-none">{t('app.settingsPage.diagnosticsUi.title')}</h3>
            
            {/* Storage indicators */}
            <div className="space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-on-surface-variant/60 uppercase font-semibold">{t('app.settingsPage.diagnosticsUi.storage')}</span>
                <span className="text-mono-data text-tertiary font-bold">{(JSON.stringify(entries).length / 1024).toFixed(1)} KB / 10 MB</span>
              </div>
              <div className="w-full bg-surface-variant h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-tertiary h-full transition-all duration-500" 
                  style={{ width: `${Math.max(2, Math.min(100, (JSON.stringify(entries).length / (10 * 1024)) * 100))}%` }} 
                />
              </div>
            </div>

            {/* Diagnostic Log Runner */}
            {diagnosing && (
              <div className="bg-[#0e111d] p-3 rounded-xl border border-white/5 font-mono text-[9px] text-tertiary space-y-1.5 max-h-[120px] overflow-y-auto animate-fade-in text-left">
                {diagnosticLogs.map((log, i) => (
                  <div key={i} className="flex gap-1.5 items-start">
                    <span className="animate-pulse text-tertiary">❯</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Diagnostic Result */}
            {diagnosticResult && !diagnosing && (
              <div className="space-y-3.5 border-t border-white/5 pt-4 animate-scale-up text-left">
                {/* Score badge */}
                <div className="flex justify-between items-center bg-[#121625]/40 p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{t('app.settingsPage.diagnosticsUi.score')}</span>
                  <span className={`text-base font-extrabold font-geist-mono ${
                    diagnosticResult.score >= 90 ? 'text-tertiary' : diagnosticResult.score >= 70 ? 'text-primary' : 'text-error'
                  }`}>
                    %{diagnosticResult.score}
                  </span>
                </div>

                {/* Status items */}
                <div className="space-y-2 text-[11px]">
                  <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                    <span className="text-on-surface-variant/75">{t('app.settingsPage.diagnosticsUi.sqlite')}</span>
                    <span className="font-semibold text-on-surface">{diagnosticResult.dbHealth}</span>
                  </div>

                  <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                    <span className="text-on-surface-variant/75">{t('app.settingsPage.diagnosticsUi.cipher')}</span>
                    <span className="font-semibold text-tertiary font-mono">{diagnosticResult.cryptoEngine}</span>
                  </div>

                  <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                    <span className="text-on-surface-variant/75">{t('app.settingsPage.diagnosticsUi.airgap')}</span>
                    <span className={`font-semibold ${localStorage.getItem('aegis_airgap') !== 'false' ? 'text-tertiary' : 'text-primary'}`}>{diagnosticResult.airgapStatus}</span>
                  </div>

                  <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                    <span className="text-on-surface-variant/75">{t('app.settingsPage.diagnosticsUi.weakPasswords')}</span>
                    <span className={`font-bold ${diagnosticResult.weakCount > 0 ? 'text-error' : 'text-on-surface'}`}>{diagnosticResult.weakCount}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-on-surface-variant/75">{t('app.settingsPage.diagnosticsUi.duplicatePasswords')}</span>
                    <span className={`font-bold ${diagnosticResult.duplicateCount > 0 ? 'text-primary' : 'text-on-surface'}`}>{diagnosticResult.duplicateCount}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Default Status representation before run */}
            {!diagnosticResult && !diagnosing && (
              <div className="space-y-1 text-left">
                <span className="text-xs text-on-surface-variant/60 uppercase block">{t('app.settingsPage.diagnosticsUi.report')}</span>
                <span className="text-xs text-on-surface-variant/80 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary/70 animate-pulse"></span>
                  {t('app.settingsPage.diagnosticsUi.notRun')}
                </span>
              </div>
            )}

            <button 
              onClick={runDiagnostic}
              disabled={diagnosing}
              className="w-full py-2.5 bg-surface-container hover:bg-surface-variant/50 border border-white/5 disabled:opacity-50 text-xs font-bold text-on-surface rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 shadow-md"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${diagnosing ? 'animate-spin' : ''}`} />
              {diagnosing ? t('app.settingsPage.diagnosticsUi.running') : t('app.settingsPage.diagnosticsUi.run')}
            </button>
          </div>

          <div className="security-gradient p-6 rounded-[1.25rem] border border-primary/10 space-y-3 bg-[#121625]/20">
            <div className="flex gap-2">
              <ShieldAlert className="text-primary w-5 h-5 flex-shrink-0 mt-0.5" />
              <h4 className="text-xs font-bold text-on-surface uppercase tracking-widest">{t('app.settingsPage.protection.title')}</h4>
            </div>
            <p className="text-xs text-on-surface-variant/80 leading-relaxed">
              {t('app.settingsPage.protection.description')}
            </p>
          </div>

          {/* Import Help Info */}
          <div className="p-6 rounded-[1.25rem] border border-white/5 bg-[#121625]/40 space-y-3">
            <div className="flex gap-2">
              <Info className="text-tertiary w-5 h-5 flex-shrink-0 mt-0.5" />
              <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">{t('app.settingsPage.importTips.title')}</h4>
            </div>
            <ul className="text-[11px] text-on-surface-variant/80 space-y-2 leading-relaxed list-disc list-inside">
              <li>{t('app.settingsPage.importTips.bitwarden')}</li>
              <li>{t('app.settingsPage.importTips.offline')}</li>
              <li>{t('app.settingsPage.importTips.rememberPassword')}</li>
            </ul>
          </div>

        </div>

      </div>

      {/* EXPORT CONFIRMATION MODAL & ENCRYPTION PREVIEW */}
      <AnimatePresence>
        {showExportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isExporting) setShowExportModal(false);
              }}
              className="absolute inset-0 bg-neutral-950/85 backdrop-blur-md"
            />
            
            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-surface-container-high border border-white/10 rounded-2xl shadow-well overflow-hidden max-h-[90vh] flex flex-col"
            >
              {/* Header */}
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-surface-container-highest">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${exportMethod === 'encrypted' ? 'bg-tertiary/10 text-tertiary' : 'bg-error-container/20 text-error'}`}>
                    {exportMethod === 'encrypted' ? <Lock className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-md font-bold text-on-surface">
                      {exportMethod === 'encrypted' ? t('app.settingsPage.exportModal.encryptedTitle') : t('app.settingsPage.exportModal.plainTitle')}
                    </h3>
                    <p className="text-[11px] text-on-surface-variant/70">
                      {t('app.settingsPage.exportModal.protocol')}
                    </p>
                  </div>
                </div>
                {!isExporting && (
                  <button 
                    onClick={() => setShowExportModal(false)}
                    className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    {t('app.settingsPage.exportModal.close')}
                  </button>
                )}
              </div>

              {/* Scrollable Content */}
              <div className="p-6 space-y-5 overflow-y-auto flex-1">
                {exportSuccessPreview ? (
                  /* Success Screen WITH REAL EVIDENCE OF ENCRYPTION */
                  <div className="space-y-4 text-center">
                    <div className="w-12 h-12 bg-tertiary/20 text-tertiary rounded-full flex items-center justify-center mx-auto mb-2">
                      <ShieldCheck className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-on-surface">{t('app.settingsPage.exportModal.successTitle')}</h4>
                      <p className="text-xs text-on-surface-variant/80 mt-1 max-w-sm mx-auto">
                        {t('app.settingsPage.exportModal.successDescription')}
                      </p>
                    </div>

                    <div className="text-left space-y-2">
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">{t('app.settingsPage.exportModal.fileName')}</span>
                      <div className="bg-[#0e111d] px-3 py-2 rounded-lg border border-white/5 font-mono text-xs text-tertiary select-all">
                        {exportSuccessPreview.fileName}
                      </div>

                      <div className="flex justify-between items-center pt-2">
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{t('app.settingsPage.exportModal.fileContent')}</span>
                        <span className="text-[9px] py-0.5 px-2 bg-tertiary/10 text-tertiary font-bold rounded uppercase">{t('app.settingsPage.exportModal.sealed')}</span>
                      </div>
                      <div className="bg-[#0e111d] p-3 rounded-lg border border-white/5 font-mono text-[10px] text-on-surface-variant leading-relaxed select-all">
                        <pre className="whitespace-pre-wrap">{exportSuccessPreview.sampleData}</pre>
                      </div>
                      <p className="text-[10px] text-on-surface-variant/60 leading-relaxed text-center italic mt-2">
                        {t('app.settingsPage.exportModal.proofNote')}
                      </p>
                    </div>

                    <button
                      onClick={() => setShowExportModal(false)}
                      className="w-full mt-4 py-3 bg-tertiary hover:bg-tertiary-hover text-[#0E121E] font-bold rounded-xl transition-all cursor-pointer"
                    >
                      {t('app.settingsPage.exportModal.close')}
                    </button>
                  </div>
                ) : exportMethod === 'encrypted' ? (
                  /* Encrypted Setup Form */
                  <div className="space-y-4">
                    <div className="p-4 bg-tertiary/5 rounded-xl border border-tertiary/15 space-y-2">
                      <span className="text-xs font-bold text-tertiary block font-outfit">{t('app.settingsPage.exportModal.howPasswordWorks')}</span>
                      <p className="text-xs text-on-surface-variant/80 leading-relaxed">
                        {t('app.settingsPage.exportModal.passwordExplanation')}
                      </p>
                    </div>

                    <div className="space-y-3 text-left">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">{t('app.settingsPage.exportModal.newBackupPassword')}</label>
                        <div className="relative">
                          <input
                            type={showExportPassword ? 'text' : 'password'}
                            value={exportPassword}
                            onChange={(e) => setExportPassword(e.target.value)}
                            placeholder={t('app.settingsPage.exportModal.newBackupPasswordPlaceholder')}
                            className="w-full bg-surface-container-high/60 border border-white/5 focus:border-tertiary/40 rounded-xl px-4 py-3 text-[13px] outline-none text-on-surface pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowExportPassword(!showExportPassword)}
                            className="absolute right-3 top-3.5 text-on-surface-variant/60 hover:text-on-surface"
                          >
                            {showExportPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">{t('app.settingsPage.exportModal.repeatPassword')}</label>
                        <input
                          type={showExportPassword ? 'text' : 'password'}
                          value={exportConfirmPassword}
                          onChange={(e) => setExportConfirmPassword(e.target.value)}
                          placeholder={t('app.settingsPage.exportModal.repeatPasswordPlaceholder')}
                          className="w-full bg-surface-container-high/60 border border-white/5 focus:border-tertiary/40 rounded-xl px-4 py-3 text-[13px] outline-none text-on-surface"
                        />
                      </div>

                      {exportPassword && exportConfirmPassword && exportPassword !== exportConfirmPassword && (
                        <span className="text-[11px] text-error font-semibold block animate-flash">
                          {t('app.settingsPage.exportModal.passwordMismatch')}
                        </span>
                      )}
                    </div>

                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex gap-2.5 text-xs text-yellow-500/90 leading-relaxed text-left">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>{t('app.settingsPage.exportModal.warningPrefix')}</strong> {t('app.settingsPage.exportModal.warningText')}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={isExporting || !exportPassword || exportPassword !== exportConfirmPassword}
                      onClick={handleExportActualBackup}
                      className="w-full py-3 bg-tertiary text-[#0E121E] hover:bg-tertiary-hover disabled:opacity-40 disabled:cursor-not-allowed font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      {isExporting ? t('app.settingsPage.exportModal.encrypting') : t('app.settingsPage.exportModal.encryptDownload')}
                    </button>
                  </div>
                ) : (
                  /* Plaintext Warning Setup */
                  <div className="space-y-4 text-center">
                    <div className="p-4 bg-error-container/20 border border-error/20 rounded-xl flex gap-3 text-error text-left">
                      <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider block">{t('app.settingsPage.exportModal.plainDangerTitle')}</span>
                        <p className="text-xs leading-relaxed mt-1 opacity-90">
                          {t('app.settingsPage.exportModal.plainDangerDescription')}
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-on-surface-variant leading-relaxed text-left">
                      {t('app.settingsPage.exportModal.plainDangerFollowup')}
                    </p>

                    <div 
                      onClick={() => setPlainWarningAccepted(!plainWarningAccepted)}
                      className={`p-4 rounded-xl border cursor-pointer flex items-start gap-3 transition-all text-left ${
                        plainWarningAccepted ? 'bg-error-container/10 border-error/30' : 'border-white/5 hover:bg-white/5'
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
                        <span className="text-xs font-bold text-on-surface block">{t('app.settingsPage.exportModal.acceptDanger')}</span>
                        <span className="text-[10px] text-on-surface-variant/60 block mt-0.5 leading-relaxed">
                          {t('app.settingsPage.exportModal.acceptDangerDescription')}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isExporting || !plainWarningAccepted}
                      onClick={handleExportActualBackup}
                      className="w-full py-3 bg-error text-white hover:bg-error/90 disabled:opacity-40 disabled:cursor-not-allowed font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      {isExporting ? t('app.settingsPage.exportModal.exportingPlain') : t('app.settingsPage.exportModal.downloadPlain')}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
