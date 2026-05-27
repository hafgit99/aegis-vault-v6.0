import { 
  ShieldCheck, 
  Lock, 
  ShieldAlert, 
  Key, 
  Settings, 
  Plus, 
  Power,
  Trash2,
  HeartHandshake
} from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onAddNewEntry?: () => void;
  onLock: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, onAddNewEntry, onLock }: SidebarProps) {
  const { t } = useTranslation();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 flex flex-col bg-surface-container-lowest border-r border-outline-variant/20 z-50">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-1">
          <ShieldCheck className="text-primary w-8 h-8" />
          <h1 className="text-headline-md text-on-surface font-outfit">AegisVault</h1>
        </div>
        <p className="text-label-caps text-on-tertiary-container opacity-70">{t('app.sidebar.localOnly')}</p>
      </div>

      <nav className="flex-1 px-4 py-2 space-y-1">
        {/* Vault */}
        <div 
          onClick={() => setActiveTab('vault')}
          className={`px-4 py-3 flex items-center gap-3 cursor-pointer transition-all duration-200 rounded-r-lg ${
            activeTab === 'vault' 
              ? 'bg-secondary-container/40 text-secondary border-l-4 border-tertiary' 
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30'
          }`}
        >
          <Lock className="w-5 h-5" />
          <span className="text-label-caps">{t('app.sidebar.vault')}</span>
        </div>
        
        {/* Security Audit */}
        <div 
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-3 flex items-center gap-3 cursor-pointer group transition-all duration-200 rounded-r-lg ${
            activeTab === 'audit' 
              ? 'bg-secondary-container/40 text-secondary border-l-4 border-tertiary' 
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30'
          }`}
        >
          <ShieldAlert className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span className="text-label-caps">{t('app.sidebar.securityAudit')}</span>
        </div>

        {/* Generator */}
        <div 
          onClick={() => setActiveTab('generator')}
          className={`px-4 py-3 flex items-center gap-3 cursor-pointer group transition-all duration-200 rounded-r-lg ${
            activeTab === 'generator' 
              ? 'bg-secondary-container/40 text-secondary border-l-4 border-tertiary' 
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30'
          }`}
        >
          <Key className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span className="text-label-caps">{t('app.sidebar.generator')}</span>
        </div>

        {/* Settings */}
        <div 
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-3 flex items-center gap-3 cursor-pointer group transition-all duration-200 rounded-r-lg ${
            activeTab === 'settings' 
              ? 'bg-secondary-container/40 text-secondary border-l-4 border-tertiary' 
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30'
          }`}
        >
          <Settings className="w-5 h-5 group-hover:rotate-45 transition-transform" />
          <span className="text-label-caps">{t('app.sidebar.settings')}</span>
        </div>

        {/* Trash */}
        <div 
          onClick={() => setActiveTab('trash')}
          className={`px-4 py-3 flex items-center gap-3 cursor-pointer group transition-all duration-200 rounded-r-lg ${
            activeTab === 'trash' 
              ? 'bg-secondary-container/40 text-secondary border-l-4 border-tertiary' 
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30'
          }`}
        >
          <Trash2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span className="text-label-caps">{t('app.sidebar.trash')}</span>
        </div>

        {/* Donate */}
        <div 
          onClick={() => setActiveTab('donate')}
          className={`px-4 py-3 flex items-center gap-3 cursor-pointer group transition-all duration-200 rounded-r-lg ${
            activeTab === 'donate' 
              ? 'bg-secondary-container/40 text-secondary border-l-4 border-tertiary' 
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30'
          }`}
        >
          <HeartHandshake className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span className="text-label-caps">{t('app.sidebar.donate')}</span>
        </div>
      </nav>

      <div className="p-4">
        <motion.button 
          whileTap={{ scale: 0.96 }}
          onClick={onAddNewEntry}
          className="w-full h-[52px] bg-primary text-on-primary rounded-xl text-item-title flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-lg shadow-primary/10"
        >
          <Plus className="w-5 h-5" />
          {t('app.sidebar.addEntry')}
        </motion.button>
      </div>

      <div className="mt-auto p-4 border-t border-outline-variant/10">
        <div className="text-error hover:bg-error-container/20 px-4 py-2 rounded-lg flex items-center gap-3 cursor-pointer group transition-colors"
             onClick={onLock}>
          <Power className="w-5 h-5 group-hover:text-error/80" />
          <span className="text-label-caps">{t('app.sidebar.lockVault')}</span>
        </div>
      </div>
    </aside>
  );
}
