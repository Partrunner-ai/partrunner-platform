import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { ChoiceControl } from './ChoiceControl';

export interface SwitchProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(props, ref) {
  return <ChoiceControl ref={ref} kind="switch" {...props} />;
});
