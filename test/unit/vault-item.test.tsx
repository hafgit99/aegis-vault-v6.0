import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import '../../src/i18n';
import VaultItem from '../../src/components/VaultItem';
import { VaultEntry } from '../../src/types';

const entry: VaultEntry = {
  id: '1',
  title: 'GitHub',
  subtitle: 'octo',
  username: 'octo',
  password: 'Secret123!',
  strength: 'EXCELLENT',
  themeColor: 'tertiary',
  type: 'login',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('VaultItem', () => {
  it('renders localized metadata and toggles password reveal', async () => {
    const user = userEvent.setup();
    render(<VaultItem entry={entry} />);

    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByText('Giriş')).toBeInTheDocument();
    expect(screen.getByText(/DİRENÇ:/)).toHaveTextContent('MÜKEMMEL');
    expect(screen.queryByText('Secret123!')).not.toBeInTheDocument();

    await user.click(screen.getByTitle('Göster'));
    expect(screen.getByText('Secret123!')).toBeInTheDocument();
  });

  it('confirms before moving an item to trash', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<VaultItem entry={entry} onDelete={onDelete} />);

    await user.click(screen.getByTitle('Çöp Kutusuna Taşı'));

    expect(window.confirm).toHaveBeenCalledWith('"GitHub" kaydını çöp kutusuna taşımak istiyor musunuz?');
    expect(onDelete).toHaveBeenCalledWith('1');
  });

  it('copies card details and toggles favorites without opening the item', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onToggleFavorite = vi.fn();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

    render(
      <VaultItem
        entry={{
          ...entry,
          id: 'card-1',
          title: 'Backup Visa',
          subtitle: '•••• 1111',
          type: 'card',
          themeColor: 'secondary',
          cardNumber: '4111111111111111',
          expiryDate: '12/30',
          cvv: '123',
          favorite: false,
        }}
        onClick={onClick}
        onToggleFavorite={onToggleFavorite}
      />
    );

    await user.click(screen.getByTitle('Favorilere Ekle'));
    expect(onToggleFavorite).toHaveBeenCalledWith('card-1');
    expect(onClick).not.toHaveBeenCalled();

    await user.click(screen.getByTitle('Kart Bilgilerini Kopyala'));
    expect(writeText).toHaveBeenCalledWith('4111111111111111 | 12/30 | 123');
    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not move an item to trash when confirmation is cancelled', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<VaultItem entry={entry} onDelete={onDelete} />);

    await user.click(screen.getByTitle(/Kutusuna/));

    expect(onDelete).not.toHaveBeenCalled();
  });
});
