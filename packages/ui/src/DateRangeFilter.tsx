'use client';

import { useCallback, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { CalendarDays, Check, ChevronDown } from 'lucide-react';
import { Button } from './Button';
import {
  Calendar,
  parseCalendarDate,
  type CalendarDate,
  type CalendarRange,
  type CalendarSharedProps,
} from './Calendar';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';

/**
 * The window of a list. `''` is an open bound. Valid shapes: empty, start-only,
 * or complete with `from <= to`. An end-only range is not representable: the
 * calendar always fixes the start first, so it can never be edited faithfully.
 */
export interface DateRange {
  from: CalendarDate | '';
  to: CalendarDate | '';
}

export const EMPTY_DATE_RANGE: DateRange = { from: '', to: '' };

export interface DateRangePreset {
  id: string;
  label: ReactNode;
  range: DateRange;
}

export interface DateRangeFilterLabels {
  /** The state with no bounds. Reads as a state ("Todo el tiempo"), not an action. */
  allTime: string;
  /** Heading of the calendar section. */
  custom: string;
  from: string;
  to: string;
  apply: string;
  clear: string;
  /** Accessible name of the dialog, e.g. "Filtrar por fechas". */
  dialog: string;
}

export type DateRangeFilterSize = 'sm' | 'md';

export interface DateRangeFilterProps {
  value: DateRange;
  onChange: (next: DateRange) => void;
  /**
   * Quick ranges, computed by the caller; the package owns no date logic. A preset
   * whose range is not valid under the invariant and the limits renders disabled
   * and can never be committed.
   */
  presets: readonly DateRangePreset[];
  labels: DateRangeFilterLabels;
  /**
   * BCP 47 locale for the trigger text and the calendar. Defaults to `es-MX`, the
   * same default `Calendar` and `DatePicker` use; the runtime locale is never read.
   */
  locale?: string;
  /** `sm` matches `MultiSelect variant="filter"`; `md` matches a field. */
  size?: DateRangeFilterSize;
  min?: CalendarDate;
  max?: CalendarDate;
  /** Calendar labels and week configuration, forwarded as-is. */
  calendar?: Pick<
    CalendarSharedProps,
    | 'weekStartsOn'
    | 'showOutsideDays'
    | 'previousMonthLabel'
    | 'nextMonthLabel'
    | 'previousYearLabel'
    | 'nextYearLabel'
  >;
  className?: string;
  id?: string;
  'aria-label': string;
}

export function isSameDateRange(a: DateRange, b: DateRange): boolean {
  return a.from === b.from && a.to === b.to;
}

/** Empty, start-only, or complete and ordered, with every bound a real date inside the limits. */
export function isValidDateRange(
  value: DateRange,
  limits: { min?: CalendarDate; max?: CalendarDate } = {},
): boolean {
  const from = value.from ? parseCalendarDate(value.from) : null;
  const to = value.to ? parseCalendarDate(value.to) : null;
  if (value.from && !from) return false;
  if (value.to && !to) return false;
  if (to && !from) return false;
  if (from && to && from.getTime() > to.getTime()) return false;
  const min = limits.min ? parseCalendarDate(limits.min) : null;
  const max = limits.max ? parseCalendarDate(limits.max) : null;
  for (const bound of [from, to]) {
    if (!bound) continue;
    if (min && bound.getTime() < min.getTime()) return false;
    if (max && bound.getTime() > max.getTime()) return false;
  }
  return true;
}

const DEFAULT_LOCALE = 'es-MX';

/**
 * "3 ago – 2 sep 2026", "20 dic 2025 – 5 ene 2026", "Desde 3 ago 2026", or the
 * all-time label for an empty or invalid range. UTC calendar fields, so the
 * host timezone never shifts a day.
 */
export function formatDateRange(
  range: DateRange,
  locale: string | undefined,
  labels: Pick<DateRangeFilterLabels, 'allTime' | 'from' | 'to'>,
): string {
  if (!isValidDateRange(range)) return labels.allTime;
  const from = range.from ? parseCalendarDate(range.from) : null;
  const to = range.to ? parseCalendarDate(range.to) : null;
  if (!from) return labels.allTime;
  const resolved = locale ?? DEFAULT_LOCALE;
  const dayMonth = new Intl.DateTimeFormat(resolved, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  const dayMonthYear = new Intl.DateTimeFormat(resolved, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  if (!to) return `${labels.from} ${dayMonthYear.format(from)}`;
  const sameYear = from.getUTCFullYear() === to.getUTCFullYear();
  return `${(sameYear ? dayMonth : dayMonthYear).format(from)} – ${dayMonthYear.format(to)}`;
}

function toCalendarRange(value: DateRange): CalendarRange {
  return { start: value.from || null, end: value.to || null };
}

function fromCalendarRange(range: CalendarRange): DateRange {
  return { from: range.start ?? '', to: range.end ?? '' };
}

/**
 * One control for the date window of a list: a pill that names the active range
 * and opens the presets plus a calendar for a custom range. Presets commit on
 * click; the calendar edits a draft that `apply` commits. The draft resets from
 * `value` on every open and is discarded on every other close. `onChange` only
 * ever emits a range that passes `isValidDateRange` with the limits; an invalid
 * controlled value reads as all time and marks the trigger `data-invalid`.
 */
export function DateRangeFilter({
  value,
  onChange,
  presets,
  labels,
  locale,
  size = 'sm',
  min,
  max,
  calendar,
  className,
  id: providedId,
  'aria-label': ariaLabel,
}: DateRangeFilterProps) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange>(value);

  const limits = useMemo(() => ({ min, max }), [min, max]);
  const valueValid = isValidDateRange(value, limits);
  const isEmpty = valueValid && !value.from && !value.to;
  const presetStates = useMemo(
    () =>
      presets.map((preset) => ({
        preset,
        valid: isValidDateRange(preset.range, limits),
      })),
    [presets, limits],
  );
  const activePreset = useMemo(
    () =>
      valueValid
        ? presetStates.find(({ preset, valid }) => valid && isSameDateRange(preset.range, value))
            ?.preset
        : undefined,
    [presetStates, value, valueValid],
  );
  const triggerLabel: ReactNode = !valueValid
    ? labels.allTime
    : isEmpty
      ? labels.allTime
      : (activePreset?.label ?? formatDateRange(value, locale, labels));

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) setDraft(isValidDateRange(value, limits) ? value : EMPTY_DATE_RANGE);
      setOpen(next);
    },
    [limits, value],
  );

  const commit = (next: DateRange) => {
    if (!isValidDateRange(next, limits)) return;
    if (!isSameDateRange(next, value)) onChange(next);
    setOpen(false);
    queueMicrotask(() => triggerRef.current?.focus());
  };

  const draftValid = isValidDateRange(draft, limits);
  const draftFrom = draft.from ? parseCalendarDate(draft.from) : null;
  const draftTo = draft.to ? parseCalendarDate(draft.to) : null;
  const resolvedLocale = locale ?? DEFAULT_LOCALE;
  const boundFormat = new Intl.DateTimeFormat(resolvedLocale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <div
      className={['pr-date-range', className].filter(Boolean).join(' ')}
      data-slot="date-range-filter"
    >
      <Popover open={open} onOpenChange={handleOpenChange} maxHeight={520} minimumSpace={400}>
        <PopoverTrigger
          ref={triggerRef}
          id={id}
          aria-label={ariaLabel}
          data-state={open ? 'open' : 'closed'}
          data-active={valueValid && !isEmpty ? '' : undefined}
          data-invalid={valueValid ? undefined : ''}
          className={[
            'pr-date-range__trigger',
            `pr-date-range__trigger--${size}`,
            valueValid && !isEmpty ? 'pr-date-range__trigger--active' : null,
            open ? 'pr-date-range__trigger--open' : null,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <CalendarDays size={14} aria-hidden className="pr-date-range__icon" />
          <span className="pr-date-range__value">{triggerLabel}</span>
          <ChevronDown size={14} aria-hidden className="pr-date-range__chevron" />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          padding="none"
          aria-label={labels.dialog}
          className="pr-date-range__content"
        >
          <div role="group" aria-label={ariaLabel} className="pr-date-range__presets">
            <PresetOption active={isEmpty} onSelect={() => commit(EMPTY_DATE_RANGE)}>
              {labels.allTime}
            </PresetOption>
            {presetStates.map(({ preset, valid }) => (
              <PresetOption
                key={preset.id}
                active={activePreset?.id === preset.id}
                disabled={!valid}
                onSelect={() => commit(preset.range)}
              >
                {preset.label}
              </PresetOption>
            ))}
          </div>
          <div className="pr-date-range__custom">
            <p className="pr-date-range__custom-title" id={`${id}-custom`}>
              {labels.custom}
            </p>
            <dl className="pr-date-range__bounds">
              <div className="pr-date-range__bound">
                <dt>{labels.from}</dt>
                <dd>{draftFrom ? boundFormat.format(draftFrom) : '—'}</dd>
              </div>
              <div className="pr-date-range__bound">
                <dt>{labels.to}</dt>
                <dd>{draftTo ? boundFormat.format(draftTo) : '—'}</dd>
              </div>
            </dl>
            <Calendar
              mode="range"
              value={toCalendarRange(draft)}
              onValueChange={(next) => setDraft(fromCalendarRange(next))}
              locale={resolvedLocale}
              min={min}
              max={max}
              aria-labelledby={`${id}-custom`}
              className="pr-date-range__calendar"
              {...calendar}
            />
            <div className="pr-date-range__actions">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!draft.from && !draft.to}
                onClick={() => setDraft(EMPTY_DATE_RANGE)}
              >
                {labels.clear}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!draftValid}
                onClick={() => commit(draft)}
              >
                {labels.apply}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function PresetOption({
  active,
  disabled = false,
  onSelect,
  children,
}: {
  active: boolean;
  /** The preset's range fails the invariant or the limits: shown, muted, never committed. */
  disabled?: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      data-state={active ? 'active' : 'inactive'}
      className="pr-date-range__preset"
      onClick={disabled ? undefined : onSelect}
    >
      <span className="pr-date-range__preset-label">{children}</span>
      {active ? <Check size={14} aria-hidden className="pr-date-range__check" /> : null}
    </button>
  );
}
