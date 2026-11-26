import { createRef } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DetailItem, DetailList } from './DetailList';

describe('DetailList', () => {
  it('renders a dl with two columns and stacked layout by default', () => {
    const { container } = render(
      <DetailList>
        <DetailItem label="RFC">ABC010203XY1</DetailItem>
      </DetailList>,
    );
    const dl = container.querySelector('dl');
    expect(dl).not.toBeNull();
    expect(dl?.className).toContain('pr-detail-list--cols-2');
    expect(dl?.className).toContain('pr-detail-list--stacked');
    expect(container.querySelector('dl > div > dt')?.textContent).toBe('RFC');
    expect(container.querySelector('dl > div > dd')?.textContent).toBe('ABC010203XY1');
  });

  it('applies columns, layout and density classes', () => {
    const { container } = render(
      <DetailList columns={3} layout="inline" density="compact" />,
    );
    const cls = container.querySelector('dl')?.className ?? '';
    expect(cls).toContain('pr-detail-list--cols-3');
    expect(cls).toContain('pr-detail-list--inline');
    expect(cls).toContain('pr-detail-list--compact');
  });

  it('shows the empty mark for empty values and keeps 0', () => {
    const { container } = render(
      <DetailList>
        <DetailItem label="A" />
        <DetailItem label="B">{''}</DetailItem>
        <DetailItem label="C">{false}</DetailItem>
        <DetailItem label="D" emptyText="Sin dato" />
        <DetailItem label="E">{0}</DetailItem>
      </DetailList>,
    );
    const values = [...container.querySelectorAll('dd')];
    expect(values.map((v) => v.textContent)).toEqual(['—', '—', '—', 'Sin dato', '0']);
    expect(values[0]?.className).toContain('pr-detail-item__value--empty');
    expect(values[4]?.className).not.toContain('--empty');
  });

  it('marks span and numeric items', () => {
    const { container } = render(
      <DetailList>
        <DetailItem label="Notas" span="full">x</DetailItem>
        <DetailItem label="Saldo" numeric span={2}>$1</DetailItem>
      </DetailList>,
    );
    const items = container.querySelectorAll('.pr-detail-item');
    expect(items[0]?.className).toContain('pr-detail-item--span-full');
    expect(items[1]?.className).toContain('pr-detail-item--numeric');
    expect(items[1]?.className).toContain('pr-detail-item--span-2');
  });

  it('forwards refs, class and rest props', () => {
    const ref = createRef<HTMLDListElement>();
    const itemRef = createRef<HTMLDivElement>();
    render(
      <DetailList ref={ref} className="extra" aria-label="Datos">
        <DetailItem ref={itemRef} label="A" data-testid="i">x</DetailItem>
      </DetailList>,
    );
    expect(ref.current?.tagName).toBe('DL');
    expect(ref.current?.getAttribute('aria-label')).toBe('Datos');
    expect(ref.current?.className).toContain('extra');
    expect(itemRef.current?.getAttribute('data-testid')).toBe('i');
  });
});
