import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';
import postcssImport from 'postcss-import';
import tailwindcss from 'tailwindcss';
import { describe, expect, it } from 'vitest';

/** The stylesheet is a public interface that jsdom does not load. */
const css = readFileSync(join(__dirname, '../styles/ui.css'), 'utf8');
const lightCss = readFileSync(join(__dirname, '../styles/light.css'), 'utf8');
const themeCss = readFileSync(join(__dirname, '../styles/theme.css'), 'utf8');

const PUBLIC_COMPONENT_SELECTORS = [
  '.pr-btn',
  '.pr-badge',
  '.pr-card',
  '.pr-dialog__panel',
  '.pr-alert-dialog__panel',
  '.pr-sheet__panel',
  '.pr-input',
  '.pr-file-dropzone',
  '.pr-textarea',
  '.pr-choice',
  '.pr-choice-group',
  '.pr-validation-summary',
  '.pr-select__control',
  '.pr-rich-select__trigger',
  '.pr-calendar',
  '.pr-date-picker__trigger',
  '.pr-empty',
  '.pr-spinner',
  '.pr-combobox__trigger',
  '.pr-multiselect__trigger',
  '.pr-tabs__list',
  '.pr-navigation-tabs__list',
  '.pr-table__shell',
  '.pr-table__caption',
  '.pr-menu__content',
  '.pr-menu__item',
  '.pr-popover__content',
  '.pr-pagination',
  '.pr-separator',
  '.pr-skeleton',
  '.pr-tooltip',
] as const;

describe('the published cascade contract', () => {
  it('offers one ordered light-mode import for fonts, tokens, and components', () => {
    expect(lightCss).not.toContain('@import');
    expect(lightCss).not.toContain('.dark {');
    expect(lightCss.indexOf("font-family: 'Barlow'")).toBeLessThan(
      lightCss.indexOf('--pr-accent: #fdd238'),
    );
    expect(lightCss.indexOf('--pr-accent: #fdd238')).toBeLessThan(lightCss.indexOf('.pr-btn'));
  });

  it('offers one ordered adaptive import while keeping light mode as the default', () => {
    expect(themeCss).not.toContain('@import');
    expect(themeCss).toContain(':root {');
    expect(themeCss).toContain('--pr-bg: #fafbfd');
    expect(themeCss).toContain('.dark {');
    expect(themeCss).toContain('--pr-bg: #0e0e10');
    expect(themeCss.indexOf("font-family: 'Barlow'")).toBeLessThan(
      themeCss.indexOf('--pr-bg: #fafbfd'),
    );
    expect(themeCss.indexOf('--pr-bg: #fafbfd')).toBeLessThan(themeCss.indexOf('.dark {'));
    expect(themeCss.indexOf('.dark {')).toBeLessThan(themeCss.indexOf('.pr-btn'));
  });

  it('keeps every public component styled through a Tailwind v3 consumer build', async () => {
    const consumerEntry = join(__dirname, 'tailwind-v3-consumer.css');
    const result = await postcss([
      postcssImport(),
      tailwindcss({
        content: [{ raw: '<div class="px-2"></div>', extension: 'html' }],
      }),
    ]).process(
      [
        '@import "../styles/light.css";',
        '@tailwind base;',
        '@tailwind components;',
        '@tailwind utilities;',
      ].join('\n'),
      { from: consumerEntry },
    );

    const selectors = new Set<string>();
    postcss.parse(result.css).walkRules((candidate) => {
      for (const selector of candidate.selectors) selectors.add(selector);
    });

    for (const selector of PUBLIC_COMPONENT_SELECTORS) {
      expect(selectors, `missing ${selector}`).toContain(selector);
    }
    expect(result.css).toContain("font-family: 'Barlow'");
    expect(result.css).toContain('--pr-accent: #fdd238');
  });

  it('keeps the adaptive theme and every public component through a Tailwind v3 build', async () => {
    const consumerEntry = join(__dirname, 'tailwind-v3-adaptive-consumer.css');
    const result = await postcss([
      postcssImport(),
      tailwindcss({
        content: [{ raw: '<html class="dark"><div class="px-2"></div></html>', extension: 'html' }],
      }),
    ]).process(
      [
        '@import "../styles/theme.css";',
        '@tailwind base;',
        '@tailwind components;',
        '@tailwind utilities;',
      ].join('\n'),
      { from: consumerEntry },
    );

    const selectors = new Set<string>();
    postcss.parse(result.css).walkRules((candidate) => {
      for (const selector of candidate.selectors) selectors.add(selector);
    });

    for (const selector of PUBLIC_COMPONENT_SELECTORS) {
      expect(selectors, `missing ${selector}`).toContain(selector);
    }
    expect(result.css).toContain('.dark');
    expect(result.css).toContain('--pr-bg: #0e0e10');
  });

  it('does not leak unscoped element rules into a consumer', () => {
    postcss.parse(css).walkRules((candidate) => {
      if (candidate.parent?.type === 'atrule' && candidate.parent.name.endsWith('keyframes')) return;
      for (const selector of candidate.selectors) {
        expect(
          selector.includes('.pr-') || selector.includes("[class^='pr-']"),
          `unscoped selector: ${selector}`,
        ).toBe(true);
      }
    });
  });

  it('never watches every CSS property for changes', () => {
    postcss.parse(css).walkDecls(/^transition/, (declaration) => {
      expect(declaration.value, `${declaration.prop}: ${declaration.value}`).not.toMatch(
        /(^|[,\s])all([,\s]|$)/,
      );
    });
  });
});

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  const body = match?.[1];
  if (body === undefined) throw new Error(`no rule for ${selector}`);
  return body;
}

