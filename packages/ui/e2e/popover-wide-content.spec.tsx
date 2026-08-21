import { expect, test } from '@playwright/experimental-ct-react';
import { WidePopoverAtRightEdge } from './popover-wide-content.story';

/**
 * Browser coverage is required because `offsetWidth` can report a clamp while
 * `scrollWidth` retains the content's requested width.
 */
test('a panel wider than the space beside its trigger shifts instead of clipping', async ({
  mount,
  page,
}) => {
  await mount(<WidePopoverAtRightEdge />);
  await page.getByRole('button', { name: 'Fecha' }).click();

  const panel = page.locator('.pr-popover__content');
  await expect(panel).toBeVisible();

  const [box, viewport] = [
    await panel.boundingBox(),
    page.viewportSize() ?? { width: 0, height: 0 },
  ];

  // The content is 320 wide plus the panel's own 12px padding either side.
  expect(box!.width).toBeGreaterThanOrEqual(320);
  // And it stayed on screen: shifted left, not shrunk to the gap it was opened in.
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);

  // Nothing is clipped horizontally.
  const overflow = await panel.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
});

test('every column of the content is reachable, not just laid out', async ({ mount, page }) => {
  // Width alone can lie: a panel can report the right box while its last columns sit
  // under the viewport edge. Asking the browser what is painted at each column's own
  // coordinates is the only check that covers that.
  await mount(<WidePopoverAtRightEdge />);
  await page.getByRole('button', { name: 'Fecha' }).click();
  await expect(page.locator('.pr-popover__content')).toBeVisible();

  for (let index = 0; index < 7; index += 1) {
    const column = page.getByTestId(`col-${index}`);
    const onScreen = await column.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return hit instanceof Element && (element.contains(hit) || element === hit);
    });
    expect(onScreen, `column ${index} is not visible`).toBe(true);
  }
});

test('a panel that already fits keeps its left edge on the trigger', async ({ mount, page }) => {
  // Panels that already fit should not move.
  await mount(<WidePopoverAtRightEdge />, { hooksConfig: {} });
  await page.setViewportSize({ width: 1600, height: 800 });
  await page.getByRole('button', { name: 'Fecha' }).click();

  const panel = page.locator('.pr-popover__content');
  await expect(panel).toBeVisible();
  const [triggerBox, panelBox] = [
    await page.getByRole('button', { name: 'Fecha' }).boundingBox(),
    await panel.boundingBox(),
  ];
  // Still anchored to the trigger, only nudged as far as it had to be.
  expect(panelBox!.x).toBeLessThanOrEqual(triggerBox!.x);
});
