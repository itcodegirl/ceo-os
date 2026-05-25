import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Modal from './Modal';

function ModalContent() {
  return (
    <div>
      <button type="button">First action</button>
      <button type="button">Last action</button>
    </div>
  );
}

describe('src/components/ui/Modal', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('traps focus in the modal with Tab and Shift+Tab', async () => {
    const onClose = vi.fn();

    render(
      <Modal isOpen title="Confirm delete" onClose={onClose}>
        <ModalContent />
      </Modal>,
    );

    const closeButton = screen.getByRole('button', { name: 'Close dialog' });
    const lastActionButton = screen.getByRole('button', { name: 'Last action' });

    await waitFor(() => {
      expect(closeButton).toHaveFocus();
    });

    lastActionButton.focus();
    expect(lastActionButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(lastActionButton).toHaveFocus();
  });

  it('restores focus to the previously active element after closing', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <div>
        <button type="button">Open modal</button>
        <Modal isOpen={false} title="Confirm delete" onClose={onClose}>
          <ModalContent />
        </Modal>
      </div>,
    );

    const triggerButton = screen.getByRole('button', { name: 'Open modal' });
    triggerButton.focus();
    expect(triggerButton).toHaveFocus();

    rerender(
      <div>
        <button type="button">Open modal</button>
        <Modal isOpen title="Confirm delete" onClose={onClose}>
          <ModalContent />
        </Modal>
      </div>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <div>
        <button type="button">Open modal</button>
        <Modal isOpen={false} title="Confirm delete" onClose={onClose}>
          <ModalContent />
        </Modal>
      </div>,
    );

    expect(triggerButton).toHaveFocus();
  });

  it('falls back to the main landmark when the opening element has unmounted', () => {
    const onClose = vi.fn();
    const main = document.createElement('main');
    main.id = 'main-content';
    main.setAttribute('tabindex', '-1');
    document.body.appendChild(main);

    try {
      function Trigger() {
        return <button type="button">Row action</button>;
      }

      const { rerender } = render(
        <div>
          <Trigger />
          <Modal isOpen={false} title="Confirm delete" onClose={onClose}>
            <ModalContent />
          </Modal>
        </div>,
      );

      screen.getByRole('button', { name: 'Row action' }).focus();

      rerender(
        <div>
          <Trigger />
          <Modal isOpen title="Confirm delete" onClose={onClose}>
            <ModalContent />
          </Modal>
        </div>,
      );

      // The trigger leaves the DOM while the dialog is open.
      rerender(
        <div>
          <Modal isOpen title="Confirm delete" onClose={onClose}>
            <ModalContent />
          </Modal>
        </div>,
      );

      rerender(
        <div>
          <Modal isOpen={false} title="Confirm delete" onClose={onClose}>
            <ModalContent />
          </Modal>
        </div>,
      );

      expect(main).toHaveFocus();
    } finally {
      document.body.removeChild(main);
    }
  });
});
