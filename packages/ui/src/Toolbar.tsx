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

export type ToolbarGroupProps = HTMLAttributes<HTMLDivElement>;

/** Controls that belong together inside a `Toolbar`; wraps as one unit. */
export const ToolbarGroup = forwardRef<HTMLDivElement, ToolbarGroupProps>(function ToolbarGroup(
  { className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      {...rest}
      data-slot="toolbar-group"
      className={['pr-toolbar__group', className].filter(Boolean).join(' ')}
    />
  );
});

export type ToolbarSpacerProps = HTMLAttributes<HTMLDivElement>;

/**
 * Pushes what follows to the end of the bar from 640px up; hidden below, where
 * the bar wraps and the gap would only add a blank line.
 */
export const ToolbarSpacer = forwardRef<HTMLDivElement, ToolbarSpacerProps>(
  function ToolbarSpacer({ className, ...rest }, ref) {
    return (
      <div
        ref={ref}
        aria-hidden
        {...rest}
        data-slot="toolbar-spacer"
        className={['pr-toolbar__spacer', className].filter(Boolean).join(' ')}
      />
    );
  },
);
