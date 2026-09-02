import { useState } from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  DateRangeFilter,
  EMPTY_DATE_RANGE,
  formatDateRange,
  isSameDateRange,
  isValidDateRange,
  type DateRange,
} from './DateRangeFilter';

const LABELS = {
  allTime: 'Todo el tiempo',
  custom: 'Personalizado',
  from: 'Desde',
  to: 'Hasta',
  apply: 'Aplicar',
  clear: 'Limpiar',
  dialog: 'Filtrar por fechas',
};

const PRESETS = [
  { id: '7d', label: 'Últimos 7 días', range: { from: '2026-08-26', to: '2026-09-02' } },
  { id: '30d', label: 'Últimos 30 días', range: { from: '2026-08-03', to: '2026-09-02' } },
];

describe('isSameDateRange', () => {
  it('compares both bounds', () => {
    expect(isSameDateRange({ from: 'a', to: 'b' }, { from: 'a', to: 'b' })).toBe(true);
    expect(isSameDateRange({ from: 'a', to: 'b' }, { from: 'a', to: '' })).toBe(false);
  });
});

describe('isValidDateRange', () => {
  it('accepts empty, start-only and ordered complete ranges', () => {
    expect(isValidDateRange(EMPTY_DATE_RANGE)).toBe(true);
    expect(isValidDateRange({ from: '2026-08-03', to: '' })).toBe(true);
    expect(isValidDateRange({ from: '2026-08-03', to: '2026-09-02' })).toBe(true);
    expect(isValidDateRange({ from: '2026-09-02', to: '2026-09-02' })).toBe(true);
  });

  it('rejects end-only, reversed and malformed ranges', () => {
    expect(isValidDateRange({ from: '', to: '2026-09-02' })).toBe(false);
    expect(isValidDateRange({ from: '2026-09-02', to: '2026-08-03' })).toBe(false);
    expect(isValidDateRange({ from: '2026-02-30', to: '' })).toBe(false);
    expect(isValidDateRange({ from: 'yesterday', to: '' })).toBe(false);
  });

  it('enforces the limits on both bounds', () => {
    const limits = { min: '2026-01-01', max: '2026-12-31' };
    expect(isValidDateRange({ from: '2026-08-03', to: '2026-09-02' }, limits)).toBe(true);
    expect(isValidDateRange({ from: '2025-12-31', to: '2026-01-05' }, limits)).toBe(false);
    expect(isValidDateRange({ from: '2026-12-01', to: '2027-01-01' }, limits)).toBe(false);
  });
});

describe('formatDateRange', () => {
  it('names the window in the given locale, eliding a shared year', () => {
    expect(formatDateRange({ from: '2026-08-03', to: '2026-09-02' }, 'es-MX', LABELS)).toBe(
      '3 ago – 2 sep 2026',
    );
    expect(formatDateRange({ from: '2025-12-20', to: '2026-01-05' }, 'es-MX', LABELS)).toBe(
      '20 dic 2025 – 5 ene 2026',
    );
    expect(formatDateRange({ from: '2026-08-03', to: '2026-09-02' }, 'en-US', LABELS)).toBe(
      'Aug 3 – Sep 2, 2026',
    );
  });

  it('labels a start-only window and falls back to all time otherwise', () => {
    expect(formatDateRange({ from: '2026-08-03', to: '' }, 'es-MX', LABELS)).toBe(
      'Desde 3 ago 2026',
    );
    expect(formatDateRange(EMPTY_DATE_RANGE, 'es-MX', LABELS)).toBe('Todo el tiempo');
    expect(formatDateRange({ from: '', to: '2026-09-02' }, 'es-MX', LABELS)).toBe('Todo el tiempo');
    expect(formatDateRange({ from: 'not-a-date', to: '' }, 'es-MX', LABELS)).toBe('Todo el tiempo');
  });

  it('never shifts a day through the host timezone', () => {
    expect(formatDateRange({ from: '2026-01-01', to: '2026-01-01' }, 'es-MX', LABELS)).toBe(
      '1 ene – 1 ene 2026',
    );
  });
});

function Harness({
  initial = EMPTY_DATE_RANGE,
  onChange = vi.fn(),
}: {
  initial?: DateRange;
  onChange?: (next: DateRange) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <DateRangeFilter
      aria-label="Fechas"
      value={value}
      onChange={(next) => {
        onChange(next);
        setValue(next);
      }}
      presets={PRESETS}
      labels={LABELS}
      locale="es-MX"
    />
  );
}

