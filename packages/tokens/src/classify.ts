/** How a token-key suffix maps into Tailwind namespaces (v3 preset + v4 @theme). */
export type TokenKind =
  | 'color'
  | 'radius'
  | 'font'
  | 'shadow'
  | 'gradient'
  | 'tracking'
  | 'skip';

export function classify(key: string): { kind: TokenKind; name: string } {
  if (key.startsWith('radius-')) return { kind: 'radius', name: `pr-${key.slice('radius-'.length)}` };
  if (key.startsWith('font-')) return { kind: 'font', name: `pr-${key.slice('font-'.length)}` };
  // `shadow-*` by prefix, not by exact key: the fall-through below is `color`, so a
  // new shadow token would otherwise land in Tailwind's colour namespace and give
  // you `bg-pr-shadow-accent`.
  if (key.startsWith('shadow-')) return { kind: 'shadow', name: `pr-${key.slice('shadow-'.length)}` };
  // Glows are box shadows too; without this they fall through to `color` and
  // mint `bg-pr-glow-accent`.
  if (key.startsWith('glow-')) return { kind: 'shadow', name: `pr-${key}` };
  if (key === 'focus-ring') return { kind: 'shadow', name: 'pr-focus' };
  // A gradient is a background image, not a colour — it cannot take an opacity
  // modifier or be used as `text-*`. The noise texture is a background image
  // with a different suffix, so it is named explicitly.
  if (key.endsWith('-gradient') || key === 'noise') return { kind: 'gradient', name: `pr-${key}` };
  // No namespace can hold `sidebar-bg` under both themes: it is a gradient in
  // crystal (invalid as `background-color`) and a hex in nexus (invalid as
  // `background-image`). A utility that works under one theme and silently
  // breaks under the other is worse than none — the shell consumes the
  // variable directly through its `background:` shorthand.
  if (key === 'sidebar-bg') return { kind: 'skip', name: key };
  if (key.startsWith('tracking-'))
    return { kind: 'tracking', name: `pr-${key.slice('tracking-'.length)}` };
  if (key === 'ease') return { kind: 'skip', name: key };
  // A blur radius, consumed directly by ui.css's glass surfaces; no Tailwind
  // namespace worth minting for a single length.
  if (key === 'glass-blur') return { kind: 'skip', name: key };
  // Nav geometry (`nav-item-py`, `nav-icon-size`, `nav-width`…) are lengths the
  // shell's own CSS consumes directly. They have no Tailwind namespace to land
  // in, and the fall-through below is `color` — which would mint nonsense like
  // `bg-pr-nav-item-py`. The one that DOES have a namespace is stated as
  // `radius-nav-item`, so the radius rule above claims it first.
  if (key.startsWith('nav-')) return { kind: 'skip', name: key };
  return { kind: 'color', name: `pr-${key}` };
}
