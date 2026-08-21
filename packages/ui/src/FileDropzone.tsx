import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ForwardedRef,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { FileText, Upload } from 'lucide-react';
import { Label } from './FormField';

/** `picker` also covers native input clears, including the owning form's reset. */
export type FileDropzoneSelectionSource = 'picker' | 'drop';

export interface FileDropzoneProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'children' | 'defaultValue' | 'onChange' | 'size' | 'type' | 'value'
  > {
  label: ReactNode;
  description?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  browseLabel?: ReactNode;
  /**
   * External file candidates. The component applies `accept` and `multiple` before it
   * syncs visual and native form state. Prop synchronization does not emit callbacks.
   */
  selectedFiles?: readonly File[];
  /**
   * Receives picker, drop, and form-reset replacements after native synchronization.
   * Synchronizing `selectedFiles` does not call this callback.
   */
  onFilesSelected: (files: File[], source: FileDropzoneSelectionSource) => void;
  /**
   * Receives picker or drop candidates rejected by `accept` or the single-file limit.
   * Synchronizing `selectedFiles` does not call this callback.
   */
  onFilesRejected?: (files: File[], source: FileDropzoneSelectionSource) => void;
  fullWidth?: boolean;
  containerClassName?: string;
}

function isPresent(value: ReactNode): boolean {
  return value !== undefined && value !== null && value !== false && value !== '';
}

function joinIds(...ids: Array<string | undefined>): string | undefined {
  const value = ids.filter(Boolean).join(' ');
  return value || undefined;
}

function matchesAccept(file: File, accept?: string): boolean {
  const patterns = accept
    ?.split(',')
    .map((pattern) => pattern.trim().toLowerCase())
    .filter(Boolean);

  if (!patterns?.length) return true;

  const fileName = file.name.toLowerCase();
  const fileType = file.type.toLowerCase();
  return patterns.some((pattern) => {
    if (pattern.startsWith('.')) return fileName.endsWith(pattern);
    if (pattern.endsWith('/*')) return fileType.startsWith(pattern.slice(0, -1));
    return fileType === pattern;
  });
}

function normalizeFileSelection(
  files: readonly File[],
  accept: string | undefined,
  multiple: boolean,
): { accepted: File[]; rejected: File[] } {
  const accepted: File[] = [];
  const rejected: File[] = [];

  for (const file of files) {
    if (!matchesAccept(file, accept) || (!multiple && accepted.length > 0)) {
      rejected.push(file);
    } else {
      accepted.push(file);
    }
  }

  return { accepted, rejected };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function hasFiles(event: DragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.types ?? []).includes('Files');
}

