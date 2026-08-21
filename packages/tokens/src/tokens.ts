/**
 * @partrunner-ai/tokens — semantic design-token source of truth.
 *
 * ONE semantic contract (the `--pr-*` variable suffixes below) consumed by the
 * shell, the primitives, and every app. Two themes ship it:
 *   - `crystal` — Partrunner Crystal v2, the official PartRunner design system
 *                 and the default since 2.0.
 *   - `nexus`   — the pre-2.0 canonical look, kept one cycle as a compatibility
 *                 skin. Deprecated; removed in 3.0. Swapping the visual
 *                 foundation = importing `nexus.css` instead of `crystal.css`;
 *                 zero component edits.
 *
 * `fixed` tokens don't change between light/dark within a theme (brand accent,
 * the yellow sidebar, radii, fonts, motion). `light`/`dark` hold the rotating
 * surfaces/ink/lines/tones. The emitter (emit.ts) turns each into `--pr-<key>`
 * CSS variables; the Tailwind v3 preset + v4 `@theme` reference those vars.
 */

export type ThemeName = 'crystal' | 'nexus';

/** key = CSS variable suffix (`accent` → `--pr-accent`); value = CSS value. */
export type Vars = Record<string, string>;

export interface Theme {
  /** Non-rotating within the theme (emitted into :root, not overridden in dark). */
  fixed: Vars;
  light: Vars;
  dark: Vars;
}

// Tone palette shared shape (bg + fg per semantic tone).
const TONES_LIGHT: Vars = {
  'tone-yellow-bg': 'rgba(253, 210, 56, 0.2)',
  'tone-yellow-fg': '#8a6300',
  'tone-yellow-border': 'rgba(138, 99, 0, 0.35)',
  'tone-blue-bg': 'rgba(59, 130, 246, 0.15)',
  'tone-blue-fg': '#2563eb',
  'tone-blue-border': 'rgba(37, 99, 235, 0.35)',
  'tone-amber-bg': 'rgba(245, 158, 11, 0.15)',
  'tone-amber-fg': '#d97706',
  'tone-amber-border': 'rgba(217, 119, 6, 0.35)',
  'tone-purple-bg': 'rgba(139, 92, 246, 0.15)',
  'tone-purple-fg': '#7c3aed',
  'tone-purple-border': 'rgba(124, 58, 237, 0.35)',
  'tone-green-bg': 'rgba(16, 185, 129, 0.15)',
  'tone-green-fg': '#059669',
  'tone-green-border': 'rgba(5, 150, 105, 0.35)',
  'tone-rose-bg': 'rgba(244, 63, 94, 0.15)',
  'tone-rose-fg': '#e11d48',
  'tone-rose-border': 'rgba(225, 29, 72, 0.35)',
};

const TONES_DARK: Vars = {
  'tone-yellow-fg': '#fdd238',
  'tone-yellow-border': 'rgba(253, 210, 56, 0.45)',
  'tone-blue-fg': '#60a5fa',
  'tone-blue-border': 'rgba(96, 165, 250, 0.45)',
  'tone-amber-fg': '#fbbf24',
  'tone-amber-border': 'rgba(251, 191, 36, 0.45)',
  'tone-purple-fg': '#a78bfa',
  'tone-purple-border': 'rgba(167, 139, 250, 0.45)',
  'tone-green-fg': '#34d399',
  'tone-green-border': 'rgba(52, 211, 153, 0.45)',
  'tone-rose-fg': '#fb7185',
  'tone-rose-border': 'rgba(251, 113, 133, 0.45)',
};

/**
 * Crystal v2 expressive layer, shared verbatim by both themes.
 *
 * The two themes share one palette; what separates them is geometry, sidebar
 * treatment, and easing. So the brand yellow family, the glows, the display
 * tracking, and the noise texture are stated once. Sources: the approved
 * Crystal v2 spec (official-design-system `tokens/tailwind.preset.js` +
 * `styles/partrunner-crystal.css`), values unchanged.
 */