function exactRule(selector: string): string {
  let body: string | undefined;
  postcss.parse(css).walkRules((candidate) => {
    if (candidate.selector === selector) body = candidate.toString();
  });
  if (body === undefined) throw new Error(`no exact rule for ${selector}`);
  return body;
}

describe('the card header type scale', () => {
  it('contains positioned children inside the card', () => {
    expect(rule('.pr-card')).toContain('position: relative');
  });

  it('keeps the shared hierarchy stable during adoption', () => {
    expect(rule('.pr-card__title')).toContain('font-size: 16px');
    expect(rule('.pr-card__description')).toContain('font-size: 14px');
  });
});

describe('the card adoption surfaces', () => {
  it('builds glass from the glass tokens and blurs at half the chrome amount', () => {
    const glass = rule('.pr-card--glass');
    expect(glass).toContain('background: var(--pr-glass-bg)');
    expect(glass).toContain('border-color: var(--pr-glass-border)');
    expect(glass).toContain('backdrop-filter: blur(calc(var(--pr-glass-blur, 24px) / 2)) saturate(120%)');
  });

  it('uses a semantic matched border without changing the borderless tone default', () => {
    expect(exactRule('.pr-card--rose')).toContain('border-color: transparent');
    expect(exactRule('.pr-card--tone-border.pr-card--rose')).toContain(
      'border-color: var(--pr-tone-rose-border)',
    );
    expect(themeCss).toContain('--pr-tone-rose-border: rgba(225, 29, 72, 0.35)');
    expect(themeCss).toContain('--pr-tone-rose-border: rgba(251, 113, 133, 0.45)');
  });
});

describe('the bare input', () => {
  it('carries the border itself, not on a wrapper', () => {
    // `.pr-field__input` is transparent and borderless by design — the composite
    // field draws the box. A bare input has no wrapper to draw it, so if these
    // declarations ever leave `.pr-input` it renders invisible.
    const bare = rule('.pr-field__control,\n.pr-input');
    expect(bare).toContain('background: var(--pr-surface)');
    expect(bare).toContain('border: 1px solid var(--pr-border)');
  });
});

