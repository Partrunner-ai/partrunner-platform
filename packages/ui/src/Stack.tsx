import { forwardRef, type HTMLAttributes } from 'react';
import { Slot } from './Slot';

export type StackDirection = 'column' | 'row';
export type StackGap = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type StackAlign = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
export type StackJustify = 'start' | 'center' | 'end' | 'between';

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  /** Main axis. Defaults to `column`. */
  direction?: StackDirection;
  /** Space between children: `xs` 4px, `sm` 8px, `md` 12px, `lg` 16px, `xl` 24px. Defaults to `lg`. */
  gap?: StackGap;
  /** Cross-axis alignment. Unset keeps the browser default (`stretch`). */
  align?: StackAlign;
  /** Main-axis distribution. Unset keeps `start`. */
  justify?: StackJustify;
  /** Lets children flow onto the next line when the row is full. */
  wrap?: boolean;
  /** Render the child instead of a `<div>`, keeping the styling. Same contract as `Card`. */
  asChild?: boolean;
}

/**
 * The spacing primitive: a flex container whose gap comes from a fixed scale, so
 * screens stop inventing their own. Layout only: no colour, no type.
 */
export const Stack = forwardRef<HTMLDivElement, StackProps>(function Stack(
  {
    direction = 'column',
    gap = 'lg',
    align,
    justify,
    wrap = false,
    asChild = false,
    className,
    ...rest
  },
  ref,
) {
  const classes = [
    'pr-stack',
    direction === 'row' ? 'pr-stack--row' : null,
    `pr-stack--gap-${gap}`,
    align ? `pr-stack--align-${align}` : null,
    justify ? `pr-stack--justify-${justify}` : null,
    wrap ? 'pr-stack--wrap' : null,
    className,
  ]
    .filter(Boolean)
    .join(' ');
  const Comp = asChild ? Slot : 'div';
  return <Comp ref={ref} data-slot="stack" className={classes} {...rest} />;
});
