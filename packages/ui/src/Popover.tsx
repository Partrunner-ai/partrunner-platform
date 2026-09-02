'use client';

import {
  Children,
  createContext,
  forwardRef,
  isValidElement,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type MouseEvent,
  type MutableRefObject,
  type ReactNode,
  type Ref,
} from 'react';
import { createPortal } from 'react-dom';
import { menuStyle, useAnchoredMenu, type MenuPosition } from './useAnchoredMenu';
import { Slot } from './Slot';

export type PopoverAlign = 'start' | 'center' | 'end';

/**
 * `none` emits no padding class at all rather than `padding: 0` — see the note above
 * `.pr-popover__content--pad-md`. A panel holding its own list or calendar owns its
 * insets, and a base padding it cannot switch off is a 12px surprise at every one of
 * those call sites.
 */
export type PopoverPadding = 'md' | 'none';

const ANCHOR_ALIGN = { start: 'left', center: 'center', end: 'right' } as const;

const FOCUSABLE = [
  'a[href]',
  'button:not(:disabled)',
  'input:not(:disabled):not([type="hidden"])',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * See `DropdownMenu` — the content owns `align` in every call site, the hook needs it
 * before the content exists, so the root reads it off its own children.
 */
function alignFromChildren(children: ReactNode): PopoverAlign {
  let align: PopoverAlign = 'center';
  const visit = (node: ReactNode) => {
    Children.forEach(node, (child) => {
      if (!isValidElement(child)) return;
      const props = child.props as { align?: PopoverAlign; children?: ReactNode };
      if (child.type === PopoverContent) {
        if (props.align) align = props.align;
        return;
      }
      visit(props.children);
    });
  };
  visit(children);
  return align;
}

interface PopoverContextValue {
  open: boolean;
  triggerRef: MutableRefObject<HTMLButtonElement | null>;
  menuRef: MutableRefObject<HTMLDivElement | null>;
  pos: MenuPosition | null;
  toggle: () => void;
  close: (options?: { restoreFocus?: boolean }) => void;
}

const PopoverContext = createContext<PopoverContextValue | null>(null);

function usePopoverContext(component: string): PopoverContextValue {
  const context = useContext(PopoverContext);
  if (!context) throw new Error(`${component} must be rendered inside Popover.`);
  return context;
}

export interface PopoverProps {
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Viewport height the panel may occupy before it scrolls. Defaults to 280px. */
  maxHeight?: number;
  /**
   * Room below the trigger that keeps the panel there. With less, and more room
   * above, the panel flips up. Defaults to 180px; a panel holding a calendar
   * asks for its full height so it opens where it fits instead of scrolling.
   */
  minimumSpace?: number;
  /**
   * Size the panel to its trigger instead of to its content. Default false.
   *
   * A filter or picker panel can line up with a full-width field rather than
   * shrinking to its longest row.
   */
  matchTriggerWidth?: boolean;
}

/**
 * Free-form content anchored to a trigger.
 *
 * The difference from `DropdownMenu` is only what is inside it: a popover holds
 * arbitrary interactive content — a calendar, a filter form, a checkbox list — so it
 * has no row roles, no arrow-key ring, and its focus is left to whatever the app puts
 * in it. Positioning, portalling and dialog-layer ownership are the same engine, which
 * is the part that has to be shared: a popover rendered inline gets clipped by the
 * scrolling body of any dialog it opens in, and that is exactly where filters live.
 */
export function Popover({
  children,
  open: controlledOpen,
  defaultOpen,
  onOpenChange,
  maxHeight,
  minimumSpace,
  matchTriggerWidth = false,
}: PopoverProps) {
  const align = useMemo(() => alignFromChildren(children), [children]);
  const { open, setOpen, triggerRef, menuRef, pos } = useAnchoredMenu<HTMLButtonElement>({
    open: controlledOpen,
    defaultOpen,
    onOpenChange,
    align: ANCHOR_ALIGN[align],
    matchTriggerWidth,
    maxHeight,
    minimumSpace,
  });

  const close = useCallback(
    (options?: { restoreFocus?: boolean }) => {
      setOpen(false);
      if (options?.restoreFocus !== false) {
        queueMicrotask(() => triggerRef.current?.focus());
      }
    },
    [setOpen, triggerRef],
  );

  const toggle = useCallback(() => setOpen((previous) => !previous), [setOpen]);

  const context = useMemo<PopoverContextValue>(
    () => ({ open, triggerRef, menuRef, pos, toggle, close }),
    [close, menuRef, open, pos, toggle, triggerRef],
  );

  return <PopoverContext.Provider value={context}>{children}</PopoverContext.Provider>;
}

export interface PopoverTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export const PopoverTrigger = forwardRef<HTMLButtonElement, PopoverTriggerProps>(
  function PopoverTrigger(
    { asChild = false, type = 'button', className, children, onClick, ...props },
    forwardedRef,
  ) {
    const context = usePopoverContext('PopoverTrigger');
    const disabled = Boolean(props.disabled);
    const assignRef = useCallback(
      (node: HTMLButtonElement | null) => {
        context.triggerRef.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [context.triggerRef, forwardedRef],
    );

    const sharedProps = {
      ...props,
      type,
      'aria-haspopup': 'dialog' as const,
      'aria-expanded': context.open,
      'data-slot': 'popover-trigger',
      'data-state': context.open ? 'open' : 'closed',
      className: [
        'pr-popover__trigger',
        !asChild && 'pr-popover__trigger--raw',
        className,
      ]
        .filter(Boolean)
        .join(' '),
      onClick: (event: MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        if (!event.defaultPrevented && !disabled) context.toggle();
      },
    };

    if (asChild) {
      return (
        <Slot {...sharedProps} ref={assignRef as Ref<unknown>}>
          {children}
        </Slot>
      );
    }
    return (
      <button {...sharedProps} ref={assignRef}>
        {children}
      </button>
    );
  },
);

export interface PopoverContentProps extends HTMLAttributes<HTMLDivElement> {
  align?: PopoverAlign;
  /**
   * Inset around the content. Pass `none` for a panel that owns its own spacing —
   * a command list, a calendar, a table of rows that need to reach the edges.
   */
  padding?: PopoverPadding;
  /**
   * Move focus into the panel when it opens. Default true.
   *
   * A popover holding a form or a calendar has to take focus or a keyboard user
   * cannot reach it — it is in a portal at the end of `body`, so Tab does not walk
   * into it from the trigger. Pass `false` for a purely informational panel, where
   * stealing focus is the wrong thing.
   */
  autoFocus?: boolean;
}

export const PopoverContent = forwardRef<HTMLDivElement, PopoverContentProps>(
  function PopoverContent(
    {
      // `align` is read by the root off these props; destructured so it stays off the DOM.
      align: _align,
      padding = 'md',
      autoFocus = true,
      className,
      children,
      style,
      onKeyDown,
      ...props
    },
    forwardedRef,
  ) {
    const context = usePopoverContext('PopoverContent');

    const assignRef = useCallback(
      (node: HTMLDivElement | null) => {
        context.menuRef.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [context.menuRef, forwardedRef],
    );

    useLayoutEffect(() => {
      if (!context.open || !autoFocus) return;
      const panel = context.menuRef.current;
      const target = panel?.querySelector<HTMLElement>(FOCUSABLE) ?? panel;
      // As in RichSelect: the trigger's own click focus can land after this portal
      // commits, so defer a microtask and let the panel win deterministically.
      queueMicrotask(() => target?.focus());
    }, [autoFocus, context.menuRef, context.open]);

    if (!context.open || typeof document === 'undefined') return null;

    // No key handling of its own. Escape belongs to the shared hook, which also stops
    // it reaching an enclosing dialog, and Tab is deliberately left alone: unlike a
    // menu, the content here is a real form whose fields are meant to be tab stops.

    return createPortal(
      <div
        {...props}
        ref={assignRef}
        role="dialog"
        tabIndex={-1}
        data-slot="popover-content"
        data-state="open"
        data-padding={padding}
        className={[
          'pr-popover__content',
          padding === 'none' ? null : `pr-popover__content--pad-${padding}`,
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ ...menuStyle(context.pos), ...style }}
        onKeyDown={onKeyDown}
      >
        {children}
      </div>,
      document.body,
    );
  },
);

export type PopoverHeaderProps = HTMLAttributes<HTMLDivElement>;

export const PopoverHeader = forwardRef<HTMLDivElement, PopoverHeaderProps>(
  function PopoverHeader({ className, ...props }, ref) {
    return (
      <div
        {...props}
        ref={ref}
        data-slot="popover-header"
        className={['pr-popover__header', className].filter(Boolean).join(' ')}
      />
    );
  },
);

export type PopoverTitleProps = HTMLAttributes<HTMLHeadingElement>;

export const PopoverTitle = forwardRef<HTMLHeadingElement, PopoverTitleProps>(
  function PopoverTitle({ className, ...props }, ref) {
    return (
      <h2
        {...props}
        ref={ref}
        data-slot="popover-title"
        className={['pr-popover__title', className].filter(Boolean).join(' ')}
      />
    );
  },
);

export type PopoverDescriptionProps = HTMLAttributes<HTMLParagraphElement>;

export const PopoverDescription = forwardRef<HTMLParagraphElement, PopoverDescriptionProps>(
  function PopoverDescription({ className, ...props }, ref) {
    return (
      <p
        {...props}
        ref={ref}
        data-slot="popover-description"
        className={['pr-popover__description', className].filter(Boolean).join(' ')}
      />
    );
  },
);
