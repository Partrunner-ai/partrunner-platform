'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type SetStateAction,
} from 'react';
import { registerDialogLayerPortal } from './DialogLayer';

export interface MenuPosition {
  maxHeight: number;
  top?: number;
  bottom?: number;
  /** Horizontal anchor: one of `left` / `right`, in px from the viewport edge. */
  left?: number;
  right?: number;
  /** Fixed width matching the trigger, or content width with a minimum. */
  width?: number;
  minWidth?: number;
  maxWidth?: number;
}

export interface HorizontalAnchorInput {
  align: 'left' | 'center' | 'right';
  matchTriggerWidth: boolean;
  triggerLeft: number;
  triggerRight: number;
  triggerWidth: number;
  /** What the panel's content actually wants, not what a previous pass clamped it to. */
  measuredWidth: number;
  viewportWidth: number;
  margin: number;
}

/**
 * Where the panel sits horizontally, and how wide it may be.
 *
 * The panel may use the viewport, not only the gap between its trigger and the
 * aligned edge. Content that is wider than that gap shifts inward rather than
 * shrinking below its measured width.
 *
 * Right-aligned panels retain a `right` coordinate so their first frame is
 * correct before the panel's own width can be measured.
 */
export function anchorHorizontally({
  align,
  matchTriggerWidth,
  triggerLeft,
  triggerRight,
  triggerWidth,
  measuredWidth,
  viewportWidth,
  margin,
}: HorizontalAnchorInput): Pick<MenuPosition, 'left' | 'right' | 'width' | 'minWidth' | 'maxWidth'> {
  const availableWidth = Math.max(0, viewportWidth - 2 * margin);
  const clampLeft = (left: number) =>
    Math.max(margin, Math.min(left, viewportWidth - measuredWidth - margin));
  const placement =
    align === 'right'
      ? {
          right: Math.max(
            margin,
            Math.min(viewportWidth - triggerRight, viewportWidth - measuredWidth - margin),
          ),
        }
      : align === 'center'
        ? { left: clampLeft(triggerLeft + triggerWidth / 2 - measuredWidth / 2) }
        : { left: clampLeft(triggerLeft) };
  const sizing = matchTriggerWidth
    ? { width: Math.min(triggerWidth, availableWidth) }
    : { minWidth: Math.min(triggerWidth, availableWidth), maxWidth: availableWidth };
  return { ...placement, ...sizing };
}

export interface AnchoredMenuOptions {
  /** Controlled visibility. Pair with onOpenChange. */
  open?: boolean;
  /** Initial visibility when the menu is uncontrolled. */
  defaultOpen?: boolean;
  /** Called whenever an interaction requests a visibility change. */
  onOpenChange?: (open: boolean) => void;
  /** Menu takes the trigger's width. False sizes it to its content. Default true. */
  matchTriggerWidth?: boolean;
  /**
   * Horizontal alignment against the trigger. Default 'left'.
   *
   * `center` is only meaningful with `matchTriggerWidth: false` — a menu the same
   * width as its trigger is already centred on it. It resolves to a `left` in
   * viewport coordinates rather than a transform, so the clamp below can keep a
   * content-sized popover on screen.
   */
  align?: 'left' | 'center' | 'right';
  /** Maximum viewport height reserved for the popup. Defaults to 280px. */
  maxHeight?: number;
  /** Space that triggers vertical flipping when the opposite side is roomier. */
  minimumSpace?: number;
}

/**
 * Positions a dropdown against a trigger, in `fixed` coordinates computed from the
 * trigger's rect.
 *
 * The point is the portal. Rendered inline, a menu is clipped by any ancestor with
 * `overflow: hidden|auto` or a `transform` — most often the scrolling body of a
 * dialog, which is exactly where selects live. Rendering to `document.body` in fixed
 * coordinates escapes all of that, at the cost of having to recompute on scroll and
 * resize, which this does.
 *
 * It flips above the trigger when there is not enough room below, and it registers
 * itself with `DialogLayer` as an owned portal — otherwise the dialog's focus trap
 * treats the open menu as outside itself and fights it.
 */
