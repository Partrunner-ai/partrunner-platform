import {
  useId,
  type FieldsetHTMLAttributes,
  type ReactNode,
} from 'react';
import { ChoiceControl } from './ChoiceControl';
import { isPresent, joinIds } from './form-utils';

export interface ChoiceOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

export type ChoiceGroupOrientation = 'vertical' | 'horizontal';

interface ChoiceGroupBaseProps
  extends Omit<FieldsetHTMLAttributes<HTMLFieldSetElement>, 'onChange' | 'onSelect'> {
  name: string;
  label: ReactNode;
  options: readonly ChoiceOption[];
  hint?: ReactNode;
  error?: ReactNode;
  orientation?: ChoiceGroupOrientation;
  required?: boolean;
}

export interface CheckboxGroupProps extends ChoiceGroupBaseProps {
  value: readonly string[];
  onValueChange: (value: string[]) => void;
}

export interface RadioGroupProps extends ChoiceGroupBaseProps {
  value: string | null;
  onValueChange: (value: string) => void;
}

interface ChoiceGroupShellProps extends ChoiceGroupBaseProps {
  kind: 'checkbox' | 'radio';
  selectedValues: readonly string[];
  onSelect: (value: string, checked: boolean) => void;
}

function ChoiceGroupShell({
  kind,
  name,
  label,
  options,
  selectedValues,
  onSelect,
  hint,
  error,
  orientation = 'vertical',
  required = false,
  disabled = false,
  className,
  id,
  'aria-describedby': describedBy,
  'aria-invalid': ariaInvalid,
  ...rest
}: ChoiceGroupShellProps) {
  const generatedId = useId();
  const groupId = id ?? generatedId;
  const legendId = `${groupId}-legend`;
  const messageId = `${groupId}-message`;
  const hasError = isPresent(error);
  const message = hasError ? error : hint;
  const hasMessage = isPresent(message);

  return (
    <fieldset
      {...rest}
      id={groupId}
      className={[
        'pr-choice-group',
        hasError ? 'pr-choice-group--invalid' : null,
        disabled ? 'pr-choice-group--disabled' : null,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled}
      role={kind === 'radio' ? 'radiogroup' : undefined}
      aria-labelledby={legendId}
      aria-describedby={joinIds(describedBy, hasMessage ? messageId : undefined)}
      aria-invalid={hasError ? true : ariaInvalid}
      aria-required={required || undefined}
    >
      <legend id={legendId} className="pr-choice-group__legend">
        {label}
        {required ? (
          <span className="pr-choice-group__required" aria-hidden="true">
            *
          </span>
        ) : null}
      </legend>
      {hasMessage ? (
        <p
          id={messageId}
          className={`pr-choice-group__message${hasError ? ' pr-choice-group__message--error' : ''}`}
          role={hasError ? 'alert' : undefined}
        >
          {message}
        </p>
      ) : null}
      <div className={`pr-choice-group__options pr-choice-group__options--${orientation}`}>
        {options.map((option, index) => {
          const checked = selectedValues.includes(option.value);
          return (
            <ChoiceControl
              key={option.value}
              id={`${groupId}-option-${index}`}
              kind={kind}
              name={name}
              value={option.value}
              label={option.label}
              description={option.description}
              checked={checked}
              disabled={disabled || option.disabled}
              required={kind === 'radio' ? required : false}
              showRequiredIndicator={false}
              aria-invalid={hasError || undefined}
              onChange={(event) => onSelect(option.value, event.currentTarget.checked)}
            />
          );
        })}
      </div>
    </fieldset>
  );
}

export function CheckboxGroup({ value, onValueChange, ...props }: CheckboxGroupProps) {
  return (
    <ChoiceGroupShell
      {...props}
      kind="checkbox"
      selectedValues={value}
      onSelect={(nextValue, checked) => {
        onValueChange(
          checked ? [...new Set([...value, nextValue])] : value.filter((item) => item !== nextValue),
        );
      }}
    />
  );
}

export function RadioGroup({ value, onValueChange, ...props }: RadioGroupProps) {
  return (
    <ChoiceGroupShell
      {...props}
      kind="radio"
      selectedValues={value === null ? [] : [value]}
      onSelect={(nextValue, checked) => {
        if (checked) onValueChange(nextValue);
      }}
    />
  );
}
