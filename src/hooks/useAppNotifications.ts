import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CLIPBOARD_CLEAR_FAILED_EVENT, CLIPBOARD_SENSITIVE_FLAG_FAILED_EVENT } from '../lib/clipboard';
import { useAppState } from '../context/AppStateContext';
import type { SecurityLog } from '../components/SecurityLogsModal';

export function useAppNotifications(
  addSecurityLog: (action: string, severity?: SecurityLog['severity']) => void
) {
  const { t } = useTranslation();
  const {
    state: { toastMessage },
    actions: { setToastMessage },
  } = useAppState();

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
  }, [setToastMessage]);

  useEffect(() => {
    const handleClipboardClearFailure = () => {
      addSecurityLog(t('app.logs.clipboardClearFailed'), 'warning');
      showToast(t('app.logs.clipboardClearFailedToast'));
    };

    window.addEventListener(CLIPBOARD_CLEAR_FAILED_EVENT, handleClipboardClearFailure);
    const handleSensitiveFlagFailure = () => {
      addSecurityLog(t('app.logs.clipboardSensitiveFlagFailed'), 'warning');
    };

    window.addEventListener(CLIPBOARD_SENSITIVE_FLAG_FAILED_EVENT, handleSensitiveFlagFailure);
    return () => {
      window.removeEventListener(CLIPBOARD_CLEAR_FAILED_EVENT, handleClipboardClearFailure);
      window.removeEventListener(CLIPBOARD_SENSITIVE_FLAG_FAILED_EVENT, handleSensitiveFlagFailure);
    };
  }, [addSecurityLog, showToast, t]);

  useEffect(() => {
    if (!toastMessage) return undefined;

    const timer = window.setTimeout(() => {
      setToastMessage(null);
    }, 3500);

    return () => window.clearTimeout(timer);
  }, [setToastMessage, toastMessage]);

  return {
    showToast,
    toastMessage,
  };
}
