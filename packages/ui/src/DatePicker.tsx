'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronDown } from 'lucide-react';
import {
  Calendar,
  formatCalendarDate,
  type CalendarDate,
  type CalendarDisabledDates,
  type CalendarRange,
} from './Calendar';
import { menuStyle, useAnchoredMenu } from './useAnchoredMenu';

export type DatePickerSize = 'sm' | 'md' | 'lg';

interface DatePickerSharedProps {
  id?: string;
  locale?: string;
  min?: CalendarDate;
  max?: CalendarDate;
  disabledDates?: CalendarDisabledDates;
  month?: CalendarDate;
  defaultMonth?: CalendarDate;
  onMonthChange?: (month: CalendarDate) => void;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  showOutsideDays?: boolean;
  disabled?: boolean;
  required?: boolean;
  placeholder?: ReactNode;
  clearLabel?: ReactNode;
  resetLabel?: ReactNode;
  formatOptions?: Intl.DateTimeFormatOptions;
  rangeSeparator?: ReactNode;
  align?: 'left' | 'right';
  datePickerSize?: DatePickerSize;
  fullWidth?: boolean;
  className?: string;
  contentClassName?: string;
  contentStyle?: CSSProperties;
  calendarClassName?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
  'aria-required'?: boolean | 'true' | 'false';
}

export interface DatePickerSingleProps extends DatePickerSharedProps {
  mode?: 'single';
  value?: CalendarDate | null;
  defaultValue?: CalendarDate | null;
  onValueChange?: (value: CalendarDate | null) => void;
  name?: string;
  startName?: never;
  endName?: never;
}

export interface DatePickerRangeProps extends DatePickerSharedProps {
  mode: 'range';
  value?: CalendarRange;
  defaultValue?: CalendarRange;
  onValueChange?: (value: CalendarRange) => void;
  name?: never;
  startName?: string;
  endName?: string;
}

export type DatePickerProps = DatePickerSingleProps | DatePickerRangeProps;
type DatePickerValue = CalendarDate | null | CalendarRange;

const EMPTY_RANGE: CalendarRange = { start: null, end: null };
const FOCUSABLE = [
  'a[href]',
  'button:not(:disabled)',
  'input:not(:disabled):not([type="hidden"])',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function asRange(value: DatePickerValue): CalendarRange {
  return typeof value === 'object' && value !== null ? value : EMPTY_RANGE;
}

function asSingle(value: DatePickerValue): CalendarDate | null {
  return typeof value === 'string' ? value : null;
}

function focusAdjacent(trigger: HTMLElement, backwards: boolean): void {
  const controls = Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true',
  );
  const current = controls.indexOf(trigger);
  controls[current + (backwards ? -1 : 1)]?.focus();
}

function displayValue(
  value: DatePickerValue,
  mode: 'single' | 'range',
  locale: string,
  options: Intl.DateTimeFormatOptions,
  separator: ReactNode,
): ReactNode | null {
  if (mode === 'single') {
    const selected = asSingle(value);
    return selected ? formatCalendarDate(selected, locale, options) : null;
  }
  const range = asRange(value);
  if (!range.start && !range.end) return null;
  return (
    <>
      {range.start ? formatCalendarDate(range.start, locale, options) : '…'}
      <span className="pr-date-picker__range-separator">{separator}</span>
      {range.end ? formatCalendarDate(range.end, locale, options) : '…'}
    </>
  );
}

/**
 * Anchored date-only picker backed by `Calendar`. Hidden form fields always submit
 * the same `YYYY-MM-DD` values exposed by `onValueChange`; no timezone conversion
 * happens between display, state, and form serialization.
 */
