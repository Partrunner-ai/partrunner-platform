import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Toolbar } from './Toolbar';

describe('Toolbar', () => {
  it('renders children inside the toolbar surface', () => {
    const { getByRole, container } = render(
      <Toolbar>
        <button type="button">Filtrar</button>
      </Toolbar>,
    );
    expect(getByRole('button', { name: 'Filtrar' })).toBeDefined();
    expect(container.firstElementChild!.className).toContain('pr-toolbar');
  });

  it('forwards ref and extra props to the div', () => {
    const { container } = render(
      <Toolbar data-testid="bar" id="filtros" aria-label="Filtros" />,
    );
    const root = container.querySelector('#filtros')!;
    expect(root.getAttribute('data-testid')).toBe('bar');
    expect(root.getAttribute('aria-label')).toBe('Filtros');
  });

  it('keeps the caller class last so it can override', () => {
    const { container } = render(<Toolbar className="pr-toolbar--tight mine" />);
    const cls = container.firstElementChild!.className;
    expect(cls).toContain('pr-toolbar');
    expect(cls).toContain('mine');
    expect(cls.indexOf('mine')).toBeGreaterThan(cls.indexOf('pr-toolbar'));
  });
});
