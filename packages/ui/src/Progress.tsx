import { forwardRef, useId, type HTMLAttributes } from 'react';

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export interface ProgressRingProps extends HTMLAttributes<HTMLDivElement> {
  /** 0–100. Values outside the range clamp rather than distort the ring. */
  value: number;
  /** Outer diameter in px. */
  size?: number;
  strokeWidth?: number;
  /** Announced to assistive tech. */
  label?: string;
  /** The percentage in the centre. On by default — a bare ring is decoration. */
  showValue?: boolean;
}

/**
 * Completion as a ring, stroked with the brand sweep (the same three stops as
 * `--pr-accent-gradient`). SVG gradients cannot consume a CSS background
 * image, so the stops reference the individual accent variables instead.
 */
export const ProgressRing = forwardRef<HTMLDivElement, ProgressRingProps>(function ProgressRing(
  { value, size = 64, strokeWidth = 6, label, showValue = true, className, style, ...rest },
  ref,
) {
  const clamped = clamp(value);
  const gradientId = useId();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <div
      ref={ref}
      role="img"
      aria-label={label ?? `${Math.round(clamped)}%`}
      className={['pr-progress-ring', className].filter(Boolean).join(' ')}
      /* Merged, not replaced: a consumer `style` must not collapse the ring's
         box (the centred label positions against it). */
      style={{ width: size, height: size, ...style }}
      {...rest}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--pr-accent-soft)" />
            <stop offset="50%" stopColor="var(--pr-accent)" />
            <stop offset="100%" stopColor="var(--pr-accent-strong)" />
          </linearGradient>
        </defs>
        <circle
          className="pr-progress-ring__track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
        />
        <circle
          className="pr-progress-ring__value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {showValue && <span className="pr-progress-ring__label">{Math.round(clamped)}%</span>}
    </div>
  );
});

export type ProgressBarSize = 'xs' | 'sm' | 'md';

export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  /** 0–100. */
  value: number;
  size?: ProgressBarSize;
  /** Announced to assistive tech. */
  label?: string;
  /**
   * Turns the fill `success` on completion. On by default because the bar's
   * whole job is answering "am I done" — an app tracking something with no
   * finish line turns it off.
   */
  completeTone?: boolean;
}

/** The quiet linear counterpart of `ProgressRing`, for table rows and cards. */
export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(function ProgressBar(
  { value, size = 'sm', label, completeTone = true, className, ...rest },
  ref,
) {
  const clamped = clamp(value);
  return (
    <div
      ref={ref}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      /* A progressbar owes assistive tech a name; the percentage is the honest
         fallback when the app names nothing. */
      aria-label={label ?? `${Math.round(clamped)}%`}
      className={[
        'pr-progress-bar',
        `pr-progress-bar--${size}`,
        completeTone && clamped >= 100 ? 'pr-progress-bar--complete' : null,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      <span className="pr-progress-bar__fill" style={{ width: `${clamped}%` }} />
    </div>
  );
});