export function useAnchoredMenu<T extends HTMLElement>(options: AnchoredMenuOptions = {}) {
  const {
    open: controlledOpen,
    defaultOpen = false,
    onOpenChange,
    matchTriggerWidth = true,
    align = 'left',
    maxHeight: preferredMaxHeight = 280,
    minimumSpace = 180,
  } = options;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = useCallback(
    (nextState: SetStateAction<boolean>) => {
      const nextOpen = typeof nextState === 'function' ? nextState(open) : nextState;
      if (!isControlled) setUncontrolledOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange, open],
  );
  // Declared as `T | null` so these come back mutable. Every consumer has to write
  // the node in from its own `asChild` ref callback, and `useRef<T>(null)` hands out a
  // read-only `RefObject` — which is why the compound components each launder it
  // through a `MutableRefObject` field on their context to assign to it at all.
  const triggerRef = useRef<T | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<MenuPosition | null>(null);

  const compute = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const GAP = 4;
    const MARGIN = 8;
    const MAX = preferredMaxHeight;
    const below = window.innerHeight - r.bottom - MARGIN;
    const above = r.top - MARGIN;
    // Only flip up when below is genuinely cramped *and* above is roomier, so a menu
    // near the middle of the page does not jump around as the list length changes.
    const openUp = below < Math.min(MAX, minimumSpace) && above > below;
    const maxHeight = Math.max(120, Math.min(MAX, openUp ? above : below));
    const vertical = openUp ? { bottom: window.innerHeight - r.top + GAP } : { top: r.bottom + GAP };
    // Centring needs the popup's own width, which only exists once it is in the DOM.
    // The portal commits before this layout effect, so the first pass already measures
    // it; the scroll/resize recompute corrects it if the content later reflows.
    //
    // `scrollWidth` as well as `offsetWidth`, and that is load-bearing: once a pass has
    // clamped the panel, `offsetWidth` reports the clamp rather than the content, so
    // measuring only that would compute the shift below from the very number the bug
    // produced and converge on the too-narrow width it is meant to correct.
    // `scrollWidth` keeps reporting what the content actually wants.
    const measuredWidth = menuRef.current
      ? Math.max(menuRef.current.offsetWidth, menuRef.current.scrollWidth)
      : r.width;
    const horizontal = anchorHorizontally({
      align,
      matchTriggerWidth,
      triggerLeft: r.left,
      triggerRight: r.right,
      triggerWidth: r.width,
      measuredWidth,
      viewportWidth: window.innerWidth,
      margin: MARGIN,
    });
    setPos({ maxHeight, ...vertical, ...horizontal });
  }, [align, matchTriggerWidth, minimumSpace, preferredMaxHeight]);

  useLayoutEffect(() => {
    if (open) compute();
  }, [open, compute]);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    const unregisterPortal =
      trigger && menu ? registerDialogLayerPortal(trigger, menu) : () => undefined;
    const onScrollOrResize = () => compute();
    // capture, so scrolling the dialog's body also repositions it.
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target;
      if (e.key !== 'Escape' || !(target instanceof Node) || !menuRef.current?.contains(target)) {
        return;
      }
      // Stop it here: an Escape meant for the menu should not also close the dialog
      // the menu is sitting in. Both listeners live on `document` in capture phase,
      // so stopPropagation is insufficient; it does not stop sibling listeners on
      // the same node.
      e.preventDefault();
      e.stopImmediatePropagation();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      unregisterPortal();
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open, compute, setOpen]);

  return { open, setOpen, triggerRef, menuRef, pos };
}

/** Turns a computed position into inline styles for the fixed container. */
export function menuStyle(pos: MenuPosition | null): CSSProperties {
  // Before the first measurement there is no correct place to put it, so it is
  // rendered hidden rather than flashing at the top-left corner.
  if (!pos) return { position: 'fixed', visibility: 'hidden' };
  return {
    position: 'fixed',
    maxHeight: pos.maxHeight,
    ...(pos.left != null ? { left: pos.left } : {}),
    ...(pos.right != null ? { right: pos.right } : {}),
    ...(pos.width != null ? { width: pos.width } : {}),
    ...(pos.minWidth != null ? { minWidth: pos.minWidth } : {}),
    ...(pos.maxWidth != null ? { maxWidth: pos.maxWidth } : {}),
    ...(pos.top != null ? { top: pos.top } : {}),
    ...(pos.bottom != null ? { bottom: pos.bottom } : {}),
  };
}
