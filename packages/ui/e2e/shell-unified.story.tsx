import { Boxes, Truck } from 'lucide-react';
import {
  AppShell,
  GlobalHeader,
  SidebarTrigger,
  StaffShellProvider,
  type NavSection,
  type StaffShellContextValue,
} from '../../shell/src';

const SECTIONS: NavSection[] = [
  { id: 'main', items: [{ href: '/', label: 'Resumen', icon: Boxes }] },
  { id: 'ops', label: 'Operación', items: [{ href: '/fleets', label: 'Flotas', icon: Truck }] },
];

const STAFF: StaffShellContextValue = {
  user: { id: 'demo', name: 'Ada Lovelace' },
  profileHref: '#profile',
  preferences: { locale: 'es', theme: 'light' },
  notifications: { unreadCount: 3, href: '#n', items: [] },
  setTheme: () => {},
  setLocale: () => {},
};

/** Unified mode with a way-back chip, for a narrow-viewport overflow check. */
export function UnifiedWithWayBack() {
  // The shell reads the arrival from sessionStorage on its first mount.
  window.sessionStorage.setItem('pr-nav-from', JSON.stringify({ s: 'liveops', p: '/rutas/1' }));
  return (
    <StaffShellProvider value={STAFF}>
      <AppShell
        sections={SECTIONS}
        navigation="unified"
        appSub="supply"
        currentPath="/fleets"
        globalHeader={<GlobalHeader currentSub="supply" start={<SidebarTrigger />} />}
      >
        <p>content</p>
      </AppShell>
    </StaffShellProvider>
  );
}
