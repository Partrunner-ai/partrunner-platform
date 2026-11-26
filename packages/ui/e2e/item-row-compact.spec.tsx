import { expect, test } from '@playwright/experimental-ct-react';
import { CompactRows, ShortRows } from './item-row-compact.story';

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

  test('short rows stay vertically centred', async ({ mount, page }) => {
    await mount(<ShortRows />);
    const box = async (testId: string, selector?: string) => {
      const row = page.getByTestId(testId);
      return (await (selector ? row.locator(selector).first() : row).boundingBox())!;
    };
    const centre = async (testId: string, selector: string) => {
      const b = await box(testId, selector);
      return b.y + b.height / 2;
    };
    // A one-line row is the 36 px minimum (the first row has no divider).
    expect((await box('one-line')).height).toBe(36);
    expect(Math.abs((await centre('one-line', '.pr-item-row__title')) - (await centre('one-line', '.pr-avatar')))).toBeLessThanOrEqual(1.5);
    const noLeading = await box('no-leading');
    expect(noLeading.height).toBe(37);
    expect(Math.abs((await centre('no-leading', '.pr-item-row__title')) - (noLeading.y + 1 + (noLeading.height - 1) / 2))).toBeLessThanOrEqual(1.5);
    // Two lines already fill the row, so the avatar sits at the top: 1 px divider + 5 px padding + 2 px.
    const twoLines = await box('two-lines');
    expect(twoLines.height).toBe(45);
    expect((await box('two-lines', '.pr-avatar')).y - twoLines.y).toBeCloseTo(8, 0);
    expect(Math.abs((await centre('trailing', '.pr-item-row__title')) - (await centre('trailing', '.pr-item-row__trailing')))).toBeLessThanOrEqual(1.5);
  });

  test('a sm badge in the footer sits inside the clipped footer and keeps the row at 59 px', async ({ mount, page }) => {
    await mount(<ShortRows />);
    const row = (await page.getByTestId('sm-badge').boundingBox())!;
    expect(row.height).toBeLessThanOrEqual(60);
    const clip = await page.getByTestId('sm-badge').evaluate((li) => {
      // The footer clips at its padding box, which is its border box here.
      const footer = li.querySelector('.pr-item-row__footer')!.getBoundingClientRect();
      const badge = li.querySelector('.pr-badge')!.getBoundingClientRect();
      const top = footer.top;
      const bottom = footer.bottom;
      return { above: top - badge.top, below: badge.bottom - bottom };
    });
    expect(clip.above).toBeLessThanOrEqual(0.5);
    expect(clip.below).toBeLessThanOrEqual(0.5);
  });
});
