import { expect, test } from '@playwright/experimental-ct-react';
import { FileDropzoneFormStory, FileDropzoneStory } from './file-dropzone.story';

test('keeps a dropped file in native required validity and FormData', async ({
  mount,
  page,
}) => {
  await mount(<FileDropzoneFormStory />);
  const input = page.getByLabel('Archivo CSV de rutas');

  expect(await input.evaluate((node) => (node as HTMLInputElement).checkValidity())).toBe(false);

  await input.evaluate((node) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['route_id\n1'], 'arrastrado.csv', { type: 'text/csv' }));
    node.closest('.pr-file-dropzone')?.dispatchEvent(
      new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }),
    );
  });

  expect(
    await input.evaluate((node) =>
      Array.from((node as HTMLInputElement).files ?? [], (file) => file.name),
    ),
  ).toEqual(['arrastrado.csv']);
  expect(await input.evaluate((node) => (node as HTMLInputElement).checkValidity())).toBe(true);
  expect(
    await page.getByTestId('file-dropzone-form').evaluate((form) =>
      Array.from(new FormData(form as HTMLFormElement).getAll('routes'), (value) =>
        value instanceof File ? value.name : value,
      ),
    ),
  ).toEqual(['arrastrado.csv']);
});

test('replaces a selected file with a distinct file that has identical metadata', async ({
  mount,
  page,
}) => {
  await mount(<FileDropzoneFormStory />);
  const input = page.getByLabel('Archivo CSV de rutas');

  await input.evaluate((node) => {
    const transfer = new DataTransfer();
    transfer.items.add(
      new File(['AAAA'], 'mismo.csv', { type: 'text/csv', lastModified: 101 }),
    );
    (node as HTMLInputElement).files = transfer.files;
    node.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page.getByTestId('callback-file-contents')).toHaveText('AAAA');
  await expect(page.getByTestId('selected-file-contents')).toHaveText('AAAA');

  const nativeIsReplacement = await input.evaluate((node) => {
    const replacement = new File(['BBBB'], 'mismo.csv', {
      type: 'text/csv',
      lastModified: 101,
    });
    const transfer = new DataTransfer();
    transfer.items.add(replacement);
    node.closest('.pr-file-dropzone')?.dispatchEvent(
      new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }),
    );
    return (node as HTMLInputElement).files?.[0] === replacement;
  });

  expect(nativeIsReplacement).toBe(true);
  await expect(page.getByTestId('selection-count')).toHaveText('2');
  await expect(page.getByTestId('callback-file-contents')).toHaveText('BBBB');
  await expect(page.getByTestId('selected-file-contents')).toHaveText('BBBB');
  await expect(page.locator('.pr-file-dropzone__file')).toHaveCount(1);
  await expect(page.locator('.pr-file-dropzone__file')).toContainText('mismo.csv');
  expect(
    await input.evaluate(async (node) => (node as HTMLInputElement).files?.[0]?.text()),
  ).toBe('BBBB');
  expect(
    await page.getByTestId('file-dropzone-form').evaluate(async (form) => {
      const value = new FormData(form as HTMLFormElement).get('routes');
      return value instanceof File ? value.text() : value;
    }),
  ).toBe('BBBB');
});

test('a rejected-only replacement clears callback, summary, and native form state', async ({
  mount,
  page,
}) => {
  await mount(<FileDropzoneFormStory />);
  const input = page.getByLabel('Archivo CSV de rutas');
  const dropzone = page.locator('.pr-file-dropzone');

  await input.setInputFiles({
    name: 'valido.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('valid'),
  });
  await expect(page.getByTestId('selection-count')).toHaveText('1');
  await expect(page.getByTestId('selected-file-contents')).toHaveText('valid');

  await input.evaluate((node) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['invalid'], 'notas.txt', { type: 'text/plain' }));
    (node as HTMLInputElement).files = transfer.files;
    node.dispatchEvent(new Event('change', { bubbles: true }));
  });

  await expect(page.getByTestId('selection-count')).toHaveText('2');
  await expect(page.getByTestId('rejected-files')).toHaveText('notas.txt');
  await expect(page.getByTestId('callback-file-contents')).toHaveText('');
  await expect(page.getByTestId('selected-file-contents')).toHaveText('');
  await expect(dropzone).toHaveAttribute('data-state', 'empty');
  await expect(page.locator('.pr-file-dropzone__files')).toHaveCount(0);
  await expect(page.getByText('valido.csv')).toHaveCount(0);
  expect(await input.evaluate((node) => (node as HTMLInputElement).files?.length)).toBe(0);
  expect(await input.evaluate((node) => (node as HTMLInputElement).checkValidity())).toBe(false);
  expect(
    await page.getByTestId('file-dropzone-form').evaluate((form) =>
      new FormData(form as HTMLFormElement)
        .getAll('routes')
        .filter((value): value is File => value instanceof File && value.name !== '')
        .map((file) => file.name),
    ),
  ).toEqual([]);
});

