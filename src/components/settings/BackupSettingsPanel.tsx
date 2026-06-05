import { Database, Download, Eye, EyeOff, FileText, Lock, ShieldCheck, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type ExportMethod = 'encrypted' | 'share' | 'plain';
type SecureShareExpiryDays = '1' | '7' | '30' | 'never';

interface BackupSettingsPanelProps {
  exportMethod: ExportMethod;
  exportPassword: string;
  secureShareExpiryDays: SecureShareExpiryDays;
  showExportPassword: boolean;
  isExporting: boolean;
  entriesCount: number;
  onSetExportMethod: (method: ExportMethod) => void;
  onSetExportPassword: (password: string) => void;
  onSetSecureShareExpiryDays: (days: SecureShareExpiryDays) => void;
  onToggleExportPassword: () => void;
  onExportBackup: () => void;
}

export default function BackupSettingsPanel({
  exportMethod,
  exportPassword,
  secureShareExpiryDays,
  showExportPassword,
  isExporting,
  entriesCount,
  onSetExportMethod,
  onSetExportPassword,
  onSetSecureShareExpiryDays,
  onToggleExportPassword,
  onExportBackup,
}: BackupSettingsPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="glass-panel p-6 rounded-[1.25rem] space-y-6">
      <h3 className="text-item-title text-on-surface border-b border-white/5 pb-3">{t('app.settingsPage.encryptedBackup')}</h3>
      <div className="rounded-xl border border-tertiary/15 bg-tertiary/5 p-4 flex gap-3">
        <ShieldCheck className="w-5 h-5 text-tertiary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">{t('app.settingsPage.backupGuide.title')}</h4>
          <p className="text-[11px] leading-relaxed text-on-surface-variant/80">{t('app.settingsPage.backupGuide.description')}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => onSetExportMethod('encrypted')}
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
            onClick={() => onSetExportMethod('share')}
            className={`p-4 rounded-xl border flex flex-col items-start gap-1 transition-all text-left ${
              exportMethod === 'share'
                ? 'bg-primary/10 border-primary/40 text-on-surface'
                : 'border-white/5 hover:bg-white/5 text-on-surface-variant'
            }`}
          >
            <Upload className="w-5 h-5 text-primary mb-1" />
            <span className="text-xs font-bold font-outfit uppercase">{t('app.settingsPage.secureShare.title')}</span>
            <span className="text-[10px] opacity-70">{t('app.settingsPage.secureShare.description')}</span>
          </button>

          <button
            onClick={() => onSetExportMethod('plain')}
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

        {(exportMethod === 'encrypted' || exportMethod === 'share') && (
          <div className="p-4 bg-[#121625]/30 rounded-xl border border-white/5 space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                {exportMethod === 'share' ? t('app.settingsPage.secureShare.password') : t('app.settingsPage.backupPassword')}
              </label>
              <span className="text-[10px] text-on-surface-variant/60">
                {exportMethod === 'share' ? t('app.settingsPage.secureShare.passwordHint') : t('app.settingsPage.backupPasswordHint')}
              </span>
            </div>
            <div className="relative">
              <input
                type={showExportPassword ? 'text' : 'password'}
                value={exportPassword}
                onChange={(event) => onSetExportPassword(event.target.value)}
                placeholder={exportMethod === 'share' ? t('app.settingsPage.secureShare.placeholder') : t('app.settingsPage.backupPasswordPlaceholder')}
                className="w-full bg-surface-container-high/60 border border-white/5 focus:border-tertiary/40 rounded-xl px-4 py-3 text-[14px] outline-none text-on-surface pr-10"
              />
              <button
                type="button"
                onClick={onToggleExportPassword}
                aria-label={showExportPassword ? t('app.lockScreen.hidePassword') : t('app.lockScreen.showPassword')}
                className="absolute right-3 top-3.5 text-on-surface-variant/60 hover:text-on-surface"
              >
                {showExportPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {exportMethod === 'share' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                  {t('app.settingsPage.secureShare.expires')}
                </label>
                <select
                  value={secureShareExpiryDays}
                  onChange={(event) => onSetSecureShareExpiryDays(event.target.value as SecureShareExpiryDays)}
                  className="w-full bg-surface-container-high/60 border border-white/5 focus:border-tertiary/40 rounded-xl px-4 py-3 text-[13px] outline-none text-on-surface"
                >
                  <option value="1">{t('app.settingsPage.secureShare.expireOneDay')}</option>
                  <option value="7">{t('app.settingsPage.secureShare.expireSevenDays')}</option>
                  <option value="30">{t('app.settingsPage.secureShare.expireThirtyDays')}</option>
                  <option value="never">{t('app.settingsPage.secureShare.expireNever')}</option>
                </select>
                <p className="text-[10px] text-on-surface-variant/60">
                  {t('app.settingsPage.secureShare.expiresHint')}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-white/5 pt-4">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-tertiary" />
            <span className="text-xs font-semibold text-on-surface-variant">{t('app.settingsPage.entriesToBackup', { count: entriesCount })}</span>
          </div>
          <button
            onClick={onExportBackup}
            disabled={isExporting}
            className="py-3 px-5 bg-tertiary hover:bg-tertiary-hover text-[#0E121E] bg-tertiary/90 disabled:opacity-50 hover:bg-tertiary rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95"
          >
            <Download className="w-4 h-4" />
            {isExporting ? t('app.settingsPage.calculating') : t('app.settingsPage.generateBackup')}
          </button>
        </div>
      </div>
    </div>
  );
}