function assignRef<T>(ref: ForwardedRef<T>, value: T | null): void {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

function sameFileSelection(actual: ArrayLike<File> | null, expected: readonly File[]): boolean {
  const current = Array.from(actual ?? []);
  return (
    current.length === expected.length &&
    current.every((file, index) => file === expected[index])
  );
}

function clearNativeFiles(input: HTMLInputElement): boolean {
  try {
    input.value = '';
  } catch {
    return false;
  }
  return (input.files?.length ?? 0) === 0;
}

function syncNativeFiles(input: HTMLInputElement, files: readonly File[]): boolean {
  if (sameFileSelection(input.files, files)) return true;

  if (files.length === 0) {
    return clearNativeFiles(input);
  }

  try {
    if (typeof DataTransfer !== 'function') throw new Error('DataTransfer is unavailable');
    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(file);
    input.files = transfer.files;
    if (sameFileSelection(input.files, files)) return true;
  } catch {
    // Fall through to one fail-closed path.
  }

  clearNativeFiles(input);
  return false;
}

const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export const FileDropzone = forwardRef<HTMLInputElement, FileDropzoneProps>(
  function FileDropzone(
    {
      label,
      description,
      hint,
      error,
      browseLabel = 'Choose a file or drag it here',
      selectedFiles,
      onFilesSelected,
      onFilesRejected,
      fullWidth = false,
      containerClassName,
      className,
      id,
      accept,
      multiple = false,
      disabled = false,
      required = false,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
      'aria-labelledby': ariaLabelledBy,
      ...rest
    },
    ref,
  ) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const labelId = `${inputId}-label`;
    const descriptionId = `${inputId}-description`;
    const messageId = `${inputId}-message`;
    const hasDescription = isPresent(description);
    const hasError = isPresent(error);
    const message = hasError ? error : hint;
    const hasMessage = isPresent(message);
    const [internalFiles, setInternalFiles] = useState<File[]>([]);
    const [controlledFiles, setControlledFiles] = useState<File[]>([]);
    const [dragActive, setDragActive] = useState(false);
    const dragDepth = useRef(0);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const pendingControlledSelection = useRef<{
      propFiles: File[];
      localFiles: File[];
    } | null>(null);
    const canceledResetEvents = useRef(new WeakSet<Event>());
    const composedInputRef = useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node;
        assignRef(ref, node);
      },
      [ref],
    );
    const showControlledFiles = useCallback((files: readonly File[]) => {
      setControlledFiles((current) =>
        sameFileSelection(current, files) ? current : Array.from(files),
      );
    }, []);
    const visibleFiles = selectedFiles === undefined ? internalFiles : controlledFiles;

    useBrowserLayoutEffect(() => {
      if (selectedFiles === undefined) {
        pendingControlledSelection.current = null;
        return;
      }

      const nextFiles = Array.from(selectedFiles);
      const pending = pendingControlledSelection.current;
      if (pending && sameFileSelection(pending.propFiles, nextFiles)) {
        const { accepted } = normalizeFileSelection(pending.localFiles, accept, multiple);
        const synced = inputRef.current ? syncNativeFiles(inputRef.current, accepted) : false;
        showControlledFiles(synced ? accepted : []);
        return;
      }

      pendingControlledSelection.current = null;
      const { accepted } = normalizeFileSelection(nextFiles, accept, multiple);
      const synced = inputRef.current ? syncNativeFiles(inputRef.current, accepted) : false;
      showControlledFiles(synced ? accepted : []);
    }, [accept, multiple, selectedFiles, showControlledFiles]);

    useEffect(() => {
      const input = inputRef.current;
      const form = input?.form;
      if (!input || !form) return;

      // React delegates `onReset` above the form. Record that propagated outcome, then wait
      // through the browser's default reset action before reconciling visual and native state.
      const resetBoundary = form.ownerDocument.defaultView ?? form.ownerDocument;
      const observeResetOutcome = (event: Event) => {
        if (event.target === form && event.defaultPrevented) {
          canceledResetEvents.current.add(event);
        }
      };
      const handleReset = (event: Event) => {
        const filesBeforeReset = Array.from(input.files ?? []);
        setTimeout(() => {
          const canceledBeforeDefaultAction =
            canceledResetEvents.current.has(event) ||
            event.defaultPrevented ||
            (filesBeforeReset.length > 0 && sameFileSelection(input.files, filesBeforeReset));
          const stillOwnsInput = inputRef.current === input && input.form === form;
          if (!stillOwnsInput || canceledBeforeDefaultAction) return;
          syncNativeFiles(input, []);
          if (selectedFiles === undefined) {
            setInternalFiles([]);
          } else {
            pendingControlledSelection.current = {
              propFiles: Array.from(selectedFiles),
              localFiles: [],
            };
            showControlledFiles([]);
          }
          onFilesSelected([], 'picker');
        }, 0);
      };

      resetBoundary.addEventListener('reset', observeResetOutcome);
      form.addEventListener('reset', handleReset);
      return () => {
        resetBoundary.removeEventListener('reset', observeResetOutcome);
        form.removeEventListener('reset', handleReset);
      };
    }, [onFilesSelected, selectedFiles, showControlledFiles]);

    const chooseFiles = useCallback(
      (files: File[], source: FileDropzoneSelectionSource) => {
        if (disabled) return;

        const { accepted, rejected } = normalizeFileSelection(files, accept, multiple);

        const synced = inputRef.current ? syncNativeFiles(inputRef.current, accepted) : false;
        const nextAccepted = synced ? accepted : [];

        if (selectedFiles === undefined) {
          setInternalFiles(nextAccepted);
        } else {
          pendingControlledSelection.current = {
            propFiles: Array.from(selectedFiles),
            localFiles: nextAccepted,
          };
          showControlledFiles(nextAccepted);
        }
        onFilesSelected(nextAccepted, source);
        if (rejected.length > 0) onFilesRejected?.(rejected, source);
      },
      [
        accept,
        disabled,
        multiple,
        onFilesRejected,
        onFilesSelected,
        selectedFiles,
        showControlledFiles,
      ],
    );

    const handleChange = useCallback(
      (event: ChangeEvent<HTMLInputElement>) => {
        chooseFiles(Array.from(event.currentTarget.files ?? []), 'picker');
      },
      [chooseFiles],
    );

    const handleDragEnter = useCallback(
      (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        if (disabled || !hasFiles(event)) return;
        dragDepth.current += 1;
        setDragActive(true);
      },
      [disabled],
    );

    const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragActive(false);
    }, []);

    const handleDragOver = useCallback(
      (event: DragEvent<HTMLDivElement>) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = disabled ? 'none' : 'copy';
      },
      [disabled],
    );

    const handleDrop = useCallback(
      (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        dragDepth.current = 0;
        setDragActive(false);
        if (disabled) return;
        const files = Array.from(event.dataTransfer.files ?? []);
        if (files.length === 0) return;
        chooseFiles(files, 'drop');
      },
      [chooseFiles, disabled],
    );

    const state = disabled
      ? 'disabled'
      : dragActive
        ? 'drag-active'
        : hasError
          ? 'invalid'
          : visibleFiles.length > 0
            ? 'selected'
            : 'empty';

    return (
      <div
        className={[
          'pr-file-dropzone-field',
          fullWidth ? 'pr-file-dropzone-field--block' : null,
          disabled ? 'pr-file-dropzone-field--disabled' : null,
          hasError ? 'pr-file-dropzone-field--invalid' : null,
          containerClassName,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <Label id={labelId} htmlFor={inputId} required={required}>
          {label}
        </Label>
        <div
          className="pr-file-dropzone"
          data-state={state}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <input
            {...rest}
            ref={composedInputRef}
            id={inputId}
            className={['pr-file-dropzone__input', className].filter(Boolean).join(' ')}
            type="file"
            accept={accept}
            multiple={multiple}
            disabled={disabled}
            required={required}
            aria-labelledby={joinIds(labelId, ariaLabelledBy)}
            aria-describedby={joinIds(
              ariaDescribedBy,
              hasDescription ? descriptionId : undefined,
              hasMessage ? messageId : undefined,
            )}
            aria-invalid={hasError ? true : ariaInvalid}
            onChange={handleChange}
          />
          <div className="pr-file-dropzone__content">
            <span className="pr-file-dropzone__icon">
              <Upload size={22} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className="pr-file-dropzone__browse">{browseLabel}</span>
            {hasDescription ? (
              <span id={descriptionId} className="pr-file-dropzone__description">
                {description}
              </span>
            ) : null}
          </div>
          {visibleFiles.length > 0 ? (
            <ul className="pr-file-dropzone__files">
              {visibleFiles.map((file, index) => (
                <li className="pr-file-dropzone__file" key={`${file.name}-${file.size}-${index}`}>
                  <FileText size={18} strokeWidth={1.8} aria-hidden="true" />
                  <span className="pr-file-dropzone__file-name">{file.name}</span>
                  <span className="pr-file-dropzone__file-size">{formatFileSize(file.size)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {hasMessage ? (
          <p
            id={messageId}
            className={`pr-file-dropzone-field__message${hasError ? ' pr-file-dropzone-field__message--error' : ''}`}
            role={hasError ? 'alert' : undefined}
          >
            {message}
          </p>
        ) : null}
      </div>
    );
  },
);
