import { describe, expect, it } from 'vitest';
import { TINT_TONES, toneFromString } from './tone';

describe('toneFromString', () => {
  it('is stable for the same seed and only ever returns a tint', () => {
    for (const seed of ['Ana Operadora', 'Mercado Libre', 'Coppel', '', '9101']) {
      const tone = toneFromString(seed);
      expect(tone).toBe(toneFromString(seed));
      expect(TINT_TONES).toContain(tone);
    }
  });

  it('keeps its published mapping: a change here recolours every avatar in the fleet', () => {
    expect(toneFromString('Ana Operadora')).toBe('yellow');
    expect(toneFromString('Carlos Ruta')).toBe('rose');
    expect(toneFromString('María Logística')).toBe('yellow');
    expect(toneFromString('Mercado Libre')).toBe('yellow');
    expect(toneFromString('')).toBe('blue');
  });

  it('spreads common names across the palette instead of piling onto one tone', () => {
    const tones = new Set(
      ['Ana', 'Carlos', 'María', 'Luis', 'Daniela', 'José', 'Fernando', 'Andrea', 'Sofía'].map(
        (name) => toneFromString(name),
      ),
    );
    expect(tones.size).toBeGreaterThanOrEqual(4);
  });

  it('honours a caller palette and never returns a semantic tone', () => {
    expect(toneFromString('anything', ['green'])).toBe('green');
    expect(toneFromString('anything', [])).toBe('blue');
  });
});
