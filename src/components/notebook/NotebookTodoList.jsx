import { Trash } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../ui/Button';
import { useToast } from '../../hooks/useToast';
import {
  createReminder,
  deleteReminder,
  isReminderSnoozed,
  REMINDER_SOURCE_NOTEBOOK_PAGE,
  toggleReminder,
} from '../../lib/remindersRepository';
import { truncate } from '../../lib/notebook/items/itemModels';

/** Where a to-do from another page came from, linked back to it. */
function TodoOrigin({ reminder, page }) {
  if (reminder.sourceType !== REMINDER_SOURCE_NOTEBOOK_PAGE) {
    return <span className="notebook-todo__origin">Reminder</span>;
  }
  if (reminder.sourceId === page.id) {
    return <span className="notebook-todo__origin">This page</span>;
  }
  return reminder.sourceHref ? (
    <Link className="notebook-todo__origin" to={reminder.sourceHref}>{reminder.sourceTitle || 'Notebook page'}</Link>
  ) : (
    <span className="notebook-todo__origin">{reminder.sourceTitle || 'Notebook page'}</span>
  );
}

/**
 * The Lists tab: this page's to-dos (open and done), or every open reminder
 * across CEO OS. To-dos are reminders, so they also show on Focus Home.
 */
function NotebookTodoList({ reminders, page, source, scope, newButtonId }) {
  const { showToast } = useToast();
  const inputId = useId();
  const inputRef = useRef(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const shown = scope === 'all'
    ? reminders.filter((reminder) => !reminder.isDone)
    : reminders.filter((reminder) => reminder.sourceType === REMINDER_SOURCE_NOTEBOOK_PAGE && reminder.sourceId === page.id);

  const add = (event) => {
    event.preventDefault();
    if (!text.trim()) {
      setError('Write the to-do first.');
      inputRef.current?.focus();
      return;
    }
    try {
      createReminder({ text, source });
      setText('');
      setError('');
    } catch {
      setError('Could not save this to-do on this device.');
    }
  };

  const run = (action, failure) => {
    try {
      action();
    } catch {
      showToast(failure);
    }
  };

  return (
    <div className="notebook-todos">
      <form className="notebook-todos__add" onSubmit={add} noValidate>
        <label htmlFor={inputId} className="sr-only">New to-do for this page</label>
        <input
          id={inputId}
          ref={inputRef}
          className="input-field__control"
          placeholder="Add a to-do for this page"
          maxLength={500}
          value={text}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          onChange={(event) => {
            setText(event.target.value);
            setError('');
          }}
        />
        <Button id={newButtonId} type="submit" size="small">Add</Button>
        {error ? <span id={`${inputId}-error`} className="input-field__error" role="alert">{error}</span> : null}
      </form>

      {shown.length === 0 ? (
        <p className="notebook-panel__empty-text">
          {scope === 'all'
            ? 'Nothing open. Everything is done.'
            : 'No to-dos from this page yet. Add one above, or select writing and choose To-do.'}
        </p>
      ) : (
        <ul className="notebook-todos__list">
          {shown.map((reminder) => {
            const label = truncate(reminder.text, 60);
            return (
              <li key={reminder.id} className="notebook-todo" data-done={reminder.isDone || undefined}>
                <label className="notebook-todo__check">
                  <input
                    type="checkbox"
                    checked={reminder.isDone}
                    onChange={(event) => run(() => toggleReminder(reminder.id, event.target.checked), 'Unable to update this to-do right now.')}
                  />
                  <span className="notebook-todo__text">{reminder.text}</span>
                </label>
                <div className="notebook-todo__meta">
                  {scope === 'all' ? <TodoOrigin reminder={reminder} page={page} /> : null}
                  {isReminderSnoozed(reminder) ? <span className="notebook-todo__origin">Snoozed</span> : null}
                  <button
                    type="button"
                    className="notebook-icon-button"
                    aria-label={`Delete to-do: ${label}`}
                    title="Delete"
                    onClick={() => {
                      run(() => deleteReminder(reminder.id), 'Unable to delete this to-do right now.');
                      document.getElementById(newButtonId)?.focus();
                    }}
                  >
                    <Trash aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default NotebookTodoList;
