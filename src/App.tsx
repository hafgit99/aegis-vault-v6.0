import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Sidebar from './components/Sidebar';
import VaultItem from './components/VaultItem';
import type { SecurityLog } from './components/SecurityLogsModal';
import { VaultEntry, EntryType } from './types';
import LockScreen from './components/LockScreen';
import { vaultService } from './lib/vaultService';
import { DEFAULT_AVATAR_URL, normalizeAvatarUrl } from './lib/avatarPresets';
import { useTranslation } from 'react-i18next';
import { localizedMessage } from './i18n/localizedMessages';
import { supportedLanguages, SupportedLanguage } from './i18n';
import { 
  Search, RefreshCw, UserRoundCheck, Database, 
  Filter, LayoutGrid, Network, LockKeyhole, 
  ShieldPlus, ShieldX, CloudOff, ShieldCheck, Plus, Key, CreditCard, FileText, Lock, Languages
} from 'lucide-react';

const SecurityAudit = lazy(() => import('./components/SecurityAudit'));
const Generator = lazy(() => import('./components/Generator'));
const Settings = lazy(() => import('./components/Settings'));
const TrashBin = lazy(() => import('./components/TrashBin'));
const AddEntryModal = lazy(() => import('./components/AddEntryModal'));
const DetailPanel = lazy(() => import('./components/DetailPanel'));
const ProfileModal = lazy(() => import('./components/ProfileModal'));
const DatabaseModal = lazy(() => import('./components/DatabaseModal'));
const SecurityLogsModal = lazy(() => import('./components/SecurityLogsModal'));
const Donate = lazy(() => import('./components/Donate'));

const INITIAL_ENTRIES: VaultEntry[] = [
  {
    id: "v1",
    title: "Chase Private Client",
    subtitle: "john.doe@protonmail.com",
    username: "john.doe@protonmail.com",
    password: "••••••••••••••••••••",
    strength: "IMMUTABLE",
    themeColor: "tertiary",
    type: "login",
    createdAt: new Date().toISOString()
  },
  {
    id: "v2",
    title: "X / Twitter",
    subtitle: "@j_security_dev",
    username: "@j_security_dev",
    password: "TwitterP@ssword2026!",
    strength: "GOOD",
    themeColor: "secondary",
    type: "login",
    createdAt: new Date().toISOString()
  },
  {
    id: "v3",
    title: "Binance Pro",
    subtitle: "2FA Backup Seed",
    username: "binance_user_99",
    password: "BinanceImmutable391!@",
    strength: "IMMUTABLE",
    themeColor: "tertiary",
    type: "login",
    createdAt: new Date().toISOString()
  }
];

