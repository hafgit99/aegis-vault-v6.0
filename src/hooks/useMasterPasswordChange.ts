import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { persistMasterPasswordAudit } from '../lib/passwordStrength';
import { validateMasterPasswordPolicy } from '../lib/passwordPolicy';
import { vaultService } from '../lib/vaultService';

interface UseMasterPasswordChangeOptions {
  onAddLog: (action: string, severity?: 'info' | 'warning' | 'critical') => void;
}

export function useMasterPasswordChange({ onAddLog }: UseMasterPasswordChangeOptions) {
  const { t } = useTranslation();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordChangeFeedback, setPasswordChangeFeedback] = useState<{ success: boolean; msg: string } | null>(null);

  const handleChangePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!oldPassword || !newPassword || !confirmNewPassword) return;

    if (!validateMasterPasswordPolicy(newPassword).valid) {
      setPasswordChangeFeedback({ success: false, msg: t('app.settingsPage.passwordChange.policy') });
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
      await persistMasterPasswordAudit(newPassword);
      setPasswordChangeFeedback({ success: true, msg: t('app.settingsPage.passwordChange.success') });
      onAddLog(t('app.settingsPage.logs.passwordChanged'), 'warning');
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

  return {
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
  };
}
