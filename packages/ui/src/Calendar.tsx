'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

/**
 * A calendar-only ISO date (`YYYY-MM-DD`). It deliberately has no time or zone.
 * Runtime parsing validates the shape and the actual Gregorian date.
 */
export type CalendarDate = string;

export interface CalendarRange {
  start: CalendarDate | null;
  end: CalendarDate | null;
}

export type CalendarDisabledDates =
  | readonly CalendarDate[]
  | ((date: CalendarDate) => boolean);

export interface CalendarSharedProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'defaultValue' | 'onChange'> {
  locale?: string;
  min?: CalendarDate;
  max?: CalendarDate;
  disabledDates?: CalendarDisabledDates;
  month?: CalendarDate;
  defaultMonth?: CalendarDate;
  onMonthChange?: (month: CalendarDate) => void;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  showOutsideDays?: boolean;
  showActions?: boolean;
  clearLabel?: ReactNode;
  resetLabel?: ReactNode;
  previousMonthLabel?: string;
  nextMonthLabel?: string;
  previousYearLabel?: string;
  nextYearLabel?: string;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
}

export interface CalendarSingleProps extends CalendarSharedProps {
  mode?: 'single';
  value?: CalendarDate | null;
  defaultValue?: CalendarDate | null;
  onValueChange?: (value: CalendarDate | null) => void;
}

export interface CalendarRangeProps extends CalendarSharedProps {
  mode: 'range';
  value?: CalendarRange;
  defaultValue?: CalendarRange;
  onValueChange?: (value: CalendarRange) => void;
}

export type CalendarProps = CalendarSingleProps | CalendarRangeProps;

type CalendarValue = CalendarDate | null | CalendarRange;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const EMPTY_RANGE: CalendarRange = { start: null, end: null };

