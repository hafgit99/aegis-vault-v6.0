import { AlertTriangle, CheckCircle2, Fingerprint, KeyRound, ShieldAlert } from 'lucide-react';
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
  const riskQueue = [
    {
      id: 'weak',
      active: weakCount > 0,
      severity: 100,
      count: weakCount,
      label: t('app.settingsPage.healthDashboard.riskLabels.weak'),
      action: t('app.settingsPage.healthDashboard.weakAction', { count: weakCount }),
      tone: 'error',
    },
    {
      id: 'reuse',
      active: duplicateEntryCount > 0,
      severity: 90,
      count: duplicateEntryCount,
      label: t('app.settingsPage.healthDashboard.riskLabels.reuse'),
      action: t('app.settingsPage.healthDashboard.reuseAction', { count: duplicateEntryCount }),
      tone: 'primary',
    },
    {
      id: 'master',
      active: !masterPasswordStrong,
      severity: 85,
      count: masterPasswordStrong ? 0 : 1,
      label: t('app.settingsPage.healthDashboard.riskLabels.master'),
      action: t('app.settingsPage.healthDashboard.actions.auditMaster'),
      tone: 'error',
    },
    {
      id: 'plaintext',
      active: plaintextExportRisk,
      severity: 80,
      count: plaintextExportRisk ? 1 : 0,
      label: t('app.settingsPage.healthDashboard.riskLabels.plaintext'),
      action: t('app.settingsPage.healthDashboard.plaintextAction'),
      tone: 'error',
    },
    {
      id: 'mfa',
      active: totpMissingCount > 0,
      severity: 65,
      count: totpMissingCount,
      label: t('app.settingsPage.healthDashboard.riskLabels.mfa'),
      action: t('app.settingsPage.healthDashboard.mfaAction', { count: totpMissingCount }),
      tone: 'primary',
    },
    {
      id: 'old',
      active: staleCount > 0,
      severity: 45,
      count: staleCount,
      label: t('app.settingsPage.healthDashboard.riskLabels.old'),
      action: t('app.settingsPage.healthDashboard.oldAction', { count: staleCount }),
      tone: 'secondary',
    },
  ].sort((a, b) => Number(b.active) - Number(a.active) || b.severity - a.severity);

  const riskToneClass = (tone: string, active: boolean) => {
    if (!active) return 'border-white/5 bg-[#0e111d]/35 text-on-surface-variant';
    if (tone === 'error') return 'border-error/25 bg-error-container/15 text-error';
    if (tone === 'primary') return 'border-primary/25 bg-primary/10 text-primary';
    return 'border-secondary/25 bg-secondary/10 text-secondary';
  };

  return (
    <div className="glass-panel p-4 md:p-6 rounded-[1.25rem] space-y-5 border border-primary/10">
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

      <div className="space-y-3 rounded-xl border border-white/5 bg-[#0e111d]/45 p-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/60">
          {t('app.settingsPage.healthDashboard.priority')}
        </span>
        <div className="space-y-2">
          {riskQueue.map((risk) => (
            <div key={risk.id} className={`rounded-xl border p-3 flex items-start gap-3 ${riskToneClass(risk.tone, risk.active)}`}>
              {risk.active ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-tertiary" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider">{risk.label}</span>
                  <span className="rounded-full border border-white/10 bg-black/10 px-2 py-0.5 text-[9px] font-geist-mono font-bold">
                    {risk.active ? t('app.settingsPage.healthDashboard.riskOpen', { count: risk.count }) : t('app.settingsPage.healthDashboard.riskClear')}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-on-surface-variant/80">{risk.action}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
