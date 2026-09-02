import { createRef } from 'react';
import { render } from '@testing-library/react';
import { Truck } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { IconTile } from './IconTile';

describe('IconTile', () => {
  it('renders a decorative neutral chip by default', () => {
    const { container } = render(<IconTile icon={Truck} />);
    const tile = container.querySelector('.pr-icon-tile')!;
    expect(tile.getAttribute('aria-hidden')).toBe('true');
    expect(tile.className).toContain('pr-icon-tile--neutral');
    expect(tile.className).toContain('pr-icon-tile--md');
    expect(tile.querySelector('svg')).not.toBeNull();
  });

  it('sizes the icon with the tile and takes a tone class', () => {
    const { container: small } = render(<IconTile icon={Truck} size="sm" tone="rose" />);
    expect(small.querySelector('svg')?.getAttribute('width')).toBe('14');
    expect(small.querySelector('.pr-icon-tile')?.className).toContain('pr-icon-tile--rose');
    const { container: large } = render(<IconTile icon={Truck} size="lg" tone="danger" />);
    expect(large.querySelector('svg')?.getAttribute('width')).toBe('22');
    expect(large.querySelector('.pr-icon-tile')?.className).toContain('pr-icon-tile--danger');
  });

  it('forwards its ref, class and rest props', () => {
    const ref = createRef<HTMLSpanElement>();
    render(<IconTile ref={ref} icon={Truck} className="extra" data-testid="tile" />);
    expect(ref.current?.tagName).toBe('SPAN');
    expect(ref.current?.className).toContain('extra');
    expect(ref.current?.getAttribute('data-testid')).toBe('tile');
  });
});