test('syncs an external controlled file into native validity and FormData without a callback', async ({
  mount,
  page,
}) => {
  await mount(<FileDropzoneFormStory />);
  const input = page.getByLabel('Archivo CSV de rutas');

  await page.getByRole('button', { name: 'Usar archivo externo A' }).click();

  await expect(page.getByTestId('selection-count')).toHaveText('0');
  await expect(page.getByTestId('selected-file-contents')).toHaveText('external-a');
  await expect(page.locator('.pr-file-dropzone__file')).toContainText('externo-a.csv');
  expect(await input.evaluate((node) => (node as HTMLInputElement).files?.length)).toBe(1);
  expect(
    await input.evaluate(async (node) => (node as HTMLInputElement).files?.[0]?.text()),
  ).toBe('external-a');
  expect(await input.evaluate((node) => (node as HTMLInputElement).checkValidity())).toBe(true);
  expect(
    await page.getByTestId('file-dropzone-form').evaluate(async (form) => {
      const value = new FormData(form as HTMLFormElement).get('routes');
      return value instanceof File ? value.text() : value;
    }),
  ).toBe('external-a');
});

test('normalizes controlled files through accept and single-file constraints without callbacks', async ({
  mount,
  page,
}) => {
  await mount(<FileDropzoneFormStory />);
  const input = page.getByLabel('Archivo CSV de rutas');
  const dropzone = page.locator('.pr-file-dropzone');

  await page.getByRole('button', { name: 'Usar selección externa mixta' }).click();

  await expect(page.getByTestId('selected-file-contents')).toHaveText('notes|routes|extra');
  await expect(page.getByTestId('selection-count')).toHaveText('0');
  await expect(page.getByTestId('selection-source')).toHaveText('');
  await expect(page.getByTestId('rejected-files')).toHaveText('');
  await expect(dropzone.locator('.pr-file-dropzone__file')).toHaveCount(1);
  await expect(dropzone.locator('.pr-file-dropzone__file')).toContainText('rutas.csv');
  await expect(dropzone).not.toContainText('notas.txt');
  await expect(dropzone).not.toContainText('rutas-extra.csv');
  expect(
    await input.evaluate((node) =>
      Array.from((node as HTMLInputElement).files ?? [], (file) => file.name),
    ),
  ).toEqual(['rutas.csv']);
  expect(await input.evaluate((node) => (node as HTMLInputElement).checkValidity())).toBe(true);
  expect(
    await page.getByTestId('file-dropzone-form').evaluate((form) =>
      Array.from(new FormData(form as HTMLFormElement).getAll('routes'), (value) =>
        value instanceof File ? value.name : value,
      ),
    ),
  ).toEqual(['rutas.csv']);
});