const CRYSTAL_BRAND_FIXED: Vars = {
  // Yellow family beyond the flat accent. `accent-deep` is the darkest step
  // (#d69e00, 2.40:1 on white) — a decorative icon/border accent only; it
  // clears neither 3:1 for graphics nor 4.5:1 for text on light surfaces.
  'accent-hover': '#f5c420',
  'accent-deep': '#d69e00',
  'accent-tint': '#fff6d1',
  'accent-tint-faint': '#fffbeb',
  // Brand glows (yellow-tinted). Fixed across light/dark for the same reason
  // `shadow-accent` is: they are brand, not surface.
  'glow-accent-sm':
    '0 4px 16px -2px rgba(253, 210, 56, 0.35), 0 1px 4px -1px rgba(253, 210, 56, 0.2)',
  'glow-accent':
    '0 8px 32px -4px rgba(253, 210, 56, 0.45), 0 2px 8px -2px rgba(253, 210, 56, 0.3)',
  'glow-accent-lg':
    '0 16px 48px -8px rgba(253, 210, 56, 0.5), 0 4px 12px -2px rgba(253, 210, 56, 0.35)',
  // Display tracking: the package's own titles (card, dialog, sheet) tighten
  // with `tracking-display` in ui.css; consumers reach for the tighter step
  // only on hero-scale type.
  'tracking-display': '-0.022em',
  'tracking-display-tighter': '-0.028em',
  // Glass surfaces blur at one radius everywhere; ui.css consumes this
  // directly (backdrop-filter has no Tailwind namespace worth minting).
  'glass-blur': '24px',
  // Fractal-noise texture for hero/ambient surfaces. A background image, so it
  // classifies alongside the gradients.
  noise:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.04 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
};

const CRYSTAL_SURFACES_LIGHT: Vars = {
  // Five-step neutral shadow scale, slate-tinted (never pure black) per the
  // Crystal v2 spec. `shadow-card`/`shadow-elevated` remain the semantic
  // aliases components already consume.
  'shadow-xs': '0 1px 2px rgba(15, 23, 42, 0.04)',
  'shadow-sm': '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 8px -4px rgba(15, 23, 42, 0.06)',
  'shadow-md': '0 1px 3px rgba(15, 23, 42, 0.04), 0 12px 24px -8px rgba(15, 23, 42, 0.08)',
  'shadow-lg': '0 2px 4px rgba(15, 23, 42, 0.04), 0 20px 48px -12px rgba(15, 23, 42, 0.12)',
  'shadow-xl': '0 4px 6px rgba(15, 23, 42, 0.04), 0 32px 64px -16px rgba(15, 23, 42, 0.16)',
  'shadow-inner-glass': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.6)',
  // Glass: translucent white over the page, readable only with the blur.
  'glass-bg': 'rgba(255, 255, 255, 0.85)',
  'glass-bg-strong': 'rgba(255, 255, 255, 0.95)',
  'glass-bg-soft': 'rgba(255, 255, 255, 0.6)',
  'glass-border': 'rgba(255, 255, 255, 0.8)',
  'glass-border-active': 'rgba(255, 255, 255, 0.9)',
  // Page + tinted-card gradients. Tints stay under 0.4 alpha so the card ink
  // ramp keeps its measured contrast against the white base.
  'surface-gradient': 'linear-gradient(180deg, #fafbfd 0%, #f4f6fb 100%)',
  'card-yellow-gradient':
    'linear-gradient(140deg, rgba(255, 255, 255, 0.96) 0%, rgba(253, 210, 56, 0.18) 100%)',
  'card-amber-gradient':
    'linear-gradient(140deg, rgba(255, 255, 255, 0.96) 0%, rgba(254, 215, 170, 0.35) 100%)',
  'card-blue-gradient':
    'linear-gradient(140deg, rgba(255, 255, 255, 0.96) 0%, rgba(191, 219, 254, 0.35) 100%)',
  'card-purple-gradient':
    'linear-gradient(140deg, rgba(255, 255, 255, 0.96) 0%, rgba(221, 214, 254, 0.35) 100%)',
  'card-green-gradient':
    'linear-gradient(140deg, rgba(255, 255, 255, 0.96) 0%, rgba(187, 247, 208, 0.4) 100%)',
  'card-rose-gradient':
    'linear-gradient(140deg, rgba(255, 255, 255, 0.96) 0%, rgba(254, 205, 211, 0.35) 100%)',
};

