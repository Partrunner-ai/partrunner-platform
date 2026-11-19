import { createContext, useContext } from 'react';
import type { LinkComponent } from './AppShell';
import type { WayBackTarget } from './wayBack';

export type ShellNavigationMode = 'launcher' | 'unified';

/** One visible destination of the current app. */
export interface ShellNavigationPage {
  label: string;
  href: string;
  sectionLabel?: string;
  /** Absolute URL outside the app's router. */
  external?: boolean;
}

export interface ShellNavigateEvent {
  source: 'launcher' | 'favorites' | 'goto' | 'wayback' | 'brand' | 'menu';
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

/**
 * True inside the `start` slot of a `'unified'` header, which renders its own
 * menu button: a host's `<SidebarTrigger />` there renders nothing.
 */
export const HeaderOwnsSidebarTriggerContext = createContext(false);

/**
 * Calls `onNavigate` without ever letting a host callback break navigation. A
 * callback that returns a rejected promise is ignored too.
 */
export function notifyNavigate(
  onNavigate: ShellNavigationValue['onNavigate'],
  event: ShellNavigateEvent,
): void {
  if (!onNavigate) return;
  try {
    const result = onNavigate(event) as unknown;
    if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
      Promise.resolve(result).catch(() => {});
    }
  } catch {
    /* usage tracking must never block a click */
  }
}
