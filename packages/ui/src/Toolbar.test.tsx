import { createRef } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Toolbar, ToolbarGroup, ToolbarSpacer } from './Toolbar';

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

describe('Toolbar parts', () => {
  it('renders a group and a hidden spacer with their package classes', () => {
    const { container } = render(
      <Toolbar>
        <ToolbarGroup>
          <button type="button">Filtro</button>
        </ToolbarGroup>
        <ToolbarSpacer />
        <button type="button">Exportar</button>
      </Toolbar>,
    );
    expect(container.querySelector('.pr-toolbar__group')?.textContent).toBe('Filtro');
    const spacer = container.querySelector('.pr-toolbar__spacer')!;
    expect(spacer.getAttribute('aria-hidden')).toBe('true');
  });

  it('forwards refs, classes and rest props', () => {
    const group = createRef<HTMLDivElement>();
    const spacer = createRef<HTMLDivElement>();
    render(
      <Toolbar>
        <ToolbarGroup ref={group} className="group-extra" data-testid="group" />
        <ToolbarSpacer ref={spacer} className="spacer-extra" />
      </Toolbar>,
    );
    expect(group.current?.className).toBe('pr-toolbar__group group-extra');
    expect(group.current?.getAttribute('data-testid')).toBe('group');
    expect(spacer.current?.className).toBe('pr-toolbar__spacer spacer-extra');
  });
});
