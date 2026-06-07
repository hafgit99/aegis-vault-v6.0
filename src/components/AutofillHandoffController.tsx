import { useAutofillHandoff } from '../hooks/useAutofillHandoff';
import type { VaultEntry } from '../types';

interface AutofillHandoffControllerProps {
  entries: VaultEntry[];
  isLocked: boolean;
  onOpenEntry: (entry: VaultEntry) => void;
  showToast: (message: string) => void;
  addSecurityLog: (action: string, severity?: 'info' | 'warning' | 'critical') => void;
}

export default function AutofillHandoffController(props: AutofillHandoffControllerProps) {
  useAutofillHandoff(props);
  return null;
}
