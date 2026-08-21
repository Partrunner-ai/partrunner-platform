import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Boxes, Headphones, Map as MapIcon, Truck } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { configureAppRegistry } from '@partrunner-ai/app-registry';
import {
  AppShell,
  isNavItemActive,
  resolveActiveHref,
  type LinkComponent,
  type NavSection,
} from './AppShell';

/** Stands in for next/link: handles the click itself instead of navigating. */
const TestLink: LinkComponent = ({ href, children, onClick, ...rest }) => (
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

const SECTIONS: NavSection[] = [
  {
    id: 'main',
    items: [{ href: '/', label: 'Inicio', icon: Boxes }],
  },
  {
    id: 'general',
    label: 'General',
    items: [
      {
        id: 'items',
        label: 'Items',
        icon: MapIcon,
        children: [
          { href: '/items', label: 'All items', icon: MapIcon, badge: 4 },
          { href: '/items/detail', label: 'Item detail', icon: Truck },
          {
            href: '/items/reconcile',
            label: 'Reconcile',
            icon: Truck,
            permission: 'items.reconcile.view',
          },
        ],
      },
      { href: '/scheduled', label: 'Scheduled', icon: Truck, badge: 7 },
    ],
  },
];

function renderShell(props: Partial<Parameters<typeof AppShell>[0]> = {}) {
  return render(
    <AppShell sections={SECTIONS} currentPath="/" {...props}>
      <p>contenido</p>
    </AppShell>,
  );
}

describe('isNavItemActive', () => {
  it('matches the route and its descendants, not its name-alikes', () => {
    expect(isNavItemActive('/items', '/items')).toBe(true);
    expect(isNavItemActive('/items/reconcile', '/items')).toBe(true);
    // A raw prefix match would incorrectly activate this name-alike route.
    expect(isNavItemActive('/items-archived', '/items')).toBe(false);
  });

  it('treats the root as exact, and ignores query and hash', () => {
    expect(isNavItemActive('/', '/')).toBe(true);
    expect(isNavItemActive('/items', '/')).toBe(false);
    expect(isNavItemActive('/items', '/items?state=open')).toBe(true);
  });
});

describe('resolveActiveHref', () => {
  // "Summary" is the section index and metrics routes live beneath it.
  const HREFS = [
    '/workspace',
    '/workspace/inbox',
    '/workspace/requests',
    '/workspace/metrics/pending',
    '/workspace/metrics/placed',
    '/workspace/metrics/quotes',
  ];

  it('picks the leaf over the section index that also matches', () => {
    // Prefix matching makes both the section index and its leaf candidates.
    expect(resolveActiveHref('/workspace/metrics/placed', HREFS)).toBe(
      '/workspace/metrics/placed',
    );
  });

  it('still highlights the index on its own page', () => {
    expect(resolveActiveHref('/workspace', HREFS)).toBe('/workspace');
  });

  it('keeps a leaf highlighted across its own detail routes', () => {
    // The behaviour prefix matching exists for, and which exact matching would lose.
    expect(resolveActiveHref('/workspace/inbox/CASE-1042', HREFS)).toBe(
      '/workspace/inbox',
    );
  });

  it('is order-independent — specificity decides, not manifest position', () => {
    const reversed = [...HREFS].reverse();
    expect(resolveActiveHref('/workspace/metrics/placed', reversed)).toBe(
      '/workspace/metrics/placed',
    );
  });

  it('returns nothing when the page is outside the menu', () => {
    expect(resolveActiveHref('/perfil', HREFS)).toBeUndefined();
  });

  it('ignores undefined hrefs, which groups have', () => {
    expect(resolveActiveHref('/workspace', [undefined, '/workspace'])).toBe('/workspace');
  });

  it('normalizes query and hash so comparison against navPath holds', () => {
    expect(resolveActiveHref('/items', ['/items?state=open'])).toBe('/items');
  });
});

describe('AppShell', () => {
  it('paints the badge it accepts', async () => {
    renderShell();
    // The rendered badge must honor the declared interface.
    expect(await screen.findByText('7')).toBeDefined();
  });

  it('marks only the current item as the current page', () => {
    renderShell({ currentPath: '/scheduled' });
    expect(
      screen.getByRole('link', { name: /Scheduled/ }).getAttribute('aria-current'),
    ).toBe('page');
    expect(screen.getByRole('link', { name: /Inicio/ }).getAttribute('aria-current')).toBeNull();
  });

  it('highlights one item when a section index is an ancestor of the current page', () => {
    // On /workspace/metrics/placed, both the section index and leaf can
    // prefix-match. Only the most-specific destination should be current.
    //
    // Asserted on the rendered tree rather than the resolver, because the resolver
    // being right is not the same as the sidebar using it.
    const sections: NavSection[] = [
      {
        id: 'tray',
        items: [
          { href: '/workspace', label: 'Summary', icon: Boxes },
          { href: '/workspace/inbox', label: 'Inbox', icon: Truck },
        ],
      },
      {
        id: 'stats',
        items: [
          {
            id: 'estadisticas',
            label: 'Estadísticas',
            icon: MapIcon,
            children: [
              { href: '/workspace/metrics/placed', label: 'Placed', icon: Truck },
              { href: '/workspace/metrics/quotes', label: 'Quotes', icon: Truck },
            ],
          },
        ],
      },
    ];

    const { container } = render(
      <AppShell
        sections={sections}
        currentPath="/workspace/metrics/placed"
        LinkComponent={TestLink}
      >
        <p>contenido</p>
      </AppShell>,
    );

    const current = Array.from(container.querySelectorAll('a[aria-current="page"]'));
    expect(current.map((el) => el.textContent)).toEqual(['Placed']);
    expect(screen.getByRole('link', { name: /Summary/ }).getAttribute('aria-current')).toBeNull();
  });

  it('opens the group holding the current page and leaves the others closed', () => {
    renderShell({ currentPath: '/items/detail' });
    expect(screen.getByRole('button', { name: /Items/ }).getAttribute('aria-expanded')).toBe(
      'true',
    );
    expect(screen.getByRole('link', { name: /Item detail/ })).toBeDefined();
  });

  it('keeps a group closed until asked, then remembers the choice', async () => {
    const user = userEvent.setup();
    renderShell({ currentPath: '/scheduled' });

    const toggle = screen.getByRole('button', { name: /Items/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    await user.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(window.localStorage.getItem('pr-sidebar-collapsed:groups')).toContain('items');
  });

  it('uses server-derived state on the first render instead of flashing expanded', () => {
    const { container } = renderShell({
      initialState: { collapsed: true, groups: {} },
    });

    expect(container.querySelector('.pr-sidebar')?.getAttribute('data-collapsed')).toBe('true');
  });

  it('opens groups from server-derived state before hydration', () => {
    renderShell({
      currentPath: '/scheduled',
      initialState: { collapsed: false, groups: { items: true } },
    });

    expect(screen.getByRole('button', { name: /Items/ }).getAttribute('aria-expanded')).toBe(
      'true',
    );
  });

  it('stores group state in a cookie when the rail travels across subdomains', async () => {
    const user = userEvent.setup();
    renderShell({ currentPath: '/scheduled', collapseStorage: 'cookie' });

    await user.click(screen.getByRole('button', { name: /Items/ }));
    expect(decodeURIComponent(document.cookie)).toContain('pr-sidebar-collapsed:groups=');
    expect(decodeURIComponent(document.cookie)).toContain('"items":true');
  });

  it('rolls a closed group up to one badge and drops it again when open', async () => {
    const user = userEvent.setup();
    renderShell({ currentPath: '/scheduled' });

    const toggle = screen.getByRole('button', { name: /Items/ });
    // Closed, the group answers for the counts it is hiding.
    expect(toggle.textContent).toContain('4');

    await user.click(toggle);
    expect(toggle.textContent).not.toContain('4');
    expect(screen.getByRole('link', { name: /All items/ }).textContent).toContain('4');
  });

  it('hides an item the permission gate denies', () => {
    renderShell({ currentPath: '/items', can: () => false });
    expect(screen.queryByRole('link', { name: /Reconcile/ })).toBeNull();
    // The rest of the group survives, so the group itself stays.
    expect(screen.getByRole('button', { name: /Items/ })).toBeDefined();
  });

  it('drops a group, and its section, once nothing in it is visible', () => {
    render(
      <AppShell
        currentPath="/"
        can={() => false}
        sections={[
          {
            id: 'solo',
            label: 'Sólo admin',
            items: [
              {
                label: 'Items',
                children: [{ href: '/x', label: 'Reconcile', permission: 'denied' }],
              },
            ],
          },
        ]}
      >
        <p>contenido</p>
      </AppShell>,
    );
    expect(screen.queryByText('Sólo admin')).toBeNull();
    expect(screen.queryByRole('button', { name: /Items/ })).toBeNull();
  });

  it('flattens groups into leaves once collapsed to a rail', async () => {
    const user = userEvent.setup();
    renderShell({ currentPath: '/scheduled' });

    await user.click(screen.getByRole('button', { name: 'Colapsar menú' }));

    // The chevron is gone with the labels, so the children have to be reachable
    // directly or the rail would hide half the app.
    expect(screen.queryByRole('button', { name: /Items/ })).toBeNull();
    expect(screen.getByRole('link', { name: /All items/ })).toBeDefined();
    expect(window.localStorage.getItem('pr-sidebar-collapsed')).toBe('1');
  });

  it('resolves icon names through the map a nav manifest needs', () => {
    render(
      <AppShell
        currentPath="/"
        icons={{ Truck }}
        sections={[{ id: 'main', items: [{ href: '/', label: 'Items', icon: 'Truck' }] }]}
      >
        <p>contenido</p>
      </AppShell>,
    );
    expect(screen.getByRole('link', { name: /Items/ }).querySelector('svg')).not.toBeNull();
  });

  it('sends the Nexus item through the seamless transition instead of navigating', async () => {
    const user = userEvent.setup();
    let exited = false;
    renderShell({
      nexusHref: 'https://nexus.partrunner.ai',
      onNexusSelect: () => {
        exited = true;
      },
    });

    await user.click(screen.getByRole('link', { name: 'Nexus' }));
    expect(exited).toBe(true);
  });

  it('opens as a drawer from the trigger the header renders', async () => {
    const user = userEvent.setup();
    const { container } = renderShell({ LinkComponent: TestLink });

    const sidebar = container.querySelector('.pr-sidebar')!;
    expect(sidebar.getAttribute('data-mobile-open')).toBe('false');

    await user.click(screen.getByRole('button', { name: 'Abrir menú' }));
    expect(sidebar.getAttribute('data-mobile-open')).toBe('true');

    // Navigating closes it: on a phone the drawer covers the page it just opened.
    await user.click(screen.getByRole('link', { name: /Inicio/ }));
    expect(sidebar.getAttribute('data-mobile-open')).toBe('false');
  });

  it('drills from product areas into their current leaves and back home', async () => {
    const user = userEvent.setup();
    render(
      <AppShell
        variant="drill"
        currentPath="/"
        drillHomeItems={[{ href: '/', label: 'Inicio', icon: Boxes }]}
        sections={[
          {
            id: 'operations',
            label: 'Operations',
            description: 'Operational tools',
            icon: Boxes,
            tone: 'green',
            items: [
              { href: '/operations', label: 'Overview', icon: Boxes },
              { href: '/operations/records', label: 'Records', icon: Truck },
            ],
          },
        ]}
      >
        <p>contenido</p>
      </AppShell>,
    );

    expect(screen.getByRole('link', { name: 'Inicio' })).toBeDefined();
    const section = screen.getByRole('button', { name: /Operations 2 módulos/ });
    expect(section.querySelector('svg')).not.toBeNull();

    await user.click(section);
    expect(screen.getByRole('link', { name: 'Overview' })).toBeDefined();
    expect(screen.getByText('Operational tools')).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Inicio' }));
    expect(screen.queryByRole('link', { name: 'Overview' })).toBeNull();
    expect(screen.getByRole('button', { name: /Operations/ })).toBeDefined();
  });

  it('opens the drill section that owns the current internal route', () => {
    render(
      <AppShell
        variant="drill"
        currentPath="/settings/members"
        drillHomeItems={[{ href: '/', label: 'Inicio' }]}
        sections={[
          {
            id: 'settings',
            label: 'Settings',
            items: [{ href: '/settings/members', label: 'Members' }],
          },
        ]}
      >
        <p>contenido</p>
      </AppShell>,
    );

    expect(screen.getByRole('link', { name: 'Members' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(screen.queryByRole('button', { name: /Settings/ })).toBeNull();
  });

  it('applies one permission gate to drill home items, leaves, and empty sections', () => {
    render(
      <AppShell
        variant="drill"
        currentPath="/"
        can={(permission) => permission === 'allowed'}
        drillHomeItems={[
          { href: '/', label: 'Inicio' },
          { href: '/secret', label: 'Secreto', permission: 'denied' },
        ]}
        sections={[
          {
            id: 'hidden',
            label: 'Oculto',
            items: [{ href: '/hidden', label: 'Oculto', permission: 'denied' }],
          },
          {
            id: 'visible',
            label: 'Visible',
            items: [{ href: '/visible', label: 'Visible', permission: 'allowed' }],
          },
        ]}
      >
        <p>contenido</p>
      </AppShell>,
    );

    expect(screen.getByRole('link', { name: 'Inicio' })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Secreto' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Oculto/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Visible/ })).toBeDefined();
  });

  it('routes drill leaves through the host seamless transition', async () => {
    const user = userEvent.setup();
    let selected = '';
    render(
      <AppShell
        variant="drill"
        currentPath="/"
        sections={[
          {
            id: 'support',
            label: 'Support',
            icon: Headphones,
            items: [
              {
                href: 'https://support.example.com/tickets',
                label: 'Tickets',
                external: true,
              },
            ],
          },
        ]}
        onExternalSelect={(item) => {
          selected = item.href ?? '';
        }}
      >
        <p>contenido</p>
      </AppShell>,
    );

    await user.click(screen.getByRole('button', { name: /Support/ }));
    const link = screen.getByRole('link', { name: 'Tickets' });
    expect(link.getAttribute('target')).toBeNull();
    await user.click(link);
    expect(selected).toBe('https://support.example.com/tickets');
  });

  it('lets an app replace one drill section without forking the sidebar', async () => {
    const user = userEvent.setup();
    render(
      <AppShell
        variant="drill"
        currentPath="/"
        sections={[
          {
            id: 'workspace',
            label: 'Workspace',
            items: [{ href: '/workspace', label: 'Workspace home' }],
          },
        ]}
        renderDrillSection={(section) =>
          section.id === 'workspace' ? <div>Workspace tree</div> : undefined
        }
      >
        <p>contenido</p>
      </AppShell>,
    );

    await user.click(screen.getByRole('button', { name: /Workspace/ }));
    expect(screen.getByText('Workspace tree')).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Workspace home' })).toBeNull();
  });

  it('collapses the drill sidebar', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <AppShell
        variant="drill"
        currentPath="/"
        sections={[
          { id: 'operations', label: 'Operations', items: [{ href: '/records', label: 'Records' }] },
        ]}
      >
        <p>contenido</p>
      </AppShell>,
    );

    const sidebar = container.querySelector('.pr-sidebar');
    expect(sidebar?.getAttribute('data-collapsed')).toBe('false');

    await user.click(screen.getByRole('button', { name: 'Colapsar menú' }));
    expect(sidebar?.getAttribute('data-collapsed')).toBe('true');
    // The rail keeps the area tiles — an icon-only drill still has to navigate.
    expect(screen.getByRole('button', { name: /Operations/ })).toBeDefined();
    expect(window.localStorage.getItem('pr-sidebar-collapsed')).toBe('1');
  });
});

describe('AppShell host copy', () => {
  it('defaults the collapse control to Spanish', () => {
    renderShell({});
    const btn = screen.getByRole('button', { name: 'Colapsar menú' });
    expect(btn.textContent).toContain('Colapsar');
  });

  it('takes the host\u2019s own translations', async () => {
    const user = userEvent.setup();
    renderShell({ labels: { collapse: 'Collapse', expand: 'Expand' } });

    const btn = screen.getByRole('button', { name: 'Collapse menú' });
    expect(btn.textContent).toContain('Collapse');
    // Host copy replaces the Spanish default.
    expect(screen.queryByText('Colapsar')).toBeNull();

    await user.click(btn);
    expect(screen.getByRole('button', { name: 'Expand menú' })).toBeDefined();
  });

  it('lets the accessible name be set independently of the visible word', () => {
    renderShell({
      labels: { collapse: 'Collapse', collapseMenu: 'Collapse the navigation' },
    });
    expect(screen.getByRole('button', { name: 'Collapse the navigation' })).toBeDefined();
  });

  it('renders a section hint in the standard sidebar, not only on the drill landing', () => {
    const { container } = renderShell({
      sections: [
        {
          id: 'clientes',
          label: 'Clientes',
          description: 'Módulos por cliente',
          items: [{ href: '/retail', label: 'Retail' }],
        },
      ],
    });
    expect(container.querySelector('.pr-nav__section-description')?.textContent).toBe(
      'Módulos por cliente',
    );
  });
});

describe('AppShell brand block', () => {
  it('renders the packaged isotype when the app passes no logo', () => {
    const { container } = renderShell({});
    const mark = container.querySelector('.pr-sidebar__brand .pr-brand-mark');
    expect(mark).not.toBeNull();
    // currentColor is the guardrail: the white-on-yellow bug is unexpressible.
    expect(mark?.querySelector('path')?.getAttribute('fill')).toBe('currentColor');
    // Decorative — the brand name beside it already carries the accessible name.
    expect(mark?.getAttribute('aria-hidden')).toBe('true');
  });

  it('still honours an app-supplied logo', () => {
    const { container } = renderShell({ logo: <span data-testid="own-mark" /> });
    expect(container.querySelector('[data-testid="own-mark"]')).not.toBeNull();
    expect(container.querySelector('.pr-brand-mark')).toBeNull();
  });

  it('links the brand to the Nexus hub by default, through the registry', () => {
    // The host prefix is registry state, not a constant — unconfigured it is
    // `staging.`, which is why the default is resolved rather than hardcoded.
    configureAppRegistry({ hostPrefix: '' });
    try {
      const { container } = renderShell({});
      expect(container.querySelector('a.pr-sidebar__brand')?.getAttribute('href')).toBe(
        'https://nexus.partrunner.ai',
      );
    } finally {
      configureAppRegistry({ hostPrefix: 'staging.' });
    }
  });

  it('prefers the nexusHref the app already passes', () => {
    const { container } = renderShell({ nexusHref: 'https://staging.nexus.partrunner.ai' });
    expect(container.querySelector('a.pr-sidebar__brand')?.getAttribute('href')).toBe(
      'https://staging.nexus.partrunner.ai',
    );
  });

  it('routes the brand through the seamless exit the app wired for Nexus', async () => {
    const user = userEvent.setup();
    let exited = 0;
    const { container } = renderShell({
      nexusHref: 'https://nexus.partrunner.ai',
      onNexusSelect: () => {
        exited += 1;
      },
    });

    await user.click(container.querySelector('a.pr-sidebar__brand')!);
    expect(exited).toBe(1);
  });

  it('falls back to static text when an app opts out of the link', () => {
    const { container } = renderShell({ brandHref: null });
    expect(container.querySelector('a.pr-sidebar__brand')).toBeNull();
    expect(container.querySelector('div.pr-sidebar__brand')).not.toBeNull();
  });
});
