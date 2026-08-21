import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';
import {
  RichSelect,
  RichSelectContent,
  RichSelectEmpty,
  RichSelectGroup,
  RichSelectItem,
  RichSelectLabel,
  RichSelectSearch,
  RichSelectSeparator,
  RichSelectTrigger,
  RichSelectValue,
} from './RichSelect';
import {
  DialogContent,
  DialogRoot,
  DialogTitle,
} from './DialogPrimitives';

function SimpleRichSelect({ defaultValue }: { defaultValue?: string }) {
  return (
    <RichSelect defaultValue={defaultValue} name="team">
      <RichSelectTrigger aria-label="Team">
        <RichSelectValue placeholder="Choose a team" />
      </RichSelectTrigger>
      <RichSelectContent>
        <RichSelectGroup>
          <RichSelectLabel>Operations</RichSelectLabel>
          <RichSelectItem value="dispatch">Dispatch</RichSelectItem>
          <RichSelectItem value="retired" disabled>Retired</RichSelectItem>
          <RichSelectItem value="fleet">Fleet partners</RichSelectItem>
        </RichSelectGroup>
        <RichSelectSeparator />
      </RichSelectContent>
    </RichSelect>
  );
}

describe('RichSelect', () => {
  it('keeps the native Select path separate and owns uncontrolled rich selection', async () => {
    const user = userEvent.setup();
    const { container } = render(<SimpleRichSelect />);
    const trigger = screen.getByRole('combobox', { name: 'Team' });

    expect(trigger.textContent).toContain('Choose a team');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-autocomplete')).toBe('none');
    await user.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    await user.click(screen.getByRole('option', { name: 'Fleet partners' }));

    expect(trigger.textContent).toContain('Fleet partners');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
    expect(container.querySelector<HTMLInputElement>('input[name="team"]')?.value).toBe('fleet');
  });

  it('selects by typeahead without opening when search is not composed', async () => {
    const user = userEvent.setup();
    render(<SimpleRichSelect />);
    const trigger = screen.getByRole('combobox', { name: 'Team' });

    trigger.focus();
    await user.keyboard('f');

    expect(trigger.textContent).toContain('Fleet partners');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('supports controlled values and custom trigger rendering', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(
      <RichSelect value="dispatch" onValueChange={onValueChange}>
        <RichSelectTrigger asChild>
          <Button variant="outline">
            <RichSelectValue>{(value) => `Selected: ${value ?? 'none'}`}</RichSelectValue>
          </Button>
        </RichSelectTrigger>
        <RichSelectContent>
          <RichSelectItem value="dispatch">Dispatch</RichSelectItem>
          <RichSelectItem value="fleet">Fleet</RichSelectItem>
        </RichSelectContent>
      </RichSelect>,
    );

    const trigger = screen.getByRole('combobox');
    expect(trigger.textContent).toContain('Selected: dispatch');
    await user.click(trigger);
    await user.click(screen.getByRole('option', { name: 'Fleet' }));
    expect(onValueChange).toHaveBeenCalledWith('fleet');
    expect(trigger.textContent).toContain('Selected: dispatch');

    rerender(
      <RichSelect value="fleet" onValueChange={onValueChange}>
        <RichSelectTrigger asChild>
          <Button variant="outline">
            <RichSelectValue>{(value) => `Selected: ${value ?? 'none'}`}</RichSelectValue>
          </Button>
        </RichSelectTrigger>
        <RichSelectContent>
          <RichSelectItem value="dispatch">Dispatch</RichSelectItem>
          <RichSelectItem value="fleet">Fleet</RichSelectItem>
        </RichSelectContent>
      </RichSelect>,
    );
    expect(screen.getByRole('combobox').textContent).toContain('Selected: fleet');
  });

  it('supports controlled open state across trigger, outside, programmatic, selection, and Escape paths', async () => {
    const user = userEvent.setup();

    function ControlledOpenSelect() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open team externally</button>
          <RichSelect open={open} onOpenChange={setOpen}>
            <RichSelectTrigger aria-label="Controlled team">
              <RichSelectValue placeholder="Choose a team" />
            </RichSelectTrigger>
            <RichSelectContent>
              <RichSelectItem value="dispatch">Dispatch</RichSelectItem>
              <RichSelectItem value="fleet">Fleet</RichSelectItem>
            </RichSelectContent>
          </RichSelect>
          <button type="button">Outside control</button>
          <output aria-label="Open state">{open ? 'open' : 'closed'}</output>
        </>
      );
    }

    render(<ControlledOpenSelect />);
    const trigger = screen.getByRole('combobox', { name: 'Controlled team' });

    await user.click(trigger);
    expect(screen.getByRole('status', { name: 'Open state' }).textContent).toBe('open');
    expect(screen.getByRole('listbox')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Outside control' }));
    expect(screen.getByRole('status', { name: 'Open state' }).textContent).toBe('closed');
    expect(screen.queryByRole('listbox')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Open team externally' }));
    expect(screen.getByRole('listbox')).toBeTruthy();
    await user.click(screen.getByRole('option', { name: 'Fleet' }));
    expect(trigger.textContent).toContain('Fleet');
    expect(screen.getByRole('status', { name: 'Open state' }).textContent).toBe('closed');

    await user.click(screen.getByRole('button', { name: 'Open team externally' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByRole('status', { name: 'Open state' }).textContent).toBe('closed');
    expect(document.activeElement).toBe(trigger);
  });

  it('supports defaultOpen and reports its uncontrolled close transition', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <RichSelect defaultOpen onOpenChange={onOpenChange}>
        <RichSelectTrigger aria-label="Initially open team">
          <RichSelectValue placeholder="Choose a team" />
        </RichSelectTrigger>
        <RichSelectContent>
          <RichSelectItem value="dispatch">Dispatch</RichSelectItem>
        </RichSelectContent>
      </RichSelect>,
    );

    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole('combobox', { name: 'Initially open team' }));
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('skips disabled items through the complete arrow, edge, and selection contract', async () => {
    const user = userEvent.setup();
    render(<SimpleRichSelect />);
    const trigger = screen.getByRole('combobox', { name: 'Team' });

    trigger.focus();
    await user.keyboard('{ArrowDown}');
    const listbox = screen.getByRole('listbox');
    expect(document.activeElement).toBe(listbox);
    expect(listbox.getAttribute('aria-activedescendant')).toContain('item-0');
    await user.keyboard('{ArrowDown}');
    expect(listbox.getAttribute('aria-activedescendant')).toContain('item-2');
    await user.keyboard('{Home}');
    expect(listbox.getAttribute('aria-activedescendant')).toContain('item-0');
    await user.keyboard('{End}{Enter}');
    expect(trigger.textContent).toContain('Fleet partners');
  });

  it('supports accent-insensitive optional search, custom content, and an empty state', async () => {
    const user = userEvent.setup();
    render(
      <RichSelect>
        <RichSelectTrigger aria-label="Workspace">
          <RichSelectValue placeholder="Choose workspace" />
        </RichSelectTrigger>
        <RichSelectContent>
          <RichSelectSearch placeholder="Search workspaces" />
          <RichSelectItem value="projects" textValue="Gestión de proyectos">
            <strong>Projects</strong><span>Gestión de proyectos</span>
          </RichSelectItem>
          <RichSelectItem value="operations">Operations</RichSelectItem>
          <RichSelectEmpty>No matching workspace</RichSelectEmpty>
        </RichSelectContent>
      </RichSelect>,
    );

    await user.click(screen.getByRole('combobox', { name: 'Workspace' }));
    const search = screen.getByRole('searchbox', { name: 'Search workspaces' });
    expect(document.activeElement).toBe(search);
    await user.type(search, 'gestion');
    expect(screen.getByRole('option', { name: /Projects Gestión de proyectos/ })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Operations' })).toBeNull();

    await user.clear(search);
    await user.type(search, 'unknown');
    expect(screen.getByRole('status').textContent).toBe('No matching workspace');
  });

  it('provides group and item screen-reader relationships', async () => {
    const user = userEvent.setup();
    render(<SimpleRichSelect defaultValue="dispatch" />);
    await user.click(screen.getByRole('combobox', { name: 'Team' }));

    const group = screen.getByRole('group', { name: 'Operations' });
    expect(group.getAttribute('aria-labelledby')).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Dispatch' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByRole('option', { name: 'Retired' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
    expect(screen.getByRole('separator')).toBeTruthy();
  });

  it('keeps its portal owned by a dialog and lets Escape close only the select first', async () => {
    const user = userEvent.setup();
    render(
      <DialogRoot defaultOpen>
        <DialogContent>
          <DialogTitle>Assign team</DialogTitle>
          <SimpleRichSelect />
        </DialogContent>
      </DialogRoot>,
    );

    await user.click(screen.getByRole('combobox', { name: 'Team' }));
    await waitFor(() => {
      expect(
        document
          .querySelector('.pr-rich-select__content')
          ?.hasAttribute('data-pr-dialog-layer-owned'),
      ).toBe(true);
    });
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Assign team' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'Team' }));
  });

  it('moves Tab from the portal to the next control in document order', async () => {
    const user = userEvent.setup();
    render(
      <>
        <SimpleRichSelect />
        <button type="button">Next field</button>
      </>,
    );
    const trigger = screen.getByRole('combobox', { name: 'Team' });
    await user.click(trigger);
    await user.keyboard('{Tab}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Next field' }));
  });
});
