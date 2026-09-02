import { forwardRef, type HTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { BadgeTone } from './Badge';

export type IconTileSize = 'sm' | 'md' | 'lg';

export interface IconTileProps extends HTMLAttributes<HTMLSpanElement> {
  icon: LucideIcon;
  /** Tinted or semantic tone; `neutral` by default. Colours resolve in CSS as for `Badge`. */
  tone?: BadgeTone;
  /** 28, 36 or 44px square. */
  size?: IconTileSize;
}

const ICON_PX: Record<IconTileSize, number> = { sm: 14, md: 18, lg: 22 };

/**
 * An icon in a tinted chip: the visual anchor of a list row, a card header or an
 * empty state. Decorative — the text beside it carries the meaning.
 */
export const IconTile = forwardRef<HTMLSpanElement, IconTileProps>(function IconTile(
  { icon: Icon, tone = 'neutral', size = 'md', className, ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      aria-hidden
      data-slot="icon-tile"
      className={['pr-icon-tile', `pr-icon-tile--${tone}`, `pr-icon-tile--${size}`, className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      <Icon size={ICON_PX[size]} strokeWidth={2} aria-hidden />
    </span>
  );
});
