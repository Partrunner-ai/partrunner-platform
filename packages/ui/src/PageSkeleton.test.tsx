import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageSkeleton, type PageSkeletonVariant } from './PageSkeleton';

const VARIANTS: PageSkeletonVariant[] = ['table', 'dashboard', 'detail', 'cards', 'chat'];

describe('PageSkeleton', () => {
  it('is one busy status region with the default label', () => {
    render(<PageSkeleton />);
    const region = screen.getByRole('status');
    expect(region.getAttribute('aria-busy')).toBe('true');
    expect(region.hasAttribute('data-pr-loading')).toBe(true);
    expect(region.textContent).toContain('Cargando…');
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('accepts a custom label', () => {
    render(<PageSkeleton label="Cargando solicitudes" />);
    expect(screen.getByRole('status').textContent).toContain('Cargando solicitudes');
  });

  it('hides every placeholder bar from assistive technology', () => {
    const { container } = render(<PageSkeleton variant="dashboard" />);
    const body = container.querySelector('.pr-page-skeleton__body')!;
    expect(body.getAttribute('aria-hidden')).toBe('true');
    expect(body.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(10);
  });

  it.each(VARIANTS)('renders the %s variant', (variant) => {
    const { container } = render(<PageSkeleton variant={variant} />);
    const root = container.firstElementChild!;
    expect(root.getAttribute('data-variant')).toBe(variant);
    expect(root.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(5);
  });

  it('defaults to the table variant with 8 rows and 5 columns', () => {
    const { container } = render(<PageSkeleton />);
    expect(container.firstElementChild!.getAttribute('data-variant')).toBe('table');
    const rows = container.querySelectorAll('.pr-page-skeleton__row:not(.pr-page-skeleton__row--head)');
    expect(rows).toHaveLength(8);
    expect(rows[0]!.children).toHaveLength(5);
  });

  it('honours rows and columns', () => {
    const { container } = render(<PageSkeleton rows={3} columns={2} />);
    const rows = container.querySelectorAll('.pr-page-skeleton__row:not(.pr-page-skeleton__row--head)');
    expect(rows).toHaveLength(3);
    expect(rows[0]!.children).toHaveLength(2);
  });

  it('draws 6 cards, 4 KPI tiles and 8 conversation rows', () => {
    const cards = render(<PageSkeleton variant="cards" />).container;
    expect(cards.querySelectorAll('.pr-page-skeleton__grid > .pr-page-skeleton__panel')).toHaveLength(6);
    const dash = render(<PageSkeleton variant="dashboard" />).container;
    expect(dash.querySelectorAll('.pr-page-skeleton__kpi')).toHaveLength(4);
    const chat = render(<PageSkeleton variant="chat" />).container;
    expect(chat.querySelectorAll('.pr-page-skeleton__convs > .pr-page-skeleton__item')).toHaveLength(8);
  });

  it('forwards ref, className and rest props', () => {
    const ref = createRef<HTMLDivElement>();
    render(<PageSkeleton ref={ref} className="extra" id="sk" />);
    expect(ref.current?.id).toBe('sk');
    expect(ref.current?.className).toBe('pr-page-skeleton extra');
  });
});
