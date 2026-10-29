import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CommentThread, type CommentMessage, type CommentThreadProps } from './CommentThread';

const VIEWER = '11111111-1111-4111-8111-111111111111';
const ANA = '22222222-2222-4222-8222-222222222222';

function message(overrides: Partial<CommentMessage> = {}): CommentMessage {
  return {
    id: 'm1',
    author: { kind: 'user', userId: ANA, name: 'Ana Ruiz' },
    body: 'Revisa su licencia',
    status: 'sent',
    createdAt: '2026-10-29T16:00:00.000Z',
    editedAt: null,
    deleted: false,
    replyTo: null,
    mentions: [],
    attachments: [],
    reactions: [],
    ...overrides,
  };
}

function setup(props: Partial<CommentThreadProps> = {}) {
  const onSend = vi.fn().mockResolvedValue(undefined);
  const onReact = vi.fn();
  const utils = render(
    <CommentThread
      messages={[message()]}
      viewerId={VIEWER}
      canWrite
      attachmentHref={(id, o) => `/api/comentarios/attachments/${id}${o?.download ? '?download=1' : ''}`}
      onSend={onSend}
      onReact={onReact}
      {...props}
    />,
  );
  return { ...utils, onSend, onReact };
}

describe('CommentThread', () => {
  it('renders mentions by name and marks the viewer’s own messages', () => {
    setup({
      messages: [
        message({ body: `Hola <@u:${VIEWER}>`, mentions: [{ kind: 'user', id: VIEWER, name: 'Sebastián' }] }),
        message({ id: 'm2', author: { kind: 'user', userId: VIEWER, name: 'Sebastián' }, body: 'Va' }),
      ],
    });
    expect(screen.getByText('@Sebastián')).toBeTruthy();
    expect(document.getElementById('pr-comment-m2')?.className).toContain('pr-comments__row--own');
    expect(document.getElementById('pr-comment-m1')?.className).not.toContain('pr-comments__row--own');
  });

  it('sends a picked mention as a token and clears the draft', async () => {
    const user = userEvent.setup();
    const onSearchMentions = vi.fn().mockResolvedValue([{ kind: 'user', id: ANA, name: 'Ana Ruiz', email: 'ana@x.com' }]);
    const { onSend } = setup({ onSearchMentions });
    const input = screen.getByLabelText('Escribe un comentario');

    await user.type(input, 'Ojo @an');
    const option = await screen.findByRole('option', { name: /Ana Ruiz/ });
    fireEvent.mouseDown(option);
    // The caret lands after the mention in the same commit, not a frame later,
    // so keys typed right away go after it.
    expect((input as HTMLTextAreaElement).selectionStart).toBe('Ojo @Ana Ruiz '.length);
    await user.type(input, 'mañana{Enter}', { initialSelectionStart: 'Ojo @Ana Ruiz '.length });

    await waitFor(() =>
      expect(onSend).toHaveBeenCalledWith({ body: `Ojo <@u:${ANA}> mañana`, replyTo: null, attachmentIds: [] }),
    );
    expect((input as HTMLTextAreaElement).value).toBe('');
  });

  it('replies to a message and shows the quote while composing', async () => {
    const user = userEvent.setup();
    const { onSend } = setup();
    await user.click(screen.getByRole('button', { name: 'Responder' }));
    expect(screen.getByText('Respondiendo a Ana Ruiz')).toBeTruthy();
    await user.type(screen.getByLabelText('Escribe un comentario'), 'Hecho{Enter}');
    await waitFor(() => expect(onSend).toHaveBeenCalledWith({ body: 'Hecho', replyTo: 'm1', attachmentIds: [] }));
    expect(screen.queryByText('Respondiendo a Ana Ruiz')).toBeNull();
  });

  it('toggles a reaction off when it is already the viewer’s', async () => {
    const user = userEvent.setup();
    const { onReact } = setup({
      messages: [message({ reactions: [{ emoji: '👍', count: 2, mine: true, names: ['Ana Ruiz', 'Sebastián'] }] })],
    });
    await user.click(screen.getByRole('button', { pressed: true }));
    expect(onReact).toHaveBeenCalledWith('m1', '👍', false);
  });

  it('shows a deleted message without its text, files or actions', () => {
    setup({
      messages: [
        message({
          deleted: true,
          body: '',
          attachments: [],
          author: { kind: 'user', userId: VIEWER, name: 'Sebastián' },
        }),
      ],
      onDelete: vi.fn(),
    });
    expect(screen.getByText('Mensaje eliminado')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Borrar' })).toBeNull();
  });

  it('serves images inline and other files as downloads through the app URL', () => {
    setup({
      messages: [
        message({
          attachments: [
            { id: 'img', fileName: 'licencia.jpg', mimeType: 'image/jpeg', sizeBytes: 2048 },
            { id: 'pdf', fileName: 'ine.pdf', mimeType: 'application/pdf', sizeBytes: 3 * 1024 * 1024 },
          ],
        }),
      ],
    });
    expect(screen.getByAltText('licencia.jpg').getAttribute('src')).toBe('/api/comentarios/attachments/img');
    const file = screen.getByText('ine.pdf').closest('a');
    expect(file?.getAttribute('href')).toBe('/api/comentarios/attachments/pdf?download=1');
    expect(screen.getByText('3.0 MB')).toBeTruthy();
  });

  it('marks an agent reply that is still being written', () => {
    setup({
      messages: [message({ author: { kind: 'agent', userId: null, name: 'Runnito', handle: 'runnito' }, body: 'Revisando', status: 'streaming' })],
    });
    expect(screen.getByText('IA')).toBeTruthy();
    expect(screen.getByLabelText('Escribiendo')).toBeTruthy();
  });

  it('is read-only without write permission', () => {
    setup({ canWrite: false });
    expect(screen.queryByLabelText('Escribe un comentario')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Responder' })).toBeNull();
    expect(screen.getByText(/no tienes permiso para escribir/)).toBeTruthy();
  });

  it('keeps the draft and shows the error when sending fails', async () => {
    const user = userEvent.setup();
    const { onSend } = setup();
    onSend.mockRejectedValueOnce(new Error('Sin conexión'));
    const input = screen.getByLabelText('Escribe un comentario');
    await user.type(input, 'Hola{Enter}');
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Sin conexión');
    expect((input as HTMLTextAreaElement).value).toBe('Hola');
  });
});