const CRYSTAL_SURFACES_DARK: Vars = {
  // Same geometry as the light scale; opacity carries the depth because a
  // slate tint reads as nothing over a dark page.
  'shadow-xs': '0 1px 2px rgba(0, 0, 0, 0.4)',
  'shadow-sm': '0 1px 2px rgba(0, 0, 0, 0.4), 0 4px 8px -4px rgba(0, 0, 0, 0.35)',
  'shadow-md': '0 1px 3px rgba(0, 0, 0, 0.45), 0 12px 24px -8px rgba(0, 0, 0, 0.5)',
  'shadow-lg': '0 2px 4px rgba(0, 0, 0, 0.45), 0 20px 48px -12px rgba(0, 0, 0, 0.6)',
  'shadow-xl': '0 4px 6px rgba(0, 0, 0, 0.5), 0 32px 64px -16px rgba(0, 0, 0, 0.7)',
  'shadow-inner-glass': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.06)',
  'glass-bg': 'rgba(22, 22, 24, 0.85)',
  'glass-bg-strong': 'rgba(22, 22, 24, 0.95)',
  'glass-bg-soft': 'rgba(22, 22, 24, 0.6)',
  'glass-border': 'rgba(255, 255, 255, 0.08)',
  'glass-border-active': 'rgba(255, 255, 255, 0.14)',
  'surface-gradient': 'linear-gradient(180deg, #161618 0%, #0e0e10 100%)',
  'card-yellow-gradient':
    'linear-gradient(140deg, rgba(30, 30, 34, 0.96) 0%, rgba(253, 210, 56, 0.08) 100%)',
  'card-amber-gradient':
    'linear-gradient(140deg, rgba(30, 30, 34, 0.96) 0%, rgba(254, 215, 170, 0.1) 100%)',
  'card-blue-gradient':
    'linear-gradient(140deg, rgba(30, 30, 34, 0.96) 0%, rgba(191, 219, 254, 0.1) 100%)',
  'card-purple-gradient':
    'linear-gradient(140deg, rgba(30, 30, 34, 0.96) 0%, rgba(221, 214, 254, 0.1) 100%)',
  'card-green-gradient':
    'linear-gradient(140deg, rgba(30, 30, 34, 0.96) 0%, rgba(187, 247, 208, 0.1) 100%)',
  'card-rose-gradient':
    'linear-gradient(140deg, rgba(30, 30, 34, 0.96) 0%, rgba(254, 205, 211, 0.1) 100%)',
};

/**
 * THE INK RAMP IS A CONTRACT, NOT A PALETTE.
 *
 * `fg` / `fg-muted` / `fg-faint` are three text levels. Each must clear WCAG AA
 * (4.5:1) against both `bg` and `surface`; `tokens.test.ts` enforces this.
 *
 * If you need something lighter than `fg-faint` for a placeholder or a disabled
 * glyph, add a separate decorative token and say so in its name. Do not lighten
 * these.
 */

/**
 * Partrunner Crystal v2 — the official PartRunner design system, default since
 * 2.0. Colour, radii, shadows, glass, and gradients follow the Crystal v2 spec;
 * typography stays on the approved brand pair (Bebas Neue titles, Barlow body)
 * rather than Crystal v2's Inter — a deliberate hybrid ratified for 2.0.
 */
