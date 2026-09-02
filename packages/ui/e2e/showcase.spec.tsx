import { expect, test } from '@playwright/experimental-ct-react';
import { ReleaseReviewApp } from '../../showcase/src/ReleaseReviewApp';

test('navigates the public component, shell, and brand catalogs', async ({
  mount,
  page,
}) => {
  await mount(
    <ReleaseReviewApp initialView="components" initialTheme="light" />,
  );

  await expect(page.getByTestId('ui-light-catalog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lists' })).toBeVisible();
  await expect(page.getByTestId('catalog-list-page')).toBeVisible();
  await page.getByRole('button', { name: 'App shell' }).click();
  await expect(page.getByTestId('shell-light-catalog')).toBeVisible();
  await page.getByRole('button', { name: 'Brand mark' }).click();
  await expect(
    page.getByRole('heading', { name: 'Package-owned artwork' }),
  ).toBeVisible();
});

test('switches the complete public showcase between themes', async ({
  mount,
  page,
}) => {
  await mount(
    <ReleaseReviewApp initialView="components" initialTheme="light" />,
  );

  await page
    .getByRole('button', { name: 'Tema: light. Cambiar a dark' })
    .click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByTestId('ui-dark-catalog')).toBeVisible();
  await expect(page.getByTestId('catalog-list-page')).toBeVisible();

  await page.getByRole('button', { name: 'App shell' }).click();
  await expect(page.getByTestId('shell-dark-catalog')).toBeVisible();

  await page
    .getByRole('button', { name: 'Tema: dark. Cambiar a light' })
    .click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await expect(page.getByTestId('shell-light-catalog')).toBeVisible();
});
