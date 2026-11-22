import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Capture from './Capture';
import ToastProvider from '../components/ui/ToastProvider';

function readStoredData(key) {
  return JSON.parse(window.localStorage.getItem(key)).data;
}

// Capture no longer renders its own <Toast>. Production mounts a single
// ToastProvider in the app shell; tests wrap the route in the same provider
// so the shared toast region renders alongside the page.

describe('src/pages/Capture', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('renders empty state when no notes exist', () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <Capture />
        </ToastProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Capture' })).toBeInTheDocument();
    expect(screen.getByText('No sticky notes yet')).toBeInTheDocument();
  });

  it('creates, edits, and deletes a sticky note with local persistence', () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <Capture />
        </ToastProvider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Note'), {
      target: { value: 'Ship newsletter outline' },
    });
    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: 'content' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save sticky note' }));

    const noteEditor = screen.getByDisplayValue('Ship newsletter outline');
    expect(noteEditor).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Content note' })).toBeInTheDocument();

    fireEvent.change(noteEditor, {
      target: { value: 'Ship newsletter intro paragraph' },
    });
    expect(screen.getByDisplayValue('Ship newsletter intro paragraph')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete Content note' }));
    expect(screen.getByText('No sticky notes yet')).toBeInTheDocument();
  });

  it('connects capture composer errors to the note field accessibly', () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <Capture />
        </ToastProvider>
      </MemoryRouter>,
    );

    const noteField = screen.getByLabelText('Note');

    expect(noteField).toHaveAccessibleDescription('Capture one thought, task, or idea at a time.');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Auto-saved locally and ready whenever your brain moves fast.',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save sticky note' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Add a quick note before saving.');
    expect(noteField).toHaveAttribute('aria-invalid', 'true');
    expect(noteField).toHaveAccessibleDescription(
      'Capture one thought, task, or idea at a time. Add a quick note before saving.',
    );
    expect(noteField).toHaveFocus();
  });

  it('clears composer errors as soon as the note draft changes', () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <Capture />
        </ToastProvider>
      </MemoryRouter>,
    );

    const noteField = screen.getByLabelText('Note');

    fireEvent.click(screen.getByRole('button', { name: 'Save sticky note' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Add a quick note before saving.');

    fireEvent.change(noteField, {
      target: { value: 'Capture the next sales call idea' },
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(noteField).not.toHaveAttribute('aria-invalid');
    expect(noteField).toHaveAccessibleDescription('Capture one thought, task, or idea at a time.');
  });

  it('rehydrates the composer when a draft is in localStorage at mount', () => {
    window.localStorage.setItem('ceo-os-capture-draft-text', JSON.stringify('Saved draft from earlier'));
    window.localStorage.setItem('ceo-os-capture-draft-category', JSON.stringify('opportunity'));

    render(
      <MemoryRouter>
        <ToastProvider>
          <Capture />
        </ToastProvider>
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('Note')).toHaveValue('Saved draft from earlier');
    expect(screen.getByLabelText('Category')).toHaveValue('opportunity');
  });

  it('falls back to the default category if a stored value is no longer valid', () => {
    window.localStorage.setItem('ceo-os-capture-draft-category', JSON.stringify('not-a-real-category'));

    render(
      <MemoryRouter>
        <ToastProvider>
          <Capture />
        </ToastProvider>
      </MemoryRouter>,
    );

    // First valid option in CAPTURE_CATEGORY_OPTIONS is 'idea'.
    expect(screen.getByLabelText('Category')).toHaveValue('idea');
  });

  it('persists the composer draft and last-used category across remounts', () => {
    const { unmount } = render(
      <MemoryRouter>
        <ToastProvider>
          <Capture />
        </ToastProvider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Note'), {
      target: { value: 'Half-typed thought to recover' },
    });
    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: 'task' },
    });

    unmount();

    render(
      <MemoryRouter>
        <ToastProvider>
          <Capture />
        </ToastProvider>
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('Note')).toHaveValue('Half-typed thought to recover');
    expect(screen.getByLabelText('Category')).toHaveValue('task');
  });

  it('keeps the last-used category selected after a successful save', () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <Capture />
        </ToastProvider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Note'), {
      target: { value: 'Run experiment for pricing page' },
    });
    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: 'task' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save sticky note' }));

    // Category remains as the last selection; text resets so the next note can be typed quickly.
    expect(screen.getByLabelText('Category')).toHaveValue('task');
    expect(screen.getByLabelText('Note')).toHaveValue('');
  });

  it('drafts a sticky note as a new content item via the per-note action', async () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <Capture />
        </ToastProvider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Note'), {
      target: { value: 'Q3 launch retrospective post' },
    });
    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: 'content' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save sticky note' }));

    fireEvent.click(screen.getByRole('button', {
      name: 'Draft Content note on Content OS',
    }));

    expect(await screen.findByText(/Drafted on Content OS/)).toBeInTheDocument();

    const contentRaw = window.localStorage.getItem('ceo-os-content-items');
    expect(contentRaw).toBeTruthy();
    const contentItems = readStoredData('ceo-os-content-items');
    const drafted = contentItems.find((entry) => entry.title === 'Q3 launch retrospective post');
    expect(drafted).toBeDefined();
    expect(drafted.status).toBe('Drafting');
    expect(drafted.platform).toBe('');

    // Sticky is auto-archived; reveal it via the toggle.
    expect(screen.queryByDisplayValue('Q3 launch retrospective post')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /show 1 promoted/i }));
    expect(screen.getByDisplayValue('Q3 launch retrospective post')).toBeInTheDocument();
  });

  it('tracks a sticky note as a new opportunity via the per-note action', async () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <Capture />
        </ToastProvider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Note'), {
      target: { value: 'Acme partnership intro from Sarah' },
    });
    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: 'opportunity' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save sticky note' }));

    fireEvent.click(screen.getByRole('button', {
      name: 'Track Opportunity note as a new opportunity',
    }));

    expect(await screen.findByText(/Tracked as a new opportunity/)).toBeInTheDocument();

    const opportunitiesRaw = window.localStorage.getItem('ceo-os-opportunities');
    expect(opportunitiesRaw).toBeTruthy();
    const opportunities = readStoredData('ceo-os-opportunities');
    const tracked = opportunities.find((entry) => entry.name === 'Acme partnership intro from Sarah');
    expect(tracked).toBeDefined();
    expect(tracked.priority).toBe('Medium');
    expect(tracked.stage).toBe('New');
    expect(tracked.company).toBe('');
    expect(tracked.nextStep).toBe('');

    // Sticky is auto-archived; reveal it via the toggle.
    expect(screen.queryByDisplayValue('Acme partnership intro from Sarah')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /show 1 promoted/i }));
    expect(screen.getByDisplayValue('Acme partnership intro from Sarah')).toBeInTheDocument();
  });

  it('does not duplicate content items when Draft as content is double-clicked', async () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <Capture />
        </ToastProvider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Note'), {
      target: { value: 'Founders weekly recap thread' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save sticky note' }));

    const draftButton = screen.getByRole('button', {
      name: /Draft .* note on Content OS/,
    });

    fireEvent.click(draftButton);
    fireEvent.click(draftButton);
    fireEvent.click(draftButton);

    expect(await screen.findByText(/Drafted on Content OS/)).toBeInTheDocument();

    const items = readStoredData('ceo-os-content-items');
    const matching = items.filter((entry) => entry.title === 'Founders weekly recap thread');
    expect(matching).toHaveLength(1);
  });

  it('does not duplicate opportunities when Track opportunity is double-clicked', async () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <Capture />
        </ToastProvider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Note'), {
      target: { value: 'Conference recap follow-ups' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save sticky note' }));

    const trackButton = screen.getByRole('button', {
      name: /Track .* note as a new opportunity/,
    });

    fireEvent.click(trackButton);
    fireEvent.click(trackButton);
    fireEvent.click(trackButton);

    expect(await screen.findByText(/Tracked as a new opportunity/)).toBeInTheDocument();

    const opportunities = readStoredData('ceo-os-opportunities');
    const matching = opportunities.filter((entry) => entry.name === 'Conference recap follow-ups');
    expect(matching).toHaveLength(1);
  });

  it('promotes a sticky note into a reminder via the per-note action', async () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <Capture />
        </ToastProvider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Note'), {
      target: { value: 'Reply to Sarah by Friday' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save sticky note' }));

    fireEvent.click(screen.getByRole('button', { name: 'Make a reminder from Idea note' }));

    expect(await screen.findByText(/Added a reminder from this note/)).toBeInTheDocument();

    const remindersRaw = window.localStorage.getItem('ceo-os-reminders');
    expect(remindersRaw).toBeTruthy();
    const reminders = readStoredData('ceo-os-reminders');
    expect(reminders).toHaveLength(1);
    expect(reminders[0].text).toBe('Reply to Sarah by Friday');
    expect(reminders[0].isDone).toBe(false);

    // The sticky is auto-archived on promotion: hidden by default, surfaced
    // again behind the "Show N promoted" toggle so it isn't lost.
    expect(screen.queryByDisplayValue('Reply to Sarah by Friday')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /show 1 promoted/i }));
    expect(screen.getByDisplayValue('Reply to Sarah by Friday')).toBeInTheDocument();
  });

  it('pauses autosave confidence copy when a sticky note cannot be saved', () => {
    const originalSetItem = window.localStorage.setItem;
    window.localStorage.setItem = vi.fn(() => {
      throw new Error('storage full');
    });

    try {
      render(
        <MemoryRouter>
          <Capture />
        </MemoryRouter>,
      );

      fireEvent.change(screen.getByLabelText('Note'), {
        target: { value: 'This needs to survive' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save sticky note' }));

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Couldn’t save this note. Your text is still in the composer — try again in a moment.',
      );
      expect(screen.getByText('Autosave is paused until sticky notes save successfully again.')).toBeInTheDocument();
    } finally {
      window.localStorage.setItem = originalSetItem;
    }
  });
});