test('keeps ignored controlled picker and drop replacements aligned with native form state', async ({
  mount,
  page,
}) => {
  await mount(
    <FileDropzoneFormStory ignoreNonEmptySelection recreateControlledSelection />,
  );
  const input = page.getByLabel('Archivo CSV de rutas');
  const dropzone = page.locator('.pr-file-dropzone');
  const form = page.getByTestId('file-dropzone-form');

  await page.getByRole('button', { name: 'Usar archivo externo A' }).click();
  await expect(page.getByTestId('selected-file-contents')).toHaveText('external-a');
  await expect(dropzone.locator('.pr-file-dropzone__file')).toContainText('externo-a.csv');

  await input.setInputFiles({
    name: 'selector.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('picker-replacement'),
  });

  await expect(page.getByTestId('selection-count')).toHaveText('1');
  await expect(page.getByTestId('callback-file-contents')).toHaveText('picker-replacement');
  await expect(page.getByTestId('selected-file-contents')).toHaveText('external-a');
  await expect(dropzone.locator('.pr-file-dropzone__file')).toHaveCount(1);
  await expect(dropzone.locator('.pr-file-dropzone__file')).toContainText('selector.csv');
  expect(
    await input.evaluate((node) =>
      Array.from((node as HTMLInputElement).files ?? [], (file) => file.name),
    ),
  ).toEqual(['selector.csv']);
  expect(await input.evaluate((node) => (node as HTMLInputElement).checkValidity())).toBe(true);
  expect(
    await form.evaluate(async (node) => {
      const value = new FormData(node as HTMLFormElement).get('routes');
      return value instanceof File ? [value.name, await value.text()] : value;
    }),
  ).toEqual(['selector.csv', 'picker-replacement']);

  await input.evaluate((node) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['drop-replacement'], 'arrastrado.csv', { type: 'text/csv' }));
    node.closest('.pr-file-dropzone')?.dispatchEvent(
      new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }),
    );
  });

  await expect(page.getByTestId('selection-count')).toHaveText('2');
  await expect(page.getByTestId('callback-file-contents')).toHaveText('drop-replacement');
  await expect(page.getByTestId('selected-file-contents')).toHaveText('external-a');
  await expect(dropzone.locator('.pr-file-dropzone__file')).toHaveCount(1);
  await expect(dropzone.locator('.pr-file-dropzone__file')).toContainText('arrastrado.csv');
  expect(
    await input.evaluate((node) =>
      Array.from((node as HTMLInputElement).files ?? [], (file) => file.name),
    ),
  ).toEqual(['arrastrado.csv']);
  expect(await input.evaluate((node) => (node as HTMLInputElement).checkValidity())).toBe(true);
  expect(
    await form.evaluate(async (node) => {
      const value = new FormData(node as HTMLFormElement).get('routes');
      return value instanceof File ? [value.name, await value.text()] : value;
    }),
  ).toEqual(['arrastrado.csv', 'drop-replacement']);

  await page.getByRole('button', { name: 'Usar archivo externo B' }).click();

  await expect(page.getByTestId('selection-count')).toHaveText('2');
  await expect(page.getByTestId('selected-file-contents')).toHaveText('external-b');
  await expect(dropzone.locator('.pr-file-dropzone__file')).toContainText('externo-b.csv');
  expect(
    await input.evaluate((node) =>
      Array.from((node as HTMLInputElement).files ?? [], (file) => file.name),
    ),
  ).toEqual(['externo-b.csv']);
  expect(
    await form.evaluate(async (node) => {
      const value = new FormData(node as HTMLFormElement).get('routes');
      return value instanceof File ? [value.name, await value.text()] : value;
    }),
  ).toEqual(['externo-b.csv', 'external-b']);
});

test('replaces a native selection with a different external controlled file without a callback', async ({
  mount,
  page,
}) => {
  await mount(<FileDropzoneFormStory />);
  const input = page.getByLabel('Archivo CSV de rutas');

  await input.setInputFiles({
    name: 'nativo.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('native'),
  });
  await expect(page.getByTestId('selection-count')).toHaveText('1');
  await expect(page.getByTestId('callback-file-contents')).toHaveText('native');

  await page.getByRole('button', { name: 'Usar archivo externo B' }).click();

  await expect(page.getByTestId('selection-count')).toHaveText('1');
  await expect(page.getByTestId('callback-file-contents')).toHaveText('native');
  await expect(page.getByTestId('selected-file-contents')).toHaveText('external-b');
  await expect(page.locator('.pr-file-dropzone__file')).toContainText('externo-b.csv');
  expect(
    await input.evaluate(async (node) => (node as HTMLInputElement).files?.[0]?.text()),
  ).toBe('external-b');
  expect(
    await page.getByTestId('file-dropzone-form').evaluate(async (form) => {
      const value = new FormData(form as HTMLFormElement).get('routes');
      return value instanceof File ? value.text() : value;
    }),
  ).toBe('external-b');
});

