import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';
import { registerDialogLayerPortal } from './DialogLayer';

function Harness({ dismissible = true }: { dismissible?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Confirmar"
        description="Esto no se puede deshacer."
        dismissible={dismissible}
        footer={<button type="button">Guardar</button>}
      >
        <input aria-label="Motivo" />
      </Dialog>
    </>
  );
}

describe('Dialog', () => {
  it('renders nothing while closed', () => {
    render(<Dialog open={false} onClose={vi.fn()} title="x" />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is a labelled modal dialog', () => {
    render(<Dialog open onClose={vi.fn()} title="Confirmar" description="Ojo." />);
    const dialog = screen.getByRole('dialog', { name: 'Confirmar' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-describedby')).not.toBeNull();
  });

  it('portals out of the React tree so parent overflow cannot clip it', () => {
    render(
      <div style={{ overflow: 'hidden' }} data-testid="parent">
        <Dialog open onClose={vi.fn()} title="Confirmar" />
      </div>,
    );
    const dialog = screen.getByRole('dialog');
    expect(screen.getByTestId('parent').contains(dialog)).toBe(false);
    expect(document.body.contains(dialog)).toBe(true);
  });

  describe('focus', () => {
    it('moves focus into the dialog on open and back to the opener on close', async () => {
      const user = userEvent.setup();
      render(<Harness />);

      const opener = screen.getByRole('button', { name: 'Abrir' });
      await user.click(opener);
      // The body's first control, not the close button that precedes it in the
      // DOM — otherwise the first Enter would dismiss the dialog.
      expect(document.activeElement).toBe(screen.getByLabelText('Motivo'));

      await user.keyboard('{Escape}');
      // Closing returns focus to the control that opened the dialog.
      expect(document.activeElement).toBe(opener);
    });

    it('wraps Tab inside the dialog instead of walking out to the page', async () => {
      const user = userEvent.setup();
      render(<Harness />);
      await user.click(screen.getByRole('button', { name: 'Abrir' }));

      const input = screen.getByLabelText('Motivo');
      const save = screen.getByRole('button', { name: 'Guardar' });
      const close = screen.getByRole('button', { name: 'Cerrar' });

      // Tab follows DOM order — close (header), input (body), save (footer) —
      // starting from the body control we focused on open.
      expect(document.activeElement).toBe(input);
      await user.tab();
      expect(document.activeElement).toBe(save);
      await user.tab();
      // Wrapped back to the first control, rather than escaping to the opener
      // sitting behind the backdrop.
      expect(document.activeElement).toBe(close);
      await user.tab();
      expect(document.activeElement).toBe(input);
    });
  });

  describe('dismissible', () => {
    it('closes on Escape and on a backdrop click', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<Dialog open onClose={onClose} title="Confirmar" />);

      await user.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalledTimes(1);

      await user.click(document.querySelector('.pr-dialog__backdrop')!);
      expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('ignores Escape and the backdrop when turned off', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<Dialog open onClose={onClose} title="Confirmar" dismissible={false} />);

      await user.keyboard('{Escape}');
      await user.click(document.querySelector('.pr-dialog__backdrop')!);

      expect(onClose).not.toHaveBeenCalled();
      expect(screen.queryByRole('button', { name: 'Cerrar' })).toBeNull();
    });
  });

  // Layering, background inertness, and owned portals cover behavior that
  // `aria-modal` alone does not provide.
  describe('the layer stack', () => {
    function Nested() {
      const [outer, setOuter] = useState(false);
      const [inner, setInner] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOuter(true)}>
            Abrir externo
          </button>
          <Dialog open={outer} onClose={() => setOuter(false)} title="Externo">
            <button type="button" onClick={() => setInner(true)}>
              Abrir interno
            </button>
          </Dialog>
          <Dialog open={inner} onClose={() => setInner(false)} title="Interno">
            <input aria-label="Campo interno" />
          </Dialog>
        </>
      );
    }

    it('closes only the topmost dialog on Escape', async () => {
      const user = userEvent.setup();
      render(<Nested />);
      await user.click(screen.getByRole('button', { name: 'Abrir externo' }));
      await user.click(screen.getByRole('button', { name: 'Abrir interno' }));

      expect(screen.getByRole('dialog', { name: 'Interno' })).toBeTruthy();
      // `hidden: true` because the outer dialog is correctly aria-hidden while the
      // inner one is on top — only the topmost is exposed to assistive tech.
      expect(screen.getByRole('dialog', { name: 'Externo', hidden: true })).toBeTruthy();

      await user.keyboard('{Escape}');

      // Without a stack both handlers fire and the whole thing unwinds at once.
      expect(screen.queryByRole('dialog', { name: 'Interno' })).toBeNull();
      expect(screen.getByRole('dialog', { name: 'Externo' })).toBeTruthy();
    });

    it('keeps the page locked while any dialog is still open', async () => {
      const user = userEvent.setup();
      render(<Nested />);
      await user.click(screen.getByRole('button', { name: 'Abrir externo' }));
      await user.click(screen.getByRole('button', { name: 'Abrir interno' }));
      expect(document.body.style.overflow).toBe('hidden');

      await user.keyboard('{Escape}');
      // The inner one closing must not unlock the page under the outer one.
      expect(document.body.style.overflow).toBe('hidden');

      await user.keyboard('{Escape}');
      expect(document.body.style.overflow).not.toBe('hidden');
    });

    it('allocates each nested dialog and its owned portals a higher stack level', () => {
      const style = document.createElement('style');
      style.textContent = '.pr-dialog { position: fixed; z-index: 100; }';
      document.head.appendChild(style);

      render(
        <>
          <Dialog open onClose={() => {}} title="Externo">
            <input aria-label="Campo externo" />
          </Dialog>
          <Dialog open onClose={() => {}} title="Interno">
            <input aria-label="Campo interno" />
          </Dialog>
        </>,
      );

      const roots = Array.from(document.querySelectorAll<HTMLElement>('.pr-dialog'));
      expect(roots.map((root) => root.style.zIndex)).toEqual(['100', '120']);

      const innerMenu = document.createElement('div');
      document.body.appendChild(innerMenu);
      const deregister = registerDialogLayerPortal(screen.getByLabelText('Campo interno'), innerMenu);
      expect(innerMenu.style.zIndex).toBe('130');

      deregister();
      innerMenu.remove();
      style.remove();
    });
  });

  describe('background inert', () => {
    it('hides the rest of the page from assistive tech and restores it', () => {
      const sibling = document.createElement('div');
      sibling.setAttribute('data-testid', 'fondo');
      document.body.appendChild(sibling);

      const { unmount } = render(<Dialog open onClose={vi.fn()} title="Confirmar" />);

      // Trapping Tab stops keyboard escape; it does nothing about a screen
      // reader's virtual cursor or a pointer. This is what covers that.
      expect(sibling.getAttribute('aria-hidden')).toBe('true');
      expect(sibling.hasAttribute('inert')).toBe(true);

      unmount();
      expect(sibling.hasAttribute('aria-hidden')).toBe(false);
      expect(sibling.hasAttribute('inert')).toBe(false);
      sibling.remove();
    });

    it('restores a prior aria-hidden rather than assuming there was none', () => {
      const sibling = document.createElement('div');
      sibling.setAttribute('aria-hidden', 'true');
      document.body.appendChild(sibling);

      const { unmount } = render(<Dialog open onClose={vi.fn()} title="Confirmar" />);
      unmount();

      expect(sibling.getAttribute('aria-hidden')).toBe('true');
      sibling.remove();
    });
  });

  describe('owned portals', () => {
    it('places an owned portal above the dialog layer and restores its prior stack level', () => {
      const style = document.createElement('style');
      style.textContent = '.pr-dialog { position: fixed; z-index: 100; }';
      document.head.appendChild(style);

      render(
        <Dialog open onClose={vi.fn()} title="Confirmar">
          <input aria-label="Disparador con menú" />
        </Dialog>,
      );

      const owner = screen.getByLabelText('Disparador con menú');
      const portalRoot = document.createElement('div');
      const overlay = document.createElement('div');
      portalRoot.style.zIndex = '7';
      portalRoot.appendChild(overlay);
      document.body.appendChild(portalRoot);

      const deregister = registerDialogLayerPortal(owner, overlay);

      expect(portalRoot.dataset.prDialogLayerOwned).toBe('');
      expect(portalRoot.style.zIndex).toBe('110');

      deregister();
      expect(portalRoot.hasAttribute('data-pr-dialog-layer-owned')).toBe(false);
      expect(portalRoot.style.zIndex).toBe('7');

      portalRoot.remove();
      style.remove();
    });

    it('counts a portal registered by a control inside the dialog as inside', () => {
      render(
        <Dialog open onClose={vi.fn()} title="Confirmar">
          <input aria-label="Disparador" />
        </Dialog>,
      );

      const panel = screen.getByRole('dialog');
      const owner = screen.getByLabelText('Disparador');

      // A combobox or date-picker renders its overlay in its own portal: visually
      // inside the dialog, but not a DOM descendant of it.
      const overlay = document.createElement('div');
      overlay.innerHTML = '<button type="button">Opción</button>';
      document.body.appendChild(overlay);

      const deregister = registerDialogLayerPortal(owner, overlay);

      // Without registration it would be treated as background and made inert,
      // and tabbing into it would leave the trap.
      expect(overlay.hasAttribute('inert')).toBe(false);
      expect(overlay.hasAttribute('aria-hidden')).toBe(false);
      expect(panel.contains(overlay)).toBe(false);

      deregister();
      expect(overlay.hasAttribute('inert')).toBe(true);
      overlay.remove();
    });

    it('is a no-op when the owner is not inside any dialog', () => {
      const stray = document.createElement('div');
      document.body.appendChild(stray);
      const overlay = document.createElement('div');
      document.body.appendChild(overlay);

      expect(() => registerDialogLayerPortal(stray, overlay)()).not.toThrow();
      stray.remove();
      overlay.remove();
    });
  });

  it('locks body scroll while open and restores what was there before', () => {
    document.body.style.overflow = 'scroll';
    const { unmount } = render(<Dialog open onClose={vi.fn()} title="Confirmar" />);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('scroll');
    document.body.style.overflow = '';
  });
});

