import { useCallback, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, LogOut } from 'lucide-react';
import { useDismiss } from './useDismiss';

export interface UserMenuItem {
  label: string;
  icon?: ReactNode;
  /** Navigate to href, or run onClick — provide one. */
  href?: string;
  onClick?: () => void;
  danger?: boolean;
}

export interface UserMenuProps {
  name: string;
  email?: string;
  /** Avatar image; falls back to initials from `name`. */
  avatarUrl?: string;
  /** Render an avatar-only trigger while keeping identity in the popover. */
  compact?: boolean;
  /** Accessible trigger label. Required for compact product headers. */
  triggerLabel?: string;
  /** Extra items above the sign-out action. */
  items?: UserMenuItem[];
  /** Sign-out handler. Omit to hide the sign-out action. */
  onSignOut?: () => void;
  signOutLabel?: string;
  className?: string;
}

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/** Avatar + name trigger with a dismissible menu. Data comes from the host app. */
export function UserMenu({
  name,
  email,
  avatarUrl,
  compact = false,
  triggerLabel,
  items = [],
  onSignOut,
  signOutLabel = 'Cerrar sesión',
  className,
}: UserMenuProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const resolvedAvatarUrl = avatarUrl?.trim() || null;
  const showAvatarImage =
    resolvedAvatarUrl !== null && resolvedAvatarUrl !== failedAvatarUrl;
  const close = useCallback(() => setOpen(false), []);
  useDismiss(wrapperRef, open, close);

  const renderItem = (item: UserMenuItem, key: string) => {
    const content = (
      <>
        {item.icon}
        <span>{item.label}</span>
      </>
    );
    const common = {
      className: 'pr-usermenu__item',
      role: 'menuitem' as const,
      'data-danger': item.danger ? 'true' : undefined,
    };
    if (item.href) {
      return (
        <a key={key} href={item.href} {...common} onClick={close}>
          {content}
        </a>
      );
    }
    return (
      <button
        key={key}
        type="button"
        {...common}
        onClick={() => {
          item.onClick?.();
          close();
        }}
      >
        {content}
      </button>
    );
  };

  return (
    <div
      ref={wrapperRef}
      className={`pr-usermenu${className ? ` ${className}` : ''}`}
      data-compact={compact ? 'true' : undefined}
    >
      <button
        type="button"
        className="pr-usermenu__trigger"
        aria-label={triggerLabel}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {showAvatarImage ? (
          <img
            className="pr-usermenu__avatar"
            src={resolvedAvatarUrl ?? undefined}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setFailedAvatarUrl(resolvedAvatarUrl)}
          />
        ) : (
          <span className="pr-usermenu__avatar" aria-hidden>
            {initialsOf(name)}
          </span>
        )}
        {!compact && (
          <>
            <span className="pr-usermenu__name">{name}</span>
            <ChevronDown size={16} aria-hidden />
          </>
        )}
      </button>

      {open && (
        <div className="pr-usermenu__popover" role="menu">
          {(email || name) && (
            <div className="pr-usermenu__header">
              <div className="pr-usermenu__name">{name}</div>
              {email && <div className="pr-usermenu__email">{email}</div>}
            </div>
          )}
          {items.map((item, i) => renderItem(item, `item-${i}`))}
          {onSignOut && (
            <button
              type="button"
              className="pr-usermenu__item"
              data-danger="true"
              role="menuitem"
              onClick={() => {
                onSignOut();
                close();
              }}
            >
              <LogOut size={16} aria-hidden />
              <span>{signOutLabel}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
