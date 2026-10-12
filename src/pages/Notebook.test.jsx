import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import Notebook from './Notebook';
import { getTodayJournalDateKey, saveJournalEntry } from '../lib/journalRepository';
import { getDailySignalEntry, listSectionPages } from '../lib/notebook/notebookPagesRepository';
import { getPlainText } from '../lib/notebook/notebookText';
import { listReminders } from '../lib/remindersRepository';

function renderNotebook(path = '/notebook') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/notebook" element={<Notebook />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Tiptap exposes its editor instance on the contenteditable element. */
function editorFor(name) {
  return screen.getByRole('textbox', { name }).editor;
}

describe('src/pages/Notebook', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("opens today's Personal page with the Journal prompts, carrying over an existing entry", async () => {
    saveJournalEntry({ dateKey: getTodayJournalDateKey(), entry: { onMyMind: 'Pitch deck feedback', oneNextThing: '' } });

    renderNotebook();

    expect(screen.getByRole('heading', { level: 1, name: 'Notebook' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Personal' })).toHaveAttribute('aria-current', 'page');
    const onMyMind = await screen.findByRole('textbox', { name: 'What is on my mind?' });
    expect(onMyMind).toHaveTextContent('Pitch deck feedback');
    for (const prompt of ['What feels heavy?', 'What is one thing I can do next?', 'What would make today feel successful?']) {
      expect(screen.getByRole('textbox', { name: prompt })).toBeInTheDocument();
    }
    expect(screen.getByRole('toolbar', { name: /^Formatting for/ })).toBeInTheDocument();
  });

  it('autosaves writing to the page and Focus Home reads it as plain text', async () => {
    renderNotebook();
    await screen.findByRole('textbox', { name: 'What feels heavy?' });

    act(() => {
      editorFor('What feels heavy?').commands.insertContent('Quarterly taxes');
    });
    expect(await screen.findByText('Unsaved changes')).toBeInTheDocument();

    await waitFor(() => {
      expect(getDailySignalEntry(getTodayJournalDateKey()).feelsHeavy).toBe('Quarterly taxes');
    }, { timeout: 3000 });
    expect(screen.getByText(/^Saved on this device/)).toBeInTheDocument();
  });

  it('turns the one next thing into a reminder, and only when it has text', async () => {
    renderNotebook();
    const button = await screen.findByRole('button', { name: 'Make a reminder from this' });
    expect(button).toBeDisabled();

    act(() => {
      editorFor('What is one thing I can do next?').commands.insertContent('Email the accountant');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Make a reminder from this' }));

    expect(listReminders().map((reminder) => reminder.text)).toContain('Email the accountant');
  });

  it('creates a named Learning page, validating the title, with reflections folded', async () => {
    renderNotebook('/notebook?section=learning');

    expect(screen.getByText('No Learning pages yet')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'New page' })[0]);
    const dialog = screen.getByRole('dialog', { name: 'New Learning page' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Create page' }));
    expect(within(dialog).getByText('Give the page a title.')).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: 'CSS Grid' } });
    fireEvent.change(within(dialog).getByLabelText('Source link (optional)'), { target: { value: 'css-tricks.com/grid' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create page' }));

    expect(await screen.findByLabelText('Page title')).toHaveValue('CSS Grid');
    expect(screen.getByLabelText('Source')).toHaveValue('https://css-tricks.com/grid');
    expect(screen.getByRole('textbox', { name: 'My Notes' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /My Version/ })).toBeInTheDocument();

    const clicked = screen.getByRole('button', { name: 'What clicked' });
    expect(clicked).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(clicked);
    expect(clicked).toHaveAttribute('aria-expanded', 'true');

    const [page] = listSectionPages('learning');
    expect(page).toMatchObject({ title: 'CSS Grid', sourceUrl: 'https://css-tricks.com/grid' });
    expect(screen.getByRole('link', { name: 'CSS Grid' })).toHaveAttribute('aria-current', 'page');
  });

  it('starts the Inventions & CodeHerWay to-do block as a checklist', async () => {
    renderNotebook('/notebook?section=ventures');
    fireEvent.click(screen.getAllByRole('button', { name: 'New page' })[0]);
    const dialog = screen.getByRole('dialog', { name: 'New Inventions & CodeHerWay page' });
    fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: 'Mentor matching' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create page' }));

    const todo = await screen.findByRole('textbox', { name: 'To-do' });
    expect(within(todo).getByRole('checkbox')).not.toBeChecked();

    act(() => {
      editorFor('To-do').commands.insertContent('Draft the landing page');
    });
    await waitFor(() => {
      expect(getPlainText(listSectionPages('ventures')[0].blocks.todo)).toBe('Draft the landing page');
    }, { timeout: 3000 });
  });
});
