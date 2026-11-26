import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { IconButton } from './IconButton';

export type NoticeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export type NoticeSize = 'md' | 'sm';

export interface NoticeProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Colour and meaning. Defaults to `info`. */
  tone?: NoticeTone;
  /** Short bold line above the body. */
  title?: ReactNode;
  /** Body text. */
  children?: ReactNode;
  /** Replaces the icon of the tone. `false` hides the icon. */
  icon?: ReactNode | false;
  /** Controls aligned to the end edge; they wrap under the text on narrow widths. */
  actions?: ReactNode;
  /** When given, a close button shows. The app owns what "dismissed" means. */
  onDismiss?: () => void;
  /** Accessible name of the close button. */
  dismissLabel?: string;
  size?: NoticeSize;
}

const TONE_ICON: Record<NoticeTone, typeof Info> = {
  neutral: Info,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};

/**
 * A calm inline message inside a page or card. It is not a toast: it stays in
 * the flow and does not move. The role is `alert` for `danger` and `status`
 * for every other tone; a `role` passed by the caller wins.
 */
export const Notice = forwardRef<HTMLDivElement, NoticeProps>(function Notice(
  {
    tone = 'info',
    title,
    children,
    icon,
    actions,
    onDismiss,
    dismissLabel = 'Cerrar aviso',
    size = 'md',
    role,
    className,
    ...rest
  },
  ref,
) {
  const ToneIcon = TONE_ICON[tone];
  const iconNode = icon === false ? null : (icon ?? <ToneIcon size={size === 'sm' ? 16 : 18} aria-hidden />);
  return (
    <div
      ref={ref}
      {...rest}
      role={role ?? (tone === 'danger' ? 'alert' : 'status')}
      data-slot="notice"
      className={['pr-notice', `pr-notice--${tone}`, `pr-notice--${size}`, className]
        .filter(Boolean)
        .join(' ')}
    >
      {iconNode != null ? <span className="pr-notice__icon">{iconNode}</span> : null}
      <div className="pr-notice__body">
        {title != null && title !== false ? <p className="pr-notice__title">{title}</p> : null}
        {children != null && children !== false ? (
          <div className="pr-notice__text">{children}</div>
        ) : null}
      </div>
      {actions != null ? <div className="pr-notice__actions">{actions}</div> : null}
      {onDismiss ? (
        <IconButton
          className="pr-notice__dismiss"
          label={dismissLabel}
          icon={<X size={16} aria-hidden />}
          variant="ghost"
          size="sm"
          compact
          onClick={onDismiss}
        />
      ) : null}
    </div>
  );
});
