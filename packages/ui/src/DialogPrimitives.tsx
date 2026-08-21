import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react';
import { X } from 'lucide-react';
import {
  DialogLayer,
  type DialogLayerAutoFocusEvent,
  type DialogLayerProps,
} from './DialogLayer';
import { Slot } from './Slot';

export type DialogPrimitiveSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';

export interface DialogRootProps {
  children?: ReactNode;
  /** Controlled open state. */
  open?: boolean;
  /** Initial state when the root is uncontrolled. */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** When false, Escape, the backdrop, and the automatic close control are disabled. */
  dismissible?: boolean;
  /** Keep Escape and explicit close controls while protecting backdrop clicks. */
  closeOnBackdrop?: boolean;
}

interface DialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  dismissible: boolean;
  closeOnBackdrop: boolean;
  titleId: string;
  descriptionId: string;
  hasTitle: boolean;
  hasDescription: boolean;
  registerTitle: () => () => void;
  registerDescription: () => () => void;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export function useDialogPrimitiveContext(component: string): DialogContextValue {
  const context = useContext(DialogContext);
  if (!context) throw new Error(`${component} must be rendered inside DialogRoot.`);
  return context;
}

export function DialogRoot({
  children,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  dismissible = true,
  closeOnBackdrop = true,
}: DialogRootProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const titleId = useId();
  const descriptionId = useId();
  const [titleCount, setTitleCount] = useState(0);
  const [descriptionCount, setDescriptionCount] = useState(0);

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) setUncontrolledOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange],
  );

  const registerTitle = useCallback(() => {
    setTitleCount((count) => count + 1);
    return () => setTitleCount((count) => Math.max(0, count - 1));
  }, []);
  const registerDescription = useCallback(() => {
    setDescriptionCount((count) => count + 1);
    return () => setDescriptionCount((count) => Math.max(0, count - 1));
  }, []);

  const value = useMemo(
    () => ({
      open,
      setOpen,
      dismissible,
      closeOnBackdrop,
      titleId,
      descriptionId,
      hasTitle: titleCount > 0,
      hasDescription: descriptionCount > 0,
      registerTitle,
      registerDescription,
    }),
    [
      closeOnBackdrop,
      descriptionCount,
      descriptionId,
      dismissible,
      open,
      registerDescription,
      registerTitle,
      setOpen,
      titleCount,
      titleId,
    ],
  );

  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>;
}

export interface DialogTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export const DialogTrigger = forwardRef<HTMLButtonElement, DialogTriggerProps>(
  function DialogTrigger({ asChild = false, onClick, type = 'button', children, ...props }, ref) {
    const { open, setOpen } = useDialogPrimitiveContext('DialogTrigger');
    const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      if (!event.defaultPrevented) setOpen(true);
    };

    if (asChild) {
      return (
        <Slot
          {...props}
          ref={ref as Ref<unknown>}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={handleClick}
        >
          {children}
        </Slot>
      );
    }

    return (
      <button
        {...props}
        ref={ref}
        type={type}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={handleClick}
      >
        {children}
      </button>
    );
  },
);

export interface DialogCloseProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export const DialogClose = forwardRef<HTMLButtonElement, DialogCloseProps>(function DialogClose(
  { asChild = false, onClick, type = 'button', children, ...props },
  ref,
) {
  const { setOpen } = useDialogPrimitiveContext('DialogClose');
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (!event.defaultPrevented) setOpen(false);
  };

  if (asChild) {
    return (
      <Slot {...props} ref={ref as Ref<unknown>} onClick={handleClick}>
        {children}
      </Slot>
    );
  }

  return (
    <button {...props} ref={ref} type={type} onClick={handleClick}>
      {children}
    </button>
  );
});

export interface DialogSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  size?: DialogPrimitiveSize;
  showCloseButton?: boolean;
  closeLabel?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  onOpenAutoFocus?: (event: DialogLayerAutoFocusEvent) => void;
  /** @internal Shared by the alert-dialog and sheet surfaces. */
  surfaceRole?: 'dialog' | 'alertdialog';
  /** @internal */
  rootClassName?: string;
  /** @internal */
  backdropClassName?: string;
  /** @internal */
  panelClassName?: string;
  /** @internal */
  closeClassName?: string;
}

