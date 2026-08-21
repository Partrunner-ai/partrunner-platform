import {
  forwardRef,
  isValidElement,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
import { Loader2, type LucideIcon } from 'lucide-react';
import { Slot } from './Slot';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'glass'
  | 'danger'
  | 'success'
  | 'link';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon';

/**
 * Either a lucide component, which we size for you, or an already-rendered node.
 *
 * Both forms are useful: pass a component for package-owned sizing or a
 * rendered element when the caller owns its exact treatment.
 */
export type ButtonIcon = LucideIcon | ReactElement;

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Swaps the leading icon for a spinner and blocks interaction. */
  loading?: boolean;
  icon?: ButtonIcon;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  /** Disables the tactile press scale when motion would be distracting. */
  static?: boolean;
  /**
   * Render the child instead of a `<button>`, keeping the styling. This is how
   * an app plugs in its own router link — the package cannot know whether that
   * is next/link, react-router or a plain anchor.
   */
  asChild?: boolean;
  children?: ReactNode;
}

/**
 * The shared button.
 *
 * Styling lives in `styles/ui.css` as plain CSS over the `--pr-*` scale, not as
 * Tailwind classes. Consumers span Tailwind v3 and v4, and shipping utility
 * classes would force every host to scan node_modules
 * and to agree on a Tailwind major. CSS over custom properties works in both,
 * and in an app with no Tailwind at all.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    icon: Icon,
    iconPosition = 'left',
    fullWidth = false,
    static: isStatic = false,
    asChild = false,
    disabled,
    className,
    children,
    ...rest
  },
  ref,
) {
  const classes = [
    'pr-btn',
    `pr-btn--${variant}`,
    `pr-btn--${size}`,
    fullWidth ? 'pr-btn--block' : null,
    isStatic ? 'pr-btn--static' : null,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const iconSize = size === 'xs' ? 14 : 16;
  // An already-rendered element is used as given — it carries the caller's own
  // sizing. A component gets sized to match the button.
  const renderedIcon = !Icon
    ? null
    : isValidElement(Icon)
      ? Icon
      : (() => {
          const IconComponent = Icon as LucideIcon;
          return <IconComponent size={iconSize} aria-hidden />;
        })();

  const leading = loading ? (
    <Loader2 className="pr-btn__spinner" size={iconSize} aria-hidden />
  ) : iconPosition === 'left' ? (
    renderedIcon
  ) : null;
  const trailing = !loading && iconPosition === 'right' ? renderedIcon : null;

  if (asChild) {
    // `disabled` is not a valid attribute on an anchor, so it is expressed for
    // assistive tech instead and the pointer is blocked in CSS. `decorate` puts
    // the icon INSIDE the slotted element rather than beside it.
    return (
      <Slot
        ref={ref as Ref<unknown>}
        className={classes}
        {...rest}
        data-loading={loading ? 'true' : undefined}
        aria-busy={loading ? true : undefined}
        aria-disabled={disabled || loading ? true : undefined}
        decorate={(childChildren: ReactNode) => (
          <>
            {leading}
            {childChildren}
            {trailing}
          </>
        )}
      >
        {children}
      </Slot>
    );
  }

  const content = (
    <>
      {leading}
      {children}
      {trailing}
    </>
  );

  return (
    <button
      {...rest}
      ref={ref}
      className={classes}
      disabled={disabled || loading}
      data-loading={loading ? 'true' : undefined}
      aria-busy={loading ? true : undefined}
    >
      {content}
    </button>
  );
});
