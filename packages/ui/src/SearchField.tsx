import { forwardRef } from 'react';
import { Search } from 'lucide-react';
import { Input, type InputProps } from './Input';

export interface SearchFieldProps extends Omit<InputProps, 'type' | 'leading'> {
  /** Fill the container at every width instead of the 16rem toolbar width from 640px up. */
  fullWidth?: boolean;
}

/**
 * The search input of a toolbar, with the magnifier baked in. The ref is the
 * native input. The layout box is the field wrapper: the package width class
 * goes on `containerClassName` and the caller's `className` still targets the
 * input, exactly as in `Input`.
 */
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { inputSize = 'sm', fullWidth = false, containerClassName, ...rest },
  ref,
) {
  return (
    <Input
      ref={ref}
      type="search"
      inputSize={inputSize}
      leading={<Search size={14} aria-hidden />}
      fullWidth={fullWidth}
      containerClassName={[
        'pr-search-field',
        fullWidth ? 'pr-search-field--block' : null,
        containerClassName,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    />
  );
});
