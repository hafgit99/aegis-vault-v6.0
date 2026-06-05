import { Languages, Radio, ToggleLeft, ToggleRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supportedLanguages, SupportedLanguage } from '../../i18n';

interface SettingsSecurityPanelProps {
  activeLanguage: string;
  autoLock: string;
  offlineMode: boolean;
  encryptionType: string;
  onSetLanguage: (language: SupportedLanguage) => void;
  onSetAutoLock: (value: string) => void;
  onSetOfflineMode: (value: boolean) => void;
  onSetEncryptionType: (value: string) => void;
}

export default function SettingsSecurityPanel({
  activeLanguage,
  autoLock,
  offlineMode,
  encryptionType,
  onSetLanguage,
  onSetAutoLock,
  onSetOfflineMode,
  onSetEncryptionType,
}: SettingsSecurityPanelProps) {
  const { t } = useTranslation();

  return (
    <>
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
              onClick={() => onSetLanguage(language.code)}
              className={`py-2.5 px-3 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeLanguage === language.code
                  ? 'bg-secondary-container/40 text-secondary border-secondary/50'
                  : 'border-white/5 hover:border-white/20 text-on-surface-variant hover:text-on-surface bg-transparent'
              }`}
            >
              {t(language.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel p-6 rounded-[1.25rem] space-y-6">
        <h3 className="text-item-title text-on-surface border-b border-white/5 pb-3">{t('app.settings.securityControls')}</h3>

        <div className="space-y-3">
          <label className="text-sm font-semibold text-on-surface block">{t('app.settingsPage.autoLock')}</label>
          <p className="text-xs text-on-surface-variant/70 leading-relaxed mb-2">
            {t('app.settingsPage.autoLockDescription')}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {['5', '15', '30', 'never'].map((time) => (
              <button
                key={time}
                onClick={() => onSetAutoLock(time)}
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

        <div className="flex items-center justify-between py-4 border-t border-b border-white/5">
          <div className="pr-4">
            <span className="text-sm font-semibold text-on-surface block">{t('app.settingsPage.airgap')}</span>
            <span className="text-xs text-on-surface-variant/70 leading-relaxed mt-1 block">
              {t('app.settingsPage.airgapDescription')}
            </span>
          </div>
          <div
            onClick={() => onSetOfflineMode(!offlineMode)}
            className="cursor-pointer text-tertiary select-none transition-transform active:scale-95 flex-shrink-0"
          >
            {offlineMode ? <ToggleRight className="w-12 h-12 text-tertiary" /> : <ToggleLeft className="w-12 h-12 text-on-surface-variant/40" />}
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-semibold text-on-surface block">{t('app.settingsPage.cipherSuite')}</label>
          <div className="space-y-2">
            {[
              { id: 'AES-256-GCM', title: t('app.settingsPage.cipherOptions.aesTitle'), desc: t('app.settingsPage.cipherOptions.aesDescription') },
            ].map((cipher) => (
              <div
                key={cipher.id}
                onClick={() => onSetEncryptionType(cipher.id)}
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
    </>
  );
}
