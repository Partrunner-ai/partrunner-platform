export { AppLauncher, type AppLauncherProps } from './AppLauncher';
export { BrandMark, type BrandMarkProps } from './BrandMark';
export {
  AppShell,
  SidebarTrigger,
  isNavItemActive,
  useSidebar,
  type AppShellInitialState,
  type AppShellProps,
  type LinkComponent,
  type NavIcon,
  type NavItem,
  type NavSection,
} from './AppShell';
export { GlobalHeader, type GlobalHeaderProps } from './GlobalHeader';
export { LocaleToggle, type LocaleToggleProps } from './LocaleToggle';
export {
  NotificationCenter,
  type NotificationCenterLabels,
  type NotificationCenterProps,
} from './NotificationCenter';
export {
  StaffShellProvider,
  useStaffShell,
  type StaffLocale,
  type StaffNotification,
  type StaffNotificationsState,
  type StaffShellContextValue,
  type StaffShellMutation,
  type StaffShellPreferences,
  type StaffShellProviderProps,
  type StaffShellUser,
  type StaffTheme,
} from './StaffShellContext';
export {
  STAFF_SHELL_SNAPSHOT_VERSION,
  isStaffShellSnapshot,
  parseStaffShellSnapshot,
  type StaffShellSnapshot,
  type StaffShellSnapshotNotification,
  type StaffShellSnapshotPreferences,
  type StaffShellSnapshotUser,
  type StaffShellSnapshotV1,
} from './StaffShellSnapshot';
export { ThemeToggle, type ThemeToggleProps } from './ThemeToggle';
export { UserMenu, type UserMenuItem, type UserMenuProps } from './UserMenu';

// Re-export the registry so consumers can import both from one place.
export {
  APPS,
  appHref,
  buildAppUrl,
  configureAppRegistry,
  findApp,
  type AppLink,
  type AppTone,
} from '@partrunner-ai/app-registry';
