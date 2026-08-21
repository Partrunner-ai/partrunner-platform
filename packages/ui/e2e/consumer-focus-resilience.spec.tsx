import { expect, test } from '@playwright/experimental-ct-react';
import { HostileConsumerFields } from './consumer-focus-resilience.story';

test('input and select keep one package-owned focus ring under consumer global CSS', async ({
  mount,
  page,
}) => {
  await mount(<HostileConsumerFields />);

  const bareInput = page.getByRole('textbox', { name: 'Entrada compacta' });
  await bareInput.focus();
  await expect(bareInput).toHaveCSS('outline-style', 'none');
  await expect(bareInput).not.toHaveCSS('box-shadow', /rgb\(255, 0, 0\)/);
  await expect(bareInput).not.toHaveCSS('border-radius', '999px');

  const compositeInput = page.getByRole('textbox', { name: 'Ruta' });
  await compositeInput.focus();
  await expect(compositeInput).toHaveCSS('outline-style', 'none');
  await expect(compositeInput).toHaveCSS('box-shadow', 'none');
  await expect(compositeInput).toHaveCSS('border-radius', '0px');
  await expect(compositeInput.locator('..')).not.toHaveCSS('box-shadow', /rgb\(255, 0, 0\)/);

  const select = page.getByRole('combobox', { name: 'Tipo de unidad' });
  await select.focus();
  await expect(select).toHaveCSS('outline-style', 'none');
  await expect(select).toHaveCSS('box-shadow', 'none');
  await expect(select).toHaveCSS('border-radius', '0px');
  await expect(select.locator('..')).not.toHaveCSS('box-shadow', /rgb\(255, 0, 0\)/);

  const textarea = page.getByRole('textbox', { name: 'Observaciones' });
  await textarea.focus();
  await expect(textarea).toHaveCSS('outline-style', 'none');
  await expect(textarea).not.toHaveCSS('box-shadow', /rgb\(255, 0, 0\)/);
  await expect(textarea).not.toHaveCSS('border-radius', '999px');
});

test('choice controls delegate focus to their visible package surface', async ({ mount, page }) => {
  await mount(<HostileConsumerFields />);

  const controls = [
    page.getByRole('checkbox', { name: 'Confirmar evidencia' }),
    page.getByRole('switch', { name: 'Asignación automática' }),
    page.getByRole('radio', { name: 'Normal' }),
  ];

  for (const control of controls) {
    await control.focus();
    await expect(control).toHaveCSS('outline-style', 'none');
    await expect(control).toHaveCSS('box-shadow', 'none');
    await expect(control).toHaveCSS('border-radius', '0px');

    const visual = control.locator('..').locator('.pr-choice__visual');
    await expect(visual).not.toHaveCSS('box-shadow', /rgb\(255, 0, 0\)/);
    await expect(visual).not.toHaveCSS('box-shadow', 'none');
  }
});

test('searchable controls own trigger, search, and option focus states', async ({ mount, page }) => {
  await mount(<HostileConsumerFields />);

  const combobox = page.getByRole('combobox', { name: 'Flotilla' });
  await combobox.focus();
  await expect(combobox).toHaveCSS('outline-style', 'none');
  await expect(combobox).not.toHaveCSS('border-radius', '999px');
  await combobox.click();

  const comboboxSearch = page.getByRole('textbox', { name: 'Buscar flotilla' });
  await comboboxSearch.focus();
  await expect(comboboxSearch).toBeFocused();
  await expect(comboboxSearch).toHaveCSS('outline-style', 'none');
  await expect(comboboxSearch).toHaveCSS('box-shadow', 'none');
  await expect(comboboxSearch).toHaveCSS('border-radius', '0px');
  await expect(comboboxSearch.locator('..')).toHaveCSS('box-shadow', /inset/);

  const fleetOption = page.getByRole('option', { name: 'Fletes del Norte' });
  await page.keyboard.press('Tab');
  await expect(fleetOption).toBeFocused();
  await expect(fleetOption).toHaveCSS('outline-style', 'none');
  await expect(fleetOption).toHaveCSS('border-radius', '0px');
  await expect(fleetOption).not.toHaveCSS('box-shadow', /rgb\(255, 0, 0\)/);
  await expect(fleetOption).toHaveCSS('box-shadow', /inset/);
  await combobox.click();

  const multiselect = page.getByRole('combobox', { name: 'Regiones' });
  await multiselect.focus();
  await expect(multiselect).toHaveCSS('outline-style', 'none');
  await expect(multiselect).not.toHaveCSS('border-radius', '999px');
  await multiselect.click();

  const multiselectSearch = page.getByRole('searchbox', { name: 'Buscar regiones' });
  await multiselectSearch.focus();
  await expect(multiselectSearch).toBeFocused();
  await expect(multiselectSearch).toHaveCSS('outline-style', 'none');
  await expect(multiselectSearch).toHaveCSS('box-shadow', 'none');
  await expect(multiselectSearch).toHaveCSS('border-radius', '0px');
  await expect(multiselectSearch.locator('..')).toHaveCSS('box-shadow', /inset/);

  const regionOption = page.getByRole('option', { name: 'CDMX' });
  await page.keyboard.press('Tab');
  await expect(regionOption).toBeFocused();
  await expect(regionOption).toHaveCSS('outline-style', 'none');
  await expect(regionOption).toHaveCSS('border-radius', '0px');
  await expect(regionOption).not.toHaveCSS('box-shadow', /rgb\(255, 0, 0\)/);
  await expect(regionOption).toHaveCSS('box-shadow', /inset/);
});
