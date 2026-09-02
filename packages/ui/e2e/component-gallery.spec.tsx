import { expect, test } from '@playwright/experimental-ct-react';
import {
  DialogDarkCatalog,
  DialogLightCatalog,
  ShellDarkCatalog,
  ShellLightCatalog,
  UiDarkCatalog,
  UiLightCatalog,
  InvalidPaginationDemo,
  PaginationDemo,
} from './component-gallery.story';

const PUBLIC_VISUAL_SELECTORS = [
  '.pr-btn',
  '.pr-badge',
  '.pr-card',
  '.pr-input',
  '.pr-file-dropzone',
  '.pr-label',
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
  '.pr-table__shell',
  '.pr-table__caption',
  '.pr-tabs__list',
  '.pr-navigation-tabs__list',
  '.pr-pagination',
  '.pr-page',
  '.pr-section-heading',
  '.pr-stat-grid',
  '.pr-toolbar',
  '.pr-search-field',
  '.pr-filter-chip',
  '.pr-segmented',
  '.pr-status-dot',
  '.pr-icon-tile',
  '.pr-avatar',
  '.pr-table-frame',
  '.pr-table-skeleton',
  '.pr-date-range__trigger',
] as const;

const readTypography = (node: HTMLElement) => {
  const style = getComputedStyle(node);
  return {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    letterSpacing: style.letterSpacing,
    lineHeight: style.lineHeight,
  };
};

const readContrastRatio = (node: HTMLElement) => {
  const channels = (value: string) => {
    const values = value.match(/[\d.]+/g)?.map(Number).slice(0, 3) ?? [];
    if (values.length !== 3) throw new Error(`Unsupported computed color: ${value}`);
    return value.startsWith('color(srgb') ? values : values.map((channel) => channel / 255);
  };
  const luminance = (value: string) =>
    channels(value)
      .map((channel) =>
        channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4,
      )
      .reduce(
        (total, channel, index) =>
          total + channel * ([0.2126, 0.7152, 0.0722][index] ?? 0),
        0,
      );
  const style = getComputedStyle(node);
  const foreground = luminance(style.color);
  const background = luminance(style.backgroundColor);
  return (Math.max(foreground, background) + 0.05) /
    (Math.min(foreground, background) + 0.05);
};

