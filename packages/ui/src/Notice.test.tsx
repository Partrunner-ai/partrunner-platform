import { createRef } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Notice } from './Notice';

describe('Notice', () => {
  it('defaults to the info tone with role status and a tone icon', () => {
    const { getByRole, container } = render(<Notice>Texto</Notice>);
    const notice = getByRole('status');
    expect(notice.className).toContain('pr-notice--info');
    expect(notice.className).toContain('pr-notice--md');
    expect(container.querySelector('.pr-notice__icon svg')).not.toBeNull();
  });

  it('uses role alert for danger and lets a caller role win', () => {
    const danger = render(<Notice tone="danger">Falló</Notice>);
    expect(danger.getByRole('alert')).toBeDefined();
    const custom = render(<Notice tone="danger" role="note">Nota</Notice>);
    expect(custom.getByRole('note')).toBeDefined();
  });

  it('renders title, body and actions, and omits empty parts', () => {
    const { container, getByRole } = render(
      <Notice tone="warning" title="Semana cerrada" actions={<button type="button">Reabrir</button>}>
        Los cambios se aplican en la próxima semana.
      </Notice>,
    );
    expect(container.querySelector('.pr-notice__title')?.textContent).toBe('Semana cerrada');
    expect(container.querySelector('.pr-notice__text')?.textContent).toContain('próxima semana');
    expect(getByRole('button', { name: 'Reabrir' })).toBeDefined();

    const bare = render(<Notice>Solo texto</Notice>);
    expect(bare.container.querySelector('.pr-notice__title')).toBeNull();
    expect(bare.container.querySelector('.pr-notice__actions')).toBeNull();
    expect(bare.container.querySelector('.pr-notice__dismiss')).toBeNull();
  });

  it('hides the icon with icon={false} and swaps it for a node', () => {
    const hidden = render(<Notice icon={false}>x</Notice>);
    expect(hidden.container.querySelector('.pr-notice__icon')).toBeNull();
    const custom = render(<Notice icon={<span data-testid="mine" />}>x</Notice>);
    expect(custom.getByTestId('mine')).toBeDefined();
  });

  it('shows a labelled dismiss button that calls onDismiss', () => {
    const onDismiss = vi.fn();
    const { getByRole, rerender } = render(<Notice onDismiss={onDismiss}>x</Notice>);
    fireEvent.click(getByRole('button', { name: 'Cerrar aviso' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    rerender(<Notice onDismiss={onDismiss} dismissLabel="Dismiss">x</Notice>);
    expect(getByRole('button', { name: 'Dismiss' })).toBeDefined();
  });

  it('forwards its ref, class and rest props', () => {
    const ref = createRef<HTMLDivElement>();
    render(<Notice ref={ref} size="sm" className="extra" id="n1">x</Notice>);
    expect(ref.current?.id).toBe('n1');
    expect(ref.current?.className).toContain('extra');
    expect(ref.current?.className).toContain('pr-notice--sm');
  });
});
