import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  Calendar,
  formatCalendarDate,
  isCalendarDate,
  parseCalendarDate,
  serializeCalendarDate,
  type CalendarRange,
} from './Calendar';

function day(date: string): HTMLButtonElement {
  const node = document.querySelector<HTMLButtonElement>(`[data-date="${date}"]`);
  if (!node) throw new Error(`Missing calendar day ${date}`);
  return node;
}

describe('Calendar date contract', () => {
  it('parses and serializes date-only ISO values without local timezone conversion', () => {
    expect(isCalendarDate('2026-02-28')).toBe(true);
    expect(isCalendarDate('2026-02-30')).toBe(false);
    expect(isCalendarDate('02/28/2026')).toBe(false);
    expect(parseCalendarDate('2026-07-15')?.toISOString()).toBe('2026-07-15T00:00:00.000Z');
    expect(serializeCalendarDate(new Date('2026-07-15T23:30:00.000Z'))).toBe('2026-07-15');
    expect(formatCalendarDate('2026-07-15', 'es-MX', { dateStyle: 'full' })).toContain(
      '15',
    );
  });

  it('owns uncontrolled selection plus clear and reset actions', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Calendar
        defaultValue="2026-07-10"
        defaultMonth="2026-07-01"
        onValueChange={onValueChange}
        showActions
      />,
    );

    await user.click(day('2026-07-15'));
    expect(day('2026-07-15').getAttribute('aria-selected')).toBe('true');
    expect(onValueChange).toHaveBeenLastCalledWith('2026-07-15');

    await user.click(screen.getByRole('button', { name: 'Limpiar' }));
    expect(day('2026-07-15').getAttribute('aria-selected')).toBe('false');
    expect(onValueChange).toHaveBeenLastCalledWith(null);

    await user.click(screen.getByRole('button', { name: 'Restablecer' }));
    expect(day('2026-07-10').getAttribute('aria-selected')).toBe('true');
    expect(onValueChange).toHaveBeenLastCalledWith('2026-07-10');
  });

  it('keeps a controlled value stable and enforces min, max, and disabled dates', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(
      <Calendar
        value="2026-07-12"
        onValueChange={onValueChange}
        month="2026-07-01"
        min="2026-07-10"
        max="2026-07-20"
        disabledDates={['2026-07-15']}
      />,
    );

    expect(day('2026-07-09').disabled).toBe(true);
    expect(day('2026-07-15').disabled).toBe(true);
    expect(day('2026-07-21').disabled).toBe(true);
    await user.click(day('2026-07-14'));
    expect(onValueChange).toHaveBeenCalledWith('2026-07-14');
    expect(day('2026-07-12').getAttribute('aria-selected')).toBe('true');

    rerender(
      <Calendar
        value="2026-07-14"
        onValueChange={onValueChange}
        month="2026-07-01"
        min="2026-07-10"
        max="2026-07-20"
        disabledDates={['2026-07-15']}
      />,
    );
    expect(day('2026-07-14').getAttribute('aria-selected')).toBe('true');
  });

  it('selects an ordered range and announces its progress', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Calendar
        mode="range"
        defaultMonth="2026-07-01"
        onValueChange={onValueChange}
      />,
    );

    await user.click(day('2026-07-20'));
    expect(onValueChange).toHaveBeenLastCalledWith({ start: '2026-07-20', end: null });
    expect(screen.getByRole('status').textContent).toContain('Inicio del rango');

    await user.click(day('2026-07-10'));
    const expected: CalendarRange = { start: '2026-07-10', end: '2026-07-20' };
    expect(onValueChange).toHaveBeenLastCalledWith(expected);
    expect(day('2026-07-15').getAttribute('aria-selected')).toBe('true');
    expect(day('2026-07-10').hasAttribute('data-range-start')).toBe(true);
    expect(day('2026-07-20').hasAttribute('data-range-end')).toBe(true);
  });

  it('navigates months and years with localized labels and bounded controls', async () => {
    const user = userEvent.setup();
    const onMonthChange = vi.fn();
    render(
      <Calendar
        locale="en-US"
        defaultMonth="2026-07-01"
        min="2025-07-01"
        max="2027-07-31"
        onMonthChange={onMonthChange}
      />,
    );

    expect(screen.getByRole('heading', { name: 'July 2026' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(screen.getByRole('heading', { name: 'August 2026' })).toBeTruthy();
    expect(onMonthChange).toHaveBeenLastCalledWith('2026-08-01');
    await user.click(screen.getByRole('button', { name: 'Año anterior' }));
    expect(screen.getByRole('heading', { name: 'August 2025' })).toBeTruthy();
  });

  it('implements roving keyboard navigation and skips disabled dates', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Calendar
        defaultValue="2026-07-15"
        defaultMonth="2026-07-01"
        disabledDates={(date) => date === '2026-07-16'}
        onValueChange={onValueChange}
      />,
    );

    day('2026-07-15').focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(day('2026-07-17'));
    await user.keyboard('{Enter}');
    expect(onValueChange).toHaveBeenLastCalledWith('2026-07-17');
    await user.keyboard('{PageDown}');
    expect(screen.getByRole('heading').textContent?.toLocaleLowerCase('es-MX')).toContain('agosto');
    expect((document.activeElement as HTMLElement).getAttribute('data-date')).toBe('2026-08-17');
  });

  it('clamps cross-month keyboard movement to the nearest date boundary', async () => {
    const user = userEvent.setup();
    render(
      <Calendar
        defaultValue="2026-08-12"
        defaultMonth="2026-08-01"
        min="2026-07-30"
      />,
    );

    day('2026-08-12').focus();
    await user.keyboard('{PageUp}');
    expect(screen.getByRole('heading').textContent).toContain('Julio');
    expect(document.activeElement).toBe(day('2026-07-30'));
  });
});
