import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Check } from 'lucide-react';
import { Badge, type BadgeTone } from './Badge';

const TONES: BadgeTone[] = [
  'neutral',
  'yellow',
  'blue',
  'amber',
  'purple',
  'green',
  'rose',
  'danger',
  'success',
  'warning',
  'info',
];

describe('Badge', () => {
  it('defaults to the neutral tone', () => {
    render(<Badge>12</Badge>);
    expect(screen.getByText('12').className).toContain('pr-badge--neutral');
  });

  it.each(TONES)('has a class for the %s tone', (tone) => {
    render(<Badge tone={tone}>x</Badge>);
    expect(screen.getByText('x').className).toContain(`pr-badge--${tone}`);
  });

  it('marks solid separately so the tint stays the default', () => {
    render(
      <Badge tone="danger" solid>
        Vencida
      </Badge>,
    );
    const badge = screen.getByText('Vencida');
    expect(badge.className).toContain('pr-badge--danger');
    expect(badge.className).toContain('pr-badge--solid');
  });

  it('hides the decorative icon from assistive tech', () => {
    const Dot = (props: Record<string, unknown>) => <svg data-testid="dot" {...props} />;
    render(<Badge icon={Dot as never}>Activo</Badge>);
    expect(screen.getByTestId('dot').getAttribute('aria-hidden')).toBe('true');
  });
});

describe('Badge compatibility states', () => {
  it('defaults to the established medium size', () => {
    const { container } = render(<Badge>Activo</Badge>);
    expect(container.firstElementChild!.className).toContain('pr-badge--md');
  });

  it('offers two compact size steps', () => {
    for (const size of ['xs', 'sm'] as const) {
      const { container, unmount } = render(<Badge size={size}>x</Badge>);
      expect(container.firstElementChild!.className).toContain(`pr-badge--${size}`);
      unmount();
    }
  });

  it('renders a dot that is decorative, not announced', () => {
    const { container } = render(<Badge dot>3 pendientes</Badge>);
    const dot = container.querySelector('.pr-badge__dot')!;
    expect(dot).not.toBeNull();
    // It repeats what the text already says, so a screen reader should skip it.
    expect(dot.getAttribute('aria-hidden')).toBe('true');
    expect(container.firstElementChild!.textContent).toBe('3 pendientes');
  });

  it('lets solid win over outline, since a fill has no border to tint', () => {
    const { container } = render(
      <Badge solid outline tone="danger">
        x
      </Badge>,
    );
    const cls = container.firstElementChild!.className;
    expect(cls).toContain('pr-badge--solid');
    expect(cls).not.toContain('pr-badge--outline');
  });

  it('applies outline on its own', () => {
    const { container } = render(
      <Badge outline tone="blue">
        x
      </Badge>,
    );
    expect(container.firstElementChild!.className).toContain('pr-badge--outline');
  });

  it('shrinks the icon with the badge', () => {
    const { container } = render(
      <Badge size="xs" icon={Check}>
        ok
      </Badge>,
    );
    expect(container.querySelector('svg')!.getAttribute('width')).toBe('10');
  });
});
