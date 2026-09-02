import { createRef } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SectionHeading } from './SectionHeading';

describe('SectionHeading', () => {
  it('renders the title as an h2 by default and an h3 on request', () => {
    const { getByRole } = render(<SectionHeading title="Colocadas por nodo" />);
    expect(getByRole('heading', { level: 2, name: 'Colocadas por nodo' })).toBeDefined();
    const nested = render(<SectionHeading title="Detalle" headingLevel={3} />);
    expect(nested.getByRole('heading', { level: 3, name: 'Detalle' })).toBeDefined();
  });

  it('renders eyebrow, description and actions only when provided', () => {
    const { container } = render(<SectionHeading title="Colocadas" />);
    expect(container.querySelector('.pr-section-heading__eyebrow')).toBeNull();
    expect(container.querySelector('.pr-section-heading__description')).toBeNull();
    expect(container.querySelector('.pr-section-heading__actions')).toBeNull();

    const full = render(
      <SectionHeading
        eyebrow="Supply"
        title="Colocadas"
        description="Últimos 30 días"
        actions={<button type="button">Exportar</button>}
      />,
    );
    expect(full.container.querySelector('.pr-section-heading__eyebrow')?.textContent).toBe(
      'Supply',
    );
    expect(full.container.querySelector('.pr-section-heading__description')?.textContent).toBe(
      'Últimos 30 días',
    );
    expect(full.getByRole('button', { name: 'Exportar' })).toBeDefined();
  });

  it('keeps a falsy-but-renderable eyebrow', () => {
    const { container } = render(<SectionHeading eyebrow={0} title="Cero" />);
    expect(container.querySelector('.pr-section-heading__eyebrow')?.textContent).toBe('0');
  });

  it('forwards its ref, class and rest props to the header element', () => {
    const ref = createRef<HTMLElement>();
    render(<SectionHeading ref={ref} title="T" className="extra" id="section-1" />);
    expect(ref.current?.tagName).toBe('HEADER');
    expect(ref.current?.id).toBe('section-1');
    expect(ref.current?.className).toBe('pr-section-heading extra');
  });
});