describe('DateRangeFilter', () => {
  it('names the current window on a dialog trigger', () => {
    const empty = render(<Harness />);
    const trigger = empty.getByRole('button', { name: 'Fechas' });
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.textContent).toBe('Todo el tiempo');
    expect(trigger.className).not.toContain('pr-date-range__trigger--active');
    empty.unmount();

    const preset = render(<Harness initial={PRESETS[1]!.range} />);
    const active = preset.getByRole('button', { name: 'Fechas' });
    expect(active.textContent).toBe('Últimos 30 días');
    expect(active.className).toContain('pr-date-range__trigger--active');
    preset.unmount();

    const custom = render(<Harness initial={{ from: '2026-08-03', to: '2026-08-20' }} />);
    expect(custom.getByRole('button', { name: 'Fechas' }).textContent).toBe('3 ago – 20 ago 2026');
  });

  it('opens a named dialog with pressed presets and commits a preset on click', async () => {
    const onChange = vi.fn();
    const { getByRole, queryByRole } = render(<Harness onChange={onChange} />);
    fireEvent.click(getByRole('button', { name: 'Fechas' }));
    const dialog = getByRole('dialog', { name: 'Filtrar por fechas' });
    expect(dialog).toBeDefined();
    const group = getByRole('group', { name: 'Fechas' });
    expect(group.querySelector('[aria-pressed="true"]')?.textContent).toBe('Todo el tiempo');

    fireEvent.click(getByRole('button', { name: 'Últimos 7 días' }));
    expect(onChange).toHaveBeenCalledWith(PRESETS[0]!.range);
    await waitFor(() => expect(queryByRole('dialog')).toBeNull());
    expect(getByRole('button', { name: 'Fechas' }).textContent).toBe('Últimos 7 días');
  });

  it('calls nothing when the pressed preset is clicked again', async () => {
    const onChange = vi.fn();
    const { getByRole, queryByRole } = render(
      <Harness initial={PRESETS[0]!.range} onChange={onChange} />,
    );
    fireEvent.click(getByRole('button', { name: 'Fechas' }));
    fireEvent.click(getByRole('button', { name: 'Últimos 7 días' }));
    expect(onChange).not.toHaveBeenCalled();
    await waitFor(() => expect(queryByRole('dialog')).toBeNull());
  });

  it('edits a draft in the calendar that only Aplicar commits', async () => {
    const onChange = vi.fn();
    const { getByRole, queryByRole } = render(<Harness onChange={onChange} />);
    fireEvent.click(getByRole('button', { name: 'Fechas' }));
    const dialog = getByRole('dialog', { name: 'Filtrar por fechas' });
    const apply = getByRole('button', { name: 'Aplicar' });
    const clear = getByRole('button', { name: 'Limpiar' });
    expect(apply).toHaveProperty('disabled', false);
    expect(clear).toHaveProperty('disabled', true);

    const days = dialog.querySelectorAll<HTMLButtonElement>('.pr-calendar__day[data-date]');
    const start = Array.from(days).find((day) => day.dataset.date?.endsWith('-10'))!;
    const end = Array.from(days).find((day) => day.dataset.date?.endsWith('-14'))!;
    fireEvent.click(start);
    expect(onChange).not.toHaveBeenCalled();
    expect(dialog.querySelectorAll('.pr-date-range__bound dd')[0]?.textContent).not.toBe('—');
    fireEvent.click(end);
    expect(onChange).not.toHaveBeenCalled();
    expect(clear).toHaveProperty('disabled', false);

    fireEvent.click(apply);
    expect(onChange).toHaveBeenCalledWith({ from: start.dataset.date, to: end.dataset.date });
    await waitFor(() => expect(queryByRole('dialog')).toBeNull());
  });

  it('discards the draft on Escape and resets it from the value on the next open', async () => {
    const onChange = vi.fn();
    const { getByRole, queryByRole } = render(<Harness onChange={onChange} />);
    fireEvent.click(getByRole('button', { name: 'Fechas' }));
    let dialog = getByRole('dialog', { name: 'Filtrar por fechas' });
    const day = dialog.querySelector<HTMLButtonElement>('.pr-calendar__day[data-date]')!;
    fireEvent.click(day);
    expect(dialog.querySelectorAll('.pr-date-range__bound dd')[0]?.textContent).not.toBe('—');

    fireEvent.keyDown(day, { key: 'Escape' });
    await waitFor(() => expect(queryByRole('dialog')).toBeNull());
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(getByRole('button', { name: 'Fechas' }));
    dialog = getByRole('dialog', { name: 'Filtrar por fechas' });
    expect(dialog.querySelectorAll('.pr-date-range__bound dd')[0]?.textContent).toBe('—');
  });

  it('clears the draft and returns to all time through the presets', async () => {
    const onChange = vi.fn();
    const { getByRole, queryByRole } = render(
      <Harness initial={PRESETS[1]!.range} onChange={onChange} />,
    );
    fireEvent.click(getByRole('button', { name: 'Fechas' }));
    fireEvent.click(getByRole('button', { name: 'Limpiar' }));
    expect(getByRole('button', { name: 'Limpiar' })).toHaveProperty('disabled', true);
    fireEvent.click(getByRole('button', { name: 'Todo el tiempo' }));
    expect(onChange).toHaveBeenCalledWith(EMPTY_DATE_RANGE);
    await waitFor(() => expect(queryByRole('dialog')).toBeNull());
  });

  it('forwards calendar labels and the limits', () => {
    const { getByRole } = render(
      <DateRangeFilter
        aria-label="Fechas"
        value={EMPTY_DATE_RANGE}
        onChange={() => {}}
        presets={PRESETS}
        labels={LABELS}
        min="2026-01-01"
        max="2026-12-31"
        calendar={{ previousMonthLabel: 'Anterior', nextMonthLabel: 'Siguiente', weekStartsOn: 0 }}
      />,
    );
    fireEvent.click(getByRole('button', { name: 'Fechas' }));
    expect(getByRole('button', { name: 'Anterior' })).toBeDefined();
    expect(getByRole('button', { name: 'Siguiente' })).toBeDefined();
  });
});

