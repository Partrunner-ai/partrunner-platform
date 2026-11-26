import { expect, test } from '@playwright/experimental-ct-react';
import { CompactRows } from './item-row-compact.story';

const lineHeights = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const px = (selector: string) => {
      const node = document.querySelector(selector);
      return node ? getComputedStyle(node).lineHeight : null;
    };
    const strong = document.querySelector('.pr-item-row__description strong');
    return {
      title: px('.pr-item-row__title'),
      description: px('.pr-item-row__description'),
      meta: px('.pr-item-row__meta'),
      footer: px('.pr-item-row__footer'),
      strongWeight: strong ? getComputedStyle(strong).fontWeight : null,
    };
  });

test.describe('compact ItemList rhythm', () => {
  test('a three-line compact row keeps the dense line heights and row height', async ({
    mount,
    page,
  }) => {
    await mount(<CompactRows />);
    if (process.env.ITEM_ROW_SHOT) {
      await page.keyboard.press('Tab');
      await page.screenshot({ path: process.env.ITEM_ROW_SHOT, clip: { x: 0, y: 0, width: 420, height: 520 } });
    }
    expect(await lineHeights(page)).toEqual({
      title: '18px',
      description: '16px',
      meta: '15px',
      footer: '15px',
      strongWeight: '600',
    });
    const rows = page.locator('[data-slot="item-row"]');
    // 5 + 18 + 16 + 15 + 5 = 59 px of row, plus the 1 px divider between rows.
    for (const index of [0, 3, 7]) {
      const box = (await rows.nth(index).boundingBox())!;
      console.info(`row ${index} height ${box.height}`);
      expect(box.height).toBeLessThanOrEqual(60);
      expect(box.height).toBeGreaterThanOrEqual(59);
    }
    const first = (await rows.first().boundingBox())!;
    const last = (await rows.last().boundingBox())!;
    expect(last.y + last.height - first.y).toBeLessThanOrEqual(8 * 60);
  });

  test('comfortable rows keep their own rhythm', async ({ mount, page }) => {
    await mount(<CompactRows density="comfortable" />);
    const lines = await lineHeights(page);
    expect(lines.title).toBe('19.6px');
    expect(lines.description).toBe('18.2px');
  });
});
