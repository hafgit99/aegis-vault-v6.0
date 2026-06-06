import React, { useEffect, useState } from 'react';
import { 
  ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, ChevronRight, 
  Server, Key, Lock, Fingerprint, RefreshCw, Eye, EyeOff, AlertCircle,
  ChevronDown, ChevronUp, Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { VaultEntry } from '../types';
import { calculateVaultHealth } from '../lib/vaultHealth';
import { scanVaultPasswordsForBreaches, type PwnedVaultEntryResult } from '../lib/hibpPwnedPasswords';
import { writeClipboardSecret } from '../lib/clipboard';
import {
  buildPasswordRotationRecommendation,
  type PasswordRotationRecommendation,
} from '../lib/passwordRotationRecommendations';

interface SecurityAuditProps {
  entries: VaultEntry[];
  onApplyPwnedResults?: (results: PwnedVaultEntryResult[]) => Promise<void>;
  onAddLog?: (action: string, severity?: 'info' | 'warning' | 'critical') => void;
}

export default function SecurityAudit({ entries, onApplyPwnedResults, onAddLog }: SecurityAuditProps) {
  const { t } = useTranslation();
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({ 0: true }); // Start with the first group expanded
  const [isPwnedScanRunning, setIsPwnedScanRunning] = useState(false);
  const [pwnedScanError, setPwnedScanError] = useState<string | null>(null);
  const [lastPwnedScanSummary, setLastPwnedScanSummary] = useState<{ checked: number; breached: number } | null>(null);
  const [rotationRecommendation, setRotationRecommendation] = useState<PasswordRotationRecommendation>(() => (
    buildPasswordRotationRecommendation(entries)
  ));
  const [copiedRecommendation, setCopiedRecommendation] = useState<'random' | 'diceware' | null>(null);

  const vaultHealth = calculateVaultHealth(entries);
  const totalCount = vaultHealth.totalCount;
  const weakEntries = vaultHealth.weakEntries;
  const weakCount = vaultHealth.weakCount;
  const duplicateGroups = vaultHealth.duplicateGroups;
  const totalDuplicates = vaultHealth.duplicateEntryCount;
  const pwnedEntries = vaultHealth.activeEntries
    .filter((entry) => Number(entry.pwned_count || 0) > 0)
    .sort((a, b) => Number(b.pwned_count || 0) - Number(a.pwned_count || 0));
  const pwnedEntryCount = vaultHealth.pwnedEntryCount;
  const pwnedExposureTotal = pwnedEntries.reduce((total, entry) => total + Number(entry.pwned_count || 0), 0);
  const pwnedSeverity = pwnedEntryCount === 0
    ? t('app.audit.pwnedSeverityClean')
    : pwnedExposureTotal >= 1000
      ? t('app.audit.pwnedSeverityCritical')
      : t('app.audit.pwnedSeverityAction');

  useEffect(() => {
    setRotationRecommendation(buildPasswordRotationRecommendation(entries));
    setCopiedRecommendation(null);
  }, [entries]);

  // Accordion helper functions
  const toggleGroupExpanded = (idx: number) => {
    setExpandedGroups(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const expandAll = () => {
    const next: Record<number, boolean> = {};
    duplicateGroups.forEach((_, idx) => {
      next[idx] = true;
    });
    setExpandedGroups(next);
  };

  const collapseAll = () => {
    setExpandedGroups({});
  };

  const areAllExpanded = duplicateGroups.length > 0 && duplicateGroups.every((_, idx) => expandedGroups[idx]);

  const isMasterStrong = vaultHealth.masterPasswordStrong;
  const masterLen = vaultHealth.masterPasswordLength;
  const overallScore = vaultHealth.overallScore;

  const getScoreColor = (s: number) => {
    if (s >= 90) return 'text-tertiary border-tertiary/20 bg-tertiary/5';
    if (s >= 70) return 'text-primary border-primary/20 bg-primary/5';
    return 'text-secondary border-secondary/20 bg-secondary/5';
  };

  const getScoreProgressColor = (s: number) => {
    if (s >= 90) return 'bg-tertiary shadow-[0_0_12px_rgba(181,205,177,0.6)]';
    if (s >= 70) return 'bg-primary shadow-[0_0_12px_rgba(172,201,235,0.6)]';
    return 'bg-secondary shadow-[0_0_12px_rgba(235,172,172,0.6)]';
  };

  const togglePasswordVisibility = (pw: string) => {
    setShowPasswordMap(prev => ({
      ...prev,
      [pw]: !prev[pw]
    }));
  };

  const handlePwnedScan = async () => {
    if (isPwnedScanRunning) return;
    setIsPwnedScanRunning(true);
    setPwnedScanError(null);
    onAddLog?.(t('app.audit.pwnedScanStarted'), 'info');
    try {
      const scan = await scanVaultPasswordsForBreaches(entries);
      await onApplyPwnedResults?.(scan.results);
      setLastPwnedScanSummary({ checked: scan.checkedCount, breached: scan.breachedCount });
      onAddLog?.(t('app.audit.pwnedScanCompletedLog', {
        checked: scan.checkedCount,
        breached: scan.breachedCount,
      }), scan.breachedCount > 0 ? 'critical' : 'info');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPwnedScanError(message);
      onAddLog?.(t('app.audit.pwnedScanFailedLog', { message }), 'warning');
    } finally {
      setIsPwnedScanRunning(false);
    }
  };

  const refreshRotationRecommendation = () => {
    setRotationRecommendation(buildPasswordRotationRecommendation(entries));
    setCopiedRecommendation(null);
  };

  const copyRotationRecommendation = (kind: 'random' | 'diceware') => {
    const value = kind === 'random'
      ? rotationRecommendation.generatedPassword
      : rotationRecommendation.dicewarePassphrase;
    writeClipboardSecret(value);
    setCopiedRecommendation(kind);
    setTimeout(() => setCopiedRecommendation(null), 2000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-8 select-none"
    >
      {/* Title */}
      <div>
        <h2 className="text-display-lg text-on-surface mb-2 font-outfit tracking-tight">{t('app.audit.title')}</h2>
        <p className="text-body-base text-on-surface-variant/80">
          {t('app.audit.description')}
        </p>
      </div>

      {/* Dynamic Bento Box Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: Overall Security Health Score */}
        <div className={`glass-panel p-6 rounded-[1.25rem] border flex flex-col justify-between transition-all duration-300 ${getScoreColor(overallScore)}`}>
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <span className="text-headline-md font-geist-mono font-bold leading-none">{overallScore}%</span>
            </div>
            <h3 className="text-item-title text-on-surface mb-1 font-semibold">{t('app.audit.healthScore')}</h3>
            <p className="text-xs text-on-surface-variant/70 leading-relaxed">{t('app.audit.healthDescription')}</p>
          </div>
          <div className="mt-6 space-y-2">
            <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
              <div className={`h-full transition-all duration-700 ${getScoreProgressColor(overallScore)}`} style={{ width: `${overallScore}%` }}></div>
            </div>
            <span className="text-[10px] text-on-surface-variant/50 uppercase tracking-widest font-bold">{t('app.audit.vaultIntegrity')}</span>
          </div>
        </div>

        {/* Card 2: Reused / Duplicate Passwords */}
        <div className={`glass-panel p-6 rounded-[1.25rem] border flex flex-col justify-between transition-all duration-300 ${
          totalDuplicates > 0 ? 'border-secondary/25 text-secondary bg-secondary/5' : 'border-white/5 text-on-surface'
        }`}>
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <RefreshCw className={`w-6 h-6 ${totalDuplicates > 0 ? 'animate-spin-slow' : ''}`} />
              </div>
              <span className="text-headline-md font-geist-mono font-bold leading-none">{duplicateGroups.length}</span>
            </div>
            <h3 className="text-item-title text-on-surface mb-1 font-semibold">{t('app.audit.reusedPasswords')}</h3>
            <p className="text-xs text-on-surface-variant/70 leading-relaxed">{t('app.audit.reusedDescription')}</p>
          </div>
          <div className="mt-6 flex items-center justify-between">
            <span className="text-[10px] text-on-surface-variant/50 uppercase tracking-widest font-bold">{t('app.audit.chainRisk')}</span>
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
              totalDuplicates > 0 ? 'bg-secondary/15 border border-secondary/25' : 'bg-tertiary/10 text-tertiary border border-tertiary/20'
            }`}>
              {totalDuplicates > 0 ? t('app.audit.riskyItems', { count: totalDuplicates }) : t('app.audit.zeroCollision')}
            </span>
          </div>
        </div>

        {/* Card 3: Weak Credentials Card */}
        <div className={`glass-panel p-6 rounded-[1.25rem] border flex flex-col justify-between transition-all duration-300 ${
          weakCount > 0 ? 'border-secondary/25 text-secondary bg-secondary/5' : 'border-white/5 text-on-surface'
        }`}>
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <span className="text-headline-md font-geist-mono font-bold leading-none">{weakCount}</span>
            </div>
            <h3 className="text-item-title text-on-surface mb-1 font-semibold">{t('app.audit.weakCredentials')}</h3>
            <p className="text-xs text-on-surface-variant/70 leading-relaxed">{t('app.audit.weakDescription')}</p>
          </div>
          <div className="mt-6 flex items-center justify-between">
            <span className="text-[10px] text-on-surface-variant/50 uppercase tracking-widest font-bold">{t('app.audit.bruteForce')}</span>
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
              weakCount > 0 ? 'bg-secondary/15 border border-secondary/25' : 'bg-tertiary/10 text-tertiary border border-tertiary/20'
            }`}>
              {weakCount > 0 ? t('app.audit.hasWeakRecord') : t('app.audit.allSecure')}
            </span>
          </div>
        </div>

      </div>

      {/* Actionable Risk Analysis Grid Report */}
      <div className="space-y-6">
        
        {/* Segment A: Master Password Audit */}
        <div className="glass-panel p-6 rounded-2xl border border-white/5 text-left">
          <div className="flex items-start gap-4 mb-4 border-b border-white/5 pb-4">
            <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-xl text-primary">
              <Lock className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h4 className="font-outfit text-md text-on-surface font-semibold">{t('app.audit.masterTitle')}</h4>
              <p className="text-xs text-on-surface-variant/70 mt-0.5">{t('app.audit.masterDescription')}</p>
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded-xl border ${
              isMasterStrong 
                ? 'bg-tertiary/10 border-tertiary/20 text-tertiary' 
                : 'bg-secondary/10 border-secondary/20 text-secondary'
            }`}>
              {isMasterStrong ? t('app.audit.perfect') : t('app.audit.needsImprovement')}
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 text-xs">
              <span className="text-on-surface-variant leading-relaxed max-w-lg">
                {isMasterStrong ? t('app.audit.masterStrong', { count: masterLen }) : t('app.audit.masterWeak', { count: masterLen })}
              </span>
              <div className="bg-[#121625]/45 px-3 py-2 rounded-xl border border-white/5 shrink-0 flex items-center gap-2">
                <span className="font-bold text-[10px] text-on-surface-variant font-mono">KDF:</span>
                <span className="font-bold text-[10px] text-tertiary font-mono">ARGON2ID</span>
              </div>
            </div>
          </div>
        </div>

        {/* Segment B: Duplicate Passwords Collapsible lists */}
        <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden text-left">
          <div className="p-6 border-b border-white/5 bg-white/[0.01]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4 min-w-0 flex-1">
                <div className="p-2.5 bg-[#ad93eb]/10 border border-[#ad93eb]/20 rounded-xl text-[#ad93eb] shrink-0">
                  <RefreshCw className="w-5 h-5 animate-spin-slow" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-outfit text-md text-on-surface font-semibold">{t('app.audit.duplicateMatches', { count: duplicateGroups.length })}</h4>
                  <p className="text-xs text-on-surface-variant/70 mt-0.5">{t('app.audit.duplicateDescription')}</p>
                </div>
              </div>

              {duplicateGroups.length > 0 && (
                <button
                  onClick={areAllExpanded ? collapseAll : expandAll}
                  className="text-[10px] font-bold text-primary hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg cursor-pointer transition-all uppercase tracking-wider shrink-0 self-center font-geist-mono"
                >
                  {areAllExpanded ? t('app.audit.collapseAll') : t('app.audit.expandAll')}
                </button>
              )}
            </div>
          </div>

          {duplicateGroups.length > 0 ? (
            <div className="max-h-[380px] overflow-y-auto pr-1 vault-scroll divide-y divide-white/5 bg-[#121625]/10">
              {duplicateGroups.map((group, idx) => {
                const samplePassword = group[0].password || '';
                const isVisible = showPasswordMap[samplePassword];
                const isExpanded = expandedGroups[idx];
                
                return (
                  <div key={idx} className="transition-colors">
                    {/* Collapsible Header */}
                    <div 
                      onClick={() => toggleGroupExpanded(idx)}
                      className="flex items-center justify-between p-4 hover:bg-white/[0.02] cursor-pointer transition-colors select-none"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                        <div className="p-2 bg-secondary/15 text-secondary rounded-lg border border-secondary/20 shrink-0">
                          <AlertCircle className="w-4 h-4 shadow-[0_0_8px_rgba(235,172,172,0.3)]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-on-surface truncate block select-all">
                              {isVisible ? samplePassword : '••••••••••••••••'}
                            </span>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePasswordVisibility(samplePassword);
                              }}
                              className="p-1 hover:bg-white/5 rounded transition-all text-on-surface-variant shrink-0 cursor-pointer"
                              title={isVisible ? t('app.audit.hide') : t('app.audit.show')}
                            >
                              {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <span className="text-[9px] text-on-surface-variant/50 font-bold block uppercase tracking-wider mt-0.5 font-geist-mono">
                            {t('app.audit.recordsColliding', { count: group.length })}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="hidden sm:inline-block text-[9px] bg-secondary/10 border border-secondary/20 text-secondary px-2 py-0.5 rounded-full font-bold uppercase tracking-wider font-geist-mono">
                          {t('app.audit.collisionRisk')}
                        </span>
                        <div className="text-on-surface-variant/60 p-0.5">
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-on-surface" /> : <ChevronDown className="w-4 h-4 text-on-surface-variant" />}
                        </div>
                      </div>
                    </div>

                    {/* Collapsible Content */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden bg-[#0d111d]/60 border-t border-white/5"
                        >
                          <div className="p-4 space-y-3">
                            <span className="text-[9px] text-on-surface-variant/40 uppercase font-bold tracking-wider block font-geist-mono">
                              {t('app.audit.riskyDetails')}
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {group.map(entry => (
                                <div key={entry.id} className="p-2.5 bg-surface-container-high/30 border border-white/5 rounded-xl flex items-center gap-2 hover:border-white/10 transition-colors">
                                  <div className="w-1.5 h-1.5 rounded-full bg-secondary shadow-[0_0_6px_rgba(235,172,172,0.6)]"></div>
                                  <div className="min-w-0 flex-1">
                                    <span className="text-xs text-on-surface font-bold truncate block">{entry.title}</span>
                                    <span className="text-[9px] text-on-surface-variant/60 truncate block">{entry.username || entry.url || t('app.audit.recordDetails')}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-on-surface-variant/50 text-xs space-y-2">
              <CheckCircle2 className="w-8 h-8 text-tertiary mx-auto opacity-70" />
              <div>
                <p className="font-bold text-on-surface">{t('app.audit.noDuplicatesTitle')}</p>
                <p className="mt-0.5 text-[11px] text-on-surface-variant/60">{t('app.audit.noDuplicatesDescription')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Segment C: Weak Passwords List */}
        <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden text-left">
          <div className="p-6 border-b border-white/5 bg-white/[0.01]">
            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-[#e0ac5d]/10 border border-[#e0ac5d]/20 rounded-xl text-[#e0ac5d]">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <div className="flex-1">
                <h4 className="font-outfit text-md text-on-surface font-semibold">{t('app.audit.weakListTitle', { count: weakCount })}</h4>
                <p className="text-xs text-on-surface-variant/70 mt-0.5">{t('app.audit.weakListDescription')}</p>
              </div>
            </div>
          </div>

          {weakCount > 0 ? (
            <div className="p-5 max-h-[320px] overflow-y-auto pr-1 vault-scroll">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {weakEntries.map(entry => {
                  const pass = entry.password || '';
                  const isCritical = pass.length < 8;
                  
                  return (
                    <div key={entry.id} className="p-3.5 bg-surface-container-high/35 border border-white/5 rounded-xl flex justify-between items-center group hover:border-white/10 transition-colors">
                      <div className="min-w-0 pr-3 flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${
                          isCritical 
                            ? 'bg-error shadow-[0_0_8px_rgba(255,180,171,0.6)] animate-pulse' 
                            : 'bg-secondary shadow-[0_0_8px_rgba(235,172,172,0.6)]'
                        }`} />
                        <div className="min-w-0">
                          <span className="text-xs text-on-surface font-extrabold truncate block">{entry.title}</span>
                          <span className="text-[10px] text-on-surface-variant/60 truncate block mt-0.5">{entry.username || t('app.audit.noUsername')}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider font-geist-mono border ${
                          isCritical
                            ? 'bg-error/10 border-error/20 text-error'
                            : 'bg-secondary/10 border-secondary/20 text-secondary'
                        }`}>
                          {isCritical ? t('app.audit.criticalRisk') : t('app.audit.weakPassword')}
                        </span>
                        <span className="py-0.5 px-2 bg-white/5 border border-white/10 text-on-surface-variant text-[9px] font-bold rounded-lg uppercase tracking-wider font-geist-mono">
                          {t('app.audit.characterCount', { count: pass.length })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-on-surface-variant/50 text-xs space-y-2">
              <CheckCircle2 className="w-8 h-8 text-tertiary mx-auto opacity-70" />
              <div>
                <p className="font-bold text-on-surface">{t('app.audit.noWeakTitle')}</p>
                <p className="mt-0.5 text-[11px] text-on-surface-variant/60">{t('app.audit.noWeakDescription')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Segment D: Rotation Recommendations */}
        <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden text-left">
          <div className="p-6 border-b border-white/5 bg-white/[0.01]">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-xl text-primary">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-outfit text-md text-on-surface font-semibold">{t('app.audit.rotationTitle')}</h4>
                  <p className="text-xs text-on-surface-variant/70 mt-0.5 max-w-2xl">{t('app.audit.rotationDescription')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={refreshRotationRecommendation}
                className="px-4 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold transition-all flex items-center justify-center gap-2 border border-white/10 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                {t('app.audit.rotationRefresh')}
              </button>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-white/5 bg-[#0e111d]/45 p-3">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/55">{t('app.audit.rotationAffected')}</span>
                <span className={`mt-1 block text-xl font-geist-mono font-extrabold ${rotationRecommendation.affectedCount > 0 ? 'text-secondary' : 'text-tertiary'}`}>
                  {rotationRecommendation.affectedCount}
                </span>
              </div>
              <div className="rounded-xl border border-white/5 bg-[#0e111d]/45 p-3">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/55">{t('app.audit.rotationWeakSignal')}</span>
                <span className={`mt-1 block text-xl font-geist-mono font-extrabold ${rotationRecommendation.weakCount > 0 ? 'text-error' : 'text-tertiary'}`}>
                  {rotationRecommendation.weakCount}
                </span>
              </div>
              <div className="rounded-xl border border-white/5 bg-[#0e111d]/45 p-3">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/55">{t('app.audit.rotationReuseSignal')}</span>
                <span className={`mt-1 block text-xl font-geist-mono font-extrabold ${rotationRecommendation.reusedCount > 0 ? 'text-primary' : 'text-tertiary'}`}>
                  {rotationRecommendation.reusedCount}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/5 bg-surface-container-high/25 p-4 space-y-3">
                <div>
                  <span className="text-[10px] text-on-surface-variant/50 uppercase tracking-widest font-bold">{t('app.audit.rotationRandomLabel')}</span>
                  <div className="mt-1 text-sm font-geist-mono text-on-surface break-all select-all">
                    {rotationRecommendation.generatedPassword}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => copyRotationRecommendation('random')}
                  className="w-full px-3 py-2 rounded-xl bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                  {copiedRecommendation === 'random' ? t('app.audit.rotationCopied') : t('app.audit.rotationCopyRandom')}
                </button>
              </div>

              <div className="rounded-xl border border-white/5 bg-surface-container-high/25 p-4 space-y-3">
                <div>
                  <span className="text-[10px] text-on-surface-variant/50 uppercase tracking-widest font-bold">{t('app.audit.rotationDicewareLabel')}</span>
                  <div className="mt-1 text-sm font-geist-mono text-on-surface break-all select-all">
                    {rotationRecommendation.dicewarePassphrase}
                  </div>
                  <span className="mt-2 block text-[10px] text-tertiary font-bold uppercase tracking-wider">
                    {t('app.audit.rotationDicewareEntropy', { bits: rotationRecommendation.dicewareEntropyBits.toFixed(1) })}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => copyRotationRecommendation('diceware')}
                  className="w-full px-3 py-2 rounded-xl bg-secondary hover:bg-secondary/90 text-on-secondary text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                  {copiedRecommendation === 'diceware' ? t('app.audit.rotationCopied') : t('app.audit.rotationCopyDiceware')}
                </button>
              </div>
            </div>

            {rotationRecommendation.affectedEntries.length > 0 ? (
              <div className="rounded-xl border border-secondary/15 bg-secondary/5 p-4">
                <span className="text-[10px] text-on-surface-variant/50 uppercase tracking-widest font-bold">{t('app.audit.rotationAffectedRecords')}</span>
                <div className="mt-3 flex flex-wrap gap-2">
                  {rotationRecommendation.affectedEntries.slice(0, 8).map((entry) => (
                    <span key={entry.id} className="px-2.5 py-1 rounded-lg bg-[#0e111d]/70 border border-white/5 text-[10px] font-bold text-on-surface">
                      {entry.title}
                    </span>
                  ))}
                  {rotationRecommendation.affectedEntries.length > 8 && (
                    <span className="px-2.5 py-1 rounded-lg bg-[#0e111d]/70 border border-white/5 text-[10px] font-bold text-on-surface-variant">
                      {t('app.audit.rotationMoreRecords', { count: rotationRecommendation.affectedEntries.length - 8 })}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-tertiary/20 bg-tertiary/5 p-4 flex gap-3 text-xs leading-relaxed text-on-surface-variant">
                <CheckCircle2 className="w-5 h-5 text-tertiary shrink-0 mt-0.5" />
                <span>{t('app.audit.rotationNoAction')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Segment E: HIBP k-Anonymity Breach Scan */}
        <div className={`glass-panel rounded-2xl border overflow-hidden text-left ${
          pwnedEntryCount > 0 ? 'border-error/25 bg-error-container/10' : 'border-white/5'
        }`}>
          <div className="p-6 border-b border-white/5 bg-white/[0.01]">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className={`p-2.5 rounded-xl border ${
                  pwnedEntryCount > 0
                    ? 'bg-error/10 border-error/20 text-error'
                    : 'bg-tertiary/10 border-tertiary/20 text-tertiary'
                }`}>
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-outfit text-md text-on-surface font-semibold">{t('app.audit.pwnedTitle')}</h4>
                  <p className="text-xs text-on-surface-variant/70 mt-0.5 max-w-2xl">{t('app.audit.pwnedDescription')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handlePwnedScan}
                disabled={isPwnedScanRunning}
                className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isPwnedScanRunning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    {t('app.audit.pwnedScanning')}
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    {t('app.audit.pwnedScanAction')}
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-white/5 bg-[#0e111d]/45 p-3">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/55">{t('app.audit.pwnedStoredFindings')}</span>
                <span className={`mt-1 block text-xl font-geist-mono font-extrabold ${pwnedEntryCount > 0 ? 'text-error' : 'text-tertiary'}`}>{pwnedEntryCount}</span>
              </div>
              <div className="rounded-xl border border-white/5 bg-[#0e111d]/45 p-3">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/55">{t('app.audit.pwnedLastChecked')}</span>
                <span className="mt-1 block text-xl font-geist-mono font-extrabold text-on-surface">
                  {lastPwnedScanSummary?.checked ?? 0}
                </span>
              </div>
              <div className="rounded-xl border border-white/5 bg-[#0e111d]/45 p-3">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/55">{t('app.audit.pwnedLastBreached')}</span>
                <span className={`mt-1 block text-xl font-geist-mono font-extrabold ${(lastPwnedScanSummary?.breached || 0) > 0 ? 'text-error' : 'text-tertiary'}`}>
                  {lastPwnedScanSummary?.breached ?? 0}
                </span>
              </div>
              <div className="rounded-xl border border-white/5 bg-[#0e111d]/45 p-3 sm:col-span-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/55">{t('app.audit.pwnedReportStatus')}</span>
                    <span className={`mt-1 block text-sm font-bold ${pwnedEntryCount > 0 ? 'text-error' : 'text-tertiary'}`}>{pwnedSeverity}</span>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/55">{t('app.audit.pwnedExposureTotal')}</span>
                    <span className={`mt-1 block text-xl font-geist-mono font-extrabold ${pwnedExposureTotal > 0 ? 'text-error' : 'text-tertiary'}`}>
                      {pwnedExposureTotal}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-primary/15 bg-primary/5 p-4 flex gap-3 text-xs leading-relaxed text-on-surface-variant">
              <Key className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <span>{t('app.audit.pwnedPrivacyNote')}</span>
            </div>

            {pwnedScanError && (
              <div className="rounded-xl border border-error/25 bg-error-container/15 p-3 text-xs text-error">
                {t('app.audit.pwnedScanError', { message: pwnedScanError })}
              </div>
            )}

            {pwnedEntries.length > 0 ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-error/20 bg-error-container/10 p-4 text-xs leading-relaxed text-on-surface-variant">
                  <strong className="text-error">{t('app.audit.pwnedActionTitle')}</strong>{' '}
                  {t('app.audit.pwnedActionDescription', { count: pwnedEntryCount })}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {pwnedEntries.slice(0, 8).map((entry) => (
                  <div key={entry.id} className="p-3.5 bg-error-container/10 border border-error/20 rounded-xl flex justify-between items-center gap-3">
                    <div className="min-w-0">
                      <span className="text-xs text-on-surface font-extrabold truncate block">{entry.title}</span>
                      <span className="text-[10px] text-on-surface-variant/60 truncate block mt-0.5">{entry.username || entry.url || t('app.audit.noUsername')}</span>
                    </div>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider font-geist-mono border bg-error/10 border-error/20 text-error shrink-0">
                      {t('app.audit.pwnedSeenCount', { count: Number(entry.pwned_count || 0) })}
                    </span>
                  </div>
                ))}
                </div>
                {pwnedEntries.length > 8 && (
                  <div className="rounded-xl border border-white/5 bg-[#0e111d]/45 p-3 text-[11px] font-bold text-on-surface-variant">
                    {t('app.audit.pwnedMoreFindings', { count: pwnedEntries.length - 8 })}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-center text-on-surface-variant/50 text-xs space-y-2">
                <CheckCircle2 className="w-8 h-8 text-tertiary mx-auto opacity-70" />
                <div>
                  <p className="font-bold text-on-surface">{t('app.audit.pwnedNoFindingsTitle')}</p>
                  <p className="mt-0.5 text-[11px] text-on-surface-variant/60">{t('app.audit.pwnedNoFindingsDescription')}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Segment F: Sandbox Integrity Check */}
        <div className="glass-panel p-6 rounded-2xl border border-white/5 text-left">
          <div className="flex items-start gap-4 mb-4 border-b border-white/5 pb-4">
            <div className="p-2.5 bg-tertiary/10 border border-tertiary/20 rounded-xl text-tertiary">
              <Server className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h4 className="font-outfit text-md text-on-surface font-semibold">{t('app.audit.sandboxTitle')}</h4>
              <p className="text-xs text-on-surface-variant/70 mt-0.5">{t('app.audit.sandboxDescription')}</p>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-xl border bg-tertiary/10 border-tertiary/20 text-tertiary">
              {t('app.audit.sandboxStatus')}
            </span>
          </div>

          <div className="p-4 bg-tertiary/5 rounded-xl border border-tertiary/20 flex gap-3 text-xs leading-relaxed text-on-surface-variant">
            <ShieldCheck className="w-5 h-5 text-tertiary shrink-0 mt-0.5" />
            <span>
              <strong>{t('app.audit.sandboxVerifiedTitle')}</strong> {t('app.audit.sandboxVerified')}
            </span>
          </div>
        </div>

      </div>
    </motion.div>
  );
}
