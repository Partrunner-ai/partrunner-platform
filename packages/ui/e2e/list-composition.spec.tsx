import { expect, test } from '@playwright/experimental-ct-react';
import { ListCompositionStory, ListFilterInDialogStory } from './list-composition.story';

const readState = async (page: import('@playwright/test').Page) =>
  JSON.parse((await page.getByTestId('list-state').textContent()) ?? '{}') as {
    view: string;
    viewChanges: number;
    status: string;
    range: { from: string; to: string };
    page: number;
  };

test('the date pill commits a preset, names it, and returns focus to the trigger', async ({
  mount,
  page,
}) => {
  await mount(<ListCompositionStory />);

  const trigger = page.getByRole('button', { name: 'Fechas' });
  await expect(trigger).toHaveText('Todo el tiempo');
  await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
  await trigger.click();

  const dialog = page.getByRole('dialog', { name: 'Filtrar por fechas' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('group', { name: 'Fechas' }).getByRole('button', { name: 'Todo el tiempo' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Últimos 7 días' }).click();

  await expect(dialog).toHaveCount(0);
  await expect(trigger).toHaveText('Últimos 7 días');
  await expect(trigger).toHaveClass(/pr-date-range__trigger--active/);
  await expect(trigger).toBeFocused();
  expect((await readState(page)).range).toEqual({ from: '2026-08-26', to: '2026-09-02' });
});

test('the calendar edits a draft that Aplicar commits and Escape discards', async ({
  mount,
  page,
}) => {
  await mount(<ListCompositionStory />);

  const trigger = page.getByRole('button', { name: 'Fechas' });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Filtrar por fechas' });
  const start = dialog.locator('.pr-calendar__day[data-date$="-10"]').first();
  const end = dialog.locator('.pr-calendar__day[data-date$="-14"]').first();
  const startDate = await start.getAttribute('data-date');
  const endDate = await end.getAttribute('data-date');

  await start.click();
  await end.click();
  expect((await readState(page)).range).toEqual({ from: '', to: '' });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveText('Todo el tiempo');

  await trigger.click();
  await expect(dialog.locator('.pr-date-range__bound dd').first()).toHaveText('—');
  await dialog.locator('.pr-calendar__day[data-date$="-10"]').first().click();
  await dialog.locator('.pr-calendar__day[data-date$="-14"]').first().click();
  await expect(dialog.locator('.pr-date-range__bound dd').first()).not.toHaveText('—');
  await page.getByRole('button', { name: 'Aplicar' }).click();

  await expect(dialog).toHaveCount(0);
  expect((await readState(page)).range).toEqual({ from: startDate, to: endDate });
  await expect(trigger).toHaveText(/–/);
});

test('the segmented control moves and selects by keyboard and ignores a click on the checked option', async ({
  mount,
  page,
}) => {
  await mount(<ListCompositionStory />);

  const group = page.getByRole('radiogroup', { name: 'Vista' });
  const all = group.getByRole('radio', { name: 'Todas 4' });
  const mine = group.getByRole('radio', { name: 'Mis 2' });
  await expect(all).toHaveAttribute('aria-checked', 'true');
  await expect(all).toHaveAttribute('tabindex', '0');
  await expect(mine).toHaveAttribute('tabindex', '-1');

  await all.focus();
  await page.keyboard.press('ArrowRight');
  await expect(mine).toBeFocused();
  await expect(mine).toHaveAttribute('aria-checked', 'true');
  expect((await readState(page)).view).toBe('mine');
  await expect(page.getByRole('heading', { name: /Mis colocadas/ })).toBeVisible();

  await mine.click();
  expect((await readState(page)).viewChanges).toBe(1);

  await page.keyboard.press('ArrowLeft');
  await expect(all).toBeFocused();
  await expect(all).toHaveAttribute('aria-checked', 'true');
  expect((await readState(page)).viewChanges).toBe(2);
});

test('a filter chip narrows the rows and the frame count follows', async ({ mount, page }) => {
  await mount(<ListCompositionStory />);

  const chips = page.getByRole('group', { name: 'Estado' });
  const todos = chips.getByRole('button', { name: 'Todos 4' });
  const pending = chips.getByRole('button', { name: 'Pendiente 1' });
  await expect(todos).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('img', { name: '4 filas' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Colocadas' }).locator('tbody tr')).toHaveCount(4);

  await pending.click();
  await expect(pending).toHaveAttribute('aria-pressed', 'true');
  await expect(todos).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('img', { name: '1 filas' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Colocadas' }).locator('tbody tr')).toHaveCount(1);
  expect((await readState(page)).status).toBe('pending');
});

test('every list control keeps the 40px interaction floor', async ({ mount, page }) => {
  await mount(<ListCompositionStory />);

  const targets = [
    page.getByRole('button', { name: 'Todos 4' }),
    page.getByRole('radio', { name: 'Todas 4' }),
    page.getByRole('button', { name: 'Fechas' }),
    page.locator('.pr-search-field .pr-field__control'),
  ];
  for (const target of targets) {
    const box = await target.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(40);
    expect(box!.width).toBeGreaterThanOrEqual(40);
  }
});

test('the frame is the only surface around the rows and the table keeps its region', async ({
  mount,
  page,
}) => {
  await mount(<ListCompositionStory />);

  const frame = page.locator('.pr-table-frame');
  await expect(frame).toHaveCSS('overflow', 'clip');
  const region = page.getByRole('region', { name: 'Colocadas table' });
  await expect(region).toHaveClass(/pr-table__scroll--bare/);
  await expect(region).toHaveCSS('box-shadow', 'none');
  await expect(region).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(page.getByRole('navigation', { name: 'Colocadas pages' })).toBeVisible();
});

for (const mode of ['light', 'dark'] as const) {
  test(`${mode} mode paints the active chip and the checked segment from the semantic pair`, async ({
    mount,
    page,
  }) => {
    if (mode === 'dark') await page.evaluate(() => document.documentElement.classList.add('dark'));
    await mount(<ListCompositionStory mode={mode} />);

    const fg = mode === 'dark' ? 'rgb(245, 245, 244)' : 'rgb(26, 26, 26)';
    const bg = mode === 'dark' ? 'rgb(14, 14, 16)' : 'rgb(250, 251, 253)';
    const surface = mode === 'dark' ? 'rgb(22, 22, 24)' : 'rgb(255, 255, 255)';

    const activeChip = page.getByRole('button', { name: 'Todos 4' });
    await expect(activeChip).toHaveCSS('background-color', fg);
    await expect(activeChip).toHaveCSS('color', bg);
    const inactiveChip = page.getByRole('button', { name: 'Cerrada 1' });
    await expect(inactiveChip).toHaveCSS('background-color', surface);

    const checked = page.getByRole('radio', { name: 'Todas 4' });
    await expect(checked).toHaveCSS('background-color', surface);
    await expect(checked).toHaveCSS('color', fg);
    const unchecked = page.getByRole('radio', { name: 'Mis 2' });
    await expect(unchecked).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');

    await expect(page.getByRole('button', { name: 'Fechas' })).toHaveCSS('background-color', surface);

    if (process.env.PR_CAPTURE_LIST_COMPOSITION === '1') {
      await page.screenshot({
        path: `test-results/list-composition-${mode}.png`,
        fullPage: true,
        animations: 'disabled',
      });
    }
  });
}

test('the date dialog stays inside a 390px viewport', async ({ mount, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mount(<ListCompositionStory />);

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).toBe(true);
  const trigger = page.getByRole('button', { name: 'Fechas' });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Filtrar por fechas' });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await expect(dialog.locator('.pr-calendar')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('the date pill inside a Dialog owns its portal and Escape closes only the pill', async ({
  mount,
  page,
}) => {
  await mount(<ListFilterInDialogStory />);

  const host = page.getByRole('dialog', { name: 'Filtrar colocadas' });
  await expect(host).toBeVisible();
  const trigger = host.getByRole('button', { name: 'Fechas' });
  await trigger.click();
  const picker = page.getByRole('dialog', { name: 'Filtrar por fechas' });
  await expect(picker).toBeVisible();
  await expect(picker).toHaveAttribute('data-pr-dialog-layer-owned', '');

  await page.keyboard.press('Escape');
  await expect(picker).toHaveCount(0);
  await expect(host).toBeVisible();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.getByRole('button', { name: 'Últimos 30 días' }).click();
  await expect(page.getByTestId('dialog-range')).toHaveText(
    JSON.stringify({ from: '2026-08-03', to: '2026-09-02' }),
  );
  await expect(host).toBeVisible();
});
