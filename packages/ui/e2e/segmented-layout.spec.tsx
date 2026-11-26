import { expect, test } from '@playwright/experimental-ct-react';
import { SegmentedIn } from './segmented-layout.story';

const measure = async (page: import('@playwright/test').Page) => {
  const box = (await page.getByTestId('box').boundingBox())!;
  const control = (await page.getByRole('radiogroup', { name: 'Periodo' }).boundingBox())!;
  return { box, control };
};

test.describe('SegmentedControl layout', () => {
  test('in a row with align-items: center it stays vertically centred', async ({ mount, page }) => {
    await mount(<SegmentedIn layout="row" width={600} />);
    const { box, control } = await measure(page);
    expect(Math.abs(control.y + control.height / 2 - (box.y + box.height / 2))).toBeLessThanOrEqual(1);
    expect(control.width).toBeLessThan(600);
  });

  test('fullWidth in the same row keeps its natural height and stays centred', async ({
    mount,
    page,
  }) => {
    await mount(<SegmentedIn layout="row" fullWidth width={600} />);
    const { box, control } = await measure(page);
    expect(control.height).toBeLessThan(64);
    expect(Math.abs(control.y + control.height / 2 - (box.y + box.height / 2))).toBeLessThanOrEqual(1);
  });

  for (const layout of ['column', 'grid', 'block'] as const) {
    test(`in a ${layout} it hugs its options; fullWidth fills 600 px`, async ({ mount, page }) => {
      const view = await mount(<SegmentedIn layout={layout} width={600} />);
      expect((await measure(page)).control.width).toBeLessThan(600);
      await view.update(<SegmentedIn layout={layout} fullWidth width={600} />);
      expect(Math.round((await measure(page)).control.width)).toBe(600);
    });
  }

  for (const layout of ['row', 'column', 'grid', 'block'] as const) {
    test(`in a ${layout} narrower than its options it does not overflow`, async ({
      mount,
      page,
    }) => {
      await mount(<SegmentedIn layout={layout} width={120} />);
      const { box, control } = await measure(page);
      expect(control.x + control.width).toBeLessThanOrEqual(box.x + box.width + 1);
    });
  }
});
