import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { Card as MainCard, Slot as MainSlot } from './index';
import { Card, Slot } from './server';

describe('server entry (source)', () => {
  it('re-exports the same Card and Slot as the main entry', () => {
    // True of the TS source, which is what these two `import`s resolve to
    // here. It is NOT a claim about the published dist artifacts below —
    // dist/server.cjs inlines its own copy of Card/Slot (a separate esbuild
    // output), so a CJS consumer loading both entries gets two identities.
    // Vanishingly unlikely for Next app code (which is ESM), but real.
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

describe('server entry (built artifact)', () => {
  // The actual contract: dist/server.{js,cjs} must not carry "use client",
  // or a consumer gets no benefit from importing this entry over the main
  // one. `test` depends on `build` in turbo.json, so dist/ exists here.
  // vitest runs with cwd at the package root (packages/ui).
  const distDir = resolve(process.cwd(), 'dist');

  it.each(['server.js', 'server.cjs'])('%s does not start with "use client"', async (file) => {
    const body = await readFile(`${distDir}/${file}`, 'utf8');
    expect(body.startsWith('"use client"')).toBe(false);
    expect(body.startsWith("'use client'")).toBe(false);
  });

  it.each(['index.js', 'index.cjs'])('%s still starts with "use client" (no regression)', async (file) => {
    const body = await readFile(`${distDir}/${file}`, 'utf8');
    expect(body.startsWith('"use client"')).toBe(true);
  });
});