describe('the primary button', () => {
  it('carries the Crystal v2 CTA sweep over the approved flat fallback', () => {
    // Since 2.0 the brand sweep IS the official primary treatment. The flat
    // accent stays as `background` underneath, so an engine that cannot paint
    // the gradient still shows the approved yellow.
    const primary = rule('.pr-btn--primary');
    expect(primary).toContain('background: var(--pr-accent)');
    expect(primary).toContain('background-image: var(--pr-accent-gradient)');
    expect(primary).toContain('box-shadow: var(--pr-shadow-accent)');
  });

  it('uses the canonical 0.96 tactile press scale and supports a static opt-out', () => {
    expect(
      rule(".pr-btn:not(.pr-btn--static):active:not(:disabled):not([aria-disabled='true'])"),
    ).toContain('transform: scale(0.96)');
  });

  it('keeps every size at a real 40px minimum interaction target', () => {
    expect(rule('.pr-btn')).toContain('min-height: 40px');
    expect(rule('.pr-btn--icon')).toContain('width: 40px');
  });
});

describe('the dropdown menu trigger', () => {
  it('keeps the package typeface on raw triggers without painting composed children', () => {
    const trigger = rule('.pr-menu__trigger--raw');
    expect(trigger).toContain('font: inherit');
    expect(trigger).toContain('font-family: var(--pr-font-body, inherit)');
    expect(css).not.toContain(':where(.pr-menu__trigger)');
  });
});

describe('the popover trigger', () => {
  /**
   * The same contract as the menu trigger, and stated separately because it was missed
   * when that one was fixed: two rules with identical bodies, one corrected. An app
   * carried a local repair for this one until now.
   */
  it('keeps the package typeface on raw triggers without painting composed children', () => {
    const trigger = rule('.pr-popover__trigger--raw');
    expect(trigger).toContain('font: inherit');
    expect(trigger).toContain('font-family: var(--pr-font-body, inherit)');
    expect(css).not.toContain(':where(.pr-popover__trigger)');
  });
});

describe('form control targets', () => {
  it('keeps compact native controls and menu actions at least 40px tall', () => {
    expect(rule('.pr-field__control--sm, .pr-input--sm')).toContain('height: 40px');
    expect(rule('.pr-select__control--sm')).toContain('height: 40px');
    expect(rule('.pr-rich-select__trigger--sm,\n.pr-rich-select__trigger--md')).toContain(
      'min-height: 40px',
    );
    expect(rule('.pr-rich-select__item')).toContain('min-height: 40px');
    expect(rule('.pr-calendar__nav,\n.pr-calendar__action')).toContain('min-height: 40px');
    expect(rule('.pr-calendar__day,\n.pr-calendar__day-placeholder')).toContain(
      'min-height: 40px',
    );
    expect(rule('.pr-date-picker__trigger--sm,\n.pr-date-picker__trigger--md')).toContain(
      'min-height: 40px',
    );
    expect(rule('.pr-combobox__clear')).toContain('width: 40px');
    expect(rule('.pr-multiselect__chip-remove')).toContain('width: 40px');
    expect(rule('.pr-combobox__option')).toContain('min-height: 40px');
    expect(rule('.pr-multiselect__option')).toContain('min-height: 40px');
    expect(rule('.pr-choice')).toContain('min-height: 40px');
    expect(rule('.pr-validation-summary__link')).toContain('min-height: 40px');
    expect(rule('.pr-menu__item')).toContain('min-height: 40px');
    expect(rule('.pr-navigation-tabs__link')).toContain('min-height: 40px');
  });

  it('keeps dialog and sheet dismiss controls at least 40px square', () => {
    expect(rule('.pr-dialog__close')).toContain('height: 40px');
    expect(rule('.pr-dialog__close')).toContain('width: 40px');
    expect(rule('.pr-sheet__close')).toContain('height: 40px');
    expect(rule('.pr-sheet__close')).toContain('width: 40px');
  });

  it('keeps the 2.0 primitives on the same 40px floor', () => {
    expect(rule('.pr-stepper__dot')).toContain('width: 40px');
    expect(rule('.pr-stepper__dot')).toContain('height: 40px');
    expect(rule('.pr-copy-field__button')).toContain('width: 40px');
    expect(rule('.pr-copy-field__button')).toContain('height: 40px');
  });
});

