import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import StorageCorruptionBanner from './StorageCorruptionBanner';
import {
  STORAGE_CORRUPTION_EVENT,
  preserveCorruptStorageValue,
} from '../../lib/storageCorruption';

describe('StorageCorruptionBanner', () => {
  afterEach(() => {
    window.localStorage.clear?.();
  });

  it('renders nothing until a storage corruption event fires', () => {
    render(<StorageCorruptionBanner />);
    expect(screen.queryByTestId('storage-corruption-banner')).not.toBeInTheDocument();
  });

  it('shows a recovery banner with the affected key when an event fires', () => {
    render(<StorageCorruptionBanner />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent(STORAGE_CORRUPTION_EVENT, {
          detail: {
            key: 'ceo-os-journal-2026-04-30',
            backupKey: 'ceo-os-journal-2026-04-30__corrupt_1',
            message: 'invalid json',
          },
        }),
      );
    });

    expect(screen.getByTestId('storage-corruption-banner')).toBeInTheDocument();
    expect(screen.getByText(/ceo-os-journal-2026-04-30/)).toBeInTheDocument();
  });

  it('dismisses the banner when the user clicks Dismiss', () => {
    render(<StorageCorruptionBanner />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent(STORAGE_CORRUPTION_EVENT, {
          detail: { key: 'ceo-os-test', backupKey: null, message: 'x' },
        }),
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));

    expect(screen.queryByTestId('storage-corruption-banner')).not.toBeInTheDocument();
  });

  it('lets the user expand backups and restore one back into the primary key', () => {
    const key = 'ceo-os-test-recover';
    const backupKey = preserveCorruptStorageValue(key, '{"recovered":true}', new Error('parse'));

    render(<StorageCorruptionBanner />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent(STORAGE_CORRUPTION_EVENT, {
          detail: { key, backupKey, message: 'parse' },
        }),
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /recover data/i }));
    expect(screen.getByText(/"recovered":true/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^restore$/i }));

    expect(window.localStorage.getItem(key)).toBe('{"recovered":true}');
    expect(screen.getByText(/Backup restored/i)).toBeInTheDocument();
  });

  it('wires the recover button as a WAI-ARIA disclosure (aria-controls points to the panel id, aria-expanded reflects state)', () => {
    const key = 'ceo-os-test-disclosure';
    const backupKey = preserveCorruptStorageValue(key, 'recoverable', new Error('parse'));

    render(<StorageCorruptionBanner />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent(STORAGE_CORRUPTION_EVENT, {
          detail: { key, backupKey, message: 'parse' },
        }),
      );
    });

    const recoverButton = screen.getByRole('button', { name: /recover data/i });
    const controlsId = recoverButton.getAttribute('aria-controls');
    expect(controlsId).toBeTruthy();
    expect(recoverButton.getAttribute('aria-expanded')).toBe('false');

    const panel = document.getElementById(controlsId);
    expect(panel).not.toBeNull();
    expect(panel.hasAttribute('hidden')).toBe(true);

    fireEvent.click(recoverButton);

    expect(screen.getByRole('button', { name: /hide backups/i }).getAttribute('aria-expanded')).toBe('true');
    expect(panel.hasAttribute('hidden')).toBe(false);
  });

  it('lets the user discard a preserved backup', () => {
    const key = 'ceo-os-test-discard-ui';
    const backupKey = preserveCorruptStorageValue(key, 'gone-soon', new Error('parse'));

    render(<StorageCorruptionBanner />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent(STORAGE_CORRUPTION_EVENT, {
          detail: { key, backupKey, message: 'parse' },
        }),
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /recover data/i }));
    fireEvent.click(screen.getByRole('button', { name: /^discard$/i }));

    expect(window.localStorage.getItem(backupKey)).toBeNull();
    expect(screen.getByText(/No preserved backups available/i)).toBeInTheDocument();
  });
});
