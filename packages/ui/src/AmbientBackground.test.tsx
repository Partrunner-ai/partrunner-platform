import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AmbientBackground } from './AmbientBackground';

describe('AmbientBackground', () => {
  it('is invisible to assistive tech', () => {
    const { container } = render(<AmbientBackground />);
    const root = container.firstElementChild!;
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.className).toContain('pr-ambient');
  });

  it('renders both glows', () => {
    const { container } = render(<AmbientBackground />);
    expect(container.querySelector('.pr-ambient__glow--warm')).not.toBeNull();
    expect(container.querySelector('.pr-ambient__glow--cool')).not.toBeNull();
  });

  it('escalates for the login variant', () => {
    const { container } = render(<AmbientBackground variant="login" />);
    expect(container.firstElementChild!.className).toContain('pr-ambient--login');
  });
});
