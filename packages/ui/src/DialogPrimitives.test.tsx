import { createRef, useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from './DialogPrimitives';
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogRoot,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './AlertDialog';
import {
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetRoot,
  SheetTitle,
  SheetTrigger,
} from './Sheet';

describe('compound Dialog', () => {
  it('supports uncontrolled triggers, accessible naming, close controls, and focus return', async () => {
    const user = userEvent.setup();
    render(
      <DialogRoot>
        <DialogTrigger>Abrir diálogo</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar ruta</DialogTitle>
            <DialogDescription>Actualiza los datos operativos.</DialogDescription>
          </DialogHeader>
          <input aria-label="Nombre de ruta" />
          <DialogFooter>
            <DialogClose>Cancelar</DialogClose>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>,
    );

    const trigger = screen.getByRole('button', { name: 'Abrir diálogo' });
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Editar ruta' });
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText('Nombre de ruta'));

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('supports controlled state and asChild triggers without replacing consumer handlers', async () => {
    const user = userEvent.setup();
    const consumerClick = vi.fn();

    function Controlled() {
      const [open, setOpen] = useState(false);
      return (
        <DialogRoot open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <a href="#editor" onClick={consumerClick}>
              Editar
            </a>
          </DialogTrigger>
          <DialogContent aria-label="Editor" showCloseButton={false}>
            <DialogClose asChild>
              <a href="#done">Listo</a>
            </DialogClose>
          </DialogContent>
        </DialogRoot>
      );
    }

    render(<Controlled />);
    await user.click(screen.getByRole('link', { name: 'Editar' }));
    expect(consumerClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog', { name: 'Editor' })).toBeTruthy();

    await user.click(screen.getByRole('link', { name: 'Listo' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('honors initialFocusRef and lets onOpenAutoFocus take ownership', async () => {
    const user = userEvent.setup();
    const initialFocusRef = createRef<HTMLInputElement>();
    const customFocusRef = createRef<HTMLButtonElement>();

    function FocusHarness() {
      return (
        <DialogRoot defaultOpen>
          <DialogContent aria-label="Foco inicial" initialFocusRef={initialFocusRef}>
            <input aria-label="Primero" />
            <input ref={initialFocusRef} aria-label="Preferido" />
            <DialogRoot>
              <DialogTrigger>Abrir personalizado</DialogTrigger>
              <DialogContent
                aria-label="Foco personalizado"
                onOpenAutoFocus={(event) => {
                  event.preventDefault();
                  customFocusRef.current?.focus();
                }}
              >
                <input aria-label="Campo predeterminado" />
                <button ref={customFocusRef} type="button">
                  Destino personalizado
                </button>
              </DialogContent>
            </DialogRoot>
          </DialogContent>
        </DialogRoot>
      );
    }

    render(<FocusHarness />);
    await waitFor(() => expect(document.activeElement).toBe(initialFocusRef.current));

    await user.click(screen.getByRole('button', { name: 'Abrir personalizado' }));
    expect(document.activeElement).toBe(customFocusRef.current);
  });
});

describe('AlertDialog', () => {
  it('uses alertdialog semantics and requires an explicit action or cancel', async () => {
    const user = userEvent.setup();
    const action = vi.fn();
    render(
      <AlertDialogRoot>
        <AlertDialogTrigger>Eliminar ruta</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar la ruta?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="danger" onClick={action}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogRoot>,
    );

    await user.click(screen.getByRole('button', { name: 'Eliminar ruta' }));
    expect(screen.getByRole('alertdialog', { name: '¿Eliminar la ruta?' })).toBeTruthy();

    await user.keyboard('{Escape}');
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    await user.click(document.querySelector('.pr-dialog__backdrop')!);
    expect(screen.getByRole('alertdialog')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(action).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});

describe('Sheet', () => {
  it('owns side and width styling while retaining dialog behavior', async () => {
    const user = userEvent.setup();
    render(
      <SheetRoot>
        <SheetTrigger>Filtros</SheetTrigger>
        <SheetContent side="left" width="lg">
          <SheetHeader>
            <SheetTitle>Filtrar solicitudes</SheetTitle>
            <SheetDescription>Limita los resultados visibles.</SheetDescription>
          </SheetHeader>
          <input aria-label="Cliente" />
          <SheetClose>Aplicar</SheetClose>
        </SheetContent>
      </SheetRoot>,
    );

    const trigger = screen.getByRole('button', { name: 'Filtros' });
    await user.click(trigger);

    const sheet = screen.getByRole('dialog', { name: 'Filtrar solicitudes' });
    expect(sheet.getAttribute('data-side')).toBe('left');
    expect(sheet.getAttribute('data-width')).toBe('lg');
    expect(sheet.className).toContain('pr-sheet__panel');
    expect(document.activeElement).toBe(screen.getByLabelText('Cliente'));

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
