import { createContext, useContext } from 'react';
import type { LinkComponent } from './AppShell';
import type { WayBackTarget } from './wayBack';

export type ShellNavigationMode = 'launcher' | 'appbar' | 'switcher';

/** `'appbar'` and `'switcher'` share the brand, memory, palette, and event rules. */
export function isAppNavigation(mode: ShellNavigationMode | undefined): boolean {
  return mode === 'appbar' || mode === 'switcher';
}

/** One visible destination of the current app. */
export interface ShellNavigationPage {
  label: string;
  href: string;
  sectionLabel?: string;
  /** Absolute URL outside the app's router. */
  external?: boolean;
}

export interface ShellNavigateEvent {
  source: 'appbar' | 'switcher' | 'wayback' | 'goto' | 'brand' | 'menu';
  fromSub?: string;
  toSub?: string;
  href: string;
}

export interface ShellNavigationValue {
  mode: ShellNavigationMode;
  currentPath: string;
  appSub?: string;
  cookieDomain?: string;
  LinkComponent: LinkComponent;
  /** Flattened, permission-filtered destinations of this app. */
  pages: readonly ShellNavigationPage[];
  /** Label of the active leaf, when there is one. */
  activeLabel?: string;
  /** Path of the menu page that owns `activeLabel` (a detail page sits under it). */
  activePath?: string;
  /** The app this tab came from and the page left there, when known. */
  wayBack?: WayBackTarget | null;
  /** Extra paths that visit memory must not record. */
  navMemoryIgnore: readonly string[];
  /** Called before a shell link navigates; hosts forward it to usage tracking. */
  onNavigate?: (event: ShellNavigateEvent) => void;
}

export const ShellNavigationContext = createContext<ShellNavigationValue | null>(null);

/** Navigation state of the surrounding `<AppShell>`, or `null` outside one. */
export function useShellNavigation(): ShellNavigationValue | null {
  return useContext(ShellNavigationContext);
}

/** Calls `onNavigate` without ever letting a host callback break navigation. */
export function notifyNavigate(
  onNavigate: ShellNavigationValue['onNavigate'],
  event: ShellNavigateEvent,
): void {
  if (!onNavigate) return;
  try {
    onNavigate(event);
  } catch {
    /* usage tracking must never block a click */
  }
}
