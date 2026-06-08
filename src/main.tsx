import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './i18n';
import { localizedMessage } from './i18n/localizedMessages';
import { isAllowedAirGapRequestUrl } from './lib/airgapNetworkPolicy';

const isAirGapPolicyLocked = (): boolean => (
  import.meta.env.VITE_AEGIS_AIRGAP_LOCKED !== 'false'
);

const isAirGapActive = (): boolean => (
  isAirGapPolicyLocked() || localStorage.getItem('aegis_airgap') !== 'false'
);

const getRequestUrl = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
};

// Global Air-Gap Network Blocker
(function enforceAirGap() {
  if (typeof window === 'undefined') return;
  try {
    if (!isAirGapActive()) return;

    console.warn(localizedMessage('airgapActive'));

    // 1. Monkeypatch fetch
    const originalFetch = window.fetch;
    window.fetch = function (input, init) {
      const url = getRequestUrl(input);

      if (!isAllowedAirGapRequestUrl(url)) {
        console.error(`[AegisVault Air-Gap] ${localizedMessage('networkBlocked')} ${url}`);
        return Promise.reject(new TypeError(localizedMessage('networkBlocked')));
      }
      return originalFetch.call(this, input, init);
    };

    // 2. Monkeypatch XMLHttpRequest
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (
      method: string,
      url: string | URL,
      async?: boolean,
      username?: string | null,
      password?: string | null
    ) {
      const urlStr = String(url);
      if (!isAllowedAirGapRequestUrl(urlStr)) {
        console.error(`[AegisVault Air-Gap] ${localizedMessage('networkBlocked')} ${urlStr}`);
        throw new Error(localizedMessage('networkBlocked'));
      }
      return originalOpen.call(this, method, url, async ?? true, username, password);
    };
  } catch (e) {
    console.error(localizedMessage('airgapError'), e);
  }
})();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
