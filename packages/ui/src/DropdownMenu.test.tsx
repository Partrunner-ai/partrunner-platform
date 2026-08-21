import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './DropdownMenu';
import { DialogContent, DialogRoot, DialogTitle } from './DialogPrimitives';

function SimpleMenu({ onSelect = vi.fn() }: { onSelect?: (value: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Actions">Actions</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Manage</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onSelect('edit')}>Edit</DropdownMenuItem>
        <DropdownMenuItem disabled onSelect={() => onSelect('archive')}>
          Archive
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={() => onSelect('delete')}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

describe('DropdownMenu', () => {
  it('opens from the trigger, selects a row and returns focus', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<SimpleMenu onSelect={onSelect} />);
    const trigger = screen.getByRole('button', { name: 'Actions' });

    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    await user.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));

    expect(onSelect).toHaveBeenCalledWith('edit');
    expect(screen.queryByRole('menu')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('moves focus through enabled rows only, and wraps', async () => {
    const user = userEvent.setup();
    render(<SimpleMenu />);

    await user.click(screen.getByRole('button', { name: 'Actions' }));
    // Opening with a click focuses the first row, so the menu is immediately usable
    // from the keyboard without a second Tab that would leave the portal.
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Edit' })));

    await user.keyboard('{ArrowDown}');
    // Archive is disabled, so it is skipped rather than being a dead stop.
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Delete' }));

    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Edit' }));

    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Delete' }));
  });

  it('opens on ArrowUp at the last row, and does not activate a disabled row', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<SimpleMenu onSelect={onSelect} />);
    const trigger = screen.getByRole('button', { name: 'Actions' });

    trigger.focus();
    await user.keyboard('{ArrowUp}');
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Delete' })),
    );

    await user.click(screen.getByRole('menuitem', { name: 'Archive' }));
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('jumps to a row by typing its first letters', async () => {
    const user = userEvent.setup();
    render(<SimpleMenu />);

    await user.click(screen.getByRole('button', { name: 'Actions' }));
    await waitFor(() => expect(screen.getByRole('menu')).toBeTruthy());
    await user.keyboard('de');

    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Delete' }));
  });

  it('dismisses on Escape and on Tab, restoring focus to the trigger both times', async () => {
    const user = userEvent.setup();
    render(<SimpleMenu />);
    const trigger = screen.getByRole('button', { name: 'Actions' });

    await user.click(trigger);
    await waitFor(() => expect(screen.getByRole('menu')).toBeTruthy());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(document.activeElement).toBe(trigger);

    await user.click(trigger);
    await waitFor(() => expect(screen.getByRole('menu')).toBeTruthy());
    // A menu is one tab stop: Tab dismisses rather than walking the rows, which is
    // what keeps focus from being stranded in a portal at the end of `body`.
    await user.keyboard('{Tab}');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps the menu open when a row cancels its own selection', async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Actions">Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={(event) => event.preventDefault()}>Stay</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole('button', { name: 'Actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Stay' }));

    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('lets a checkbox row toggle repeatedly without closing', async () => {
    const user = userEvent.setup();
    function Filters() {
      const [dense, setDense] = useState(false);
      return (
        <DropdownMenu>
          <DropdownMenuTrigger aria-label="View">View</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuCheckboxItem checked={dense} onCheckedChange={setDense}>
              Dense rows
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
    render(<Filters />);

    await user.click(screen.getByRole('button', { name: 'View' }));
    const row = screen.getByRole('menuitemcheckbox', { name: 'Dense rows' });
    expect(row.getAttribute('aria-checked')).toBe('false');

    await user.click(row);
    expect(screen.getByRole('menuitemcheckbox').getAttribute('aria-checked')).toBe('true');
    // The whole point of a checkbox row is ticking several without reopening.
    await user.click(screen.getByRole('menuitemcheckbox'));
    expect(screen.getByRole('menuitemcheckbox').getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('picks one option from a radio group and closes, unlike a checkbox row', async () => {
    const user = userEvent.setup();
    function DomainFilter() {
      const [domain, setDomain] = useState('all');
      return (
        <div>
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="Dominio">{domain}</DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuRadioGroup value={domain} onValueChange={setDomain}>
                <DropdownMenuRadioItem value="all">Todos</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="rutas">Rutas</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    }
    render(<DomainFilter />);

    await user.click(screen.getByRole('button', { name: 'Dominio' }));
    expect(screen.getByRole('menuitemradio', { name: 'Todos' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(screen.getByRole('menuitemradio', { name: 'Rutas' }).getAttribute('aria-checked')).toBe(
      'false',
    );

    await user.click(screen.getByRole('menuitemradio', { name: 'Rutas' }));

    // A completed single choice closes; a checkbox row deliberately does not.
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('button', { name: 'Dominio' }).textContent).toBe('rutas');
  });

  it('walks radio rows with the same arrow ring as plain items', async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Dominio">Dominio</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup value="all">
            <DropdownMenuRadioItem value="all">Todos</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="rutas">Rutas</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole('button', { name: 'Dominio' }));
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: 'Todos' })),
    );
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: 'Rutas' }));
  });

  it('refuses to render a radio row outside a group, rather than silently doing nothing', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() =>
        render(
          <DropdownMenu defaultOpen>
            <DropdownMenuTrigger aria-label="X">X</DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuRadioItem value="a">A</DropdownMenuRadioItem>
            </DropdownMenuContent>
          </DropdownMenu>,
        ),
      ).toThrow(/inside DropdownMenuRadioGroup/);
    } finally {
      quiet.mockRestore();
    }
  });

  it('renders a row as a real link when asked, so cmd-click still works', async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Actions">Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem asChild>
            <a href="/rutas">Rutas</a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole('button', { name: 'Actions' }));
    const row = screen.getByRole('menuitem', { name: 'Rutas' });

    expect(row.tagName).toBe('A');
    expect(row.getAttribute('href')).toBe('/rutas');
  });

  it('supports a controlled trigger through onOpenChange', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    function Controlled() {
      const [open, setOpen] = useState(false);
      return (
        <DropdownMenu
          open={open}
          onOpenChange={(next) => {
            onOpenChange(next);
            setOpen(next);
          }}
        >
          <DropdownMenuTrigger aria-label="Actions">Actions</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Edit</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
    render(<Controlled />);

    await user.click(screen.getByRole('button', { name: 'Actions' }));
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('survives inside a dialog, which is the case the portal exists for', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <DialogRoot defaultOpen>
        <DialogContent>
          <DialogTitle>Edit route</DialogTitle>
          <SimpleMenu onSelect={onSelect} />
        </DialogContent>
      </DialogRoot>,
    );

    await user.click(screen.getByRole('button', { name: 'Actions' }));
    await waitFor(() => expect(screen.getByRole('menu')).toBeTruthy());
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));

    expect(onSelect).toHaveBeenCalledWith('edit');
    // An Escape meant for the menu must not also tear down the dialog around it.
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('does not close the surrounding dialog when Escape closes the menu', async () => {
    const user = userEvent.setup();
    render(
      <DialogRoot defaultOpen>
        <DialogContent>
          <DialogTitle>Edit route</DialogTitle>
          <SimpleMenu />
        </DialogContent>
      </DialogRoot>,
    );

    await user.click(screen.getByRole('button', { name: 'Actions' }));
    await waitFor(() => expect(screen.getByRole('menu')).toBeTruthy());
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('composes with Button on the trigger without losing the menu wiring', async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary">Actions</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Edit</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    const trigger = screen.getByRole('button', { name: 'Actions' });

    expect(trigger.className).toContain('pr-btn');
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    await user.click(trigger);
    expect(screen.getByRole('menu')).toBeTruthy();
  });
});
