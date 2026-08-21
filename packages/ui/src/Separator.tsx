import { forwardRef, type HTMLAttributes } from 'react';

export type SeparatorOrientation = 'horizontal' | 'vertical';

export interface SeparatorProps extends HTMLAttributes<HTMLDivElement> {
  orientation?: SeparatorOrientation;
  /**
   * Purely visual, and hidden from assistive technology. Default true.
   *
   * Most separators are decoration between regions that are already
   * distinguishable — a heading and a body, a toolbar and a table. Announcing each of
   * those as a structural separator is noise, so the accessible role is opt-in.
   */
  decorative?: boolean;
}

/**
 * A one-pixel rule on the semantic border token.
 *
 * `vertical` stretches to its flex parent rather than taking a fixed height, so
 * toolbar controls determine the divider's height.
 */
export const Separator = forwardRef<HTMLDivElement, SeparatorProps>(function Separator(
  { orientation = 'horizontal', decorative = true, className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      role={decorative ? 'none' : 'separator'}
      aria-orientation={decorative ? undefined : orientation}
      data-slot="separator"
      data-orientation={orientation}
      className={['pr-separator', `pr-separator--${orientation}`, className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    />
  );
});
