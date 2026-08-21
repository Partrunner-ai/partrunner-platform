import { describe, expect, it } from 'vitest';
import { channelsPreset, preset } from './preset';
import { CHANNEL_KEYS, THEMES, toChannels } from './tokens';

describe('toChannels', () => {
  it('states a hex as the bare channels Tailwind v3 needs', () => {
    expect(toChannels('#1a1612')).toBe('26 22 18');
    expect(toChannels('#ffffff')).toBe('255 255 255');
  });
});

describe('CHANNEL_KEYS', () => {
  it('covers the plain colours', () => {
    for (const key of ['bg', 'surface', 'elevated', 'fg', 'border', 'danger', 'accent']) {
      expect(CHANNEL_KEYS, key).toContain(key);
    }
  });

  it('excludes anything a theme does not state as a plain hex', () => {
    // crystal states sidebar-bg as a gradient, so channelising it would make the
    // preset work under nexus and break under crystal.
    expect(CHANNEL_KEYS).not.toContain('sidebar-bg');
    // These already carry their own alpha — there is nothing to compose.
    expect(CHANNEL_KEYS).not.toContain('sidebar-border');
    expect(CHANNEL_KEYS).not.toContain('tone-blue-bg');
    // Not colours at all.
    expect(CHANNEL_KEYS).not.toContain('radius-md');
    expect(CHANNEL_KEYS).not.toContain('shadow-elevated');
  });

  it('holds for every theme, not just the default', () => {
    for (const [name, theme] of Object.entries(THEMES)) {
      for (const key of CHANNEL_KEYS) {
        const value = theme.fixed[key] ?? theme.light[key] ?? theme.dark[key];
        expect(value, `${name}.${key}`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });
});

describe('the v3 presets', () => {
  it('maps colours to the variables in the plain preset', () => {
    expect(preset.theme.extend.colors['pr-surface']).toBe('var(--pr-surface)');
  });

  it('routes channelisable colours through rgb() so opacity modifiers work', () => {
    // This is the whole point: `bg-pr-surface/50` is impossible against a
    // finished #rrggbb.
    expect(channelsPreset.theme.extend.colors['pr-surface']).toBe(
      'rgb(var(--pr-ch-surface) / <alpha-value>)',
    );
    expect(channelsPreset.theme.extend.colors['pr-fg']).toBe(
      'rgb(var(--pr-ch-fg) / <alpha-value>)',
    );
  });

  it('leaves non-channelisable colours pointing at the variable directly', () => {
    expect(channelsPreset.theme.extend.colors['pr-tone-blue-bg']).toBe('var(--pr-tone-blue-bg)');
  });

  it('mints no utility at all for sidebar-bg', () => {
    // A gradient under crystal and a hex under nexus: no Tailwind namespace can
    // hold both, and a utility that breaks under one theme is worse than none.
    // The shell consumes the variable directly via its `background:` shorthand.
    for (const p of [preset, channelsPreset]) {
      expect(p.theme.extend.colors).not.toHaveProperty('pr-sidebar-bg');
      expect(p.theme.extend.backgroundImage).not.toHaveProperty('pr-sidebar-bg');
    }
  });

  it('keeps shape and type identical between the two presets', () => {
    expect(channelsPreset.theme.extend.borderRadius).toEqual(preset.theme.extend.borderRadius);
    expect(channelsPreset.theme.extend.boxShadow).toEqual(preset.theme.extend.boxShadow);
    expect(channelsPreset.theme.extend.fontFamily).toEqual(preset.theme.extend.fontFamily);
  });

  it('offers the same colour names in both, so switching cannot lose a utility', () => {
    expect(Object.keys(channelsPreset.theme.extend.colors).sort()).toEqual(
      Object.keys(preset.theme.extend.colors).sort(),
    );
  });
});

describe('the brand gradient', () => {
  it('is a background image in both presets, not a colour', () => {
    for (const p of [preset, channelsPreset]) {
      expect(p.theme.extend.backgroundImage['pr-accent-gradient']).toBe(
        'var(--pr-accent-gradient)',
      );
      // A gradient in `colors` would let you write `text-pr-accent-gradient` and
      // `bg-pr-accent-gradient/50`, neither of which can work.
      expect(p.theme.extend.colors).not.toHaveProperty('pr-accent-gradient');
    }
  });

  it('puts the accent shadows in boxShadow, where the old shadow-elevated went', () => {
    expect(preset.theme.extend.boxShadow['pr-accent']).toBe('var(--pr-shadow-accent)');
    expect(preset.theme.extend.boxShadow['pr-accent-lg']).toBe('var(--pr-shadow-accent-lg)');
    // Classification is by `shadow-` prefix now; before it was one exact key, so a
    // second shadow token silently became a colour.
    expect(preset.theme.extend.boxShadow['pr-elevated']).toBe('var(--pr-shadow-elevated)');
    expect(preset.theme.extend.colors).not.toHaveProperty('pr-shadow-accent');
  });

  it('exposes the light stop as an ordinary colour, channels included', () => {
    expect(preset.theme.extend.colors['pr-accent-soft']).toBe('var(--pr-accent-soft)');
    expect(CHANNEL_KEYS).toContain('accent-soft');
    expect(CHANNEL_KEYS).not.toContain('accent-gradient');
    expect(CHANNEL_KEYS).not.toContain('shadow-accent');
  });

  it('composes from the three brand stops rather than repeating literals', () => {
    for (const theme of Object.values(THEMES)) {
      const gradient = theme.fixed['accent-gradient'];
      expect(gradient).toContain('var(--pr-accent-soft)');
      expect(gradient).toContain('var(--pr-accent)');
      expect(gradient).toContain('var(--pr-accent-strong)');
      expect(gradient).not.toMatch(/#[0-9a-f]{3,8}/i);
    }
  });

  it("stops crystal's sidebar from carrying its own copy of the same ramp", () => {
    // It was `linear-gradient(165deg, #ffe573 0%, #fdd238 45%, #ecb800 100%)` — the
    // same three stops as the button, written out again.
    expect(THEMES.crystal.fixed['sidebar-bg']).not.toMatch(/#[0-9a-f]{3,8}/i);
    expect(THEMES.crystal.fixed['sidebar-bg']).toContain('var(--pr-accent-soft)');
  });
});