describe('route navigation tabs', () => {
  it('uses semantic warm tokens without a gradient or glow', () => {
    const active = rule(".pr-navigation-tabs__link[data-state='active']");
    expect(active).toContain('var(--pr-surface)');
    expect(active).toContain('var(--pr-tone-yellow-bg)');
    expect(active).not.toContain('gradient');
    expect(active).not.toContain('box-shadow');
    expect(rule('.pr-navigation-tabs__link::after')).toContain(
      'background: var(--pr-accent-strong)',
    );
  });

  it('keeps the route list horizontally scrollable on narrow screens', () => {
    expect(rule('.pr-navigation-tabs__list')).toContain('overflow-x: auto');
    expect(rule('.pr-navigation-tabs__item')).toContain('flex: 0 0 auto');
  });
});

describe('pagination', () => {
  it('keeps controls touch-sized and changing range values stable', () => {
    expect(rule('.pr-pagination__controls .pr-btn')).toContain('min-width: 40px');
    expect(rule('.pr-pagination__summary')).toContain(
      'font-variant-numeric: tabular-nums',
    );
  });

  it('uses icon-only narrow controls without removing their accessible labels', () => {
    expect(css).toContain('@media (max-width: 479px)');
    expect(rule('.pr-pagination__button-label')).toContain('display: none');
  });
});

describe('the MultiSelect filter contract', () => {
  it('uses semantic active tokens and a stable toolbar summary', () => {
    const active = rule('.pr-multiselect--filter .pr-multiselect__trigger--active');
    expect(active).toContain('background: var(--pr-tone-yellow-bg)');
    expect(active).toContain('border-color: var(--pr-tone-yellow-border)');
    expect(rule('.pr-multiselect__summary')).toContain('font-variant-numeric: tabular-nums');
  });

  it('keeps the filter menu usable when its compact trigger is narrow', () => {
    expect(rule('.pr-multiselect__menu--filter')).toContain('min-width: 192px');
  });
});

describe('modal surfaces', () => {
  it('keeps sheets token-driven and responsive without app CSS', () => {
    const sheet = rule('.pr-sheet__panel');
    expect(sheet).toContain('background: var(--pr-elevated)');
    expect(sheet).toContain('color: var(--pr-fg)');
    expect(rule(".pr-sheet__panel[data-width='lg']")).toContain('560px');
  });

  it('honors reduced-motion preferences for every animated surface', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('.pr-dialog__panel--compound,\n  .pr-sheet__panel { animation: none; }');
  });
});

describe('tabs', () => {
  it('keeps every trigger at a 40px interaction target', () => {
    expect(rule('.pr-tabs__trigger')).toContain('min-height: 40px');
  });

  it('uses semantic surfaces and an exact interruptible transition list', () => {
    expect(rule('.pr-tabs__list--default')).toContain('background: var(--pr-surface)');
    expect(rule(".pr-tabs__list--default .pr-tabs__trigger[data-state='active']")).toContain(
      'background: var(--pr-elevated)',
    );
    expect(rule('.pr-tabs__trigger')).not.toContain('transition: all');
  });

  it('turns a vertical tablist into a horizontally scrollable control on mobile', () => {
    expect(css).toContain('@media (max-width: 639px)');
    expect(css).toContain('.pr-tabs--vertical .pr-tabs__list');
    expect(css).toContain('overflow-x: auto');
    expect(css).toContain('box-shadow: inset 0 -1px 0 var(--pr-border)');
    expect(css).toContain('transform: scaleX(1)');
  });
});

