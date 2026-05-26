import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import '../../src/i18n';
import i18n from '../../src/i18n';
import Generator from '../../src/components/Generator';

describe('Generator', () => {
  it('renders password controls and regenerates a password', async () => {
    const user = userEvent.setup();
    render(<Generator />);

    expect(screen.getByRole('heading', { name: 'Parola Üretici' })).toBeInTheDocument();
    expect(screen.getByText('Üretilen Parola')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kopyala' })).toBeInTheDocument();

    await user.click(screen.getByTitle('Yeniden Üret'));

    expect(screen.getByText('Parola Analizi')).toBeInTheDocument();
    expect(screen.getByText('Güvenlik Derecesi')).toBeInTheDocument();
  });

  it('persists generator options, prevents empty character sets, and copies valid output', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

    render(<Generator />);

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '20' } });

    const [uppercase, lowercase, numbers, symbols] = screen.getAllByRole('checkbox');
    await user.click(uppercase);
    await user.click(numbers);
    await user.click(symbols);

    expect(localStorage.getItem('aegis_gen_length')).toBe('20');
    expect(localStorage.getItem('aegis_gen_uppercase')).toBe('false');
    expect(localStorage.getItem('aegis_gen_lowercase')).toBe('true');
    expect(localStorage.getItem('aegis_gen_numbers')).toBe('false');
    expect(localStorage.getItem('aegis_gen_symbols')).toBe('false');

    await user.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/^[a-z]{20}$/));
    });
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();

    await user.click(lowercase);
    expect(screen.getByText('Select at least one option.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copied' }));
    expect(writeText).toHaveBeenCalledTimes(1);
  });
});
