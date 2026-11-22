import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoadDemoWorkspaceButton from './LoadDemoWorkspaceButton';
const { preview, apply } = vi.hoisted(() => ({ preview: vi.fn(), apply: vi.fn() }));
vi.mock('../../hooks/useWorkspaceSetup', () => ({ useWorkspaceSetup: () => ({ previewSetupChange: preview, applySetupChange: apply }) }));
const plan = { preserved: 3, removed: 4, added: 5, weeks: ['2026-11-16'] };
beforeEach(() => { vi.resetAllMocks(); preview.mockResolvedValue(plan); apply.mockResolvedValue(); });
describe('workspace setup preview', () => {
  it('shows scope and preservation before any mutation, even on a demo-only device', async () => {
    render(<LoadDemoWorkspaceButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Load demo workspace' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Keep 3 edited or authored records');
    expect(apply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel action' }));
    expect(apply).not.toHaveBeenCalled();
  });
  it('confirms exactly the reviewed plan', async () => {
    render(<LoadDemoWorkspaceButton action="blank">Start blank</LoadDemoWorkspaceButton>);
    fireEvent.click(screen.getByRole('button', { name: 'Start blank' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm demo cleanup' }));
    await waitFor(() => expect(apply).toHaveBeenCalledWith(plan));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
  it('keeps an actionable error in the dialog when a change fails', async () => {
    apply.mockRejectedValue(new Error('Changes rolled back. Original workspace is intact.'));
    render(<LoadDemoWorkspaceButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Load demo workspace' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm demo workspace changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Original workspace is intact');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
  it('fails closed when stores cannot be inspected', async () => {
    preview.mockRejectedValue(new Error('Unreadable original data.'));
    render(<LoadDemoWorkspaceButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Load demo workspace' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unreadable original data');
    expect(apply).not.toHaveBeenCalled();
  });
});
