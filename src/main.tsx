import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './i18n';
import { localizedMessage } from './i18n/localizedMessages';

// Global Air-Gap Network Blocker
(function enforceAirGap() {
  if (typeof window === 'undefined') return;
  try {
    const isAirGapActive = localStorage.getItem('aegis_airgap') !== 'false';
    if (!isAirGapActive) return;

    console.warn(localizedMessage('airgapActive'));

    // 1. Monkeypatch fetch
    const originalFetch = window.fetch;
    window.fetch = function (input, init) {
      let url = '';
      if (typeof input === 'string') {
        url = input;
      } else if (input instanceof URL) {
        url = input.href;
      } else if (input && typeof input === 'object' && 'url' in input) {
        url = (input as any).url;
      }

      const isLocal = !url ||
                      url.startsWith('/') || 
                      url.includes('localhost') || 
                      url.includes('127.0.0.1') || 
                      url.includes('::1') ||
                      url.startsWith('data:') ||
                      url.startsWith('blob:');

      if (!isLocal) {
        console.error(`[AegisVault Air-Gap] ${localizedMessage('networkBlocked')} ${url}`);
        return Promise.reject(new TypeError(localizedMessage('networkBlocked')));
      }
      return originalFetch.apply(this, arguments as any);
    };

    // 2. Monkeypatch XMLHttpRequest
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
      const urlStr = String(url);
      const isLocal = !urlStr ||
                      urlStr.startsWith('/') || 
                      urlStr.includes('localhost') || 
                      urlStr.includes('127.0.0.1') || 
                      urlStr.includes('::1') ||
                      urlStr.startsWith('data:') ||
                      urlStr.startsWith('blob:');

      if (!isLocal) {
        console.error(`[AegisVault Air-Gap] ${localizedMessage('networkBlocked')} ${urlStr}`);
        throw new Error(localizedMessage('networkBlocked'));
      }
      return originalOpen.apply(this, arguments as any);
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
