import { forwardRef, type HTMLAttributes, type ReactNode, type Ref } from 'react';
import { TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';
import { withIconDefaults } from './iconElement';

export type StatTone =
  | 'yellow'
  | 'amber'
  | 'blue'
  | 'purple'
  | 'green'
  | 'rose'
  | 'neutral';

export interface StatTileProps extends HTMLAttributes<HTMLDivElement> {
  /** Small uppercase label above the value. */
  label: ReactNode;
  /** The metric itself. Rendered display-tracked and large. */
  value: ReactNode;
  /** Muted line under the value. */
  hint?: ReactNode;
  /** Optional lucide icon in a tone-matched chip. */
  icon?: LucideIcon;
  /** Tone palette for the card wash and the icon chip. */
  tone?: StatTone;
  /**
   * Trend percentage, already rounded. `null`/`undefined` hides the chip.
   * Positive renders green with a leading `+`, negative renders rose.
   */
  trendValue?: number | null;
  /** Footer area for secondary metrics, right-aligned and truncated. */
  footer?: ReactNode;
}

/**
 * Compact stat tile — the standard KPI block for dashboards.
 *
 * Colours ride the shared `--pr-tone-*` pairs, so a toned tile, the chip
 * inside it and a Badge with the same tone all land on the same colour in
 * both themes. The tone wash is a mix of the tone into the current surface,
 * which keeps the tile on the semantic surface instead of a fixed white.
 *
 * The trend chip is the one deliberate exception: its 11px text needs AA,
 * and the light-theme tone foregrounds sit around 3.3:1. It keeps an opaque
 * emerald/rose pair in light theme and switches to the tone tokens under
 * `.dark`, where the surrounding card darkens with the theme.
 */
export const StatTile = forwardRef<HTMLDivElement, StatTileProps>(function StatTile(
  { icon: Icon, ...rest },
  ref,
) {
  return renderStatTile(
    { ...rest, icon: Icon ? <Icon aria-hidden strokeWidth={2.25} /> : null },
    ref,
  );
});

/**
 * `StatTile` props with the icon as an element. The server entry exports this
 * shape; the client `StatTile` converts its component to an element first.
 */
export interface StatTileMarkupProps extends Omit<StatTileProps, 'icon'> {
  /** An icon element, for example `<Truck />`. */
  icon?: ReactNode;
}

/**
 * The one copy of the tile markup. A plain function, not a component, so the
 * client `StatTile` (with a ref) and the server `StatTile` (without hooks or
 * refs) render the same elements and the same classes.
 *
 * @internal Not exported from the package entries.
 */
export function renderStatTile(
  { label, value, hint, icon, tone = 'neutral', trendValue, footer, className, ...rest }: StatTileMarkupProps,
  ref?: Ref<HTMLDivElement>,
) {
  const showTrend = typeof trendValue === 'number' && Number.isFinite(trendValue);
  const trendUp = showTrend && trendValue >= 0;
  const TrendIcon = trendUp ? TrendingUp : TrendingDown;
  const iconNode = withIconDefaults(icon, { 'aria-hidden': true, strokeWidth: 2.25 });

  return (
    <div
      ref={ref}
      {...rest}
      className={['pr-stat-tile', `pr-stat-tile--${tone}`, className].filter(Boolean).join(' ')}
    >
      <div className="pr-stat-tile__body">
        <div className="pr-stat-tile__main">
          <p className="pr-stat-tile__label">{label}</p>
          <p className="pr-stat-tile__value">{value}</p>
          {hint != null ? <p className="pr-stat-tile__hint">{hint}</p> : null}
        </div>
        {iconNode != null && iconNode !== false ? (
          <div className="pr-stat-tile__icon">{iconNode}</div>
        ) : null}
      </div>
      {showTrend || footer != null ? (
        <div className="pr-stat-tile__meta">
          {showTrend ? (
            <span
              className={[
                'pr-stat-tile__trend',
                trendUp ? 'pr-stat-tile__trend--up' : 'pr-stat-tile__trend--down',
              ].join(' ')}
            >
              <TrendIcon aria-hidden strokeWidth={2.5} />
              {trendUp ? '+' : ''}
              {trendValue}%
            </span>
          ) : (
            <span />
          )}
          {footer != null ? <div className="pr-stat-tile__footer">{footer}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
