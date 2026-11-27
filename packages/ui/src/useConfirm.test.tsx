import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useConfirm, type ConfirmOptions } from './useConfirm';

function Harness({ onAnswer, options }: { onAnswer: (value: boolean) => void; options?: Partial<ConfirmOptions> }) {
  const { confirm, dialog } = useConfirm();
  return (
    <>
      <button
        type="button"
        onClick={async () => {
          onAnswer(
            await confirm({
              title: '¿Eliminar la ruta 1042?',
              description: 'Se borran sus cargos.\nNo se puede deshacer.',
              confirmLabel: 'Eliminar ruta',
              destructive: true,
              ...options,
            }),
          );
        }}
      >
        Eliminar
      </button>
      {dialog}
    </>
  );
}

describe('useConfirm', () => {
  it('resolves true when the person confirms', async () => {
    const onAnswer = vi.fn();
    render(<Harness onAnswer={onAnswer} />);
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(screen.getByText('¿Eliminar la ruta 1042?')).toBeDefined();
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar ruta' }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(true));
    expect(onAnswer).toHaveBeenCalledTimes(1);
  });

  it('resolves false when the person cancels', async () => {
    const onAnswer = vi.fn();
    render(<Harness onAnswer={onAnswer} options={{ destructive: false }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(false));
  });

  it('gives a destructive confirm the danger button and keeps line breaks of plain text', async () => {
    render(<Harness onAnswer={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(screen.getByRole('button', { name: 'Eliminar ruta' }).className).toContain('pr-btn--danger');
    expect(screen.getByText(/Se borran sus cargos/).className).toContain('pr-confirm-dialog__text');
  });

  it('answers false when the component unmounts with the question open', async () => {
    const onAnswer = vi.fn();
    const { unmount } = render(<Harness onAnswer={onAnswer} />);
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    unmount();
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(false));
  });
});
