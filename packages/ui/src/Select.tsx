import { forwardRef, useId, type ReactNode, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { FormField } from './FormField';

export type SelectSize = 'sm' | 'md' | 'lg';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  /** Pass options, or pass `<option>` children — not both. */
  options?: ReadonlyArray<SelectOption>;
  /** Shown while nothing is chosen, as a disabled first entry. */
  placeholder?: string;
  label?: ReactNode;
  /** Guidance shown under the field. Hidden while `error` is set. */
  hint?: ReactNode;
  /** Presence marks the field invalid; the text replaces `hint`. */
  error?: ReactNode;
  selectSize?: SelectSize;
  fullWidth?: boolean;
  containerClassName?: string;
  children?: ReactNode;
}

type SelectControlProps = Omit<
  SelectProps,
  'label' | 'hint' | 'error' | 'fullWidth' | 'containerClassName'
>;

const SelectControl = forwardRef<HTMLSelectElement, SelectControlProps>(function SelectControl(
  {
    options,
    placeholder,
    selectSize = 'md',
    className,
    children,
    value,
    defaultValue,
    ...rest
  },
  ref,
) {
  return (
    <span className={`pr-select__control pr-select__control--${selectSize}`}>
      <select
        ref={ref}
        className={['pr-select__input', className].filter(Boolean).join(' ')}
        value={value}
        defaultValue={defaultValue ?? (placeholder !== undefined && value === undefined ? '' : undefined)}
        {...rest}
      >
        {placeholder !== undefined ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options
          ? options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))
          : children}
      </select>
      <ChevronDown className="pr-select__chevron" size={16} aria-hidden />
    </span>
  );
});

/**
 * A native `<select>`, wired up the way `Input` is.
 *
 * Deliberately native. A listbox built out of divs has to re-implement typeahead,
 * virtual focus, scroll-into-view and every mobile picker by hand, and gets one of
 * them wrong; `<select>` has all of it and costs nothing. The trade is that the
 * open menu cannot be styled — only its colors carry, via `option`, which is why
 * the stylesheet states them explicitly — and that is a real limitation and the
 * reason apps reach for a Radix listbox instead — see the PR for that decision.
 *
 * The API mirrors `Input` exactly — `label`, `hint`, `error`, `fullWidth`,
 * `containerClassName`, a size prop and the same bare-rendering rule — so a form
 * built from both lays out and validates the same way rather than needing two
 * mental models.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    options,
    placeholder,
    label,
    hint,
    error,
    selectSize = 'md',
    fullWidth = false,
    containerClassName,
    className,
    children,
    disabled,
    required,
    id,
    value,
    defaultValue,
    ...rest
  },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const message = error ?? hint;

  const control = (
    <SelectControl
      ref={ref}
      id={selectId}
      options={options}
      placeholder={placeholder}
      selectSize={selectSize}
      className={className}
      disabled={disabled}
      required={required}
      value={value}
      defaultValue={defaultValue}
      {...rest}
    >
      {children}
    </SelectControl>
  );

  // Same rule as Input: with nothing to lay out, do not wrap. The wrappers exist for
  // the label and the message, and an app that has neither should not have to lay
  // out around two extra nodes.
  if (label === undefined && message === undefined) {
    return (
      <span
        className={[
          'pr-select',
          fullWidth ? 'pr-select--block' : null,
          disabled ? 'pr-select--disabled' : null,
          containerClassName,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {control}
      </span>
    );
  }

  return (
    <FormField
      label={label}
      hint={hint}
      error={error}
      required={required}
      disabled={disabled}
      fullWidth={fullWidth}
      controlId={selectId}
      className={[
        'pr-select',
        fullWidth ? 'pr-select--block' : null,
        disabled ? 'pr-select--disabled' : null,
        containerClassName,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {control}
    </FormField>
  );
});
