import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TOAST_DURATION, TOAST_VISIBLE_LIMIT, Toaster, toast } from './Toast';

function toasts() {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-sonner-toast]')).filter(
    (node) => node.getAttribute('data-removed') !== 'true',
  );
}

afterEach(() => {
  act(() => toast.dismiss());
  vi.useRealTimers();
});

describe('Toaster', () => {
  it('renders a polite, named region at the bottom right', async () => {
    render(<Toaster />);
    act(() => {
      toast.success('Pago enviado');
    });
    const region = await screen.findByLabelText(/Notificaciones/);
    expect(region.getAttribute('aria-live')).toBe('polite');
    const list = document.querySelector('[data-sonner-toaster]');
    expect(list?.getAttribute('data-y-position')).toBe('bottom');
    expect(list?.getAttribute('data-x-position')).toBe('right');
    expect(list?.className).toContain('pr-toaster');
  });

  it('styles each tone with package classes, not sonner defaults', async () => {
    render(<Toaster />);
    act(() => {
      toast.success('Guardado');
      toast.info('Exportación en cola');
      toast.warning('Se importaron 18 de 20 filas');
    });
    await waitFor(() => expect(toasts()).toHaveLength(3));
    const [warning, info, success] = toasts() as [HTMLElement, HTMLElement, HTMLElement];
    expect(success.className).toContain('pr-toast--success');
    expect(info.className).toContain('pr-toast--info');
    expect(warning.className).toContain('pr-toast--warning');
    for (const node of toasts()) {
      expect(node.className).toContain('pr-toast');
      expect(node.getAttribute('data-styled')).toBe('false');
      expect(node.querySelector('.pr-toast__icon svg')).not.toBeNull();
    }
  });

  it('makes an error interrupt with role alert, and keeps the others polite', async () => {
    render(<Toaster />);
    act(() => {
      toast.success('Guardado');
      toast.error('No se pudo guardar', { description: 'Revisa la conexión.' });
    });
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('No se pudo guardar');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByText('Revisa la conexión.').className).toContain('pr-toast__description');
  });

  it('shows at most three toasts at once', async () => {
    render(<Toaster />);
    act(() => {
      for (let index = 1; index <= 5; index += 1) toast.info(`Aviso ${index}`);
    });
    await waitFor(() => expect(screen.getByText('Aviso 5')).toBeDefined());
    const visible = toasts().filter((node) => node.getAttribute('data-visible') === 'true');
    expect(TOAST_VISIBLE_LIMIT).toBe(3);
    expect(visible).toHaveLength(3);
  });

  it('runs the action, then closes the toast', async () => {
    const onUndo = vi.fn();
    render(<Toaster />);
    act(() => {
      toast.success('Ruta archivada', { action: { label: 'Deshacer', onClick: onUndo } });
    });
    const button = await screen.findByRole('button', { name: 'Deshacer' });
    expect(button.className).toContain('pr-btn');
    fireEvent.click(button);
    expect(onUndo).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(toasts()).toHaveLength(0));
  });

  it('gives every toast a named close button', async () => {
    const onClose = vi.fn();
    render(<Toaster closeLabel="Cerrar" />);
    act(() => {
      toast.error('No se pudo enviar', { onClose });
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar' }));
    await waitFor(() => expect(toasts()).toHaveLength(0));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('toast timing', () => {
  it('sets the package durations per tone', () => {
    expect(TOAST_DURATION.success).toBe(5000);
    expect(TOAST_DURATION.info).toBe(5000);
    expect(TOAST_DURATION.warning).toBe(8000);
    expect(TOAST_DURATION.error).toBe(Infinity);
  });

  it('closes a success after about 5 s and keeps an error', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<Toaster />);
    act(() => {
      toast.success('Guardado');
      toast.error('No se pudo guardar');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(toasts()).toHaveLength(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TOAST_DURATION.success + 1000);
    });
    expect(screen.queryByText('Guardado')).toBeNull();
    expect(screen.getByText('No se pudo guardar')).toBeDefined();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(screen.getByText('No se pudo guardar')).toBeDefined();
  });
});

describe('toast.promise', () => {
  it('replaces the loading toast with the success message', async () => {
    render(<Toaster />);
    let finish: (value: number) => void = () => {};
    const work = new Promise<number>((resolve) => {
      finish = resolve;
    });
    let returned: Promise<number> | undefined;
    act(() => {
      returned = toast.promise(work, {
        loading: 'Guardando…',
        success: (count) => `Se guardaron ${count} rutas`,
        error: 'No se pudo guardar',
      });
    });
    expect(await screen.findByText('Guardando…')).toBeDefined();
    await act(async () => {
      finish(12);
      await work;
    });
    expect(await screen.findByText('Se guardaron 12 rutas')).toBeDefined();
    expect(screen.queryByText('Guardando…')).toBeNull();
    expect(toasts()).toHaveLength(1);
    await expect(returned).resolves.toBe(12);
  });

  it('turns into a sticky error with its action on failure', async () => {
    render(<Toaster />);
    const onRetry = vi.fn();
    const failing = Promise.reject(new Error('timeout'));
    let returned: Promise<unknown> | undefined;
    act(() => {
      returned = toast.promise(failing, {
        loading: 'Enviando…',
        success: 'Enviado',
        error: (error) => `No se pudo enviar: ${(error as Error).message}`,
        errorAction: { label: 'Reintentar', onClick: onRetry },
      });
    });
    await expect(returned).rejects.toThrow('timeout');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('No se pudo enviar: timeout');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeDefined();
  });
});
