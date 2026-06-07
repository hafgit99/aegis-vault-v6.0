import { AlertTriangle, ShieldCheck, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface WipeSettingsPanelProps {
  showWipeConfirm: boolean;
  wipeConfirmText: string;
  wipeSuccessMsg: boolean;
  onStartConfirmation: () => void;
  onCancelConfirmation: () => void;
  onAcknowledgeSuccess: () => void;
  onSetWipeConfirmText: (text: string) => void;
  onExecuteWipe: () => void;
}

export default function WipeSettingsPanel({
  showWipeConfirm,
  wipeConfirmText,
  wipeSuccessMsg,
  onStartConfirmation,
  onCancelConfirmation,
  onAcknowledgeSuccess,
  onSetWipeConfirmText,
  onExecuteWipe,
}: WipeSettingsPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="glass-panel p-4 md:p-6 rounded-[1.25rem] space-y-5 md:space-y-6">
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
              onClick={onStartConfirmation}
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
                onClick={onAcknowledgeSuccess}
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
                onChange={(event) => onSetWipeConfirmText(event.target.value)}
                placeholder={t('app.settingsPage.wipe.placeholder')}
                className="w-full max-w-md bg-surface-container-high border border-error/30 focus:border-error rounded-xl px-4 py-2.5 text-xs outline-none text-on-surface text-center font-bold tracking-widest placeholder:font-sans placeholder:tracking-normal placeholder:font-normal"
              />
            </div>

            <div className="flex gap-2.5 pt-1 max-w-md">
              <button
                type="button"
                onClick={onCancelConfirmation}
                className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-xs font-bold text-on-surface border border-white/10 rounded-xl transition-colors cursor-pointer"
              >
                {t('app.settingsPage.wipe.cancel')}
              </button>

              <button
                type="button"
                disabled={wipeConfirmText !== 'SIFIRLA'}
                onClick={onExecuteWipe}
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
  );
}
