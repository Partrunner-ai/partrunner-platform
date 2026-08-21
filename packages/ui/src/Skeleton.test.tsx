import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('hides a single placeholder from assistive technology', () => {
    const { container } = render(<Skeleton width={120} height={16} />);
    const box = container.firstElementChild as HTMLElement;

    expect(box.getAttribute('aria-hidden')).toBe('true');
    expect(box.className).toContain('pr-skeleton--block');
    expect(box.style.width).toBe('120px');
    expect(box.style.height).toBe('16px');
  });

  it('announces a group of lines once instead of reading out every empty box', () => {
    render(<Skeleton shape="text" lines={4} />);
    const group = screen.getByRole('status');

    expect(group.getAttribute('aria-busy')).toBe('true');
    expect(group.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(4);
    // Every individual bar stays hidden — the live region speaks for all of them.
    for (const line of group.querySelectorAll('[data-slot="skeleton"]')) {
      expect(line.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('shortens the last line of a paragraph so it reads as text, not as bars', () => {
    render(<Skeleton shape="text" lines={3} />);
    const lines = Array.from(
      screen.getByRole('status').querySelectorAll('[data-slot="skeleton"]'),
    );

    expect(lines.map((line) => line.hasAttribute('data-last'))).toEqual([false, false, true]);
  });

  it('does not shorten the last of a stack of blocks', () => {
    render(<Skeleton lines={3} />);
    const lines = Array.from(
      screen.getByRole('status').querySelectorAll('[data-slot="skeleton"]'),
    );

    // `data-last` is a text affordance; a column of cards should stay uniform.
    expect(lines.map((line) => line.hasAttribute('data-last'))).toEqual([false, false, false]);
  });

  it('accepts a string length and the circle shape for an avatar placeholder', () => {
    const { container } = render(<Skeleton shape="circle" width="2.5rem" />);
    const box = container.firstElementChild as HTMLElement;

    expect(box.className).toContain('pr-skeleton--circle');
    expect(box.style.width).toBe('2.5rem');
  });
});
