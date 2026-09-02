import { createRef } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatTile } from './StatTile';
import { StatTileGrid } from './StatTileGrid';

describe('StatTileGrid', () => {
  it('defaults to four columns and renders its tiles', () => {
    const { container } = render(
      <StatTileGrid>
        <StatTile label="Activas" value={42} />
        <StatTile label="Vencidas" value={3} />
      </StatTileGrid>,
    );
    const grid = container.querySelector('.pr-stat-grid')!;
    expect(grid.className).toBe('pr-stat-grid pr-stat-grid--cols-4');
    expect(grid.querySelectorAll('.pr-stat-tile')).toHaveLength(2);
  });

  it('takes any column count from two to six', () => {
    for (const columns of [2, 3, 5, 6] as const) {
      const { container } = render(<StatTileGrid columns={columns} />);
      expect(container.querySelector('.pr-stat-grid')?.className).toContain(
        `pr-stat-grid--cols-${columns}`,
      );
    }
  });

  it('forwards its ref, class and rest props', () => {
    const ref = createRef<HTMLDivElement>();
    render(<StatTileGrid ref={ref} className="extra" aria-label="Resumen" />);
    expect(ref.current?.tagName).toBe('DIV');
    expect(ref.current?.className).toBe('pr-stat-grid pr-stat-grid--cols-4 extra');
    expect(ref.current?.getAttribute('aria-label')).toBe('Resumen');
  });
});