export function DatePicker(props: DatePickerProps) {
  const {
    mode: modeProp = 'single',
    value: controlledValue,
    defaultValue: defaultValueProp,
    onValueChange,
    id: providedId,
    locale = 'es-MX',
    min,
    max,
    disabledDates,
    month,
    defaultMonth,
    onMonthChange,
    weekStartsOn = 1,
    showOutsideDays = true,
    disabled = false,
    required = false,
    placeholder = 'Seleccionar fecha',
    clearLabel = 'Limpiar',
    resetLabel = 'Restablecer',
    formatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
    rangeSeparator = '–',
    align = 'left',
    datePickerSize = 'md',
    fullWidth = false,
    className,
    contentClassName,
    contentStyle,
    calendarClassName,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    'aria-required': ariaRequired,
  } = props;
  const mode = modeProp;
  const defaultValue: DatePickerValue =
    mode === 'range'
      ? ((defaultValueProp as CalendarRange | undefined) ?? EMPTY_RANGE)
      : ((defaultValueProp as CalendarDate | null | undefined) ?? null);
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState<DatePickerValue>(defaultValue);
  const value: DatePickerValue = isControlled
    ? (controlledValue as DatePickerValue)
    : internalValue;
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const dialogId = `${id}-dialog`;
  const {
    open,
    setOpen,
    triggerRef,
    menuRef,
    pos,
  } = useAnchoredMenu<HTMLButtonElement>({
    align,
    matchTriggerWidth: false,
    maxHeight: 480,
    minimumSpace: 360,
  });

  useEffect(() => {
    if (disabled && open) setOpen(false);
  }, [disabled, open, setOpen]);

  const commit = useCallback(
    (next: DatePickerValue) => {
      if (!isControlled) {
        setInternalValue(next);
      }
      if (mode === 'range') {
        (onValueChange as DatePickerRangeProps['onValueChange'])?.(asRange(next));
      } else {
        (onValueChange as DatePickerSingleProps['onValueChange'])?.(asSingle(next));
      }
      const complete = mode === 'single' ? Boolean(asSingle(next)) : Boolean(asRange(next).end);
      if (complete) {
        setOpen(false);
        queueMicrotask(() => triggerRef.current?.focus());
      }
    },
    [isControlled, mode, onValueChange, setOpen, triggerRef],
  );

  const formatted = useMemo(
    () => displayValue(value, mode, locale, formatOptions, rangeSeparator),
    [formatOptions, locale, mode, rangeSeparator, value],
  );

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' && !disabled) {
      event.preventDefault();
      setOpen(true);
    }
  };

  const handleContentKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    event.preventDefault();
    setOpen(false);
    const trigger = triggerRef.current;
    if (trigger) queueMicrotask(() => focusAdjacent(trigger, event.shiftKey));
  };

  const contentPosition = {
    ...menuStyle(pos),
    width: undefined,
    minWidth: undefined,
    ...contentStyle,
  };
  const singleName = mode === 'single' ? (props as DatePickerSingleProps).name : undefined;
  const startName = mode === 'range' ? (props as DatePickerRangeProps).startName : undefined;
  const endName = mode === 'range' ? (props as DatePickerRangeProps).endName : undefined;

  return (
    <span
      className={[
        'pr-date-picker',
        fullWidth ? 'pr-date-picker--block' : null,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      data-slot="date-picker"
      data-mode={mode}
    >
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={[
          'pr-date-picker__trigger',
          `pr-date-picker__trigger--${datePickerSize}`,
          open ? 'pr-date-picker__trigger--open' : null,
        ]
          .filter(Boolean)
          .join(' ')}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        aria-required={ariaRequired ?? (required || undefined)}
        data-placeholder={formatted ? undefined : ''}
        data-state={open ? 'open' : 'closed'}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
      >
        <CalendarDays className="pr-date-picker__icon" size={16} aria-hidden />
        <span className="pr-date-picker__value">{formatted ?? placeholder}</span>
        <ChevronDown className="pr-date-picker__chevron" size={16} aria-hidden />
      </button>

      {singleName ? (
        <input type="hidden" name={singleName} value={asSingle(value) ?? ''} disabled={disabled} />
      ) : null}
      {startName ? (
        <input type="hidden" name={startName} value={asRange(value).start ?? ''} disabled={disabled} />
      ) : null}
      {endName ? (
        <input type="hidden" name={endName} value={asRange(value).end ?? ''} disabled={disabled} />
      ) : null}

      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              id={dialogId}
              role="dialog"
              aria-modal="false"
              aria-label={mode === 'range' ? 'Seleccionar rango de fechas' : 'Seleccionar fecha'}
              data-slot="date-picker-content"
              className={['pr-date-picker__content', contentClassName]
                .filter(Boolean)
                .join(' ')}
              style={contentPosition}
              onKeyDown={handleContentKeyDown}
            >
              {mode === 'range' ? (
                <Calendar
                  mode="range"
                  value={asRange(value)}
                  defaultValue={asRange(defaultValue)}
                  onValueChange={commit}
                  {...{
                    locale,
                    min,
                    max,
                    disabledDates,
                    month,
                    defaultMonth,
                    onMonthChange,
                    weekStartsOn,
                    showOutsideDays,
                    disabled,
                    required,
                    clearLabel,
                    resetLabel,
                  }}
                  autoFocus
                  showActions
                  className={calendarClassName}
                />
              ) : (
                <Calendar
                  mode="single"
                  value={asSingle(value)}
                  defaultValue={asSingle(defaultValue)}
                  onValueChange={commit}
                  {...{
                    locale,
                    min,
                    max,
                    disabledDates,
                    month,
                    defaultMonth,
                    onMonthChange,
                    weekStartsOn,
                    showOutsideDays,
                    disabled,
                    required,
                    clearLabel,
                    resetLabel,
                  }}
                  autoFocus
                  showActions
                  className={calendarClassName}
                />
              )}
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}