const crystal: Theme = {
  fixed: {
    ...CRYSTAL_BRAND_FIXED,
    accent: '#fdd238',
    'accent-soft': '#ffe573',
    // Crystal v2 ends its 135° CTA sweep at #f0bc00 and its 165° sidebar sweep
    // at the slightly deeper #ecb800, so the two ramps cannot share an end
    // stop; the sidebar's lives in `sidebar-bg-strong`.
    'accent-strong': '#f0bc00',
    'accent-ink': '#1a1a1a',
    'accent-gradient':
      'linear-gradient(135deg, var(--pr-accent-soft) 0%, var(--pr-accent) 50%, var(--pr-accent-strong) 100%)',
    'accent-soft-gradient':
      'linear-gradient(135deg, var(--pr-accent-tint) 0%, var(--pr-accent-soft) 100%)',
    // The brand fill carries its own elevation: a yellow-tinted glow plus an inset
    // highlight along the top edge, which is what makes it read as raised rather
    // than painted. Fixed across light/dark for the same reason `sidebar-bg` is —
    // it is brand, not surface.
    'shadow-accent':
      '0 8px 24px -4px rgba(253, 210, 56, 0.4), 0 2px 6px -1px rgba(253, 210, 56, 0.25), inset 0 1px 0 0 rgba(255, 255, 255, 0.5)',
    'shadow-accent-lg':
      '0 16px 40px -6px rgba(253, 210, 56, 0.5), 0 4px 12px -2px rgba(253, 210, 56, 0.3), inset 0 1px 0 0 rgba(255, 255, 255, 0.6)',
    // The spec's sidebar sweep: soft → brand → the sidebar's own deep stop.
    'sidebar-bg':
      'linear-gradient(165deg, var(--pr-accent-soft) 0%, var(--pr-accent) 45%, var(--pr-sidebar-bg-strong) 100%)',
    'sidebar-bg-strong': '#ecb800',
    'sidebar-fg': '#1a1a1a',
    'sidebar-fg-muted': 'rgba(26, 26, 26, 0.6)',
    'sidebar-border': 'rgba(26, 26, 26, 0.08)',
    'sidebar-hover-bg': 'rgba(26, 26, 26, 0.08)',
    'sidebar-active-bg': '#1a1a1a',
    'sidebar-active-fg': '#fdd238',
    // Crystal runs roomier than nexus everywhere (10/14/22 radii vs 8/12/16),
    // so its nav follows: a wider rail, taller rows, larger glyphs.
    'nav-width': '256px',
    'nav-rail-width': '72px',
    'nav-item-py': '10px',
    'nav-item-px': '14px',
    'nav-item-gap': '2px',
    'nav-brand-size': '30px',
    'nav-icon-size': '18px',
    'nav-label-size': '14px',
    'nav-section-label-size': '10.5px',
    'nav-child-indent': '20px',
    // Crystal v2's five-step shape scale (10/14/18/22/28). `radius-card` is the
    // 18px card step: surfaces that read as "a card" share it, and it stays
    // separate from `radius-lg` so modals/heroes keep their roomier 22px.
    'radius-sm': '10px',
    'radius-md': '14px',
    'radius-card': '18px',
    'radius-lg': '22px',
    'radius-xl': '28px',
    'radius-nav-item': '12px',
    // Approved brand typography (Identidad de imagen manual): Bebas Neue for
    // display, Barlow for body. The 2.0 hybrid keeps these over Crystal v2's
    // Inter by explicit decision.
    'font-title': "'Bebas Neue', 'Barlow', system-ui, sans-serif",
    'font-body': "'Barlow', 'Inter', system-ui, sans-serif",
    'font-mono': "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
    ease: 'cubic-bezier(0.22, 1, 0.36, 1)',
    'focus-ring': '0 0 0 4px rgba(253, 210, 56, 0.35)',
  },
  light: {
    ...CRYSTAL_SURFACES_LIGHT,
    bg: '#fafbfd',
    surface: '#ffffff',
    elevated: '#ffffff',
    fg: '#1a1a1a',
    'fg-muted': '#4b5563',
    'fg-faint': '#6b7280',
    border: '#e5e7ee',
    'border-strong': '#d1d5db',
    // Scrollbar thumb. Its own token rather than a border alias: a scrollbar wants to sit
    // quieter than a border at rest and firmer under the pointer, and tying it to `border-strong`
    // would move both whenever either is tuned.
    'scrollbar-thumb': 'rgb(26 26 26 / 18%)',
    'scrollbar-thumb-hover': 'rgb(26 26 26 / 32%)',
    danger: '#ef4444',
    'danger-fg': '#1a1612',
    // Deliberate divergence from the Crystal v2 spec, which states the lighter
    // 500 family here (#10b981 / #f59e0b). The shell paints status tokens as
    // `color:` on light surfaces, and those land at 2.54:1 and 2.15:1 on white —
    // under the 3:1 floor for a graphical object, let alone text. Dropping to
    // the 600 family keeps the hue and clears it (3.77 / 3.19). `danger` and
    // `info` already passed, so they stand.
    success: '#059669',
    warning: '#d97706',
    info: '#3b82f6',
    'surface-fg': '#1a1a1a',
    'elevated-fg': '#1a1a1a',
    'success-fg': '#1a1612',
    'warning-fg': '#1a1612',
    'info-fg': '#1a1612',
    'shadow-elevated':
      '0 1px 3px rgba(15, 23, 42, 0.04), 0 12px 24px -8px rgba(15, 23, 42, 0.08)',
    'shadow-card': '0 2px 8px 0 rgba(0, 0, 0, 0.04)',
    ...TONES_LIGHT,
  },
  dark: {
    ...CRYSTAL_SURFACES_DARK,
    bg: '#0e0e10',
    surface: '#161618',
    // Light conveys elevation with `shadow-elevated`, so `elevated` may equal
    // `surface` there. Dark cannot — a shadow over a dark surface reads as
    // nothing — so depth has to come from lightness, and this has to differ.
    elevated: '#1e1e22',
    fg: '#f5f5f4',
    'fg-muted': '#b4b4ba',
    'fg-faint': '#9698a0',
    border: '#2a2a2e',
    'border-strong': '#3a3a3f',
    // Inverted: a dark thumb is invisible on a dark surface, which is exactly what the shell's
    // hardcoded rgb(26 26 26 / 18%) did before these tokens existed.
    'scrollbar-thumb': 'rgb(255 255 255 / 20%)',
    'scrollbar-thumb-hover': 'rgb(255 255 255 / 34%)',
    danger: '#f87171',
    'danger-fg': '#1a1612',
    success: '#34d399',
    warning: '#fbbf24',
    info: '#60a5fa',
    'surface-fg': '#f5f5f4',
    'elevated-fg': '#f5f5f4',
    'success-fg': '#1a1612',
    'warning-fg': '#1a1612',
    'info-fg': '#1a1612',
    'shadow-elevated': '0 10px 20px -4px rgba(0, 0, 0, 0.55), 0 4px 8px -4px rgba(0, 0, 0, 0.5)',
    'shadow-card': '0 2px 8px 0 rgba(0, 0, 0, 0.28)',
    ...TONES_DARK,
  },
};

