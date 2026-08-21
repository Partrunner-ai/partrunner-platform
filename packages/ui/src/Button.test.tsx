import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArrowRight } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders a real button by default', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Guardar</Button>);

    const button = screen.getByRole('button', { name: 'Guardar' });
    expect(button.tagName).toBe('BUTTON');
    expect(button.className).toContain('pr-btn--primary');
    expect(button.className).toContain('pr-btn--md');

    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('keeps the caller className instead of replacing it', () => {
    render(<Button className="mi-clase">Guardar</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('pr-btn');
    expect(button.className).toContain('mi-clase');
  });

  it('can opt out of tactile press motion', () => {
    render(<Button static>Guardar</Button>);
    expect(screen.getByRole('button').className).toContain('pr-btn--static');
  });

  describe('loading', () => {
    it('blocks interaction and swaps the leading icon for a spinner', async () => {
      const onClick = vi.fn();
      render(
        <Button loading icon={ArrowRight} onClick={onClick}>
          Guardar
        </Button>,
      );

      const button = screen.getByRole('button') as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      expect(button.dataset.loading).toBe('true');
      expect(button.getAttribute('aria-busy')).toBe('true');
      expect(button.querySelector('.pr-btn__spinner')).not.toBeNull();

      await userEvent.click(button);
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('icon', () => {
    // Both supported icon shapes should render consistently.
    it('sizes a lucide component to the button', () => {
      render(
        <Button size="xs" icon={ArrowRight}>
          Ir
        </Button>,
      );
      const svg = screen.getByRole('button').querySelector('svg');
      expect(svg?.getAttribute('width')).toBe('14');
    });

    it('leaves an already-rendered element exactly as given', () => {
      render(<Button icon={<ArrowRight size={22} data-testid="icono" />}>Ir</Button>);
      // The caller sized it; we must not override that.
      expect(screen.getByTestId('icono').getAttribute('width')).toBe('22');
    });

    it('drops the icon while loading, whichever shape it is', () => {
      render(
        <Button loading icon={<ArrowRight data-testid="icono" />}>
          Ir
        </Button>,
      );
      expect(screen.queryByTestId('icono')).toBeNull();
      expect(screen.getByRole('button').querySelector('.pr-btn__spinner')).not.toBeNull();
    });
  });

  describe('asChild', () => {
    it('renders the child element and keeps the styling', () => {
      render(
        <Button asChild variant="ghost">
          <a href="/rutas">Rutas</a>
        </Button>,
      );

      const link = screen.getByRole('link', { name: 'Rutas' });
      expect(link.tagName).toBe('A');
      expect(link.getAttribute('href')).toBe('/rutas');
      expect(link.className).toContain('pr-btn--ghost');
      expect(screen.queryByRole('button')).toBeNull();
    });

    it('puts the icon inside the slotted element, not beside it', () => {
      render(
        <Button asChild icon={ArrowRight}>
          <a href="/rutas">Rutas</a>
        </Button>,
      );

      const link = screen.getByRole('link');
      // The icon has to be a child of the anchor, or it renders outside the
      // clickable area and outside the button's own box.
      expect(link.querySelector('svg')).not.toBeNull();
      expect(link.textContent).toContain('Rutas');
    });

    it('composes the child handler with ours rather than clobbering it', async () => {
      const order: string[] = [];
      render(
        <Button asChild onClick={() => order.push('button')}>
          <a href="#x" onClick={() => order.push('child')}>
            Rutas
          </a>
        </Button>,
      );

      await userEvent.click(screen.getByRole('link'));
      expect(order).toEqual(['child', 'button']);
    });

    it('expresses disabled for assistive tech, since anchors have no disabled', () => {
      render(
        <Button asChild disabled>
          <a href="/rutas">Rutas</a>
        </Button>,
      );

      const link = screen.getByRole('link');
      expect(link.getAttribute('aria-disabled')).toBe('true');
      expect(link.hasAttribute('disabled')).toBe(false);
    });

    it('forwards the ref to the slotted element', () => {
      const ref = createRef<HTMLButtonElement>();
      render(
        <Button asChild ref={ref}>
          <a href="/rutas">Rutas</a>
        </Button>,
      );
      expect(ref.current?.tagName).toBe('A');
    });
  });
});

describe('the link variant', () => {
  it('carries its own class so the CSS can strip the fill and the padding', () => {
    render(<Button variant="link">Asignarme</Button>);
    const button = screen.getByRole('button', { name: 'Asignarme' });
    expect(button.className).toContain('pr-btn--link');
    expect(button.className).toContain('pr-btn');
  });

  it('is still a button, so it keeps the disabled contract', () => {
    render(
      <Button variant="link" disabled>
        Asignarme
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Asignarme' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('composes with asChild, for when it really is a link', () => {
    render(
      <Button asChild variant="link">
        <a href="/informe">Ver informe</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Ver informe' });
    expect(link.className).toContain('pr-btn--link');
    expect(link.getAttribute('href')).toBe('/informe');
  });
});
