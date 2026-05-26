import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, UserRoundCheck, Terminal, AlertCircle, ShieldAlert, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface SecurityLog {
  id: string;
  timestamp: string;
  action: string;
  severity: 'info' | 'warning' | 'critical';
}

interface SecurityLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: SecurityLog[];
  onClearLogs: () => void;
}

export default function SecurityLogsModal({
  isOpen,
  onClose,
  logs,
  onClearLogs
}: SecurityLogsModalProps) {
  const { t, i18n } = useTranslation();
  
  // Reverse chronological sort (newest logs first)
  const sortedLogs = [...logs].reverse();

  const getSeverityStyles = (severity: 'info' | 'warning' | 'critical') => {
    switch (severity) {
      case 'critical':
        return {
          bg: 'bg-error/10 border-error/20',
          text: 'text-error',
          label: t('app.logsModal.severity.critical')
        };
      case 'warning':
        return {
          bg: 'bg-secondary/15 border-secondary/20',
          text: 'text-secondary',
          label: t('app.logsModal.severity.warning')
        };
      case 'info':
      default:
        return {
          bg: 'bg-tertiary/10 border-tertiary/20',
          text: 'text-tertiary',
          label: t('app.logsModal.severity.info')
        };
    }
  };

  const formatLogTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {
      return '00:00:00';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div id="security-logs-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-surface-container-high border border-white/10 rounded-[1.5rem] shadow-2xl p-6 overflow-hidden z-10"
          >
            {/* Ambient flare */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-12 bg-primary/10 rounded-full blur-2xl pointer-events-none" />

            {/* Title Bar */}
            <div className="flex justify-between items-center mb-5 relative z-10">
              <div className="flex items-center gap-2">
                <UserRoundCheck className="text-primary w-5 h-5" />
                <h3 className="text-title-medium font-outfit text-on-surface font-semibold">{t('app.logsModal.title')}</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-white/10 text-on-surface-variant transition-colors"
                aria-label={t('app.logsModal.close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Summary Block */}
            <div className="bg-surface-container-lowest/50 border border-white/5 p-3 rounded-xl flex items-center justify-between text-xs text-on-surface-variant mb-4 font-mono">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-secondary" />
                <span>{t('app.logsModal.accessType')} <strong>{t('app.logsModal.accessValue')}</strong></span>
              </div>
              <span>{t('app.logsModal.status')} <strong className="text-tertiary">{t('app.logsModal.statusOk')}</strong></span>
            </div>

            {/* Log List View */}
            <div className="space-y-3 relative z-10">
              <div className="flex justify-between items-center px-1">
                <span className="text-[11px] text-on-surface-variant/85 font-bold uppercase tracking-wider">{t('app.logsModal.timeline', { count: logs.length })}</span>
                {logs.length > 0 && (
                  <button
                    onClick={onClearLogs}
                    className="text-error hover:text-error/80 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {t('app.logsModal.clear')}
                  </button>
                )}
              </div>

              {/* Scrollable area */}
              <div className="max-h-[280px] overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                {sortedLogs.length > 0 ? (
                  sortedLogs.map((log) => {
                    const sev = getSeverityStyles(log.severity);
                    return (
                      <div
                        key={log.id}
                        className={`p-3 rounded-xl border flex gap-3 text-xs justify-between items-start transition-all hover:bg-white/[0.01] ${sev.bg}`}
                      >
                        <div className="flex gap-2.5 items-start">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold shrink-0 tracking-wide ${sev.text} bg-white/5 border border-white/5`}>
                            {sev.label}
                          </span>
                          <span className="text-on-surface leading-relaxed">{log.action}</span>
                        </div>
                        <span className="text-on-surface-variant/70 text-[10px] font-mono whitespace-nowrap shrink-0 mt-0.5">
                          {formatLogTime(log.timestamp)}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-10 text-center flex flex-col items-center gap-2.5 bg-surface-container/30 rounded-xl border border-dashed border-white/5">
                    <ShieldAlert className="w-6 h-6 text-on-surface-variant/40" />
                    <p className="text-xs text-on-surface-variant/60">{t('app.logsModal.empty')}</p>
                  </div>
                )}
              </div>

              {/* Warning Notice footer */}
              <div className="mt-4 p-3 bg-secondary/5 border border-secondary/10 rounded-xl flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                <p className="text-[11px] text-on-surface-variant/90 leading-relaxed">
                  {t('app.logsModal.notice')}
                </p>
              </div>

              <button
                onClick={onClose}
                className="w-full py-3 bg-surface-container-deep border border-white/10 hover:bg-white/5 text-on-surface font-bold rounded-xl text-sm transition-all focus:ring-1 focus:ring-white/10 active:scale-95 cursor-pointer"
              >
                {t('app.logsModal.close')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
