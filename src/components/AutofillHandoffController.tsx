import { useAutofillHandoff } from '../hooks/useAutofillHandoff';
import type { VaultEntry } from '../types';
import { CheckCircle2, KeyRound, Save, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AutofillHandoffControllerProps {
  entries: VaultEntry[];
  isLocked: boolean;
  onOpenEntry: (entry: VaultEntry) => void;
  onSaveAutofillEntry?: (entry: VaultEntry) => void | Promise<void>;
  onUpdateAutofillEntry?: (entry: VaultEntry) => void | Promise<void>;
  showToast: (message: string) => void;
  addSecurityLog: (action: string, severity?: 'info' | 'warning' | 'critical') => void;
}

export default function AutofillHandoffController(props: AutofillHandoffControllerProps) {
  const { t } = useTranslation();
  const {
    selectionRequest,
    saveRequest,
    approveAutofillEntry,
    cancelAutofillSelection,
    createAutofillSaveEntry,
    updateAutofillSaveEntry,
    cancelAutofillSave,
  } = useAutofillHandoff(props);

  if (!selectionRequest && !saveRequest) return null;

  if (saveRequest) {
    return (
      <div className="fixed inset-0 z-[180] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4">
        <div className="w-full max-w-lg rounded-t-2xl border border-outline-variant/40 bg-surface-container-high shadow-2xl shadow-black/40 sm:rounded-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-outline-variant/30 px-4 py-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-secondary/20 bg-secondary/10 text-secondary">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-outfit text-base font-bold text-on-surface">
                  {t('app.autofill.save.title')}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                  {t('app.autofill.save.description', { target: saveRequest.targetLabel })}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={cancelAutofillSave}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-outline-variant/40 bg-surface-container-low text-on-surface-variant transition-colors hover:text-on-surface"
              aria-label={t('app.autofill.cancel')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3 px-4 py-4">
            <div className="rounded-xl border border-outline-variant/35 bg-surface-container-low p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                {t('app.autofill.save.target')}
              </p>
              <p className="mt-1 truncate font-geist-mono text-sm text-on-surface">{saveRequest.targetLabel}</p>
              {saveRequest.request.username && (
                <>
                  <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                    {t('app.autofill.save.username')}
                  </p>
                  <p className="mt-1 truncate font-geist-mono text-sm text-on-surface">{saveRequest.request.username}</p>
                </>
              )}
            </div>
            <div className="rounded-xl border border-secondary/20 bg-secondary/10 p-3 text-xs leading-relaxed text-on-surface-variant">
              {saveRequest.existingEntry
                ? t('app.autofill.save.updateHint', { title: saveRequest.existingEntry.title })
                : t('app.autofill.save.createHint')}
            </div>
          </div>

          <div className="grid gap-2 border-t border-outline-variant/30 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 sm:grid-cols-2 sm:pb-4">
            {saveRequest.existingEntry ? (
              <button
                type="button"
                onClick={updateAutofillSaveEntry}
                className="flex items-center justify-center gap-2 rounded-xl border border-tertiary/30 bg-tertiary/15 px-4 py-3 text-sm font-bold text-tertiary transition-colors hover:bg-tertiary/20"
              >
                <Save className="h-4 w-4" />
                {t('app.autofill.save.update')}
              </button>
            ) : (
              <button
                type="button"
                onClick={createAutofillSaveEntry}
                className="flex items-center justify-center gap-2 rounded-xl border border-tertiary/30 bg-tertiary/15 px-4 py-3 text-sm font-bold text-tertiary transition-colors hover:bg-tertiary/20"
              >
                <Save className="h-4 w-4" />
                {t('app.autofill.save.create')}
              </button>
            )}
            <button
              type="button"
              onClick={cancelAutofillSave}
              className="rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm font-bold text-on-surface-variant transition-colors hover:text-on-surface"
            >
              {t('app.autofill.cancel')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activeSelectionRequest = selectionRequest;
  if (!activeSelectionRequest) return null;

  return (
    <div className="fixed inset-0 z-[180] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-lg rounded-t-2xl border border-outline-variant/40 bg-surface-container-high shadow-2xl shadow-black/40 sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-outline-variant/30 px-4 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-tertiary/20 bg-tertiary/10 text-tertiary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-outfit text-base font-bold text-on-surface">
                {t('app.autofill.selectionTitle')}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                {t('app.autofill.selectionDescription', { target: activeSelectionRequest.targetLabel })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={cancelAutofillSelection}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-outline-variant/40 bg-surface-container-low text-on-surface-variant transition-colors hover:text-on-surface"
            aria-label={t('app.autofill.cancel')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto px-3 py-3">
          <div className="space-y-2">
            {activeSelectionRequest.options.map((option) => (
              <button
                key={option.entry.id}
                type="button"
                onClick={() => approveAutofillEntry(option)}
                className="flex w-full items-center gap-3 rounded-xl border border-outline-variant/35 bg-surface-container-low px-3 py-3 text-left transition-colors hover:border-tertiary/40 hover:bg-tertiary/10"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-surface-container text-tertiary">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-bold text-on-surface">{option.entry.title}</span>
                    <span className="rounded-full border border-tertiary/15 bg-tertiary/10 px-2 py-0.5 text-[10px] font-bold text-tertiary">
                      {option.candidate.score}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate font-geist-mono text-xs text-on-surface-variant">
                    {option.candidate.username || option.entry.subtitle || option.candidate.domain}
                  </p>
                </div>
                <CheckCircle2 className="h-5 w-5 shrink-0 text-on-surface-variant" />
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-outline-variant/30 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 sm:pb-4">
          <button
            type="button"
            onClick={cancelAutofillSelection}
            className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm font-bold text-on-surface-variant transition-colors hover:text-on-surface"
          >
            {t('app.autofill.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
