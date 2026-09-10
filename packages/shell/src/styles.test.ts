import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '../styles/shell.css'), 'utf8');

describe('the mobile global-header contract', () => {
  it('keeps the host start slot available for the documented SidebarTrigger composition', () => {
    const mobileRules = css.slice(css.indexOf('@media (max-width: 720px)'));

    expect(mobileRules).not.toMatch(
      /\.pr-global-header__start\s*\{[^}]*display:\s*none;/,
    );
  });
});

describe('the drill navigation icon contract', () => {
  it('uses one balanced stroke weight in both light and dark mode', () => {
    expect(css).toMatch(
      /\.pr-drill__tile-icon > svg\s*\{[^}]*stroke-width:\s*2;/,
    );
    expect(css).not.toMatch(
      /(?:\.dark|\[data-theme=['"]dark['"]\])[^{}]*\.pr-drill__tile-icon > svg/,
    );
  });
});

describe('the notification count contract', () => {
  it('uses white copy on a locally darkened danger fill', () => {
    const rule = css.slice(css.indexOf('.pr-badge-dot {'));
    const body = rule.slice(0, rule.indexOf('}'));

    expect(body).toContain(
      'background: color-mix(in srgb, var(--pr-danger) 75%, black);',
    );
    expect(body).toContain('color: #fff;');
    expect(body).not.toContain('color: var(--pr-danger-fg);');
  });
});

describe('the notification bell contract', () => {
  it('repeats forever instead of firing once', () => {
    // Una animación finita sólo se re-dispara quitando y devolviendo la clase.
    // Con el encabezado a la vista y el conteo pasando de 2 a 3 la clase no se
    // mueve, así que ese aviso sería mudo.
    const rule = css.slice(
      css.indexOf(".pr-notifications__bell[data-ringing='true'] {"),
    );

    expect(rule.slice(0, rule.indexOf('}'))).toMatch(
      /animation:\s*pr-bell-ring\s+\d+s\s+[^;]*\binfinite\b/,
    );
  });

  it('spends most of the cycle at rest, so repeating never becomes nagging', () => {
    // Lo que hace tolerable repetir para siempre es que el reposo viva DENTRO
    // del keyframe: un repique corto al principio y silencio hasta el final.
    // Se afirma esa forma, no el texto: mover la sacudida al 90% dejaría la
    // campana temblando casi sin pausa y tiene que romper esta prueba.
    const frames = css.slice(css.indexOf('@keyframes pr-bell-ring {'));
    const body = frames.slice(0, frames.indexOf('\n}'));
    const stops = [...body.matchAll(/(\d+(?:\.\d+)?)%/g)]
      .map((match) => Number(match[1]))
      .filter((stop) => stop > 0 && stop < 100);

    expect(stops.length).toBeGreaterThan(2);
    expect(Math.max(...stops)).toBeLessThanOrEqual(15);
  });

  it('swings from the top instead of spinning about the glyph centre', () => {
    const rule = css.slice(css.indexOf('.pr-notifications__bell {'));
    const body = rule.slice(0, rule.indexOf('}'));

    expect(body).toContain('transform-origin: 50% 4px;');
    expect(body).not.toContain('transform-origin: center;');
  });

  it('drops the motion but keeps the count when motion is unwelcome', () => {
    const query = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));

    expect(query).toContain(".pr-notifications__bell[data-ringing='true']");
    // El badge lleva la información; silenciarlo también dejaría a esa persona
    // sin saber que tiene algo.
    expect(query).not.toContain('.pr-badge-dot');
  });
});

describe('the brand mark contract', () => {
  it('sets no colour of its own, so it inherits whatever surface it sits on', () => {
    // Pinning `.pr-brand-mark` to `--pr-sidebar-fg` made <BrandMark/> unusable
    // outside the yellow sidebar — on a login screen it has to take that
    // surface's ink. Inside the sidebar `.pr-sidebar__brand` still supplies it.
    const rule = css.slice(css.indexOf('.pr-brand-mark {'));
    expect(rule.slice(0, rule.indexOf('}'))).not.toContain('color:');
    expect(css).toMatch(/\.pr-sidebar__brand\s*\{[^}]*color:\s*var\(--pr-sidebar-fg\)/);
  });

  it('hides a section hint in the collapsed rail', () => {
    expect(css).toMatch(
      /\[data-collapsed='true'\]\s*\.pr-nav__section-description\s*\{[^}]*display:\s*none/,
    );
  });
});
