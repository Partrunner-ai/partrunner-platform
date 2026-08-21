import {
  forwardRef,
  useEffect,
  type HTMLAttributes,
} from 'react';
import { Button, type ButtonProps } from './Button';
import {
  DialogClose,
  DialogRoot,
  DialogSurface,
  DialogTrigger,
  useDialogPrimitiveContext,
  type DialogCloseProps,
  type DialogRootProps,
  type DialogSurfaceProps,
  type DialogTriggerProps,
} from './DialogPrimitives';

export type AlertDialogRootProps = Omit<DialogRootProps, 'dismissible' | 'closeOnBackdrop'>;

/** A confirmation layer that cannot be dismissed accidentally. */
export function AlertDialogRoot(props: AlertDialogRootProps) {
  return <DialogRoot {...props} dismissible={false} closeOnBackdrop={false} />;
}

export const AlertDialogTrigger = DialogTrigger;
export type AlertDialogTriggerProps = DialogTriggerProps;

export type AlertDialogContentProps = Omit<
  DialogSurfaceProps,
  'surfaceRole' | 'rootClassName' | 'backdropClassName' | 'panelClassName' | 'closeClassName' | 'showCloseButton'
>;

export const AlertDialogContent = forwardRef<HTMLDivElement, AlertDialogContentProps>(
  function AlertDialogContent({ size = 'sm', ...props }, ref) {
    return (
      <DialogSurface
        {...props}
        ref={ref}
        size={size}
        surfaceRole="alertdialog"
        panelClassName="pr-alert-dialog__panel"
        showCloseButton={false}
      />
    );
  },
);

export type AlertDialogHeaderProps = HTMLAttributes<HTMLDivElement>;

export const AlertDialogHeader = forwardRef<HTMLDivElement, AlertDialogHeaderProps>(
  function AlertDialogHeader({ className, ...props }, ref) {
    return (
      <div
        {...props}
        ref={ref}
        className={['pr-alert-dialog__header', className].filter(Boolean).join(' ')}
      />
    );
  },
);

export type AlertDialogTitleProps = HTMLAttributes<HTMLHeadingElement>;

export const AlertDialogTitle = forwardRef<HTMLHeadingElement, AlertDialogTitleProps>(
  function AlertDialogTitle({ className, id, ...props }, ref) {
    const { titleId, registerTitle } = useDialogPrimitiveContext('AlertDialogTitle');
    useEffect(() => registerTitle(), [registerTitle]);
    return (
      <h2
        {...props}
        ref={ref}
        id={id ?? titleId}
        className={['pr-alert-dialog__title', className].filter(Boolean).join(' ')}
      />
    );
  },
);

export type AlertDialogDescriptionProps = HTMLAttributes<HTMLParagraphElement>;

export const AlertDialogDescription = forwardRef<
  HTMLParagraphElement,
  AlertDialogDescriptionProps
>(function AlertDialogDescription({ className, id, ...props }, ref) {
  const { descriptionId, registerDescription } =
    useDialogPrimitiveContext('AlertDialogDescription');
  useEffect(() => registerDescription(), [registerDescription]);
  return (
    <p
      {...props}
      ref={ref}
      id={id ?? descriptionId}
      className={['pr-alert-dialog__description', className].filter(Boolean).join(' ')}
    />
  );
});

export type AlertDialogFooterProps = HTMLAttributes<HTMLDivElement>;

export const AlertDialogFooter = forwardRef<HTMLDivElement, AlertDialogFooterProps>(
  function AlertDialogFooter({ className, ...props }, ref) {
    return (
      <div
        {...props}
        ref={ref}
        className={['pr-alert-dialog__footer', className].filter(Boolean).join(' ')}
      />
    );
  },
);

export type AlertDialogMediaProps = HTMLAttributes<HTMLDivElement>;

export const AlertDialogMedia = forwardRef<HTMLDivElement, AlertDialogMediaProps>(
  function AlertDialogMedia({ className, ...props }, ref) {
    return (
      <div
        {...props}
        ref={ref}
        className={['pr-alert-dialog__media', className].filter(Boolean).join(' ')}
      />
    );
  },
);

export type AlertDialogActionProps = ButtonProps;

export const AlertDialogAction = forwardRef<HTMLButtonElement, AlertDialogActionProps>(
  function AlertDialogAction({ variant = 'primary', ...props }, ref) {
    return (
      <DialogClose asChild>
        <Button {...props} ref={ref} variant={variant} data-slot="alert-dialog-action" />
      </DialogClose>
    );
  },
);

export type AlertDialogCancelProps = ButtonProps;

export const AlertDialogCancel = forwardRef<HTMLButtonElement, AlertDialogCancelProps>(
  function AlertDialogCancel({ variant = 'outline', ...props }, ref) {
    return (
      <DialogClose asChild>
        <Button {...props} ref={ref} variant={variant} data-slot="alert-dialog-cancel" />
      </DialogClose>
    );
  },
);

export type { DialogCloseProps as AlertDialogCloseProps };
