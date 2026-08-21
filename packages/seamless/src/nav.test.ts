import { describe, expect, it } from 'vitest';
import { buildNavManifest, isNavManifest } from './nav';

const section = {
  id: 'operations',
  name: 'Operaciones',
  icon: 'Truck',
  accent: 'yellow' as const,
  description: 'Trabajo operativo',
  items: [{ name: 'Rutas', href: '/rutas', icon: 'Map' }],
};

describe('navigation manifests', () => {
  it('pins the contract version and supplies an empty top level', () => {
    expect(buildNavManifest({ app: 'supply', sections: [section] })).toEqual({
      version: 1,
      app: 'supply',
      baseUrl: undefined,
      topLevel: [],
      sections: [section],
    });
  });

  it('recognizes the network shape and rejects incompatible payloads', () => {
    const manifest = buildNavManifest({ app: 'supply', sections: [section] });
    expect(isNavManifest(manifest)).toBe(true);
    expect(isNavManifest({ ...manifest, version: 2 })).toBe(false);
    expect(isNavManifest({ version: 1, app: 'supply', sections: null })).toBe(false);
    expect(isNavManifest(null)).toBe(false);
  });
});
