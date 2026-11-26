import { createRef } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SplitView } from './SplitView';

describe('SplitView', () => {
  it('renders labelled list and detail regions with defaults', () => {
    const { getByRole, container } = render(
      <SplitView list={<p>lista</p>} detail={<p>detalle</p>} />,
    );
    expect(getByRole('region', { name: 'Lista' }).textContent).toContain('lista');
    expect(getByRole('region', { name: 'Detalle' }).textContent).toContain('detalle');
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('pr-split-view--list-md');
    expect(root.className).toContain('pr-split-view--fill');
    expect(root.hasAttribute('data-detail-open')).toBe(false);
  });

  it('takes custom labels, width and height', () => {
    const { getByRole, container } = render(
      <SplitView
        list={null}
        detail={null}
        listLabel="Conversaciones"
        detailLabel="Chat"
        listWidth="lg"
        height="auto"
      />,
    );
    expect(getByRole('region', { name: 'Conversaciones' })).toBeDefined();
    expect(getByRole('region', { name: 'Chat' })).toBeDefined();
    const cls = (container.firstElementChild as HTMLElement).className;
    expect(cls).toContain('pr-split-view--list-lg');
    expect(cls).toContain('pr-split-view--auto');
  });

  it('keeps the list header outside the scrolling list', () => {
    const { container } = render(
      <SplitView list={<p>l</p>} detail={null} listHeader={<input aria-label="Buscar" />} />,
    );
    const header = container.querySelector('.pr-split-view__list-header');
    expect(header?.querySelector('input')).not.toBeNull();
    expect(container.querySelector('.pr-split-view__list-scroll')?.contains(header!)).toBe(false);
  });

  it('flags detailOpen for narrow screens', () => {
    const { container } = render(<SplitView list={null} detail={null} detailOpen />);
    expect((container.firstElementChild as HTMLElement).hasAttribute('data-detail-open')).toBe(true);
  });

  it('shows the back button only with onBack and calls it', () => {
    const none = render(<SplitView list={null} detail={null} detailOpen />);
    expect(none.queryByRole('button')).toBeNull();
    const onBack = vi.fn();
    const { getByRole, rerender } = render(
      <SplitView list={null} detail={null} detailOpen onBack={onBack} />,
    );
    fireEvent.click(getByRole('button', { name: 'Volver a la lista' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    rerender(<SplitView list={null} detail={null} detailOpen onBack={onBack} backLabel="Back" />);
    expect(getByRole('button', { name: 'Back' })).toBeDefined();
  });

  it('forwards ref, class and rest props', () => {
    const ref = createRef<HTMLDivElement>();
    render(<SplitView ref={ref} list={null} detail={null} className="extra" id="sv" style={{ height: 300 }} />);
    expect(ref.current?.id).toBe('sv');
    expect(ref.current?.className).toContain('extra');
    expect(ref.current?.style.height).toBe('300px');
  });
});
