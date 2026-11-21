import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import StorageCorruptionBanner from './StorageCorruptionBanner';
import { preserveCorruptStorageValue, discardCorruptBackup } from '../../lib/storageCorruption';
const mount = () => render(<MemoryRouter><StorageCorruptionBanner /></MemoryRouter>);
describe('durable recovery notice', () => {
  beforeEach(() => localStorage.clear());
  it('stays quiet when no data needs recovery', () => {
    mount(); expect(screen.queryByTestId('storage-corruption-banner')).not.toBeInTheDocument();
  });
  it('discovers preserved data even when the event occurred before mount', () => {
    preserveCorruptStorageValue('ceo-os-settings', '{broken');
    mount(); expect(screen.getByRole('link', { name: 'Review recovery data' })).toHaveAttribute('href', '/settings#recovery');
  });
  it('dismisses the notice without losing the durable registry', () => {
    const backupKey = preserveCorruptStorageValue('ceo-os-settings', '{broken');
    const view = mount();
    fireEvent.click(screen.getByRole('button', { name: /Dismiss/ }));
    expect(localStorage.getItem(backupKey)).toBe('{broken');
    view.unmount(); mount(); expect(screen.getByTestId('storage-corruption-banner')).toBeVisible();
    act(() => { discardCorruptBackup('ceo-os-settings', backupKey); });
    expect(screen.queryByTestId('storage-corruption-banner')).not.toBeInTheDocument();
  });
});