/**
 * DEPRECATED — the pre-2.0 canonical look, kept one cycle for consumers that
 * cannot restyle on upgrade day. Import `nexus.css` instead of `crystal.css`
 * to keep it. Removed in 3.0; no new adoption.
 */
const nexus: Theme = {
  fixed: {
    ...CRYSTAL_BRAND_FIXED,
    // Brand (fixed across light/dark)
    accent: '#fdd238',
    'accent-soft': '#ffe573',
    'accent-strong': '#f0bc00',
    'accent-ink': '#000000',
    'accent-gradient':
      'linear-gradient(135deg, var(--pr-accent-soft) 0%, var(--pr-accent) 50%, var(--pr-accent-strong) 100%)',
    'accent-soft-gradient':
      'linear-gradient(135deg, var(--pr-accent-tint) 0%, var(--pr-accent-soft) 100%)',
    'shadow-accent':
      '0 8px 24px -4px rgba(253, 210, 56, 0.4), 0 2px 6px -1px rgba(253, 210, 56, 0.25), inset 0 1px 0 0 rgba(255, 255, 255, 0.5)',
    'shadow-accent-lg':
      '0 16px 40px -6px rgba(253, 210, 56, 0.5), 0 4px 12px -2px rgba(253, 210, 56, 0.3), inset 0 1px 0 0 rgba(255, 255, 255, 0.6)',
    // Sidebar — intentionally the fixed brand yellow in both modes. The deep
    // stop exists only for contract parity with crystal's gradient sweep.
    'sidebar-bg': '#fdd238',
    'sidebar-bg-strong': '#ecb800',
    'sidebar-fg': '#000000',
    'sidebar-fg-muted': 'rgba(0, 0, 0, 0.55)',
    'sidebar-border': 'rgba(0, 0, 0, 0.1)',
    'sidebar-hover-bg': 'rgba(0, 0, 0, 0.1)',
    'sidebar-active-bg': '#000000',
    'sidebar-active-fg': '#fdd238',
    // Nav geometry. These are lengths, not colours, so `classify` skips them.
    'nav-width': '244px',
    'nav-rail-width': '68px',
    'nav-item-py': '9px',
    'nav-item-px': '12px',
    'nav-item-gap': '2px',
    'nav-brand-size': '28px',
    'nav-icon-size': '17px',
    'nav-label-size': '13.5px',
    'nav-section-label-size': '10px',
    'nav-child-indent': '18px',
    // Shape. `radius-card` and `radius-xl` restate the values the primitives
    // already rendered under 1.x, so the deprecated skin stays pixel-stable.
    'radius-sm': '0.5rem',
    'radius-md': '0.75rem',
    'radius-card': '0.75rem',
    'radius-lg': '1rem',
    'radius-xl': '1rem',
    // Nav items sit tighter than cards do, so they get their own radius rather
    // than borrowing `radius-md` and dragging card shape along with them.
    'radius-nav-item': '0.625rem',
    // Type
    'font-title': "'Bebas Neue', 'Barlow', system-ui, sans-serif",
    'font-body': "'Barlow', 'Inter', system-ui, sans-serif",
    'font-mono': "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
    // Motion
    ease: 'cubic-bezier(0.16, 1, 0.3, 1)',
    'focus-ring': '0 0 0 4px rgba(253, 210, 56, 0.35)',
  },
  light: {
    ...CRYSTAL_SURFACES_LIGHT,
    bg: '#fafbfd',
    surface: '#ffffff',
    elevated: '#ffffff',
    fg: '#1a1a1a',
    'fg-muted': '#4b5563',
    'fg-faint': '#6b7280',
    border: '#e5e7ee',
    'border-strong': '#d1d5db',
    'scrollbar-thumb': 'rgb(26 26 26 / 18%)',
    'scrollbar-thumb-hover': 'rgb(26 26 26 / 32%)',
    danger: '#ef4444',
    'danger-fg': '#1a1612',
    success: '#059669',
    warning: '#d97706',
    info: '#2563eb',
    'surface-fg': '#1a1a1a',
    'elevated-fg': '#1a1a1a',
    'success-fg': '#1a1612',
    'warning-fg': '#1a1612',
    'info-fg': '#ffffff',
    'shadow-elevated': '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.05)',
    'shadow-card': '0 2px 8px 0 rgba(0, 0, 0, 0.04)',
    ...TONES_LIGHT,
  },
  dark: {
    ...CRYSTAL_SURFACES_DARK,
    bg: '#0e0e10',
    surface: '#161618',
    elevated: '#1e1e22',
    fg: '#f5f5f4',
    'fg-muted': '#b4b4ba',
    'fg-faint': '#9698a0',
    border: '#2a2a2e',
    'border-strong': '#3a3a3f',
    'scrollbar-thumb': 'rgb(255 255 255 / 20%)',
    'scrollbar-thumb-hover': 'rgb(255 255 255 / 34%)',
    danger: '#f87171',
    'danger-fg': '#1a1612',
    success: '#34d399',
    warning: '#fbbf24',
    info: '#60a5fa',
    'surface-fg': '#f5f5f4',
    'elevated-fg': '#f5f5f4',
    'success-fg': '#1a1612',
    'warning-fg': '#1a1612',
    'info-fg': '#1a1612',
    'shadow-elevated': '0 10px 20px -4px rgba(0, 0, 0, 0.55), 0 4px 8px -4px rgba(0, 0, 0, 0.5)',
    'shadow-card': '0 2px 8px 0 rgba(0, 0, 0, 0.28)',
    ...TONES_DARK,
  },
};

