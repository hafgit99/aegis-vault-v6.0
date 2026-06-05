import { AlertTriangle, Fingerprint, KeyRound, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SettingsHealthDashboardProps {
  activeCount: number;
  weakCount: number;
  duplicateEntryCount: number;
  staleCount: number;
  sensitiveCategoryCount: number;
  totpMissingCount: number;
  passkeyUpgradeCount: number;
  incompletePasskeyCount: number;
  masterPasswordStrong: boolean;
  masterPasswordLength: number;
  plaintextExportRisk: boolean;
  plaintextExportLastAt: string | null;
  vaultHealthScore: number;
  primaryRisk: string;
  healthScoreClass: string;
  healthBarClass: string;
}

export default function SettingsHealthDashboard({
  activeCount,
  weakCount,
  duplicateEntryCount,
  staleCount,
  sensitiveCategoryCount,
  totpMissingCount,
  passkeyUpgradeCount,
  incompletePasskeyCount,
  masterPasswordStrong,
  masterPasswordLength,
  plaintextExportRisk,
  plaintextExportLastAt,
  vaultHealthScore,
  primaryRisk,
  healthScoreClass,
  healthBarClass,
}: SettingsHealthDashboardProps) {
  const { t } = useTranslation();

  const metrics = [
    { label: t('app.settingsPage.healthDashboard.activeRecords'), value: activeCount, tone: 'text-on-surface' },
    { label: t('app.settingsPage.healthDashboard.weakRecords'), value: weakCount, tone: weakCount > 0 ? 'text-error' : 'text-tertiary' },
    { label: t('app.settingsPage.healthDashboard.reusedRecords'), value: duplicateEntryCount, tone: duplicateEntryCount > 0 ? 'text-primary' : 'text-tertiary' },
    { label: t('app.settingsPage.healthDashboard.oldRecords'), value: staleCount, tone: staleCount > 0 ? 'text-secondary' : 'text-tertiary' },
    { label: t('app.settingsPage.healthDashboard.sensitiveRecords'), value: sensitiveCategoryCount, tone: sensitiveCategoryCount > 0 ? 'text-primary' : 'text-tertiary' },
    { label: t('app.settingsPage.healthDashboard.mfaGaps'), value: totpMissingCount + incompletePasskeyCount, tone: (totpMissingCount + incompletePasskeyCount) > 0 ? 'text-error' : 'text-tertiary' },
  ];
  const plaintextLabel = plaintextExportLastAt || t('app.settingsPage.healthDashboard.noPlaintextExport');

  return (
    <div className="glass-panel p-6 rounded-[1.25rem] space-y-5 border border-primary/10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-item-title text-on-surface font-outfit">{t('app.settingsPage.healthDashboard.title')}</h3>
          <p className="text-xs text-on-surface-variant/70 leading-relaxed mt-1">
            {t('app.settingsPage.healthDashboard.description')}
          </p>
        </div>
        <ShieldAlert className={`w-5 h-5 shrink-0 ${healthScoreClass}`} />
      </div>

      <div className="rounded-2xl border border-white/5 bg-[#121625]/35 p-4 space-y-3">
        <div className="flex items-end justify-between gap-3">
          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
            {t('app.settingsPage.healthDashboard.score')}
          </span>
          <span className={`text-3xl font-geist-mono font-extrabold leading-none ${healthScoreClass}`}>
            {vaultHealthScore}%
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${healthBarClass}`} style={{ width: `${vaultHealthScore}%` }} />
        </div>
        <p className="text-[11px] text-on-surface-variant/75 leading-relaxed">
          {primaryRisk}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
            <span className="block text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/55">{metric.label}</span>
            <span className={`mt-1 block text-xl font-geist-mono font-extrabold ${metric.tone}`}>{metric.value}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2">
        <div className="rounded-xl border border-white/5 bg-[#0e111d]/45 p-3 flex gap-3">
          <KeyRound className={`w-4 h-4 mt-0.5 ${masterPasswordStrong ? 'text-tertiary' : 'text-error'}`} />
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/60 block">
              {t('app.settingsPage.healthDashboard.masterAudit')}
            </span>
            <span className="text-[11px] text-on-surface-variant/80 leading-relaxed">
              {masterPasswordStrong
                ? t('app.settingsPage.healthDashboard.masterStrong', { length: masterPasswordLength })
                : t('app.settingsPage.healthDashboard.masterWeak', { length: masterPasswordLength })}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-white/5 bg-[#0e111d]/45 p-3 flex gap-3">
          <Fingerprint className={`w-4 h-4 mt-0.5 ${totpMissingCount + incompletePasskeyCount > 0 ? 'text-primary' : 'text-tertiary'}`} />
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/60 block">
              {t('app.settingsPage.healthDashboard.mfaCoverage')}
            </span>
            <span className="text-[11px] text-on-surface-variant/80 leading-relaxed">
              {t('app.settingsPage.healthDashboard.mfaCoverageDetail', {
                totp: totpMissingCount,
                passkey: passkeyUpgradeCount,
                incomplete: incompletePasskeyCount,
              })}
            </span>
          </div>
        </div>

        <div className={`rounded-xl border p-3 flex gap-3 ${
          plaintextExportRisk
            ? 'border-error/25 bg-error-container/15'
            : 'border-white/5 bg-[#0e111d]/45'
        }`}>
          <AlertTriangle className={`w-4 h-4 mt-0.5 ${plaintextExportRisk ? 'text-error' : 'text-tertiary'}`} />
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/60 block">
              {t('app.settingsPage.healthDashboard.plaintextExport')}
            </span>
            <span className="text-[11px] text-on-surface-variant/80 leading-relaxed break-words">
              {plaintextExportRisk
                ? t('app.settingsPage.healthDashboard.plaintextExportSeen', { date: plaintextLabel })
                : plaintextLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-white/5 bg-[#0e111d]/45 p-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/60">
          {t('app.settingsPage.healthDashboard.priority')}
        </span>
        <div className="space-y-2 text-[11px] text-on-surface-variant/80">
          <div className="flex items-start gap-2">
            <span className={`mt-1.5 h-1.5 w-1.5 rounded-full ${weakCount > 0 ? 'bg-error' : 'bg-tertiary'}`} />
            <span>{t('app.settingsPage.healthDashboard.weakAction', { count: weakCount })}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className={`mt-1.5 h-1.5 w-1.5 rounded-full ${duplicateEntryCount > 0 ? 'bg-primary' : 'bg-tertiary'}`} />
            <span>{t('app.settingsPage.healthDashboard.reuseAction', { count: duplicateEntryCount })}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className={`mt-1.5 h-1.5 w-1.5 rounded-full ${staleCount > 0 ? 'bg-secondary' : 'bg-tertiary'}`} />
            <span>{t('app.settingsPage.healthDashboard.oldAction', { count: staleCount })}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className={`mt-1.5 h-1.5 w-1.5 rounded-full ${totpMissingCount > 0 ? 'bg-primary' : 'bg-tertiary'}`} />
            <span>{t('app.settingsPage.healthDashboard.mfaAction', { count: totpMissingCount })}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className={`mt-1.5 h-1.5 w-1.5 rounded-full ${plaintextExportRisk ? 'bg-error' : 'bg-tertiary'}`} />
            <span>{t('app.settingsPage.healthDashboard.plaintextAction')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
