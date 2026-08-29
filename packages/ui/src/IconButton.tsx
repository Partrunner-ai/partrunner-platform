import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';

export type IconButtonSize = 'sm' | 'md' | 'lg';
export type IconButtonVariant = 'default' | 'primary' | 'danger' | 'ghost' | 'subtle';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Accessible name. Also becomes the tooltip title unless one is passed. */
  label: string;
  /** The icon itself, or any small node rendered inside the button. */
  icon: ReactNode;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
  /**
   * Keeps a visually compact hit area on desktop-only contexts. The touch
   * target stays at or above 44x44 on coarse pointers via padding.
   */
  compact?: boolean;
}

/**
 * Accessible icon-only button.
 *
 * Guarantees a WCAG-compliant touch target (at least 44x44 on small screens
 * for every size, and on all screens unless `compact` is set), wires
 * `aria-label`/`title` from `label`, and defaults `type="button"` so a
 * stray icon button cannot submit a form.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      label,
      icon,
      size = 'md',
      variant = 'default',
      compact = false,
      className,
      title,
      type = 'button',
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        {...rest}
        type={type}
        aria-label={label}
        title={title ?? label}
        className={[
          'pr-icon-btn',
          `pr-icon-btn--${size}`,
          `pr-icon-btn--${variant}`,
          compact ? 'pr-icon-btn--compact' : null,
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {icon}
      </button>
    );
  },
);
