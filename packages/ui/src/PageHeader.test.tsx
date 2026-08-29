import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('renders the title as the page heading', () => {
    const { getByRole } = render(<PageHeader title="Cobranza" />);
    expect(getByRole('heading', { level: 1, name: 'Cobranza' })).toBeDefined();
  });

  it('renders the eyebrow chip only when provided', () => {
    const withEyebrow = render(<PageHeader eyebrow="Finanzas" title="Cobranza" />);
    expect(withEyebrow.container.querySelector('.pr-page-header__eyebrow')).not.toBeNull();

    const without = render(<PageHeader title="Cobranza" />);
    expect(without.container.querySelector('.pr-page-header__eyebrow')).toBeNull();
  });

  it('hides the subtitle and actions containers when empty', () => {
    const { container } = render(<PageHeader title="Cobranza" />);
    expect(container.querySelector('.pr-page-header__subtitle')).toBeNull();
    expect(container.querySelector('.pr-page-header__actions')).toBeNull();
  });

  it('keeps the eyebrow chip in the document for falsy-but-renderable values', () => {
    const { container } = render(<PageHeader eyebrow={0} title="Cobranza" />);
    expect(container.querySelector('.pr-page-header__eyebrow')).not.toBeNull();
  });

  it('renders the action row content', () => {
    const { getByRole } = render(
      <PageHeader title="Cobranza" actions={<button type="button">Exportar</button>} />,
    );
    expect(getByRole('button', { name: 'Exportar' })).toBeDefined();
  });

  it('forwards ref and extra props to the header element', () => {
    const { container } = render(
      <PageHeader title="Cobranza" data-testid="header-root" id="finanzas-header" />,
    );
    const root = container.querySelector('#finanzas-header')!;
    expect(root.getAttribute('data-testid')).toBe('header-root');
    expect(root.className).toContain('pr-page-header');
  });
});
