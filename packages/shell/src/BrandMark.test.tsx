import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BrandMark } from './BrandMark';

describe('BrandMark', () => {
  it('takes its ink from currentColor, not a baked fill', () => {
    // Inheriting ink prevents a low-contrast baked fill on the brand surface.
    const { container } = render(<BrandMark />);
    const path = container.querySelector('path');
    expect(path?.getAttribute('fill')).toBe('currentColor');
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 889 839');
  });

  it('sizes from the nav token so apps stop picking their own', () => {
    const { container } = render(<BrandMark />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('var(--pr-nav-brand-size, 28px)');
    expect(svg?.getAttribute('height')).toBe('var(--pr-nav-brand-size, 28px)');
  });

  it('accepts an explicit size for one-off surfaces', () => {
    const { container } = render(<BrandMark size={40} />);
    expect(container.querySelector('svg')?.getAttribute('width')).toBe('40');
  });

  it('is decorative unless given a title', () => {
    const { container } = render(<BrandMark />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('role')).toBeNull();
    expect(svg.querySelector('title')).toBeNull();
  });

  it('becomes an image with an accessible name when titled', () => {
    const { container } = render(<BrandMark title="Partrunner" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Partrunner');
    expect(svg.getAttribute('aria-hidden')).toBeNull();
    expect(svg.querySelector('title')?.textContent).toBe('Partrunner');
  });

  it('keeps the package class when a consumer adds its own', () => {
    const { container } = render(<BrandMark className="extra" />);
    expect(container.querySelector('svg')?.getAttribute('class')).toBe('pr-brand-mark extra');
  });
});
