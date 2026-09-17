import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { Card as MainCard, Slot as MainSlot } from './index';
import { Card, Slot } from './server';

describe('server entry', () => {
  it('re-exports the same Card and Slot as the main entry', () => {
    // Same component, not a fork — a consumer switching entries must not
    // change behavior, only whether the bundle carries "use client".
    expect(Card).toBe(MainCard);
    expect(Slot).toBe(MainSlot);
  });

  it('renders a Card with asChild through the server entry', () => {
    render(createElement(Card, { asChild: true }, createElement('a', { href: '/x' }, 'go')));
    const link = screen.getByText('go');
    expect(link.tagName).toBe('A');
    expect(link.className).toContain('pr-card');
  });
});
