import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { FormField } from './FormField';

export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: ReactNode;
  /** Guidance shown under the field. Hidden while `error` is set. */
  hint?: ReactNode;
  /** Presence marks the field invalid; the text replaces `hint`. */
  error?: ReactNode;
  inputSize?: InputSize;
  leading?: ReactNode;
  trailing?: ReactNode;
  fullWidth?: boolean;
  containerClassName?: string;
}

type CompositeInputProps = Omit<
  InputProps,
  'label' | 'hint' | 'error' | 'fullWidth' | 'containerClassName'
>;

const CompositeInput = forwardRef<HTMLInputElement, CompositeInputProps>(function CompositeInput(
  { inputSize = 'md', leading, trailing, className, ...rest },
  ref,
) {
  return (
    <div className={`pr-field__control pr-field__control--${inputSize}`}>
      {leading ? <span className="pr-field__affix">{leading}</span> : null}
      <input
        ref={ref}
        className={['pr-field__input', className].filter(Boolean).join(' ')}
        {...rest}
      />
      {trailing ? <span className="pr-field__affix">{trailing}</span> : null}
    </div>
  );
});

/**
 * Text field with its label, hint and error wired up.
 *
 * The wiring is the point. Hand-rolled fields tend to render an error in a
 * `<span>` next to the input with nothing connecting them, so a screen reader
 * reads the field as valid and never announces why it was rejected. Here the
 * id is generated when not supplied, `aria-describedby` points at whichever of
 * hint/error is showing, and `aria-invalid` follows `error`.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    hint,
    error,
    inputSize = 'md',
    leading,
    trailing,
    fullWidth = false,
    className,
    containerClassName,
    id,
    disabled,
    required,
    ...rest
  },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const message = error ?? hint;

  /*
   * A field with nothing around it renders as one `<input>`, not as an input inside
   * two divs.
   *
   * The wrappers exist to lay out the label, the message and the affixes. When
   * there are none, wrappers become extra layout nodes: an `inline-flex`
   * container can swallow a parent's `flex-1`, while a full-width input only
   * fills the wrapper rather than the caller's layout.
   */
  const bare = label === undefined && message === undefined && !leading && !trailing;
  if (bare) {
    return (
      <input
        ref={ref}
        id={inputId}
        className={[
          'pr-input',
          `pr-input--${inputSize}`,
          fullWidth ? 'pr-input--block' : null,
          containerClassName,
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        disabled={disabled}
        required={required}
        {...rest}
      />
    );
  }

  const control = (
    <CompositeInput
      ref={ref}
      id={inputId}
      inputSize={inputSize}
      leading={leading}
      trailing={trailing}
      className={className}
      disabled={disabled}
      required={required}
      {...rest}
    />
  );

  if (label !== undefined || message !== undefined) {
    return (
      <FormField
        label={label}
        hint={hint}
        error={error}
        required={required}
        disabled={disabled}
        fullWidth={fullWidth}
        controlId={inputId}
        className={containerClassName}
      >
        {control}
      </FormField>
    );
  }

  return (
    <div
      className={[
        'pr-field',
        fullWidth ? 'pr-field--block' : null,
        disabled ? 'pr-field--disabled' : null,
        containerClassName,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {control}
    </div>
  );
});
