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

test('renders the five screen recipes', async ({ mount, page }) => {
  await mount(<ReleaseReviewApp initialView="recipes" initialTheme="light" />);

  await expect(page.getByRole('heading', { name: 'Colocadas', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nueva colocada' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Colocadas' })).toBeVisible();

  await openRecipe(page, 'Bandeja');
  await expect(page.getByRole('heading', { name: 'Bandeja de flotas' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Vista' })).toBeVisible();
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

test('the inbox is a ticket desk: rows carry tone, speaker and footer, and the chips filter', async ({ mount, page }) => {
  await mount(<ReleaseReviewApp initialView="recipes" initialTheme="light" />);
  await openRecipe(page, 'Bandeja');

  const rows = page.locator('.pr-item-list > li');
  await expect(page.getByRole('heading', { name: '14 flotas' })).toBeVisible();
  await expect(rows).toHaveCount(14);
  // Sorted: the first rows are ours to reply, and only they carry urgency.
  await expect(rows.nth(0)).toHaveAttribute('data-tone', 'danger');
  await expect(rows.nth(2)).toHaveAttribute('data-tone', 'warning');
  await expect(rows.nth(0).locator('.pr-item-row__description strong')).toHaveText('Flota:');
  await expect(rows.nth(0).locator('.pr-item-row__footer')).toContainText('Atiende Mariana Lozano');
  await expect(rows.nth(0).locator('.pr-badge')).toContainText('Antigüedad >24 h');
  expect(await page.locator('.pr-item-list > li[data-tone]').count()).toBe(3);

  const view = page.getByRole('group', { name: 'Vista' });
  await view.getByRole('button', { name: /Esperan respuesta/ }).click();
  await expect(rows).toHaveCount(3);
  await expect(page.getByRole('heading', { name: '3 de 14 flotas' })).toBeVisible();

  // Open the thread: a person and the bot show different names; the case event is a line.
  await rows.first().getByRole('button').click();
  await expect(page.getByRole('tab', { name: 'Conversación' })).toBeVisible();
  await expect(page.locator('.chat__bubble--bot')).toHaveCount(1);
  await expect(page.locator('.chat__event')).toContainText('Aclaración abierta');
  await expect(page.locator('.chat__author', { hasText: 'Mariana Lozano' })).toHaveCount(2);
});

test('an inbox filter with no result shows an empty state with a way out', async ({ mount, page }) => {
  await mount(<ReleaseReviewApp initialView="recipes" initialTheme="light" />);
  await openRecipe(page, 'Bandeja');

  await page.getByRole('group', { name: 'Vista' }).getByRole('button', { name: /Vencidas/ }).click();
  await page.getByRole('searchbox', { name: 'Buscar flota' }).fill('zzzz');
  await expect(page.getByText('Ninguna flota con este filtro')).toBeVisible();
  await page.getByRole('button', { name: 'Quitar filtros' }).click();
  await expect(page.locator('.pr-item-list > li')).toHaveCount(14);
});

test('the feedback recipe uses one channel for each message', async ({ mount, page }) => {
  await mount(<ReleaseReviewApp initialView="recipes" initialTheme="light" />);
  await openRecipe(page, 'Avisos');
  await expect(page.getByRole('heading', { name: 'Datos fiscales', level: 1 })).toBeVisible();

  // A state that stays: a Notice.
  await expect(page.getByText('Pago de la semana 47 retenido')).toBeVisible();

  // A wrong field: the error is under the field, and no toast shows.
  await page.getByRole('button', { name: 'Guardar RFC' }).click();
  await expect(page.getByText('Escribe un RFC de 12 o 13 caracteres.')).toBeVisible();
  await expect(page.locator('.pr-toast')).toHaveCount(0);

  // The result of an action: a toast.
  await page.getByRole('textbox', { name: /RFC/ }).fill('TBA010203AB1');
  await page.getByRole('button', { name: 'Guardar RFC' }).click();
  await expect(page.locator('.pr-toast--success')).toHaveText(/RFC guardado/);

  // An action that can be undone: a toast with «Deshacer», no dialog.
  await page.getByRole('button', { name: 'Archivar ruta' }).click();
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByText('Ruta 1042 restaurada')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Archivar ruta' })).toBeEnabled();

  // A failure stays and is announced as an alert.
  await page.getByRole('button', { name: 'Enviar factura' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'No se pudo enviar la factura' })).toBeVisible();

  // An action that deletes data: a ConfirmDialog first.
  await page.getByRole('button', { name: 'Eliminar registro' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('No se puede deshacer.');
  await dialog.getByRole('button', { name: 'Eliminar registro' }).click();
  await expect(page.getByText('Registro eliminado')).toBeVisible();
});
