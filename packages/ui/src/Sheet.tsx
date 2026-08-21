import { forwardRef, useEffect, type HTMLAttributes } from 'react';
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

export type SheetSide = 'top' | 'right' | 'bottom' | 'left';
export type SheetWidth = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export const SheetRoot = DialogRoot;
export type SheetRootProps = DialogRootProps;
export const SheetTrigger = DialogTrigger;
export type SheetTriggerProps = DialogTriggerProps;
export const SheetClose = DialogClose;
export type SheetCloseProps = DialogCloseProps;

export interface SheetContentProps
  extends Omit<
    DialogSurfaceProps,
    | 'size'
    | 'surfaceRole'
    | 'rootClassName'
    | 'backdropClassName'
    | 'panelClassName'
    | 'closeClassName'
  > {
  side?: SheetSide;
  width?: SheetWidth;
}

export const SheetContent = forwardRef<HTMLDivElement, SheetContentProps>(function SheetContent(
  { side = 'right', width = 'md', ...props },
  ref,
) {
  return (
    <DialogSurface
      {...props}
      ref={ref}
      size="4xl"
      rootClassName="pr-sheet"
      backdropClassName="pr-sheet__backdrop"
      panelClassName="pr-sheet__panel"
      closeClassName="pr-sheet__close"
      data-side={side}
      data-width={width}
    />
  );
});

export type SheetHeaderProps = HTMLAttributes<HTMLDivElement>;

export const SheetHeader = forwardRef<HTMLDivElement, SheetHeaderProps>(function SheetHeader(
  { className, ...props },
  ref,
) {
  return (
    <div
      {...props}
      ref={ref}
      className={['pr-sheet__header', className].filter(Boolean).join(' ')}
    />
  );
});

export type SheetTitleProps = HTMLAttributes<HTMLHeadingElement>;

export const SheetTitle = forwardRef<HTMLHeadingElement, SheetTitleProps>(function SheetTitle(
  { className, id, ...props },
  ref,
) {
  const { titleId, registerTitle } = useDialogPrimitiveContext('SheetTitle');
  useEffect(() => registerTitle(), [registerTitle]);
  return (
    <h2
      {...props}
      ref={ref}
      id={id ?? titleId}
      className={['pr-sheet__title', className].filter(Boolean).join(' ')}
    />
  );
});

export type SheetDescriptionProps = HTMLAttributes<HTMLParagraphElement>;

export const SheetDescription = forwardRef<HTMLParagraphElement, SheetDescriptionProps>(
  function SheetDescription({ className, id, ...props }, ref) {
    const { descriptionId, registerDescription } =
      useDialogPrimitiveContext('SheetDescription');
    useEffect(() => registerDescription(), [registerDescription]);
    return (
      <p
        {...props}
        ref={ref}
        id={id ?? descriptionId}
        className={['pr-sheet__description', className].filter(Boolean).join(' ')}
      />
    );
  },
);

export type SheetFooterProps = HTMLAttributes<HTMLDivElement>;

export const SheetFooter = forwardRef<HTMLDivElement, SheetFooterProps>(function SheetFooter(
  { className, ...props },
  ref,
) {
  return (
    <div
      {...props}
      ref={ref}
      className={['pr-sheet__footer', className].filter(Boolean).join(' ')}
    />
  );
});
