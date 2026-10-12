import { useId, useRef, useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Modal from '../ui/Modal';
import Textarea from '../ui/Textarea';
import {
  CARD_LIMITS,
  draftFor,
  findCardWithSamePrompt,
  hasErrors,
  IDEA_CATEGORY_SUGGESTIONS,
  IDEA_LIMITS,
  ITEM_LABELS,
  QUESTION_LIMITS,
  QUESTION_STATUS_LABELS,
  truncate,
  validateItemDraft,
} from '../../lib/notebook/items/itemModels';
import { createItem, updateItem } from '../../lib/notebook/items/notebookItemsRepository';
import KindIcon from './KindIcon';

const TITLES = {
  card: { create: 'Make a card', edit: 'Edit card' },
  question: { create: 'Save a question', edit: 'Edit question' },
  idea: { create: 'Save an idea', edit: 'Edit idea' },
};

/** Accessible description: the hint, plus the error once there is one. */
function describedBy(id, hintId, error) {
  return [hintId, error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
}

/**
 * The only way a card, question, or idea is made or changed: the learner
 * shapes it and presses Save. Input is kept if saving fails.
 */
function ItemComposer({ kind, existing, source, sourceLabel, pageId, cards = [], onClose }) {
  const fieldId = useId();
  const hintId = `${fieldId}-hint`;
  const idFor = (name) => `${fieldId}-${name}`;
  const firstFieldRef = useRef(null);
  const secondFieldRef = useRef(null);
  const [draft, setDraft] = useState(() => draftFor(kind, existing, source));
  const [errors, setErrors] = useState({});
  const [saveFailed, setSaveFailed] = useState(false);
  const labels = ITEM_LABELS[kind];
  const duplicate = kind === 'card' ? findCardWithSamePrompt(cards, draft.prompt, existing?.id) : undefined;

  const change = (name) => (event) => {
    const { value } = event.target;
    setDraft((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const submit = () => {
    const nextErrors = validateItemDraft[kind](draft);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      // Only cards can fail on their second field (the answer).
      const secondInvalid = kind === 'card' && !nextErrors.prompt;
      (secondInvalid ? secondFieldRef : firstFieldRef).current?.focus();
      return;
    }
    try {
      if (existing) updateItem(kind, existing.id, draft);
      else createItem(kind, { draft, pageId, source });
    } catch {
      setSaveFailed(true);
      return;
    }
    onClose('saved');
  };

  const field = (name) => ({
    id: idFor(name),
    value: draft[name],
    error: errors[name],
    onChange: change(name),
  });

  return (
    <Modal
      isOpen
      title={(
        <span className="notebook-composer__title">
          <KindIcon kind={kind} />
          {existing ? TITLES[kind].edit : TITLES[kind].create}
        </span>
      )}
      onClose={() => onClose('cancelled')}
      className={`notebook-composer notebook-composer--${kind}`}
      initialFocusRef={firstFieldRef}
    >
      <form
        className="notebook-composer__form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            submit();
          }
        }}
      >
        {source ? (
          <figure className="notebook-composer__source">
            <figcaption className="helper-text">From {sourceLabel}</figcaption>
            <blockquote>{truncate(source.text, 320)}</blockquote>
          </figure>
        ) : null}

        {kind === 'card' ? (
          <>
            <p id={hintId} className="helper-text">A prompt you should be able to answer from memory, and its answer.</p>
            <Textarea
              label="Prompt"
              rows={2}
              maxLength={CARD_LIMITS.prompt}
              required
              ref={firstFieldRef}
              aria-describedby={describedBy(idFor('prompt'), hintId, errors.prompt)}
              {...field('prompt')}
            />
            {duplicate ? (
              <p className="helper-text notebook-composer__notice" role="status">
                You already have a card with this prompt. You can still save it.
              </p>
            ) : null}
            <Textarea
              label="Answer"
              rows={4}
              maxLength={CARD_LIMITS.answer}
              required
              ref={secondFieldRef}
              {...field('answer')}
            />
          </>
        ) : null}

        {kind === 'question' ? (
          <>
            <Textarea
              label="Question"
              rows={2}
              maxLength={QUESTION_LIMITS.text}
              required
              ref={firstFieldRef}
              {...field('text')}
            />
            <fieldset className="notebook-composer__status">
              <legend className="input-field__label">Status</legend>
              {Object.entries(QUESTION_STATUS_LABELS).map(([status, label]) => (
                <label key={status} className="notebook-composer__status-option">
                  <input
                    type="radio"
                    name={`${fieldId}-status`}
                    value={status}
                    checked={draft.status === status}
                    onChange={() => setDraft((current) => ({ ...current, status }))}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
            <Textarea label="Answer (optional)" rows={3} maxLength={QUESTION_LIMITS.answer} {...field('answer')} />
          </>
        ) : null}

        {kind === 'idea' ? (
          <>
            <p id={hintId} className="helper-text">A project, product, piece of content, or thing to try later.</p>
            <Input
              label="Title"
              maxLength={IDEA_LIMITS.title}
              required
              ref={firstFieldRef}
              aria-describedby={describedBy(idFor('title'), hintId, errors.title)}
              {...field('title')}
            />
            <Input
              label="Category (optional)"
              maxLength={IDEA_LIMITS.category}
              list={`${fieldId}-categories`}
              {...field('category')}
            />
            <datalist id={`${fieldId}-categories`}>
              {IDEA_CATEGORY_SUGGESTIONS.map((category) => <option key={category} value={category} />)}
            </datalist>
            <Textarea label="Description (optional)" rows={4} maxLength={IDEA_LIMITS.description} {...field('description')} />
          </>
        ) : null}

        {saveFailed ? (
          <p className="form-error" role="alert">
            Couldn&apos;t save this {labels.singular} on this device (storage may be full). Everything you typed is still here.
          </p>
        ) : null}

        <div className="notebook-composer__actions">
          <Button variant="ghost" onClick={() => onClose('cancelled')}>Cancel</Button>
          <Button type="submit">{existing ? 'Save changes' : `Save ${labels.singular}`}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default ItemComposer;
