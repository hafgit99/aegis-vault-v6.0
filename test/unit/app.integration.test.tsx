import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VaultEntry } from '../../src/types';
import '../../src/i18n';

const appState = vi.hoisted(() => ({
  entries: [] as VaultEntry[],
}));

const vaultServiceMock = vi.hoisted(() => ({
  getPasswords: vi.fn(async () => appState.entries),
  savePassword: vi.fn(async (entry: VaultEntry) => {
    appState.entries = [
      ...appState.entries.filter((existing) => existing.id !== entry.id),
      entry,
    ];
  }),
  deletePassword: vi.fn(async (id: string) => {
    appState.entries = appState.entries.filter((entry) => entry.id !== id);
  }),
  lock: vi.fn(async () => {}),
  wipeAllData: vi.fn(async () => {
    appState.entries = [];
  }),
  sqliteDb: {
    clearPasswords: vi.fn(),
    flushToOPFS: vi.fn(async () => {}),
  },
}));

vi.mock('../../src/lib/vaultService', () => ({
  vaultService: vaultServiceMock,
}));

vi.mock('motion/react', async () => {
  const React = await import('react');
  return {
    AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
    motion: new Proxy({}, {
      get: (_target, tag: string) => (
        ({ children, whileHover: _whileHover, whileTap: _whileTap, ...props }: any) => React.createElement(tag, props, children)
      ),
    }),
  };
});

vi.mock('../../src/components/LockScreen', () => ({
  default: ({ onUnlock, onAddLog }: { onUnlock: () => void; onAddLog: (action: string) => void }) => (
    <section>
      <h1>Mock Lock Screen</h1>
      <button onClick={() => onAddLog('setup log')}>emit setup log</button>
      <button onClick={onUnlock}>unlock vault</button>
    </section>
  ),
}));

vi.mock('../../src/components/Sidebar', () => ({
  default: ({
    activeTab,
    setActiveTab,
    onAddNewEntry,
    onLock,
  }: {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    onAddNewEntry: () => void;
    onLock: () => void;
  }) => (
    <nav aria-label="mock sidebar">
      <span>active:{activeTab}</span>
      <button onClick={() => setActiveTab('audit')}>audit tab</button>
      <button onClick={() => setActiveTab('generator')}>generator tab</button>
      <button onClick={() => setActiveTab('settings')}>settings tab</button>
      <button onClick={() => setActiveTab('trash')}>trash tab</button>
      <button onClick={onAddNewEntry}>new entry</button>
      <button onClick={onLock}>lock vault</button>
    </nav>
  ),
}));

vi.mock('../../src/components/VaultItem', () => ({
  default: ({
    entry,
    onClick,
    onDelete,
    onToggleFavorite,
  }: {
    entry: VaultEntry;
    onClick: () => void;
    onDelete: (id: string) => void;
    onToggleFavorite: (id: string) => void;
  }) => (
    <article>
      <button onClick={onClick}>{entry.title}</button>
      <button onClick={() => onToggleFavorite(entry.id)}>favorite {entry.title}</button>
      <button onClick={() => onDelete(entry.id)}>delete {entry.title}</button>
    </article>
  ),
}));

vi.mock('../../src/components/AddEntryModal', () => ({
  default: ({
    isOpen,
    onClose,
    onSave,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (entry: VaultEntry) => void;
  }) => (
    isOpen ? (
      <section role="dialog" aria-label="add entry modal">
        <button onClick={onClose}>cancel mocked entry</button>
        <button
          onClick={() => {
            onSave({
              id: 'new-entry',
              title: 'New Entry',
              subtitle: 'new@example.com',
              username: 'new@example.com',
              password: 'NewPassword123!',
              strength: 'EXCELLENT',
              themeColor: 'tertiary',
              type: 'login',
              createdAt: '2026-05-23T00:00:00.000Z',
            });
            onClose();
          }}
        >
          save mocked entry
        </button>
      </section>
    ) : null
  ),
}));

