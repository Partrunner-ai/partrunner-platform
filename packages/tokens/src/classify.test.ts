import { describe, expect, it } from 'vitest';
import { classify } from './classify';
import { TOKEN_KEYS } from './tokens';

describe('classify', () => {
  it('routes by prefix so a new token cannot fall through to colour', () => {
    expect(classify('shadow-accent')).toEqual({ kind: 'shadow', name: 'pr-accent' });
    expect(classify('shadow-elevated')).toEqual({ kind: 'shadow', name: 'pr-elevated' });
    expect(classify('accent-gradient')).toEqual({ kind: 'gradient', name: 'pr-accent-gradient' });
    expect(classify('radius-md')).toEqual({ kind: 'radius', name: 'pr-md' });
    expect(classify('font-body')).toEqual({ kind: 'font', name: 'pr-body' });
    expect(classify('surface')).toEqual({ kind: 'color', name: 'pr-surface' });
    // Nav geometry is a length with no Tailwind namespace; only its radius has
    // one, and states itself as `radius-*` so the radius rule claims it.
    expect(classify('nav-item-py')).toEqual({ kind: 'skip', name: 'nav-item-py' });
    expect(classify('nav-icon-size')).toEqual({ kind: 'skip', name: 'nav-icon-size' });
    expect(classify('radius-nav-item')).toEqual({ kind: 'radius', name: 'pr-nav-item' });
  });

  it('never classifies a non-colour value as a colour', () => {
    for (const key of TOKEN_KEYS) {
      const { kind } = classify(key);
      if (kind !== 'color') continue;
      // Colours must be usable as `text-*` and with an opacity modifier, which
      // rules out shadows, gradients and bare durations.
      expect(key.startsWith('shadow-')).toBe(false);
      expect(key.endsWith('-gradient')).toBe(false);
      expect(key.startsWith('nav-')).toBe(false);
    }
  });
});