/** Parse a calendar date at UTC midnight so host timezone changes cannot shift the day. */
export function parseCalendarDate(value: CalendarDate | null | undefined): Date | null {
  if (!value) return null;
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

/** Serialize UTC calendar fields only; never convert through a local timezone. */
export function serializeCalendarDate(date: Date): CalendarDate {
  const year = String(date.getUTCFullYear()).padStart(4, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isCalendarDate(value: string): boolean {
  return parseCalendarDate(value) !== null;
}

export function formatCalendarDate(
  value: CalendarDate,
  locale = 'es-MX',
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
): string {
  const date = parseCalendarDate(value);
  return date
    ? new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(date)
    : value;
}

function todayCalendarDate(): CalendarDate {
  const now = new Date();
  return [
    String(now.getFullYear()).padStart(4, '0'),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

function addDays(value: CalendarDate, amount: number): CalendarDate {
  const date = parseCalendarDate(value);
  if (!date) return value;
  date.setUTCDate(date.getUTCDate() + amount);
  return serializeCalendarDate(date);
}

function addMonths(value: CalendarDate, amount: number): CalendarDate {
  const date = parseCalendarDate(value);
  if (!date) return value;
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + amount);
  const last = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return serializeCalendarDate(date);
}

function startOfMonth(value: CalendarDate): CalendarDate {
  const date = parseCalendarDate(value);
  if (!date) return value;
  date.setUTCDate(1);
  return serializeCalendarDate(date);
}

function endOfMonth(value: CalendarDate): CalendarDate {
  const date = parseCalendarDate(value);
  if (!date) return value;
  date.setUTCMonth(date.getUTCMonth() + 1, 0);
  return serializeCalendarDate(date);
}

function monthContains(month: CalendarDate, date: CalendarDate): boolean {
  return month.slice(0, 7) === date.slice(0, 7);
}

function sameRange(a: CalendarRange, b: CalendarRange): boolean {
  return a.start === b.start && a.end === b.end;
}

function rangeValue(value: CalendarValue): CalendarRange {
  return typeof value === 'object' && value !== null ? value : EMPTY_RANGE;
}

function singleValue(value: CalendarValue): CalendarDate | null {
  return typeof value === 'string' ? value : null;
}

function normalizedMonth(value: CalendarDate | null | undefined): CalendarDate | null {
  return parseCalendarDate(value) ? startOfMonth(value as CalendarDate) : null;
}

function defaultActiveDate(
  value: CalendarValue,
  mode: 'single' | 'range',
  month: CalendarDate,
  today: CalendarDate,
): CalendarDate {
  const selected = mode === 'range' ? rangeValue(value).start : singleValue(value);
  if (selected && monthContains(month, selected)) return selected;
  if (monthContains(month, today)) return today;
  return month;
}

function compareDates(a: CalendarDate, b: CalendarDate): number {
  return a.localeCompare(b);
}

function inRange(date: CalendarDate, range: CalendarRange): boolean {
  if (!range.start) return false;
  const end = range.end ?? range.start;
  return compareDates(date, range.start) >= 0 && compareDates(date, end) <= 0;
}

function calendarDays(month: CalendarDate, weekStartsOn: number): CalendarDate[] {
  const first = parseCalendarDate(startOfMonth(month));
  if (!first) return [];
  const offset = (first.getUTCDay() - weekStartsOn + 7) % 7;
  const gridStart = addDays(serializeCalendarDate(first), -offset);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function weekdayLabels(locale: string, weekStartsOn: number): string[] {
  // 2024-01-07 is a Sunday. Keeping the formatter in UTC makes this deterministic.
  const sunday = new Date(Date.UTC(2024, 0, 7));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(sunday);
    date.setUTCDate(sunday.getUTCDate() + ((weekStartsOn + index) % 7));
    return new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      timeZone: 'UTC',
    }).format(date);
  });
}

function valueAnnouncement(
  value: CalendarValue,
  mode: 'single' | 'range',
  locale: string,
): string {
  if (mode === 'single') {
    const selected = singleValue(value);
    return selected ? `Fecha seleccionada: ${formatCalendarDate(selected, locale, { dateStyle: 'full' })}` : 'Sin fecha seleccionada';
  }
  const range = rangeValue(value);
  if (!range.start) return 'Sin rango seleccionado';
  const start = formatCalendarDate(range.start, locale, { dateStyle: 'full' });
  if (!range.end) return `Inicio del rango: ${start}`;
  return `Rango seleccionado: ${start} a ${formatCalendarDate(range.end, locale, { dateStyle: 'full' })}`;
}

/**
 * Accessible date-only calendar. Values are serialized as `YYYY-MM-DD`; selection,
 * comparisons, navigation, and formatting use UTC calendar fields so deploying an
 * app in another timezone never changes the selected day.
 */
export const Calendar = forwardRef<HTMLDivElement, CalendarProps>(function Calendar(
  props,
  forwardedRef,
) {
  const {
    mode: modeProp = 'single',
    value: controlledSelection,
    defaultValue: defaultSelectionProp,
    onValueChange,
    locale = 'es-MX',
    min,
    max,
    disabledDates,
    month: controlledMonth,
    defaultMonth,
    onMonthChange,
    weekStartsOn = 1,
    showOutsideDays = true,
    showActions = false,
    clearLabel = 'Limpiar',
    resetLabel = 'Restablecer',
    previousMonthLabel = 'Mes anterior',
    nextMonthLabel = 'Mes siguiente',
    previousYearLabel = 'Año anterior',
    nextYearLabel = 'Año siguiente',
    disabled = false,
    required = false,
    autoFocus = false,
    className,
    'aria-label': ariaLabel = 'Calendario',
    ...rootProps
  } = props;
  const mode = modeProp;
  const defaultSelection: CalendarValue =
    mode === 'range'
      ? ((defaultSelectionProp as CalendarRange | undefined) ?? EMPTY_RANGE)
      : ((defaultSelectionProp as CalendarDate | null | undefined) ?? null);
  const isValueControlled = controlledSelection !== undefined;
  const [internalValue, setInternalValue] = useState<CalendarValue>(defaultSelection);
  const value: CalendarValue = isValueControlled
    ? (controlledSelection as CalendarValue)
    : internalValue;
  const today = todayCalendarDate();
  const initialMonth =
    normalizedMonth(defaultMonth) ??
    normalizedMonth(mode === 'range' ? rangeValue(value).start : singleValue(value)) ??
    startOfMonth(today);
  const [internalMonth, setInternalMonth] = useState(initialMonth);
  const visibleMonth = normalizedMonth(controlledMonth) ?? internalMonth;
  const [activeDate, setActiveDate] = useState(() =>
    defaultActiveDate(value, mode, visibleMonth, today),
  );
  const rootId = useId();
  const headingId = `${rootId}-heading`;
  const statusId = `${rootId}-status`;
  const dayRefs = useRef(new Map<CalendarDate, HTMLButtonElement>());
  const pendingFocus = useRef(false);

  const minDate = parseCalendarDate(min) ? min : undefined;
  const maxDate = parseCalendarDate(max) ? max : undefined;
  const disabledSet = useMemo(
    () => new Set(Array.isArray(disabledDates) ? disabledDates : []),
    [disabledDates],
  );
  const isDisabledDate = useCallback(
    (date: CalendarDate) =>
      disabled ||
      Boolean(minDate && compareDates(date, minDate) < 0) ||
      Boolean(maxDate && compareDates(date, maxDate) > 0) ||
      disabledSet.has(date) ||
      (typeof disabledDates === 'function' && disabledDates(date)),
    [disabled, disabledDates, disabledSet, maxDate, minDate],
  );

  const days = useMemo(
    () => calendarDays(visibleMonth, weekStartsOn),
    [visibleMonth, weekStartsOn],
  );
  const weekdays = useMemo(
    () => weekdayLabels(locale, weekStartsOn),
    [locale, weekStartsOn],
  );

  useEffect(() => {
    if (!isDisabledDate(activeDate)) return;
    const firstEnabled = days.find((date) => !isDisabledDate(date));
    if (firstEnabled) setActiveDate(firstEnabled);
  }, [activeDate, days, isDisabledDate]);

  const emitValue = useCallback(
    (next: CalendarValue) => {
      if (!isValueControlled) setInternalValue(next);
      if (mode === 'range') {
        (onValueChange as CalendarRangeProps['onValueChange'])?.(rangeValue(next));
      } else {
        (onValueChange as CalendarSingleProps['onValueChange'])?.(singleValue(next));
      }
    },
    [isValueControlled, mode, onValueChange],
  );

  const setMonth = useCallback(
    (next: CalendarDate) => {
      const normalized = startOfMonth(next);
      if (controlledMonth === undefined) setInternalMonth(normalized);
      onMonthChange?.(normalized);
    },
    [controlledMonth, onMonthChange],
  );

  const monthAllowed = useCallback(
    (candidate: CalendarDate) =>
      (!minDate || compareDates(endOfMonth(candidate), minDate) >= 0) &&
      (!maxDate || compareDates(startOfMonth(candidate), maxDate) <= 0),
    [maxDate, minDate],
  );

  const nearestEnabled = useCallback(
    (candidate: CalendarDate, direction: 1 | -1) => {
      let next = candidate;
      let searchDirection = direction;
      if (minDate && compareDates(next, minDate) < 0) {
        next = minDate;
        searchDirection = 1;
      }
      if (maxDate && compareDates(next, maxDate) > 0) {
        next = maxDate;
        searchDirection = -1;
      }
      for (let index = 0; index < 3660; index += 1) {
        if (!isDisabledDate(next)) return next;
        next = addDays(next, searchDirection);
        if (minDate && compareDates(next, minDate) < 0) break;
        if (maxDate && compareDates(next, maxDate) > 0) break;
      }
      return activeDate;
    },
    [activeDate, isDisabledDate, maxDate, minDate],
  );

  const focusDate = useCallback(
    (candidate: CalendarDate, direction: 1 | -1 = 1) => {
      const next = nearestEnabled(candidate, direction);
      setActiveDate(next);
      if (!monthContains(visibleMonth, next)) setMonth(startOfMonth(next));
      pendingFocus.current = true;
    },
    [nearestEnabled, setMonth, visibleMonth],
  );

  useEffect(() => {
    if (!pendingFocus.current) return;
    const node = dayRefs.current.get(activeDate);
    if (node) {
      pendingFocus.current = false;
      node.focus();
    }
  }, [activeDate, visibleMonth]);

  useLayoutEffect(() => {
    if (!autoFocus) return;
    queueMicrotask(() => dayRefs.current.get(activeDate)?.focus());
  }, [activeDate, autoFocus]);

  const selectDate = (date: CalendarDate) => {
    if (isDisabledDate(date)) return;
    setActiveDate(date);
    if (mode === 'single') {
      emitValue(date);
      return;
    }
    const current = rangeValue(value);
    if (!current.start || current.end) {
      emitValue({ start: date, end: null });
    } else if (compareDates(date, current.start) < 0) {
      emitValue({ start: date, end: current.start });
    } else {
      emitValue({ start: current.start, end: date });
    }
  };

  const clear = () => emitValue(mode === 'range' ? EMPTY_RANGE : null);
  const reset = () => emitValue(defaultSelection);
  const canClear =
    !required &&
    (mode === 'range'
      ? Boolean(rangeValue(value).start || rangeValue(value).end)
      : Boolean(singleValue(value)));
  const canReset =
    mode === 'range'
      ? !sameRange(rangeValue(value), rangeValue(defaultSelection))
      : singleValue(value) !== singleValue(defaultSelection);

  const handleGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    let candidate: CalendarDate | null = null;
    let direction: 1 | -1 = 1;
    if (event.key === 'ArrowLeft') {
      candidate = addDays(activeDate, -1);
      direction = -1;
    } else if (event.key === 'ArrowRight') {
      candidate = addDays(activeDate, 1);
    } else if (event.key === 'ArrowUp') {
      candidate = addDays(activeDate, -7);
      direction = -1;
    } else if (event.key === 'ArrowDown') {
      candidate = addDays(activeDate, 7);
    } else if (event.key === 'Home') {
      const date = parseCalendarDate(activeDate);
      if (date) candidate = addDays(activeDate, -((date.getUTCDay() - weekStartsOn + 7) % 7));
      direction = -1;
    } else if (event.key === 'End') {
      const date = parseCalendarDate(activeDate);
      if (date) candidate = addDays(activeDate, 6 - ((date.getUTCDay() - weekStartsOn + 7) % 7));
    } else if (event.key === 'PageUp') {
      candidate = addMonths(activeDate, event.shiftKey ? -12 : -1);
      direction = -1;
    } else if (event.key === 'PageDown') {
      candidate = addMonths(activeDate, event.shiftKey ? 12 : 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectDate(activeDate);
      return;
    }
    if (candidate) {
      event.preventDefault();
      focusDate(candidate, direction);
    }
  };

  const goToMonth = (amount: number) => {
    const nextMonth = startOfMonth(addMonths(visibleMonth, amount));
    if (!monthAllowed(nextMonth)) return;
    setMonth(nextMonth);
    const desired = addMonths(activeDate, amount);
    setActiveDate(nearestEnabled(desired, amount < 0 ? -1 : 1));
    pendingFocus.current = true;
  };

  const selectedRange = rangeValue(value);
  const selectedSingle = singleValue(value);
  const localizedMonth = formatCalendarDate(visibleMonth, locale, {
    month: 'long',
    year: 'numeric',
  });
  const monthLabel = `${localizedMonth.charAt(0).toLocaleUpperCase(locale)}${localizedMonth.slice(1)}`;

  return (
    <div
      {...rootProps}
      ref={forwardedRef}
      className={['pr-calendar', className].filter(Boolean).join(' ')}
      data-slot="calendar"
      data-mode={mode}
      role="group"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
    >
      <header className="pr-calendar__header">
        <button
          type="button"
          className="pr-calendar__nav"
          aria-label={previousYearLabel}
          disabled={disabled || !monthAllowed(addMonths(visibleMonth, -12))}
          onClick={() => goToMonth(-12)}
        >
          <ChevronsLeft size={16} aria-hidden />
        </button>
        <button
          type="button"
          className="pr-calendar__nav"
          aria-label={previousMonthLabel}
          disabled={disabled || !monthAllowed(addMonths(visibleMonth, -1))}
          onClick={() => goToMonth(-1)}
        >
          <ChevronLeft size={16} aria-hidden />
        </button>
        <h2 id={headingId} className="pr-calendar__month" aria-live="polite">
          {monthLabel}
        </h2>
        <button
          type="button"
          className="pr-calendar__nav"
          aria-label={nextMonthLabel}
          disabled={disabled || !monthAllowed(addMonths(visibleMonth, 1))}
          onClick={() => goToMonth(1)}
        >
          <ChevronRight size={16} aria-hidden />
        </button>
        <button
          type="button"
          className="pr-calendar__nav"
          aria-label={nextYearLabel}
          disabled={disabled || !monthAllowed(addMonths(visibleMonth, 12))}
          onClick={() => goToMonth(12)}
        >
          <ChevronsRight size={16} aria-hidden />
        </button>
      </header>

      <div
        role="grid"
        aria-labelledby={headingId}
        aria-describedby={statusId}
        className="pr-calendar__grid"
        onKeyDown={handleGridKeyDown}
      >
        <div role="row" className="pr-calendar__weekdays">
          {weekdays.map((weekday, index) => (
            <span
              key={`${weekday}-${index}`}
              role="columnheader"
              aria-label={weekday}
              className="pr-calendar__weekday"
            >
              {weekday.slice(0, 2)}
            </span>
          ))}
        </div>
        <div className="pr-calendar__days">
          {Array.from({ length: 6 }, (_, weekIndex) => (
            <div key={weekIndex} role="row" className="pr-calendar__week">
              {days.slice(weekIndex * 7, weekIndex * 7 + 7).map((date) => {
            const outside = !monthContains(visibleMonth, date);
            if (outside && !showOutsideDays) {
              return <span key={date} role="gridcell" aria-hidden className="pr-calendar__day-placeholder" />;
            }
            const isDisabled = isDisabledDate(date);
            const selected =
              mode === 'range' ? inRange(date, selectedRange) : selectedSingle === date;
            const rangeStart = mode === 'range' && selectedRange.start === date;
            const rangeEnd = mode === 'range' && selectedRange.end === date;
            return (
              <button
                key={date}
                ref={(node) => {
                  if (node) dayRefs.current.set(date, node);
                  else dayRefs.current.delete(date);
                }}
                type="button"
                role="gridcell"
                className="pr-calendar__day"
                tabIndex={activeDate === date && !isDisabled ? 0 : -1}
                disabled={isDisabled}
                aria-disabled={isDisabled || undefined}
                aria-selected={selected}
                aria-current={date === today ? 'date' : undefined}
                aria-label={formatCalendarDate(date, locale, { dateStyle: 'full' })}
                data-date={date}
                data-outside={outside ? '' : undefined}
                data-today={date === today ? '' : undefined}
                data-selected={selected ? '' : undefined}
                data-range-start={rangeStart ? '' : undefined}
                data-range-end={rangeEnd ? '' : undefined}
                data-range-middle={
                  mode === 'range' && selected && !rangeStart && !rangeEnd ? '' : undefined
                }
                onFocus={() => setActiveDate(date)}
                onClick={() => selectDate(date)}
              >
                {Number(date.slice(8, 10))}
              </button>
            );
              })}
            </div>
          ))}
        </div>
      </div>

      {showActions ? (
        <footer className="pr-calendar__actions">
          <button type="button" className="pr-calendar__action" disabled={!canClear || disabled} onClick={clear}>
            {clearLabel}
          </button>
          <button type="button" className="pr-calendar__action" disabled={!canReset || disabled} onClick={reset}>
            {resetLabel}
          </button>
        </footer>
      ) : null}
      <p id={statusId} className="pr-visually-hidden" role="status" aria-live="polite">
        {valueAnnouncement(value, mode, locale)}
      </p>
    </div>
  );
});