describe('the table', () => {
  it('pins its sticky first column against an opaque background', () => {
    // A sticky cell with a transparent background is worse than no sticky cell:
    // the columns scrolling underneath show through the one you pinned.
    expect(rule('.pr-table--sticky-first .pr-table__td:first-child')).toContain(
      'background: var(--pr-surface)',
    );
  });

  it('gives an end-aligned column tabular figures', () => {
    // A money column that changes width as the numbers change is unreadable on a
    // dashboard that polls.
    expect(rule('.pr-table__cell--end')).toContain('font-variant-numeric: tabular-nums');
  });

  it('styles compound captions and footers entirely through semantic tokens', () => {
    expect(rule('.pr-table__scroll--compound')).toContain('background: var(--pr-surface)');
    expect(rule('.pr-table__scroll--compound')).toContain(
      'box-shadow: inset 0 0 0 1px var(--pr-border)',
    );
    expect(rule('.pr-table__caption')).toContain('color: var(--pr-fg-muted)');
    expect(rule('.pr-table__footer')).toContain('border-top: 1px solid var(--pr-border)');
    expect(rule('.pr-table__footer')).toContain('color-mix(in srgb, var(--pr-border)');
  });

  it('distinguishes selected and expanded rows without a consumer repair selector', () => {
    expect(
      rule(".pr-table__row[data-state='selected'] .pr-table__td,\n.pr-table__row[aria-expanded='true'] .pr-table__td"),
    ).toContain('background: var(--pr-tone-yellow-bg)');
    expect(
      rule(
        ".pr-table--sticky-first .pr-table__row[data-state='selected'] .pr-table__td:first-child,\n.pr-table--sticky-first .pr-table__row[aria-expanded='true'] .pr-table__td:first-child",
      ),
    ).toContain('background: var(--pr-tone-yellow-bg)');
  });
});

describe('the rich select', () => {
  it('owns its trigger, portal, and option states through semantic tokens', () => {
    expect(rule('.pr-rich-select__trigger')).toContain('background: var(--pr-surface)');
    expect(rule('.pr-rich-select__content')).toContain('background: var(--pr-elevated)');
    expect(rule('.pr-rich-select__content')).toContain('var(--pr-shadow-elevated)');
    expect(rule('.pr-rich-select__item[hidden]')).toContain('display: none');
    expect(rule('.pr-rich-select__item[data-highlighted],\n.pr-rich-select__item:hover:not([data-disabled])')).toContain(
      'background: var(--pr-surface)',
    );
  });

  it('keeps nested menu radii concentric and transitions only changed properties', () => {
    expect(rule('.pr-rich-select__content')).toContain('var(--pr-radius-md');
    expect(rule('.pr-rich-select__item')).toContain('var(--pr-radius-sm');
    expect(rule('.pr-rich-select__trigger')).toContain(
      'transition-property: border-color, box-shadow',
    );
    expect(rule('.pr-rich-select__trigger')).not.toContain('transition: all');
  });
});

describe('the calendar and date picker', () => {
  it('owns inline and portal surfaces through semantic tokens', () => {
    expect(rule('.pr-calendar')).toContain('background: var(--pr-surface)');
    expect(rule('.pr-calendar')).toContain('border: 1px solid var(--pr-border)');
    expect(rule('.pr-date-picker__trigger')).toContain('background: var(--pr-surface)');
    expect(rule('.pr-date-picker__content')).toContain('background: var(--pr-elevated)');
    expect(rule('.pr-date-picker__content')).toContain('var(--pr-shadow-elevated)');
    expect(rule('.pr-calendar[data-mode=\'single\'] .pr-calendar__day[data-selected],\n.pr-calendar__day[data-range-start],\n.pr-calendar__day[data-range-end]')).toContain(
      'background: var(--pr-accent)',
    );
  });

  it('uses concentric radii and transitions only changed properties', () => {
    expect(rule('.pr-calendar')).toContain('var(--pr-radius-lg');
    expect(rule('.pr-calendar__day,\n.pr-calendar__day-placeholder')).toContain(
      'var(--pr-radius-sm',
    );
    expect(rule('.pr-date-picker__trigger')).toContain(
      'transition-property: border-color, box-shadow',
    );
    expect(rule('.pr-calendar__day')).toContain(
      'transition-property: background-color, color, box-shadow',
    );
    expect(rule('.pr-date-picker__trigger')).not.toContain('transition: all');
  });
});

