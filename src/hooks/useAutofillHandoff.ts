import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NativeAutofillContext } from '../lib/autofillBridge';
import {
  clearPendingAndroidAutofillSaveRequest,
  clearPendingAndroidAutofillContext,
  createApprovedAndroidAutofillPayload,
  readPendingAndroidAutofillSaveRequest,
  readPendingAndroidAutofillContext,
  writeApprovedAndroidAutofillPayload,
  writeCanceledAndroidAutofillPayload,
  type PendingAndroidAutofillSaveRequest,
} from '../lib/autofillNativeBridge';
import { getAndroidAutofillProviderResult } from '../lib/autofillProvider';
import { normalizeAutofillDomain, type AutofillCandidate } from '../lib/autofillMatcher';
import { VaultEntry } from '../types';

interface UseAutofillHandoffArgs {
  entries: VaultEntry[];
  isLocked: boolean;
  onOpenEntry: (entry: VaultEntry) => void;
  onSaveAutofillEntry?: (entry: VaultEntry) => void | Promise<void>;
  onUpdateAutofillEntry?: (entry: VaultEntry) => void | Promise<void>;
  showToast: (message: string) => void;
  addSecurityLog: (action: string, severity?: 'info' | 'warning' | 'critical') => void;
}

export interface AutofillSelectionOption {
  candidate: AutofillCandidate;
  entry: VaultEntry;
}

export interface AutofillSelectionRequest {
  context: NativeAutofillContext;
  targetLabel: string;
  options: AutofillSelectionOption[];
}

export interface AutofillSaveRequest {
  request: PendingAndroidAutofillSaveRequest;
  targetLabel: string;
  existingEntry: VaultEntry | null;
}

function targetLabelForSaveRequest(request: PendingAndroidAutofillSaveRequest): string {
  return request.webDomain?.trim() || request.origin?.trim() || request.packageName?.trim() || 'this sign-in form';
}

function findExistingSaveTarget(
  entries: VaultEntry[],
  request: PendingAndroidAutofillSaveRequest,
): VaultEntry | null {
  const username = request.username.trim().toLowerCase();
  const requestDomain = normalizeAutofillDomain(request.webDomain || request.origin || '');
  if (!username || !requestDomain) return null;

  return entries.find((entry) => (
    !entry.isDeleted &&
    !entry.deletedAt &&
    entry.type === 'login' &&
    entry.username.trim().toLowerCase() === username &&
    normalizeAutofillDomain(entry.url || '') === requestDomain
  )) || null;
}

function createEntryFromSaveRequest(
  request: PendingAndroidAutofillSaveRequest,
  now = Date.now(),
): VaultEntry {
  const targetLabel = targetLabelForSaveRequest(request);
  const webDomain = request.webDomain?.trim() || normalizeAutofillDomain(request.origin || '');

  return {
    id: `autofill-${now}`,
    title: webDomain || targetLabel,
    subtitle: request.username || targetLabel,
    username: request.username,
    password: request.password,
    url: webDomain ? `https://${webDomain}` : undefined,
    strength: request.password.length >= 16 ? 'EXCELLENT' : 'GOOD',
    themeColor: 'primary',
    type: 'login',
    createdAt: new Date(now).toISOString(),
  };
}

