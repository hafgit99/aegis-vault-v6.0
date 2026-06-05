import { useState } from 'react';

interface UseWipeResetOptions {
  onReset: () => void;
}

export function useWipeReset({ onReset }: UseWipeResetOptions) {
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState('');
  const [wipeSuccessMsg, setWipeSuccessMsg] = useState(false);

  const startWipeConfirmation = () => {
    setShowWipeConfirm(true);
    setWipeConfirmText('');
  };

  const cancelWipeConfirmation = () => {
    setShowWipeConfirm(false);
    setWipeConfirmText('');
  };

  const acknowledgeWipeSuccess = () => {
    setWipeSuccessMsg(false);
  };

  const executeWipe = () => {
    onReset();
    setShowWipeConfirm(false);
    setWipeConfirmText('');
    setWipeSuccessMsg(true);
  };

  return {
    showWipeConfirm,
    wipeConfirmText,
    setWipeConfirmText,
    wipeSuccessMsg,
    startWipeConfirmation,
    cancelWipeConfirmation,
    acknowledgeWipeSuccess,
    executeWipe,
  };
}
