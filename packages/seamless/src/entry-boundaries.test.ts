import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (file: string) =>
  readFileSync(join(__dirname, file), 'utf8');

describe('package entry boundaries', () => {
  it('keeps root and React source graphs away from the server entry', () => {
    const browserSources = [
      source('core.ts'),
      source('index.ts'),
      source('react.tsx'),
    ].join('\n');

    expect(browserSources).not.toMatch(/from ['"]\.\/server['"]/);
    expect(browserSources).not.toMatch(/from ['"]jose['"]/);
    expect(browserSources).not.toContain('process.env');
    expect(browserSources).not.toContain('UNIFIED_JWT_SECRET');
  });

  it('keeps the server graph on the framework-free URL entry', () => {
    const serverSource = source('server.ts');
    expect(serverSource).toContain(
      "from '@partrunner-ai/app-registry/url'",
    );
    expect(serverSource).not.toMatch(
      /from ['"]@partrunner-ai\/app-registry['"]/,
    );
  });

  it('keeps transition artwork self-contained', () => {
    const reactSource = source('react.tsx');
    expect(reactSource).toContain('function TransitionMark()');
    expect(reactSource).not.toMatch(/<img\b/);
    expect(reactSource).not.toMatch(/https?:\/\//);
  });

  it('publishes the server seam as an explicit subpath', () => {
    const manifest = JSON.parse(
      readFileSync(join(__dirname, '../package.json'), 'utf8'),
    ) as {
      exports?: Record<
        string,
        {
          import?: { types?: string; default?: string };
          require?: { types?: string; default?: string };
        }
      >;
    };

    expect(manifest.exports?.['./server']).toBeTruthy();
    for (const entry of ['.', './react', './server', './next']) {
      expect(manifest.exports?.[entry]?.import?.types).toMatch(/\.d\.ts$/);
      expect(manifest.exports?.[entry]?.import?.default).toMatch(/\.js$/);
      expect(manifest.exports?.[entry]?.require?.types).toMatch(/\.d\.cts$/);
      expect(manifest.exports?.[entry]?.require?.default).toMatch(/\.cjs$/);
    }
  });
});
