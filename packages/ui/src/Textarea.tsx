import {
  forwardRef,
  useId,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { FormField } from './FormField';
import type { InputSize } from './Input';

export type TextareaSize = InputSize;

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  textareaSize?: TextareaSize;
  fullWidth?: boolean;
  containerClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    label,
    hint,
    error,
    textareaSize = 'md',
    fullWidth = false,
    containerClassName,
    className,
    id,
    disabled,
    required,
    ...rest
  },
  ref,
) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const hasField = label !== undefined || hint !== undefined || error !== undefined;
  const control = (
    <textarea
      ref={ref}
      id={textareaId}
      className={[
        'pr-textarea',
        `pr-textarea--${textareaSize}`,
        fullWidth ? 'pr-textarea--block' : null,
        !hasField ? containerClassName : null,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled}
      required={required}
      {...rest}
    />
  );

  if (hasField) {
    return (
      <FormField
        label={label}
        hint={hint}
        error={error}
        required={required}
        disabled={disabled}
        fullWidth={fullWidth}
        controlId={textareaId}
        className={containerClassName}
      >
        {control}
      </FormField>
    );
  }

  return control;
});
