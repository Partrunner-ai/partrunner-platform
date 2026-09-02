import { createRef } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SearchField } from './SearchField';

describe('SearchField', () => {
  it('is a search input with the magnifier, sized for a toolbar', () => {
    const { getByRole, container } = render(
      <SearchField aria-label="Buscar" placeholder="Buscar solicitudes…" />,
    );
    const input = getByRole('searchbox', { name: 'Buscar' });
    expect(input.getAttribute('type')).toBe('search');
    const field = container.querySelector('.pr-field')!;
    expect(field.className).toContain('pr-search-field');
    expect(field.className).not.toContain('pr-search-field--block');
    expect(field.querySelector('.pr-field__control--sm')).not.toBeNull();
    expect(field.querySelector('.pr-field__affix svg')).not.toBeNull();
  });

  it('puts the ref on the native input and the layout class on the wrapper', () => {
    const ref = createRef<HTMLInputElement>();
    const { container } = render(
      <SearchField
        ref={ref}
        aria-label="Buscar"
        className="input-extra"
        containerClassName="wrapper-extra"
      />,
    );
    expect(ref.current?.tagName).toBe('INPUT');
    expect(ref.current?.className).toContain('input-extra');
    expect(ref.current?.className).not.toContain('wrapper-extra');
    const wrapper = container.querySelector('.pr-search-field')!;
    expect(wrapper.className).toContain('wrapper-extra');
  });

  it('fills its container with fullWidth', () => {
    const { container } = render(<SearchField aria-label="Buscar" fullWidth />);
    const wrapper = container.querySelector('.pr-search-field')!;
    expect(wrapper.className).toContain('pr-search-field--block');
    expect(wrapper.className).toContain('pr-field--block');
  });

  it('keeps the Input contract for label, hint and size', () => {
    const { getByRole, container } = render(
      <SearchField label="Buscar" hint="Nombre o placa" inputSize="md" />,
    );
    const input = getByRole('searchbox', { name: 'Buscar' });
    expect(input.getAttribute('aria-describedby')).toMatch(/.+/);
    expect(container.querySelector('.pr-field__control--md')).not.toBeNull();
  });
});
