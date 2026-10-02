import { useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Modal from '../ui/Modal';
import { normalizeLinkHref } from '../../lib/notebook/links';

/** Names a new page in a named section (and, for Learning, its source). */
function NewPageDialog({ section, onCancel, onCreate }) {
  const [title, setTitle] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [errors, setErrors] = useState({});

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!title.trim()) nextErrors.title = 'Give the page a title.';
    if (sourceUrl.trim() && !normalizeLinkHref(sourceUrl)) nextErrors.sourceUrl = 'Enter a web address, or leave it empty.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onCreate({ title: title.trim(), sourceUrl: sourceUrl.trim() ? normalizeLinkHref(sourceUrl) : '' });
  };

  return (
    <Modal isOpen title={`New ${section.label} page`} onClose={onCancel}>
      <form className="notebook-new-page" onSubmit={handleSubmit} noValidate>
        <Input
          label="Title"
          value={title}
          maxLength={160}
          autoFocus
          error={errors.title}
          onChange={(event) => setTitle(event.target.value)}
        />
        {section.sourceLink ? (
          <Input
            label="Source link (optional)"
            type="url"
            inputMode="url"
            placeholder="https://"
            value={sourceUrl}
            error={errors.sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
          />
        ) : null}
        <div className="notebook-new-page__actions">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button type="submit">Create page</Button>
        </div>
      </form>
    </Modal>
  );
}

export default NewPageDialog;
