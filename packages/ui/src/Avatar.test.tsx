import { createRef } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar, avatarInitials } from './Avatar';
import { toneFromString } from './tone';

describe('avatarInitials', () => {
  it('takes the first letter of the first two words, upper-cased', () => {
    expect(avatarInitials('ana operadora')).toBe('AO');
    expect(avatarInitials('  María   Logística Sur ')).toBe('ML');
    expect(avatarInitials('Cher')).toBe('C');
    expect(avatarInitials('')).toBe('');
  });

  it('upper-cases for the given locale', () => {
    expect(avatarInitials('ilknur işık', 'tr')).toBe('İİ');
    expect(avatarInitials('ilknur işık', 'en')).toBe('II');
  });
});

describe('Avatar', () => {
  it('is a named image whose initials are decoration', () => {
    const { getByRole } = render(<Avatar name="Ana Operadora" />);
    const avatar = getByRole('img', { name: 'Ana Operadora' });
    const initials = avatar.querySelector('.pr-avatar__initials')!;
    expect(initials.textContent).toBe('AO');
    expect(initials.getAttribute('aria-hidden')).toBe('true');
  });

  it('hashes a stable tint from the name and accepts an explicit tone', () => {
    const { container } = render(<Avatar name="Ana Operadora" />);
    expect(container.querySelector('.pr-avatar')?.className).toContain(
      `pr-avatar--${toneFromString('Ana Operadora')}`,
    );
    const { container: explicit } = render(<Avatar name="Ana Operadora" tone="green" size="lg" />);
    const root = explicit.querySelector('.pr-avatar')!;
    expect(root.className).toContain('pr-avatar--green');
    expect(root.className).toContain('pr-avatar--lg');
  });

  it('shows the photo and falls back to initials when it fails to load', () => {
    const { container } = render(<Avatar name="Ana Operadora" src="/ana.png" />);
    const image = container.querySelector('img.pr-avatar__image')!;
    expect(image.getAttribute('alt')).toBe('');
    expect(container.querySelector('.pr-avatar__initials')).toBeNull();
    fireEvent.error(image);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.pr-avatar__initials')?.textContent).toBe('AO');
  });

  it('can be decorative when the name is already visible beside it', () => {
    const { container } = render(<Avatar name="Ana Operadora" decorative />);
    const root = container.querySelector('.pr-avatar')!;
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.getAttribute('role')).toBeNull();
    expect(root.getAttribute('aria-label')).toBeNull();
  });

  it('keeps its naming contract when rest props try to override it', () => {
    const { container } = render(
      <Avatar name="Ana Operadora" role="button" aria-label="otro" aria-hidden />,
    );
    const root = container.querySelector('.pr-avatar')!;
    expect(root.getAttribute('role')).toBe('img');
    expect(root.getAttribute('aria-label')).toBe('Ana Operadora');
    expect(root.getAttribute('aria-hidden')).toBeNull();

    const decorative = render(<Avatar name="Ana" decorative role="img" aria-label="otro" />);
    const hidden = decorative.container.querySelector('.pr-avatar')!;
    expect(hidden.getAttribute('aria-hidden')).toBe('true');
    expect(hidden.getAttribute('role')).toBeNull();
    expect(hidden.getAttribute('aria-label')).toBeNull();
  });

  it('forwards its ref, class and rest props', () => {
    const ref = createRef<HTMLSpanElement>();
    render(<Avatar ref={ref} name="Ana" className="extra" data-testid="avatar" />);
    expect(ref.current?.tagName).toBe('SPAN');
    expect(ref.current?.className).toContain('extra');
    expect(ref.current?.getAttribute('data-testid')).toBe('avatar');
  });
});
