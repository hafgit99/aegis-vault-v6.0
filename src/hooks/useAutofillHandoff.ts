import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { NativeAutofillContext } from '../lib/autofillBridge';
import { clearPendingAndroidAutofillContext, readPendingAndroidAutofillContext } from '../lib/autofillNativeBridge';
import { getAndroidAutofillProviderResult } from '../lib/autofillProvider';
import { VaultEntry } from '../types';

interface UseAutofillHandoffArgs {
  entries: VaultEntry[];
  isLocked: boolean;
  onOpenEntry: (entry: VaultEntry) => void;
  showToast: (message: string) => void;
  addSecurityLog: (action: string, severity?: 'info' | 'warning' | 'critical') => void;
}

export function useAutofillHandoff({
  entries,
  isLocked,
  onOpenEntry,
  showToast,
  addSecurityLog,
}: UseAutofillHandoffArgs) {
  const { t } = useTranslation();
  const pendingContextRef = useRef<NativeAutofillContext | null>(null);
  const handledSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    readPendingAndroidAutofillContext()
      .then((context) => {
        if (cancelled || !context) return;
        pendingContextRef.current = context;
      })
      .catch((error) => {
        console.warn('Pending Android Autofill request could not be read.', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const context = pendingContextRef.current;
    if (!context) return;

    const signature = JSON.stringify({
      webDomain: context.webDomain,
      packageName: context.packageName,
      hints: context.formHints,
      isLocked,
      entryCount: entries.length,
    });
    if (handledSignatureRef.current === signature) return;
    handledSignatureRef.current = signature;

    const result = getAndroidAutofillProviderResult(context, entries, isLocked);

    if (result.status === 'locked') {
      showToast(t('app.autofill.locked', { target: result.targetLabel || t('app.autofill.thisApp') }));
      addSecurityLog(t('app.autofill.logs.locked', { target: result.targetLabel || t('app.autofill.thisApp') }), 'warning');
      return;
    }

    if (result.status === 'ready') {
      const candidate = result.candidates[0];
      const entry = entries.find((item) => item.id === candidate.id);
      if (entry) {
        onOpenEntry(entry);
        showToast(t('app.autofill.ready', { title: entry.title, target: result.targetLabel || candidate.domain }));
        addSecurityLog(t('app.autofill.logs.ready', { title: entry.title, target: result.targetLabel || candidate.domain }), 'info');
      }
      pendingContextRef.current = null;
      void clearPendingAndroidAutofillContext();
      return;
    }

    if (result.status === 'no-match') {
      showToast(t('app.autofill.noMatch', { target: result.targetLabel || t('app.autofill.thisApp') }));
      addSecurityLog(t('app.autofill.logs.noMatch', { target: result.targetLabel || t('app.autofill.thisApp') }), 'warning');
      pendingContextRef.current = null;
      void clearPendingAndroidAutofillContext();
      return;
    }

    pendingContextRef.current = null;
    void clearPendingAndroidAutofillContext();
  }, [addSecurityLog, entries, isLocked, onOpenEntry, showToast, t]);
}