describe('the field radius', () => {
  it('keeps fields on the medium radius step', () => {
    expect(rule('.pr-field__control,\n.pr-input')).toContain('var(--pr-radius-md');
    expect(rule('.pr-select__control')).toContain('var(--pr-radius-md');
  });

  it('puts buttons on the field step and leaves chips on radius-sm', () => {
    // The Crystal v2 spec puts buttons on the same 14px step as inputs; chips
    // stay one step below.
    expect(rule('.pr-btn')).toContain('var(--pr-radius-md');
    expect(rule('.pr-multiselect__chip')).toContain('var(--pr-radius-sm');
  });

  it('keeps cards on the card step and modals on the top of the scale', () => {
    expect(rule('.pr-card')).toContain('var(--pr-radius-card');
    expect(rule('.pr-dialog__panel')).toContain('var(--pr-radius-xl');
  });
});

describe('brand typography in compact UI', () => {
  it('keeps the sub-24px card and dialog titles on Barlow, not the display face', () => {
    expect(rule('.pr-card__title')).toContain('font-family: var(--pr-font-body, inherit)');
    expect(rule('.pr-dialog__title')).toContain('font-family: var(--pr-font-body, inherit)');
  });

  it('keeps body descriptions at the 14px digital floor', () => {
    expect(rule('.pr-card__description')).toContain('font-size: 14px');
    expect(rule('.pr-dialog__description')).toContain('font-size: 14px');
    expect(rule('.pr-empty__description')).toContain('font-size: 14px');
  });
});

describe('the anchored menu surfaces', () => {
  it('stacks a menu and a popover above the select popup they open from', () => {
    // A row inside a rich-select is one of the places these open from, and that popup
    // sits at 60. Anything lower would render the menu behind the list it came from.
    expect(rule('.pr-rich-select__content')).toContain('z-index: 60');
    expect(rule('.pr-menu__content')).toContain('z-index: 62');
    expect(rule('.pr-popover__content')).toContain('z-index: 62');
    // A tooltip annotates controls inside both, so it is drawn last.
    expect(rule('.pr-tooltip')).toContain('z-index: 70');
  });

  it('owns both surfaces through the elevated token and the same containment', () => {
    for (const selector of ['.pr-menu__content', '.pr-popover__content']) {
      const surface = rule(selector);
      expect(surface, selector).toContain('background: var(--pr-elevated)');
      expect(surface, selector).toContain('color: var(--pr-fg)');
      expect(surface, selector).toContain('var(--pr-shadow-elevated)');
      expect(surface, selector).toContain('inset 0 0 0 1px var(--pr-border)');
      // Both are positioned by the shared hook and can outgrow their space.
      expect(surface, selector).toContain('overscroll-behavior: contain');
    }
  });

  it('keeps nested radii concentric and transitions only changed properties', () => {
    expect(rule('.pr-menu__content')).toContain('var(--pr-radius-md');
    expect(rule('.pr-menu__item')).toContain('var(--pr-radius-sm');
    expect(rule('.pr-menu__item')).toContain('transition-property: background-color, color');
    expect(rule('.pr-menu__item')).not.toContain('transition: all');
  });

  it('gives hover and keyboard focus one highlight, so arrowing looks like hovering', () => {
    // Two different highlights is the bug this pins: rows take real DOM focus, so a
    // separate `:focus-visible` treatment would show two active rows at once.
    expect(
      rule('.pr-menu__item:hover:not([data-disabled]),\n.pr-menu__item:focus-visible'),
    ).toContain('background: var(--pr-surface)');
  });

  it('tints a destructive row instead of putting solid-fill copy on it', () => {
    // `--pr-danger-fg` is the colour that sits *on* solid danger. Using it over a
    // tint inverts the contrast it was chosen for, so the row keeps `--pr-danger`.
    expect(rule('.pr-menu__item--destructive')).toContain('color: var(--pr-danger)');
    const active = rule(
      '.pr-menu__item--destructive:hover:not([data-disabled]),\n.pr-menu__item--destructive:focus-visible',
    );
    expect(active).toContain('color-mix(in srgb, var(--pr-danger) 14%, transparent)');
    expect(active).not.toContain('--pr-danger-fg');
  });

  it('reserves the checkbox indicator whether or not the row is ticked', () => {
    // Otherwise ticking one row shifts the labels of every row beside it.
    expect(rule('.pr-menu__indicator')).toContain('flex: 0 0 20px');
  });

  it('keeps a menu group announceable rather than collapsing it away', () => {
    // `display: contents` drops the accessibility role in several browsers, which
    // would remove the grouping the element exists to convey.
    expect(rule('.pr-menu__group')).toContain('display: block');
    expect(rule('.pr-menu__group')).not.toContain('display: contents');
  });
});

