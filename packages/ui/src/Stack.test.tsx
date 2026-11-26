import { createRef } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Stack } from './Stack';

describe('Stack', () => {
  it('is a column with the lg gap by default and no inline style', () => {
    const { container } = render(<Stack>a</Stack>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.tagName).toBe('DIV');
    expect(el.className).toBe('pr-stack pr-stack--gap-lg');
    expect(el.getAttribute('style')).toBeNull();
  });

  it('takes direction, gap, align, justify and wrap as classes', () => {
    const { container } = render(
      <Stack direction="row" gap="xs" align="baseline" justify="between" wrap className="x">
        a
      </Stack>,
    );
    const cls = (container.firstElementChild as HTMLElement).className;
    for (const name of [
      'pr-stack--row',
      'pr-stack--gap-xs',
      'pr-stack--align-baseline',
      'pr-stack--justify-between',
      'pr-stack--wrap',
      'x',
    ]) {
      expect(cls).toContain(name);
    }
  });

  it('renders the child with asChild and keeps its attributes', () => {
    const { container } = render(
      <Stack asChild gap="sm">
        <ul aria-label="Lista">
          <li>a</li>
        </ul>
      </Stack>,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.tagName).toBe('UL');
    expect(el.className).toContain('pr-stack--gap-sm');
    expect(el.getAttribute('aria-label')).toBe('Lista');
  });

  it('forwards the ref and div attributes', () => {
    const ref = createRef<HTMLDivElement>();
    const { getByTestId } = render(
      <Stack ref={ref} data-testid="s">
        a
      </Stack>,
    );
    expect(ref.current).toBe(getByTestId('s'));
  });
});