test('the light catalog loads approved fonts, exact brand colors, and every public style', async ({
  mount,
  page,
}) => {
  await mount(<UiLightCatalog />);
  await page.evaluate(() => document.fonts.ready);

  await expect(page.getByTestId('ui-light-catalog')).toBeVisible();
  for (const selector of PUBLIC_VISUAL_SELECTORS) {
    const element = page.locator(selector).first();
    await expect(element, selector).toBeVisible();
    expect(await element.evaluate((node) => getComputedStyle(node).display)).not.toBe('inline');
  }

  const primary = page.locator('.pr-btn--primary').first();
  // Crystal v2 canon: flat accent underneath, the brand sweep painted over it.
  await expect(primary).toHaveCSS('background-color', 'rgb(253, 210, 56)');
  await expect(primary).toHaveCSS('color', 'rgb(26, 26, 26)');
  expect(await primary.evaluate((node) => getComputedStyle(node).backgroundImage)).toContain(
    'linear-gradient',
  );
  expect(await page.evaluate(() => document.fonts.check('14px "Barlow"'))).toBe(true);
  expect(await page.evaluate(() => document.fonts.check('40px "Bebas Neue"'))).toBe(true);

  await expect(page.getByRole('textbox', { name: 'Observaciones' })).toHaveAttribute(
    'aria-describedby',
    /.+/,
  );
  await expect(page.getByRole('textbox', { name: 'Motivo de rechazo' })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(page.getByRole('combobox', { name: 'Flotilla' })).toHaveAttribute(
    'aria-required',
    'true',
  );
  await expect(page.getByRole('checkbox', { name: 'Selección parcial' })).toHaveAttribute(
    'aria-checked',
    'mixed',
  );
  await expect(page.getByRole('radiogroup', { name: 'Prioridad de atención' })).toHaveAttribute(
    'aria-invalid',
    'true',
  );

  if (process.env.PR_CAPTURE_COMPONENT_CATALOG === '1') {
    await page.screenshot({
      path: 'test-results/ui-light-catalog.png',
      fullPage: true,
      animations: 'disabled',
    });
  }
});

test('the selected-file catalog example renders its real browser file row', async ({
  mount,
  page,
}) => {
  await mount(<UiLightCatalog />);
  const selectedDropzone = page.getByLabel('Archivo con observaciones').locator('xpath=..');

  await expect(selectedDropzone.locator('.pr-file-dropzone__file')).toHaveCount(1);
  await expect(selectedDropzone.locator('.pr-file-dropzone__file')).toContainText(
    'rutas-validado.csv',
  );
});

test('compact controls and embedded actions keep a 40px interaction target', async ({ mount, page }) => {
  await mount(<UiLightCatalog />);

  const selectors = [
    '.pr-btn--xs',
    '.pr-btn--sm',
    '.pr-btn--icon',
    '.pr-input--sm',
    '.pr-select__control--sm',
    '.pr-rich-select__trigger',
    '.pr-calendar__nav',
    '.pr-calendar__day',
    '.pr-date-picker__trigger',
    '.pr-combobox__clear',
    '.pr-multiselect__chip-remove',
    '.pr-multiselect--filter .pr-multiselect__trigger',
    '.pr-choice',
    '.pr-validation-summary__link',
    '.pr-tabs__trigger',
    '.pr-navigation-tabs__link',
    '.pr-pagination__controls .pr-btn',
    '.pr-filter-chip',
    '.pr-segmented__option',
    '.pr-date-range__trigger',
    '.pr-search-field .pr-field__control',
  ] as const;

  for (const selector of selectors) {
    const box = await page.locator(selector).first().boundingBox();
    expect(box, selector).not.toBeNull();
    expect(box!.width, `${selector} width`).toBeGreaterThanOrEqual(40);
    expect(box!.height, `${selector} height`).toBeGreaterThanOrEqual(40);
  }
});

test('a dropdown trigger preserves its composed Button typography', async ({ mount, page }) => {
  await mount(<UiLightCatalog />);

  const direct = page.getByTestId('direct-outline-sm');
  const menuTrigger = page.getByTestId('menu-outline-sm');
  await expect(menuTrigger).toHaveClass(/pr-menu__trigger/);

  expect(await menuTrigger.evaluate(readTypography)).toEqual(
    await direct.evaluate(readTypography),
  );

  await menuTrigger.click();
  await expect(page.getByRole('menuitem', { name: 'Open details' })).toBeVisible();
  await page.keyboard.press('Escape');
  await menuTrigger.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Open details' })).toBeFocused();

  if (process.env.PR_CAPTURE_DROPDOWN_TRIGGER === '1') {
    await direct.locator('xpath=..').screenshot({
      path: 'test-results/dropdown-trigger-typography.png',
      animations: 'disabled',
    });
  }
});

test('a raw dropdown trigger keeps the package typeface and inherits its type scale', async ({
  mount,
  page,
}) => {
  await mount(<UiLightCatalog />);

  const context = page.getByTestId('raw-menu-context');
  const rawTrigger = page.getByTestId('raw-menu-trigger');
  await expect(rawTrigger).toHaveClass(/pr-menu__trigger--raw/);
  const rawTypography = await rawTrigger.evaluate(readTypography);
  const contextTypography = await context.evaluate(readTypography);
  expect(rawTypography.fontFamily).toContain('Barlow');
  expect(rawTypography).toMatchObject({
    fontSize: contextTypography.fontSize,
    fontWeight: contextTypography.fontWeight,
    lineHeight: contextTypography.lineHeight,
  });
});

/** A composed Button keeps the same typography inside a popover trigger. */
test('a popover trigger preserves its composed Button typography', async ({ mount, page }) => {
  await mount(<UiLightCatalog />);

  const direct = page.getByTestId('direct-popover-peer');
  const popoverTrigger = page.getByTestId('popover-outline-sm');
  await expect(popoverTrigger).toHaveClass(/pr-popover__trigger/);

  expect(await popoverTrigger.evaluate(readTypography)).toEqual(
    await direct.evaluate(readTypography),
  );

  await popoverTrigger.click();
  await expect(page.getByText('Detalle').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(popoverTrigger).toBeFocused();
});

test('a raw popover trigger keeps the package typeface and inherits its type scale', async ({
  mount,
  page,
}) => {
  await mount(<UiLightCatalog />);

  const context = page.getByTestId('raw-popover-context');
  const rawTrigger = page.getByTestId('raw-popover-trigger');
  await expect(rawTrigger).toHaveClass(/pr-popover__trigger--raw/);
  const rawTypography = await rawTrigger.evaluate(readTypography);
  const contextTypography = await context.evaluate(readTypography);
  expect(rawTypography.fontFamily).toContain('Barlow');
  expect(rawTypography).toMatchObject({
    fontSize: contextTypography.fontSize,
    fontWeight: contextTypography.fontWeight,
    lineHeight: contextTypography.lineHeight,
  });
});

test('composed triggers preserve typography declared inside a consumer CSS layer', async ({
  mount,
  page,
}) => {
  await mount(<UiLightCatalog />);

  const direct = page.getByTestId('direct-layered-trigger');
  const directTypography = await direct.evaluate(readTypography);
  for (const testId of ['menu-layered-trigger', 'popover-layered-trigger']) {
    const trigger = page.getByTestId(testId);
    expect(await trigger.evaluate(readTypography), testId).toEqual(directTypography);
    await expect(trigger, testId).not.toHaveClass(/__trigger--raw/);
  }
});

test('pagination exposes valid controls, a polite summary, and visible keyboard focus', async ({
  mount,
  page,
}) => {
  await mount(<PaginationDemo />);

  const navigation = page.getByRole('navigation', { name: 'Route results pages' });
  const summary = navigation.getByRole('status');
  const previous = navigation.getByRole('button', { name: 'Previous page' });
  const next = navigation.getByRole('button', { name: 'Next page' });

  await expect(summary).toHaveText('21–40 of 94');
  await expect(summary).toHaveAttribute('aria-live', 'polite');
  await expect(summary).toHaveAttribute('aria-atomic', 'true');
  await page.keyboard.press('Tab');
  await expect(previous).toBeFocused();
  expect(await previous.evaluate((node) => getComputedStyle(node).boxShadow)).not.toBe('none');

  await next.click();
  await expect(summary).toHaveText('41–60 of 94');
});

test('pagination follows the canonical dark surface without consumer overrides', async ({
  mount,
  page,
}) => {
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await mount(<PaginationDemo />);

  const navigation = page.getByRole('navigation', { name: 'Route results pages' });
  await expect(navigation.getByRole('status')).toHaveCSS('color', 'rgb(180, 180, 186)');
  await expect(navigation.getByRole('button', { name: 'Previous page' })).toHaveCSS(
    'color',
    'rgb(245, 245, 244)',
  );
});

test('pagination becomes icon-only at 375px without overflow or losing its names', async ({
  mount,
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await mount(<PaginationDemo />);

  const navigation = page.getByRole('navigation', { name: 'Route results pages' });
  const previous = navigation.getByRole('button', { name: 'Previous page' });
  const next = navigation.getByRole('button', { name: 'Next page' });
  await expect(previous.locator('.pr-pagination__button-label')).toBeHidden();
  await expect(next.locator('.pr-pagination__button-label')).toBeHidden();

  for (const button of [previous, next]) {
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBe(40);
    expect(box!.height).toBe(40);
  }
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).toBe(true);
});

test('pagination warns for invalid props in the browser runtime', async ({
  mount,
  page,
}) => {
  const warning = page.waitForEvent('console', {
    predicate: message => message.text().includes('[Pagination]'),
    timeout: 2_000,
  });

  await mount(<InvalidPaginationDemo />);

  await expect(page.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled();
  const message = await warning;
  expect(message.type()).toBe('warning');
  expect(message.text()).toContain('`page` must be a positive integer');
});

test('card adoption variants own glass and matched tone borders in light mode', async ({
  mount,
  page,
}) => {
  await mount(<UiLightCatalog />);

  const glass = page.locator('.pr-card--glass').first();
  await expect(glass).toBeVisible();
  expect(await glass.evaluate((node) => getComputedStyle(node).backdropFilter)).toContain('blur(12px)');
  // The glass token: rgba(255,255,255,0.85) in light.
  expect(await glass.evaluate((node) => getComputedStyle(node).backgroundColor)).toMatch(
    /(?:rgba|color\(srgb).*(?:0\.85|85%)/,
  );

  const lightTone = page.locator('.pr-card--tone-border.pr-card--rose').first();
  await expect(lightTone).toHaveCSS('border-color', 'rgba(225, 29, 72, 0.35)');
});

test('card matched tone borders rotate with dark mode', async ({ mount, page }) => {
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await mount(<UiDarkCatalog />);
  const darkTone = page.locator('.pr-card--tone-border.pr-card--rose').first();
  await expect(darkTone).toHaveCSS('border-color', 'rgba(251, 113, 133, 0.45)');
});

test('tabs own automatic and manual keyboard activation with linked panels', async ({
  mount,
  page,
}) => {
  await mount(<UiLightCatalog />);

  const routeRecord = page.getByRole('tablist', { name: 'Route record' });
  const summary = routeRecord.getByRole('tab', { name: 'Summary' });
  const evidence = routeRecord.getByRole('tab', { name: 'Evidence' });
  await expect(summary).toHaveAttribute('aria-selected', 'true');
  await summary.focus();
  await page.keyboard.press('ArrowRight');
  await expect(evidence).toBeFocused();
  await expect(evidence).toHaveAttribute('aria-selected', 'true');
  const evidencePanel = page.getByRole('tabpanel', { name: 'Evidence' });
  await expect(evidencePanel).toContainText('Delivery photos');
  const evidencePanelId = await evidencePanel.getAttribute('id');
  expect(evidencePanelId).not.toBeNull();
  await expect(evidence).toHaveAttribute('aria-controls', evidencePanelId!);

  const reportPeriod = page.getByRole('tablist', { name: 'Report period' });
  const daily = reportPeriod.getByRole('tab', { name: 'Daily' });
  const weekly = reportPeriod.getByRole('tab', { name: 'Weekly' });
  await expect(reportPeriod.getByRole('tab', { name: 'Monthly' })).toBeDisabled();
  await daily.focus();
  await page.keyboard.press('ArrowDown');
  await expect(weekly).toBeFocused();
  await expect(daily).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Enter');
  await expect(weekly).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel', { name: 'Weekly' })).toContainText(
    'Weekly operational performance',
  );
});

test('rich select owns search, custom options, disabled state, and keyboard selection', async ({
  mount,
  page,
}) => {
  await mount(<UiLightCatalog />);

  const trigger = page.getByRole('combobox', { name: 'Workspace' });
  await expect(trigger).toHaveAttribute('aria-autocomplete', 'list');
  await trigger.click();
  const listbox = page.getByRole('listbox');
  const search = page.getByRole('searchbox', { name: 'Search workspaces' });
  await expect(search).toBeFocused();
  await expect(page.getByRole('group', { name: 'Operations apps' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Legacy workspace' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );

  await search.fill('live');
  await expect(page.getByRole('option', { name: /LiveOps Live/ })).toBeVisible();
  await expect(page.getByRole('option', { name: /Supply Operations/ })).toHaveCount(0);
  await expect(search).toHaveAttribute('aria-activedescendant', /item-1/);
  await page.keyboard.press('Enter');
  await expect(listbox).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(trigger).toContainText('LiveOps monitoring');
});

test('rich select supports an app-controlled async activation boundary', async ({
  mount,
  page,
}) => {
  await mount(<UiLightCatalog />);

  const trigger = page.getByRole('combobox', { name: 'On-demand client' });
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('listbox')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('multi select supports controlled remote search without closing after selection', async ({
  mount,
  page,
}) => {
  await mount(<UiLightCatalog />);

  const trigger = page.getByRole('combobox', { name: 'On-demand drivers' });
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('Type at least 3 characters')).toBeVisible();

  const search = page.getByRole('searchbox', { name: 'Search drivers' });
  await search.fill('0101');
  await expect(page.getByRole('option', { name: 'Ana Operadora' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Carlos Ruta' })).toHaveCount(0);
  await page.getByRole('option', { name: 'Ana Operadora' }).click();

  await expect(page.getByRole('listbox')).toBeVisible();
  await expect(trigger).toContainText('Ana Operadora');
  await page.keyboard.press('Escape');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('multi select owns compact filter summary, leading content, and clear-all behavior', async ({
  mount,
  page,
}) => {
  await mount(<UiLightCatalog />);

  const trigger = page.getByRole('combobox', { name: 'Filtrar por estado' });
  await expect(trigger).toContainText('Estado (2)');
  await trigger.click();

  // The filter menu has no search of its own; the catalog's SearchField is a separate control.
  await expect(page.locator('.pr-multiselect__menu').getByRole('searchbox')).toHaveCount(0);
  await expect(page.getByRole('option', { name: 'Pendiente' })).toBeVisible();
  const clear = page.getByRole('option', { name: 'Todos — Estado' });
  await expect(clear).toHaveAttribute('aria-selected', 'false');
  await clear.click();

  await expect(trigger).toContainText('Estado');
  await expect(trigger).not.toContainText('(2)');
  await expect(clear).toHaveAttribute('aria-selected', 'true');
});

test('calendar and date picker own date-only range, keyboard, and form behavior', async ({
  mount,
  page,
}) => {
  await mount(<UiLightCatalog />);

  const calendar = page.getByRole('group', { name: 'Operating calendar' });
  const start = calendar.locator('[data-date="2026-07-08"]');
  const middle = calendar.locator('[data-date="2026-07-10"]');
  const end = calendar.locator('[data-date="2026-07-12"]');
  await expect(start).toHaveAttribute('data-range-start', '');
  await expect(middle).toHaveAttribute('data-range-middle', '');
  await expect(end).toHaveAttribute('data-range-end', '');
  await middle.focus();
  await page.keyboard.press('ArrowRight');
  await expect(calendar.locator('[data-date="2026-07-11"]')).toBeFocused();

  const delivery = page.getByRole('button', { name: 'Delivery date' });
  await delivery.click();
  const picker = page.getByRole('dialog', { name: 'Seleccionar fecha' });
  await expect(picker.locator('[data-date="2026-07-15"]')).toBeFocused();
  await picker.locator('[data-date="2026-07-16"]').click();
  await expect(picker).toHaveCount(0);
  await expect(delivery).toBeFocused();
  await expect(page.locator('input[name="catalog-delivery-date"]')).toHaveValue('2026-07-16');
});

test('date picker remains contained on a narrow viewport', async ({ mount, page }) => {
  await page.setViewportSize({ width: 360, height: 760 });
  await mount(<UiLightCatalog />);

  const trigger = page.getByRole('button', { name: 'Operating range' });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  const picker = page.getByRole('dialog', { name: 'Seleccionar rango de fechas' });
  await expect(picker).toBeVisible();
  const box = await picker.boundingBox();
  expect(box).not.toBeNull();
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(360);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test('compound tables preserve native structure and own interactive-row behavior', async ({
  mount,
  page,
}) => {
  await mount(<UiLightCatalog />);

  const region = page.getByRole('region', { name: 'Workspace access table' });
  const table = page.getByRole('table', { name: 'Workspace access' });
  await expect(region).toContainText('Access by operating team');
  await expect(region).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(table.getByText('Access by operating team')).toBeVisible();
  for (const header of await table.getByRole('columnheader').all()) {
    await expect(header).toHaveAttribute('scope', 'col');
  }
  await expect(table.locator('tfoot td')).toHaveAttribute('colspan', '3');

  const interactiveRow = table.getByRole('row', { name: 'Open Dispatcher permissions' });
  const staticRow = table.locator('tbody tr').nth(1);
  await expect(interactiveRow).toHaveAttribute('tabindex', '0');
  await expect(staticRow).not.toHaveAttribute('tabindex');
  await table.getByRole('button', { name: 'Review' }).click();
  await expect(interactiveRow).not.toHaveAttribute('data-state', 'selected');
  await interactiveRow.focus();
  await page.keyboard.press('Enter');
  await expect(interactiveRow).toHaveAttribute('data-state', 'selected');
  await expect(interactiveRow.locator('td').first()).toHaveCSS(
    'background-color',
    'rgba(253, 210, 56, 0.2)',
  );
});

test('selection controls preserve native interaction and clear their shared validation', async ({
  mount,
  page,
}) => {
  await mount(<UiLightCatalog />);

  const evidence = page.getByRole('checkbox', { name: 'Confirmar evidencia' });
  await expect(evidence).toBeChecked();
  await page.getByText('Confirmar evidencia', { exact: true }).click();
  await expect(evidence).not.toBeChecked();

  const autoAssign = page.getByRole('switch', { name: 'Asignación automática' });
  await expect(autoAssign).not.toBeChecked();
  await autoAssign.focus();
  await page.keyboard.press('Space');
  await expect(autoAssign).toBeChecked();

  const bajio = page.getByRole('checkbox', { name: 'Bajío' });
  await page.getByText('Bajío', { exact: true }).click();
  await expect(bajio).toBeChecked();

  await expect(page.getByRole('alert', { name: 'Corrige los siguientes campos' })).toContainText(
    'Política operativa',
  );
  await page.locator('label[for="catalog-terms"]').click();
  await page.getByRole('radio', { name: 'Urgente' }).locator('..').click();
  await expect(page.getByRole('alert', { name: 'Corrige los siguientes campos' })).toHaveCount(0);
});

test('the form catalog remains contained on a narrow light-mode viewport', async ({ mount, page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await mount(<UiLightCatalog />);

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).toBe(true);
  await expect(page.getByRole('radiogroup', { name: 'Prioridad de atención' })).toBeVisible();
  await expect(page.getByRole('alert', { name: 'Corrige los siguientes campos' })).toBeVisible();
});

test('the canonical dialog is visibly styled above the light surface', async ({ mount, page }) => {
  await mount(<DialogLightCatalog />);

  const panel = page.getByRole('dialog');
  await expect(panel).toBeVisible();
  await expect(panel).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(panel).toHaveCSS('font-family', /Barlow/);
  expect(await page.locator('.pr-dialog__backdrop').evaluate((node) => getComputedStyle(node).position)).toBe(
    'absolute',
  );
});

test('compound dialog, alert, and sheet own their browser behavior and light surfaces', async ({
  mount,
  page,
}) => {
  await mount(<UiLightCatalog />);

  const dialogTrigger = page.getByRole('button', { name: 'Open dialog' });
  await dialogTrigger.click();
  const dialog = page.getByRole('dialog', { name: 'Assign fleet' });
  await expect(dialog).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.getByRole('textbox', { name: 'Route', exact: true })).toBeFocused();
  const team = dialog.getByRole('combobox', { name: 'Operating team' });
  await team.click();
  const ownedMenu = page.locator('.pr-rich-select__content');
  await expect(ownedMenu).toHaveAttribute('data-pr-dialog-layer-owned', '');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await expect(team).toBeFocused();
  const assignmentDate = dialog.getByRole('button', { name: 'Assignment date' });
  await assignmentDate.click();
  const datePortal = page.locator('.pr-date-picker__content');
  await expect(datePortal).toHaveAttribute('data-pr-dialog-layer-owned', '');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Seleccionar fecha' })).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await expect(assignmentDate).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(dialogTrigger).toBeFocused();

  await page.getByRole('button', { name: 'Open confirmation' }).click();
  const alert = page.getByRole('alertdialog', { name: 'Delete route?' });
  await page.keyboard.press('Escape');
  await expect(alert).toBeVisible();
  await page.getByRole('button', { name: 'Keep route' }).click();
  await expect(alert).toHaveCount(0);

  const sheetTrigger = page.getByRole('button', { name: 'Open sheet' });
  await sheetTrigger.click();
  const sheet = page.getByRole('dialog', { name: 'Route filters' });
  await expect(sheet).toHaveAttribute('data-side', 'right');
  await expect(sheet).toHaveCSS('width', '420px');
  await expect(sheet).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(sheetTrigger).toBeFocused();
});

test('the canonical shell renders the light brand without horizontal overflow', async ({ mount, page }) => {
  await mount(<ShellLightCatalog />);

  await expect(page.getByTestId('shell-light-catalog')).toBeVisible();
  // Crystal v2 canon: the rail is the brand sweep; its middle stop is the
  // exact approved yellow.
  const lightRail = await page
    .locator('.pr-sidebar')
    .evaluate((node) => getComputedStyle(node).backgroundImage);
  expect(lightRail).toContain('linear-gradient');
  expect(lightRail).toContain('rgb(253, 210, 56)');
  await expect(page.locator('.pr-shell')).toHaveCSS('font-family', /Barlow/);
  const notificationCount = page.locator('.pr-badge-dot');
  await expect(notificationCount).toHaveCSS('color', 'rgb(255, 255, 255)');
  expect(await notificationCount.evaluate(readContrastRatio)).toBeGreaterThanOrEqual(4.5);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).toBe(true);
});

test('the canonical mobile header keeps its sidebar trigger usable', async ({ mount, page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await mount(<ShellLightCatalog />);

  const trigger = page.getByRole('button', { name: 'Abrir menú' });
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.locator('.pr-sidebar')).toHaveAttribute('data-mobile-open', 'true');
});

test('the adaptive bundle renders every public primitive on canonical dark surfaces', async ({
  mount,
  page,
}) => {
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await mount(<UiDarkCatalog />);
  await page.evaluate(() => document.fonts.ready);

  await expect(page.getByTestId('ui-dark-catalog')).toBeVisible();
  for (const selector of PUBLIC_VISUAL_SELECTORS) {
    await expect(page.locator(selector).first(), selector).toBeVisible();
  }

  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(14, 14, 16)');
  await expect(page.locator('.catalog__surface').first()).toHaveCSS(
    'background-color',
    'rgb(22, 22, 24)',
  );
  await expect(page.locator('.pr-input').first()).toHaveCSS(
    'background-color',
    'rgb(22, 22, 24)',
  );
  await expect(page.locator('.pr-card--raised')).toHaveCSS(
    'background-color',
    'rgb(30, 30, 34)',
  );
  await expect(page.locator('.pr-btn--primary').first()).toHaveCSS(
    'background-color',
    'rgb(253, 210, 56)',
  );
  await expect(page.locator('.pr-btn--primary').first()).toHaveCSS('color', 'rgb(26, 26, 26)');
  expect(await page.evaluate(() => document.fonts.check('14px "Barlow"'))).toBe(true);
  expect(await page.evaluate(() => document.fonts.check('40px "Bebas Neue"'))).toBe(true);

  if (process.env.PR_CAPTURE_DARK_CATALOG === '1') {
    await page.screenshot({
      path: 'test-results/ui-dark-catalog.png',
      fullPage: true,
      animations: 'disabled',
    });
  }
});

test('the dark form catalog remains contained on a narrow viewport', async ({ mount, page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await mount(<UiDarkCatalog />);

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).toBe(true);
  await expect(page.getByRole('radiogroup', { name: 'Prioridad de atención' })).toBeVisible();
  await expect(page.getByRole('alert', { name: 'Corrige los siguientes campos' })).toBeVisible();
});

test('tabs inherit dark semantic surfaces without consumer overrides', async ({ mount, page }) => {
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await mount(<UiDarkCatalog />);

  const routeRecord = page.getByRole('tablist', { name: 'Route record' });
  await expect(routeRecord).toHaveCSS('background-color', 'rgb(22, 22, 24)');
  await expect(routeRecord.getByRole('tab', { name: 'Summary' })).toHaveCSS(
    'background-color',
    'rgb(30, 30, 34)',
  );
});

test('rich select inherits dark trigger, portal, search, and active-option surfaces', async ({
  mount,
  page,
}) => {
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await mount(<UiDarkCatalog />);

  const trigger = page.getByRole('combobox', { name: 'Workspace' });
  await expect(trigger).toHaveCSS('background-color', 'rgb(22, 22, 24)');
  await trigger.click();
  await expect(page.locator('.pr-rich-select__content')).toHaveCSS(
    'background-color',
    'rgb(30, 30, 34)',
  );
  await expect(page.locator('.pr-rich-select__item[data-highlighted]')).toHaveCSS(
    'background-color',
    'rgb(22, 22, 24)',
  );
  await expect(page.getByRole('searchbox', { name: 'Search workspaces' })).toHaveCSS(
    'color',
    'rgb(245, 245, 244)',
  );
});

test('multi select filters inherit dark active and elevated surfaces', async ({ mount, page }) => {
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await mount(<UiDarkCatalog />);

  const trigger = page.getByRole('combobox', { name: 'Filtrar por estado' });
  await expect(trigger).toHaveCSS('background-color', 'rgba(253, 210, 56, 0.2)');
  await expect(trigger).toHaveCSS('color', 'rgb(245, 245, 244)');
  await trigger.click();
  await expect(page.locator('.pr-multiselect__menu--filter')).toHaveCSS(
    'background-color',
    'rgb(30, 30, 34)',
  );
});

test('calendar and date picker inherit dark semantic surfaces', async ({ mount, page }) => {
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await mount(<UiDarkCatalog />);

  const calendar = page.getByRole('group', { name: 'Operating calendar' });
  await expect(calendar).toHaveCSS('background-color', 'rgb(22, 22, 24)');
  await expect(calendar.locator('[data-range-start]')).toHaveCSS(
    'background-color',
    'rgb(253, 210, 56)',
  );
  const delivery = page.getByRole('button', { name: 'Delivery date' });
  await expect(delivery).toHaveCSS('background-color', 'rgb(22, 22, 24)');
  await delivery.click();
  await expect(page.locator('.pr-date-picker__content')).toHaveCSS(
    'background-color',
    'rgb(30, 30, 34)',
  );
});

test('compound table selection and footer inherit dark semantic tokens', async ({ mount, page }) => {
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await mount(<UiDarkCatalog />);

  const table = page.getByRole('table', { name: 'Workspace access' });
  await expect(page.getByRole('region', { name: 'Workspace access table' })).toHaveCSS(
    'background-color',
    'rgb(22, 22, 24)',
  );
  const row = table.getByRole('row', { name: 'Open Dispatcher permissions' });
  await row.click();
  await expect(row.locator('td').first()).toHaveCSS(
    'background-color',
    'rgba(253, 210, 56, 0.2)',
  );
  await expect(table.locator('tfoot')).toHaveCSS('color', 'rgb(245, 245, 244)');
});

test('the canonical dialog inherits the dark portal surface', async ({ mount, page }) => {
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await mount(<DialogDarkCatalog />);

  await expect(page.getByTestId('dialog-dark-catalog')).toBeAttached();
  await expect(page.getByRole('dialog')).toHaveCSS('background-color', 'rgb(30, 30, 34)');
});

test('the compound sheet inherits the dark elevated surface without app repair CSS', async ({
  mount,
  page,
}) => {
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await mount(<UiDarkCatalog />);

  await page.getByRole('button', { name: 'Open sheet' }).click();
  await expect(page.getByRole('dialog', { name: 'Route filters' })).toHaveCSS(
    'background-color',
    'rgb(30, 30, 34)',
  );
});

test('the canonical shell switches its surfaces while retaining the yellow brand rail', async ({
  mount,
  page,
}) => {
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await mount(<ShellDarkCatalog />);

  await expect(page.getByTestId('shell-dark-catalog')).toBeVisible();
  // The brand rail is fixed: the same sweep in dark, middle stop the exact
  // approved yellow.
  const darkRail = await page
    .locator('.pr-sidebar')
    .evaluate((node) => getComputedStyle(node).backgroundImage);
  expect(darkRail).toContain('linear-gradient');
  expect(darkRail).toContain('rgb(253, 210, 56)');
  await expect(page.locator('.pr-shell')).toHaveCSS('background-color', 'rgb(14, 14, 16)');
  await expect(page.locator('.pr-card').first()).toHaveCSS('background-color', 'rgb(22, 22, 24)');
  const notificationCount = page.locator('.pr-badge-dot');
  await expect(notificationCount).toHaveCSS('color', 'rgb(255, 255, 255)');
  expect(await notificationCount.evaluate(readContrastRatio)).toBeGreaterThanOrEqual(4.5);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).toBe(true);
});
