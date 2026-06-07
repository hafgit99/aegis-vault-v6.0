import React, { Suspense, lazy, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Sidebar from './components/Sidebar';
import VaultItem from './components/VaultItem';
import { VaultEntry, EntryType } from './types';
import { vaultService } from './lib/vaultService';
import { normalizeAvatarUrl } from './lib/avatarPresets';
import { useTranslation } from 'react-i18next';
import { supportedLanguages, SupportedLanguage } from './i18n';
import { calculateVaultHealth } from './lib/vaultHealth';
import { AppStateProvider, useAppState } from './context/AppStateContext';
import { useAppNotifications } from './hooks/useAppNotifications';
import { useAutoLock } from './hooks/useAutoLock';
import { useSecurityLogs } from './hooks/useSecurityLogs';
import { useVaultEntries } from './hooks/useVaultEntries';
import { 
  Search, RefreshCw, UserRoundCheck, Database, 
  Filter, LayoutGrid, Network, LockKeyhole, 
  ShieldPlus, ShieldX, CloudOff, ShieldCheck, Plus, Key, CreditCard, FileText, Lock, Languages, ChevronDown
} from 'lucide-react';

const SecurityAudit = lazy(() => import('./components/SecurityAudit'));
const LockScreen = lazy(() => import('./components/LockScreen'));
const Generator = lazy(() => import('./components/Generator'));
const Settings = lazy(() => import('./components/Settings'));
const TrashBin = lazy(() => import('./components/TrashBin'));
const AddEntryModal = lazy(() => import('./components/AddEntryModal'));
const DetailPanel = lazy(() => import('./components/DetailPanel'));
const ProfileModal = lazy(() => import('./components/ProfileModal'));
const DatabaseModal = lazy(() => import('./components/DatabaseModal'));
const SecurityLogsModal = lazy(() => import('./components/SecurityLogsModal'));
const Donate = lazy(() => import('./components/Donate'));
const AutofillHandoffController = lazy(() => import('./components/AutofillHandoffController'));

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
  const { t } = useTranslation();

  return (
    <AppStateProvider defaultUserName={t('app.logs.defaultUserName')}>
      <AppWorkspace />
    </AppStateProvider>
  );
}

