import { describe, expect, it } from 'vitest';
import { THEMES, TOKEN_KEYS, type Theme, type ThemeName } from './tokens';

const AA_TEXT = 4.5;

function channels(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** The three ink levels are all text, so all three owe us AA on both surfaces. */
const INK = ['fg', 'fg-muted', 'fg-faint'] as const;
const BACKDROPS = ['bg', 'surface'] as const;

const MODES: ReadonlyArray<['light' | 'dark', (t: Theme) => Record<string, string>]> = [
  ['light', (t) => t.light],
  ['dark', (t) => t.dark],
];

describe.each(Object.keys(THEMES) as ThemeName[])('%s', (name) => {
  const theme = THEMES[name];

  describe.each(MODES)('%s', (_mode, pick) => {
    const vars = pick(theme);

    it.each(INK)('%s is legible on every backdrop', (ink) => {
      for (const backdrop of BACKDROPS) {
        const ratio = contrast(vars[ink]!, vars[backdrop]!);
        expect(
          ratio,
          `${ink} (${vars[ink]}) on ${backdrop} (${vars[backdrop]}) is ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(AA_TEXT);
      }
    });

    it('separates the three surfaces enough to stack', () => {
      const [bg, surface, elevated] = (['bg', 'surface', 'elevated'] as const).map(
        (k) => vars[k]!,
      );
      expect(surface, 'surface must lift off the page').not.toBe(bg);
      if (_mode === 'dark') {
        // Light can lean on `shadow-elevated`; a shadow over a dark surface reads
        // as nothing, so in dark the only cue left is lightness.
        expect(elevated, 'dark elevation has to come from lightness').not.toBe(surface);
      }
    });

    it('keeps the ink levels ordered and distinct', () => {
      const [fg, muted, faint] = INK.map((k) => contrast(vars[k]!, vars.bg!));
      expect(fg).toBeGreaterThan(muted!);
      expect(muted).toBeGreaterThan(faint!);
      // Levels that read the same are not a hierarchy; apps collapse them.
      expect(muted! - faint!).toBeGreaterThan(1);
    });

    // shadcn-shaped apps pair every surface with its ink. A pair that does not
    // read is worse than no pair, because a component will trust it blindly.
    it.each([
      ['surface', 'surface-fg'],
      ['elevated', 'elevated-fg'],
      ['danger', 'danger-fg'],
      ['success', 'success-fg'],
      ['warning', 'warning-fg'],
      ['info', 'info-fg'],
    ])('%s carries an ink that reads on it', (surface, ink) => {
      const ratio = contrast(vars[ink]!, vars[surface]!);
      expect(
        ratio,
        `${ink} (${vars[ink]}) on ${surface} (${vars[surface]}) is ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(AA_TEXT);
    });

    // The shell paints these as `color:` (see `.pr-*` rules using --pr-danger
    // and --pr-info), so they are graphical objects at minimum: 3:1, per WCAG
    // 1.4.11. Not 4.5:1 — these are accents and badges, not body copy, and
    // holding them to text contrast would force the whole palette darker.
    it('states read against the surface they sit on', () => {
      for (const state of ['danger', 'success', 'warning', 'info'] as const) {
        const ratio = contrast(vars[state]!, vars.surface!);
        expect(ratio, `${state} (${vars[state]}) on surface`).toBeGreaterThanOrEqual(3);
      }
    });

    it('provides a theme-aware matched border for every card tone', () => {
      for (const tone of ['yellow', 'blue', 'amber', 'purple', 'green', 'rose'] as const) {
        expect(vars[`tone-${tone}-border`], `${tone} border in ${_mode}`).toMatch(/^rgba\(/);
      }
    });
  });

  it('defines a value for every key the emitter will emit', () => {
    const defined = new Set([
      ...Object.keys(theme.fixed),
      ...Object.keys(theme.light),
    ]);
    for (const key of TOKEN_KEYS) {
      expect(defined.has(key), `${name} is missing "${key}"`).toBe(true);
    }
  });
});

describe('the accent, which is fixed across modes', () => {
  it.each(Object.keys(THEMES) as ThemeName[])('%s pairs accent with legible ink', (name) => {
    const theme = THEMES[name];
    const accent = theme.fixed.accent!;
    // A gradient sidebar has no single colour to measure; the flat accent does.
    expect(contrast(theme.fixed['accent-ink']!, accent)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('uses the exact approved yellow in canonical brand surfaces', () => {
    const crystal = THEMES.crystal.fixed;
    expect(crystal.accent).toBe('#fdd238');
    expect(crystal['accent-ink']).toBe('#1a1a1a');
    // The Crystal v2 sidebar is a gradient; every stop must stay inside the
    // approved yellow family (soft #ffe573 / brand #fdd238 / deep #ecb800).
    expect(crystal['sidebar-bg']).toContain('var(--pr-accent-soft)');
    expect(crystal['sidebar-bg']).toContain('var(--pr-accent)');
    expect(crystal['sidebar-bg']).toContain('var(--pr-sidebar-bg-strong)');
    expect(crystal['sidebar-bg-strong']).toBe('#ecb800');
    expect(crystal['sidebar-active-fg']).toBe('#fdd238');
  });

  it('keeps the deprecated nexus skin on its published values', () => {
    expect(THEMES.nexus.fixed.accent).toBe('#fdd238');
    expect(THEMES.nexus.fixed['sidebar-bg']).toBe('#fdd238');
    expect(THEMES.nexus.fixed['sidebar-active-bg']).toBe('#000000');
  });
});

describe('PartRunner typography', () => {
  it('keeps the canonical package theme on the approved brand fonts', () => {
    // The 2.0 hybrid: Crystal v2 surfaces, Identidad-de-imagen typography.
    expect(THEMES.crystal.fixed['font-title']).toContain('Bebas Neue');
    expect(THEMES.crystal.fixed['font-body']).toContain('Barlow');
  });
});
