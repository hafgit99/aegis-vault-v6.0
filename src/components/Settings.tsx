import React, { useState } from 'react';
import { 
  ShieldAlert,
  Info,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { VaultEntry } from '../types';
import { vaultService } from '../lib/vaultService';
import { SupportedLanguage } from '../i18n';
import { calculateVaultHealth } from '../lib/vaultHealth';
import { useMasterPasswordChange } from '../hooks/useMasterPasswordChange';
import { useSettingsBackup } from '../hooks/useSettingsBackup';
import { useSettingsImport } from '../hooks/useSettingsImport';
import { useWipeReset } from '../hooks/useWipeReset';
import BackupExportModal from './settings/BackupExportModal';
import BackupSettingsPanel from './settings/BackupSettingsPanel';
import ImportSettingsPanel from './settings/ImportSettingsPanel';
import MasterPasswordSettingsPanel from './settings/MasterPasswordSettingsPanel';
import SettingsDiagnosticsPanel from './settings/SettingsDiagnosticsPanel';
import SettingsHealthDashboard from './settings/SettingsHealthDashboard';
import SettingsSecurityPanel from './settings/SettingsSecurityPanel';
import WipeSettingsPanel from './settings/WipeSettingsPanel';

interface SettingsProps {
  onReset: () => void;
  entries: VaultEntry[];
  onImport: (importedEntries: VaultEntry[], overwrite?: boolean) => void;
  onAddLog: (action: string, severity?: 'info' | 'warning' | 'critical') => void;
}

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
    return localStorage.getItem('aegis_auto_lock') || '5';
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
  const {
    exportMethod,
    setExportMethod,
    exportPassword,
    setExportPassword,
    exportConfirmPassword,
    setExportConfirmPassword,
    secureShareExpiryDays,
    setSecureShareExpiryDays,
    showExportPassword,
    setShowExportPassword,
    plainWarningAccepted,
    setPlainWarningAccepted,
    isExporting,
    showExportModal,
    setShowExportModal,
    exportSuccessPreview,
    handleExportBackup,
    handleExportActualBackup,
  } = useSettingsBackup({ entries, onAddLog });

  const {
    fileInputRef,
    importSource,
    setImportSource,
    importPassword,
    setImportPassword,
    showImportPassword,
    setShowImportPassword,
    importFile,
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
  } = useSettingsImport({ importerLabels, onImport, onAddLog });

  const {
    showWipeConfirm,
    wipeConfirmText,
    setWipeConfirmText,
    wipeSuccessMsg,
    startWipeConfirmation,
    cancelWipeConfirmation,
    acknowledgeWipeSuccess,
    executeWipe,
  } = useWipeReset({ onReset });

  const {
    oldPassword,
    setOldPassword,
    newPassword,
    setNewPassword,
    confirmNewPassword,
    setConfirmNewPassword,
    showPasswordChange,
    setShowPasswordChange,
    isChangingPassword,
    passwordChangeFeedback,
    handleChangePassword,
  } = useMasterPasswordChange({ onAddLog });

  const vaultHealth = calculateVaultHealth(entries);
  const { activeEntries, weakEntries, duplicateGroups, staleEntries } = vaultHealth;
  const duplicateEntryCount = vaultHealth.duplicateEntryCount;
  const vaultHealthScore = vaultHealth.overallScore;
  const entriesJsonSize = JSON.stringify(entries).length;
  const entriesSizeKb = (entriesJsonSize / 1024).toFixed(1);
  const storageFillPercent = Math.max(2, Math.min(100, (entriesJsonSize / (10 * 1024)) * 100));
  const primaryRisk = weakEntries.length > 0
    ? t('app.settingsPage.healthDashboard.actions.rotateWeak')
    : duplicateGroups.length > 0
      ? t('app.settingsPage.healthDashboard.actions.removeReuse')
      : staleEntries.length > 0
        ? t('app.settingsPage.healthDashboard.actions.reviewOld')
        : vaultHealth.totpMissingCount > 0
          ? t('app.settingsPage.healthDashboard.actions.addMfa')
          : vaultHealth.plaintextExportRisk
            ? t('app.settingsPage.healthDashboard.actions.rotateAfterPlaintext')
            : !vaultHealth.masterPasswordStrong
              ? t('app.settingsPage.healthDashboard.actions.auditMaster')
              : t('app.settingsPage.healthDashboard.actions.maintain');
  const healthScoreClass = vaultHealthScore >= 90 ? 'text-tertiary' : vaultHealthScore >= 70 ? 'text-primary' : 'text-error';
  const healthBarClass = vaultHealthScore >= 90 ? 'bg-tertiary' : vaultHealthScore >= 70 ? 'bg-primary' : 'bg-error';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5 md:space-y-8 pb-10"
    >
      <div>
        <h2 className="text-display-lg text-on-surface mb-2 font-outfit tracking-tight">{t('app.settings.title')}</h2>
        <p className="text-body-base text-on-surface-variant/80">
          {t('app.settingsPage.description')}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 md:gap-8">
        
        {/* Left Column: Config Panel */}
        <div className="xl:col-span-8 space-y-5 md:space-y-8">
          <SettingsSecurityPanel
            activeLanguage={i18n.language}
            autoLock={autoLock}
            offlineMode={offlineMode}
            encryptionType={encryptionType}
            onSetLanguage={handleSetLanguage}
            onSetAutoLock={handleSetAutoLock}
            onSetOfflineMode={handleSetOfflineMode}
            onSetEncryptionType={handleSetEncryptionType}
          />

          <BackupSettingsPanel
            exportMethod={exportMethod}
            exportPassword={exportPassword}
            secureShareExpiryDays={secureShareExpiryDays}
            showExportPassword={showExportPassword}
            isExporting={isExporting}
            entriesCount={entries.length}
            onSetExportMethod={setExportMethod}
            onSetExportPassword={setExportPassword}
            onSetSecureShareExpiryDays={setSecureShareExpiryDays}
            onToggleExportPassword={() => setShowExportPassword(!showExportPassword)}
            onExportBackup={handleExportBackup}
          />

          <ImportSettingsPanel
            importSource={importSource}
            importPassword={importPassword}
            showImportPassword={showImportPassword}
            importFile={importFile}
            isParsing={isParsing}
            parsedEntries={parsedEntries}
            selectedIndices={selectedIndices}
            importConflictMode={importConflictMode}
            importFeedback={importFeedback}
            importReview={importReview}
            importResult={importResult}
            fileInputRef={fileInputRef}
            onSetImportSource={setImportSource}
            onSetImportPassword={setImportPassword}
            onToggleImportPassword={() => setShowImportPassword(!showImportPassword)}
            onClearParsedEntries={() => setParsedEntries([])}
            onClearImportFile={clearImportWorkspace}
            onFileChange={handleFileChange}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onParseFile={handleParseFile}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelectIndex={toggleSelectIndex}
            onSetImportConflictMode={setImportConflictMode}
            onExecuteImport={handleExecuteImport}
          />

          <MasterPasswordSettingsPanel
            oldPassword={oldPassword}
            newPassword={newPassword}
            confirmNewPassword={confirmNewPassword}
            showPasswordChange={showPasswordChange}
            isChangingPassword={isChangingPassword}
            passwordChangeFeedback={passwordChangeFeedback}
            onSetOldPassword={setOldPassword}
            onSetNewPassword={setNewPassword}
            onSetConfirmNewPassword={setConfirmNewPassword}
            onTogglePasswordVisibility={() => setShowPasswordChange(!showPasswordChange)}
            onSubmit={handleChangePassword}
          />

          <WipeSettingsPanel
            showWipeConfirm={showWipeConfirm}
            wipeConfirmText={wipeConfirmText}
            wipeSuccessMsg={wipeSuccessMsg}
            onStartConfirmation={startWipeConfirmation}
            onCancelConfirmation={cancelWipeConfirmation}
            onAcknowledgeSuccess={acknowledgeWipeSuccess}
            onSetWipeConfirmText={setWipeConfirmText}
            onExecuteWipe={executeWipe}
          />

        </div>
        {/* Right Column: Storage & Health Details */}
        <div className="xl:col-span-4 space-y-5 md:space-y-6">

          <SettingsHealthDashboard
            activeCount={activeEntries.length}
            weakCount={weakEntries.length}
            duplicateEntryCount={duplicateEntryCount}
            staleCount={staleEntries.length}
            sensitiveCategoryCount={vaultHealth.sensitiveCategoryCount}
            totpMissingCount={vaultHealth.totpMissingCount}
            passkeyUpgradeCount={vaultHealth.passkeyUpgradeCount}
            incompletePasskeyCount={vaultHealth.incompletePasskeyCount}
            masterPasswordStrong={vaultHealth.masterPasswordStrong}
            masterPasswordLength={vaultHealth.masterPasswordLength}
            plaintextExportRisk={vaultHealth.plaintextExportRisk}
            plaintextExportLastAt={vaultHealth.plaintextExportLastAt}
            vaultHealthScore={vaultHealthScore}
            primaryRisk={primaryRisk}
            healthScoreClass={healthScoreClass}
            healthBarClass={healthBarClass}
          />
          
          <SettingsDiagnosticsPanel
            entriesSizeKb={entriesSizeKb}
            storageFillPercent={storageFillPercent}
            weakCount={weakEntries.length}
            duplicateEntryCount={duplicateEntryCount}
            staleCount={staleEntries.length}
            onAddLog={onAddLog}
          />

          <div className="security-gradient p-4 md:p-6 rounded-[1.25rem] border border-primary/10 space-y-3 bg-[#121625]/20">
            <div className="flex gap-2">
              <ShieldAlert className="text-primary w-5 h-5 flex-shrink-0 mt-0.5" />
              <h4 className="text-xs font-bold text-on-surface uppercase tracking-widest">{t('app.settingsPage.protection.title')}</h4>
            </div>
            <p className="text-xs text-on-surface-variant/80 leading-relaxed">
              {t('app.settingsPage.protection.description')}
            </p>
          </div>

          {/* Import Help Info */}
          <div className="p-4 md:p-6 rounded-[1.25rem] border border-white/5 bg-[#121625]/40 space-y-3">
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

      <BackupExportModal
        exportMethod={exportMethod}
        exportPassword={exportPassword}
        exportConfirmPassword={exportConfirmPassword}
        secureShareExpiryDays={secureShareExpiryDays}
        showExportPassword={showExportPassword}
        plainWarningAccepted={plainWarningAccepted}
        isExporting={isExporting}
        showExportModal={showExportModal}
        exportSuccessPreview={exportSuccessPreview}
        onClose={() => setShowExportModal(false)}
        onSetExportPassword={setExportPassword}
        onSetExportConfirmPassword={setExportConfirmPassword}
        onSetSecureShareExpiryDays={setSecureShareExpiryDays}
        onToggleExportPassword={() => setShowExportPassword(!showExportPassword)}
        onTogglePlainWarningAccepted={() => setPlainWarningAccepted(!plainWarningAccepted)}
        onExportActualBackup={handleExportActualBackup}
      />
    </motion.div>
  );
}
