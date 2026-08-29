import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Trash2 } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';

function Harness({
  onConfirm = vi.fn(),
  loading = false,
  destructive = false,
}: {
  onConfirm?: () => void;
  loading?: boolean;
  destructive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Eliminar flotilla"
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={onConfirm}
        loading={loading}
        destructive={destructive}
        icon={Trash2}
      />
    </>
  );
}

describe('ConfirmDialog', () => {
  it('renders nothing while closed', () => {
    render(
      <ConfirmDialog open={false} onOpenChange={vi.fn()} title="x" onConfirm={vi.fn()} />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens with the title, description and both footer actions', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    expect(screen.getByRole('dialog', { name: 'Eliminar flotilla' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Eliminar' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Cancelar' })).not.toBeNull();
  });

  it('uses the Spanish labels by default', () => {
    render(<ConfirmDialog open onOpenChange={vi.fn()} title="x" onConfirm={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Confirmar' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Cancelar' })).not.toBeNull();
  });

  it('calls onConfirm from the confirm action and onOpenChange(false) from cancel', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    await user.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('blocks both actions while loading', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} loading />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    const confirm = screen.getByRole('button', { name: /Eliminar/ });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    const cancel = screen.getByRole('button', { name: 'Cancelar' });
    expect((cancel as HTMLButtonElement).disabled).toBe(true);

    await user.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('renders the icon chip when an icon is given', () => {
    render(
      <ConfirmDialog open onOpenChange={vi.fn()} title="x" onConfirm={vi.fn()} icon={Trash2} />,
    );
    expect(document.querySelector('.pr-confirm-dialog__icon')).not.toBeNull();
  });

  it('applies the danger icon tone when destructive', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="x"
        onConfirm={vi.fn()}
        icon={Trash2}
        destructive
      />,
    );
    expect(
      document.querySelector('.pr-confirm-dialog__icon--danger'),
    ).not.toBeNull();
  });

  it('becomes non-dismissible when destructive', () => {
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="x"
        onConfirm={vi.fn()}
        destructive
      />,
    );
    expect(screen.getByRole('dialog', { name: 'x' }).getAttribute('aria-modal')).toBe(
      'true',
    );
    // The strict dialog offers no close button of its own.
    expect(document.querySelector('.pr-dialog__close')).toBeNull();
  });
});
