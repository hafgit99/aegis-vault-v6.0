import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { SecurityLog } from '../components/SecurityLogsModal';

interface UseAutoLockArgs {
  isLocked: boolean;
  onLock: () => void;
  addSecurityLog: (action: string, severity?: SecurityLog['severity']) => void;
}

export function useAutoLock({ isLocked, onLock, addSecurityLog }: UseAutoLockArgs) {
  const { t } = useTranslation();

  useEffect(() => {
    if (isLocked) return undefined;

    let timeoutId: number | undefined;

    const resetTimer = () => {
      if (timeoutId) window.clearTimeout(timeoutId);

      const autoLockVal = localStorage.getItem('aegis_auto_lock') || '5';
      if (autoLockVal === 'never') return;

      const minutes = parseInt(autoLockVal, 10) || 5;
      const ms = minutes * 60 * 1000;

      timeoutId = window.setTimeout(() => {
        onLock();
        addSecurityLog(t('app.logs.autoLockTriggered', { minutes }), 'warning');
      }, ms);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    let lastActivityTime = 0;

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastActivityTime > 1000) {
        lastActivityTime = now;
        resetTimer();
      }
    };

    resetTimer();
    events.forEach((eventName) => window.addEventListener(eventName, handleActivity, { passive: true }));

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      events.forEach((eventName) => window.removeEventListener(eventName, handleActivity));
    };
  }, [addSecurityLog, isLocked, onLock, t]);
}
