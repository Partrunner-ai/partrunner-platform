import { forwardRef, type HTMLAttributes } from 'react';

export type ToolbarProps = HTMLAttributes<HTMLDivElement>;

/**
 * Sticky-friendly filter/toolbar surface: a translucent glass bar with a
 * soft border that separates from the page background without weight.
 * Wrap inputs, selects, and buttons in it; it wraps them onto multiple
 * rows when narrow.
 */
export const Toolbar = forwardRef<HTMLDivElement, ToolbarProps>(function Toolbar(
  { className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      {...rest}
      className={['pr-toolbar', className].filter(Boolean).join(' ')}
    />
  );
});
