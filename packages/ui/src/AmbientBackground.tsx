import { forwardRef, type HTMLAttributes } from 'react';

export type AmbientBackgroundVariant = 'page' | 'login';

export interface AmbientBackgroundProps extends HTMLAttributes<HTMLDivElement> {
  /** `login` runs the glows larger and warmer for hero/auth screens. */
  variant?: AmbientBackgroundVariant;
}

/**
 * The Crystal ambient glow — a warm accent bloom top-right and a cool one
 * bottom-left, fixed behind the page. Three apps had inlined this with
 * identical values, which is exactly the argument for owning it here.
 *
 * Purely decorative: hidden from assistive tech, `pointer-events: none`,
 * layered behind in-flow content (`z-index: -1`), and explicitly dimmed under
 * `.dark` — the accent is a fixed brand token, so without the override the
 * glows would come out brighter over a dark page.
 */
export const AmbientBackground = forwardRef<HTMLDivElement, AmbientBackgroundProps>(
  function AmbientBackground({ variant = 'page', className, ...rest }, ref) {
    return (
      <div
        ref={ref}
        aria-hidden
        className={[
          'pr-ambient',
          variant === 'login' ? 'pr-ambient--login' : null,
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      >
        <span className="pr-ambient__glow pr-ambient__glow--warm" />
        <span className="pr-ambient__glow pr-ambient__glow--cool" />
      </div>
    );
  },
);
