import { expect, test } from '@playwright/experimental-ct-react';
import { FleetDialog, NestedFleetDialog } from './dialog-owned-portals.story';

test('an owned combobox menu is topmost, searchable, and selectable inside a dialog', async ({
  mount,
  page,
}) => {
  await mount(<FleetDialog />);

  const dialogRoot = page.locator('.pr-dialog');
  const trigger = page.getByRole('combobox', { name: 'Buscar flotilla…' });
  await trigger.click();

  const menu = page.locator('.pr-combobox__menu');
  await expect(menu).toBeVisible();
  await expect(menu).toHaveAttribute('data-pr-dialog-layer-owned', '');

  const [dialogZ, menuZ] = await Promise.all([
    dialogRoot.evaluate((element) => Number(getComputedStyle(element).zIndex)),
    menu.evaluate((element) => Number(getComputedStyle(element).zIndex)),
  ]);
  expect(menuZ).toBeGreaterThan(dialogZ);
  expect(
    await menu.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + 8, rect.top + 8);
      return hit instanceof Element && element.contains(hit);
    }),
  ).toBe(true);

  await page.getByRole('textbox', { name: 'Buscar flotilla…' }).fill('Transportes');
  await page.getByRole('option', { name: 'Transportes Uno' }).click();
  await expect(page.getByRole('combobox', { name: 'Transportes Uno' })).toBeVisible();
});

test('nested dialogs and their menus receive monotonically higher stack levels', async ({
  mount,
  page,
}) => {
  await mount(<NestedFleetDialog />);

  const roots = page.locator('.pr-dialog');
  await expect(roots).toHaveCount(2);
  await page.getByRole('combobox', { name: 'Buscar flotilla anidada…' }).click();

  const rootLevels = await roots.evaluateAll((elements) =>
    elements.map((element) => Number(getComputedStyle(element).zIndex)),
  );
  const menuLevel = await page
    .locator('.pr-combobox__menu')
    .evaluate((element) => Number(getComputedStyle(element).zIndex));

  expect(rootLevels).toEqual([100, 120]);
  expect(menuLevel).toBe(130);
});
