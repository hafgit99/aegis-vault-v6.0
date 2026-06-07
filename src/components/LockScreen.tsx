import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  KeyRound, ShieldCheck, ShieldAlert, Copy, Check, Download,
  Eye, EyeOff, Lock, Unlock, ArrowRight, Laptop, Sparkles, RefreshCw,
  Fingerprint, HardDrive, WifiOff, Layers3
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { vaultService } from '../lib/vaultService';
import { clearAllOPFSFiles } from '../lib/SQLiteOPFS';
import { supportedLanguages, SupportedLanguage } from '../i18n';
import { generateRandomString } from '../lib/crypto-types';
import { writeClipboardSecret } from '../lib/clipboard';
import { clearStoredSecretKey, getStoredSecretKey, hasLocalSecretConfiguration, persistSecretKey } from '../lib/secureSecretStore';
import { persistMasterPasswordAudit } from '../lib/passwordStrength';
import { validateMasterPasswordPolicy } from '../lib/passwordPolicy';
import {
  clearAndroidBiometricUnlockBundle,
  getAndroidBiometricUnlockBundle,
  getAndroidSecurityBridgeStatus,
  saveAndroidBiometricUnlockBundle,
} from '../lib/androidSecurityBridge';
import type { BiometricUnlockStatus } from '../lib/biometricUnlock';

interface LockScreenProps {
  onUnlock: () => void;
  onAddLog: (action: string, severity?: 'info' | 'warning' | 'critical') => void;
}

type UnlockGuardState = {
  failedAttempts: number;
  delayUntil: number;
  lockedUntil: number;
};

const UNLOCK_GUARD_STORAGE_KEY = 'aegis_unlock_guard';
const UNLOCK_DELAY_START_ATTEMPT = 5;
const UNLOCK_LOCK_ATTEMPT = 15;
const UNLOCK_LOCK_MS = 5 * 60 * 1000;
const UNLOCK_BACKOFF_MS = [1000, 2000, 4000, 8000, 30000];

const emptyUnlockGuard = (): UnlockGuardState => ({
  failedAttempts: 0,
  delayUntil: 0,
  lockedUntil: 0,
});

const readUnlockGuard = (): UnlockGuardState => {
  try {
    const stored = localStorage.getItem(UNLOCK_GUARD_STORAGE_KEY);
    if (!stored) return emptyUnlockGuard();
    const parsed = JSON.parse(stored) as Partial<UnlockGuardState>;
    return {
      failedAttempts: Number(parsed.failedAttempts || 0),
      delayUntil: Number(parsed.delayUntil || 0),
      lockedUntil: Number(parsed.lockedUntil || 0),
    };
  } catch {
    return emptyUnlockGuard();
  }
};

const writeUnlockGuard = (state: UnlockGuardState) => {
  localStorage.setItem(UNLOCK_GUARD_STORAGE_KEY, JSON.stringify(state));
};

const clearUnlockGuard = () => {
  localStorage.removeItem(UNLOCK_GUARD_STORAGE_KEY);
};

const getUnlockBackoffMs = (failedAttempts: number): number => {
  if (failedAttempts < UNLOCK_DELAY_START_ATTEMPT) return 0;
  const index = Math.min(failedAttempts - UNLOCK_DELAY_START_ATTEMPT, UNLOCK_BACKOFF_MS.length - 1);
  return UNLOCK_BACKOFF_MS[index];
};

