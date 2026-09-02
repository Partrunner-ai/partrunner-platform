import { forwardRef, type HTMLAttributes } from 'react';
import type { BadgeTone } from './Badge';

export type StatusDotSize = 'sm' | 'md';

export interface StatusDotProps extends HTMLAttributes<HTMLSpanElement> {
  tone: BadgeTone;
  /** 8px or 10px. */
  size?: StatusDotSize;
  /**
   * Names the dot for assistive tech when it stands alone. Leave it out when the
   * dot sits beside visible text that already says the status — then it is
   * decorative and hidden, and colour is never the only carrier of meaning.
   */
  label?: string;
}

/**
 * A tone dot for a menu item, an option row or a legend — the same colour the
 * matching `Badge` paints, resolved in CSS from the tone tokens.
 */
export const StatusDot = forwardRef<HTMLSpanElement, StatusDotProps>(function StatusDot(
  { tone, size = 'sm', label, className, ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-slot="status-dot"
      className={['pr-status-dot', `pr-status-dot--${tone}`, `pr-status-dot--${size}`, className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    />
  );
});
