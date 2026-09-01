import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../hooks/useWorkspaceSetup', () => ({
  useWorkspaceSetup: vi.fn(),
}));

import LoadDemoWorkspaceButton from './LoadDemoWorkspaceButton';
import { useWorkspaceSetup } from '../../hooks/useWorkspaceSetup';

function mockWorkspaceSetup({ loadDemoWorkspace, countLocalRecordsAtRisk }) {
  useWorkspaceSetup.mockReturnValue({
    loadDemoWorkspace,
    countLocalRecordsAtRisk,
  });
}

const CONFIRM_BUTTON = { name: 'Replace local workspace with demo data' };
const CANCEL_BUTTON = { name: 'Keep local workspace data' };

describe('LoadDemoWorkspaceButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads straight through when the device holds nothing but demo seed', async () => {
    const loadDemoWorkspace = vi.fn().mockResolvedValue();
    mockWorkspaceSetup({
      loadDemoWorkspace,
      countLocalRecordsAtRisk: vi.fn().mockResolvedValue(0),
    });

    render(<LoadDemoWorkspaceButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Load demo workspace' }));

    await waitFor(() => expect(loadDemoWorkspace).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', CONFIRM_BUTTON)).not.toBeInTheDocument();
  });

  it('asks first when the reset would destroy records the user created', async () => {
    const loadDemoWorkspace = vi.fn().mockResolvedValue();
    mockWorkspaceSetup({
      loadDemoWorkspace,
      countLocalRecordsAtRisk: vi.fn().mockResolvedValue(3),
    });

    render(<LoadDemoWorkspaceButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Load demo workspace' }));

    await screen.findByRole('button', CONFIRM_BUTTON);
    expect(loadDemoWorkspace).not.toHaveBeenCalled();
    expect(screen.getByText(/3 records you created here will be removed/)).toBeInTheDocument();
  });

  it('cancelling keeps the local data intact', async () => {
    const loadDemoWorkspace = vi.fn().mockResolvedValue();
    mockWorkspaceSetup({
      loadDemoWorkspace,
      countLocalRecordsAtRisk: vi.fn().mockResolvedValue(1),
    });

    render(<LoadDemoWorkspaceButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Load demo workspace' }));

    fireEvent.click(await screen.findByRole('button', CANCEL_BUTTON));

    await waitFor(() => {
      expect(screen.queryByRole('button', CONFIRM_BUTTON)).not.toBeInTheDocument();
    });
    expect(loadDemoWorkspace).not.toHaveBeenCalled();
  });

  it('confirming proceeds with the reset', async () => {
    const loadDemoWorkspace = vi.fn().mockResolvedValue();
    mockWorkspaceSetup({
      loadDemoWorkspace,
      countLocalRecordsAtRisk: vi.fn().mockResolvedValue(2),
    });

    render(<LoadDemoWorkspaceButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Load demo workspace' }));
    fireEvent.click(await screen.findByRole('button', CONFIRM_BUTTON));

    await waitFor(() => expect(loadDemoWorkspace).toHaveBeenCalledTimes(1));
  });

  // Failing open on a destructive action is how data gets lost silently, so an
  // undeterminable count must prompt rather than proceed.
  it('asks when the at-risk count cannot be determined', async () => {
    const loadDemoWorkspace = vi.fn().mockResolvedValue();
    mockWorkspaceSetup({
      loadDemoWorkspace,
      countLocalRecordsAtRisk: vi.fn().mockResolvedValue(null),
    });

    render(<LoadDemoWorkspaceButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Load demo workspace' }));

    await screen.findByRole('button', CONFIRM_BUTTON);
    expect(loadDemoWorkspace).not.toHaveBeenCalled();
    expect(screen.getByText(/Any records you created here will be removed/)).toBeInTheDocument();
  });

  it('asks when the count throws rather than crashing the click handler', async () => {
    const loadDemoWorkspace = vi.fn().mockResolvedValue();
    mockWorkspaceSetup({
      loadDemoWorkspace,
      countLocalRecordsAtRisk: vi.fn().mockRejectedValue(new Error('storage unavailable')),
    });

    render(<LoadDemoWorkspaceButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Load demo workspace' }));

    await screen.findByRole('button', CONFIRM_BUTTON);
    expect(loadDemoWorkspace).not.toHaveBeenCalled();
  });

  it('reports failures through onError instead of leaving the dialog open', async () => {
    const onError = vi.fn();
    mockWorkspaceSetup({
      loadDemoWorkspace: vi.fn().mockRejectedValue(new Error('write failed')),
      countLocalRecordsAtRisk: vi.fn().mockResolvedValue(0),
    });

    render(<LoadDemoWorkspaceButton onError={onError} />);
    fireEvent.click(screen.getByRole('button', { name: 'Load demo workspace' }));

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
  });
});
