import { useEffect, useRef, useState } from 'react';
import { FileDropzone } from '@partrunner-ai/ui';

type FileDropzoneStoryProps = {
  mode?: 'light' | 'dark';
  state?: 'empty' | 'error' | 'disabled';
};

export function FileDropzoneStory({
  mode = 'light',
  state = 'empty',
}: FileDropzoneStoryProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [rejected, setRejected] = useState<File[]>([]);

  return (
    <main
      className={mode === 'dark' ? 'dark' : undefined}
      data-testid="file-dropzone-story"
      style={{
        minHeight: '100vh',
        padding: 24,
        background: 'var(--pr-bg)',
        color: 'var(--pr-fg)',
        fontFamily: 'var(--pr-font-body)',
      }}
    >
      <FileDropzone
        label="Archivo CSV de rutas"
        browseLabel="Elige un CSV o arrástralo aquí"
        description="La vista previa inicia cuando detectamos el archivo."
        hint="Un archivo CSV de hasta 10 MB."
        error={state === 'error' ? 'El archivo no tiene el formato esperado.' : undefined}
        accept=".csv,text/csv"
        required
        selectedFiles={files}
        onFilesSelected={setFiles}
        onFilesRejected={setRejected}
        disabled={state === 'disabled'}
        fullWidth
      />
      {rejected.length > 0 ? <p role="status">Rechazado: {rejected[0]?.name}</p> : null}
    </main>
  );
}

function FileContents({ files, testId }: { files: readonly File[]; testId: string }) {
  const [contents, setContents] = useState('');

  useEffect(() => {
    let current = true;
    void Promise.all(files.map((file) => file.text())).then((nextContents) => {
      if (current) setContents(nextContents.join('|'));
    });
    return () => {
      current = false;
    };
  }, [files]);

  return <output data-testid={testId}>{contents}</output>;
}

type FileDropzoneFormStoryProps = {
  multiple?: boolean;
  controlled?: boolean;
  ignoreEmptySelection?: boolean;
  ignoreNonEmptySelection?: boolean;
  recreateControlledSelection?: boolean;
  cancelReset?: boolean;
};

export function FileDropzoneFormStory({
  multiple = false,
  controlled = true,
  ignoreEmptySelection = false,
  ignoreNonEmptySelection = false,
  recreateControlledSelection = false,
  cancelReset = false,
}: FileDropzoneFormStoryProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [callbackFiles, setCallbackFiles] = useState<File[]>([]);
  const [rejected, setRejected] = useState<File[]>([]);
  const [selectionCount, setSelectionCount] = useState(0);
  const [lastSource, setLastSource] = useState('');
  const [resetAttemptCount, setResetAttemptCount] = useState(0);
  const [canceledResetCount, setCanceledResetCount] = useState(0);

  const setExternalFile = (name: string, contents: string) => {
    setFiles([new File([contents], name, { type: 'text/csv' })]);
  };

  return (
    <form
      data-testid="file-dropzone-form"
      onReset={(event) => {
        setResetAttemptCount((count) => count + 1);
        if (!cancelReset) return;
        event.preventDefault();
        setCanceledResetCount((count) => count + 1);
      }}
    >
      <FileDropzone
        ref={inputRef}
        label="Archivo CSV de rutas"
        accept=".csv,text/csv"
        name="routes"
        required
        multiple={multiple}
        selectedFiles={
          controlled ? (recreateControlledSelection ? [...files] : files) : undefined
        }
        onFilesSelected={(nextFiles, source) => {
          const ignoredByParent =
            (ignoreEmptySelection && nextFiles.length === 0) ||
            (ignoreNonEmptySelection && nextFiles.length > 0);
          if (!ignoredByParent) setFiles(nextFiles);
          setCallbackFiles(nextFiles);
          setSelectionCount((count) => count + 1);
          setLastSource(source);
        }}
        onFilesRejected={setRejected}
      />
      <button type="button" onClick={() => setFiles([])}>
        Limpiar archivo
      </button>
      <button type="button" onClick={() => setExternalFile('externo-a.csv', 'external-a')}>
        Usar archivo externo A
      </button>
      <button type="button" onClick={() => setExternalFile('externo-b.csv', 'external-b')}>
        Usar archivo externo B
      </button>
      <button
        type="button"
        onClick={() =>
          setFiles([
            new File(['notes'], 'notas.txt', { type: 'text/plain' }),
            new File(['routes'], 'rutas.csv', { type: 'text/csv' }),
            new File(['extra'], 'rutas-extra.csv', { type: 'text/csv' }),
          ])
        }
      >
        Usar selección externa mixta
      </button>
      <button
        type="button"
        onClick={() => {
          const input = inputRef.current;
          if (!input) return;
          input.value = '';
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }}
      >
        Limpiar por referencia
      </button>
      <label>
        Estado auxiliar
        <input defaultValue="original" />
      </label>
      <button type="reset">Reiniciar formulario</button>
      <output data-testid="selection-count">{selectionCount}</output>
      <output data-testid="selection-source">{lastSource}</output>
      <output data-testid="rejected-files">
        {rejected.map((file) => file.name).join(',')}
      </output>
      <output data-testid="reset-attempt-count">{resetAttemptCount}</output>
      <output data-testid="canceled-reset-count">{canceledResetCount}</output>
      <FileContents files={files} testId="selected-file-contents" />
      <FileContents files={callbackFiles} testId="callback-file-contents" />
    </form>
  );
}
