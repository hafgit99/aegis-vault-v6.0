import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AutofillHandoffController from '../../src/components/AutofillHandoffController';
import type { AutofillSaveRequest, AutofillSelectionOption, AutofillSelectionRequest } from '../../src/hooks/useAutofillHandoff';
import type { VaultEntry } from '../../src/types';

const approveAutofillEntry = vi.hoisted(() => vi.fn());
const cancelAutofillSelection = vi.hoisted(() => vi.fn());
const createAutofillSaveEntry = vi.hoisted(() => vi.fn());
const updateAutofillSaveEntry = vi.hoisted(() => vi.fn());
const cancelAutofillSave = vi.hoisted(() => vi.fn());
let selectionRequestMock = vi.hoisted<AutofillSelectionRequest | null>(() => null);
let saveRequestMock = vi.hoisted<AutofillSaveRequest | null>(() => null);

vi.mock('../../src/hooks/useAutofillHandoff', () => ({
  useAutofillHandoff: vi.fn(() => ({
    selectionRequest: selectionRequestMock,
    saveRequest: saveRequestMock,
    approveAutofillEntry,
    cancelAutofillSelection,
    createAutofillSaveEntry,
    updateAutofillSaveEntry,
    cancelAutofillSave,
  })),
}));

const entry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
  id: overrides.id ?? 'entry-1',
  title: overrides.title ?? 'GitHub Personal',
  subtitle: overrides.subtitle ?? 'octo@example.com',
  username: overrides.username ?? 'octo@example.com',
  password: overrides.password ?? 'Secret123!',
  url: overrides.url ?? 'https://github.com/login',
  strength: overrides.strength ?? 'EXCELLENT',
  themeColor: overrides.themeColor ?? 'primary',
  type: overrides.type ?? 'login',
  createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const option = (item: VaultEntry, score: number): AutofillSelectionOption => ({
  entry: item,
  candidate: {
    id: item.id,
    title: item.title,
    username: item.username,
    domain: item.url?.replace(/^https?:\/\//, '').split('/')[0] || 'github.com',
    score,
    reason: 'exact-domain',
    hasPassword: true,
    hasTotp: false,
  },
});

const baseProps = {
  entries: [] as VaultEntry[],
  isLocked: false,
  onOpenEntry: vi.fn(),
  showToast: vi.fn(),
  addSecurityLog: vi.fn(),
};

describe('AutofillHandoffController', () => {
  beforeEach(() => {
    approveAutofillEntry.mockReset();
    cancelAutofillSelection.mockReset();
    createAutofillSaveEntry.mockReset();
    updateAutofillSaveEntry.mockReset();
    cancelAutofillSave.mockReset();
    selectionRequestMock = null;
    saveRequestMock = null;
  });

  it('renders nothing when there is no active Autofill selection request', () => {
    const { container } = render(<AutofillHandoffController {...baseProps} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders multiple Autofill choices and approves the selected record', async () => {
    const personal = entry({ id: 'entry-1', title: 'GitHub Personal', username: 'octo@example.com' });
    const work = entry({ id: 'entry-2', title: 'GitHub Work', username: 'work@example.com' });
    selectionRequestMock = {
      context: {
        platform: 'android',
        webDomain: 'github.com',
        packageName: 'com.android.chrome',
        hasUsernameField: true,
        hasPasswordField: true,
      },
      targetLabel: 'github.com',
      options: [option(personal, 100), option(work, 86)],
    };

    render(<AutofillHandoffController {...baseProps} />);

    expect(screen.getByRole('heading', { name: /Doldurulacak kaydı seçin/i })).toBeInTheDocument();
    expect(screen.getByText(/github\.com için birden fazla güvenli eşleşme bulundu/i)).toBeInTheDocument();
    expect(screen.getByText('GitHub Personal')).toBeInTheDocument();
    expect(screen.getByText('octo@example.com')).toBeInTheDocument();
    expect(screen.getByText('GitHub Work')).toBeInTheDocument();
    expect(screen.getByText('work@example.com')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /GitHub Work/i }));

    expect(approveAutofillEntry).toHaveBeenCalledWith(selectionRequestMock.options[1]);
  });

  it('cancels the active Autofill selection from either close control', async () => {
    const personal = entry();
    selectionRequestMock = {
      context: {
        platform: 'android',
        webDomain: 'github.com',
        packageName: 'com.android.chrome',
        hasUsernameField: true,
        hasPasswordField: true,
      },
      targetLabel: 'github.com',
      options: [option(personal, 100), option(entry({ id: 'entry-2', title: 'GitHub Work' }), 90)],
    };

    render(<AutofillHandoffController {...baseProps} />);

    await userEvent.click(screen.getAllByRole('button', { name: /İptal et/i })[0]);

    expect(cancelAutofillSelection).toHaveBeenCalledTimes(1);
  });

  it('renders a pending Autofill save request and creates a new vault record after approval', async () => {
    saveRequestMock = {
      request: {
        platform: 'android',
        webDomain: 'github.com',
        packageName: 'com.android.chrome',
        username: 'octo@example.com',
        password: 'Secret123!',
        formHints: ['username', 'password'],
        expiresAt: Date.now() + 60_000,
      },
      targetLabel: 'github.com',
      existingEntry: null,
    };

    render(<AutofillHandoffController {...baseProps} />);

    expect(screen.getByRole('heading', { name: /kasaya kaydet/i })).toBeInTheDocument();
    expect(screen.getByText('github.com')).toBeInTheDocument();
    expect(screen.getByText('octo@example.com')).toBeInTheDocument();
    expect(screen.queryByText('Secret123!')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Kasa Kayd/i }));

    expect(createAutofillSaveEntry).toHaveBeenCalledTimes(1);
  });

  it('updates an existing Autofill save match after approval', async () => {
    saveRequestMock = {
      request: {
        platform: 'android',
        webDomain: 'github.com',
        packageName: 'com.android.chrome',
        username: 'octo@example.com',
        password: 'Secret123!',
        formHints: ['username', 'password'],
        expiresAt: Date.now() + 60_000,
      },
      targetLabel: 'github.com',
      existingEntry: entry({ title: 'GitHub' }),
    };

    render(<AutofillHandoffController {...baseProps} />);

    expect(screen.getByText(/GitHub/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Mevcut Kayd/i }));

    expect(updateAutofillSaveEntry).toHaveBeenCalledTimes(1);
  });
});
