import { render } from '@testing-library/react';
import { Search } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { IconButton } from './IconButton';

describe('IconButton', () => {
  it('wires the accessible name and tooltip from label', () => {
    const { getByRole } = render(<IconButton label="Buscar" icon={<Search />} />);
    const btn = getByRole('button', { name: 'Buscar' });
    expect(btn.getAttribute('title')).toBe('Buscar');
  });

  it('keeps an explicit title instead of the label', () => {
    const { getByRole } = render(
      <IconButton label="Buscar" title="Buscar en la flota" icon={<Search />} />,
    );
    expect(getByRole('button', { name: 'Buscar' }).getAttribute('title')).toBe(
      'Buscar en la flota',
    );
  });

  it('defaults type to button so it never submits a form', () => {
    const { getByRole } = render(<IconButton label="Buscar" icon={<Search />} />);
    expect(getByRole('button', { name: 'Buscar' }).getAttribute('type')).toBe('button');
  });

  it('lets the caller override type', () => {
    const { getByRole } = render(
      <IconButton label="Enviar" icon={<Search />} type="submit" />,
    );
    expect(getByRole('button', { name: 'Enviar' }).getAttribute('type')).toBe('submit');
  });

  it('applies size and variant modifiers', () => {
    const { container } = render(
      <IconButton label="x" icon={<Search />} size="lg" variant="danger" />,
    );
    const cls = container.firstElementChild!.className;
    expect(cls).toContain('pr-icon-btn--lg');
    expect(cls).toContain('pr-icon-btn--danger');
  });

  it('adds the compact modifier only when asked', () => {
    const compact = render(<IconButton label="x" icon={<Search />} compact />);
    expect(compact.container.firstElementChild!.className).toContain(
      'pr-icon-btn--compact',
    );

    const regular = render(<IconButton label="x" icon={<Search />} />);
    expect(regular.container.firstElementChild!.className).not.toContain(
      'pr-icon-btn--compact',
    );
  });

  it('renders the icon node inside the button', () => {
    const { container } = render(<IconButton label="x" icon={<Search />} />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('forwards ref and click events', async () => {
    const onClick = vi.fn();
    let ref: HTMLButtonElement | null = null;
    const { getByRole } = render(
      <IconButton
        label="x"
        icon={<Search />}
        ref={(node) => {
          ref = node;
        }}
        onClick={onClick}
      />,
    );
    getByRole('button', { name: 'x' }).click();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(ref).toBeInstanceOf(HTMLButtonElement);
  });

  it('passes disabled through', () => {
    const { getByRole } = render(<IconButton label="x" icon={<Search />} disabled />);
    expect((getByRole('button', { name: 'x' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
