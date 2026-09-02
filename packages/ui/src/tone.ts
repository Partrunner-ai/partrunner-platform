/**
 * The six tinted tones — the palette `Badge`, `Card`, `StatTile` and the launcher
 * tiles share through the `--pr-tone-*` pairs. Semantic tones (`danger`, `success`,
 * `warning`, `info`) and `neutral` are not tints: they carry meaning, so a colour
 * picked for an entity must never land on one of them.
 */
export type TintTone = 'yellow' | 'blue' | 'amber' | 'purple' | 'green' | 'rose';

export const TINT_TONES: readonly TintTone[] = [
  'yellow',
  'blue',
  'amber',
  'purple',
  'green',
  'rose',
];

/**
 * A stable tint for an entity (a client, a project, a person), so the same seed
 * gets the same colour in every table and card of every app.
 *
 * FNV-1a over the UTF-16 code units. The hash is part of the public contract: a
 * change here recolours every avatar in the fleet, which is a major.
 */
export function toneFromString(
  seed: string,
  palette: readonly TintTone[] = TINT_TONES,
): TintTone {
  if (palette.length === 0) return 'blue';
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    // 32-bit FNV prime multiply, kept in integer range with Math.imul.
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return palette[hash % palette.length] ?? palette[0]!;
}
