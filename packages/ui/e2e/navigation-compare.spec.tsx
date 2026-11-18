import { expect, test } from '@playwright/experimental-ct-react';
import { NavigationCompare } from '../../showcase/src/navigation/NavigationCompare';

/**
 * The comparison view must never open a real app: a click on a link to a
 * registry app changes the simulated app and leaves the browser page alone.
 */
test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
});

test('a switcher row opens the simulated app, not the real one', async ({ mount, page }) => {
  await mount(<NavigationCompare initialOption="b" />);
  const before = page.url();
  const navigations: string[] = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navigations.push(frame.url());
  });

  await expect(page.getByTestId('address-bar')).toContainText('liveops.partrunner.ai/general/routes');
  await page.locator('.pr-switcher__trigger').click();
  await page.getByRole('menuitem', { name: /Supply/ }).click();

  await expect(page.getByTestId('address-bar')).toContainText('supply.partrunner.ai/onboarding/mi-dia');
  await expect(page.getByTestId('loads')).toHaveText('1');
  await expect(page.getByText('Último evento:')).toContainText('switcher: liveops → supply');
  await expect(page.getByTestId('clicks')).toHaveText('2');
  // The way back chip shows the page left in LiveOps.
  await expect(page.getByLabel('Volver a LiveOps')).toBeVisible();
  expect(page.url()).toBe(before);
  expect(navigations).toEqual([]);
});

test('«Mis apps» opens a favorite in option C without leaving the page', async ({ mount, page }) => {
  await mount(<NavigationCompare initialOption="c" />);
  const before = page.url();
  const favorites = page.getByRole('region', { name: 'Mis apps' });
  await expect(favorites).toBeVisible();
  await favorites.getByRole('link', { name: /Supply/ }).click();
  await expect(page.getByTestId('address-bar')).toContainText('supply.partrunner.ai');
  await expect(page.getByTestId('clicks')).toHaveText('1');
  expect(page.url()).toBe(before);
});

test('«/» opens «Ir a» and a result opens a simulated page', async ({ mount, page }) => {
  await mount(<NavigationCompare initialOption="b" />);
  const before = page.url();
  // Focus the page body first: a key press needs a focused document.
  await page.getByRole('heading', { name: 'Navegación' }).click();
  await page.keyboard.press('/');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('combobox').fill('afiliacion');
  await page.getByRole('option').first().click();
  await expect(page.getByTestId('address-bar')).toContainText('supply.partrunner.ai/afiliacion');
  expect(page.url()).toBe(before);
});

test('a task counts the clicks and reports the goal', async ({ mount, page }) => {
  await mount(<NavigationCompare initialOption="b" />);
  await page.getByRole('button', { name: /En LiveOps › Todas las rutas, abre Supply/ }).click();
  await page.locator('.pr-switcher__trigger').click();
  await page.getByRole('menuitem', { name: /Supply/ }).click();
  await page.getByRole('link', { name: 'Afiliación' }).first().click();
  await expect(page.getByRole('status').filter({ hasText: 'Meta alcanzada' })).toContainText('3 clics');
});

test('the current app is highlighted in option A', async ({ mount, page }) => {
  await mount(<NavigationCompare initialOption="a" />);
  await expect(page.locator('.pr-appbar__item--current')).toHaveText('LiveOps');
  await page.getByRole('link', { name: 'Supply' }).click();
  await expect(page.locator('.pr-appbar__item--current')).toHaveText('Supply');
  await expect(page.getByText('Último evento:')).toContainText('appbar: liveops → supply');
});

test('an unknown remembered path opens the app start page', async ({ mount, page }) => {
  await page.context().addCookies([
    {
      name: 'pr-nav-last-staging',
      value: encodeURIComponent(JSON.stringify({ supply: { p: '/fleets', l: 'Flotas' } })),
      url: page.url(),
    },
  ]);
  await mount(<NavigationCompare initialOption="b" />);
  await page.locator('.pr-switcher__trigger').click();
  await page.getByRole('menuitem', { name: /Supply/ }).click();
  await expect(page.getByTestId('address-bar')).toContainText('supply.partrunner.ai/onboarding/mi-dia');
});

test('the apps grid is in B and C and its tiles stay inside the simulation', async ({ mount, page }) => {
  await mount(<NavigationCompare initialOption="c" />);
  const before = page.url();
  await page.getByRole('button', { name: 'Aplicaciones' }).click();
  await page.getByRole('menuitem', { name: /Solicitudes/ }).click();
  await expect(page.getByTestId('address-bar')).toContainText('solicitudes.partrunner.ai');
  expect(page.url()).toBe(before);
  // The selector is off by default in C and can be turned on.
  await expect(page.locator('.pr-switcher')).toHaveCount(0);
  await page.getByRole('button', { name: 'Sí', exact: true }).click();
  await expect(page.locator('.pr-switcher')).toHaveCount(1);
});
