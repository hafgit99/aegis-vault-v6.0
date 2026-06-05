import type { FormEvent } from 'react';
import { AlertTriangle, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface MasterPasswordSettingsPanelProps {
  oldPassword: string;
  newPassword: string;
  confirmNewPassword: string;
  showPasswordChange: boolean;
  isChangingPassword: boolean;
  passwordChangeFeedback: { success: boolean; msg: string } | null;
  onSetOldPassword: (password: string) => void;
  onSetNewPassword: (password: string) => void;
  onSetConfirmNewPassword: (password: string) => void;
  onTogglePasswordVisibility: () => void;
  onSubmit: (event: FormEvent) => void;
}

export default function MasterPasswordSettingsPanel({
  oldPassword,
  newPassword,
  confirmNewPassword,
  showPasswordChange,
  isChangingPassword,
  passwordChangeFeedback,
  onSetOldPassword,
  onSetNewPassword,
  onSetConfirmNewPassword,
  onTogglePasswordVisibility,
  onSubmit,
}: MasterPasswordSettingsPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="glass-panel p-6 rounded-[1.25rem] space-y-6">
      <h3 className="text-item-title text-on-surface border-b border-white/5 pb-3 font-outfit">{t('app.settingsPage.masterPassword.title')}</h3>

      <p className="text-xs text-on-surface-variant/80 leading-relaxed">
        {t('app.settingsPage.masterPassword.description')}
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2 text-left">
          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">{t('app.settingsPage.masterPassword.current')}</label>
          <div className="relative">
            <input
              type={showPasswordChange ? 'text' : 'password'}
              value={oldPassword}
              onChange={(event) => onSetOldPassword(event.target.value)}
              placeholder={t('app.settingsPage.masterPassword.currentPlaceholder')}
              required
              className="w-full bg-surface-container-high/60 border border-white/5 focus:border-tertiary/40 focus:ring-1 focus:ring-tertiary/50 rounded-xl px-4 py-3 text-xs outline-none text-on-surface pr-10"
            />
            <button
              type="button"
              onClick={onTogglePasswordVisibility}
              aria-label={showPasswordChange ? t('app.lockScreen.hidePassword') : t('app.lockScreen.showPassword')}
              className="absolute right-3 top-3.5 text-on-surface-variant/60 hover:text-on-surface"
            >
              {showPasswordChange ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 text-left">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">{t('app.settingsPage.masterPassword.new')}</label>
            <input
              type={showPasswordChange ? 'text' : 'password'}
              value={newPassword}
              onChange={(event) => onSetNewPassword(event.target.value)}
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
              onChange={(event) => onSetConfirmNewPassword(event.target.value)}
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
  );
}
