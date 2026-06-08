import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import i18n from '../src/i18n';

const webCrypto = globalThis.crypto;

vi.mock('react-qr-code', async () => {
  const React = await import('react');

  return {
    default: ({ title }: { title?: string; value?: string }) => React.createElement(
      'svg',
      {
        'aria-label': title || 'QR code',
        'data-testid': 'qr-code',
        role: 'img',
      },
    ),
  };
});

Object.defineProperty(window, 'crypto', {
  configurable: true,
  value: webCrypto,
});

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

Object.defineProperty(navigator, 'clipboard', {
  configurable: true,
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

Object.defineProperty(window, 'scrollTo', {
  configurable: true,
  value: vi.fn(),
});

beforeEach(async () => {
  localStorage.clear();
  document.documentElement.lang = 'tr';
  await i18n.changeLanguage('tr');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
