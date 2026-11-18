import { expect, test } from '@playwright/experimental-ct-react';
import { SwitcherWithWayBack } from './shell-switcher.story';

/**
 * jsdom has no layout, so header overflow at phone width needs a real browser.
 */
for (const width of [360, 320]) {
  test(`the switcher header does not overflow at ${width}px with the way back visible`, async ({
    mount,
    page,
  }) => {
    await page.setViewportSize({ width, height: 740 });
    await mount(<SwitcherWithWayBack />);

    const chip = page.getByLabel('Volver a LiveOps');
    await expect(chip).toBeVisible();
    await expect(page.getByRole('button', { name: /Supply/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Abrir menú' })).toHaveCount(1);

    const sizes = await page.locator('.pr-global-header').evaluate((header) => ({
      header: [header.scrollWidth, header.clientWidth],
      page: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
      controlsRight: (
        header.querySelector('.pr-global-header__controls') as HTMLElement
      ).getBoundingClientRect().right,
    }));
    expect(sizes.header[0]).toBeLessThanOrEqual(sizes.header[1]!);
    expect(sizes.page[0]).toBeLessThanOrEqual(sizes.page[1]!);
    expect(sizes.controlsRight).toBeLessThanOrEqual(width);
  });
}