function AppWorkspace() {
  const { t, i18n } = useTranslation();
  const {
    state: {
      isLocked,
      activeTab,
      entries,
      searchQuery,
      filterType,
      isAddModalOpen,
      selectedEntry,
      isProfileModalOpen,
      isDatabaseModalOpen,
      isLogsModalOpen,
      isLanguageMenuOpen,
      userName,
      avatarUrl,
      isSyncing,
      logs,
      toastMessage,
      visibleCount,
    },
    actions: {
      setIsLocked,
      setActiveTab,
      setSearchQuery,
      setFilterType,
      setIsAddModalOpen,
      setSelectedEntry,
      setIsProfileModalOpen,
      setIsDatabaseModalOpen,
      setIsLogsModalOpen,
      setIsLanguageMenuOpen,
      setUserName,
      setAvatarUrl,
      setIsSyncing,
      setVisibleCount,
    },
  } = useAppState();
  const { addSecurityLog, clearLogs } = useSecurityLogs();
  const { showToast } = useAppNotifications(addSecurityLog);
  const {
    handleAddEntry,
    handleDeleteEntry,
    handleUpdateEntry,
    handleToggleFavorite,
    handleRestoreEntry,
    handlePermanentDelete,
    handleClearTrash,
    handleResetEntries,
    handleImportBackup,
    handleClearStorage,
    handleUpdatePwnedCounts,
  } = useVaultEntries({
    initialEntries: INITIAL_ENTRIES,
    showToast,
    addSecurityLog,
  });

  // Lazy Loading / Infinite Scroll Logic for Large Datasets
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset visible items and close detail panel whenever the user filters or searches
  useEffect(() => {
    setVisibleCount(50);
  }, [searchQuery, filterType]);

  // Close detail panel when leaving the vault workspace.
  useEffect(() => {
    if (activeTab !== 'vault') {
      setSelectedEntry(null);
    }
  }, [activeTab]);

  const handleLock = async () => {
    await vaultService.lock();
    setIsLocked(true);
    addSecurityLog(t('app.logs.vaultLockedManually'), "warning");
    showToast(t('app.logs.vaultLockedToast'));
  };

  useAutoLock({ isLocked, onLock: handleLock, addSecurityLog });

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
    setIsLanguageMenuOpen(false);
  };

  const currentLanguage = supportedLanguages.find(language => language.code === i18n.language) ?? supportedLanguages[0];

  const handleClearLogs = () => {
    clearLogs(showToast);
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

  const handleOpenEntryFromAudit = (entry: VaultEntry) => {
    setSearchQuery('');
    setFilterType('all');
    setActiveTab('vault');
    setSelectedEntry(entry);
    showToast(t('app.audit.openRecordToast', { title: entry.title || t('app.audit.recordDetails') }));
  };

  const vaultHealth = calculateVaultHealth(entries);
  const activeEntries = vaultHealth.activeEntries;
  const totalCount = vaultHealth.totalCount;
  const weakCount = vaultHealth.weakCount;
  const totalDuplicates = vaultHealth.duplicateEntryCount;
  const isMasterStrong = vaultHealth.masterPasswordStrong;
  const healthPercent = vaultHealth.overallScore;

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
        return (
          <SecurityAudit
            entries={entries}
            onApplyPwnedResults={handleUpdatePwnedCounts}
            onAddLog={addSecurityLog}
            onOpenEntry={handleOpenEntryFromAudit}
          />
        );
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
            <section className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
              
              {/* Health Score */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: 0.1 }} 
                className="glass-panel p-4 md:p-6 rounded-[1.25rem] relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300"
              >
                <div className="flex justify-between items-start mb-3 md:mb-5">
                  <div className="p-2.5 md:p-3 bg-tertiary/10 rounded-xl border border-tertiary/10">
                    <ShieldPlus className="text-tertiary w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <span className={`text-xl md:text-headline-md font-geist-mono font-bold ${
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
                className="glass-panel p-4 md:p-6 rounded-[1.25rem] relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300"
              >
                <div className="flex justify-between items-start mb-3 md:mb-5">
                  <div className="p-2.5 md:p-3 bg-error/10 rounded-xl border border-error/10">
                    <ShieldX className="text-error w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <span className="text-on-surface text-xl md:text-headline-md font-geist-mono font-bold">{weakCount}</span>
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
                className="glass-panel p-4 md:p-6 rounded-[1.25rem] relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300 col-span-2 md:col-span-1"
              >
                <div className="flex justify-between items-start mb-3 md:mb-5">
                  <div className="p-2.5 md:p-3 bg-secondary/10 rounded-xl border border-secondary/10">
                    <CloudOff className="text-secondary w-5 h-5 md:w-6 md:h-6" />
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
              className="mobile-landscape-hide grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4"
            >
              {/* Activity items as compact horizontal cards */}
              <div className="glass-panel rounded-xl p-3 md:p-4 flex gap-3 items-center hover:bg-white/[0.03] transition-colors group">
                <div className="w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_rgba(172,201,235,0.6)] shrink-0"></div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-on-surface truncate group-hover:text-primary transition-colors">{t('app.dashboard.passwordGenerated')}</p>
                  <p className="text-[11px] text-on-surface-variant/70 truncate">{t('app.dashboard.generatedLocally')}</p>
                </div>
              </div>
              <div className="glass-panel rounded-xl p-3 md:p-4 flex gap-3 items-center hover:bg-white/[0.03] transition-colors group">
                <div className="w-2 h-2 rounded-full bg-tertiary shadow-[0_0_8px_rgba(181,205,177,0.6)] shrink-0"></div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-on-surface truncate group-hover:text-primary transition-colors">{t('app.dashboard.securityAudit')}</p>
                  <p className="text-[11px] text-on-surface-variant/70 truncate">{t('app.dashboard.systemIntegrityScanned')}</p>
                </div>
              </div>
              <div className="glass-panel rounded-xl p-3 md:p-4 flex gap-3 items-center hover:bg-white/[0.03] transition-colors group">
                <div className="w-2 h-2 rounded-full bg-outline shrink-0"></div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-on-surface truncate group-hover:text-primary transition-colors">{t('app.dashboard.databaseSync')}</p>
                  <p className="text-[11px] text-on-surface-variant/70 truncate">{t('app.dashboard.localStorageIoComplete')}</p>
                </div>
              </div>
              {/* Compact device sovereignty badge */}
              <div className="security-gradient rounded-xl p-3 md:p-4 border border-primary/10 flex items-center gap-3 group relative overflow-hidden">
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
                <div className="flex max-w-full overflow-x-auto bg-surface-container/50 p-1 rounded-xl border border-white/5 self-start sm:self-center">
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
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
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
                  className="vault-scroll vault-list-scroll overflow-y-auto pr-0 md:pr-3 scroll-smooth flex-1"
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
    return (
      <Suspense fallback={<div className="min-h-screen bg-surface" />}>
        <LockScreen onUnlock={() => setIsLocked(false)} onAddLog={addSecurityLog} />
      </Suspense>
    );
  }

  return (
    <div className="flex min-h-screen bg-surface">
      <Suspense fallback={null}>
        <AutofillHandoffController
          entries={entries}
          isLocked={isLocked}
          onOpenEntry={handleOpenEntryFromAudit}
          showToast={showToast}
          addSecurityLog={addSecurityLog}
        />
      </Suspense>
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
      <main className="md:ml-64 flex-1 flex flex-col min-w-0 pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:pb-0">
        
        {/* Top Header Base */}
        <header className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 sm:gap-4 min-h-[calc(4rem+env(safe-area-inset-top))] md:min-h-16 px-3 md:px-8 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-2 sm:pb-0 md:pt-0 w-full z-40 bg-surface-container-lowest/90 backdrop-blur-xl border-b border-outline-variant/30 sticky top-0">
          <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className={`relative w-full max-w-none sm:max-w-md group transition-all ${
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
          
          <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-6 min-w-0">
            <div className="flex items-center gap-3 sm:gap-5 min-w-0">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsLanguageMenuOpen((isOpen) => !isOpen)}
                  className={`h-9 max-w-[8.5rem] flex items-center gap-2 px-2.5 rounded-lg bg-surface-container/70 border text-on-surface-variant hover:text-primary transition-colors ${
                    isLanguageMenuOpen ? 'border-primary/40 text-primary' : 'border-outline-variant/20'
                  }`}
                  aria-label={t('app.header.languageSelector')}
                  aria-haspopup="menu"
                  aria-expanded={isLanguageMenuOpen}
                  title={t('app.header.languageSelector')}
                >
                  <Languages className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-bold text-on-surface min-w-0 max-w-20 truncate text-left">{t(currentLanguage.labelKey)}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isLanguageMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {isLanguageMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      className="absolute right-0 top-11 z-50 w-44 rounded-xl border border-outline-variant/25 bg-surface-container-high shadow-2xl shadow-black/30 p-1.5"
                      role="menu"
                    >
                      {supportedLanguages.map((language) => (
                        <button
                          key={language.code}
                          type="button"
                          onClick={() => handleSetLanguage(language.code)}
                          className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                            i18n.language === language.code
                              ? 'bg-secondary-container/40 text-secondary'
                              : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5'
                          }`}
                          role="menuitem"
                        >
                          <span>{t(language.labelKey)}</span>
                          {i18n.language === language.code && <ShieldCheck className="w-3.5 h-3.5" />}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <button
                type="button"
                onClick={handleHeaderSync}
                className="text-on-surface-variant hover:text-primary transition-colors"
                title={t('app.header.localVaultSync')}
                aria-label={t('app.header.localVaultSync')}
              >
                <RefreshCw
                  className={`w-5 h-5 transition-transform duration-700 ${
                    isSyncing ? 'animate-spin text-primary' : ''
                  }`}
                />
              </button>
              <button
                type="button"
                onClick={() => setIsLogsModalOpen(true)}
                className="text-on-surface-variant hover:text-primary transition-colors"
                title={t('app.header.securityLog')}
                aria-label={t('app.header.securityLog')}
              >
                <UserRoundCheck className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setIsDatabaseModalOpen(true)}
                className="text-on-surface-variant hover:text-primary transition-colors"
                title={t('app.header.databaseManagement')}
                aria-label={t('app.header.databaseManagement')}
              >
                <Database className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleLock}
                className="text-on-surface-variant hover:text-error transition-colors"
                title={t('app.header.lockSafely')}
                aria-label={t('app.header.lockSafely')}
              >
                <Lock className="w-5 h-5" />
              </button>
            </div>
            <div className="h-6 w-px bg-outline-variant/30 hidden sm:block"></div>
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
          <div className={`p-4 md:p-8 space-y-6 md:space-y-10 w-full flex-1 overflow-y-auto overflow-x-hidden transition-all duration-300 ${
            selectedEntry && activeTab === 'vault' ? 'max-w-full md:max-w-[calc(100%-800px)]' : 'max-w-[1400px] mx-auto'
          }`}>
            <Suspense fallback={<div className="text-xs text-on-surface-variant/60">{t('app.dashboard.loading')}</div>}>
              {renderTabContent()}
            </Suspense>
          </div>

          {/* 1Password-style Detail Panel */}
          <AnimatePresence>
            {selectedEntry && activeTab === 'vault' && (
              <div className="fixed inset-x-0 top-[env(safe-area-inset-top)] bottom-[calc(4rem+env(safe-area-inset-bottom))] z-[90] bg-surface-container-lowest md:static md:inset-auto md:z-auto md:w-[800px] md:shrink-0 md:h-full">
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
            className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-4 right-4 md:bottom-8 md:left-8 md:right-auto bg-surface-container-high border border-primary/20 text-on-surface px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 z-[150] max-w-sm backdrop-blur-md"
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
          className={`fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] md:bottom-8 w-14 h-14 bg-secondary text-on-secondary rounded-full shadow-lg shadow-secondary/20 items-center justify-center z-[80] transition-all cursor-pointer ${
            selectedEntry ? 'hidden right-[820px] md:flex md:right-[820px]' : 'flex right-4 md:right-8'
          }`}
          aria-label={t('app.header.addRecordAria')}
        >
          <Plus className="w-7 h-7" />
        </motion.button>
      )}
    </div>
  );
}
