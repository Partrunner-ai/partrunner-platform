import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { isPresent, joinIds } from './form-utils';

export type ChoiceControlKind = 'checkbox' | 'radio' | 'switch';

export interface ChoiceControlProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  kind: ChoiceControlKind;
  label?: ReactNode;
  /** Guidance announced after the label. Hidden while `error` is present. */
  description?: ReactNode;
  /** Presence marks the control invalid and replaces `description`. */
  error?: ReactNode;
  /** Styles the full 40px interaction row, while `className` stays on the input. */
  containerClassName?: string;
  /** Checkbox-only mixed state. Does not change the submitted value. */
  indeterminate?: boolean;
  /** Internal group seam: native required remains, while the legend owns the visible mark. */
  showRequiredIndicator?: boolean;
}

export const ChoiceControl = forwardRef<HTMLInputElement, ChoiceControlProps>(
  function ChoiceControl(
    {
      kind,
      label,
      description,
      error,
      containerClassName,
      indeterminate = false,
      showRequiredIndicator = true,
      className,
      id,
      disabled,
      required,
      onChange,
      'aria-describedby': describedBy,
      'aria-labelledby': labelledBy,
      'aria-invalid': ariaInvalid,
      ...rest
    },
    forwardedRef,
  ) {
    const generatedId = useId();
    const controlId = id ?? generatedId;
    const labelId = `${controlId}-label`;
    const messageId = `${controlId}-message`;
    const hasLabel = isPresent(label);
    const hasError = isPresent(error);
    const message = hasError ? error : description;
    const hasMessage = isPresent(message);
    const localRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
      if (kind !== 'checkbox') return;
      if (localRef.current) localRef.current.indeterminate = indeterminate;
    }, [indeterminate, kind]);

    return (
      <label
        className={[
          'pr-choice',
          `pr-choice--${kind}`,
          hasError ? 'pr-choice--invalid' : null,
          disabled ? 'pr-choice--disabled' : null,
          containerClassName,
        ]
          .filter(Boolean)
          .join(' ')}
        htmlFor={controlId}
      >
        <input
          {...rest}
          ref={(node) => {
            localRef.current = node;
            if (typeof forwardedRef === 'function') forwardedRef(node);
            else if (forwardedRef) forwardedRef.current = node;
          }}
          id={controlId}
          type={kind === 'radio' ? 'radio' : 'checkbox'}
          role={kind === 'switch' ? 'switch' : undefined}
          className={['pr-choice__input', className].filter(Boolean).join(' ')}
          disabled={disabled}
          required={required}
          aria-labelledby={hasLabel ? joinIds(labelId, labelledBy) : labelledBy}
          aria-describedby={joinIds(describedBy, hasMessage ? messageId : undefined)}
          aria-invalid={hasError ? true : ariaInvalid}
          aria-checked={kind === 'checkbox' && indeterminate ? 'mixed' : undefined}
          onChange={(event) => {
            onChange?.(event);
            if (kind === 'checkbox' && indeterminate) event.currentTarget.indeterminate = true;
          }}
        />
        <span className="pr-choice__visual" aria-hidden="true">
          <span className="pr-choice__mark" />
        </span>
        {hasLabel || hasMessage ? (
          <span className="pr-choice__copy">
            {hasLabel ? (
              <span id={labelId} className="pr-choice__label">
                {label}
                {required && showRequiredIndicator ? (
                  <span className="pr-choice__required" aria-hidden="true">
                    *
                  </span>
                ) : null}
              </span>
            ) : null}
            {hasMessage ? (
              <span
                id={messageId}
                className={`pr-choice__message${hasError ? ' pr-choice__message--error' : ''}`}
                role={hasError ? 'alert' : undefined}
              >
                {message}
              </span>
            ) : null}
          </span>
        ) : null}
      </label>
    );
  },
);
