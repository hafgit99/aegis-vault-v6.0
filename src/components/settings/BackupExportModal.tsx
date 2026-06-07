import { AlertTriangle, CheckSquare, Download, Eye, EyeOff, Lock, ShieldCheck, Square, Upload } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import type { BackupExportMethod, BackupExportPreview, SecureShareExpiryDays } from '../../types/backup';

interface BackupExportModalProps {
  exportMethod: BackupExportMethod;
  exportPassword: string;
  exportConfirmPassword: string;
  secureShareExpiryDays: SecureShareExpiryDays;
  showExportPassword: boolean;
  plainWarningAccepted: boolean;
  isExporting: boolean;
  showExportModal: boolean;
  exportSuccessPreview: BackupExportPreview | null;
  onClose: () => void;
  onSetExportPassword: (password: string) => void;
  onSetExportConfirmPassword: (password: string) => void;
  onSetSecureShareExpiryDays: (days: SecureShareExpiryDays) => void;
  onToggleExportPassword: () => void;
  onTogglePlainWarningAccepted: () => void;
  onExportActualBackup: () => void;
}

export default function BackupExportModal({
  exportMethod,
  exportPassword,
  exportConfirmPassword,
  secureShareExpiryDays,
  showExportPassword,
  plainWarningAccepted,
  isExporting,
  showExportModal,
  exportSuccessPreview,
  onClose,
  onSetExportPassword,
  onSetExportConfirmPassword,
  onSetSecureShareExpiryDays,
  onToggleExportPassword,
  onTogglePlainWarningAccepted,
  onExportActualBackup,
}: BackupExportModalProps) {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!isExporting) onClose();
            }}
            className="absolute inset-0 bg-neutral-950/85 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-surface-container-high border border-white/10 rounded-2xl shadow-well overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="p-4 md:p-6 border-b border-white/5 flex items-center justify-between bg-surface-container-highest">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${exportMethod === 'plain' ? 'bg-error-container/20 text-error' : exportMethod === 'share' ? 'bg-primary/10 text-primary' : 'bg-tertiary/10 text-tertiary'}`}>
                  {exportMethod === 'plain' ? <AlertTriangle className="w-5 h-5" /> : exportMethod === 'share' ? <Upload className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-md font-bold text-on-surface">
                    {exportMethod === 'share' ? t('app.settingsPage.secureShare.modalTitle') : exportMethod === 'encrypted' ? t('app.settingsPage.exportModal.encryptedTitle') : t('app.settingsPage.exportModal.plainTitle')}
                  </h3>
                  <p className="text-[11px] text-on-surface-variant/70">
                    {t('app.settingsPage.exportModal.protocol')}
                  </p>
                </div>
              </div>
              {!isExporting && (
                <button
                  onClick={onClose}
                  aria-label={t('app.settingsPage.exportModal.close')}
                  className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-white/5 transition-colors"
                >
                  {t('app.settingsPage.exportModal.close')}
                </button>
              )}
            </div>

            <div className="p-4 md:p-6 space-y-5 overflow-y-auto flex-1">
              {exportSuccessPreview ? (
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
                    onClick={onClose}
                    className="w-full mt-4 py-3 bg-tertiary hover:bg-tertiary-hover text-[#0E121E] font-bold rounded-xl transition-all cursor-pointer"
                  >
                    {t('app.settingsPage.exportModal.close')}
                  </button>
                </div>
              ) : exportMethod === 'encrypted' || exportMethod === 'share' ? (
                <div className="space-y-4">
                  <div className="p-4 bg-tertiary/5 rounded-xl border border-tertiary/15 space-y-2">
                    <span className="text-xs font-bold text-tertiary block font-outfit">
                      {exportMethod === 'share' ? t('app.settingsPage.secureShare.howItWorks') : t('app.settingsPage.exportModal.howPasswordWorks')}
                    </span>
                    <p className="text-xs text-on-surface-variant/80 leading-relaxed">
                      {exportMethod === 'share' ? t('app.settingsPage.secureShare.explanation') : t('app.settingsPage.exportModal.passwordExplanation')}
                    </p>
                  </div>

                  <div className="space-y-3 text-left">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">
                        {exportMethod === 'share' ? t('app.settingsPage.secureShare.password') : t('app.settingsPage.exportModal.newBackupPassword')}
                      </label>
                      <div className="relative">
                        <input
                          type={showExportPassword ? 'text' : 'password'}
                          value={exportPassword}
                          onChange={(event) => onSetExportPassword(event.target.value)}
                          placeholder={exportMethod === 'share' ? t('app.settingsPage.secureShare.placeholder') : t('app.settingsPage.exportModal.newBackupPasswordPlaceholder')}
                          className="w-full bg-surface-container-high/60 border border-white/5 focus:border-tertiary/40 rounded-xl px-4 py-3 text-[13px] outline-none text-on-surface pr-10"
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
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">{t('app.settingsPage.exportModal.repeatPassword')}</label>
                      <input
                        type={showExportPassword ? 'text' : 'password'}
                        value={exportConfirmPassword}
                        onChange={(event) => onSetExportConfirmPassword(event.target.value)}
                        placeholder={t('app.settingsPage.exportModal.repeatPasswordPlaceholder')}
                        className="w-full bg-surface-container-high/60 border border-white/5 focus:border-tertiary/40 rounded-xl px-4 py-3 text-[13px] outline-none text-on-surface"
                      />
                    </div>

                    {exportPassword && exportConfirmPassword && exportPassword !== exportConfirmPassword && (
                      <span className="text-[11px] text-error font-semibold block animate-flash">
                        {t('app.settingsPage.exportModal.passwordMismatch')}
                      </span>
                    )}
                    {exportMethod === 'share' && (
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">
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
                      </div>
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
                    onClick={onExportActualBackup}
                    className="w-full py-3 bg-tertiary text-[#0E121E] hover:bg-tertiary-hover disabled:opacity-40 disabled:cursor-not-allowed font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    {isExporting ? t('app.settingsPage.exportModal.encrypting') : exportMethod === 'share' ? t('app.settingsPage.secureShare.download') : t('app.settingsPage.exportModal.encryptDownload')}
                  </button>
                </div>
              ) : (
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
                    onClick={onTogglePlainWarningAccepted}
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
                    onClick={onExportActualBackup}
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
  );
}
