import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FileDropzone } from './FileDropzone';

function file(name: string, type: string, contents = 'data') {
  return new File([contents], name, { type });
}

function dropzone(label = 'Archivo') {
  return screen.getByLabelText(label).closest('.pr-file-dropzone') as HTMLElement;
}

describe('FileDropzone', () => {
  it('keeps one native file input as the accessible control', () => {
    render(
      <FileDropzone
        label="Archivo de rutas"
        description="Arrastra el archivo o selecciónalo."
        hint="CSV de hasta 10 MB."
        accept=".csv,text/csv"
        multiple
        required
        onFilesSelected={() => undefined}
      />,
    );

    const input = screen.getByLabelText(/Archivo de rutas/) as HTMLInputElement;
    expect(input.type).toBe('file');
    expect(input.accept).toBe('.csv,text/csv');
    expect(input.multiple).toBe(true);
    expect(input.required).toBe(true);
    expect(document.querySelectorAll('input[type="file"]')).toHaveLength(1);

    const describedBy = input.getAttribute('aria-describedby')!.split(' ');
    expect(describedBy.map((id) => document.getElementById(id)?.textContent)).toEqual([
      'Arrastra el archivo o selecciónalo.',
      'CSV de hasta 10 MB.',
    ]);
  });

  it('filters picker files and fails closed when jsdom cannot rebuild the native selection', () => {
    const onFilesSelected = vi.fn();
    const onFilesRejected = vi.fn();
    const routes = file('rutas.csv', 'text/csv', 'route_id');
    const notes = file('notas.txt', 'text/plain');

    render(
      <FileDropzone
        label="Archivo"
        accept=".csv"
        multiple
        onFilesSelected={onFilesSelected}
        onFilesRejected={onFilesRejected}
      />,
    );

    fireEvent.change(screen.getByLabelText('Archivo'), {
      target: { files: [routes, notes] },
    });

    expect(onFilesSelected).toHaveBeenCalledWith([], 'picker');
    expect(onFilesRejected).toHaveBeenCalledWith([notes], 'picker');
    expect(screen.queryByText('rutas.csv')).toBeNull();
    expect(screen.queryByText('notas.txt')).toBeNull();
    expect(dropzone().getAttribute('data-state')).toBe('empty');
  });

  it('preserves the native picker value for required form validation', async () => {
    const routes = file('rutas.csv', 'text/csv');
    render(
      <FileDropzone
        label="Archivo"
        accept=".csv"
        required
        onFilesSelected={() => undefined}
      />,
    );

    const input = screen.getByLabelText(/Archivo/) as HTMLInputElement;
    await userEvent.upload(input, routes);

    expect(input.files).toHaveLength(1);
    expect(input.files?.[0]).toBe(routes);
  });

  it('rejects invalid and extra drop files while unsupported native sync fails closed', () => {
    const onFilesSelected = vi.fn();
    const onFilesRejected = vi.fn();
    const first = file('primero.csv', 'text/csv');
    const second = file('segundo.csv', 'text/csv');
    const image = file('captura.png', 'image/png');

    render(
      <FileDropzone
        label="Archivo"
        accept="text/csv"
        onFilesSelected={onFilesSelected}
        onFilesRejected={onFilesRejected}
      />,
    );

    fireEvent.drop(dropzone(), {
      dataTransfer: { files: [first, second, image], types: ['Files'] },
    });

    expect(onFilesSelected).toHaveBeenCalledWith([], 'drop');
    expect(onFilesRejected).toHaveBeenCalledWith([second, image], 'drop');
    expect(screen.queryByText('primero.csv')).toBeNull();
    expect(dropzone().getAttribute('data-state')).toBe('empty');
  });

  it('uses drag depth so child transitions do not flicker the active state', () => {
    render(<FileDropzone label="Archivo" onFilesSelected={() => undefined} />);
    const target = dropzone();
    const transfer = { files: [], types: ['Files'] };

    fireEvent.dragEnter(target, { dataTransfer: transfer });
    fireEvent.dragEnter(target, { dataTransfer: transfer });
    expect(target.getAttribute('data-state')).toBe('drag-active');

    fireEvent.dragLeave(target, { dataTransfer: transfer });
    expect(target.getAttribute('data-state')).toBe('drag-active');

    fireEvent.dragLeave(target, { dataTransfer: transfer });
    expect(target.getAttribute('data-state')).toBe('empty');
  });

  it('announces errors and fails an unsupported controlled selection closed', () => {
    const routes = file('rutas.csv', 'text/csv');
    const { rerender } = render(
      <FileDropzone
        label="Archivo"
        hint="Solo CSV."
        error="El archivo no es válido."
        selectedFiles={[routes]}
        onFilesSelected={() => undefined}
      />,
    );

    const input = screen.getByLabelText('Archivo');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toBe('El archivo no es válido.');
    expect(screen.queryByText('Solo CSV.')).toBeNull();
    expect(screen.queryByText('rutas.csv')).toBeNull();

    rerender(
      <FileDropzone
        label="Archivo"
        selectedFiles={[]}
        onFilesSelected={() => undefined}
      />,
    );
    expect(screen.queryByText('rutas.csv')).toBeNull();
  });

  it('forwards its ref and becomes inert when disabled', () => {
    const ref = createRef<HTMLInputElement>();
    const onFilesSelected = vi.fn();
    const routes = file('rutas.csv', 'text/csv');
    render(
      <FileDropzone
        ref={ref}
        label="Archivo"
        disabled
        onFilesSelected={onFilesSelected}
      />,
    );

    expect(ref.current).toBe(screen.getByLabelText('Archivo'));
    expect(ref.current?.disabled).toBe(true);
    fireEvent.drop(dropzone(), {
      dataTransfer: { files: [routes], types: ['Files'] },
    });
    expect(onFilesSelected).not.toHaveBeenCalled();
    expect(dropzone().getAttribute('data-state')).toBe('disabled');
  });
});
