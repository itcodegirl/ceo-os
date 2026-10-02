import { useEffect, useId, useRef, useState } from 'react';
import Button from '../ui/Button';
import { normalizeLinkHref } from '../../lib/notebook/links';

/** Small popover form for adding, changing, or removing a link in a block. */
function LinkEditor({ editor, anchorRef, onClose }) {
  const id = useId();
  const formRef = useRef(null);
  const inputRef = useRef(null);
  const [value, setValue] = useState(() => {
    const href = editor.getAttributes('link').href;
    return typeof href === 'string' ? href : '';
  });
  const [error, setError] = useState('');
  const [hasLink] = useState(() => editor.isActive('link'));
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    const closeOnOutsidePointer = (event) => {
      if (formRef.current?.contains(event.target) || anchorRef.current?.contains(event.target)) return;
      onCloseRef.current(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [anchorRef]);

  const apply = (event) => {
    event.preventDefault();
    const href = normalizeLinkHref(value);
    if (!href) {
      setError('Enter a web address, for example codeherway.com.');
      inputRef.current?.focus();
      return;
    }
    if (editor.state.selection.empty && !editor.isActive('link')) {
      editor.chain().focus().insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }
    onClose(false);
  };

  const removeLink = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    onClose(false);
  };

  return (
    <form
      ref={formRef}
      className="notebook-link-editor"
      aria-label="Link"
      noValidate
      onSubmit={apply}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onClose(true);
        }
      }}
    >
      <label htmlFor={id} className="input-field__label">Link address</label>
      <div className="notebook-link-editor__row">
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          className={`input-field__control ${error ? 'input-field__control--error' : ''}`}
          placeholder="https://"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError('');
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <Button type="submit" size="small">Apply</Button>
        {hasLink ? (
          <Button size="small" variant="ghost" onClick={removeLink}>Remove</Button>
        ) : null}
      </div>
      {error ? <p id={`${id}-error`} className="input-field__error" role="alert">{error}</p> : null}
    </form>
  );
}

export default LinkEditor;
