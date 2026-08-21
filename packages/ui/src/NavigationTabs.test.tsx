import { createRef, type ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  NavigationTabs,
  resolveActiveNavigationHref,
  type NavigationTabsLinkProps,
} from './NavigationTabs';

const ITEMS = [
  { href: '/workflow', label: 'Cases', exact: true, badge: 12 },
  { href: '/workflow/outreach', label: 'To send', badge: 4 },
  { href: '/workflow/outreach/history', label: 'History' },
] as const;

describe('NavigationTabs', () => {
  it('renders real route links and marks only the most specific current page', () => {
    render(
      <NavigationTabs
        aria-label="Case workflow"
        currentPath="/workflow/outreach/history/123?source=queue#evidence"
        items={ITEMS}
      />,
    );

    expect(screen.getByRole('navigation', { name: 'Case workflow' })).toBeTruthy();
    expect(screen.getByRole('list')).toBeTruthy();
    expect(screen.queryByRole('tab')).toBeNull();

    const cases = screen.getByRole('link', { name: 'Cases 12' });
    const outreach = screen.getByRole('link', { name: 'To send 4' });
    const history = screen.getByRole('link', { name: 'History' });

    expect(cases.getAttribute('href')).toBe('/workflow');
    expect(cases.hasAttribute('aria-current')).toBe(false);
    expect(outreach.hasAttribute('aria-current')).toBe(false);
    expect(history.getAttribute('aria-current')).toBe('page');
    expect(history.getAttribute('data-state')).toBe('active');
  });

  it('normalizes query, hash, and trailing slashes while respecting exact items', () => {
    expect(resolveActiveNavigationHref('/workflow/?view=open', ITEMS)).toBe('/workflow');
    expect(resolveActiveNavigationHref('/workflow/case/123', ITEMS)).toBeNull();
    expect(resolveActiveNavigationHref('/workflow/outreach/', ITEMS)).toBe(
      '/workflow/outreach',
    );
    expect(resolveActiveNavigationHref('/workflow/outreach-history', ITEMS)).toBeNull();
  });

  it('supports a router-aware link component without replacing link semantics', () => {
    const renderLink = vi.fn();
    function RouterLink({ href, children, ...props }: NavigationTabsLinkProps) {
      renderLink(href, props);
      return (
        <a href={href} {...props}>
          {children}
        </a>
      );
    }

    render(
      <NavigationTabs
        aria-label="Secciones"
        currentPath="/workflow/outreach"
        items={ITEMS}
        LinkComponent={RouterLink}
      />,
    );

    expect(renderLink).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('link', { name: 'To send 4' }).getAttribute('aria-current')).toBe(
      'page',
    );
  });

  it('keeps external destinations native and forwards explicit new-tab fields', () => {
    const renderLink = vi.fn();
    function RouterLink({ href, children, ...props }: NavigationTabsLinkProps) {
      renderLink(href, props);
      return (
        <a href={href} {...props}>
          {children}
        </a>
      );
    }

    const items = [
      { href: '/workflow', label: 'Cases', exact: true },
      {
        href: '/workflow/report',
        label: 'Report',
        target: '_blank',
        rel: 'noopener',
      },
      {
        href: 'https://example.com/guide',
        label: 'External guide',
        external: true,
      },
    ] as const;

    render(
      <NavigationTabs
        aria-label="Workflow help"
        currentPath="/workflow"
        items={items}
        LinkComponent={RouterLink}
      />,
    );

    expect(renderLink).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('link', { name: 'Report' }).getAttribute('target')).toBe(
      '_blank',
    );
    expect(screen.getByRole('link', { name: 'Report' }).getAttribute('rel')).toBe(
      'noopener',
    );

    const external = screen.getByRole('link', { name: 'External guide' });
    expect(external.getAttribute('href')).toBe('https://example.com/guide');
    expect(external.getAttribute('target')).toBe('_blank');
    expect(external.getAttribute('rel')).toBe('noopener noreferrer');
    expect(external.hasAttribute('aria-current')).toBe(false);
    expect(resolveActiveNavigationHref('https://example.com/guide', items)).toBeNull();
  });

  it('owns badge loading visuals while keeping the pending badge out of the name', () => {
    render(
      <NavigationTabs
        aria-label="Queues"
        currentPath="/queue"
        items={[
          { href: '/queue', label: 'Open', badgeLoading: true },
          { href: '/done', label: 'Done', badge: 0 },
        ]}
      />,
    );

    expect(screen.getByRole('link', { name: 'Open' })).toBeTruthy();
    expect(document.querySelector('[data-slot="navigation-tab-badge"][data-loading]')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Done 0' })).toBeTruthy();
  });

  it('forwards nav attributes and refs', () => {
    const ref = createRef<HTMLElement>();
    render(
      <NavigationTabs
        ref={ref}
        aria-labelledby="workspace-heading"
        className="consumer-navigation"
        data-testid="navigation"
        currentPath="/one"
        items={[{ href: '/one', label: 'One' as ReactNode }]}
      />,
    );

    expect(ref.current).toBe(screen.getByTestId('navigation'));
    expect(ref.current?.classList.contains('consumer-navigation')).toBe(true);
    expect(ref.current?.getAttribute('aria-labelledby')).toBe('workspace-heading');
  });
});
