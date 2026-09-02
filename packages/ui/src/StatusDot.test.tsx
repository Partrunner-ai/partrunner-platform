import { createRef } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusDot } from './StatusDot';

describe('StatusDot', () => {
  it('is decorative beside visible text by default', () => {
    const { container } = render(<StatusDot tone="green" />);
    const dot = container.querySelector('.pr-status-dot')!;
    expect(dot.getAttribute('aria-hidden')).toBe('true');
    expect(dot.getAttribute('role')).toBeNull();
    expect(dot.className).toContain('pr-status-dot--green');
    expect(dot.className).toContain('pr-status-dot--sm');
  });

  it('becomes a named image when it stands alone', () => {
    const { getByRole } = render(<StatusDot tone="danger" label="Vencida" size="md" />);
    const dot = getByRole('img', { name: 'Vencida' });
    expect(dot.getAttribute('aria-hidden')).toBeNull();
    expect(dot.className).toContain('pr-status-dot--md');
  });

  it('forwards its ref, class and rest props to the span', () => {
    const ref = createRef<HTMLSpanElement>();
    const { container } = render(
      <StatusDot ref={ref} tone="blue" className="extra" data-testid="dot" />,
    );
    expect(ref.current).toBe(container.querySelector('[data-testid="dot"]'));
    expect(ref.current?.tagName).toBe('SPAN');
    expect(ref.current?.className).toContain('extra');
  });
});
