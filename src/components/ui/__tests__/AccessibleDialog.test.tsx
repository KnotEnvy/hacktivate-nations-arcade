import { fireEvent, render, screen } from '@testing-library/react';
import { AccessibleDialog } from '../AccessibleDialog';

describe('AccessibleDialog', () => {
  it('exposes modal semantics, closes with Escape, and restores focus', () => {
    const onClose = jest.fn();
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = render(
      <AccessibleDialog titleId="dialog-title" onClose={onClose}>
        <h2 id="dialog-title">Settings</h2>
        <button type="button">First action</button>
      </AccessibleDialog>
    );

    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'First action' })).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });
});
