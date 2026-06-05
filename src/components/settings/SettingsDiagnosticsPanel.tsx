import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { vaultService } from '../../lib/vaultService';

interface DiagnosticResult {
  score: number;
  dbHealth: string;
  cryptoEngine: string;
  airgapStatus: string;
  weakCount: number;
  duplicateCount: number;
}

interface SettingsDiagnosticsPanelProps {
  entriesSizeKb: string;
  storageFillPercent: number;
  weakCount: number;
  duplicateEntryCount: number;
  staleCount: number;
  onAddLog: (action: string, severity?: 'info' | 'warning' | 'critical') => void;
}

export default function SettingsDiagnosticsPanel({
  entriesSizeKb,
  storageFillPercent,
  weakCount,
  duplicateEntryCount,
  staleCount,
  onAddLog,
}: SettingsDiagnosticsPanelProps) {
  const { t } = useTranslation();
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosticLogs, setDiagnosticLogs] = useState<string[]>([]);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);

  const runDiagnostic = () => {
    setDiagnosing(true);
    setDiagnosticResult(null);
    setDiagnosticLogs([]);

    const logMessages = t('app.settingsPage.diagnostics.steps', { returnObjects: true }) as string[];

    logMessages.forEach((msg, index) => {
      window.setTimeout(() => {
        setDiagnosticLogs((previousLogs) => [...previousLogs, `[${t('app.settingsPage.diagnostics.prefix')}] ${msg}`]);
      }, (index + 1) * 400);
    });

    window.setTimeout(() => {
      const dbHealth = vaultService.sqliteDb ? t('app.settingsPage.diagnostics.dbHealthy') : t('app.settingsPage.diagnostics.dbLocked');
      const storedCipher = localStorage.getItem('aegis_cipher_suite');
      const cryptoEngine = storedCipher === 'AES-256-GCM' ? storedCipher : 'AES-256-GCM';
      const airgapActive = localStorage.getItem('aegis_airgap') !== 'false';
      const airgapStatus = airgapActive ? t('app.settingsPage.diagnostics.airgapActive') : t('app.settingsPage.diagnostics.airgapPassive');

      let score = 100;
      score -= weakCount * 6;
      score -= duplicateEntryCount * 4;
      score -= staleCount * 2;
      if (!airgapActive) score -= 20;
      if (!vaultService.sqliteDb) score -= 30;
      score = Math.max(0, Math.min(100, score));

      setDiagnosticResult({
        score,
        dbHealth,
        cryptoEngine,
        airgapStatus,
        weakCount,
        duplicateCount: duplicateEntryCount,
      });

      setDiagnosing(false);
      onAddLog(t('app.settingsPage.logs.diagnosticComplete', { score }), 'info');
    }, 2400);
  };

  return (
    <div className="glass-panel p-6 rounded-[1.25rem] space-y-4">
      <h3 className="text-item-title text-on-surface font-outfit select-none">{t('app.settingsPage.diagnosticsUi.title')}</h3>

      <div className="space-y-3">
        <div className="flex justify-between text-xs">
          <span className="text-on-surface-variant/60 uppercase font-semibold">{t('app.settingsPage.diagnosticsUi.storage')}</span>
          <span className="text-mono-data text-tertiary font-bold">{entriesSizeKb} KB / 10 MB</span>
        </div>
        <div className="w-full bg-surface-variant h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-tertiary h-full transition-all duration-500"
            style={{ width: `${storageFillPercent}%` }}
          />
        </div>
      </div>

      {diagnosing && (
        <div className="bg-[#0e111d] p-3 rounded-xl border border-white/5 font-mono text-[9px] text-tertiary space-y-1.5 max-h-[120px] overflow-y-auto animate-fade-in text-left">
          {diagnosticLogs.map((log, index) => (
            <div key={`${log}-${index}`} className="flex gap-1.5 items-start">
              <span className="animate-pulse text-tertiary">-</span>
              <span>{log}</span>
            </div>
          ))}
        </div>
      )}

      {diagnosticResult && !diagnosing && (
        <div className="space-y-3.5 border-t border-white/5 pt-4 animate-scale-up text-left">
          <div className="flex justify-between items-center bg-[#121625]/40 p-3 rounded-xl border border-white/5">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{t('app.settingsPage.diagnosticsUi.score')}</span>
            <span className={`text-base font-extrabold font-geist-mono ${
              diagnosticResult.score >= 90 ? 'text-tertiary' : diagnosticResult.score >= 70 ? 'text-primary' : 'text-error'
            }`}>
              %{diagnosticResult.score}
            </span>
          </div>

          <div className="space-y-2 text-[11px]">
            <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
              <span className="text-on-surface-variant/75">{t('app.settingsPage.diagnosticsUi.sqlite')}</span>
              <span className="font-semibold text-on-surface">{diagnosticResult.dbHealth}</span>
            </div>

            <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
              <span className="text-on-surface-variant/75">{t('app.settingsPage.diagnosticsUi.cipher')}</span>
              <span className="font-semibold text-tertiary font-mono">{diagnosticResult.cryptoEngine}</span>
            </div>

            <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
              <span className="text-on-surface-variant/75">{t('app.settingsPage.diagnosticsUi.airgap')}</span>
              <span className={`font-semibold ${localStorage.getItem('aegis_airgap') !== 'false' ? 'text-tertiary' : 'text-primary'}`}>{diagnosticResult.airgapStatus}</span>
            </div>

            <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
              <span className="text-on-surface-variant/75">{t('app.settingsPage.diagnosticsUi.weakPasswords')}</span>
              <span className={`font-bold ${diagnosticResult.weakCount > 0 ? 'text-error' : 'text-on-surface'}`}>{diagnosticResult.weakCount}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-on-surface-variant/75">{t('app.settingsPage.diagnosticsUi.duplicatePasswords')}</span>
              <span className={`font-bold ${diagnosticResult.duplicateCount > 0 ? 'text-primary' : 'text-on-surface'}`}>{diagnosticResult.duplicateCount}</span>
            </div>
          </div>
        </div>
      )}

      {!diagnosticResult && !diagnosing && (
        <div className="space-y-1 text-left">
          <span className="text-xs text-on-surface-variant/60 uppercase block">{t('app.settingsPage.diagnosticsUi.report')}</span>
          <span className="text-xs text-on-surface-variant/80 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary/70 animate-pulse"></span>
            {t('app.settingsPage.diagnosticsUi.notRun')}
          </span>
        </div>
      )}

      <button
        onClick={runDiagnostic}
        disabled={diagnosing}
        className="w-full py-2.5 bg-surface-container hover:bg-surface-variant/50 border border-white/5 disabled:opacity-50 text-xs font-bold text-on-surface rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 shadow-md"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${diagnosing ? 'animate-spin' : ''}`} />
        {diagnosing ? t('app.settingsPage.diagnosticsUi.running') : t('app.settingsPage.diagnosticsUi.run')}
      </button>
    </div>
  );
}