test('fails an unsupported external controlled sync closed without emitting a callback', async ({
  mount,
  page,
}) => {
  await mount(<FileDropzoneFormStory />);
  const input = page.getByLabel('Archivo CSV de rutas');
  const dropzone = page.locator('.pr-file-dropzone');

  await page.evaluate(() => {
    Reflect.set(window, '__prOriginalDataTransfer', window.DataTransfer);
    Object.defineProperty(window, 'DataTransfer', { configurable: true, value: undefined });
  });
  try {
    await page.getByRole('button', { name: 'Usar archivo externo A' }).click();
    await expect(page.getByTestId('selected-file-contents')).toHaveText('external-a');
    await expect(page.getByTestId('selection-count')).toHaveText('0');
    await expect(dropzone).toHaveAttribute('data-state', 'empty');
    await expect(page.locator('.pr-file-dropzone__files')).toHaveCount(0);
    expect(await input.evaluate((node) => (node as HTMLInputElement).files?.length)).toBe(0);
    expect(await input.evaluate((node) => (node as HTMLInputElement).checkValidity())).toBe(false);
  } finally {
    await page.evaluate(() => {
      Object.defineProperty(window, 'DataTransfer', {
        configurable: true,
        value: Reflect.get(window, '__prOriginalDataTransfer'),
      });
      Reflect.deleteProperty(window, '__prOriginalDataTransfer');
    });
  }
});

test('fails a rejected native files assignment closed without emitting a callback', async ({
  mount,
  page,
}) => {
  await mount(<FileDropzoneFormStory />);
  const input = page.getByLabel('Archivo CSV de rutas');
  const dropzone = page.locator('.pr-file-dropzone');

  await page.evaluate(() => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files');
    if (!descriptor) throw new Error('HTMLInputElement.files descriptor is unavailable');
    Reflect.set(window, '__prOriginalInputFilesDescriptor', descriptor);
    Object.defineProperty(HTMLInputElement.prototype, 'files', {
      ...descriptor,
      set() {
        throw new DOMException('File assignment blocked');
      },
    });
  });
  try {
    await page.getByRole('button', { name: 'Usar archivo externo A' }).click();
    await expect(page.getByTestId('selected-file-contents')).toHaveText('external-a');
    await expect(page.getByTestId('selection-count')).toHaveText('0');
    await expect(dropzone).toHaveAttribute('data-state', 'empty');
    await expect(page.locator('.pr-file-dropzone__files')).toHaveCount(0);
    expect(await input.evaluate((node) => (node as HTMLInputElement).files?.length)).toBe(0);
    expect(await input.evaluate((node) => (node as HTMLInputElement).checkValidity())).toBe(false);
    expect(
      await page.getByTestId('file-dropzone-form').evaluate((form) =>
        new FormData(form as HTMLFormElement)
          .getAll('routes')
          .filter((value): value is File => value instanceof File && value.name !== '')
          .map((file) => file.name),
      ),
    ).toEqual([]);
  } finally {
    await page.evaluate(() => {
      const descriptor = Reflect.get(window, '__prOriginalInputFilesDescriptor');
      if (descriptor) Object.defineProperty(HTMLInputElement.prototype, 'files', descriptor);
      Reflect.deleteProperty(window, '__prOriginalInputFilesDescriptor');
    });
  }
});

test('native form reset clears uncontrolled state and reports a picker clear', async ({
  mount,
  page,
}) => {
  await mount(<FileDropzoneFormStory controlled={false} />);
  const input = page.getByLabel('Archivo CSV de rutas');

  await input.setInputFiles({
    name: 'rutas.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('routes'),
  });
  await expect(page.locator('.pr-file-dropzone__file')).toContainText('rutas.csv');

  await page.getByRole('button', { name: 'Reiniciar formulario' }).click();

  await expect(page.getByTestId('reset-attempt-count')).toHaveText('1');
  await expect(page.getByTestId('selection-count')).toHaveText('2');
  await expect(page.getByTestId('selection-source')).toHaveText('picker');
  await expect(page.getByTestId('callback-file-contents')).toHaveText('');
  await expect(page.locator('.pr-file-dropzone__files')).toHaveCount(0);
  expect(await input.evaluate((node) => (node as HTMLInputElement).files?.length)).toBe(0);
  expect(await input.evaluate((node) => (node as HTMLInputElement).checkValidity())).toBe(false);
});

