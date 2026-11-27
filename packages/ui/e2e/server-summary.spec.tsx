import { expect, test } from '@playwright/experimental-ct-react';
import { ServerSummaryRecipe } from '../../showcase/src/recipes/ServerSummaryRecipe';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
});

test('server summary renders tiles with icons and a list of linked cards', async ({ mount, page }) => {
  await mount(<ServerSummaryRecipe state="data" />);

  await expect(page.getByRole('heading', { name: 'Resumen de colocadas', level: 1 })).toBeVisible();
  await expect(page.locator('.pr-stat-tile')).toHaveCount(4);
  await expect(page.locator('.pr-stat-tile__icon svg')).toHaveCount(4);
  await expect(page.locator('.pr-stat-tile__icon svg').first()).toHaveAttribute('stroke-width', '2.25');
  const cards = page.locator('a.pr-card.pr-card--interactive');
  await expect(cards).toHaveCount(4);
  await expect(cards.first()).toHaveAttribute('href', /\/colocadas\?proyecto=/);
});

test('server summary shows each state', async ({ mount, page }) => {
  const component = await mount(<ServerSummaryRecipe state="empty" />);
  await expect(page.getByText('Sin colocadas este mes')).toBeVisible();
  await expect(page.locator('.pr-empty__icon svg')).toHaveAttribute('width', '22');

  await component.update(<ServerSummaryRecipe state="error" />);
  await expect(page.getByText('No se pudo cargar el resumen')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Reintentar' })).toBeVisible();

  await component.update(<ServerSummaryRecipe state="forbidden" />);
  await expect(page.getByText('No tienes acceso a esta sección')).toBeVisible();
  await expect(page.locator('.pr-stat-tile')).toHaveCount(0);

  await component.update(<ServerSummaryRecipe state="loading" />);
  await expect(page.locator('.pr-stat-tile')).toHaveCount(0);
  await expect(page.locator('.pr-stat-grid')).toBeVisible();
});
