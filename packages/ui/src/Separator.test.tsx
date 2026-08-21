import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Separator } from './Separator';

describe('Separator', () => {
  it('is decoration by default, so a toolbar of rules is not announced', () => {
    const { container } = render(<Separator />);
    const rule = container.firstElementChild!;

    expect(rule.getAttribute('role')).toBe('none');
    expect(rule.getAttribute('aria-orientation')).toBeNull();
    expect(rule.className).toContain('pr-separator--horizontal');
    expect(screen.queryByRole('separator')).toBeNull();
  });

  it('takes the accessible role only when the split is structural', () => {
    render(<Separator decorative={false} orientation="vertical" />);
    const rule = screen.getByRole('separator');

    expect(rule.getAttribute('aria-orientation')).toBe('vertical');
    expect(rule.className).toContain('pr-separator--vertical');
  });

  it('keeps the orientation on a data attribute for consumer selectors', () => {
    const { container } = render(<Separator orientation="vertical" className="my-2" />);
    const rule = container.firstElementChild!;

    expect(rule.getAttribute('data-orientation')).toBe('vertical');
    expect(rule.className).toContain('my-2');
  });
});