test('controlled form reset stays empty when its parent ignores the clear request', async ({
  mount,
  page,
}) => {
  await mount(<FileDropzoneFormStory ignoreEmptySelection />);
  const input = page.getByLabel('Archivo CSV de rutas');
  const dropzone = page.locator('.pr-file-dropzone');

  await input.setInputFiles({
    name: 'rutas.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('routes'),
  });
  await expect(page.getByTestId('selected-file-contents')).toHaveText('routes');

  await page.getByRole('button', { name: 'Reiniciar formulario' }).click();

  await expect(page.getByTestId('selection-count')).toHaveText('2');
  await expect(page.getByTestId('selection-source')).toHaveText('picker');
  await expect(page.getByTestId('callback-file-contents')).toHaveText('');
  await expect(page.getByTestId('selected-file-contents')).toHaveText('routes');
  await expect(dropzone).toHaveAttribute('data-state', 'empty');
  await expect(page.locator('.pr-file-dropzone__files')).toHaveCount(0);
  expect(await input.evaluate((node) => (node as HTMLInputElement).files?.length)).toBe(0);
  expect(await input.evaluate((node) => (node as HTMLInputElement).checkValidity())).toBe(false);

  await page.getByRole('button', { name: 'Usar archivo externo B' }).click();
  await expect(page.getByTestId('selection-count')).toHaveText('2');
  await expect(dropzone).toHaveAttribute('data-state', 'selected');
  await expect(page.locator('.pr-file-dropzone__file')).toContainText('externo-b.csv');
  expect(
    await input.evaluate(async (node) => (node as HTMLInputElement).files?.[0]?.text()),
  ).toBe('external-b');
  expect(await input.evaluate((node) => (node as HTMLInputElement).checkValidity())).toBe(true);
});

test('preserves file and form state when the owning form cancels reset', async ({
  mount,
  page,
}) => {
  await mount(<FileDropzoneFormStory controlled={false} cancelReset />);
  const input = page.getByLabel('Archivo CSV de rutas');
  const auxiliaryInput = page.getByLabel('Estado auxiliar');
  const dropzone = page.locator('.pr-file-dropzone');
  const form = page.getByTestId('file-dropzone-form');

  await input.setInputFiles({
    name: 'conservar.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('keep-file'),
  });
  await auxiliaryInput.fill('edited-and-retained');
  await expect(page.getByTestId('selection-count')).toHaveText('1');
  await expect(dropzone.locator('.pr-file-dropzone__file')).toContainText('conservar.csv');

  await page.getByRole('button', { name: 'Reiniciar formulario' }).click();

  await expect(page.getByTestId('reset-attempt-count')).toHaveText('1');
  await expect(page.getByTestId('canceled-reset-count')).toHaveText('1');
  await expect(page.getByTestId('selection-count')).toHaveText('1');
  await expect(page.getByTestId('selection-source')).toHaveText('picker');
  await expect(page.getByTestId('callback-file-contents')).toHaveText('keep-file');
  await expect(dropzone.locator('.pr-file-dropzone__file')).toHaveCount(1);
  await expect(dropzone.locator('.pr-file-dropzone__file')).toContainText('conservar.csv');
  await expect(auxiliaryInput).toHaveValue('edited-and-retained');
  expect(
    await input.evaluate((node) =>
      Array.from((node as HTMLInputElement).files ?? [], (file) => file.name),
    ),
  ).toEqual(['conservar.csv']);
  expect(await input.evaluate((node) => (node as HTMLInputElement).checkValidity())).toBe(true);
  expect(
    await form.evaluate(async (node) => {
      const value = new FormData(node as HTMLFormElement).get('routes');
      return value instanceof File ? [value.name, await value.text()] : value;
    }),
  ).toEqual(['conservar.csv', 'keep-file']);
});

