import { createRef } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { Truck } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { FilterChip, FilterChipRow } from './FilterChip';

describe('FilterChip', () => {
  it('is a toggle button whose pressed state follows `active`', () => {
    const { getByRole, rerender } = render(<FilterChip>Pendiente</FilterChip>);
    const chip = getByRole('button', { name: 'Pendiente' });
    expect(chip.getAttribute('type')).toBe('button');
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    expect(chip.getAttribute('data-state')).toBe('inactive');
    rerender(<FilterChip active>Pendiente</FilterChip>);
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    expect(chip.getAttribute('data-state')).toBe('active');
  });

  it('shows the count in its own span and a tone dot or an icon before the label', () => {
    const { container, getByRole } = render(
      <FilterChip count={12} dot tone="warning">
        Pendiente
      </FilterChip>,
    );
    expect(getByRole('button', { name: 'Pendiente 12' })).toBeDefined();
    expect(container.querySelector('.pr-filter-chip__count')?.textContent).toBe('12');
    const dot = container.querySelector('.pr-filter-chip__dot')!;
    expect(dot.className).toContain('pr-status-dot--warning');
    expect(dot.getAttribute('aria-hidden')).toBe('true');

    const withIcon = render(<FilterChip icon={Truck}>Flotillas</FilterChip>);
    expect(withIcon.container.querySelector('.pr-filter-chip__icon')).not.toBeNull();
    expect(withIcon.container.querySelector('.pr-filter-chip__dot')).toBeNull();
  });

  it('calls its handler and respects native disabled', () => {
    const onClick = vi.fn();
    const { getByRole } = render(
      <FilterChip onClick={onClick} disabled>
        Cerrada
      </FilterChip>,
    );
    const chip = getByRole('button', { name: 'Cerrada' });
    expect(chip).toHaveProperty('disabled', true);
    fireEvent.click(chip);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('forwards its ref, class and rest props', () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <FilterChip ref={ref} className="extra" data-testid="chip">
        Todas
      </FilterChip>,
    );
    expect(ref.current?.tagName).toBe('BUTTON');
    expect(ref.current?.className).toBe('pr-filter-chip extra');
    expect(ref.current?.getAttribute('data-testid')).toBe('chip');
  });
});

describe('FilterChipRow', () => {
  it('is a named group of chips', () => {
    const ref = createRef<HTMLDivElement>();
    const { getByRole } = render(
      <FilterChipRow ref={ref} aria-label="Estado" className="extra">
        <FilterChip active>Todas</FilterChip>
        <FilterChip>Pendiente</FilterChip>
      </FilterChipRow>,
    );
    const group = getByRole('group', { name: 'Estado' });
    expect(group).toBe(ref.current);
    expect(group.className).toBe('pr-filter-chip-row extra');
    expect(group.querySelectorAll('.pr-filter-chip')).toHaveLength(2);
  });
});
