import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ConfirmDialog } from './ConfirmDialog';

export interface ConfirmOptions {
  /** The question, with the object: «¿Eliminar la ruta 1042?». */
  title: ReactNode;
  /** What happens, and whether it can be undone. Plain text keeps its line breaks. */
  description?: ReactNode;
  /** The verb of the action: «Eliminar ruta». Not «Aceptar». */
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  /** A danger confirm button, for an action that deletes data or cannot be undone. */
  destructive?: boolean;
}

export interface UseConfirmResult {
  /** Opens the dialog. Resolves `true` on confirm, `false` on cancel or dismiss. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Render this once, anywhere in the component that calls `confirm`. */
  dialog: ReactNode;
}

/**
 * A promise-based `ConfirmDialog` for a handler that used to call `window.confirm`:
 *
 *   const { confirm, dialog } = useConfirm();
 *   async function onDelete() {
 *     if (!(await confirm({ title: '¿Eliminar la ruta 1042?', destructive: true }))) return;
 *     …
 *   }
 *   return <>{…}{dialog}</>;
 *
 * Self-contained: no provider. A second `confirm` while one is open answers the
 * first with `false`. When the component unmounts, an open question answers `false`.
 */
export function useConfirm(): UseConfirmResult {
  const [open, setOpen] = useState(false);
  // Kept after close, so the dialog does not go blank while it animates out.
  const [options, setOptions] = useState<ConfirmOptions>({ title: '' });
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    const resolve = resolver.current;
    resolver.current = null;
    setOpen(false);
    resolve?.(value);
  }, []);

  const confirm = useCallback((next: ConfirmOptions) => {
    resolver.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setOptions(next);
      setOpen(true);
    });
  }, []);

  useEffect(
    () => () => {
      resolver.current?.(false);
      resolver.current = null;
    },
    [],
  );

  const { title, description, confirmLabel, cancelLabel, destructive } = options;
  const dialog = (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) settle(false);
      }}
      title={title}
      description={
        typeof description === 'string' ? (
          <span className="pr-confirm-dialog__text">{description}</span>
        ) : (
          description
        )
      }
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      destructive={destructive}
      onConfirm={() => settle(true)}
    />
  );

  return { confirm, dialog };
}