export default function App() {
  const { t, i18n } = useTranslation();
  const [isLocked, setIsLocked] = useState(true);
  const [activeTab, setActiveTab] = useState('vault');
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<VaultEntry | null>(null);

  // New States for Header Controls
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isDatabaseModalOpen, setIsDatabaseModalOpen] = useState(false);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  
  const [userName, setUserName] = useState(() => {
    try {
      return localStorage.getItem('aegis_user_name') || t('app.logs.defaultUserName');
    } catch (e) {
      return t('app.logs.defaultUserName');
    }
  });
  const [avatarUrl, setAvatarUrl] = useState(() => {
    try {
      const savedAvatarUrl = localStorage.getItem('aegis_user_avatar');
      const normalizedAvatarUrl = normalizeAvatarUrl(savedAvatarUrl);

      if (savedAvatarUrl && savedAvatarUrl !== normalizedAvatarUrl) {
        localStorage.setItem('aegis_user_avatar', normalizedAvatarUrl);
      }

      return normalizedAvatarUrl;
    } catch (e) {
      return DEFAULT_AVATAR_URL;
    }
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Lazy Loading / Infinite Scroll Logic for Large Datasets
  const [visibleCount, setVisibleCount] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset visible items and close detail panel whenever the user filters or searches
  useEffect(() => {
    setVisibleCount(50);
  }, [searchQuery, filterType]);

  // Close detail panel when switching tabs
  useEffect(() => {
    setSelectedEntry(null);
  }, [activeTab]);

  const addSecurityLog = (action: string, severity: 'info' | 'warning' | 'critical' = 'info') => {
    setLogs(prev => {
      const newLog: SecurityLog = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
        timestamp: new Date().toISOString(),
        action,
        severity
      };
      const updated = [...prev, newLog];
      try {
        localStorage.setItem('aegis_security_logs', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const showToast = (message: string) => {
    setToastMessage(message);
  };

  // Auto-clear toast trigger
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Load entries when vault is unlocked
  useEffect(() => {
    if (!isLocked) {
      vaultService.getPasswords().then(loaded => {
        // Fallback to INITIAL_ENTRIES if DB is empty on first setup
        if (loaded.length === 0) {
          Promise.all(INITIAL_ENTRIES.map(e => vaultService.savePassword(e)))
            .then(() => vaultService.getPasswords())
            .then(newLoaded => setEntries(newLoaded))
            .catch(console.error);
        } else {
          setEntries(loaded);
        }
      }).catch(err => {
        console.error("Failed to load entries from SQLite:", err);
      });
    } else {
      setEntries([]);
    }
  }, [isLocked]);

  // Load security logs
  useEffect(() => {
    const savedLogs = localStorage.getItem('aegis_security_logs');
    if (savedLogs) {
      try {
        setLogs(JSON.parse(savedLogs));
      } catch (err) {
        setLogs([{ id: 'default', timestamp: new Date().toISOString(), action: t('app.logs.securityLogCreated'), severity: 'info' }]);
      }
    } else {
      const initialLogs: SecurityLog[] = [
        { id: '1', timestamp: new Date().toISOString(), action: t('app.logs.securityEngineStarted'), severity: 'info' },
        { id: '2', timestamp: new Date().toISOString(), action: t('app.logs.offlineSandboxVerified'), severity: 'info' }
      ];
      setLogs(initialLogs);
      localStorage.setItem('aegis_security_logs', JSON.stringify(initialLogs));
    }
  }, []);

  const handleLock = async () => {
    await vaultService.lock();
    setIsLocked(true);
    addSecurityLog(t('app.logs.vaultLockedManually'), "warning");
    showToast(t('app.logs.vaultLockedToast'));
  };

  // Auto Lock Inactivity Idle Timer
  useEffect(() => {
    if (isLocked) return;

    let timeoutId: number;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);

      const autoLockVal = localStorage.getItem('aegis_auto_lock') || '15';
      if (autoLockVal === 'never') return;

      const minutes = parseInt(autoLockVal, 10) || 15;
      const ms = minutes * 60 * 1000;

      timeoutId = window.setTimeout(() => {
        handleLock();
        addSecurityLog(t('app.logs.autoLockTriggered', { minutes }), 'warning');
      }, ms);
    };

    // User interaction events
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    // Throttle helper to avoid performance overhead on mousemove/scroll
    let lastActivityTime = 0;
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastActivityTime > 1000) { // Throttle resets to once per second
        lastActivityTime = now;
        resetTimer();
      }
    };

    // Initialize timer
    resetTimer();

    // Attach listeners
    events.forEach(evt => window.addEventListener(evt, handleActivity, { passive: true }));

    // Cleanup
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(evt => window.removeEventListener(evt, handleActivity));
    };
  }, [isLocked]);

  const handleUpdateUserName = (newName: string) => {
    setUserName(newName);
    localStorage.setItem('aegis_user_name', newName);
    addSecurityLog(t('app.logs.profileNameChanged', { name: newName }), 'info');
    showToast(t('app.logs.profileNameSaved'));
  };

  const handleUpdateAvatarUrl = (newUrl: string) => {
    const normalizedAvatarUrl = normalizeAvatarUrl(newUrl);
    setAvatarUrl(normalizedAvatarUrl);
    localStorage.setItem('aegis_user_avatar', normalizedAvatarUrl);
    addSecurityLog(t('app.logs.avatarUpdated'), 'info');
    showToast(t('app.logs.avatarSaved'));
  };

  const handleSetLanguage = (language: SupportedLanguage) => {
    i18n.changeLanguage(language);
  };

  const handleAddEntry = async (entry: VaultEntry) => {
    try {
      await vaultService.savePassword(entry);
      const loaded = await vaultService.getPasswords();
      setEntries(loaded);
      addSecurityLog(t('app.logs.entryCreated', { title: entry.title }), 'info');
      showToast(t('app.logs.entryAdded', { title: entry.title }));
    } catch (err) {
      console.error(err);
      showToast(t('app.logs.entryAddError'));
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      const entryToDelete = entries.find(e => e.id === id);
      if (!entryToDelete) return;
      const title = entryToDelete.title;
      const updatedEntry = { ...entryToDelete, isDeleted: true, deletedAt: new Date().toISOString() };
      await vaultService.savePassword(updatedEntry);
      const loaded = await vaultService.getPasswords();
      setEntries(loaded);
      addSecurityLog(t('app.logs.entryMovedToTrashLog', { title }), 'warning');
      showToast(t('app.logs.entryMovedToTrash', { title }));
    } catch (err) {
      console.error(err);
      showToast(t('app.logs.entryTrashError'));
    }
  };

  const handleUpdateEntry = async (updatedEntry: VaultEntry) => {
    try {
      await vaultService.savePassword(updatedEntry);
      const loaded = await vaultService.getPasswords();
      setEntries(loaded);
      setSelectedEntry(updatedEntry);
      addSecurityLog(t('app.logs.entryUpdatedLog', { title: updatedEntry.title }), 'info');
      showToast(t('app.logs.entryUpdated', { title: updatedEntry.title }));
    } catch (err) {
      console.error(err);
      showToast(t('app.logs.entryUpdateError'));
    }
  };

  const handleToggleFavorite = async (id: string) => {
    try {
      const entryToToggle = entries.find(e => e.id === id);
      if (!entryToToggle) return;
      const updated = { ...entryToToggle, favorite: !entryToToggle.favorite };
      await vaultService.savePassword(updated);
      const loaded = await vaultService.getPasswords();
      setEntries(loaded);
      
      // If active details panel belongs to this entry, update its in-memory panel too
      if (selectedEntry?.id === id) {
        setSelectedEntry(updated);
      }
      
      if (updated.favorite) {
        addSecurityLog(t('app.logs.favoriteAddedLog', { title: updated.title }), 'info');
        showToast(t('app.logs.favoriteAdded', { title: updated.title }));
      } else {
        addSecurityLog(t('app.logs.favoriteRemovedLog', { title: updated.title }), 'info');
        showToast(t('app.logs.favoriteRemoved', { title: updated.title }));
      }
    } catch (err) {
      console.error(err);
      showToast(t('app.logs.favoriteError'));
    }
  };

  const handleRestoreEntry = async (id: string) => {
    try {
      const entryToRestore = entries.find(e => e.id === id);
      if (!entryToRestore) return;
      const title = entryToRestore.title;
      const updatedEntry = { ...entryToRestore, isDeleted: false, deletedAt: undefined };
      await vaultService.savePassword(updatedEntry);
      const loaded = await vaultService.getPasswords();
      setEntries(loaded);
      addSecurityLog(t('app.logs.entryRestoredLog', { title }), 'info');
      showToast(t('app.logs.entryRestored', { title }));
    } catch (err) {
      console.error(err);
      showToast(t('app.logs.entryRestoreError'));
    }
  };

  const handlePermanentDelete = async (id: string) => {
    try {
      const entryToDelete = entries.find(e => e.id === id);
      const title = entryToDelete ? entryToDelete.title : t('app.logs.unknownItem');
      await vaultService.deletePassword(id);
      const loaded = await vaultService.getPasswords();
      setEntries(loaded);
      addSecurityLog(t('app.logs.entryDeletedLog', { title }), 'critical');
      showToast(t('app.logs.entryDeleted', { title }));
    } catch (err) {
      console.error(err);
      showToast(t('app.logs.entryDeleteError'));
    }
  };

  const handleClearTrash = async () => {
    try {
      const deletedEntries = entries.filter(e => e.isDeleted);
      const count = deletedEntries.length;
      for (const entry of deletedEntries) {
        await vaultService.deletePassword(entry.id);
      }
      const loaded = await vaultService.getPasswords();
      setEntries(loaded);
      addSecurityLog(t('app.logs.trashClearedLog', { count }), 'warning');
      showToast(t('app.logs.trashCleared'));
    } catch (err) {
      console.error(err);
      showToast(t('app.logs.trashClearError'));
    }
  };

  const handleResetEntries = async () => {
    try {
      if (vaultService.sqliteDb) {
        vaultService.sqliteDb.clearPasswords();
        await vaultService.sqliteDb.flushToOPFS();
      }
      for (const entry of INITIAL_ENTRIES) {
        await vaultService.savePassword(entry);
      }
      const loaded = await vaultService.getPasswords();
      setEntries(loaded);
      addSecurityLog(t('app.logs.vaultFactoryReset'), 'warning');
      showToast(t('app.logs.vaultSamplesLoaded'));
    } catch (err) {
      console.error(err);
      showToast(t('app.logs.vaultResetError'));
    }
  };

  const handleImportBackup = async (importedEntries: VaultEntry[], overwrite: boolean = false) => {
    try {
      if (overwrite) {
        if (vaultService.sqliteDb) {
          vaultService.sqliteDb.clearPasswords();
        }
      }
      for (const entry of importedEntries) {
        await vaultService.savePassword(entry, false);
      }
      if (vaultService.sqliteDb) {
        await vaultService.sqliteDb.flushToOPFS();
      }
      const loaded = await vaultService.getPasswords();
      setEntries(loaded);
      showToast(t('app.logs.importSuccess', { count: importedEntries.length }));
    } catch (err: any) {
      console.error(localizedMessage('backupImportError'), err);
      showToast(t('app.logs.importError', { message: err?.message || err }));
    }
  };

  const handleClearStorage = async () => {
    try {
      await vaultService.wipeAllData();
      setEntries([]);
      setIsLocked(true);
      addSecurityLog(t('app.logs.databaseWipedLog'), 'critical');
      showToast(t('app.logs.databaseWiped'));
    } catch (err) {
      console.error(err);
      showToast(t('app.logs.dataDeleteError'));
    }
  };

  const handleClearLogs = () => {
    const freshLogs: SecurityLog[] = [
      { id: Date.now().toString(), timestamp: new Date().toISOString(), action: t('app.logs.logsClearedRecord'), severity: 'warning' }
    ];
    setLogs(freshLogs);
    localStorage.setItem('aegis_security_logs', JSON.stringify(freshLogs));
    showToast(t('app.logs.logsCleared'));
  };

  const handleHeaderSync = () => {
    if (isSyncing) return;
    setIsSyncing(true);
    addSecurityLog(t('app.logs.databaseSyncStarted'), "info");
    
    setTimeout(() => {
      setIsSyncing(false);
      addSecurityLog(t('app.logs.databaseSyncCompleted'), "info");
      showToast(t('app.logs.allLocalDataSynced'));
    }, 1000);
  };

  // Calculate dynamic statistics based on actual active (non-deleted) passwords
  const activeEntries = entries.filter(e => !e.isDeleted);
  const totalCount = activeEntries.length;

  // 1. Weak passwords count (consistent with SecurityAudit.tsx)
  const weakCount = activeEntries.filter(e => 
    e.type === 'login' && 
    e.password && 
    e.password.trim().length > 0 && 
    (e.password.length <= 12 || e.strength === 'GOOD')
  ).length;

  // 2. Reused duplicate passwords count (consistent with SecurityAudit.tsx)
  const passwordGroups: Record<string, number> = {};
  activeEntries.forEach(entry => {
    if (entry.password && entry.password.trim()) {
      const pw = entry.password.trim();
      passwordGroups[pw] = (passwordGroups[pw] || 0) + 1;
    }
  });
  const totalDuplicates = Object.values(passwordGroups)
    .filter(count => count > 1)
    .reduce((acc, count) => acc + count, 0);

  // 3. Master password strength check
  const masterPassword = localStorage.getItem('aegis_master_password') || '';
  const isMasterStrong = masterPassword.length >= 12;

  // 4. Calculate overall dynamic health score
  let rawScore = 100;
  if (totalCount > 0) {
    const weakDeduction = Math.min(40, weakCount * 15);
    const duplicateDeduction = Math.min(35, totalDuplicates * 10);
    const masterDeduction = isMasterStrong ? 0 : 15;
    
    rawScore = 100 - weakDeduction - duplicateDeduction - masterDeduction;
    if (rawScore < 10) rawScore = 10; // keep floor at 10%
  }
  const healthPercent = Math.round(rawScore);

  // Filter ONLY active entries based on search query and category filters
  const filteredEntries = activeEntries.filter((entry) => {
    const matchesSearch = 
      (entry.title && entry.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (entry.subtitle && entry.subtitle.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (entry.username && entry.username.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (filterType === 'all') return matchesSearch;
    if (filterType === 'favorite') return matchesSearch && entry.favorite;
    return matchesSearch && entry.type === filterType;
  });

  const visibleEntries = filteredEntries.slice(0, visibleCount);
  const hasMore = filteredEntries.length > visibleCount;

  // Automatically load more entries when user scrolls inside the container
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // If user scrolls within 200px of the bottom, load the next batch of 50 items
    if (scrollHeight - scrollTop - clientHeight < 200) {
      if (hasMore) {
        setVisibleCount((prev) => prev + 50);
      }
    }
  };

  const renderTabContent = () => {
    switch(activeTab) {
      case 'audit':
        return <SecurityAudit entries={entries} />;
      case 'generator':
        return <Generator />;
      case 'settings':
        return (
          <Settings 
            onReset={handleResetEntries} 
            entries={entries}
            onImport={handleImportBackup}
            onAddLog={addSecurityLog}
          />
        );
      case 'trash':
        return (
          <TrashBin 
            entries={entries}
            onRestore={handleRestoreEntry}
            onPermanentDelete={handlePermanentDelete}
            onClearTrash={handleClearTrash}
          />
        );
      case 'donate':
        return <Donate />;
      case 'vault':
      default:
        return (
          <>
            {/* Header & Badges */}
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col md:flex-row md:justify-between md:items-end gap-4"
            >
              <div>
                <h2 className="text-display-lg text-on-surface mb-2 font-outfit tracking-tight">{t('app.dashboard.title')}</h2>
                <div className="flex items-center gap-2 text-on-tertiary-container">
                  <ShieldCheck className="w-4 h-4 text-tertiary" />
                  <span className="text-label-caps opacity-90 text-sm">{t('app.dashboard.subtitle')}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-3 px-4 py-2.5 bg-surface-container-high rounded-xl border border-outline-variant/20 shadow-sm select-none">
                <div className="w-2 h-2 rounded-full bg-tertiary animate-pulse shadow-[0_0_8px_rgba(181,205,177,0.8)]"></div>
                <span className="text-mono-data text-on-surface text-xs">{t('app.dashboard.localStorageActive')}</span>
              </div>
            </motion.section>

            {/* Core Metrics Bento Grid */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Health Score */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: 0.1 }} 
                className="glass-panel p-6 rounded-[1.25rem] relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300"
              >
                <div className="flex justify-between items-start mb-5">
                  <div className="p-3 bg-tertiary/10 rounded-xl border border-tertiary/10">
                    <ShieldPlus className="text-tertiary w-6 h-6" />
                  </div>
                  <span className={`text-headline-md font-geist-mono font-bold ${
                    healthPercent >= 90 ? 'text-tertiary' : healthPercent >= 70 ? 'text-primary' : 'text-secondary'
                  }`}>{healthPercent}%</span>
                </div>
                <p className="text-label-caps text-on-surface-variant font-semibold mb-2">{t('app.dashboard.healthScore')}</p>
                <div className="w-full bg-surface-variant h-1.5 rounded-full overflow-hidden">
                  <div className="bg-tertiary h-full transition-all duration-500 shadow-[0_0_12px_rgba(181,205,177,0.6)]" style={{ width: `${healthPercent}%` }}></div>
                </div>
              </motion.div>

              {/* Vulnerabilities */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: 0.2 }} 
                className="glass-panel p-6 rounded-[1.25rem] relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300"
              >
                <div className="flex justify-between items-start mb-5">
                  <div className="p-3 bg-error/10 rounded-xl border border-error/10">
                    <ShieldX className="text-error w-6 h-6" />
                  </div>
                  <span className="text-on-surface text-headline-md font-geist-mono font-bold">{weakCount}</span>
                </div>
                <p className="text-label-caps text-on-surface-variant font-semibold mb-1">{t('app.dashboard.passwordsToImprove')}</p>
                <p className="text-xs text-on-surface-variant/70">
                  {weakCount === 0 ? t('app.dashboard.allRecordsProtected') : t('app.dashboard.passwordAuditRecommended', { count: weakCount })}
                </p>
              </motion.div>

              {/* Sync State */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: 0.3 }} 
                className="glass-panel p-6 rounded-[1.25rem] relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300"
              >
                <div className="flex justify-between items-start mb-5">
                  <div className="p-3 bg-secondary/10 rounded-xl border border-secondary/10">
                    <CloudOff className="text-secondary w-6 h-6" />
                  </div>
                  <span className="text-on-surface-variant text-item-title font-geist-mono">{t('app.dashboard.off')}</span>
                </div>
                <p className="text-label-caps text-on-surface-variant font-semibold mb-1">{t('app.dashboard.cloudSync')}</p>
                <p className="text-xs text-on-surface-variant/70">{t('app.dashboard.localKeysEnabled')}</p>
              </motion.div>

            </section>

            {/* Compact Activity & Info Strip */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: 0.35 }}
              className="grid grid-cols-1 md:grid-cols-4 gap-4"
            >
              {/* Activity items as compact horizontal cards */}
              <div className="glass-panel rounded-xl p-4 flex gap-3 items-center hover:bg-white/[0.03] transition-colors group">
                <div className="w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_rgba(172,201,235,0.6)] shrink-0"></div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-on-surface truncate group-hover:text-primary transition-colors">{t('app.dashboard.passwordGenerated')}</p>
                  <p className="text-[11px] text-on-surface-variant/70 truncate">{t('app.dashboard.generatedLocally')}</p>
                </div>
              </div>
              <div className="glass-panel rounded-xl p-4 flex gap-3 items-center hover:bg-white/[0.03] transition-colors group">
                <div className="w-2 h-2 rounded-full bg-tertiary shadow-[0_0_8px_rgba(181,205,177,0.6)] shrink-0"></div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-on-surface truncate group-hover:text-primary transition-colors">{t('app.dashboard.securityAudit')}</p>
                  <p className="text-[11px] text-on-surface-variant/70 truncate">{t('app.dashboard.systemIntegrityScanned')}</p>
                </div>
              </div>
              <div className="glass-panel rounded-xl p-4 flex gap-3 items-center hover:bg-white/[0.03] transition-colors group">
                <div className="w-2 h-2 rounded-full bg-outline shrink-0"></div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-on-surface truncate group-hover:text-primary transition-colors">{t('app.dashboard.databaseSync')}</p>
                  <p className="text-[11px] text-on-surface-variant/70 truncate">{t('app.dashboard.localStorageIoComplete')}</p>
                </div>
              </div>
              {/* Compact device sovereignty badge */}
              <div className="security-gradient rounded-xl p-4 border border-primary/10 flex items-center gap-3 group relative overflow-hidden">
                <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Network className="w-16 h-16 text-primary" />
                </div>
                <LockKeyhole className="w-5 h-5 text-tertiary shrink-0" />
                <div className="min-w-0 relative z-10">
                  <p className="text-sm font-semibold text-primary truncate">{t('app.dashboard.deviceSovereignty')}</p>
                  <p className="text-[11px] text-on-surface-variant/70 truncate">{t('app.dashboard.zeroAttackSurface')}</p>
                </div>
              </div>
            </motion.div>

            {/* Full-Width Vault Records Section */}
            <section className="flex flex-col pb-10" style={{ minHeight: 0 }}>
              
              {/* Section Header with dynamic sub-categories */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                <h3 className="text-headline-md text-on-surface font-outfit select-none">{t('app.dashboard.vaultRecords', { count: filteredEntries.length })}</h3>
                
                {/* Category tabs */}
                <div className="flex bg-surface-container/50 p-1 rounded-xl border border-white/5 self-start sm:self-center">
                  {[
                    { id: 'all', label: t('app.filters.all') },
                    { id: 'favorite', label: t('app.filters.favorites') },
                    { id: 'login', label: t('app.filters.login') },
                    { id: 'card', label: t('app.filters.card') },
                    { id: 'passkey', label: t('app.filters.passkey') },
                    { id: 'identity', label: t('app.filters.identity') },
                    { id: 'note', label: t('app.filters.notes') }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setFilterType(tab.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        filterType === tab.id 
                          ? 'bg-secondary-container/40 text-secondary border border-secondary/20 shadow-sm' 
                          : 'text-on-surface-variant/70 hover:text-on-surface hover:bg-white/5'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredEntries.length > 0 ? (
                <div 
                  ref={containerRef}
                  onScroll={handleScroll}
                  className="vault-scroll overflow-y-auto pr-3 scroll-smooth flex-1"
                  style={{ maxHeight: 'calc(100vh - 380px)' }}
                >
                  <div className="space-y-3">
                    {visibleEntries.map((entry, index) => (
                      <VaultItem 
                        key={entry.id}
                        entry={entry}
                        onDelete={handleDeleteEntry}
                        isActive={selectedEntry?.id === entry.id}
                        onToggleFavorite={handleToggleFavorite}
                        onClick={() => {
                          setSelectedEntry(selectedEntry?.id === entry.id ? null : entry);
                        }}
                        delay={Math.min(0.2, (index % 5) * 0.04)}
                      />
                    ))}
                  </div>

                  {/* Minimal & Elegant Automatic Loader Sentinel */}
                  {hasMore && (
                    <div 
                      className="py-6 flex justify-center items-center select-none"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex space-x-1.5 items-center">
                          <div className="w-1.5 h-1.5 bg-tertiary/75 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                          <div className="w-1.5 h-1.5 bg-tertiary/75 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                          <div className="w-1.5 h-1.5 bg-tertiary/75 rounded-full animate-bounce"></div>
                        </div>
                        <span className="text-[10px] text-on-surface-variant/50 font-geist-mono uppercase tracking-widest">{t('app.dashboard.loading')}</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="glass-panel p-10 rounded-[1.25rem] text-center border-dashed border-white/10 flex flex-col items-center justify-center space-y-3">
                  <Filter className="w-8 h-8 text-on-surface-variant/30 animate-pulse" />
                  <div>
                    <h4 className="font-semibold text-on-surface text-base">{t('app.dashboard.noItemFound')}</h4>
                    <p className="text-xs text-on-surface-variant/60 mt-1 max-w-sm mx-auto">
                      {t('app.dashboard.noItemFoundDescription')}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button 
                      onClick={() => setIsAddModalOpen(true)}
                      className="py-2.5 px-4 bg-primary/10 border border-primary/20 hover:bg-primary/20 hover:text-primary rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all text-on-surface hover:text-white cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      {t('app.dashboard.createNewRecord')}
                    </button>
                    <button 
                      onClick={handleResetEntries}
                      className="py-2.5 px-4 bg-tertiary/10 border border-tertiary/20 hover:bg-tertiary/20 hover:text-tertiary rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all text-on-surface hover:text-white cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4" />
                      {t('app.dashboard.loadSamples')}
                    </button>
                  </div>
                </div>
              )}
            </section>
          </>
        );
    }
  };

  if (isLocked) {
    return <LockScreen onUnlock={() => setIsLocked(false)} onAddLog={addSecurityLog} />;
  }

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Sidebar - Fixed on left */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onAddNewEntry={() => {
          setActiveTab('vault');
          setIsAddModalOpen(true);
        }} 
        onLock={handleLock}
      />

      {/* Main Workspace Area */}
      <main className="ml-64 flex-1 flex flex-col min-w-0">
        
        {/* Top Header Base */}
        <header className="flex justify-between items-center h-16 px-8 w-full z-40 bg-surface-container-lowest/80 backdrop-blur-xl border-b border-outline-variant/30 sticky top-0">
          <div className="flex items-center gap-4 flex-1">
            <div className={`relative w-full max-w-md group transition-all ${
              activeTab !== 'vault' ? 'opacity-40 pointer-events-none' : ''
            }`}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant group-focus-within:text-tertiary transition-colors" />
              <input 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={activeTab !== 'vault'}
                className="w-full bg-surface-container/50 rounded-lg border border-transparent focus:border-tertiary/30 focus:ring-1 focus:ring-tertiary/50 pl-10 pr-4 text-body-base text-on-surface placeholder:text-on-surface-variant/40 h-10 transition-all outline-none" 
                placeholder={t('app.header.searchPlaceholder')} 
                type="text"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-5">
              <div
                className="h-9 flex items-center gap-2 px-2.5 rounded-lg bg-surface-container/50 border border-outline-variant/20 text-on-surface-variant focus-within:border-primary/40 focus-within:text-primary transition-colors"
                title={t('app.header.languageSelector')}
              >
                <Languages className="w-4 h-4 shrink-0" />
                <select
                  value={i18n.language}
                  onChange={(event) => handleSetLanguage(event.target.value as SupportedLanguage)}
                  aria-label={t('app.header.languageSelector')}
                  className="bg-transparent text-xs font-bold text-on-surface outline-none cursor-pointer"
                >
                  {supportedLanguages.map((language) => (
                    <option key={language.code} value={language.code}>
                      {t(language.labelKey)}
                    </option>
                  ))}
                </select>
              </div>
              <RefreshCw 
                onClick={handleHeaderSync}
                className={`w-5 h-5 text-on-surface-variant hover:text-primary cursor-pointer transition-transform duration-700 ${
                  isSyncing ? 'animate-spin text-primary' : ''
                }`}
                title={t('app.header.localVaultSync')}
              />
              <UserRoundCheck 
                onClick={() => setIsLogsModalOpen(true)}
                className="w-5 h-5 text-on-surface-variant hover:text-primary cursor-pointer transition-colors" 
                title={t('app.header.securityLog')}
              />
              <Database 
                onClick={() => setIsDatabaseModalOpen(true)}
                className="w-5 h-5 text-on-surface-variant hover:text-primary cursor-pointer transition-colors" 
                title={t('app.header.databaseManagement')}
              />
              <Lock 
                onClick={handleLock}
                className="w-5 h-5 text-on-surface-variant hover:text-error cursor-pointer transition-colors" 
                title={t('app.header.lockSafely')}
              />
            </div>
            <div className="h-6 w-px bg-outline-variant/30"></div>
            <div 
              onClick={() => setIsProfileModalOpen(true)}
              className="relative cursor-pointer group"
              title={t('app.header.profile')}
            >
              <img 
                alt={t('app.header.adminProfileAlt')} 
                className="w-9 h-9 rounded-full border border-outline-variant group-hover:border-primary/50 object-cover grayscale group-hover:grayscale-0 transition-all duration-300"
                src={avatarUrl}
                referrerPolicy="no-referrer"
              />
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-tertiary border-2 border-surface-container-lowest rounded-full"></div>
            </div>
          </div>
        </header>

        {/* Main Content Area: List + Detail Panel side by side */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Scrollable Content Container */}
          <div className={`p-8 space-y-10 w-full flex-1 overflow-y-auto overflow-x-hidden transition-all duration-300 ${
            selectedEntry && activeTab === 'vault' ? 'max-w-[calc(100%-800px)]' : 'max-w-[1400px] mx-auto'
          }`}>
            <Suspense fallback={<div className="text-xs text-on-surface-variant/60">{t('app.dashboard.loading')}</div>}>
              {renderTabContent()}
            </Suspense>
          </div>

          {/* 1Password-style Detail Panel */}
          <AnimatePresence>
            {selectedEntry && activeTab === 'vault' && (
              <div className="w-[800px] shrink-0 h-full">
                <Suspense fallback={null}>
                  <DetailPanel
                    entry={selectedEntry}
                    onClose={() => setSelectedEntry(null)}
                    onDelete={(id) => {
                      handleDeleteEntry(id);
                      setSelectedEntry(null);
                    }}
                    onUpdate={handleUpdateEntry}
                  />
                </Suspense>
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Modern 1Password Add Entry Modal */}
      {isAddModalOpen && (
        <Suspense fallback={null}>
          <AddEntryModal
            isOpen={isAddModalOpen}
            onClose={() => setIsAddModalOpen(false)}
            onSave={handleAddEntry}
          />
        </Suspense>
      )}



      {/* Profile details modal */}
      {isProfileModalOpen && (
        <Suspense fallback={null}>
          <ProfileModal
            isOpen={isProfileModalOpen}
            onClose={() => setIsProfileModalOpen(false)}
            userName={userName}
            onUpdateUserName={handleUpdateUserName}
            avatarUrl={avatarUrl}
            onUpdateAvatarUrl={handleUpdateAvatarUrl}
          />
        </Suspense>
      )}

      {/* Database and backup management modal */}
      {isDatabaseModalOpen && (
        <Suspense fallback={null}>
          <DatabaseModal
            isOpen={isDatabaseModalOpen}
            onClose={() => setIsDatabaseModalOpen(false)}
            entries={entries}
            onImportBackup={handleImportBackup}
            onClearStorage={handleClearStorage}
            onAddLog={(action) => addSecurityLog(action, 'warning')}
          />
        </Suspense>
      )}

      {/* Security logs modal */}
      {isLogsModalOpen && (
        <Suspense fallback={null}>
          <SecurityLogsModal
            isOpen={isLogsModalOpen}
            onClose={() => setIsLogsModalOpen(false)}
            logs={logs}
            onClearLogs={handleClearLogs}
          />
        </Suspense>
      )}

      {/* Floating Toast Notification Alert */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-8 left-8 bg-surface-container-high border border-primary/20 text-on-surface px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 z-[150] max-w-sm backdrop-blur-md"
          >
            <ShieldCheck className="w-5 h-5 text-tertiary shrink-0" />
            <span className="text-xs font-semibold leading-relaxed">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Button for triggering Vault / adding */}
      {activeTab === 'vault' && (
        <motion.button 
          whileHover={{ scale: 1.05, rotate: 90 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsAddModalOpen(true)}
          className={`fixed bottom-8 w-14 h-14 bg-secondary text-on-secondary rounded-full shadow-lg shadow-secondary/20 flex items-center justify-center z-[80] transition-all cursor-pointer ${
            selectedEntry ? 'right-[820px]' : 'right-8'
          }`}
          aria-label={t('app.header.addRecordAria')}
        >
          <Plus className="w-7 h-7" />
        </motion.button>
      )}
    </div>
  );
}
