import { useState } from 'react';
import { Trash2, RotateCcw, AlertTriangle, ShieldCheck, HelpCircle, Calendar, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { VaultEntry } from '../types';

interface TrashBinProps {
  entries: VaultEntry[];
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  onClearTrash: () => void;
}

export default function TrashBin({ entries, onRestore, onPermanentDelete, onClearTrash }: TrashBinProps) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');

  // Get trash entries
  const trashEntries = entries.filter(e => e.isDeleted);

  const calculateDaysRemaining = (deletedAt?: string) => {
    if (!deletedAt) return 15;
    const deletedDate = new Date(deletedAt).getTime();
    const currentDate = new Date().getTime();
    const elapsedDays = Math.floor((currentDate - deletedDate) / (1000 * 60 * 60 * 24));
    const remaining = 15 - elapsedDays;
    return Math.max(0, remaining);
  };

  const filteredTrash = trashEntries.filter(e => 
    e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.subtitle && e.subtitle.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Search & Header */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:justify-between md:items-center gap-4"
      >
        <div>
          <h2 className="text-display-lg text-on-surface mb-2 font-outfit tracking-tight">{t('app.trash.title')}</h2>
          <div className="flex items-center gap-2 text-error bg-error/15 border border-error/25 rounded-lg px-3 py-1.5 w-max">
            <Calendar className="w-4 h-4 text-error" />
            <span className="text-xs font-bold tracking-wide uppercase">{t('app.trash.retention')}</span>
          </div>
        </div>

        {trashEntries.length > 0 && (
          <button
            onClick={() => {
              if (confirm(t('app.trash.clearConfirm'))) {
                onClearTrash();
              }
            }}
            className="self-start md:self-center py-2.5 px-5 bg-error-container/25 hover:bg-error-container/45 border border-error/20 text-error rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95 text-xs cursor-pointer select-none"
          >
            <Trash2 className="w-4 h-4" />
            {t('app.trash.clearAll')}
          </button>
        )}
      </motion.div>

      {/* Info Warning banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-surface-container-high/40 border border-white/5 p-4 rounded-xl flex gap-3 text-sm text-on-surface-variant backdrop-blur-md"
      >
        <AlertTriangle className="text-secondary w-5 h-5 shrink-0 mt-0.5" />
        <p className="leading-relaxed text-xs">
          <strong className="text-secondary block mb-1">{t('app.trash.serviceTitle')}</strong>
          {t('app.trash.serviceBefore')} <span className="text-secondary font-semibold">{t('app.trash.restoreInline')}</span> {t('app.trash.serviceMiddle')} <span className="text-error font-semibold">{t('app.trash.permanentInline')}</span> {t('app.trash.serviceAfter')}
        </p>
      </motion.div>

      {/* Search Input inline */}
      {trashEntries.length > 0 && (
        <div className="relative max-w-md">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface-container/50 rounded-lg border border-transparent focus:border-tertiary/30 focus:ring-1 focus:ring-tertiary/50 pl-4 pr-10 text-body-base text-on-surface placeholder:text-on-surface-variant/40 h-10 transition-all outline-none text-sm"
            placeholder={t('app.trash.searchPlaceholder')}
          />
        </div>
      )}

      {/* Trash items list */}
      <div className="space-y-3">
        {filteredTrash.length > 0 ? (
          <AnimatePresence mode="popLayout">
            {filteredTrash.map((entry, index) => {
              const daysLeft = calculateDaysRemaining(entry.deletedAt);
              return (
                <motion.div
                  key={entry.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: Math.min(0.2, index * 0.05) }}
                  className="glass-panel p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-outline-variant/10 hover:border-error/20 transition-all duration-300 group"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="w-1.5 h-10 bg-error rounded-full shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-item-title text-on-surface truncate font-semibold">{entry.title}</h4>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-error-container/20 text-error border border-error/10 uppercase select-none">
                          {entry.type === 'login' ? t('app.trash.typeLogin') : entry.type === 'card' ? t('app.trash.typeCard') : t('app.trash.typeNote')}
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant font-geist-mono truncate mt-0.5">
                        {entry.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 border-white/5 pt-3 sm:pt-0">
                    {/* Days Left badge */}
                    <div className="flex items-center gap-1.5 bg-white/5 border border-white/5 px-3 py-1.5 rounded-lg select-none">
                      <span className="text-xs font-bold text-error/95">{t('app.trash.daysLeft', { count: daysLeft })}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Restore option */}
                      <button
                        onClick={() => onRestore(entry.id)}
                        className="p-2 bg-secondary/10 hover:bg-secondary/20 border border-secondary/15 text-secondary rounded-lg transition-all active:scale-95 cursor-pointer flex items-center gap-1 text-xs font-semibold"
                        title={t('app.trash.restoreTitle')}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">{t('app.trash.restore')}</span>
                      </button>

                      {/* Permanent Delete option */}
                      <button
                        onClick={() => {
                          if (confirm(t('app.trash.deleteConfirm', { title: entry.title }))) {
                            onPermanentDelete(entry.id);
                          }
                        }}
                        className="p-2 bg-error/10 hover:bg-error/20 border border-error/15 text-error rounded-lg transition-all active:scale-95 cursor-pointer flex items-center gap-1 text-xs font-semibold"
                        title={t('app.trash.deleteTitle')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">{t('app.trash.delete')}</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        ) : (
              <div className="glass-panel p-8 md:p-12 rounded-[1.25rem] text-center border-dashed border-white/10 flex flex-col items-center justify-center space-y-3">
            <Trash2 className="w-8 h-8 text-on-surface-variant/30 animate-pulse" />
            <div>
              <h4 className="font-semibold text-on-surface text-base">{t('app.trash.emptyTitle')}</h4>
              <p className="text-xs text-on-surface-variant/60 mt-1 max-w-sm mx-auto">
                {t('app.trash.emptyDescription')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
