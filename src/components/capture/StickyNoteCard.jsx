import Button from '../ui/Button';

/**
 * Single sticky-note card used by the Capture wall. Owns its own DOM
 * markup so Capture.jsx stays composition-only and the per-note action
 * surface (edit text, edit category, promote, delete) lives in one place.
 *
 * No state of its own — values and handlers come from the parent.
 */
function StickyNoteCard({
  note,
  categoryOptions,
  formatCategoryLabel,
  formatRelativeDate,
  onEdit,
  onPromoteToReminder,
  onPromoteToOpportunity,
  onPromoteToContentDraft,
  onDelete,
}) {
  const categoryLabel = formatCategoryLabel(note.category);
  const promotedTo = typeof note.promotedTo === 'string' ? note.promotedTo : '';
  const promotedLabel = promotedTo
    ? `Promoted to ${promotedTo === 'content' ? 'content draft' : promotedTo}`
    : '';

  return (
    <article className={promotedTo ? 'sticky-note sticky-note--promoted' : 'sticky-note'}>
      <header className="sticky-note__meta">
        <span className="sticky-note__tag">{categoryLabel}</span>
        {promotedLabel ? (
          <span className="sticky-note__promoted-tag" aria-label={promotedLabel}>
            {promotedLabel}
          </span>
        ) : null}
        <span className="helper-text">{formatRelativeDate(note.updatedAt)}</span>
      </header>
      <label htmlFor={`capture-note-${note.id}`} className="sr-only">
        Edit note
      </label>
      <textarea
        id={`capture-note-${note.id}`}
        className="form-input"
        value={note.text}
        rows={4}
        onChange={(event) => onEdit(note.id, {
          text: event.target.value,
          category: note.category,
        })}
      />
      <div className="sticky-note__controls">
        <label htmlFor={`capture-category-${note.id}`} className="sr-only">
          Edit note category
        </label>
        <select
          id={`capture-category-${note.id}`}
          className="form-input"
          value={note.category}
          onChange={(event) => onEdit(note.id, {
            text: note.text,
            category: event.target.value,
          })}
        >
          {categoryOptions.map((option) => (
            <option key={option} value={option}>
              {formatCategoryLabel(option)}
            </option>
          ))}
        </select>
        {typeof onPromoteToReminder === 'function' ? (
          <Button
            type="button"
            variant="ghost"
            size="small"
            icon={{ name: 'check', size: 14 }}
            onClick={() => onPromoteToReminder(note)}
            ariaLabel={`Make a reminder from ${categoryLabel} note`}
          >
            Make reminder
          </Button>
        ) : null}
        {typeof onPromoteToOpportunity === 'function' ? (
          <Button
            type="button"
            variant="ghost"
            size="small"
            icon={{ name: 'opportunities', size: 14 }}
            onClick={() => onPromoteToOpportunity(note)}
            ariaLabel={`Track ${categoryLabel} note as a new opportunity`}
          >
            Track opportunity
          </Button>
        ) : null}
        {typeof onPromoteToContentDraft === 'function' ? (
          <Button
            type="button"
            variant="ghost"
            size="small"
            icon={{ name: 'content', size: 14 }}
            onClick={() => onPromoteToContentDraft(note)}
            ariaLabel={`Draft ${categoryLabel} note on Content OS`}
          >
            Draft as content
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="small"
          icon={{ name: 'delete' }}
          onClick={() => onDelete(note.id)}
          ariaLabel={`Delete ${categoryLabel} note`}
        >
          Delete
        </Button>
      </div>
    </article>
  );
}

export default StickyNoteCard;