export function useAutofillHandoff({
  entries,
  isLocked,
  onOpenEntry,
  onSaveAutofillEntry,
  onUpdateAutofillEntry,
  showToast,
  addSecurityLog,
}: UseAutofillHandoffArgs) {
  const { t } = useTranslation();
  const [pendingContext, setPendingContext] = useState<NativeAutofillContext | null>(null);
  const [selectionRequest, setSelectionRequest] = useState<AutofillSelectionRequest | null>(null);
  const [saveRequest, setSaveRequest] = useState<AutofillSaveRequest | null>(null);
  const handledSignatureRef = useRef<string | null>(null);
  const handledSaveSignatureRef = useRef<string | null>(null);
  const readInFlightRef = useRef(false);
  const entriesRef = useRef(entries);
  const isLockedRef = useRef(isLocked);

  useEffect(() => {
    entriesRef.current = entries;
    isLockedRef.current = isLocked;
  }, [entries, isLocked]);

  useEffect(() => {
    let cancelled = false;

    const refreshPendingContext = () => {
      if (readInFlightRef.current) return;
      readInFlightRef.current = true;

      Promise.all([
        readPendingAndroidAutofillContext(),
        readPendingAndroidAutofillSaveRequest(),
      ])
        .then(([context, pendingSave]) => {
          if (cancelled) return;
          if (context) setPendingContext(context);
          if (pendingSave && !isLockedRef.current) {
            setSaveRequest({
              request: pendingSave,
              targetLabel: targetLabelForSaveRequest(pendingSave),
              existingEntry: findExistingSaveTarget(entriesRef.current, pendingSave),
            });
          }
        })
        .catch((error) => {
          console.warn('Pending Android Autofill request could not be read.', error);
        })
        .finally(() => {
          readInFlightRef.current = false;
        });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshPendingContext();
      }
    };

    refreshPendingContext();
    window.addEventListener('focus', refreshPendingContext);
    window.addEventListener('pageshow', refreshPendingContext);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', refreshPendingContext);
      window.removeEventListener('pageshow', refreshPendingContext);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!saveRequest) return;
    const signature = JSON.stringify({
      target: saveRequest.targetLabel,
      username: saveRequest.request.username,
      expiresAt: saveRequest.request.expiresAt,
      existingId: saveRequest.existingEntry?.id || null,
    });
    if (handledSaveSignatureRef.current === signature) return;
    handledSaveSignatureRef.current = signature;

    addSecurityLog(t('app.autofill.save.logs.detected', { target: saveRequest.targetLabel }), 'warning');
  }, [addSecurityLog, saveRequest, t]);

  useEffect(() => {
    const context = pendingContext;
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
    const targetLabel = result.targetLabel || t('app.autofill.thisApp');

    const approveEntry = (entry: VaultEntry, candidate: AutofillCandidate) => {
      const payload = createApprovedAndroidAutofillPayload(context, entry);
      if (payload) {
        void writeApprovedAndroidAutofillPayload(payload)
          .then((written) => {
            if (written) {
              showToast(t('app.autofill.approved', { title: entry.title, target: targetLabel }));
              addSecurityLog(t('app.autofill.logs.approved', { title: entry.title, target: targetLabel }), 'info');
            } else {
              showToast(t('app.autofill.ready', { title: entry.title, target: targetLabel }));
              addSecurityLog(t('app.autofill.logs.ready', { title: entry.title, target: targetLabel }), 'info');
            }
          })
          .catch((error) => {
            console.warn('Approved Android Autofill payload could not be written.', error);
            showToast(t('app.autofill.ready', { title: entry.title, target: targetLabel }));
          })
          .finally(() => {
            void clearPendingAndroidAutofillContext();
          });
      } else {
        onOpenEntry(entry);
        showToast(t('app.autofill.ready', { title: entry.title, target: targetLabel || candidate.domain }));
        addSecurityLog(t('app.autofill.logs.ready', { title: entry.title, target: targetLabel || candidate.domain }), 'info');
        void clearPendingAndroidAutofillContext();
      }
    };

    if (result.status === 'locked') {
      showToast(t('app.autofill.locked', { target: targetLabel }));
      addSecurityLog(t('app.autofill.logs.locked', { target: targetLabel }), 'warning');
      return;
    }

    if (result.status === 'ready') {
      const options = result.candidates
        .map((candidate) => {
          const entry = entries.find((item) => item.id === candidate.id);
          return entry ? { candidate, entry } : null;
        })
        .filter((option): option is AutofillSelectionOption => option !== null);

      if (options.length > 1) {
        setSelectionRequest({ context, targetLabel, options });
      } else if (options.length === 1) {
        approveEntry(options[0].entry, options[0].candidate);
      }
      setPendingContext(null);
      return;
    }

    if (result.status === 'no-match') {
      showToast(t('app.autofill.noMatch', { target: targetLabel }));
      addSecurityLog(t('app.autofill.logs.noMatch', { target: targetLabel }), 'warning');
      setPendingContext(null);
      void clearPendingAndroidAutofillContext();
      return;
    }

    setPendingContext(null);
    void clearPendingAndroidAutofillContext();
  }, [addSecurityLog, entries, isLocked, onOpenEntry, pendingContext, showToast, t]);

  const approveAutofillEntry = (option: AutofillSelectionOption) => {
    if (!selectionRequest) return;
    const payload = createApprovedAndroidAutofillPayload(selectionRequest.context, option.entry);
    if (!payload) {
      onOpenEntry(option.entry);
      showToast(t('app.autofill.ready', { title: option.entry.title, target: selectionRequest.targetLabel || option.candidate.domain }));
      addSecurityLog(t('app.autofill.logs.ready', { title: option.entry.title, target: selectionRequest.targetLabel || option.candidate.domain }), 'info');
      setSelectionRequest(null);
      void clearPendingAndroidAutofillContext();
      return;
    }

    setSelectionRequest(null);
    void writeApprovedAndroidAutofillPayload(payload)
      .then((written) => {
        if (written) {
          showToast(t('app.autofill.approved', { title: option.entry.title, target: selectionRequest.targetLabel || option.candidate.domain }));
          addSecurityLog(t('app.autofill.logs.approved', { title: option.entry.title, target: selectionRequest.targetLabel || option.candidate.domain }), 'info');
        } else {
          showToast(t('app.autofill.ready', { title: option.entry.title, target: selectionRequest.targetLabel || option.candidate.domain }));
          addSecurityLog(t('app.autofill.logs.ready', { title: option.entry.title, target: selectionRequest.targetLabel || option.candidate.domain }), 'info');
        }
      })
      .catch((error) => {
        console.warn('Approved Android Autofill payload could not be written.', error);
        showToast(t('app.autofill.ready', { title: option.entry.title, target: selectionRequest.targetLabel || option.candidate.domain }));
      })
      .finally(() => {
        void clearPendingAndroidAutofillContext();
      });
  };

  const cancelAutofillSelection = () => {
    if (selectionRequest) {
      void writeCanceledAndroidAutofillPayload(selectionRequest.context)
        .finally(() => {
          void clearPendingAndroidAutofillContext();
        });
    } else {
      void clearPendingAndroidAutofillContext();
    }
    setSelectionRequest(null);
  };

  const createAutofillSaveEntry = async () => {
    if (!saveRequest || !onSaveAutofillEntry) return;
    const entry = createEntryFromSaveRequest(saveRequest.request);
    setSaveRequest(null);
    await onSaveAutofillEntry(entry);
    showToast(t('app.autofill.save.created', { target: saveRequest.targetLabel }));
    addSecurityLog(t('app.autofill.save.logs.created', { target: saveRequest.targetLabel }), 'info');
    void clearPendingAndroidAutofillSaveRequest();
  };

  const updateAutofillSaveEntry = async () => {
    if (!saveRequest || !saveRequest.existingEntry || !onUpdateAutofillEntry) return;
    const updatedEntry: VaultEntry = {
      ...saveRequest.existingEntry,
      username: saveRequest.request.username || saveRequest.existingEntry.username,
      subtitle: saveRequest.request.username || saveRequest.existingEntry.subtitle,
      password: saveRequest.request.password,
      url: saveRequest.request.webDomain
        ? `https://${saveRequest.request.webDomain}`
        : saveRequest.request.origin || saveRequest.existingEntry.url,
    };
    setSaveRequest(null);
    await onUpdateAutofillEntry(updatedEntry);
    showToast(t('app.autofill.save.updated', { target: saveRequest.targetLabel }));
    addSecurityLog(t('app.autofill.save.logs.updated', { target: saveRequest.targetLabel }), 'info');
    void clearPendingAndroidAutofillSaveRequest();
  };

  const cancelAutofillSave = () => {
    if (saveRequest) {
      addSecurityLog(t('app.autofill.save.logs.canceled', { target: saveRequest.targetLabel }), 'info');
    }
    setSaveRequest(null);
    void clearPendingAndroidAutofillSaveRequest();
  };

  return {
    selectionRequest,
    saveRequest,
    approveAutofillEntry,
    cancelAutofillSelection,
    createAutofillSaveEntry,
    updateAutofillSaveEntry,
    cancelAutofillSave,
  };
}
