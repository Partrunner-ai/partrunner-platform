import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { render } from '@testing-library/react';
import { Inbox, Truck } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import * as main from './index';
import * as server from './server';

/**
 * The named exports of React's `react-server` build (React 19.2). A Server
 * Component bundle may import only these from `react`. No hook that holds
 * state, effect or context is in the list.
 */
const REACT_SERVER_EXPORTS = new Set([
  'Children',
  'Fragment',
  'Profiler',
  'StrictMode',
  'Suspense',
  'cache',
  'cloneElement',
  'createElement',
  'createRef',
  'forwardRef',
  'isValidElement',
  'lazy',
  'memo',
  'use',
  'useCallback',
  'useDebugValue',
  'useId',
  'useMemo',
  'version',
]);

const distDir = resolve(process.cwd(), 'dist');

function hasClientDirective(body: string) {
  return /^\s*(['"])use client\1/.test(body);
}

/** Every file of the ESM graph that starts at `entry`, following relative imports. */
function esmGraph(entry: string) {
  const seen = new Map<string, string>();
  const queue = [join(distDir, entry)];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    const body = readFileSync(file, 'utf8');
    seen.set(file, body);
    for (const match of body.matchAll(/(?:import|export)\s[^;]*?from\s*['"](\.[^'"]+)['"]/g)) {
      queue.push(resolve(dirname(file), match[1]!));
    }
  }
  return seen;
}

function reactNamedImports(body: string) {
  const names: string[] = [];
  for (const match of body.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]react['"]/g)) {
    for (const part of match[1]!.split(',')) {
      const name = part.trim().split(/\s+as\s+/)[0];
      if (name) names.push(name);
    }
  }
  return names;
}

describe('server entry: built artifact', () => {
  it('exists (the test task depends on the build)', () => {
    expect(existsSync(join(distDir, 'server.js'))).toBe(true);
    expect(existsSync(join(distDir, 'server.cjs'))).toBe(true);
  });

  it.each(['server.js', 'server.cjs'])('%s has no "use client" directive', (file) => {
    expect(hasClientDirective(readFileSync(join(distDir, file), 'utf8'))).toBe(false);
  });

  it.each(['index.js', 'index.cjs'])('%s still starts with "use client"', (file) => {
    expect(readFileSync(join(distDir, file), 'utf8').startsWith('"use client"')).toBe(true);
  });

  it('imports only server-safe React APIs in its whole ESM graph', () => {
    const graph = esmGraph('server.js');
    const imported = new Set<string>();
    for (const [file, body] of graph) {
      expect(hasClientDirective(body), file).toBe(false);
      for (const name of reactNamedImports(body)) imported.add(name);
    }
    expect(imported.size).toBeGreaterThan(0);
    const unsafe = [...imported].filter((name) => !REACT_SERVER_EXPORTS.has(name));
    expect(unsafe).toEqual([]);
  });

  it('uses no hook that holds state, effect or context in the CJS bundle', () => {
    const body = readFileSync(join(distDir, 'server.cjs'), 'utf8');
    expect(body).not.toMatch(
      /\buse(State|Effect|LayoutEffect|InsertionEffect|Ref|Reducer|Context|SyncExternalStore|Transition|DeferredValue|ImperativeHandle|Optimistic|ActionState)\b/,
    );
    expect(body).not.toMatch(/\bcreateContext\b/);
  });
});

describe('server entry: exports', () => {
  it('exports the server-safe parts and nothing else', () => {
    expect(Object.keys(server).sort()).toEqual(
      [
        'Card',
        'CardContent',
        'CardDescription',
        'CardHeader',
        'CardTitle',
        'EmptyState',
        'Slot',
        'StatTile',
        'StatTileGrid',
      ].sort(),
    );
  });

  it('shares Card, Slot and StatTileGrid with the main entry', () => {
    expect(server.Card).toBe(main.Card);
    expect(server.Slot).toBe(main.Slot);
    expect(server.StatTileGrid).toBe(main.StatTileGrid);
  });

  it('gives StatTile and EmptyState plain function variants', () => {
    expect(typeof server.StatTile).toBe('function');
    expect(typeof server.EmptyState).toBe('function');
    expect(server.StatTile).not.toBe(main.StatTile);
    expect(server.EmptyState).not.toBe(main.EmptyState);
  });
});

describe('server entry: same markup as the main entry', () => {
  it('StatTile with an icon element renders the client tile exactly', () => {
    const props = { label: 'Rutas', value: '1,240', hint: 'Esta semana', tone: 'blue', trendValue: -3, footer: '12 en curso' } as const;
    const fromServer = renderToStaticMarkup(<server.StatTile {...props} icon={<Truck />} />);
    const fromClient = renderToStaticMarkup(<main.StatTile {...props} icon={Truck} />);
    expect(fromServer).toBe(fromClient);
    expect(fromServer).toContain('pr-stat-tile pr-stat-tile--blue');
    expect(fromServer).toContain('stroke-width="2.25"');
  });

  it('StatTile keeps the props an icon element sets itself', () => {
    const { container } = render(<server.StatTile label="x" value={1} icon={<Truck strokeWidth={1.5} />} />);
    expect(container.querySelector('.pr-stat-tile__icon svg')!.getAttribute('stroke-width')).toBe('1.5');
  });

  it('StatTile leaves a raw svg element as the caller wrote it', () => {
    const { container } = render(<server.StatTile label="x" value={1} icon={<svg data-testid="own" />} />);
    const svg = container.querySelector('.pr-stat-tile__icon svg')!;
    expect(svg.getAttribute('data-testid')).toBe('own');
    expect(svg.getAttribute('stroke-width')).toBeNull();
  });

  it('StatTile without an icon has no icon chip', () => {
    const { container } = render(<server.StatTile label="x" value={1} />);
    expect(container.querySelector('.pr-stat-tile__icon')).toBeNull();
  });

  it('EmptyState with an icon element renders the client one exactly', () => {
    const props = { title: 'Sin rutas', description: 'No hay rutas esta semana.', action: <a href="/rutas/nueva">Nueva ruta</a> };
    const fromServer = renderToStaticMarkup(<server.EmptyState {...props} icon={<Inbox />} />);
    const fromClient = renderToStaticMarkup(<main.EmptyState {...props} icon={Inbox} />);
    expect(fromServer).toBe(fromClient);
    expect(fromServer).toContain('width="22"');
  });

  it('Card asChild renders the child with the card classes', () => {
    const html = renderToStaticMarkup(
      <server.Card asChild tone="blue" interactive>
        <a href="/rutas">Rutas</a>
      </server.Card>,
    );
    expect(html).toBe('<a href="/rutas" class="pr-card pr-card--pad-md pr-card--interactive pr-card--blue">Rutas</a>');
  });

  it('StatTileGrid around server tiles uses the grid classes', () => {
    const { container } = render(
      <server.StatTileGrid columns={3}>
        <server.StatTile label="a" value={1} />
      </server.StatTileGrid>,
    );
    expect(container.firstElementChild!.className).toBe('pr-stat-grid pr-stat-grid--cols-3');
  });
});
