import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Button } from './Button';
import { Dialog, type DialogSize } from './Dialog';

export interface ConfirmDialogProps {
  open: boolean;
  /** Called with `false` on cancel and on dismiss. The confirm path calls `onConfirm` instead. */
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  onConfirm: () => void;
  /** Spins the confirm button and blocks both actions. */
  loading?: boolean;
  /** Red confirm button and a stricter dialog: Escape/backdrop no longer dismiss it. */
  destructive?: boolean;
  /** Optional icon rendered in a tone-matched chip above the body. */
  icon?: LucideIcon;
  size?: DialogSize;
}

/**
 * Standard confirmation dialog: title, optional description and icon, and a
 * cancel/confirm footer. A thin composition over `Dialog` and `Button` that
 * fixes the choices the apps used to make independently — Spanish labels as
 * defaults (override with props), `loading` blocking both actions, and
 * `destructive` turning the confirm red and making the dialog
 * non-dismissible.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  loading = false,
  destructive = false,
  icon: Icon,
  size = 'sm',
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={() => onOpenChange(false)}
      size={size}
      title={title}
      description={description}
      dismissible={!destructive}
      footer={
        <div className="pr-confirm-dialog__actions">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {Icon ? (
        <div className="pr-confirm-dialog__icon-row">
          <span
            className={[
              'pr-confirm-dialog__icon',
              destructive
                ? 'pr-confirm-dialog__icon--danger'
                : 'pr-confirm-dialog__icon--accent',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <Icon aria-hidden strokeWidth={2.25} />
          </span>
        </div>
      ) : null}
    </Dialog>
  );
}
