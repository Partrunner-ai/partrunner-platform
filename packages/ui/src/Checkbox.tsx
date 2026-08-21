import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { ChoiceControl } from './ChoiceControl';

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
  indeterminate?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(props, ref) {
  return <ChoiceControl ref={ref} kind="checkbox" {...props} />;
});
