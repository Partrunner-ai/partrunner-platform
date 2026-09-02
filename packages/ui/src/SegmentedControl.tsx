'use client';

import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: LucideIcon;
  /** Rows behind this view, in tabular figures. */
  count?: number;
  disabled?: boolean;
}

export type SegmentedControlSize = 'md' | 'lg';

interface SegmentedControlBaseProps<T extends string> {
  /** The checked option, or `null` when none is. */
  value: T | null;
  onChange: (value: T) => void;
  options: ReadonlyArray<SegmentedOption<T>>;
  /** Option height 40px (`md`) or 44px (`lg`). */
  size?: SegmentedControlSize;
  /** Options share the full width instead of sizing to their labels. */
  fullWidth?: boolean;
  className?: string;
  id?: string;
  /** Swaps the Left and Right arrows. */
  dir?: 'ltr' | 'rtl';
}

export type SegmentedControlProps<T extends string> = SegmentedControlBaseProps<T> &
  ({ 'aria-label': string; 'aria-labelledby'?: never } | { 'aria-labelledby': string; 'aria-label'?: never });

/**
 * A single choice that changes the representation or the subset of the same
 * data — Todas/Mis, lista/tablero, día/semana. Not tabs: nothing else on the
 * page appears or disappears with it.
 *
 * Radio semantics: one `radiogroup`, `radio` buttons, roving focus with the
 * arrow keys (wrapping, skipping disabled options), Home and End. A click or
 * key on the checked option calls nothing.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  fullWidth = false,
  className,
  id,
  dir = 'ltr',
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}: SegmentedControlProps<T>) {
  const generatedId = useId();
  const groupId = id ?? generatedId;
  const refs = useRef(new Map<T, HTMLButtonElement>());

  const enabled = options.filter((option) => !option.disabled);
  const checked = enabled.find((option) => option.value === value) ?? null;
  const focusable = checked ?? enabled[0] ?? null;
  const allDisabled = enabled.length === 0;

  const select = (option: SegmentedOption<T>) => {
    refs.current.get(option.value)?.focus();
    if (option.value !== value) onChange(option.value);
  };

  const step = (from: T, delta: 1 | -1) => {
    if (enabled.length === 0) return;
    const index = enabled.findIndex((option) => option.value === from);
    const next = enabled[(index + delta + enabled.length) % enabled.length];
    if (next) select(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, option: SegmentedOption<T>) => {
    const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const backward = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    if (event.key === forward || event.key === 'ArrowDown') {
      event.preventDefault();
      step(option.value, 1);
    } else if (event.key === backward || event.key === 'ArrowUp') {
      event.preventDefault();
      step(option.value, -1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      if (enabled[0]) select(enabled[0]);
    } else if (event.key === 'End') {
      event.preventDefault();
      const last = enabled[enabled.length - 1];
      if (last) select(last);
    }
  };

  return (
    <div
      id={groupId}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-disabled={allDisabled || undefined}
      dir={dir}
      data-slot="segmented-control"
      className={[
        'pr-segmented',
        `pr-segmented--${size}`,
        fullWidth ? 'pr-segmented--block' : null,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {options.map((option) => {
        const isChecked = checked?.value === option.value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            ref={(node) => {
              if (node) refs.current.set(option.value, node);
              else refs.current.delete(option.value);
            }}
            id={`${groupId}-${option.value}`}
            type="button"
            role="radio"
            aria-checked={isChecked}
            tabIndex={!option.disabled && focusable?.value === option.value ? 0 : -1}
            disabled={option.disabled}
            data-slot="segmented-option"
            data-state={isChecked ? 'checked' : 'unchecked'}
            className="pr-segmented__option"
            onClick={() => {
              if (!option.disabled) select(option);
            }}
            onKeyDown={(event) => onKeyDown(event, option)}
          >
            {Icon ? <Icon size={14} aria-hidden className="pr-segmented__icon" /> : null}
            <span className="pr-segmented__label">{option.label}</span>
            {typeof option.count === 'number' ? (
              <span className="pr-segmented__count">{option.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