describe('DateRangeFilter invariant guard', () => {
  const INVALID_PRESETS = [
    { id: 'end-only', label: 'Hasta hoy', range: { from: '', to: '2026-09-02' } },
    { id: 'reversed', label: 'Al revés', range: { from: '2026-09-02', to: '2026-08-03' } },
    { id: 'malformed', label: 'Roto', range: { from: '2026-02-30', to: '' } },
    { id: 'ok', label: 'Válido', range: { from: '2026-08-03', to: '2026-09-02' } },
  ];

  it('renders an invalid preset disabled and never commits it', () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <DateRangeFilter
        aria-label="Fechas"
        value={EMPTY_DATE_RANGE}
        onChange={onChange}
        presets={INVALID_PRESETS}
        labels={LABELS}
      />,
    );
    fireEvent.click(getByRole('button', { name: 'Fechas' }));
    for (const name of ['Hasta hoy', 'Al revés', 'Roto']) {
      const option = getByRole('button', { name });
      expect(option.getAttribute('aria-disabled')).toBe('true');
      expect(option).toHaveProperty('disabled', true);
      fireEvent.click(option);
    }
    expect(onChange).not.toHaveBeenCalled();
    expect(getByRole('dialog', { name: 'Filtrar por fechas' })).toBeDefined();
    const valid = getByRole('button', { name: 'Válido' });
    expect(valid.getAttribute('aria-disabled')).toBeNull();
    fireEvent.click(valid);
    expect(onChange).toHaveBeenCalledWith(INVALID_PRESETS[3]!.range);
  });

  it('disables a preset that falls outside the limits', () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <DateRangeFilter
        aria-label="Fechas"
        value={EMPTY_DATE_RANGE}
        onChange={onChange}
        presets={PRESETS}
        labels={LABELS}
        min="2026-08-10"
      />,
    );
    fireEvent.click(getByRole('button', { name: 'Fechas' }));
    expect(getByRole('button', { name: 'Últimos 30 días' })).toHaveProperty('disabled', true);
    expect(getByRole('button', { name: 'Últimos 7 días' })).toHaveProperty('disabled', false);
    fireEvent.click(getByRole('button', { name: 'Últimos 30 días' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reads an invalid controlled value as all time, matches no preset and marks the trigger', () => {
    const endOnly = { from: '', to: '2026-09-02' };
    const { getByRole } = render(
      <DateRangeFilter
        aria-label="Fechas"
        value={endOnly}
        onChange={() => {}}
        presets={[...PRESETS, { id: 'end-only', label: 'Hasta hoy', range: endOnly }]}
        labels={LABELS}
      />,
    );
    const trigger = getByRole('button', { name: 'Fechas' });
    expect(trigger.textContent).toBe('Todo el tiempo');
    expect(trigger.getAttribute('data-invalid')).toBe('');
    expect(trigger.getAttribute('data-active')).toBeNull();
    expect(trigger.className).not.toContain('pr-date-range__trigger--active');
    fireEvent.click(trigger);
    const group = getByRole('group', { name: 'Fechas' });
    expect(group.querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);
    expect(getByRole('button', { name: 'Hasta hoy' })).toHaveProperty('disabled', true);
    expect(getByRole('dialog').querySelectorAll('.pr-date-range__bound dd')[0]?.textContent).toBe(
      '—',
    );
  });

  it('marks a valid controlled value outside the limits as invalid too', () => {
    const { getByRole } = render(
      <DateRangeFilter
        aria-label="Fechas"
        value={{ from: '2025-01-01', to: '2025-01-31' }}
        onChange={() => {}}
        presets={PRESETS}
        labels={LABELS}
        min="2026-01-01"
      />,
    );
    const trigger = getByRole('button', { name: 'Fechas' });
    expect(trigger.textContent).toBe('Todo el tiempo');
    expect(trigger.getAttribute('data-invalid')).toBe('');
  });
});
