'use client';

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  type FocusEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { menuStyle, useAnchoredMenu } from './useAnchoredMenu';

export interface TooltipProps {
  /** The tooltip text. A tooltip with no content renders nothing and adds no handlers. */
  content: ReactNode;
  /** The single element the tooltip describes. It must accept a ref and DOM handlers. */
  children: ReactElement;
  /** Hover delay in ms before it appears. Default 200. Focus always shows immediately. */
  delay?: number;
  /** Horizontal alignment against the trigger. Default 'center'. */
  align?: 'start' | 'center' | 'end';
  /** Render the tooltip but keep it from ever opening — for a disabled affordance. */
  disabled?: boolean;
  className?: string;
}

const ANCHOR_ALIGN = { start: 'left', center: 'center', end: 'right' } as const;

/**
 * A hover and focus hint.
 *
 * This one is a single component taking `content`, not a Root/Trigger/Content trio.
 * Compound APIs are useful when callers compose popup content, as in
 * `DropdownMenu` and `Popover`; a tooltip body is one run of descriptive text.
 *
 * It describes rather than labels: the trigger keeps whatever accessible name it
 * already had and gains `aria-describedby`. A tooltip is not a substitute for a label
 * on an icon-only button — that button still needs its own `aria-label`, because a
 * tooltip never opens for a touch user at all.
 */
export function Tooltip({
  content,
  children,
  delay = 200,
  align = 'center',
  disabled = false,
  className,
}: TooltipProps) {
  const id = useId();
  const { open, setOpen, triggerRef, menuRef, pos } = useAnchoredMenu<HTMLElement>({
    align: ANCHOR_ALIGN[align],
    matchTriggerWidth: false,
    // A hint is a couple of lines. Reserving a menu's height would let a long string
    // become a wall of text pinned over the thing it is describing.
    maxHeight: 160,
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Set whenever focus is about to arrive because of a pointer rather than the
   * keyboard, so the focus handler can decline to reopen what the press just closed.
   *
   * `:focus-visible` alone is not enough to decide this. It is the right signal and it
   * is still checked, but it is also the kind of selector environments implement
   * loosely — jsdom matches it for a plain mouse click on a button, which turns
   * click-to-dismiss into click-to-reopen. This is a ref rather than state because it
   * has to be readable in the `focus` that follows `pointerdown` in the same tick.
   */
  const suppressFocus = useRef(false);

  const cancel = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => cancel, [cancel]);

  const show = useCallback(
    (immediate: boolean) => {
      if (disabled) return;
      cancel();
      if (immediate || delay <= 0) {
        setOpen(true);
        return;
      }
      timer.current = setTimeout(() => setOpen(true), delay);
    },
    [cancel, delay, disabled, setOpen],
  );

  const hide = useCallback(() => {
    cancel();
    setOpen(false);
  }, [cancel, setOpen]);

  useEffect(() => {
    if (!open) return;
    // Escape has to dismiss a tooltip, and the shared hook's handler only fires for
    // keys pressed inside the popup — which never happens here, because a tooltip
    // holds no focus. So this owns its own.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [hide, open]);

  if (!isValidElement(children)) {
    throw new Error('Tooltip expects a single element child.');
  }
  if (content === null || content === undefined || content === false || content === '') {
    return children;
  }

  const childProps = children.props as Record<string, unknown> & {
    'aria-describedby'?: string;
  };

  const assignRef = (node: HTMLElement | null) => {
    triggerRef.current = node;
    const ref = (children as unknown as { ref?: unknown }).ref;
    if (typeof ref === 'function') (ref as (value: HTMLElement | null) => void)(node);
    else if (ref && typeof ref === 'object') {
      (ref as { current: HTMLElement | null }).current = node;
    }
  };

  const call = (name: string, event: unknown) => {
    const handler = childProps[name];
    if (typeof handler === 'function') (handler as (value: unknown) => void)(event);
  };

  const trigger = cloneElement(children, {
    ref: assignRef,
    // Chained onto whatever the child already declared rather than replacing it.
    'aria-describedby': [childProps['aria-describedby'], open ? id : null]
      .filter(Boolean)
      .join(' ') || undefined,
    onPointerEnter: (event: unknown) => {
      call('onPointerEnter', event);
      // A touch tap fires pointerenter too, and a tooltip that opens under a thumb
      // covers the control that was just tapped. Only a real hover opens this.
      const pointerType = (event as { pointerType?: string })?.pointerType;
      if (pointerType === 'touch' || pointerType === 'pen') {
        suppressFocus.current = true;
        return;
      }
      show(false);
    },
    onPointerLeave: (event: unknown) => {
      call('onPointerLeave', event);
      hide();
    },
    onPointerDown: (event: unknown) => {
      call('onPointerDown', event);
      // Pressing the thing dismisses the hint about it, and the focus that follows
      // must not immediately bring it back.
      suppressFocus.current = true;
      hide();
    },
    onFocus: (event: FocusEvent<HTMLElement>) => {
      call('onFocus', event);
      // Keyboard focus shows it at once — a delay on focus reads as an unresponsive
      // control.
      if (suppressFocus.current) return;
      if (event.target.matches(':focus-visible')) show(true);
    },
    onBlur: (event: unknown) => {
      call('onBlur', event);
      // The next focus is a fresh interaction and gets judged on its own merits.
      suppressFocus.current = false;
      hide();
    },
  } as never);

  return (
    <>
      {trigger}
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              id={id}
              role="tooltip"
              data-slot="tooltip"
              data-state="open"
              className={['pr-tooltip', className].filter(Boolean).join(' ')}
              style={menuStyle(pos)}
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