export const THEMES: Record<ThemeName, Theme> = { crystal, nexus };

/** Every semantic token suffix (for the Tailwind preset + v4 @theme mapping). */
export const TOKEN_KEYS: string[] = Array.from(
  new Set([
    ...Object.keys(crystal.fixed),
    ...Object.keys(crystal.light),
    ...Object.keys(crystal.dark),
  ]),
);

const PLAIN_HEX = /^#[0-9a-fA-F]{6}$/;

function valueOf(theme: Theme, key: string): string | undefined {
  return theme.fixed[key] ?? theme.light[key] ?? theme.dark[key];
}

/**
 * Keys that can also be emitted as bare `R G B` channels.
 *
 * Tailwind v3 expresses opacity as `rgb(var(--x) / <alpha-value>)`, which needs
 * the channels separately — a finished `#rrggbb` cannot be composed that way.
 * Channel exports preserve alpha utilities in Tailwind v3 consumers.
 *
 * A key qualifies only if EVERY theme states it as a plain 6-digit hex. That
 * excludes `sidebar-bg`, which crystal states as a gradient, and the `rgba()`
 * tokens, which already carry their own alpha and have nothing to compose.
 * Requiring it of every theme keeps the preset identical whichever theme is
 * loaded — otherwise a utility would work under crystal and break under nexus.
 */
export const CHANNEL_KEYS: string[] = TOKEN_KEYS.filter((key) =>
  Object.values(THEMES).every((theme) => {
    const value = valueOf(theme, key);
    return typeof value === 'string' && PLAIN_HEX.test(value);
  }),
);

/** `#1a1612` → `26 22 18`, the form `rgb(… / <alpha-value>)` needs. */
export function toChannels(hex: string): string {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(' ');
}
