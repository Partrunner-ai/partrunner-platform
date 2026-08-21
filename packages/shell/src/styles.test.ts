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
