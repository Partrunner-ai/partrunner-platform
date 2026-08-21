import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';
import { Input } from './Input';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from './Popover';
import { DialogContent, DialogRoot, DialogTitle } from './DialogPrimitives';

function FilterPopover({ align }: { align?: 'start' | 'center' | 'end' } = {}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary">Filters</Button>
      </PopoverTrigger>
      <PopoverContent align={align}>
        <PopoverHeader>
          <PopoverTitle>Filter routes</PopoverTitle>
          <PopoverDescription>Narrow the list down.</PopoverDescription>
        </PopoverHeader>
        <Input label="Destination" name="destination" />
      </PopoverContent>
    </Popover>
  );
}

describe('Popover', () => {
  it('toggles from its trigger and exposes the panel as a dialog', async () => {
    const user = userEvent.setup();
    render(<FilterPopover />);
    const trigger = screen.getByRole('button', { name: 'Filters' });

    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    await user.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Filter routes')).toBeTruthy();

    await user.click(trigger);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('moves focus to the first control, because Tab cannot reach a portal', async () => {
    const user = userEvent.setup();
    render(<FilterPopover />);

    await user.click(screen.getByRole('button', { name: 'Filters' }));

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText('Destination')),
    );
  });

  it('leaves focus alone when the panel is only informational', async () => {
    const user = userEvent.setup();
    render(
      <Popover>
        <PopoverTrigger>Why?</PopoverTrigger>
        <PopoverContent autoFocus={false}>Routes are grouped by carrier.</PopoverContent>
      </Popover>,
    );
    const trigger = screen.getByRole('button', { name: 'Why?' });

    await user.click(trigger);

    expect(screen.getByRole('dialog')).toBeTruthy();
    // Stealing focus for a sentence of prose is the wrong thing; the trigger keeps it.
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps its fields as real tab stops rather than trapping like a menu', async () => {
    const user = userEvent.setup();
    render(
      <Popover>
        <PopoverTrigger>Filters</PopoverTrigger>
        <PopoverContent>
          <Input label="From" name="from" />
          <Input label="To" name="to" />
        </PopoverContent>
      </Popover>,
    );

    await user.click(screen.getByRole('button', { name: 'Filters' }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('From')));

    await user.keyboard('{Tab}');

    // Unlike DropdownMenu, Tab walks the content instead of dismissing it.
    expect(document.activeElement).toBe(screen.getByLabelText('To'));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('dismisses on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<FilterPopover />);
    const trigger = screen.getByRole('button', { name: 'Filters' });

    await user.click(trigger);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('dismisses on an outside click', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <FilterPopover />
        <button type="button">Elsewhere</button>
      </div>,
    );

    await user.click(screen.getByRole('button', { name: 'Filters' }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('accepts every documented alignment without dropping it onto the DOM node', async () => {
    const user = userEvent.setup();
    for (const align of ['start', 'center', 'end'] as const) {
      const view = render(<FilterPopover align={align} />);
      await user.click(screen.getByRole('button', { name: 'Filters' }));
      const panel = screen.getByRole('dialog');

      expect(panel.getAttribute('align')).toBeNull();
      expect(panel.style.position).toBe('fixed');
      view.unmount();
    }
  });

  it('emits no padding class when the panel owns its own spacing', async () => {
    const user = userEvent.setup();
    render(
      <Popover>
        <PopoverTrigger>Filters</PopoverTrigger>
        <PopoverContent padding="none" autoFocus={false} className="p-0">
          rows
        </PopoverContent>
      </Popover>,
    );

    await user.click(screen.getByRole('button', { name: 'Filters' }));
    const panel = screen.getByRole('dialog');

    // `none` must emit *nothing*, not `padding: 0`. These rules are unlayered, so a
    // package `padding` beats the consumer's `p-0` (which lives in @layer utilities)
    // and cannot be switched off from the call site. Absence composes; zero fights.
    expect(panel.className).not.toContain('pr-popover__content--pad');
    expect(panel.className).toContain('p-0');
    expect(panel.getAttribute('data-padding')).toBe('none');
  });

  it('keeps the default inset for a panel that does not opt out', async () => {
    const user = userEvent.setup();
    render(<FilterPopover />);

    await user.click(screen.getByRole('button', { name: 'Filters' }));

    expect(screen.getByRole('dialog').className).toContain('pr-popover__content--pad-md');
  });

  it('sizes the panel to its trigger when asked, and to its content otherwise', async () => {
    const user = userEvent.setup();
    const view = render(
      <Popover matchTriggerWidth>
        <PopoverTrigger>Contrato</PopoverTrigger>
        <PopoverContent align="start" padding="none" autoFocus={false}>
          rows
        </PopoverContent>
      </Popover>,
    );

    await user.click(screen.getByRole('button', { name: 'Contrato' }));
    // The engine writes a fixed `width` for trigger-matched panels and a
    // min/max pair otherwise. This is what replaces Radix's
    // `w-[--radix-popover-trigger-width]`, which was a vendor variable.
    expect(screen.getByRole('dialog').style.width).not.toBe('');
    view.unmount();

    render(<FilterPopover />);
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    const contentSized = screen.getByRole('dialog');
    expect(contentSized.style.width).toBe('');
    expect(contentSized.style.minWidth).not.toBe('');
  });

  it('supports controlled visibility, which the date filters use', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    function Controlled() {
      const [open, setOpen] = useState(false);
      return (
        <Popover
          open={open}
          onOpenChange={(next) => {
            onOpenChange(next);
            setOpen(next);
          }}
        >
          <PopoverTrigger>Dates</PopoverTrigger>
          <PopoverContent align="start" autoFocus={false}>
            <button type="button" onClick={() => setOpen(false)}>
              Apply
            </button>
          </PopoverContent>
        </Popover>
      );
    }
    render(<Controlled />);

    await user.click(screen.getByRole('button', { name: 'Dates' }));
    expect(onOpenChange).toHaveBeenLastCalledWith(true);

    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not open from a disabled trigger', async () => {
    const user = userEvent.setup();
    render(
      <Popover>
        <PopoverTrigger disabled>Filters</PopoverTrigger>
        <PopoverContent>Nothing here</PopoverContent>
      </Popover>,
    );

    await user.click(screen.getByRole('button', { name: 'Filters' }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens inside a dialog and closes without taking the dialog with it', async () => {
    const user = userEvent.setup();
    render(
      <DialogRoot defaultOpen>
        <DialogContent>
          <DialogTitle>Edit route</DialogTitle>
          <FilterPopover />
        </DialogContent>
      </DialogRoot>,
    );

    await user.click(screen.getByRole('button', { name: 'Filters' }));
    await waitFor(() => expect(screen.getByLabelText('Destination')).toBeTruthy());
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByLabelText('Destination')).toBeNull());
    // The dialog is the surface the popover escaped; Escape inside the popover is
    // not an Escape for the dialog.
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
