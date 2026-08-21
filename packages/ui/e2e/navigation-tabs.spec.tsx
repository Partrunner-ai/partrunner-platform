import { expect, test } from '@playwright/experimental-ct-react';
import {
  NavigationTabsLinkPolicyStory,
  NavigationTabsStory,
} from './navigation-tabs.story';

test('uses route-navigation semantics and one most-specific current link', async ({
  mount,
  page,
}) => {
  await mount(<NavigationTabsStory currentPath="/workflow/send/route/123" />);

  const navigation = page.getByRole('navigation', { name: 'Case workflow' });
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole('list')).toBeVisible();
  await expect(navigation.getByRole('tab')).toHaveCount(0);
  await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'To send 4' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('link', { name: 'Cases 18' })).toHaveAttribute(
    'href',
    '/workflow',
  );
});

test('keeps external links native and explicit new-tab fields intact', async ({
  mount,
  page,
}) => {
  await mount(<NavigationTabsLinkPolicyStory />);

  const report = page.getByRole('link', { name: 'Report' });
  await expect(report).toHaveAttribute('data-router-link', '');
  await expect(report).toHaveAttribute('target', '_blank');
  await expect(report).toHaveAttribute('rel', 'noopener');

  const external = page.getByRole('link', { name: 'External guide' });
  await expect(external).not.toHaveAttribute('data-router-link');
  await expect(external).toHaveAttribute('target', '_blank');
  await expect(external).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(external).not.toHaveAttribute('aria-current');
});