vi.mock('../../src/components/DetailPanel', () => ({
  default: ({
    entry,
    onClose,
    onDelete,
    onUpdate,
  }: {
    entry: VaultEntry;
    onClose: () => void;
    onDelete: (id: string) => void;
    onUpdate: (entry: VaultEntry) => void;
  }) => (
    <aside aria-label="detail panel">
      <h2>detail:{entry.title}</h2>
      <button onClick={() => onUpdate({ ...entry, title: `${entry.title} Updated` })}>update selected</button>
      <button onClick={() => onDelete(entry.id)}>trash selected</button>
      <button onClick={onClose}>close detail</button>
    </aside>
  ),
}));

vi.mock('../../src/components/SecurityAudit', () => ({
  default: ({ entries }: { entries: VaultEntry[] }) => <section>audit:{entries.length}</section>,
}));

vi.mock('../../src/components/Generator', () => ({
  default: () => <section>generator view</section>,
}));

vi.mock('../../src/components/Settings', () => ({
  default: ({
    onReset,
    onImport,
  }: {
    onReset: () => void;
    onImport: (entries: VaultEntry[], overwrite?: boolean) => void;
  }) => (
    <section>
      settings view
      <button onClick={onReset}>reset samples</button>
      <button
        onClick={() => onImport([
          {
            id: 'settings-import',
            title: 'Settings Import',
            subtitle: 'settings@example.com',
            username: 'settings@example.com',
            password: 'ImportedPassword123!',
            strength: 'EXCELLENT',
            themeColor: 'tertiary',
            type: 'login',
            createdAt: '2026-05-24T00:00:00.000Z',
          },
        ], true)}
      >
        settings import replace
      </button>
    </section>
  ),
}));

vi.mock('../../src/components/TrashBin', () => ({
  default: ({
    entries,
    onRestore,
    onPermanentDelete,
    onClearTrash,
  }: {
    entries: VaultEntry[];
    onRestore: (id: string) => void;
    onPermanentDelete: (id: string) => void;
    onClearTrash: () => void;
  }) => (
    <section>
      trash:{entries.filter((entry) => entry.isDeleted).length}
      <button onClick={() => onRestore('deleted-entry')}>restore deleted</button>
      <button onClick={() => onPermanentDelete('deleted-entry')}>permanent delete</button>
      <button onClick={onClearTrash}>clear trash</button>
    </section>
  ),
}));

vi.mock('../../src/components/ProfileModal', () => ({
  default: ({
    isOpen,
    onClose,
    onUpdateUserName,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onUpdateUserName: (name: string) => void;
  }) => (
    isOpen ? (
      <section role="dialog" aria-label="profile modal">
        <button onClick={onClose}>close profile</button>
        <button onClick={() => onUpdateUserName('Updated Owner')}>update profile name</button>
      </section>
    ) : null
  ),
}));

vi.mock('../../src/components/DatabaseModal', () => ({
  default: ({
    isOpen,
    onClose,
    onClearStorage,
    onImportBackup,
    onAddLog,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onClearStorage: () => void;
    onImportBackup: (entries: VaultEntry[], overwrite?: boolean) => void;
    onAddLog: (action: string) => void;
  }) => (
    isOpen ? (
      <section role="dialog" aria-label="database modal">
        <button onClick={onClose}>close database</button>
        <button onClick={onClearStorage}>wipe database</button>
        <button onClick={() => onAddLog('database warning')}>emit database log</button>
        <button
          onClick={() => onImportBackup([
            {
              id: 'database-import',
              title: 'Database Import',
              subtitle: 'db@example.com',
              username: 'db@example.com',
              password: 'DbImportedPassword123!',
              strength: 'EXCELLENT',
              themeColor: 'tertiary',
              type: 'login',
              createdAt: '2026-05-24T00:00:00.000Z',
            },
          ], true)}
        >
          database import replace
        </button>
      </section>
    ) : null
  ),
}));

