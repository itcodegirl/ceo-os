import { useEffect, useId, useRef } from 'react';
import Button from './Button';

const FOCUSABLE_SELECTORS =
  'a[href], area[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

function getFocusableElements(root) {
  if (!root) {
    return [];
  }

  return Array.from(root.querySelectorAll(FOCUSABLE_SELECTORS)).filter((element) => {
    const isDisabled = element.hasAttribute('disabled');
    const isHidden = element.getAttribute('aria-hidden') === 'true';
    const isTabbable = element.tabIndex >= 0;
    return !isDisabled && !isHidden && isTabbable;
  });
}

function Modal({ isOpen, title, onClose, children }) {
  const titleId = useId();
  const overlayRef = useRef(null);
  const panelRef = useRef(null);
  const focusReturnRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    focusReturnRef.current = document.activeElement;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusable = getFocusableElements(panelRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];
      const isShift = event.shiftKey;
      const active = document.activeElement;

      if (isShift && active === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!isShift && active === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    const requestInitialFocus = () => {
      if (panelRef.current) {
        const focusable = getFocusableElements(panelRef.current);
        const firstFocusable = focusable[0];
        (firstFocusable ?? panelRef.current).focus?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const initialFocusFrame = requestAnimationFrame(requestInitialFocus);

    return () => {
      cancelAnimationFrame(initialFocusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousBodyOverflow || '';

      const focusTarget = focusReturnRef.current;
      if (focusTarget && typeof focusTarget.focus === 'function' && focusTarget.isConnected) {
        focusTarget.focus();
        return;
      }

      // The element that opened the dialog left the DOM while the dialog was
      // open (a common case — e.g. a row action button whose row re-rendered).
      // Don't strand keyboard focus on <body>; hand it back to the main
      // landmark, which is focusable via tabIndex="-1".
      if (typeof document !== 'undefined') {
        const mainContent = document.getElementById('main-content');
        mainContent?.focus?.();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const hasTitle = Boolean(title && String(title).trim().length > 0);
  const fallbackTitle = 'Dialog';

  const handleOverlayClick = (event) => {
    if (event.target === overlayRef.current) {
      onClose?.();
    }
  };

  return (
    <div
      ref={overlayRef}
      className="modal-overlay"
      onMouseDown={handleOverlayClick}
    >
      <div
        ref={panelRef}
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={hasTitle ? titleId : undefined}
        aria-label={!hasTitle ? fallbackTitle : undefined}
        tabIndex={-1}
      >
        <header className="modal-panel__header">
          <h3 id={titleId}>{hasTitle ? title : fallbackTitle}</h3>
          <Button
            type="button"
            size="small"
            onClick={() => onClose?.()}
            ariaLabel="Close dialog"
            icon={{ name: 'close', size: 12 }}
          >
            Close
          </Button>
        </header>
        <div className="modal-panel__body">{children}</div>
      </div>
    </div>
  );
}

export default Modal;