for (const mode of ['light', 'dark'] as const) {
  test(`${mode} mode uses semantic warm surfaces without glow`, async ({ mount, page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mount(<NavigationTabsStory mode={mode} />);

    const story = page.getByTestId('navigation-tabs-story');
    const active = page.getByRole('link', { name: 'To send 4' });
    const accent = await story.evaluate((node) =>
      getComputedStyle(node).getPropertyValue('--pr-accent-strong').trim(),
    );
    expect(accent).not.toBe('');
    await expect(active).toHaveCSS('min-height', '40px');
    await expect(active).toHaveCSS('box-shadow', 'none');
    expect(await active.evaluate((node) => getComputedStyle(node).backgroundImage)).toBe(
      'none',
    );
    expect(await active.evaluate((node) => getComputedStyle(node).color)).toBe(
      await story.evaluate((node) => getComputedStyle(node).color),
    );

    if (mode === 'dark') {
      await expect(story).toHaveCSS('background-color', 'rgb(14, 14, 16)');
    } else {
      await expect(story).toHaveCSS('background-color', 'rgb(250, 251, 253)');
    }

    if (process.env.PR_CAPTURE_NAVIGATION_TABS === '1') {
      await page.screenshot({
        path: `test-results/navigation-tabs-${mode}-1280.png`,
        fullPage: true,
      });
    }
  });
}

test('keeps a later current route visible in a 375px horizontal list', async ({
  mount,
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await mount(
    <NavigationTabsStory mode="dark" currentPath="/workflow/penalties/case/123" />,
  );

  const list = page.getByRole('navigation', { name: 'Case workflow' }).getByRole('list');
  const active = page.getByRole('link', { name: 'Penalties' });
  await expect(active).toHaveAttribute('aria-current', 'page');
  await expect
    .poll(async () => list.evaluate((node) => node.scrollLeft))
    .toBeGreaterThan(0);

  const [listBox, activeBox] = await Promise.all([list.boundingBox(), active.boundingBox()]);
  expect(listBox).not.toBeNull();
  expect(activeBox).not.toBeNull();
  expect(activeBox!.x).toBeGreaterThanOrEqual(listBox!.x - 1);
  expect(activeBox!.x + activeBox!.width).toBeLessThanOrEqual(
    listBox!.x + listBox!.width + 1,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    375,
  );

  if (process.env.PR_CAPTURE_NAVIGATION_TABS === '1') {
    await page.screenshot({
      path: 'test-results/navigation-tabs-dark-375.png',
      fullPage: true,
    });
  }
});

test('moves a newly current route into view after the host path changes', async ({
  mount,
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  const component = await mount(
    <NavigationTabsStory mode="dark" currentPath="/workflow" />,
  );
  const list = page.getByRole('navigation', { name: 'Case workflow' }).getByRole('list');
  await expect(page.getByRole('link', { name: 'Cases 18' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(await list.evaluate((node) => node.scrollLeft)).toBe(0);

  await component.update(
    <NavigationTabsStory mode="dark" currentPath="/workflow/penalties/case/123" />,
  );
  const active = page.getByRole('link', { name: 'Penalties' });
  await expect(active).toHaveAttribute('aria-current', 'page');
  await expect
    .poll(async () => list.evaluate((node) => node.scrollLeft))
    .toBeGreaterThan(0);

  const [listBox, activeBox] = await Promise.all([list.boundingBox(), active.boundingBox()]);
  expect(listBox).not.toBeNull();
  expect(activeBox).not.toBeNull();
  expect(activeBox!.x).toBeGreaterThanOrEqual(listBox!.x - 1);
  expect(activeBox!.x + activeBox!.width).toBeLessThanOrEqual(
    listBox!.x + listBox!.width + 1,
  );
});

test('realigns the current route when a wide navigation narrows', async ({
  mount,
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await mount(
    <NavigationTabsStory mode="dark" currentPath="/workflow/penalties/case/123" />,
  );

  const list = page.getByRole('navigation', { name: 'Case workflow' }).getByRole('list');
  const active = page.getByRole('link', { name: 'Penalties' });
  expect(await list.evaluate((node) => node.scrollLeft)).toBe(0);

  await page.setViewportSize({ width: 375, height: 667 });

  await expect
    .poll(async () => list.evaluate((node) => node.scrollLeft))
    .toBeGreaterThan(0);
  const [listBox, activeBox] = await Promise.all([list.boundingBox(), active.boundingBox()]);
  expect(listBox).not.toBeNull();
  expect(activeBox).not.toBeNull();
  expect(activeBox!.x).toBeGreaterThanOrEqual(listBox!.x - 1);
  expect(activeBox!.x + activeBox!.width).toBeLessThanOrEqual(
    listBox!.x + listBox!.width + 1,
  );
});

test('keeps native keyboard focus and href behavior', async ({ mount, page }) => {
  await mount(<NavigationTabsStory />);
  const first = page.getByRole('link', { name: 'Cases 18' });
  const list = page.getByRole('navigation', { name: 'Case workflow' }).getByRole('list');

  await page.keyboard.press('Tab');
  await expect(first).toBeFocused();
  await expect(first).not.toHaveCSS('box-shadow', 'none');
  expect(await first.getAttribute('href')).toBe('/workflow');

  const [listBox, linkBox] = await Promise.all([list.boundingBox(), first.boundingBox()]);
  expect(listBox).not.toBeNull();
  expect(linkBox).not.toBeNull();
  expect(linkBox!.x - listBox!.x).toBeGreaterThanOrEqual(4);
  expect(linkBox!.y - listBox!.y).toBeGreaterThanOrEqual(4);
  expect(listBox!.y + listBox!.height - (linkBox!.y + linkBox!.height)).toBeGreaterThanOrEqual(
    4,
  );
});

test('keeps the whole focus ring visible for first, middle, and last links at 375px', async ({
  mount,
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await mount(<NavigationTabsStory currentPath="/workflow" />);

  const navigation = page.getByRole('navigation', { name: 'Case workflow' });
  const list = navigation.getByRole('list');
  const links = navigation.getByRole('link');
  const checkpoints = [
    { index: 0, tabs: 1 },
    { index: 4, tabs: 4 },
    { index: 7, tabs: 3 },
  ] as const;

  for (const checkpoint of checkpoints) {
    for (let press = 0; press < checkpoint.tabs; press += 1) {
      await page.keyboard.press('Tab');
    }

    const link = links.nth(checkpoint.index);
    await expect(link).toBeFocused();
    await expect(link).not.toHaveCSS('box-shadow', 'none');

    const [listBox, linkBox, boxShadow] = await Promise.all([
      list.boundingBox(),
      link.boundingBox(),
      link.evaluate((node) => getComputedStyle(node).boxShadow),
    ]);
    expect(listBox).not.toBeNull();
    expect(linkBox).not.toBeNull();
    expect(boxShadow).toMatch(/0px 0px 0px 4px/);

    expect(linkBox!.x - listBox!.x).toBeGreaterThanOrEqual(4);
    expect(listBox!.x + listBox!.width - (linkBox!.x + linkBox!.width)).toBeGreaterThanOrEqual(
      4,
    );
    expect(linkBox!.y - listBox!.y).toBeGreaterThanOrEqual(4);
    expect(listBox!.y + listBox!.height - (linkBox!.y + linkBox!.height)).toBeGreaterThanOrEqual(
      4,
    );
  }

  const last = links.nth(7);
  await links.nth(0).locator('.pr-navigation-tabs__label').evaluate((node) => {
    node.textContent = 'Casos operativos con una etiqueta que terminó de cargar';
  });
  await expect(last).toBeFocused();
  await expect
    .poll(async () => {
      const [listBox, linkBox] = await Promise.all([list.boundingBox(), last.boundingBox()]);
      if (!listBox || !linkBox) return -1;
      return Math.min(
        linkBox.x - listBox.x,
        listBox.x + listBox.width - (linkBox.x + linkBox.width),
      );
    })
    .toBeGreaterThanOrEqual(4);

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    375,
  );
});
