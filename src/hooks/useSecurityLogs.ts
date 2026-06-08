import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { SecurityLog } from '../components/SecurityLogsModal';
import { useAppState } from '../context/AppStateContext';
import { generateRandomString } from '../lib/crypto-types';

const SECURITY_LOG_STORAGE_KEY = 'aegis_security_logs';
const SECURITY_LOG_MAX_ENTRIES = 200;

const normalizeSecurityLogs = (logs: SecurityLog[]): SecurityLog[] => (
  logs
    .filter((log) => log && typeof log.action === 'string' && typeof log.timestamp === 'string')
    .slice(-SECURITY_LOG_MAX_ENTRIES)
);

export function useSecurityLogs() {
  const { t } = useTranslation();
  const {
    state: { logs },
    actions: { setLogs },
  } = useAppState();

  const persistLogs = useCallback((nextLogs: SecurityLog[]) => {
    const normalized = normalizeSecurityLogs(nextLogs);
    try {
      sessionStorage.setItem(SECURITY_LOG_STORAGE_KEY, JSON.stringify(normalized));
      localStorage.removeItem(SECURITY_LOG_STORAGE_KEY);
    } catch {
      // Security logs must never break the user flow.
    }
    return normalized;
  }, []);

  const addSecurityLog = useCallback((
    action: string,
    severity: SecurityLog['severity'] = 'info'
  ) => {
    setLogs((previousLogs) => {
      const newLog: SecurityLog = {
        id: `${Date.now()}${generateRandomString(6, 'abcdefghijklmnopqrstuvwxyz0123456789')}`,
        timestamp: new Date().toISOString(),
        action,
        severity,
      };

      return persistLogs([...previousLogs, newLog]);
    });
  }, [persistLogs, setLogs]);

  const clearLogs = useCallback((showToast: (message: string) => void) => {
    const freshLogs: SecurityLog[] = [
      {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        action: t('app.logs.logsClearedRecord'),
        severity: 'warning',
      },
    ];

    setLogs(persistLogs(freshLogs));
    showToast(t('app.logs.logsCleared'));
  }, [persistLogs, setLogs, t]);

  useEffect(() => {
    const savedLogs = localStorage.getItem(SECURITY_LOG_STORAGE_KEY)
      || sessionStorage.getItem(SECURITY_LOG_STORAGE_KEY);
    if (savedLogs) {
      try {
        setLogs(persistLogs(JSON.parse(savedLogs)));
      } catch {
        setLogs([{
          id: 'default',
          timestamp: new Date().toISOString(),
          action: t('app.logs.securityLogCreated'),
          severity: 'info',
        }]);
      }
      return;
    }

    const initialLogs: SecurityLog[] = [
      { id: '1', timestamp: new Date().toISOString(), action: t('app.logs.securityEngineStarted'), severity: 'info' },
      { id: '2', timestamp: new Date().toISOString(), action: t('app.logs.offlineSandboxVerified'), severity: 'info' },
    ];
    setLogs(persistLogs(initialLogs));
  }, [persistLogs, setLogs, t]);

  return {
    addSecurityLog,
    clearLogs,
    logs,
  };
}
