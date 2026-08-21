import {
  Children,
  cloneElement,
  forwardRef,
  useId,
  type AriaAttributes,
  type HTMLAttributes,
  type LabelHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import { isPresent, joinIds } from './form-utils';

type FormFieldControlProps = {
  id?: string;
  disabled?: boolean;
  required?: boolean;
  'aria-describedby'?: string;
  'aria-labelledby'?: string;
  'aria-invalid'?: AriaAttributes['aria-invalid'];
  'aria-required'?: AriaAttributes['aria-required'];
};

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** Adds the canonical decorative required mark. The control still owns `required`. */
  required?: boolean;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(function Label(
  { required = false, className, children, ...rest },
  ref,
) {
  return (
    <label
      ref={ref}
      className={['pr-label', className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
      {required ? (
        <span className="pr-label__required" aria-hidden="true">
          *
        </span>
      ) : null}
    </label>
  );
});

export interface FormFieldProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** The single control whose accessible state FormField owns. */
  children: ReactElement<FormFieldControlProps>;
  label?: ReactNode;
  /** Guidance shown under the control. Hidden while `error` is present. */
  hint?: ReactNode;
  /** Presence marks the control invalid and replaces `hint`. */
  error?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Used when the child does not already carry an id. */
  controlId?: string;
}

export function FormField({
  children,
  label,
  hint,
  error,
  required = false,
  disabled = false,
  fullWidth = false,
  controlId,
  className,
  ...rest
}: FormFieldProps) {
  const generatedId = useId();
  const child = Children.only(children);
  const resolvedControlId = child.props.id ?? controlId ?? generatedId;
  const resolvedDisabled = disabled || child.props.disabled || false;
  const resolvedRequired = required || child.props.required || false;
  const labelId = `${resolvedControlId}-label`;
  const messageId = `${resolvedControlId}-message`;
  const hasLabel = isPresent(label);
  const hasError = isPresent(error);
  const message = hasError ? error : hint;
  const hasMessage = isPresent(message);

  const control = cloneElement(child, {
    id: resolvedControlId,
    disabled: resolvedDisabled || undefined,
    required: resolvedRequired || undefined,
    'aria-labelledby': hasLabel
      ? joinIds(labelId, child.props['aria-labelledby'])
      : child.props['aria-labelledby'],
    'aria-describedby': joinIds(
      child.props['aria-describedby'],
      hasMessage ? messageId : undefined,
    ),
    'aria-invalid': hasError ? true : child.props['aria-invalid'],
    'aria-required': resolvedRequired ? true : child.props['aria-required'],
  });

  return (
    <div
      className={[
        'pr-field',
        fullWidth ? 'pr-field--block' : null,
        hasError ? 'pr-field--invalid' : null,
        resolvedDisabled ? 'pr-field--disabled' : null,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {hasLabel ? (
        <Label
          id={labelId}
          className="pr-field__label"
          htmlFor={resolvedControlId}
          required={resolvedRequired}
        >
          {label}
        </Label>
      ) : null}
      {control}
      {hasMessage ? (
        <p
          id={messageId}
          className={`pr-field__message${hasError ? ' pr-field__message--error' : ''}`}
          role={hasError ? 'alert' : undefined}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
