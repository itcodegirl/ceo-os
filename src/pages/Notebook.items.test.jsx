import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import Notebook from './Notebook';
import { NOTEBOOK_ITEM_KINDS } from '../lib/notebook/items/itemModels';
import { createItem, listNotebookItems } from '../lib/notebook/items/notebookItemsRepository';
import { createNotebookPage, listSectionPages, saveNotebookPage } from '../lib/notebook/notebookPagesRepository';
import { textToDoc } from '../lib/notebook/notebookText';

function renderNotebook(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/notebook" element={<Notebook />} />
      </Routes>
    </MemoryRouter>,
  );
}

function editorFor(name) {
  return screen.getByRole('textbox', { name }).editor;
}

function learningPage(blocks = {}) {
  const page = createNotebookPage({ section: 'learning', title: 'Pricing' });
  if (Object.keys(blocks).length) saveNotebookPage(page.id, { blocks });
  return page;
}

function panel() {
  return screen.getByRole('complementary', { name: 'Cards, questions, and ideas' });
}

function allItems() {
  return NOTEBOOK_ITEM_KINDS.flatMap((kind) => listNotebookItems(kind));
}

describe('notebook cards, questions, and ideas', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('makes, edits, and deletes a card from the panel, validating first', async () => {
    const page = learningPage();
    renderNotebook(`/notebook?section=learning&page=${page.id}`);

    const cardsTab = within(panel()).getByRole('tab', { name: /Cards/ });
    expect(cardsTab).toHaveAttribute('aria-selected', 'true');
    expect(cardsTab).toHaveTextContent('0');
    fireEvent.click(within(panel()).getByRole('button', { name: 'New card' }));

    const dialog = screen.getByRole('dialog', { name: 'Make a card' });
    await waitFor(() => expect(within(dialog).getByLabelText('Prompt')).toHaveFocus());
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save card' }));
    expect(within(dialog).getByText('Write the prompt you want to answer from memory.')).toBeInTheDocument();
    expect(allItems()).toEqual([]);

    fireEvent.change(within(dialog).getByLabelText('Prompt'), { target: { value: 'Why price on value?' } });
    fireEvent.change(within(dialog).getByLabelText('Answer'), { target: { value: 'It ties price to results.' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save card' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(panel()).getByRole('heading', { name: 'Why price on value?' })).toBeInTheDocument();
    expect(within(panel()).getByRole('tab', { name: /Cards/ })).toHaveTextContent('1');
    expect(listNotebookItems('card')[0]).toMatchObject({ pageId: page.id, sourceText: '' });

    fireEvent.click(within(panel()).getByRole('button', { name: 'Edit card: Why price on value?' }));
    const editDialog = screen.getByRole('dialog', { name: 'Edit card' });
    fireEvent.change(within(editDialog).getByLabelText('Prompt'), { target: { value: 'Why value pricing?' } });
    fireEvent.click(within(editDialog).getByRole('button', { name: 'Save changes' }));
    expect(within(panel()).getByRole('heading', { name: 'Why value pricing?' })).toBeInTheDocument();

    fireEvent.click(within(panel()).getByRole('button', { name: 'Delete card: Why value pricing?' }));
    expect(within(panel()).getByRole('button', { name: 'Keep' })).toHaveFocus();
    fireEvent.click(within(panel()).getByRole('button', { name: 'Delete' }));
    expect(listNotebookItems('card')).toEqual([]);
    expect(within(panel()).getByRole('button', { name: 'New card' })).toHaveFocus();
  });

  it('saves a question and an idea from their tabs', () => {
    const page = learningPage();
    renderNotebook(`/notebook?section=learning&page=${page.id}`);

    fireEvent.click(within(panel()).getByRole('tab', { name: /Questions/ }));
    fireEvent.click(within(panel()).getByRole('button', { name: 'New question' }));
    let dialog = screen.getByRole('dialog', { name: 'Save a question' });
    fireEvent.change(within(dialog).getByLabelText('Question'), { target: { value: 'Who is the buyer?' } });
    fireEvent.click(within(dialog).getByLabelText('Answered'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save question' }));
    expect(within(panel()).getByText('Answered')).toBeInTheDocument();

    fireEvent.click(within(panel()).getByRole('tab', { name: /Ideas/ }));
    fireEvent.click(within(panel()).getByRole('button', { name: 'New idea' }));
    dialog = screen.getByRole('dialog', { name: 'Save an idea' });
    fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: 'Pricing calculator' } });
    fireEvent.change(within(dialog).getByLabelText('Category (optional)'), { target: { value: 'Product' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save idea' }));

    expect(within(panel()).getByRole('heading', { name: 'Pricing calculator' })).toBeInTheDocument();
    expect(listNotebookItems('question')[0]).toMatchObject({ text: 'Who is the buyer?', status: 'answered', pageId: page.id });
    expect(listNotebookItems('idea')[0]).toMatchObject({ title: 'Pricing calculator', category: 'Product' });
  });

  it('shows the source passage in its block, opening a folded block first', async () => {
    const page = learningPage({ whatClicked: textToDoc('Anchoring sets the reference price.') });
    createItem('card', {
      draft: { prompt: 'What does anchoring do?', answer: 'Sets the reference price.' },
      pageId: page.id,
      source: { text: 'sets the reference', blockKey: 'whatClicked' },
    });
    // Fold the block again: it opens on load because it has writing.
    renderNotebook(`/notebook?section=learning&page=${page.id}`);
    const toggle = await screen.findByRole('button', { name: /^What clicked/ });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(within(panel()).getByRole('button', { name: /^Show source in What clicked: sets the reference/ }));

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const editor = editorFor('What clicked');
    const { from, to } = editor.state.selection;
    expect(editor.state.doc.textBetween(from, to)).toBe('sets the reference');
  });

  it('lists items from every page, linking back to where each came from', () => {
    const pricing = learningPage();
    const other = createNotebookPage({ section: 'learning', title: 'Hiring' });
    createItem('idea', { draft: { title: 'Interview kit', description: '', category: '' }, pageId: other.id });
    createItem('idea', { draft: { title: 'Orphaned idea', description: '', category: '' }, pageId: 'deleted-page' });
    renderNotebook(`/notebook?section=learning&page=${pricing.id}`);

    fireEvent.click(within(panel()).getByRole('tab', { name: /Ideas/ }));
    expect(within(panel()).queryByRole('heading', { name: 'Interview kit' })).not.toBeInTheDocument();

    fireEvent.click(within(panel()).getByRole('button', { name: 'All pages' }));
    expect(within(panel()).getByRole('link', { name: 'Hiring' })).toHaveAttribute('href', `/notebook?section=learning&page=${other.id}`);
    expect(within(panel()).getByText('From a deleted page')).toBeInTheDocument();
  });

  it('collapses the panel to counts and reopens it on the chosen tab', () => {
    const page = learningPage();
    createItem('question', { draft: { text: 'Who is the buyer?', answer: '', status: 'unanswered' }, pageId: page.id });
    renderNotebook(`/notebook?section=learning&page=${page.id}`);

    fireEvent.click(screen.getByRole('button', { name: 'Hide the cards, questions, and ideas panel' }));
    expect(screen.queryByRole('complementary', { name: 'Cards, questions, and ideas' })).not.toBeInTheDocument();
    expect(window.localStorage.getItem('ceo-os-notebook-panel-collapsed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Show questions (1)' }));
    expect(within(panel()).getByRole('tab', { name: /Questions/ })).toHaveAttribute('aria-selected', 'true');
  });

  // Reuse audit guard: notes and study items are independent records.
  it('never creates or removes items as a side effect of writing, formatting, or deleting notes', async () => {
    const page = learningPage();
    const kept = createItem('card', { draft: { prompt: 'Kept?', answer: 'Yes' }, pageId: page.id });
    const before = allItems();
    renderNotebook(`/notebook?section=learning&page=${page.id}`);
    await screen.findByRole('textbox', { name: 'My Notes' });

    act(() => {
      const editor = editorFor('My Notes');
      editor.commands.insertContent('Value pricing anchors on outcomes.');
      editor.chain().selectAll().toggleHighlight().toggleUnderline().run();
      editor.commands.clearContent(true);
    });
    await waitFor(() => expect(screen.getByText(/^Saved on this device/)).toBeInTheDocument(), { timeout: 3000 });
    expect(allItems()).toEqual(before);

    fireEvent.click(screen.getByRole('button', { name: 'Delete page' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm delete' }));
    expect(listSectionPages('learning')).toEqual([]);
    expect(allItems().map((item) => item.id)).toEqual([kept.id]);
  });
});