test('preserves file state when a native reset listener cancels propagation', async ({
  mount,
  page,
}) => {
  await mount(<FileDropzoneFormStory controlled={false} />);
  const input = page.getByLabel('Archivo CSV de rutas');
  const auxiliaryInput = page.getByLabel('Estado auxiliar');
  const dropzone = page.locator('.pr-file-dropzone');
  const form = page.getByTestId('file-dropzone-form');

  await input.setInputFiles({
    name: 'conservar-nativo.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('keep-native-file'),
  });
  await auxiliaryInput.fill('native-listener-retained');
  await form.evaluate((node) => {
    node.addEventListener(
      'reset',
      (event) => {
        event.preventDefault();
        event.stopPropagation();
      },
      { once: true },
    );
  });

  await page.getByRole('button', { name: 'Reiniciar formulario' }).click();

  await expect(page.getByTestId('reset-attempt-count')).toHaveText('0');
  await expect(page.getByTestId('selection-count')).toHaveText('1');
  await expect(page.getByTestId('callback-file-contents')).toHaveText('keep-native-file');
  await expect(dropzone.locator('.pr-file-dropzone__file')).toHaveCount(1);
  await expect(dropzone.locator('.pr-file-dropzone__file')).toContainText(
    'conservar-nativo.csv',
  );
  await expect(auxiliaryInput).toHaveValue('native-listener-retained');
  expect(
    await input.evaluate((node) =>
      Array.from((node as HTMLInputElement).files ?? [], (file) => file.name),
    ),
  ).toEqual(['conservar-nativo.csv']);
  expect(await input.evaluate((node) => (node as HTMLInputElement).checkValidity())).toBe(true);
  expect(
    await form.evaluate(async (node) => {
      const value = new FormData(node as HTMLFormElement).get('routes');
      return value instanceof File ? [value.name, await value.text()] : value;
    }),
  ).toEqual(['conservar-nativo.csv', 'keep-native-file']);
});

test('an imperative ref clear reconciles through the native picker change seam', async ({
  mount,
  page,
}) => {
  await mount(<FileDropzoneFormStory controlled={false} />);
  const input = page.getByLabel('Archivo CSV de rutas');

  await input.setInputFiles({
    name: 'rutas.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('routes'),
  });
  await page.getByRole('button', { name: 'Limpiar por referencia' }).click();

  await expect(page.getByTestId('selection-count')).toHaveText('2');
  await expect(page.getByTestId('selection-source')).toHaveText('picker');
  await expect(page.locator('.pr-file-dropzone__files')).toHaveCount(0);
  expect(await input.evaluate((node) => (node as HTMLInputElement).files?.length)).toBe(0);
  expect(await input.evaluate((node) => (node as HTMLInputElement).checkValidity())).toBe(false);
});

test('filters rejected and extra picker files from the single native value', async ({
  mount,
  page,
}) => {
  await mount(<FileDropzoneFormStory />);
  const input = page.getByLabel('Archivo CSV de rutas');

  await input.evaluate((node) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['first'], 'primero.csv', { type: 'text/csv' }));
    transfer.items.add(new File(['second'], 'segundo.csv', { type: 'text/csv' }));
    transfer.items.add(new File(['notes'], 'notas.txt', { type: 'text/plain' }));
    (node as HTMLInputElement).files = transfer.files;
    node.dispatchEvent(new Event('change', { bubbles: true }));
  });

  await expect(page.getByTestId('rejected-files')).toHaveText('segundo.csv,notas.txt');
  expect(
    await input.evaluate((node) =>
      Array.from((node as HTMLInputElement).files ?? [], (file) => file.name),
    ),
  ).toEqual(['primero.csv']);
  expect(
    await page.getByTestId('file-dropzone-form').evaluate((form) =>
      Array.from(new FormData(form as HTMLFormElement).getAll('routes'), (value) =>
        value instanceof File ? value.name : value,
      ),
    ),
  ).toEqual(['primero.csv']);
});

test('keeps every accepted picker file when multiple is enabled', async ({ mount, page }) => {
  await mount(<FileDropzoneFormStory multiple />);
  const input = page.getByLabel('Archivo CSV de rutas');

  await input.evaluate((node) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['first'], 'primero.csv', { type: 'text/csv' }));
    transfer.items.add(new File(['second'], 'segundo.csv', { type: 'text/csv' }));
    transfer.items.add(new File(['notes'], 'notas.txt', { type: 'text/plain' }));
    (node as HTMLInputElement).files = transfer.files;
    node.dispatchEvent(new Event('change', { bubbles: true }));
  });

  await expect(page.getByTestId('rejected-files')).toHaveText('notas.txt');
  expect(
    await input.evaluate((node) =>
      Array.from((node as HTMLInputElement).files ?? [], (file) => file.name),
    ),
  ).toEqual(['primero.csv', 'segundo.csv']);
  expect(
    await page.getByTestId('file-dropzone-form').evaluate((form) =>
      Array.from(new FormData(form as HTMLFormElement).getAll('routes'), (value) =>
        value instanceof File ? value.name : value,
      ),
    ),
  ).toEqual(['primero.csv', 'segundo.csv']);
});