vi.mock('../../src/components/SecurityLogsModal', () => ({
  default: ({
    isOpen,
    logs,
    onClose,
    onClearLogs,
  }: {
    isOpen: boolean;
    logs: unknown[];
    onClose: () => void;
    onClearLogs: () => void;
  }) => (
    isOpen ? (
      <section role="dialog" aria-label="security logs modal">
        logs:{logs.length}
        <button onClick={onClose}>close logs</button>
        <button onClick={onClearLogs}>clear logs</button>
      </section>
    ) : null
  ),
}));

import App from '../../src/App';

const entry = (overrides: Partial<VaultEntry>): VaultEntry => ({
  id: overrides.id ?? 'entry-1',
  title: overrides.title ?? 'GitHub',
  subtitle: overrides.subtitle ?? 'octo@example.com',
  username: overrides.username ?? 'octo@example.com',
  password: overrides.password ?? 'SharedPassword123!',
  strength: overrides.strength ?? 'GOOD',
  themeColor: overrides.themeColor ?? 'secondary',
  type: overrides.type ?? 'login',
  createdAt: overrides.createdAt ?? '2026-05-23T00:00:00.000Z',
  ...overrides,
});

describe('App integration shell', () => {
  beforeEach(() => {
    appState.entries = [
      entry({ id: 'entry-1', title: 'GitHub', favorite: false }),
      entry({ id: 'card-1', title: 'Backup Card', type: 'card', password: undefined, strength: 'IMMUTABLE' }),
      entry({ id: 'deleted-entry', title: 'Deleted Login', isDeleted: true }),
    ];
    vi.clearAllMocks();
    localStorage.setItem('aegis_master_password', 'StrongMasterPassword123!');
  });

  it('unlocks the vault, loads entries, searches, and opens the detail panel', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Mock Lock Screen' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'unlock vault' }));

    expect(await screen.findByText('GitHub')).toBeInTheDocument();
    expect(vaultServiceMock.getPasswords).toHaveBeenCalled();

    const searchInput = screen.getByPlaceholderText(/arama yap/i);
    await user.type(searchInput, 'backup');
    await waitFor(() => {
      expect(screen.queryByText('GitHub')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Backup Card')).toBeInTheDocument();

    await user.clear(searchInput);
    await user.click(await screen.findByText('GitHub'));
    expect(await screen.findByRole('heading', { name: 'detail:GitHub' })).toBeInTheDocument();
    const detailWrapper = screen.getByRole('heading', { name: 'detail:GitHub' }).closest('aside')?.parentElement as HTMLElement;
    expect(detailWrapper).toHaveClass('w-[800px]');
    expect(detailWrapper.previousElementSibling).toHaveClass('max-w-[calc(100%-800px)]');
    expect(screen.getByRole('button', { name: /Yeni gÃ¼venli kayÄ±t ekle|Yeni g.venli kay.t ekle/i })).toHaveClass('right-[820px]');
  });

  it('creates, updates, favorites, trashes, restores, and permanently deletes entries through app handlers', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'unlock vault' }));
    await screen.findByText('GitHub');

    await user.click(screen.getByRole('button', { name: 'new entry' }));
    await user.click(await screen.findByRole('button', { name: 'save mocked entry' }));
    await waitFor(() => {
      expect(vaultServiceMock.savePassword).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-entry' }));
    });
    expect(await screen.findByText('New Entry')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'favorite GitHub' }));
    await waitFor(() => {
      expect(vaultServiceMock.savePassword).toHaveBeenCalledWith(expect.objectContaining({
        id: 'entry-1',
        favorite: true,
      }));
    });

    await user.click(screen.getByText('GitHub'));
    await user.click(await screen.findByRole('button', { name: 'update selected' }));
    await waitFor(() => {
      expect(vaultServiceMock.savePassword).toHaveBeenCalledWith(expect.objectContaining({
        id: 'entry-1',
        title: 'GitHub Updated',
      }));
    });

    await user.click(await screen.findByRole('button', { name: 'trash selected' }));
    await waitFor(() => {
      expect(vaultServiceMock.savePassword).toHaveBeenCalledWith(expect.objectContaining({
        id: 'entry-1',
        isDeleted: true,
      }));
    });

    await user.click(screen.getByRole('button', { name: 'trash tab' }));
    await user.click(await screen.findByRole('button', { name: 'restore deleted' }));
    await waitFor(() => {
      expect(vaultServiceMock.savePassword).toHaveBeenCalledWith(expect.objectContaining({
        id: 'deleted-entry',
        isDeleted: false,
      }));
    });

    await user.click(await screen.findByRole('button', { name: 'permanent delete' }));
    expect(vaultServiceMock.deletePassword).toHaveBeenCalledWith('deleted-entry');
  });

  it('navigates secondary tabs, opens header modals, clears logs, wipes storage, and locks again', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'unlock vault' }));
    await screen.findByText('GitHub');

    await user.click(screen.getByRole('button', { name: 'audit tab' }));
    expect(await screen.findByText(/audit:/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'generator tab' }));
    expect(await screen.findByText('generator view')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'settings tab' }));
    expect(await screen.findByText(/settings view/)).toBeInTheDocument();

    await user.click(screen.getByTitle('Güvenlik Günlüğü'));
    expect(await screen.findByRole('dialog', { name: 'security logs modal' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'clear logs' }));
    expect(localStorage.getItem('aegis_security_logs')).toContain('günlüğü boşaltıldı');

    await user.click(screen.getByTitle(/Profil/));
    await user.click(await screen.findByRole('button', { name: 'update profile name' }));
    expect(localStorage.getItem('aegis_user_name')).toBe('Updated Owner');

    await user.click(screen.getByTitle(/Veritabanı Yönetimi/));
    await user.click(await screen.findByRole('button', { name: 'wipe database' }));
    await waitFor(() => {
      expect(vaultServiceMock.wipeAllData).toHaveBeenCalled();
    });
    expect(screen.getByRole('heading', { name: 'Mock Lock Screen' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'unlock vault' }));
    await screen.findByRole('navigation', { name: 'mock sidebar' });
    await user.click(screen.getByRole('button', { name: 'lock vault' }));
    await waitFor(() => {
      expect(vaultServiceMock.lock).toHaveBeenCalled();
    });
    expect(screen.getByRole('heading', { name: 'Mock Lock Screen' })).toBeInTheDocument();
  });

  it('records local database sync start and completion from the header action', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'unlock vault' }));
    await screen.findByText('GitHub');

    fireEvent.click(screen.getByTitle(/Senkronizasyonu|Sync/i));

    await waitFor(() => {
      expect(localStorage.getItem('aegis_security_logs')).toContain('senkronizasyonu ba');
    });

    await new Promise((resolve) => setTimeout(resolve, 1100));

    await waitFor(() => {
      const logs = JSON.parse(localStorage.getItem('aegis_security_logs') ?? '[]');
      expect(logs).toEqual(expect.arrayContaining([
        expect.objectContaining({ severity: 'info', action: expect.stringContaining('senkronizasyonu ba') }),
        expect.objectContaining({ severity: 'info', action: expect.stringContaining('senkronizasyonu tamam') }),
      ]));
    });
  }, 7000);

  it('clears all trash entries and flushes imported backup replacements', async () => {
    const user = userEvent.setup();
    appState.entries = [
      entry({ id: 'entry-1', title: 'GitHub', favorite: false }),
      entry({ id: 'deleted-entry', title: 'Deleted Login', isDeleted: true }),
      entry({ id: 'deleted-card', title: 'Deleted Card', type: 'card', isDeleted: true }),
    ];

    render(<App />);

    await user.click(screen.getByRole('button', { name: 'unlock vault' }));
    await screen.findByText('GitHub');

    await user.click(screen.getByRole('button', { name: 'trash tab' }));
    await user.click(await screen.findByRole('button', { name: 'clear trash' }));

    await waitFor(() => {
      expect(vaultServiceMock.deletePassword).toHaveBeenCalledWith('deleted-entry');
      expect(vaultServiceMock.deletePassword).toHaveBeenCalledWith('deleted-card');
    });

    await user.click(screen.getByRole('button', { name: 'settings tab' }));
    await user.click(await screen.findByRole('button', { name: 'settings import replace' }));

    await waitFor(() => {
      expect(vaultServiceMock.sqliteDb.clearPasswords).toHaveBeenCalled();
      expect(vaultServiceMock.savePassword).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'settings-import', title: 'Settings Import' }),
        false
      );
      expect(vaultServiceMock.sqliteDb.flushToOPFS).toHaveBeenCalled();
    });

    await user.click(screen.getByTitle(/Veritabanı Yönetimi|Veritaban. Y.netimi/));
    await user.click(await screen.findByRole('button', { name: 'database import replace' }));

    await waitFor(() => {
      expect(vaultServiceMock.savePassword).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'database-import', title: 'Database Import' }),
        false
      );
    });
  });

  it('closes app overlays and hides vault-only controls outside the vault tab', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'unlock vault' }));
    await screen.findByText('GitHub');

    const floatingAdd = screen.getByRole('button', { name: /Yeni güvenli kayıt ekle|Yeni g.venli kay.t ekle/i });
    await user.click(floatingAdd);
    expect(await screen.findByRole('dialog', { name: 'add entry modal' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'cancel mocked entry' }));
    expect(screen.queryByRole('dialog', { name: 'add entry modal' })).not.toBeInTheDocument();

    await user.click(screen.getByText('GitHub'));
    expect(await screen.findByRole('heading', { name: 'detail:GitHub' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'close detail' }));
    expect(screen.queryByRole('heading', { name: 'detail:GitHub' })).not.toBeInTheDocument();

    await user.click(screen.getByText('GitHub'));
    expect(await screen.findByRole('heading', { name: 'detail:GitHub' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'audit tab' }));
    expect(screen.queryByRole('heading', { name: 'detail:GitHub' })).not.toBeInTheDocument();
    const searchInput = screen.getByPlaceholderText(/arama yap/i);
    expect(searchInput).toBeDisabled();
    expect(searchInput.parentElement).toHaveClass('opacity-40');
    expect(searchInput.parentElement).toHaveClass('pointer-events-none');
    expect(screen.queryByRole('button', { name: /Yeni güvenli kayıt ekle|Yeni g.venli kay.t ekle/i })).not.toBeInTheDocument();

    await user.click(screen.getByTitle(/Güvenlik Günlüğü|G.venlik G.nl/i));
    expect(await screen.findByRole('dialog', { name: 'security logs modal' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'close logs' }));
    expect(screen.queryByRole('dialog', { name: 'security logs modal' })).not.toBeInTheDocument();

    await user.click(screen.getByTitle(/Profil/));
    expect(await screen.findByRole('dialog', { name: 'profile modal' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'close profile' }));
    expect(screen.queryByRole('dialog', { name: 'profile modal' })).not.toBeInTheDocument();

    await user.click(screen.getByTitle(/Veritabanı Yönetimi|Veritaban. Y.netimi/));
    expect(await screen.findByRole('dialog', { name: 'database modal' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'emit database log' }));
    expect(localStorage.getItem('aegis_security_logs')).toContain('database warning');
    const databaseWarningLog = JSON.parse(localStorage.getItem('aegis_security_logs') ?? '[]')
      .find((log: { action: string }) => log.action === 'database warning');
    expect(databaseWarningLog).toMatchObject({ action: 'database warning', severity: 'warning' });
    await user.click(screen.getByRole('button', { name: 'close database' }));
    expect(screen.queryByRole('dialog', { name: 'database modal' })).not.toBeInTheDocument();
  });

  it('shows and clears toast feedback for entry creation', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'unlock vault' }));
    await screen.findByText('GitHub');

    expect(screen.queryByText(/New Entry.*kasaya/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'new entry' }));
    await user.click(await screen.findByRole('button', { name: 'save mocked entry' }));

    expect(await screen.findByText(/New Entry.*kasaya/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText(/New Entry.*kasaya/i)).not.toBeInTheDocument();
    }, { timeout: 4000 });
  }, 6000);
});
