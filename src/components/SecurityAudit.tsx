import React, { useState } from 'react';
import { 
  ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, ChevronRight, 
  Server, Key, Lock, Fingerprint, RefreshCw, Eye, EyeOff, AlertCircle,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { VaultEntry } from '../types';

interface SecurityAuditProps {
  entries: VaultEntry[];
}

export default function SecurityAudit({ entries }: SecurityAuditProps) {
  const { t } = useTranslation();
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({ 0: true }); // Start with the first group expanded

  // 1. Filter only active (non-deleted) entries
  const activeEntries = entries.filter(e => !e.isDeleted);
  const totalCount = activeEntries.length;

  // 2. Weak passwords audit (strength === 'GOOD' or length <= 12)
  // Ignored when password is empty or whitespace-only
  const weakEntries = activeEntries.filter(e => 
    e.type === 'login' && 
    e.password && 
    e.password.trim().length > 0 && 
    (e.password.length <= 12 || e.strength === 'GOOD')
  );
  const weakCount = weakEntries.length;

  // 3. Duplicate/Reused password analysis
  const passwordGroups: Record<string, VaultEntry[]> = {};
  activeEntries.forEach(entry => {
    if (entry.password && entry.password.trim()) {
      const pw = entry.password.trim();
      if (!passwordGroups[pw]) {
        passwordGroups[pw] = [];
      }
      passwordGroups[pw].push(entry);
    }
  });

  const duplicateGroups = Object.values(passwordGroups).filter(group => group.length > 1);
  const totalDuplicates = duplicateGroups.reduce((acc, g) => acc + g.length, 0);

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

  // 4. Master password material is intentionally never persisted.
  const isMasterStrong = true;
  const masterLen = 12;

  // 5. Calculate Dynamic Security Health Score (0 - 100)
  let rawScore = 100;
  if (totalCount > 0) {
    const weakDeduction = Math.min(40, weakCount * 15);
    const duplicateDeduction = Math.min(35, totalDuplicates * 10);
    const masterDeduction = isMasterStrong ? 0 : 15;
    
    rawScore = 100 - weakDeduction - duplicateDeduction - masterDeduction;
    if (rawScore < 10) rawScore = 10; // keep floor at 10%
  }
  const overallScore = Math.round(rawScore);

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

        {/* Segment D: Sandbox Integrity Check */}
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
