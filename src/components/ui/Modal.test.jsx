import { useState } from 'react';
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

  it('does not steal focus already placed inside the dialog before its opening frame', () => {
    let openingFrame;
    const frameSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      openingFrame = callback;
      return 1;
    });
    try {
      render(<Modal isOpen title="Actions" onClose={vi.fn()}><ModalContent /></Modal>);
      const action = screen.getByRole('button', { name: 'Last action' });
      action.focus();
      openingFrame();
      expect(action).toHaveFocus();
    } finally {
      frameSpy.mockRestore();
    }
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

function NestedDialogs() {
  const [details, showDetails] = useState(false);
  const [edit, showEdit] = useState(false);
  return <>
    <button onClick={() => showDetails(true)}>Open details</button>
    <Modal isOpen={details} title="Details" onClose={() => showDetails(false)}>
      <button onClick={() => showEdit(true)}>Edit record</button>
      <Modal isOpen={edit} title="Edit" onClose={() => showEdit(false)}><input aria-label="Draft" /></Modal>
    </Modal>
  </>;
}
it('keeps only the top dialog interactive and restores focus and scroll ownership on each Escape', async () => {
  const view = render(<NestedDialogs />);
  const opener = screen.getByRole('button', { name: 'Open details' });
  opener.focus(); fireEvent.click(opener);
  const editButton = screen.getByRole('button', { name: 'Edit record' });
  editButton.focus(); fireEvent.click(editButton);
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(screen.getByRole('dialog')).toHaveAccessibleName('Edit');
  expect(view.container).toHaveAttribute('inert');
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.getByRole('dialog')).toHaveAccessibleName('Details');
  expect(editButton).toHaveFocus();
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
  expect(view.container).not.toHaveAttribute('inert');
  expect(document.body.style.overflow).toBe('');
});
