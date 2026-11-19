import type { ReactNode } from 'react';
import { Boxes, Truck } from 'lucide-react';
import { vi } from 'vitest';
import { configureAppRegistry } from '@partrunner-ai/app-registry';
import { AppShell, type AppShellProps, type LinkComponent, type NavSection } from '../AppShell';
import { GlobalHeader, type GlobalHeaderProps } from '../GlobalHeader';
import { StaffShellProvider, type StaffShellContextValue } from '../StaffShellContext';

/** Stands in for next/link: handles the click itself instead of navigating. */
export const TestLink: LinkComponent = ({ href, children, onClick, ...rest }) => (
  <a
    href={href}
    onClick={(event) => {
      event.preventDefault();
      onClick?.();
    }}
    {...rest}
  >
    {children}
  </a>
);

export const SECTIONS: NavSection[] = [
  {
    id: 'main',
    items: [{ href: '/', label: 'Inicio', icon: Boxes }],
  },
  {
    id: 'ops',
    label: 'Operación',
    items: [
      { href: '/fleets', label: 'Flotas', icon: Truck },
      { href: '/units', label: 'Unidades', icon: Truck },
      { href: '/billing', label: 'Facturación', icon: Truck },
      { href: '/secret', label: 'Secreto', permission: 'secret.view' },
    ],
  },
];

/** `favoriteApps` is a shortcut for `preferences.favoriteApps`. */
export function staffContext(
  overrides: Partial<StaffShellContextValue> & { favoriteApps?: readonly string[] } = {},
): StaffShellContextValue {
  const { favoriteApps, ...rest } = overrides;
  const preferences = rest.preferences ?? { locale: 'es', theme: 'system' };
  return {
    user: { id: 'u1', name: 'Ada Lovelace' },
    profileHref: 'https://nexus.partrunner.ai/profile',
    notifications: { unreadCount: 0, href: 'https://nexus.partrunner.ai/n', items: [] },
    setLocale: vi.fn(),
    setTheme: vi.fn(),
    ...rest,
    preferences: favoriteApps === undefined ? preferences : { ...preferences, favoriteApps },
  };
}

export function useProductionRegistry(): void {
  configureAppRegistry({ hostPrefix: '', baseDomain: 'partrunner.ai' });
}

export function UnifiedShell({
  context = staffContext(),
  header,
  children,
  ...props
}: Partial<AppShellProps> & {
  context?: StaffShellContextValue;
  header?: GlobalHeaderProps;
  children?: ReactNode;
}) {
  return (
    <StaffShellProvider value={context}>
      <AppShell
        sections={SECTIONS}
        currentPath="/fleets"
        navigation="unified"
        appSub="supply"
        LinkComponent={TestLink}
        can={() => false}
        globalHeader={<GlobalHeader currentSub="supply" {...header} />}
        {...props}
      >
        {children ?? <p>content</p>}
      </AppShell>
    </StaffShellProvider>
  );
}
