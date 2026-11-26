import { expect, test, type Page } from '@playwright/experimental-ct-react';
import { CompactRows, ShortRows } from './item-row-compact.story';

const lineHeights = (page: Page) =>
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

const box = async (page: Page, testId: string, selector?: string) => {
  const row = page.getByTestId(testId);
  return (await (selector ? row.locator(selector).first() : row).boundingBox())!;
};
const centre = async (page: Page, testId: string, selector: string) => {
  const b = await box(page, testId, selector);
  return b.y + b.height / 2;
};

/** WCAG contrast ratio of the unread dot against the row background, from the computed colours. */
const dotContrast = (page: Page, testId: string) =>
  page.getByTestId(testId).evaluate((li) => {
    const rgb = (color: string) => {
      const context = document.createElement('canvas').getContext('2d')!;
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
      return [r!, g!, b!];
    };
    const luminance = ([r, g, b]: number[]) => {
      const [lr, lg, lb] = [r!, g!, b!].map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * lr! + 0.7152 * lg! + 0.0722 * lb!;
    };
    const main = li.querySelector('.pr-item-row__main')!;
    const dot = li.querySelector('.pr-item-row__dot')!;
    const bg = getComputedStyle(main).getPropertyValue('--pr-item-bg').trim();
    const [a, b] = [luminance(rgb(getComputedStyle(dot).backgroundColor)), luminance(rgb(bg))];
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });

test.describe('compact ItemList rhythm', () => {
  test('a three-line compact row has the dense line heights and is 59 px', async ({ mount, page }) => {
    await mount(<CompactRows badges={false} />);
    expect(await lineHeights(page)).toEqual({
      title: '18px',
      description: '16px',
      meta: '15px',
      footer: '15px',
      strongWeight: '600',
    });
    const rows = page.locator('[data-slot="item-row"]');
    // 5 + 18 + 16 + 15 + 5 = 59 px; each row after the first adds a 1 px divider.
    const heights = await rows.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
    expect(heights).toEqual([59, 60, 60, 60, 60, 60, 60, 60]);
    const first = (await rows.first().boundingBox())!;
    const last = (await rows.last().boundingBox())!;
    expect(last.y + last.height - first.y).toBe(59 + 7 * 60);
  });

  test('a sm badge in the footer makes the row 62 px and sits inside it', async ({ mount, page }) => {
    await mount(<ShortRows />);
    const row = await box(page, 'sm-badge');
    expect(row.height).toBe(63); // 62 px plus the divider
    const geometry = await page.getByTestId('sm-badge').evaluate((li) => {
      const footer = li.querySelector('.pr-item-row__footer')!.getBoundingClientRect();
      const badge = li.querySelector('.pr-badge')!.getBoundingClientRect();
      const description = li.querySelector('.pr-item-row__description')!.getBoundingClientRect();
      return {
        top: badge.top - footer.top,
        bottom: footer.bottom - badge.bottom,
        gap: badge.top - description.bottom,
        toRowBottom: li.getBoundingClientRect().bottom - badge.bottom,
        badgeCentre: badge.top + badge.height / 2,
        footerCentre: footer.top + footer.height / 2,
      };
    });
    expect(geometry.top).toBeGreaterThanOrEqual(0);
    expect(geometry.bottom).toBeGreaterThanOrEqual(0);
    expect(geometry.gap).toBeGreaterThanOrEqual(0);
    expect(geometry.toRowBottom).toBeCloseTo(5, 0); // the row padding
    expect(Math.abs(geometry.badgeCentre - geometry.footerCentre)).toBeLessThanOrEqual(0.5);
  });

  test('a md badge in the footer makes a taller row', async ({ mount, page }) => {
    await mount(<ShortRows />);
    expect((await box(page, 'md-badge')).height).toBe(65); // 64 px plus the divider: a md badge is 5 px taller than the 15 px footer line
  });

  test('comfortable rows keep their own rhythm', async ({ mount, page }) => {
    await mount(<CompactRows density="comfortable" />);
    const lines = await lineHeights(page);
    expect(lines.title).toBe('19.6px');
    expect(lines.description).toBe('18.2px');
  });

  test('short rows stay vertically centred', async ({ mount, page }) => {
    await mount(<ShortRows />);
    // A one-line row is the 36 px minimum (the first row has no divider).
    expect((await box(page, 'one-line')).height).toBe(36);
    // The avatar keeps its 2 px top offset (it aligns with the first text line in taller rows),
    // so in a 36 px row its centre is exactly 1 px below the centre of the 18 px title line.
    expect((await centre(page, 'one-line', '.pr-avatar')) - (await centre(page, 'one-line', '.pr-item-row__title'))).toBeCloseTo(1, 1);
    const noLeading = await box(page, 'no-leading');
    expect(noLeading.height).toBe(37);
    expect(Math.abs((await centre(page, 'no-leading', '.pr-item-row__title')) - (noLeading.y + 1 + (noLeading.height - 1) / 2))).toBeLessThanOrEqual(0.5);
    // Two lines already fill the row, so the avatar sits at the top: 1 px divider + 5 px padding + 2 px.
    const twoLines = await box(page, 'two-lines');
    expect(twoLines.height).toBe(45);
    expect((await box(page, 'two-lines', '.pr-avatar')).y - twoLines.y).toBe(8);
    expect(Math.abs((await centre(page, 'trailing', '.pr-item-row__title')) - (await centre(page, 'trailing', '.pr-item-row__trailing')))).toBeLessThanOrEqual(0.5);
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`the unread dot has 3:1 contrast on a normal, hovered and selected row (${theme})`, async ({ mount, page }) => {
      await mount(<ShortRows />);
      await page.evaluate((name) => document.documentElement.classList.toggle('dark', name === 'dark'), theme);
      expect(await dotContrast(page, 'unread')).toBeGreaterThanOrEqual(3);
      await page.getByTestId('unread').hover();
      expect(await dotContrast(page, 'unread')).toBeGreaterThanOrEqual(3);
      expect(await dotContrast(page, 'unread-selected')).toBeGreaterThanOrEqual(3);
      await page.getByTestId('unread-selected').hover();
      expect(await dotContrast(page, 'unread-selected')).toBeGreaterThanOrEqual(3);
    });
  }
});