test('a controlled clear resets native validity and permits the same file retry', async ({
  mount,
  page,
}) => {
  await mount(<FileDropzoneFormStory />);
  const input = page.getByLabel('Archivo CSV de rutas');
  const routes = {
    name: 'rutas.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('route_id\n1'),
  };

  await input.setInputFiles(routes);
  await expect(page.getByTestId('selection-count')).toHaveText('1');
  expect(await input.evaluate((node) => (node as HTMLInputElement).checkValidity())).toBe(true);

  await page.getByRole('button', { name: 'Limpiar archivo' }).click();
  expect(await input.evaluate((node) => (node as HTMLInputElement).value)).toBe('');
  expect(await input.evaluate((node) => (node as HTMLInputElement).files?.length)).toBe(0);
  expect(await input.evaluate((node) => (node as HTMLInputElement).checkValidity())).toBe(false);

  await input.setInputFiles(routes);
  await expect(page.getByTestId('selection-count')).toHaveText('2');
  await expect(page.getByText('rutas.csv')).toBeVisible();
});

test('fails native form state closed when the browser cannot construct DataTransfer', async ({
  mount,
  page,
}) => {
  await mount(<FileDropzoneFormStory />);
  const input = page.getByLabel('Archivo CSV de rutas');

  await input.evaluate((node) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['first'], 'primero.csv', { type: 'text/csv' }));
    transfer.items.add(new File(['notes'], 'notas.txt', { type: 'text/plain' }));
    const descriptor = Object.getOwnPropertyDescriptor(window, 'DataTransfer');
    Object.defineProperty(window, 'DataTransfer', {
      configurable: true,
      value: undefined,
    });
    try {
      (node as HTMLInputElement).files = transfer.files;
      node.dispatchEvent(new Event('change', { bubbles: true }));
    } finally {
      if (descriptor) Object.defineProperty(window, 'DataTransfer', descriptor);
    }
  });

  await expect(page.getByTestId('selection-count')).toHaveText('1');
  await expect(page.getByTestId('callback-file-contents')).toHaveText('');
  await expect(page.getByTestId('selected-file-contents')).toHaveText('');
  await expect(page.getByTestId('rejected-files')).toHaveText('notas.txt');
  await expect(page.locator('.pr-file-dropzone')).toHaveAttribute('data-state', 'empty');
  await expect(page.locator('.pr-file-dropzone__files')).toHaveCount(0);
  expect(await input.evaluate((node) => (node as HTMLInputElement).files?.length)).toBe(0);
  expect(await input.evaluate((node) => (node as HTMLInputElement).checkValidity())).toBe(false);
});