describe('the popover inset', () => {
  it('keeps padding on a modifier so a call site can opt out of it', () => {
    // These rules are unlayered, so they beat a consumer's Tailwind utility at any
    // specificity — measured: `className="p-0"` leaves the computed padding at 12px.
    // That is right for the surface itself but wrong for an inset a list panel has to
    // remove, so the inset has to be absent rather than zero. Same split as `Card`.
    expect(rule('.pr-popover__content')).not.toContain('padding:');
    expect(rule('.pr-popover__content--pad-md')).toContain('padding: 12px');
    expect(css).not.toContain('.pr-popover__content--pad-none');
  });
});

describe('the tooltip surface', () => {
  it('inverts against the page instead of sitting on elevated', () => {
    // A hint has to read as an annotation over the UI rather than as another panel of
    // it, and inverting the semantic pair is the one treatment that stays legible in
    // both modes without introducing a second value.
    const tip = rule('.pr-tooltip');
    expect(tip).toContain('background: var(--pr-fg)');
    expect(tip).toContain('color: var(--pr-bg)');
    // It must never eat the pointer events of whatever it is floating over.
    expect(tip).toContain('pointer-events: none');
  });
});

describe('the loading placeholder', () => {
  it('pulses opacity rather than sliding a gradient that needs a per-mode value', () => {
    expect(rule('.pr-skeleton')).toContain('animation: pr-skeleton-pulse');
    expect(rule('.pr-skeleton')).toContain('background: var(--pr-border)');
    expect(css).not.toContain('pr-skeleton-shimmer');
  });

  it('stops animating under reduced motion instead of pulsing forever', () => {
    // A placeholder that never resolves is a permanent animation on a page a user
    // may be stuck on, which is exactly what the preference is for.
    const reduced = css.slice(css.indexOf('.pr-skeleton__group'));
    expect(reduced).toContain('@media (prefers-reduced-motion: reduce)');
    expect(reduced.slice(reduced.indexOf('@media (prefers-reduced-motion: reduce)'))).toContain(
      'animation: none',
    );
  });
});

describe('the separator', () => {
  it('stretches vertically to its neighbours rather than declaring a height', () => {
    // Every use of it is a divider between toolbar controls, so the rule should be as
    // tall as whatever sits beside it, not as tall as a number chosen here.
    const vertical = rule('.pr-separator--vertical');
    expect(vertical).toContain('align-self: stretch');
    expect(vertical).toContain('width: 1px');
    expect(rule('.pr-separator--horizontal')).toContain('height: 1px');
    expect(rule('.pr-separator')).toContain('background: var(--pr-border)');
  });
});

describe('the pinned table header', () => {
  const stickyHeaderRules = css.slice(css.indexOf('.pr-table--sticky-header'));

  it('paints an opaque background, or the rows show through as they pass under', () => {
    // `position: sticky` alone leaves the header transparent, so scrolled rows render
    // straight through it. The token is read explicitly rather than inherited because
    // a `bare` table sits on the page with no surface of its own to inherit.
    expect(stickyHeaderRules).toMatch(/background:\s*var\(--pr-surface\)/);
  });

  it('draws its bottom edge with a shadow, not a border', () => {
    // `border-collapse: collapse` hands cell borders to the table grid, which scrolls
    // away with the body — the sticky header would lose its edge on scroll. A shadow
    // is painted by the cell, so it travels with it.
    expect(stickyHeaderRules).toMatch(/box-shadow:\s*inset 0 -1px 0 var\(--pr-border\)/);
  });

  it('caps the scroll region so the body scrolls under the header', () => {
    expect(css).toMatch(/\.pr-table__scroll--capped\s*\{[^}]*overflow-y:\s*auto/);
  });

  it('orders the capped rule after the compound one that hides vertical overflow', () => {
    // `.pr-table__scroll--compound` sets `overflow-y: hidden`. Same specificity, so
    // source order is the only thing making a capped compound table scroll at all.
    expect(css.indexOf('.pr-table__scroll--capped')).toBeGreaterThan(
      css.indexOf('.pr-table__scroll--compound'),
    );
  });
});

