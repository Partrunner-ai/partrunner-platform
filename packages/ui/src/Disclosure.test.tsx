import { useState } from 'react';
import { fireEvent, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Disclosure } from './Disclosure';

describe('Disclosure', () => {
  it('is closed by default with a labelled, hidden panel', () => {
    const { getByRole, container } = render(<Disclosure title="Detalles">contenido</Disclosure>);
    const button = getByRole('button', { name: 'Detalles' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    const panel = container.querySelector('[role="region"]') as HTMLElement;
    expect(panel.hidden).toBe(true);
    expect(button.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('aria-labelledby')).toBe(button.id);
  });

  it('opens with defaultOpen and wraps the button in a level 3 heading', () => {
    const { getByRole } = render(
      <Disclosure title="Detalles" defaultOpen>
        contenido
      </Disclosure>,
    );
    expect(getByRole('button').getAttribute('aria-expanded')).toBe('true');
    expect(getByRole('region', { name: 'Detalles' }).textContent).toBe('contenido');
    expect(getByRole('heading', { level: 3 })).toBeDefined();
  });

  it('takes the heading level, variant, description and trailing content', () => {
    const { getByRole, container } = render(
      <Disclosure title="T" description="Desc" trailing={<span>3</span>} headingLevel={2} variant="card">
        x
      </Disclosure>,
    );
    expect(getByRole('heading', { level: 2 })).toBeDefined();
    expect((container.firstElementChild as HTMLElement).className).toContain('pr-disclosure--card');
    expect(container.querySelector('.pr-disclosure__description')?.textContent).toBe('Desc');
    expect(container.querySelector('.pr-disclosure__trailing')?.textContent).toBe('3');
  });

  it('toggles on click, Enter and Space when uncontrolled', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { getByRole } = render(
      <Disclosure title="Detalles" onOpenChange={onOpenChange}>
        x
      </Disclosure>,
    );
    const button = getByRole('button');
    await user.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    button.focus();
    await user.keyboard('{Enter}');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    await user.keyboard(' ');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(onOpenChange.mock.calls.map((c) => c[0])).toEqual([true, false, true]);
  });

  it('follows the open prop when controlled and only reports the request', () => {
    const onOpenChange = vi.fn();
    const { getByRole, rerender } = render(
      <Disclosure title="Detalles" open={false} onOpenChange={onOpenChange}>
        x
      </Disclosure>,
    );
    const button = getByRole('button');
    fireEvent.click(button);
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    rerender(
      <Disclosure title="Detalles" open onOpenChange={onOpenChange}>
        x
      </Disclosure>,
    );
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  it('works when the parent owns the state', () => {
    function Host() {
      const [open, setOpen] = useState(false);
      return (
        <Disclosure title="Detalles" open={open} onOpenChange={setOpen}>
          x
        </Disclosure>
      );
    }
    const { getByRole } = render(<Host />);
    fireEvent.click(getByRole('button'));
    expect(getByRole('button').getAttribute('aria-expanded')).toBe('true');
  });
});
