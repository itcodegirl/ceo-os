import { createPortal } from 'react-dom';
import { useEffect, useId, useRef } from 'react';
import Button from './Button';

const FOCUSABLE_SELECTORS =
  'a[href], area[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

// All dialogs share one keyboard, background, and scroll-lock owner.
const modalStack = [];
const originalInert = new Map();
let bodyOverflow = '';
let backgroundObserver;
function syncModalBackground() {
  const top = modalStack.at(-1);
  if (!top) return;
  for (const node of document.body.children) {
    if (!originalInert.has(node)) originalInert.set(node, node.hasAttribute('inert'));
    node.toggleAttribute('inert', node !== top.overlay || originalInert.get(node));
  }
  modalStack.forEach((entry, index) => {
    entry.overlay.style.zIndex = String(50 + index);
    if (entry !== top) entry.overlay.setAttribute('aria-hidden', 'true');
    else entry.overlay.removeAttribute('aria-hidden');
  });
}
function registerModal(entry) {
  if (!modalStack.length) {
    bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    backgroundObserver = new MutationObserver(syncModalBackground);
    backgroundObserver.observe(document.body, { childList: true });
  }
  modalStack.push(entry);
  syncModalBackground();
}
function unregisterModal(entry) {
  const wasTop = modalStack.at(-1) === entry;
  const index = modalStack.indexOf(entry);
  if (index >= 0) modalStack.splice(index, 1);
  if (modalStack.length) syncModalBackground();
  else {
    backgroundObserver?.disconnect();
    for (const [node, inert] of originalInert) node.toggleAttribute('inert', inert);
    originalInert.clear();
    document.body.style.overflow = bodyOverflow;
  }
  return wasTop;
}

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

/**
 * Accessible dialog. `initialFocusRef` picks the element focused on open
 * (default: the first focusable one); each `className` is added to the panel,
 * and to the overlay with an `-overlay` suffix, so a caller can restyle the
 * dialog, e.g. as a side or bottom sheet.
 */
function Modal({ isOpen, title, onClose, children, className = '', initialFocusRef }) {
  const titleId = useId();
  const overlayRef = useRef(null);
  const panelRef = useRef(null);
  const focusReturnRef = useRef(null);
  // Read through a ref so a parent passing a new onClose each render does not
  // re-run the open effect (which would move focus back to the start).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    focusReturnRef.current = document.activeElement;
    const entry = { overlay: overlayRef.current, panel: panelRef.current };
    registerModal(entry);

    const handleKeyDown = (event) => {
      if (modalStack.at(-1) !== entry) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current?.();
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

      if (!panelRef.current?.contains(active)) {
        event.preventDefault();
        (isShift ? lastElement : firstElement).focus();
      } else if (isShift && active === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!isShift && active === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    const requestInitialFocus = () => {
      // Opening focus runs on the next frame. Respect a control the user
      // already focused in the meantime (including in a child dialog).
      if (modalStack.at(-1) !== entry || panelRef.current?.contains(document.activeElement)) return;
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
        return;
      }
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
      if (!unregisterModal(entry)) return;

      const focusTarget = focusReturnRef.current;
      if (focusTarget && typeof focusTarget.focus === 'function' && focusTarget.isConnected && !focusTarget.closest('[inert]')) {
        focusTarget.focus();
        return;
      }

      const activePanel = modalStack.at(-1)?.panel;
      if (activePanel) { (getFocusableElements(activePanel)[0] || activePanel).focus(); return; }

      // The element that opened the dialog left the DOM while the dialog was
      // open (a common case — e.g. a row action button whose row re-rendered).
      // Don't strand keyboard focus on <body>; hand it back to the main
      // landmark, which is focusable via tabIndex="-1".
      if (typeof document !== 'undefined') {
        const mainContent = document.getElementById('main-content');
        mainContent?.focus?.();
      }
    };
  }, [isOpen, initialFocusRef]);

  if (!isOpen) {
    return null;
  }

  const hasTitle = Boolean(title && String(title).trim().length > 0);
  const fallbackTitle = 'Dialog';

  const handleOverlayClick = (event) => {
    if (event.target === overlayRef.current) {
      onCloseRef.current?.();
    }
  };

  return createPortal(
    <div
      ref={overlayRef}
      className={['modal-overlay', ...className.split(/\s+/).filter(Boolean).map((name) => `${name}-overlay`)].join(' ')}
      onMouseDown={handleOverlayClick}
    >
      <div
        ref={panelRef}
        className={`modal-panel ${className}`.trim()}
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
    </div>, document.body,
  );
}

export default Modal;