describe('a bleeding card body', () => {
  it('cancels exactly the card padding, read from a variable', () => {
    // Hardcoding 16px would be silently wrong on `sm` (12px) and `lg` (24px), so the
    // amount is published as --pr-card-pad and cancelled by reference.
    expect(css).toMatch(/\.pr-card--pad-sm \{ --pr-card-pad: 12px;/);
    expect(css).toMatch(/\.pr-card--pad-lg \{ --pr-card-pad: 24px;/);
    expect(css).toMatch(
      /\.pr-card__content--bleed \{[^}]*margin-inline:\s*calc\(-1 \* var\(--pr-card-pad, 0px\)\)/,
    );
  });

  it('falls back to zero, so bleeding an unpadded card is a no-op', () => {
    // With `padding="none"` no --pr-card-pad is set. Without the fallback the calc
    // would be invalid and the declaration dropped — or worse, resolve against an
    // inherited value and pull the body outside the card.
    const rule = css.slice(css.indexOf('.pr-card__content--bleed'));
    expect(rule).toContain('var(--pr-card-pad, 0px)');
  });

  it('clips the card, so a bled table cannot overhang the border radius', () => {
    expect(css).toMatch(/\.pr-card:has\(> \.pr-card__content--bleed\) \{ overflow: hidden; \}/);
  });
});

describe('the spinner tone', () => {
  it('keeps the base free of any colour declaration', () => {
    // `tone="inherit"` emits no class, so the base must not override a caller's
    // colour utility.
    const base = /\.pr-spinner \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(base).not.toMatch(/(^|[;\s])color\s*:/);
  });

  it('puts the muted colour on its own modifier', () => {
    expect(css).toMatch(/\.pr-spinner--muted \{[^}]*color:\s*var\(--pr-fg-muted\)/);
  });
});

describe('the file dropzone', () => {
  it('owns a warm token-driven surface without a gradient or glow', () => {
    const surface = rule('.pr-file-dropzone');
    expect(surface).toContain('background: var(--pr-surface)');
    expect(surface).toContain('border: 1px dashed var(--pr-border-strong)');
    expect(surface).toContain('border-radius: var(--pr-radius-lg)');
    expect(surface).not.toContain('gradient');
    expect(surface).not.toMatch(/(^|\n)\s*box-shadow\s*:/);

    const active = rule(".pr-file-dropzone[data-state='drag-active']");
    expect(active).toContain('background: var(--pr-tone-yellow-bg)');
    expect(active).toContain('border-color: var(--pr-tone-yellow-border)');
  });

  it('keeps the native input over the complete 40px-plus target', () => {
    const input = rule('.pr-file-dropzone__input');
    expect(input).toContain('position: absolute');
    expect(input).toContain('inset: 0');
    expect(input).toContain('opacity: 0');
    expect(rule('.pr-file-dropzone')).toContain('min-height: 160px');
  });

  it('shows native keyboard focus and semantic invalid and disabled states', () => {
    expect(rule('.pr-file-dropzone:has(.pr-file-dropzone__input:focus-visible)')).toContain(
      'box-shadow: var(--pr-focus-ring)',
    );
    expect(rule(".pr-file-dropzone[data-state='invalid']")).toContain(
      'border-color: var(--pr-danger)',
    );
    expect(rule(".pr-file-dropzone[data-state='disabled']")).toContain('cursor: not-allowed');
  });

  it('transitions only the surface properties it changes', () => {
    const surface = rule('.pr-file-dropzone');
    expect(surface).toContain('transition:');
    expect(surface).not.toContain('transition: all');
  });
});