test('selects a file through the native picker and keeps one warm focus surface', async ({
  mount,
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await mount(<FileDropzoneStory />);

  const input = page.getByLabel('Archivo CSV de rutas');
  const dropzone = page.locator('.pr-file-dropzone');
  const [inputBox, dropzoneBox] = await Promise.all([input.boundingBox(), dropzone.boundingBox()]);
  expect(inputBox).not.toBeNull();
  expect(dropzoneBox).not.toBeNull();
  expect(dropzoneBox!.height).toBeGreaterThanOrEqual(160);
  expect(inputBox!.width).toBeGreaterThanOrEqual(dropzoneBox!.width - 2);
  expect(inputBox!.height).toBeGreaterThanOrEqual(dropzoneBox!.height - 2);

  await input.focus();
  await expect(dropzone).toHaveCSS('border-color', 'rgb(240, 188, 0)');
  await expect(dropzone).not.toHaveCSS('box-shadow', 'none');
  expect(await dropzone.evaluate((node) => getComputedStyle(node).backgroundImage)).toBe('none');

  await input.setInputFiles({
    name: 'rutas-demo.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('route_id,driver\n1,Ana'),
  });
  await expect(dropzone).toHaveAttribute('data-state', 'selected');
  await expect(page.getByText('rutas-demo.csv')).toBeVisible();
  expect(await input.evaluate((node) => (node as HTMLInputElement).checkValidity())).toBe(true);

  if (process.env.PR_CAPTURE_FILE_DROPZONE === '1') {
    await page.screenshot({ path: 'test-results/file-dropzone-light-selected.png' });
  }
});

test('uses dark semantic tokens and stays inside a 375px viewport when invalid', async ({
  mount,
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await mount(<FileDropzoneStory mode="dark" state="error" />);

  const story = page.getByTestId('file-dropzone-story');
  const input = page.getByLabel('Archivo CSV de rutas');
  const dropzone = page.locator('.pr-file-dropzone');
  await expect(story).toHaveCSS('background-color', 'rgb(14, 14, 16)');
  await expect(dropzone).toHaveCSS('background-color', 'rgb(22, 22, 24)');
  await expect(dropzone).toHaveCSS('border-color', 'rgb(248, 113, 113)');
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('alert')).toContainText('formato esperado');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

  if (process.env.PR_CAPTURE_FILE_DROPZONE === '1') {
    await page.screenshot({ path: 'test-results/file-dropzone-dark-invalid-375.png' });
  }
});

test('shows a stable drag-active state and auto-selects the dropped file', async ({
  mount,
  page,
}) => {
  await mount(<FileDropzoneStory />);
  const input = page.getByLabel('Archivo CSV de rutas');
  const dropzone = page.locator('.pr-file-dropzone');

  await input.evaluate((node) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['route_id\n1'], 'arrastrado.csv', { type: 'text/csv' }));
    node.closest('.pr-file-dropzone')?.dispatchEvent(
      new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: transfer }),
    );
  });
  await expect(dropzone).toHaveAttribute('data-state', 'drag-active');
  await expect(dropzone).toHaveCSS('border-style', 'solid');

  await input.evaluate((node) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['route_id\n1'], 'arrastrado.csv', { type: 'text/csv' }));
    node.closest('.pr-file-dropzone')?.dispatchEvent(
      new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }),
    );
  });
  await expect(dropzone).toHaveAttribute('data-state', 'selected');
  await expect(page.getByText('arrastrado.csv')).toBeVisible();
});

test('ignores non-file and empty drops without clearing the current selection', async ({
  mount,
  page,
}) => {
  await mount(<FileDropzoneFormStory />);
  const input = page.getByLabel('Archivo CSV de rutas');
  const dropzone = page.locator('.pr-file-dropzone');

  await input.setInputFiles({
    name: 'rutas.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('routes'),
  });
  await expect(page.getByTestId('selection-count')).toHaveText('1');

  await dropzone.evaluate((node) => {
    const transfer = new DataTransfer();
    transfer.setData('text/plain', 'not a file');
    node.dispatchEvent(
      new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }),
    );
  });
  await dropzone.evaluate((node) => {
    node.dispatchEvent(
      new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: new DataTransfer(),
      }),
    );
  });

  await expect(page.getByTestId('selection-count')).toHaveText('1');
  await expect(page.getByTestId('selection-source')).toHaveText('picker');
  await expect(page.getByTestId('rejected-files')).toHaveText('');
  await expect(page.getByTestId('selected-file-contents')).toHaveText('routes');
  await expect(page.locator('.pr-file-dropzone__file')).toContainText('rutas.csv');
  expect(await input.evaluate((node) => (node as HTMLInputElement).files?.length)).toBe(1);
  expect(await input.evaluate((node) => (node as HTMLInputElement).checkValidity())).toBe(true);
  expect(
    await page.getByTestId('file-dropzone-form').evaluate(async (form) => {
      const value = new FormData(form as HTMLFormElement).get('routes');
      return value instanceof File ? value.text() : value;
    }),
  ).toBe('routes');
});

test('keeps the disabled native input and drop target inert', async ({ mount, page }) => {
  await mount(<FileDropzoneStory state="disabled" />);
  const input = page.getByLabel('Archivo CSV de rutas');
  const dropzone = page.locator('.pr-file-dropzone');
  await expect(input).toBeDisabled();
  await expect(dropzone).toHaveAttribute('data-state', 'disabled');
  await expect(dropzone).toHaveCSS('cursor', 'not-allowed');
});
