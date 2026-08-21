import { forwardRef, type CSSProperties, type HTMLAttributes } from 'react';

export type SkeletonShape = 'block' | 'text' | 'circle';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * `text` carries a line height and a slightly tighter radius; `circle` is for an
   * avatar placeholder. `block` is the default rectangle.
   */
  shape?: SkeletonShape;
  /** Convenience for the common `style={{ width }}`; accepts any CSS length. */
  width?: number | string;
  height?: number | string;
  /** Repeats the placeholder, with the last line shortened when `shape` is `text`. */
  lines?: number;
}

/**
 * A loading placeholder.
 *
 * It pulses opacity rather than sliding a gradient across itself. A moving highlight
 * has to know which way the surface is lit, so it needs one value in light mode and a
 * different one in dark; opacity over the semantic surface needs neither and cannot
 * drift from the theme.
 *
 * Every instance is `aria-hidden` and the group is a live region marked busy, so a
 * screen reader announces "loading" once instead of reading out a dozen empty boxes.
 */
export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(function Skeleton(
  { shape = 'block', width, height, lines = 1, className, style, ...rest },
  ref,
) {
  const sizing: CSSProperties = {
    ...(width === undefined ? null : { width }),
    ...(height === undefined ? null : { height }),
    ...style,
  };
  const classes = ['pr-skeleton', `pr-skeleton--${shape}`, className].filter(Boolean).join(' ');

  if (lines <= 1) {
    return (
      <div ref={ref} aria-hidden data-slot="skeleton" className={classes} style={sizing} {...rest} />
    );
  }

  return (
    <div
      ref={ref}
      role="status"
      aria-busy="true"
      data-slot="skeleton-group"
      className="pr-skeleton__group"
      {...rest}
    >
      {Array.from({ length: lines }, (_, index) => (
        <div
          key={index}
          aria-hidden
          data-slot="skeleton"
          className={classes}
          /* The last line of a paragraph placeholder stops short, which is what makes
             it read as text rather than as a stack of identical bars. */
          data-last={shape === 'text' && index === lines - 1 ? '' : undefined}
          style={sizing}
        />
      ))}
    </div>
  );
});