describe('dismissal controls', () => {
  it('keeps Escape working when only the backdrop is disabled', async () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} closeOnBackdrop={false} title="Editar ruta">
        <input aria-label="nombre" />
      </Dialog>,
    );
    // A stray click outside must not throw away a half-typed form…
    await userEvent.click(document.querySelector('.pr-dialog__backdrop')!);
    expect(onClose).not.toHaveBeenCalled();
    // …but the deliberate exits still work.
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('still closes on the backdrop by default', async () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Detalle">
        body
      </Dialog>,
    );
    await userEvent.click(document.querySelector('.pr-dialog__backdrop')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('hides the close button without giving up the other exits', async () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} hideClose title="Paso 2 de 3">
        body
      </Dialog>,
    );
    expect(document.querySelector('.pr-dialog__close')).toBeNull();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('lets a custom header replace the row but keeps the accessible name', () => {
    render(
      <Dialog open onClose={() => {}} title="Alta de flotilla" headerSlot={<div>hero</div>}>
        body
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog');
    // The visible header is whatever the app passed…
    expect(dialog.textContent).toContain('hero');
    // …and the dialog is still named, which is the part an app forgets. jest-dom's
    // accessible-name matcher is not set up here, so check the wiring itself.
    const labelId = dialog.getAttribute('aria-labelledby');
    expect(labelId).toBeTruthy();
    expect(document.getElementById(labelId!)?.textContent).toBe('Alta de flotilla');
  });

  it('carries the two wider sizes a table inside a dialog needs', () => {
    for (const size of ['2xl', '4xl'] as const) {
      const { unmount } = render(
        <Dialog open onClose={() => {}} size={size} title="Conciliación">
          body
        </Dialog>,
      );
      expect(document.querySelector(`.pr-dialog__panel--${size}`)).not.toBeNull();
      unmount();
    }
  });

  it('passes bodyClassName to the scrolling body, not the panel', () => {
    render(
      <Dialog open onClose={() => {}} title="t" bodyClassName="p-0">
        body
      </Dialog>,
    );
    expect(document.querySelector('.pr-dialog__body')!.className).toContain('p-0');
    expect(document.querySelector('.pr-dialog__panel')!.className).not.toContain('p-0');
  });
});
