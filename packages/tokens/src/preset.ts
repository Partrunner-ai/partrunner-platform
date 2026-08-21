import { classify } from './classify';
import { CHANNEL_KEYS, TOKEN_KEYS } from './tokens';

/**
 * Tailwind **v3** preset. Consumers add it to `presets: [preset]` in their
 * tailwind.config, then use `bg-pr-surface`, `text-pr-fg`, `rounded-pr-md`,
 * `shadow-pr-elevated`, `font-pr-body`, etc. Every value points at a `--pr-*`
 * CSS variable, so the active theme (crystal.css / nexus.css) drives the color.
 */
const colors: Record<string, string> = {};
const borderRadius: Record<string, string> = {};
const boxShadow: Record<string, string> = {};
const fontFamily: Record<string, string> = {};
const backgroundImage: Record<string, string> = {};
const letterSpacing: Record<string, string> = {};

for (const key of TOKEN_KEYS) {
  const cssVar = `var(--pr-${key})`;
  const { kind, name } = classify(key);
  if (kind === 'color') colors[name] = cssVar;
  else if (kind === 'radius') borderRadius[name] = cssVar;
  else if (kind === 'shadow') boxShadow[name] = cssVar;
  else if (kind === 'font') fontFamily[name] = cssVar;
  else if (kind === 'gradient') backgroundImage[name] = cssVar;
  else if (kind === 'tracking') letterSpacing[name] = cssVar;
}

export const preset = {
  theme: {
    extend: { colors, borderRadius, boxShadow, fontFamily, backgroundImage, letterSpacing },
  },
} as const;

/**
 * Same preset, but colours resolve through the channels companion so Tailwind's
 * opacity modifiers work — `bg-pr-surface/50`, `text-pr-fg/70`.
 *
 * v3 can only express opacity as `rgb(var(--x) / <alpha-value>)`, which needs the
 * channels stated separately; a finished `#rrggbb` cannot be composed that way.
 * Channel exports preserve those alpha utilities for Tailwind v3 consumers.
 *
 * Requires BOTH stylesheets:
 *
 *   @import '@partrunner-ai/tokens/crystal.css';
 *   @import '@partrunner-ai/tokens/crystal-channels.css';
 *
 * Colours outside `CHANNEL_KEYS` — the `rgba()` tokens and crystal's gradient
 * sidebar — keep pointing at `--pr-*` directly. They already carry their own
 * alpha or are not a single colour, so an opacity modifier on them is meaningless
 * rather than merely unsupported.
 */
const channelColors: Record<string, string> = {};

for (const key of TOKEN_KEYS) {
  const { kind, name } = classify(key);
  if (kind !== 'color') continue;
  channelColors[name] = CHANNEL_KEYS.includes(key)
    ? `rgb(var(--pr-ch-${key}) / <alpha-value>)`
    : `var(--pr-${key})`;
}

export const channelsPreset = {
  theme: {
    extend: {
      colors: channelColors,
      borderRadius,
      boxShadow,
      fontFamily,
      backgroundImage,
      letterSpacing,
    },
  },
} as const;

export default preset;
