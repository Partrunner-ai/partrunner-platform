import { expect, test } from '@playwright/experimental-ct-react';
import { LedgerTable, ToastBreaks, ToastTones } from './feedback.story';

for (const mode of ['light', 'dark'] as const) {
  test(`toasts use package tokens at the bottom right in ${mode} mode`, async ({ mount, page }) => {
    await mount(<ToastTones mode={mode} />);
    const error = page.locator('.pr-toast--error');
    await expect(error).toBeVisible();
    await expect(page.locator('.pr-toast')).toHaveCount(3);

    const viewport = page.viewportSize()!;
    const box = (await error.boundingBox())!;
    expect(box.x + box.width).toBeGreaterThan(viewport.width - 60);
    expect(box.y + box.height).toBeGreaterThan(viewport.height / 2);

    // Every toast has the same 440 px width, so a title with an action wraps in two lines.
    const widths = await page.locator('.pr-toast').evaluateAll((nodes) =>
      nodes.map((node) => Math.round(node.getBoundingClientRect().width)),
    );
    expect(widths).toEqual([440, 440, 440]);

    // The toast surface is the package surface tinted by the tone, not sonner's white card.
    const colours = await page.evaluate(() => {
      const toastNode = document.querySelector('.pr-toast--error')!;
      const title = toastNode.querySelector('.pr-toast__title')!;
      return {
        background: getComputedStyle(toastNode).backgroundColor,
        text: getComputedStyle(title).color,
        foreground: (() => {
          const probe = document.createElement('span');
          probe.style.color = 'var(--pr-fg)';
          toastNode.appendChild(probe);
          const value = getComputedStyle(probe).color;
          probe.remove();
          return value;
        })(),
      };
    });
    expect(colours.background).not.toBe('rgb(255, 255, 255)');
    expect(colours.text).toBe(colours.foreground);

    await expect(page.getByRole('alert')).toHaveText('No se pudo guardar');
    await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cerrar notificación' })).toHaveCount(3);
  });
}

test('a ledger table has 36 px rows, a 32 px pinned header, stripes and a selected bar', async ({ mount, page }) => {
  await mount(<LedgerTable />);
  const metrics = await page.evaluate(() => {
    const cells = document.querySelectorAll<HTMLElement>('tbody .pr-table__td:first-child');
    const header = document.querySelector<HTMLElement>('.pr-table__th')!;
    const style = (node: Element) => getComputedStyle(node);
    return {
      rowHeight: cells[0]!.getBoundingClientRect().height,
      headerHeight: header.getBoundingClientRect().height,
      headerPosition: style(header).position,
      fontSize: style(cells[0]!).fontSize,
      odd: style(cells[0]!).backgroundColor,
      even: style(cells[1]!).backgroundColor,
      selectedBar: style(cells[2]!).boxShadow,
      selectedBackground: style(cells[2]!).backgroundColor,
    };
  });
  expect(Math.round(metrics.rowHeight)).toBe(36);
  expect(Math.round(metrics.headerHeight)).toBe(32);
  expect(metrics.headerPosition).toBe('sticky');
  expect(metrics.fontSize).toBe('13px');
  expect(metrics.even).not.toBe(metrics.odd);
  expect(metrics.selectedBar).toContain('inset');
  expect(metrics.selectedBackground).not.toBe(metrics.odd);
});

test('toasts keep a 16 px gutter on a narrow screen', async ({ mount, page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await mount(<ToastTones />);
  await expect(page.locator('.pr-toast')).toHaveCount(3);
  const boxes = await page.locator('.pr-toast').evaluateAll((nodes) =>
    nodes.map((node) => node.getBoundingClientRect()).map(({ left, right }) => ({ left, right })),
  );
  for (const { left, right } of boxes) {
    expect(left).toBeGreaterThanOrEqual(16 - 1);
    expect(right).toBeLessThanOrEqual(360 - 16 + 1);
  }
});

test('a line break in a toast title or description shows as a line break', async ({ mount, page }) => {
  await mount(<ToastBreaks />);
  await expect(page.locator('.pr-toast')).toHaveCount(1);
  const whiteSpace = await page.evaluate(() => ({
    title: getComputedStyle(document.querySelector('.pr-toast__title')!).whiteSpace,
    description: getComputedStyle(document.querySelector('.pr-toast__description')!).whiteSpace,
    titleHeight: document.querySelector('.pr-toast__title')!.getBoundingClientRect().height,
  }));
  expect(whiteSpace.title).toBe('pre-line');
  expect(whiteSpace.description).toBe('pre-line');
  // Two lines of 14 px / 1.45 text.
  expect(whiteSpace.titleHeight).toBeGreaterThan(35);
});