export default function LockScreen({ onUnlock, onAddLog }: LockScreenProps) {
  const { t, i18n } = useTranslation();

  const handleSetLanguage = (language: SupportedLanguage) => {
    i18n.changeLanguage(language);
  };

  const securityHighlights = [
    { icon: HardDrive, title: t('app.lockScreen.highlightLocalTitle'), description: t('app.lockScreen.highlightLocalDescription') },
    { icon: WifiOff, title: t('app.lockScreen.highlightOfflineTitle'), description: t('app.lockScreen.highlightOfflineDescription') },
    { icon: Fingerprint, title: t('app.lockScreen.highlightTwoPartTitle'), description: t('app.lockScreen.highlightTwoPartDescription') },
  ];
  const onboardingSteps = [
    t('app.lockScreen.onboardingStepPassword'),
    t('app.lockScreen.onboardingStepSecret'),
    t('app.lockScreen.onboardingStepBackup'),
  ];

  // Configured check
  const [isConfigured, setIsConfigured] = useState(() => {
    try {
      return localStorage.getItem('aegis_vault_configured') === 'true'
        || hasLocalSecretConfiguration();
    } catch (e) {
      return false;
    }
  });

  const [activeTab, setActiveTab] = useState<'login' | 'setup'>(isConfigured ? 'login' : 'setup');

  // Login inputs
  const [loginPassword, setLoginPassword] = useState('');
  const [loginSecretKey, setLoginSecretKey] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isBiometricUnlocking, setIsBiometricUnlocking] = useState(false);
  const [biometricUnlockEnabled, setBiometricUnlockEnabled] = useState(false);
  const [biometricStatus, setBiometricStatus] = useState<BiometricUnlockStatus | null>(null);
  const [unlockGuard, setUnlockGuard] = useState<UnlockGuardState>(() => readUnlockGuard());
  const [guardClock, setGuardClock] = useState(() => Date.now());

  // Setup inputs
  const [setupPassword, setSetupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [generatedSecretKey, setGeneratedSecretKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [setupStep, setSetupStep] = useState(1); // 1: Password, 2: Secret Key generated, 3: Confirmation
  const [showSetupPassword, setShowSetupPassword] = useState(false);

  const refreshBiometricStatus = async () => {
    try {
      const status = await getAndroidSecurityBridgeStatus();
      setBiometricStatus(status.biometric);
      setBiometricUnlockEnabled(status.biometric.isAvailable);
    } catch {
      setBiometricStatus(null);
      setBiometricUnlockEnabled(false);
    }
  };

  useEffect(() => {
    refreshBiometricStatus();
  }, []);

  // Autofill secret key if remember device is enabled.
  useEffect(() => {
    if (isConfigured) {
      let isMounted = true;
      getStoredSecretKey()
        .then((storedSecretKey) => {
          if (isMounted && storedSecretKey) {
            setLoginSecretKey(storedSecretKey);
          }
        })
        .catch(() => {
          if (isMounted) {
            setLoginSecretKey('');
          }
        });

      return () => {
        isMounted = false;
      };
    }
  }, [isConfigured]);

  useEffect(() => {
    if (!isConfigured) {
      getStoredSecretKey()
        .then((storedSecretKey) => {
          if (storedSecretKey) {
            setIsConfigured(true);
            setActiveTab('login');
          }
        })
        .catch(() => undefined);
    }
  }, [isConfigured]);

  useEffect(() => {
    const activeUntil = Math.max(unlockGuard.delayUntil, unlockGuard.lockedUntil);
    if (activeUntil <= Date.now()) return undefined;

    const interval = window.setInterval(() => {
      setGuardClock(Date.now());
    }, 250);
    return () => window.clearInterval(interval);
  }, [unlockGuard.delayUntil, unlockGuard.lockedUntil]);

  // Generate a random 1Password style Secret Key: A3-XXXXXX-XXXXXX-XXXXX-XXXXX
  const generateNewSecretKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segment = (len: number) => generateRandomString(len, chars);
    return `A3-${segment(6)}-${segment(6)}-${segment(5)}-${segment(5)}`;
  };

  const handleStartSetup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateMasterPasswordPolicy(setupPassword).valid) {
      setErrorMsg(t('app.lockScreen.errors.passwordPolicy'));
      return;
    }
    if (setupPassword !== confirmPassword) {
      setErrorMsg(t('app.lockScreen.errors.passwordMismatch'));
      return;
    }
    setErrorMsg(null);
    const key = generateNewSecretKey();
    setGeneratedSecretKey(key);
    setSetupStep(2);
  };

  const handleCopySecretKey = () => {
    writeClipboardSecret(generatedSecretKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadBackup = () => {
    try {
      const date = new Date().toLocaleDateString(i18n.language);
      const doc = `${t('app.lockScreen.emergencyKit.title')}\n` +
        `--------------------------------------------------\n` +
        `${t('app.lockScreen.emergencyKit.createdAt', { date })}\n` +
        `${t('app.lockScreen.emergencyKit.description')}\n` +
        `${t('app.lockScreen.emergencyKit.storeOffline')}\n\n` +
        `${t('app.lockScreen.emergencyKit.secretKey')}\n` +
        `${generatedSecretKey}\n\n` +
        `--------------------------------------------------\n` +
        `${t('app.lockScreen.emergencyKit.neverShare')}`;

      const dataStr = "data:text/plain;charset=utf-8," + encodeURIComponent(doc);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `aegisvault_emergency_kit.txt`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      onAddLog(t('app.lockScreen.logs.emergencyKitDownloaded'), "info");
    } catch (err) {}
  };

  const handleCompleteSetup = async () => {
    setErrorMsg(null);
    setIsUnlocking(true);
    try {
      // 1. Initialize SQLite and derive master key
      await vaultService.initDb(setupPassword, generatedSecretKey, true);

      // 2. Save only configuration state by default. The secret key lives in session memory unless device remembering is enabled.
      localStorage.setItem('aegis_vault_configured', 'true');
      await persistSecretKey(generatedSecretKey, rememberDevice);
      if (rememberDevice && biometricUnlockEnabled && biometricStatus?.isAvailable) {
        await saveAndroidBiometricUnlockBundle(setupPassword, generatedSecretKey);
        await refreshBiometricStatus();
      }
      await persistMasterPasswordAudit(setupPassword);
      onAddLog(t('app.lockScreen.logs.setupCompleted'), "warning");
      setIsConfigured(true);
      onUnlock();
    } catch (e: any) {
      setErrorMsg(e.message || t('app.lockScreen.errors.setupFailed'));
    } finally {
      setIsUnlocking(false);
    }
  };

  // Perform secure unlock simulation
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const now = Date.now();
    const lockedRemainingMs = Math.max(unlockGuard.lockedUntil - now, 0);
    const delayedRemainingMs = Math.max(unlockGuard.delayUntil - now, 0);
    if (lockedRemainingMs > 0) {
      setErrorMsg(t('app.lockScreen.errors.unlockLocked', { minutes: Math.ceil(lockedRemainingMs / 60000) }));
      return;
    }
    if (delayedRemainingMs > 0) {
      setErrorMsg(t('app.lockScreen.errors.unlockDelay', { seconds: Math.ceil(delayedRemainingMs / 1000) }));
      return;
    }

    const isVaultConfigured = localStorage.getItem('aegis_vault_configured') === 'true'
      || hasLocalSecretConfiguration()
      || !!loginSecretKey.trim();
    if (!isVaultConfigured) {
      setErrorMsg(t('app.lockScreen.errors.missingConfig'));
      return;
    }

    const cleanedInput = loginSecretKey.trim().toUpperCase();

    setIsUnlocking(true);
    try {
      // Initialize db & verify master password with Argon2id + HKDF derived key
      await vaultService.initDb(loginPassword, cleanedInput, false);

      localStorage.setItem('aegis_vault_configured', 'true');
      await persistSecretKey(cleanedInput, rememberDevice);
      if (rememberDevice && biometricUnlockEnabled && biometricStatus?.isAvailable) {
        await saveAndroidBiometricUnlockBundle(loginPassword, cleanedInput);
        await refreshBiometricStatus();
      }
      await persistMasterPasswordAudit(loginPassword);

      clearUnlockGuard();
      setUnlockGuard(emptyUnlockGuard());
      onAddLog(t('app.lockScreen.logs.vaultUnlocked'), "info");
      onUnlock();
    } catch (err: any) {
      const message = err.message || t('app.lockScreen.errors.invalidCredentials');
      const failedAttempts = unlockGuard.failedAttempts + 1;
      const lockedUntil = failedAttempts >= UNLOCK_LOCK_ATTEMPT ? Date.now() + UNLOCK_LOCK_MS : 0;
      const delayMs = lockedUntil ? 0 : getUnlockBackoffMs(failedAttempts);
      const delayUntil = delayMs ? Date.now() + delayMs : 0;
      const nextGuard = { failedAttempts, lockedUntil, delayUntil };
      writeUnlockGuard(nextGuard);
      setUnlockGuard(nextGuard);

      if (lockedUntil) {
        setErrorMsg(t('app.lockScreen.errors.unlockLocked', { minutes: 5 }));
        onAddLog(t('app.lockScreen.logs.unlockLocked', { attempts: failedAttempts }), "critical");
      } else if (delayMs) {
        setErrorMsg(t('app.lockScreen.errors.unlockDelay', { seconds: Math.ceil(delayMs / 1000) }));
        onAddLog(t('app.lockScreen.logs.unlockDelayed', { attempts: failedAttempts, seconds: Math.ceil(delayMs / 1000) }), "warning");
      } else {
        setErrorMsg(message);
      }
      onAddLog(t('app.lockScreen.logs.unlockFailed', { message: err.message || t('app.lockScreen.errors.mismatchedCredentials') }), "critical");
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleBiometricUnlock = async () => {
    setErrorMsg(null);
    const now = Date.now();
    const lockedRemainingMs = Math.max(unlockGuard.lockedUntil - now, 0);
    const delayedRemainingMs = Math.max(unlockGuard.delayUntil - now, 0);
    if (lockedRemainingMs > 0) {
      setErrorMsg(t('app.lockScreen.errors.unlockLocked', { minutes: Math.ceil(lockedRemainingMs / 60000) }));
      return;
    }
    if (delayedRemainingMs > 0) {
      setErrorMsg(t('app.lockScreen.errors.unlockDelay', { seconds: Math.ceil(delayedRemainingMs / 1000) }));
      return;
    }

    setIsBiometricUnlocking(true);
    try {
      const bundle = await getAndroidBiometricUnlockBundle(t('app.lockScreen.biometric.reason'));
      const cleanedSecretKey = bundle.secretKey.trim().toUpperCase();

      await vaultService.initDb(bundle.masterPassword, cleanedSecretKey, false);
      localStorage.setItem('aegis_vault_configured', 'true');
      await persistSecretKey(cleanedSecretKey, true);
      await persistMasterPasswordAudit(bundle.masterPassword);

      clearUnlockGuard();
      setUnlockGuard(emptyUnlockGuard());
      onAddLog(t('app.lockScreen.logs.biometricUnlocked'), 'info');
      onUnlock();
    } catch (err: any) {
      setErrorMsg(t('app.lockScreen.errors.biometricUnlockFailed', { message: err.message || String(err) }));
      onAddLog(t('app.lockScreen.logs.biometricUnlockFailed', { message: err.message || String(err) }), 'warning');
      refreshBiometricStatus();
    } finally {
      setIsBiometricUnlocking(false);
    }
  };

  const unlockBlockedMs = Math.max(unlockGuard.lockedUntil - guardClock, unlockGuard.delayUntil - guardClock, 0);
  const isUnlockBlocked = unlockBlockedMs > 0;

  return (
    <div id="vault-lock-screen" className="fixed inset-0 z-[200] bg-[#0a0c10] bg-radial-at-t from-[#111622] via-[#090b0f] to-[#040507] flex flex-col items-center justify-center p-4 pt-16 lg:pt-4 overflow-y-auto">
      {/* Dynamic particles or visual background grid for cosmic theme */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293708_1px,transparent_1px),linear-gradient(to_bottom,#1f293708_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      <div className="absolute right-4 top-4 z-20 flex gap-1 rounded-xl border border-white/10 bg-[#0f121d]/80 p-1 backdrop-blur">
        {supportedLanguages.map((language) => (
          <button
            key={language.code}
            type="button"
            onClick={() => handleSetLanguage(language.code)}
            title={t('app.language.changeTo', { language: t(language.labelKey) })}
            className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
              i18n.language === language.code
                ? 'bg-secondary-container/55 text-secondary border border-secondary/25 shadow-sm shadow-secondary/10'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5'
            }`}
          >
            {language.code === 'zh-CN' ? '中文' : language.code.toUpperCase()}
          </button>
        ))}
      </div>

      <main className="relative z-10 grid w-full max-w-6xl grid-cols-1 lg:grid-cols-[minmax(0,1fr)_460px] gap-8 lg:gap-10 items-center">
        <motion.section
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.05 }}
          className="hidden lg:flex flex-col justify-center min-h-[600px]"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="w-14 h-14 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center shadow-xl shadow-primary/5">
              <Lock className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-outfit text-on-surface font-extrabold tracking-tight">AEGIS<span className="text-primary">VAULT</span></h1>
              <p className="text-xs text-on-surface-variant/70 uppercase tracking-widest font-mono">{t('app.lockScreen.tagline')}</p>
            </div>
          </div>

          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-lg border border-tertiary/15 bg-tertiary/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-tertiary mb-5">
              <ShieldCheck className="w-4 h-4" />
              {t('app.lockScreen.heroEyebrow')}
            </div>
            <h2 className="font-outfit text-[44px] leading-[1.02] font-extrabold text-on-surface tracking-tight max-w-xl">
              {t('app.lockScreen.heroTitle')}
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-on-surface-variant/85">
              {t('app.lockScreen.heroDescription')}
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-3 max-w-2xl">
            {securityHighlights.map((item) => (
              <div key={item.title} className="flex items-start gap-4 rounded-xl border border-white/5 bg-surface-container/35 p-4">
                <div className="w-10 h-10 rounded-xl bg-surface-container-high border border-white/10 flex items-center justify-center shrink-0">
                  <item.icon className="w-5 h-5 text-tertiary" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-on-surface">{item.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-on-surface-variant/75">{item.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-7 max-w-2xl rounded-xl border border-primary/10 bg-[#111827]/55 p-4">
            <div className="flex items-center gap-3 mb-3">
              <Layers3 className="w-5 h-5 text-primary" />
              <p className="text-xs font-bold uppercase tracking-wider text-primary">{t('app.lockScreen.trustPanelTitle')}</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[t('app.lockScreen.trustItemEncryption'), t('app.lockScreen.trustItemStorage'), t('app.lockScreen.trustItemRecovery')].map((item) => (
                <div key={item} className="rounded-lg bg-surface-container-lowest/50 border border-white/5 px-3 py-2">
                  <p className="text-[11px] leading-snug text-on-surface-variant/85">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        <section className="w-full flex flex-col items-center lg:items-stretch">
          <motion.div 
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:hidden flex flex-col items-center mb-6 text-center"
          >
            <div className="w-14 h-14 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center shadow-xl shadow-primary/5 mb-3">
              <Lock className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-2xl font-outfit text-on-surface font-extrabold tracking-tight">AEGIS<span className="text-primary">VAULT</span></h1>
            <p className="text-xs text-on-surface-variant/70 mt-1 uppercase tracking-widest font-mono">{t('app.lockScreen.heroEyebrow')}</p>
          </motion.div>

      {/* Main card box info */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="relative w-full max-w-[460px] bg-[#0f121d]/90 border border-white/10 rounded-[2rem] shadow-2xl p-7 sm:p-8 backdrop-blur-xl z-10"
      >
        {/* Navigation Tabs (Login vs Setup / Generate) */}
        <div className="flex bg-[#121625] p-1 rounded-xl mb-6 border border-white/5 relative z-20 shadow-inner">
          <button
            type="button"
            onClick={() => {
              if (!isConfigured) {
                setErrorMsg(t('app.lockScreen.errors.setupFirst'));
                return;
              }
              setActiveTab('login');
              setErrorMsg(null);
            }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'login'
                ? 'bg-primary text-white shadow shadow-primary/20'
                : 'text-on-surface-variant/60 hover:text-on-surface'
            }`}
          >
            <Unlock className="w-3.5 h-3.5" />
            {t('app.lockScreen.loginTab')}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('setup');
              setErrorMsg(null);
            }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'setup'
                ? 'bg-primary text-white shadow shadow-primary/20'
                : 'text-on-surface-variant/60 hover:text-on-surface'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            {t('app.lockScreen.setupTab')}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'setup' ? (
            /* ==================== SETUP STATE ==================== */
            <motion.div
              key="setup-section"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-secondary/15 text-secondary border border-secondary/10 font-bold tracking-wider uppercase">
                  {isConfigured ? t('app.lockScreen.secureKeyRotation') : t('app.lockScreen.setupRequired')}
                </span>
                <h2 className="text-title-medium font-outfit text-on-surface font-bold mt-2.5">
                  {isConfigured ? t('app.lockScreen.rotateTitle') : t('app.lockScreen.setupTitle')}
                </h2>
                <p className="text-[12px] text-on-surface-variant/80 mt-1">{t('app.lockScreen.setupDescription')}</p>
              </div>

              <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">{t('app.lockScreen.onboardingTitle')}</h3>
                    <p className="text-[11px] text-on-surface-variant/80 leading-relaxed mt-1">{t('app.lockScreen.onboardingDescription')}</p>
                  </div>
                </div>
                <div className="grid gap-2">
                  {onboardingSteps.map((step, index) => (
                    <div key={step} className="flex items-center gap-2 text-[11px] text-on-surface-variant/90">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-container-high border border-white/10 text-[10px] font-bold text-primary">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>

              {isConfigured && (
                <div className="p-3 bg-red-500/10 text-red-400 text-xs rounded-xl border border-red-500/20 leading-relaxed font-semibold">
                  <strong>{t('app.lockScreen.existingVaultWarningTitle')}</strong> {t('app.lockScreen.existingVaultWarning')}
                </div>
              )}

              {errorMsg && (
                <div className="p-3 bg-error/15 text-error text-xs rounded-xl border border-error/20 flex gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {setupStep === 1 ? (
                /* Step 1: Set Master Password */
                <form onSubmit={handleStartSetup} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-on-surface-variant/80 font-bold uppercase tracking-wider block px-0.5">{t('app.lockScreen.masterPasswordLabel')}</label>
                    <div className="relative flex items-center bg-white/[0.02] border border-white/5 focus-within:border-primary/40 rounded-xl px-3.5 py-2.5 transition-colors">
                      <KeyRound className="w-5 h-5 text-on-surface-variant/75 shrink-0 mr-3.5" />
                      <input
                        type={showSetupPassword ? 'text' : 'password'}
                        required
                        placeholder={t('app.lockScreen.masterPasswordPlaceholder')}
                        value={setupPassword}
                        onChange={(e) => setSetupPassword(e.target.value)}
                        className="bg-transparent text-sm text-on-surface focus:outline-none w-full placeholder:text-on-surface-variant/30 font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSetupPassword(!showSetupPassword)}
                        aria-label={showSetupPassword ? t('app.lockScreen.hidePassword') : t('app.lockScreen.showPassword')}
                        className="p-1 hover:bg-white/5 rounded-lg text-on-surface-variant/70 hover:text-on-surface transition-colors cursor-pointer"
                      >
                        {showSetupPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-on-surface-variant/80 font-bold uppercase tracking-wider block px-0.5">{t('app.lockScreen.confirmPasswordLabel')}</label>
                    <div className="relative flex items-center bg-white/[0.02] border border-white/5 focus-within:border-primary/40 rounded-xl px-3.5 py-2.5 transition-colors">
                      <KeyRound className="w-5 h-5 text-on-surface-variant/75 shrink-0 mr-3.5" />
                      <input
                        type={showSetupPassword ? 'text' : 'password'}
                        required
                        placeholder={t('app.lockScreen.confirmPasswordPlaceholder')}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="bg-transparent text-sm text-on-surface focus:outline-none w-full placeholder:text-on-surface-variant/30 font-medium"
                      />
                    </div>
                    {setupPassword && (
                      <div className="text-[10px] text-on-surface-variant/60 italic pt-1 flex items-center gap-1 px-1">
                        <Sparkles className="w-3.5 h-3.5 text-tertiary" />
                        <span>{t('app.lockScreen.passwordWarning')}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="w-full py-3 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl text-sm transition-all focus:ring-1 focus:ring-primary/50 shadow-lg shadow-primary/10 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {t('app.lockScreen.continue')}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              ) : (
                /* Step 2: Secret Key generated */
                <div className="space-y-5">
                  <div className="bg-surface-container-high/40 border border-white/5 p-4 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2 text-tertiary">
                      <Laptop className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">{t('app.lockScreen.secretKeyLabel')}</span>
                    </div>

                    <p className="text-[11px] text-on-surface-variant/95 leading-relaxed">
                      {t('app.lockScreen.secretKeyDescription')}
                    </p>

                    <div className="bg-surface-container-deep/80 border border-white/5 p-3 rounded-lg font-mono text-sm text-center tracking-wider text-on-surface select-all select-none font-bold break-all">
                      {generatedSecretKey}
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <button
                        onClick={handleCopySecretKey}
                        className="py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer text-on-surface"
                      >
                        {copied ? (
                          <>
                            <Check className="w-4 h-4 text-tertiary" />
                            {t('app.lockScreen.copied')}
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            {t('app.lockScreen.copyKey')}
                          </>
                        )}
                      </button>

                      <button
                        onClick={handleDownloadBackup}
                        className="py-2.5 bg-primary/15 hover:bg-primary/25 border border-primary/20 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer text-primary"
                      >
                        <Download className="w-4 h-4" />
                        {t('app.lockScreen.downloadKit')}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 px-1">
                    <input
                      type="checkbox"
                      id="remember-setup"
                      checked={rememberDevice}
                      onChange={(e) => setRememberDevice(e.target.checked)}
                      className="accent-primary rounded"
                    />
                    <label id="label-remember" htmlFor="remember-setup" className="text-xs text-on-surface-variant hover:text-on-surface cursor-pointer select-none">
                      {t('app.lockScreen.rememberSecretSetup')}
                    </label>
                  </div>

                  {biometricStatus?.isAvailable && (
                    <div className="flex items-start gap-2 px-1 rounded-xl border border-tertiary/15 bg-tertiary/5 p-3">
                      <input
                        type="checkbox"
                        id="biometric-setup"
                        checked={biometricUnlockEnabled && rememberDevice}
                        disabled={!rememberDevice || isUnlocking}
                        onChange={(e) => setBiometricUnlockEnabled(e.target.checked)}
                        className="accent-tertiary rounded mt-0.5"
                      />
                      <label htmlFor="biometric-setup" className="text-xs text-on-surface-variant hover:text-on-surface cursor-pointer select-none leading-relaxed">
                        {t('app.lockScreen.biometric.enable', { label: biometricStatus.label })}
                      </label>
                    </div>
                  )}

                  <button
                    onClick={handleCompleteSetup}
                    className="w-full py-3 bg-tertiary hover:bg-tertiary/90 text-on-tertiary font-bold rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Unlock className="w-4 text-on-tertiary h-4" />
                    {t('app.lockScreen.confirmAndUnlock')}
                  </button>
                </div>
              )}
            </motion.div>
          ) : (
            /* ==================== LOGIN STATE ==================== */
            <motion.div
              key="login-section"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="text-center">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-tertiary/15 text-tertiary border border-tertiary/10 font-bold tracking-wider uppercase">{t('app.lockScreen.secureLockActive')}</span>
                <h2 className="text-title-medium font-outfit text-on-surface font-bold mt-2.5">{t('app.lockScreen.loginTitle')}</h2>
                <p className="text-[12px] text-on-surface-variant/80 mt-1">{t('app.lockScreen.loginDescription')}</p>
              </div>

              {errorMsg && (
                <div className="p-3 bg-error/15 text-error text-xs rounded-xl border border-error/20 flex gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                
                {/* Master Password Input */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-on-surface-variant/80 font-bold uppercase tracking-wider block px-0.5">{t('app.lockScreen.masterPasswordLabel')}</label>
                  <div className="relative flex items-center bg-white/[0.02] border border-white/5 focus-within:border-primary/40 rounded-xl px-3.5 py-2.5 transition-colors">
                    <KeyRound className="w-5 h-5 text-on-surface-variant/75 shrink-0 mr-3.5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder={t('app.lockScreen.loginPasswordPlaceholder')}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      disabled={isUnlocking || isUnlockBlocked}
                      className="bg-transparent text-sm text-on-surface focus:outline-none w-full placeholder:text-on-surface-variant/30 font-medium"
                    />
                    <button
                      type="button"
                      disabled={isUnlocking || isUnlockBlocked}
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? t('app.lockScreen.hidePassword') : t('app.lockScreen.showPassword')}
                      className="p-1 hover:bg-white/5 rounded-lg text-on-surface-variant/70 hover:text-on-surface transition-colors cursor-pointer disabled:opacity-40"
                    >
                      {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                    </button>
                  </div>
                </div>

                {/* Device Secret Key (Autofilled if checked) */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center px-0.5">
                    <label className="text-[10px] text-on-surface-variant/80 font-bold uppercase tracking-wider block">{t('app.lockScreen.secretKeyLabel')}</label>
                    <span className="text-[9px] text-primary hover:underline font-mono cursor-pointer" onClick={() => alert(t('app.lockScreen.secretKeyHelp'))}>{t('app.lockScreen.whatIsIt')}</span>
                  </div>
                  <div className="relative flex items-center bg-white/[0.02] border border-white/5 focus-within:border-secondary/40 rounded-xl px-3.5 py-2.5 transition-colors">
                    <Lock className="w-5 h-5 text-on-surface-variant/75 shrink-0 mr-3.5" />
                    <input
                      type="text"
                      required
                      placeholder="A3-XXXXXX-XXXXXX-XXXXX-XXXXX"
                      value={loginSecretKey}
                      onChange={(e) => setLoginSecretKey(e.target.value)}
                      disabled={isUnlocking || isUnlockBlocked}
                      className="bg-transparent text-sm text-on-surface font-mono placeholder:font-sans focus:outline-none w-full placeholder:text-on-surface-variant/30 font-medium tracking-wide uppercase"
                    />
                  </div>
                </div>

                {/* Remember device Option */}
                <div className="flex items-center gap-2 px-1">
                  <input
                    type="checkbox"
                    id="remember-login"
                    checked={rememberDevice}
                    disabled={isUnlocking || isUnlockBlocked}
                    onChange={(e) => setRememberDevice(e.target.checked)}
                    className="accent-primary rounded"
                  />
                  <label id="label-remember-login" htmlFor="remember-login" className="text-xs text-on-surface-variant hover:text-on-surface cursor-pointer select-none">
                    {t('app.lockScreen.rememberDevice')}
                  </label>
                </div>

                {biometricStatus?.isAvailable && (
                  <div className="flex items-start gap-2 px-1 rounded-xl border border-tertiary/15 bg-tertiary/5 p-3">
                    <input
                      type="checkbox"
                      id="biometric-login"
                      checked={biometricUnlockEnabled && rememberDevice}
                      disabled={!rememberDevice || isUnlocking || isUnlockBlocked}
                      onChange={(e) => setBiometricUnlockEnabled(e.target.checked)}
                      className="accent-tertiary rounded mt-0.5"
                    />
                    <label htmlFor="biometric-login" className="text-xs text-on-surface-variant hover:text-on-surface cursor-pointer select-none leading-relaxed">
                      {t('app.lockScreen.biometric.enable', { label: biometricStatus.label })}
                    </label>
                  </div>
                )}

                {biometricStatus?.hasBundle && (
                  <button
                    type="button"
                    onClick={handleBiometricUnlock}
                    disabled={isBiometricUnlocking || isUnlocking || isUnlockBlocked}
                    className="w-full py-3 bg-tertiary/15 hover:bg-tertiary/25 text-tertiary border border-tertiary/25 font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isBiometricUnlocking ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        {t('app.lockScreen.biometric.unlocking')}
                      </>
                    ) : (
                      <>
                        <Fingerprint className="w-4 h-4" />
                        {t('app.lockScreen.biometric.unlockWith', { label: biometricStatus.label })}
                      </>
                    )}
                  </button>
                )}

                {/* Submit Action or loading decryption animation */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isUnlocking || isUnlockBlocked}
                    className="relative w-full py-3.5 bg-primary hover:bg-primary/95 text-white font-bold rounded-xl text-sm transition-all focus:ring-1 focus:ring-primary/50 overflow-hidden flex items-center justify-center gap-2 cursor-pointer disabled:bg-primary/50 disabled:cursor-not-allowed shadow-lg shadow-primary/15"
                  >
                    {isUnlocking ? (
                      <div className="flex items-center gap-2.5">
                        <RefreshCw className="w-4.5 h-4.5 animate-spin" />
                        <span>{t('app.lockScreen.decrypting')}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Unlock className="w-4 h-4 text-white" />
                        <span>{t('app.lockScreen.unlock')}</span>
                      </div>
                    )}
                  </button>
                </div>

                {/* Reset action helper link */}
                <div className="flex flex-col gap-1.5 text-center mt-3 pt-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (confirm(t('app.lockScreen.errors.resetConfirm'))) {
                        try {
                          const currentLanguage = i18n.language;
                          localStorage.clear();
                          await clearStoredSecretKey();
                          await clearAndroidBiometricUnlockBundle();
                          if (currentLanguage === 'tr' || currentLanguage === 'en' || currentLanguage === 'zh-CN') {
                            localStorage.setItem('aegis_language', currentLanguage);
                          }
                          await clearAllOPFSFiles();
                          setIsConfigured(false);
                          setLoginPassword('');
                          setLoginSecretKey('');
                          setErrorMsg(null);
                          onAddLog(t('app.lockScreen.logs.localReset'), "warning");
                        } catch (err: any) {
                          setErrorMsg(t('app.lockScreen.errors.resetFailed', { message: err.message }));
                        }
                      }
                    }}
                    className="text-[10px] text-on-surface-variant/50 hover:text-error transition-colors hover:underline cursor-pointer"
                  >
                    {t('app.lockScreen.resetKeys')}
                  </button>
                </div>

              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Safety footprint footer */}
      <div className="mt-8 flex items-center gap-2 text-on-surface-variant/40 text-[10px]" id="app-footer-brand">
        <ShieldCheck className="w-3.5 h-3.5 text-tertiary/70" />
        <span>{t('app.lockScreen.footer')}</span>
      </div>
        </section>
      </main>
    </div>
  );
}
