import type { ReactNode } from 'react';
import { UserRound } from 'lucide-react';
import type { AppLink } from '@partrunner-ai/app-registry';
import { AppLauncher } from './AppLauncher';
import {
  NotificationCenter,
  type NotificationCenterLabels,
} from './NotificationCenter';
import { type StaffLocale, useStaffShell } from './StaffShellContext';
import { UserMenu, type UserMenuItem } from './UserMenu';

interface GlobalHeaderMessages {
  landmark: string;
  launcher: string;
  profile: string;
  signOut: string;
  userMenu: string;
  notifications: NotificationCenterLabels;
}

const MESSAGES: Record<StaffLocale, GlobalHeaderMessages> = {
  es: {
    landmark: 'Barra global',
    launcher: 'Aplicaciones',
    profile: 'Perfil y preferencias',
    signOut: 'Cerrar sesión',
    userMenu: 'Menú de usuario',
    notifications: {
      trigger: 'Notificaciones',
      title: 'Notificaciones',
      markAllRead: 'Marcar todas como leídas',
      empty: 'No tienes notificaciones nuevas.',
      loading: 'Cargando notificaciones…',
      viewAll: 'Ver todas en Nexus',
    },
  },
  en: {
    landmark: 'Global bar',
    launcher: 'Applications',
    profile: 'Profile and preferences',
    signOut: 'Sign out',
    userMenu: 'User menu',
    notifications: {
      trigger: 'Notifications',
      title: 'Notifications',
      markAllRead: 'Mark all as read',
      empty: 'You have no new notifications.',
      loading: 'Loading notifications…',
      viewAll: 'View all in Nexus',
    },
  },
};

export interface GlobalHeaderProps {
  /** Breadcrumbs, page title, search, and other host-owned page context. */
  start?: ReactNode;
  /** Subdomain of the current app, highlighted in the launcher. */
  currentSub?: string;
  /** Optional registry override for staged or audience-filtered launchers. */
  apps?: AppLink[];
  /** Host-specific user actions, rendered after the canonical profile link. */
  userMenuItems?: UserMenuItem[];
  className?: string;
}

/**
 * Fixed staff control order:
 * page context → notifications → launcher → avatar.
 *
 * Durable theme and locale preferences belong on the canonical profile page.
 */
export function GlobalHeader({
  start,
  currentSub,
  apps,
  userMenuItems = [],
  className,
}: GlobalHeaderProps) {
  const shell = useStaffShell();
  const { locale } = shell.preferences;
  const messages = MESSAGES[locale];
  const profileItem: UserMenuItem = {
    label: messages.profile,
    href: shell.profileHref,
    icon: <UserRound size={16} aria-hidden />,
  };

  return (
    <header
      className={`pr-global-header${className ? ` ${className}` : ''}`}
      aria-label={messages.landmark}
    >
      <div className="pr-global-header__start">{start}</div>
      <div className="pr-global-header__spacer" />
      <div className="pr-global-header__controls">
        <NotificationCenter
          items={shell.notifications.items}
          unreadCount={shell.notifications.unreadCount}
          href={shell.notifications.href}
          locale={locale}
          loading={shell.notifications.loading}
          onNotificationRead={shell.markNotificationRead}
          onMarkAllRead={shell.markAllNotificationsRead}
          labels={messages.notifications}
        />
        <AppLauncher
          apps={apps}
          currentSub={currentSub}
          label={messages.launcher}
          triggerLabel={messages.launcher}
        />
        <span className="pr-global-header__divider" aria-hidden />
        <UserMenu
          name={shell.user.name}
          email={shell.user.email}
          avatarUrl={shell.user.avatarUrl}
          compact
          triggerLabel={messages.userMenu}
          items={[profileItem, ...userMenuItems]}
          onSignOut={shell.signOut}
          signOutLabel={messages.signOut}
        />
      </div>
    </header>
  );
}
