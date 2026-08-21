import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  DialogContent,
  DialogRoot,
  DialogTitle,
} from './DialogPrimitives';
import { FormField } from './FormField';
import { DatePicker } from './DatePicker';

function day(date: string): HTMLButtonElement {
  const node = document.querySelector<HTMLButtonElement>(`[data-date="${date}"]`);
  if (!node) throw new Error(`Missing calendar day ${date}`);
  return node;
}

describe('DatePicker', () => {
  it('serializes a single date, closes after selection, and supports clear/reset', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { container } = render(
      <FormField label="Delivery date" hint="Date-only value">
        <DatePicker
          name="deliveryDate"
          defaultValue="2026-07-10"
          onValueChange={onValueChange}
          fullWidth
        />
      </FormField>,
    );
    const trigger = screen.getByRole('button', { name: 'Delivery date' });

    expect(trigger.textContent).toContain('10');
    await user.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Seleccionar fecha' })).toBeTruthy();
    await user.click(day('2026-07-15'));
    expect(screen.queryByRole('dialog', { name: 'Seleccionar fecha' })).toBeNull();
    expect(trigger.textContent).toContain('15');
    expect(container.querySelector<HTMLInputElement>('input[name="deliveryDate"]')?.value).toBe(
      '2026-07-15',
    );

    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Limpiar' }));
    expect(onValueChange).toHaveBeenLastCalledWith(null);
    expect(container.querySelector<HTMLInputElement>('input[name="deliveryDate"]')?.value).toBe('');
    await user.click(screen.getByRole('button', { name: 'Restablecer' }));
    expect(onValueChange).toHaveBeenLastCalledWith('2026-07-10');
    expect(screen.queryByRole('dialog', { name: 'Seleccionar fecha' })).toBeNull();
  });

  it('serializes range endpoints separately and closes when the range completes', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { container } = render(
      <DatePicker
        mode="range"
        startName="startDate"
        endName="endDate"
        defaultMonth="2026-07-01"
        onValueChange={onValueChange}
        aria-label="Operating range"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Operating range' }));
    await user.click(day('2026-07-10'));
    expect(screen.getByRole('dialog', { name: 'Seleccionar rango de fechas' })).toBeTruthy();
    await user.click(day('2026-07-14'));
    expect(screen.queryByRole('dialog', { name: 'Seleccionar rango de fechas' })).toBeNull();
    expect(onValueChange).toHaveBeenLastCalledWith({
      start: '2026-07-10',
      end: '2026-07-14',
    });
    expect(container.querySelector<HTMLInputElement>('input[name="startDate"]')?.value).toBe(
      '2026-07-10',
    );
    expect(container.querySelector<HTMLInputElement>('input[name="endDate"]')?.value).toBe(
      '2026-07-14',
    );
  });

  it('keeps controlled display stable until the owner updates it', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(
      <DatePicker value="2026-07-10" onValueChange={onValueChange} aria-label="Due date" />,
    );
    const trigger = screen.getByRole('button', { name: 'Due date' });
    await user.click(trigger);
    await user.click(day('2026-07-12'));
    expect(onValueChange).toHaveBeenCalledWith('2026-07-12');
    expect(trigger.textContent).toContain('10');

    rerender(
      <DatePicker value="2026-07-12" onValueChange={onValueChange} aria-label="Due date" />,
    );
    expect(screen.getByRole('button', { name: 'Due date' }).textContent).toContain('12');
  });

  it('owns its dialog portal and lets Escape close only the picker first', async () => {
    const user = userEvent.setup();
    render(
      <DialogRoot defaultOpen>
        <DialogContent>
          <DialogTitle>Schedule route</DialogTitle>
          <DatePicker aria-label="Route date" defaultValue="2026-07-10" />
        </DialogContent>
      </DialogRoot>,
    );

    const trigger = screen.getByRole('button', { name: 'Route date' });
    await user.click(trigger);
    await waitFor(() => {
      expect(
        document
          .querySelector('.pr-date-picker__content')
          ?.hasAttribute('data-pr-dialog-layer-owned'),
      ).toBe(true);
    });
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Seleccionar fecha' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Schedule route' })).toBeTruthy();
    expect(document.activeElement).toBe(trigger);
  });

  it('moves Tab out of the portal and respects disabled triggers', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <>
        <DatePicker aria-label="Pickup date" defaultValue="2026-07-10" />
        <button type="button">Next field</button>
      </>,
    );
    const trigger = screen.getByRole('button', { name: 'Pickup date' });
    await user.click(trigger);
    await user.keyboard('{Tab}');
    expect(screen.queryByRole('dialog', { name: 'Seleccionar fecha' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Next field' }));

    rerender(<DatePicker aria-label="Pickup date" disabled />);
    expect((screen.getByRole('button', { name: 'Pickup date' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});
