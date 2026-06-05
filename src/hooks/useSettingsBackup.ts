import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { encryptData } from '../lib/backupCrypto';
import { createSecureShareBundle } from '../lib/secureShareBundle';
import { recordPlaintextExportAudit } from '../lib/vaultHealth';
import { VaultEntry } from '../types';
import type { BackupExportMethod, BackupExportPreview, SecureShareExpiryDays } from '../types/backup';

interface UseSettingsBackupOptions {
  entries: VaultEntry[];
  onAddLog: (action: string, severity?: 'info' | 'warning' | 'critical') => void;
}

export function useSettingsBackup({ entries, onAddLog }: UseSettingsBackupOptions) {
  const { t } = useTranslation();
  const [exportMethod, setExportMethod] = useState<BackupExportMethod>('encrypted');
  const [exportPassword, setExportPassword] = useState('');
  const [exportConfirmPassword, setExportConfirmPassword] = useState('');
  const [secureShareExpiryDays, setSecureShareExpiryDays] = useState<SecureShareExpiryDays>('7');
  const [showExportPassword, setShowExportPassword] = useState(false);
  const [plainWarningAccepted, setPlainWarningAccepted] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportSuccessPreview, setExportSuccessPreview] = useState<BackupExportPreview | null>(null);

  const handleExportBackup = () => {
    setExportConfirmPassword('');
    setPlainWarningAccepted(false);
    setExportSuccessPreview(null);
    setShowExportModal(true);
  };

  const handleExportActualBackup = async () => {
    setIsExporting(true);
    try {
      let actualPassword = '';

      if (exportMethod === 'encrypted' || exportMethod === 'share') {
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
      } else if (!plainWarningAccepted) {
        throw new Error(t('app.settingsPage.backupErrors.plainWarningRequired'));
      }

      const rawJson = JSON.stringify(entries.filter((entry) => !entry.isDeleted));
      let backupObject: any = {};

      if (exportMethod === 'share') {
        const expiresAt = secureShareExpiryDays === 'never'
          ? undefined
          : new Date(Date.now() + Number(secureShareExpiryDays) * 24 * 60 * 60 * 1000).toISOString();
        backupObject = await createSecureShareBundle(entries, actualPassword, expiresAt);
      } else if (exportMethod === 'encrypted') {
        const encrypted = await encryptData(rawJson, actualPassword);
        backupObject = {
          app: 'AegisVault',
          encrypted: true,
          version: '1.1.0',
          timestamp: new Date().toISOString(),
          kdf: encrypted.kdf,
          salt: encrypted.salt,
          iv: encrypted.iv,
          data: encrypted.data,
        };
      } else {
        backupObject = {
          app: 'AegisVault',
          encrypted: false,
          version: '1.1.0',
          timestamp: new Date().toISOString(),
          vault: JSON.parse(rawJson),
        };
      }

      const fileData = JSON.stringify(backupObject, null, 2);
      const blob = new Blob([fileData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const prefix = exportMethod === 'share'
        ? 'AegisVault_Secure_Share'
        : exportMethod === 'encrypted'
          ? t('app.database.exportFile.encryptedPrefix')
          : t('app.database.exportFile.plainPrefix');
      const fileName = `${prefix}_${new Date().toISOString().split('T')[0]}.json`;
      link.download = fileName;
      link.click();
      if (exportMethod === 'plain') {
        recordPlaintextExportAudit();
      }

      onAddLog(t('app.settingsPage.logs.backupExported', {
        method: exportMethod === 'share'
          ? t('app.settingsPage.logs.secureShare')
          : exportMethod === 'encrypted'
            ? t('app.settingsPage.logs.encryptedWithPassword')
            : t('app.settingsPage.logs.plainText'),
      }), 'info');

      let sampleText = '';
      if (exportMethod === 'share') {
        sampleText = `{
  "app": "AegisVault",
  "kind": "secure-share-bundle",
  "encrypted": true,
  "itemCount": ${backupObject.itemCount},
  "expiresAt": ${backupObject.expiresAt ? `"${backupObject.expiresAt}"` : 'null'},
  "kdf": "${backupObject.kdf?.algorithm || 'argon2id'}",
  "data": "${backupObject.data.substring(0, 36)}..."
}`;
      } else if (exportMethod === 'encrypted') {
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

      setExportSuccessPreview({ fileName, sampleData: sampleText });
    } catch (err: any) {
      alert(t('app.settingsPage.backupErrors.generic', { message: err.message }));
    } finally {
      setIsExporting(false);
    }
  };

  return {
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
  };
}
