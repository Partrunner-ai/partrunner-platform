import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';

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
export const StatTile = forwardRef<HTMLDivElement, StatTileProps>(
  function StatTile(
    { label, value, hint, icon: Icon, tone = 'neutral', trendValue, footer, className, ...rest },
    ref,
  ) {
    const showTrend = typeof trendValue === 'number' && Number.isFinite(trendValue);
    const trendUp = showTrend && trendValue >= 0;
    const TrendIcon = trendUp ? TrendingUp : TrendingDown;

    return (
      <div
        ref={ref}
        {...rest}
        className={[
          'pr-stat-tile',
          `pr-stat-tile--${tone}`,
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="pr-stat-tile__body">
          <div className="pr-stat-tile__main">
            <p className="pr-stat-tile__label">{label}</p>
            <p className="pr-stat-tile__value">{value}</p>
            {hint != null ? <p className="pr-stat-tile__hint">{hint}</p> : null}
          </div>
          {Icon ? (
            <div className="pr-stat-tile__icon">
              <Icon aria-hidden strokeWidth={2.25} />
            </div>
          ) : null}
        </div>
        {showTrend || footer != null ? (
          <div className="pr-stat-tile__meta">
            {showTrend ? (
              <span
                className={[
                  'pr-stat-tile__trend',
                  trendUp
                    ? 'pr-stat-tile__trend--up'
                    : 'pr-stat-tile__trend--down',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <TrendIcon aria-hidden strokeWidth={2.5} />
                {trendUp ? '+' : ''}
                {trendValue}%
              </span>
            ) : (
              <span />
            )}
            {footer != null ? (
              <div className="pr-stat-tile__footer">{footer}</div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  },
);
