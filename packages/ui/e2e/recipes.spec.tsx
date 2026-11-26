import { expect, test } from '@playwright/experimental-ct-react';
import { ReleaseReviewApp } from '../../showcase/src/ReleaseReviewApp';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
});

async function openRecipe(
  page: import('@playwright/test').Page,
  name: string,
) {
  await page.getByRole('radio', { name, exact: true }).first().click();
}

test('renders the five recipes', async ({ mount, page }) => {
  await mount(<ReleaseReviewApp initialView="recipes" initialTheme="light" />);

  await expect(page.getByRole('heading', { name: 'Colocadas', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nueva colocada' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Colocadas' })).toBeVisible();

  await openRecipe(page, 'Bandeja');
  await expect(page.getByRole('heading', { name: 'Bandeja de flotas' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Conversación' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Aclaraciones' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Perfil' })).toBeVisible();

  await openRecipe(page, 'Ficha');
  await expect(page.getByRole('heading', { name: 'Transportes Aguilar del Norte', level: 1 })).toBeVisible();
  await expect(page.getByText('Pago de la semana 47 retenido')).toBeVisible();

  await openRecipe(page, 'Formulario');
  await expect(page.getByRole('heading', { name: 'Plan de pago', level: 1 })).toBeVisible();

  await openRecipe(page, 'Cola');
  await expect(page.getByRole('heading', { name: 'Saldos a cargo' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Saldos por revisar' })).toBeVisible();
});

test('the state switch shows the empty, error and no-permission states', async ({ mount, page }) => {
  await mount(<ReleaseReviewApp initialView="recipes" initialTheme="light" />);

  await page.getByRole('radio', { name: 'Vacío' }).click();
  await expect(page.getByText('Aún no hay colocadas')).toBeVisible();

  await page.getByRole('radio', { name: 'Error' }).click();
  await expect(page.getByRole('alert')).toContainText('No se pudo cargar las colocadas');
  await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();

  await page.getByRole('radio', { name: 'Sin permiso' }).click();
  await expect(page.getByText('No tienes acceso a esta sección')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nueva colocada' })).toHaveCount(0);
});

test('the form recipe shows a validation summary after a failed submit', async ({ mount, page }) => {
  await mount(<ReleaseReviewApp initialView="recipes" initialTheme="light" />);
  await openRecipe(page, 'Formulario');

  await page.getByRole('button', { name: 'Nuevo plan de pago' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nuevo plan de pago' });
  await dialog.getByRole('button', { name: 'Crear plan' }).click();
  await expect(dialog.getByText('Corrige los siguientes campos')).toBeVisible();
  await expect(dialog.getByText('Escribe el monto total.').first()).toBeVisible();
});

test('the work queue moves a balance to Planes with one row action', async ({ mount, page }) => {
  await mount(<ReleaseReviewApp initialView="recipes" initialTheme="light" />);
  await openRecipe(page, 'Cola');

  const rows = page.getByRole('region', { name: 'Saldos por revisar' }).locator('tbody tr');
  await expect(rows).toHaveCount(8);
  await rows.first().getByRole('button', { name: 'Crear plan' }).click();
  await expect(rows).toHaveCount(7);
  await expect(page.getByText('Plan creado para Ruta Dorada.')).toBeVisible();
});

test('SplitView detail pane and DetailList heading keep their own spacing', async ({ mount, page }) => {
  await mount(<ReleaseReviewApp initialView="recipes" initialTheme="light" />);
  await openRecipe(page, 'Bandeja');

  const detail = page.locator('.pr-split-view__detail-scroll');
  await expect(detail).toBeVisible();
  const padding = await detail.evaluate((node) => getComputedStyle(node).paddingLeft);
  expect(Number.parseFloat(padding)).toBeGreaterThanOrEqual(16);

  await page.getByRole('tab', { name: 'Aclaraciones' }).click();
  const margin = await page
    .locator('.pr-section-heading + .pr-detail-list')
    .first()
    .evaluate((node) => getComputedStyle(node).marginBlockStart);
  expect(Number.parseFloat(margin)).toBeGreaterThanOrEqual(16);
});