/** @internal One styled surface over the package's single modal behavior seam. */
export const DialogSurface = forwardRef<HTMLDivElement, DialogSurfaceProps>(function DialogSurface(
  {
    size = 'md',
    showCloseButton = true,
    closeLabel = 'Cerrar',
    initialFocusRef,
    onOpenAutoFocus,
    surfaceRole = 'dialog',
    rootClassName = 'pr-dialog',
    backdropClassName = 'pr-dialog__backdrop',
    panelClassName,
    closeClassName = 'pr-dialog__close pr-dialog__close--floating',
    className,
    children,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    ...panelProps
  },
  ref,
) {
  const context = useDialogPrimitiveContext('DialogContent');
  const classes = [
    'pr-dialog__panel',
    `pr-dialog__panel--${size}`,
    'pr-dialog__panel--compound',
    panelClassName,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <DialogLayer
      open={context.open}
      onClose={() => context.setOpen(false)}
      dismissible={context.dismissible}
      closeOnBackdrop={context.closeOnBackdrop}
      role={surfaceRole}
      ariaLabel={ariaLabel}
      ariaLabelledBy={
        ariaLabel ? undefined : (ariaLabelledBy ?? (context.hasTitle ? context.titleId : undefined))
      }
      ariaDescribedBy={
        ariaDescribedBy ?? (context.hasDescription ? context.descriptionId : undefined)
      }
      initialFocusRef={initialFocusRef}
      onOpenAutoFocus={onOpenAutoFocus}
      rootClassName={rootClassName}
      backdropClassName={backdropClassName}
      panelClassName={classes}
      panelProps={{ ...panelProps, 'data-state': 'open' } as DialogLayerProps['panelProps']}
      panelRef={ref}
    >
      {children}
      {showCloseButton && context.dismissible && (
        <DialogClose className={closeClassName} aria-label={closeLabel}>
          <X size={18} aria-hidden />
        </DialogClose>
      )}
    </DialogLayer>
  );
});

export type DialogContentProps = Omit<
  DialogSurfaceProps,
  'surfaceRole' | 'rootClassName' | 'backdropClassName' | 'panelClassName' | 'closeClassName'
>;

export const DialogContent = forwardRef<HTMLDivElement, DialogContentProps>(function DialogContent(
  props,
  ref,
) {
  return <DialogSurface {...props} ref={ref} />;
});

export type DialogHeaderProps = HTMLAttributes<HTMLDivElement>;

export const DialogHeader = forwardRef<HTMLDivElement, DialogHeaderProps>(function DialogHeader(
  { className, ...props },
  ref,
) {
  return (
    <div
      {...props}
      ref={ref}
      className={['pr-dialog__header', 'pr-dialog__header--compound', className]
        .filter(Boolean)
        .join(' ')}
    />
  );
});

export type DialogTitleProps = HTMLAttributes<HTMLHeadingElement>;

export const DialogTitle = forwardRef<HTMLHeadingElement, DialogTitleProps>(function DialogTitle(
  { className, id, ...props },
  ref,
) {
  const { titleId, registerTitle } = useDialogPrimitiveContext('DialogTitle');
  useEffect(() => registerTitle(), [registerTitle]);
  return (
    <h2
      {...props}
      ref={ref}
      id={id ?? titleId}
      className={['pr-dialog__title', className].filter(Boolean).join(' ')}
    />
  );
});

export type DialogDescriptionProps = HTMLAttributes<HTMLParagraphElement>;

export const DialogDescription = forwardRef<HTMLParagraphElement, DialogDescriptionProps>(
  function DialogDescription({ className, id, ...props }, ref) {
    const { descriptionId, registerDescription } =
      useDialogPrimitiveContext('DialogDescription');
    useEffect(() => registerDescription(), [registerDescription]);
    return (
      <p
        {...props}
        ref={ref}
        id={id ?? descriptionId}
        className={['pr-dialog__description', className].filter(Boolean).join(' ')}
      />
    );
  },
);

export type DialogFooterProps = HTMLAttributes<HTMLDivElement>;

export const DialogFooter = forwardRef<HTMLDivElement, DialogFooterProps>(function DialogFooter(
  { className, ...props },
  ref,
) {
  return (
    <div
      {...props}
      ref={ref}
      className={['pr-dialog__footer', 'pr-dialog__footer--compound', className]
        .filter(Boolean)
        .join(' ')}
    />
  );
});
