import {
  useEffect,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
  type RefObject,
  type MutableRefObject,
} from 'react';
import { createPortal } from 'react-dom';

/**
 * Unstyled modal layer: portal, stack, focus trap, background inert.
 *
 * Three behaviors beyond `aria-modal` require a shared stack rather than a
 * component-local effect:
 *
 *  1. LAYERS. A dialog can open a dialog. Escape must close the topmost, and the
 *     focus trap must follow it, so the registry is module-level and every handler
 *     reads the top of it.
 *  2. BACKGROUND INERT. Trapping Tab stops keyboard escape but leaves the page
 *     behind reachable by a screen reader's virtual cursor and by pointer. Every
 *     body child outside the active layer gets `inert` + `aria-hidden`, with its
 *     prior value saved so it is restored rather than assumed.
 *  3. OWNED PORTALS. A select or date-picker that renders into its own portal is
 *     visually inside the dialog but not a DOM descendant of it. Without
 *     `registerDialogLayerPortal` it would be treated as outside — tabbing into a
 *     dropdown would walk straight out of the trap, and the dropdown itself would
 *     be made inert.
 *
 * Styling belongs to the caller; `Dialog` is the styled one.
 */
export interface DialogLayerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  rootClassName?: string;
  backdropClassName?: string;
  panelClassName?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  /** Dialog semantics for regular modals or confirmations. */
  role?: 'dialog' | 'alertdialog';
  /** Native attributes and event handlers forwarded to the modal panel. */
  panelProps?: Omit<
    HTMLAttributes<HTMLDivElement>,
    'aria-label' | 'aria-labelledby' | 'aria-describedby' | 'className' | 'role'
  >;
  /** Access the rendered panel without owning its portal or focus behavior. */
  panelRef?: Ref<HTMLDivElement>;
  /** Focus this on open instead of the first focusable in the panel. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /**
   * Pick the element to focus, given the panel. Wins over `initialFocusRef`.
   * Needed when the target is not known until the panel exists — `Dialog` uses it
   * to reach the first control in the BODY rather than the first in DOM order,
   * which would be the close button in the header.
   */
  resolveInitialFocus?: (panel: HTMLElement) => HTMLElement | null;
  /**
   * Runs immediately before the layer applies its default focus. Prevent the
   * event when the consumer has deliberately focused another element.
   */
  onOpenAutoFocus?: (event: DialogLayerAutoFocusEvent) => void;
  /** When false, Escape and backdrop clicks do not close. Default true. */
  dismissible?: boolean;
  /**
   * When false, only the backdrop stops closing it — Escape still works. Narrower
   * than `dismissible`, for a form where a stray outside click would lose typing.
   */
  closeOnBackdrop?: boolean;
}

export interface DialogLayerAutoFocusEvent {
  readonly defaultPrevented: boolean;
  preventDefault(): void;
}

interface LayerRegistration {
  id: symbol;
  portal: HTMLElement;
  root: HTMLElement;
  zIndex: number;
  ownedPortals: Set<HTMLElement>;
  dialog: HTMLElement;
  onClose: () => void;
  dismissible: boolean;
  restoreFocus: HTMLElement | null;
  initialFocus: HTMLElement | null;
  resolveInitialFocus?: (panel: HTMLElement) => HTMLElement | null;
  onOpenAutoFocus?: (event: DialogLayerAutoFocusEvent) => void;
}

interface BackgroundState {
  ariaHidden: string | null;
  inert: boolean;
}

const OWNED_PORTAL_Z_OFFSET = 10;
const DIALOG_LAYER_Z_STEP = 20;
const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

// The ATTRIBUTE, not the property. `inert` as a property needs browser support and
// is absent in jsdom, so writing it there sets a meaningless expando; the attribute
// is what the HTML spec defines and it is inspectable everywhere.
function setInert(element: HTMLElement, value: boolean) {
  element.toggleAttribute('inert', value);
}

function isInert(element: HTMLElement): boolean {
  return element.hasAttribute('inert');
}

const layers: LayerRegistration[] = [];
const backgroundStates = new Map<HTMLElement, BackgroundState>();
let previousBodyOverflow = '';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusableElements(root: HTMLElement): HTMLElement[] {
  // Deliberately NOT filtering on `offsetParent`: it is null inside a
  // `position: fixed` ancestor, which the panel is, so that check would empty the
  // list and pin focus to one control.
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true',
  );
}

function layerFocusableElements(layer: LayerRegistration): HTMLElement[] {
  return [layer.dialog, ...Array.from(layer.ownedPortals)].flatMap(focusableElements);
}

function layerContains(layer: LayerRegistration, node: Node): boolean {
  return (
    layer.dialog.contains(node) ||
    Array.from(layer.ownedPortals).some((portal) => portal.contains(node))
  );
}

function topLayer(): LayerRegistration | undefined {
  return layers[layers.length - 1];
}

function handleDocumentKeyDown(event: KeyboardEvent) {
  const layer = topLayer();
  if (!layer || event.defaultPrevented) return;

  if (event.key === 'Escape') {
    if (!layer.dismissible) return;
    event.preventDefault();
    event.stopPropagation();
    layer.onClose();
    return;
  }

  if (event.key !== 'Tab') return;
  const focusable = layerFocusableElements(layer);
  if (!focusable.length) {
    event.preventDefault();
    layer.dialog.focus();
    return;
  }

  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  const active = document.activeElement;
  const focusIsOutside = !(active instanceof Node) || !layerContains(layer, active);
  const focusIsNotTabbable = !(active instanceof HTMLElement) || !focusable.includes(active);

  if (event.shiftKey && (active === first || focusIsOutside || focusIsNotTabbable)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || focusIsOutside)) {
    event.preventDefault();
    first.focus();
  }
}

function setBackgroundInert() {
  const layer = topLayer();
  const ownedPortals = layer ? Array.from(layer.ownedPortals) : [];

  for (const child of Array.from(document.body.children)) {
    if (!(child instanceof HTMLElement)) continue;
    if (!backgroundStates.has(child)) {
      backgroundStates.set(child, {
        ariaHidden: child.getAttribute('aria-hidden'),
        inert: isInert(child),
      });
    }

    const belongsToActiveLayer =
      child === layer?.portal ||
      ownedPortals.some((portal) => child === portal || child.contains(portal));

    if (belongsToActiveLayer) {
      setInert(child, false);
      child.removeAttribute('aria-hidden');
    } else {
      setInert(child, true);
      child.setAttribute('aria-hidden', 'true');
    }
  }
}

/**
 * Tell the layer stack that `portal` belongs to the dialog containing `owner`.
 *
 * For a control that renders its overlay elsewhere in the DOM — a combobox, a
 * date-picker — so it participates in the focus trap instead of being treated as
 * background and made inert. The body-level portal root is also placed above its
 * owning dialog without requiring each consumer to coordinate z-index values.
 * Returns the deregistration function and restores the portal's prior stack style.
 */
export function registerDialogLayerPortal(owner: HTMLElement, portal: HTMLElement): () => void {
  const layer = [...layers].reverse().find((candidate) => candidate.dialog.contains(owner));
  if (!layer) return () => undefined;

  let portalRoot = portal;
  while (portalRoot.parentElement && portalRoot.parentElement !== document.body) {
    portalRoot = portalRoot.parentElement;
  }

  const previousZIndex = portalRoot.style.zIndex;
  const previouslyOwned = portalRoot.hasAttribute('data-pr-dialog-layer-owned');

  portalRoot.dataset.prDialogLayerOwned = '';
  portalRoot.style.zIndex = String(layer.zIndex + OWNED_PORTAL_Z_OFFSET);
  layer.ownedPortals.add(portalRoot);
  setBackgroundInert();

  return () => {
    layer.ownedPortals.delete(portalRoot);
    if (!previouslyOwned) portalRoot.removeAttribute('data-pr-dialog-layer-owned');
    portalRoot.style.zIndex = previousZIndex;
    if (layers.includes(layer)) setBackgroundInert();
  };
}

function restoreBackground() {
  backgroundStates.forEach((state, element) => {
    setInert(element, state.inert);
    if (state.ariaHidden === null) element.removeAttribute('aria-hidden');
    else element.setAttribute('aria-hidden', state.ariaHidden);
  });
  backgroundStates.clear();
}

function registerLayer(layer: LayerRegistration) {
  const requestedZIndex = Number.parseInt(window.getComputedStyle(layer.root).zIndex, 10);
  const baseZIndex = Number.isFinite(requestedZIndex) ? requestedZIndex : 0;
  const parentZIndex = topLayer()?.zIndex;
  layer.zIndex =
    parentZIndex == null ? baseZIndex : Math.max(baseZIndex, parentZIndex + DIALOG_LAYER_Z_STEP);
  layer.root.style.zIndex = String(layer.zIndex);

  // Scroll lock and the key listener belong to the STACK, not to each dialog:
  // installed by the first and torn down by the last, so a nested dialog closing
  // does not unlock the page underneath its parent.
  if (!layers.length) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleDocumentKeyDown);
  }

  layers.push(layer);
  setBackgroundInert();

  queueMicrotask(() => {
    if (topLayer()?.id !== layer.id) return;
    let defaultPrevented = false;
    const event: DialogLayerAutoFocusEvent = {
      get defaultPrevented() {
        return defaultPrevented;
      },
      preventDefault() {
        defaultPrevented = true;
      },
    };
    layer.onOpenAutoFocus?.(event);
    if (event.defaultPrevented) return;
    const target =
      layer.resolveInitialFocus?.(layer.dialog) ??
      layer.initialFocus ??
      layerFocusableElements(layer)[0] ??
      layer.dialog;
    target.focus();
  });
}

function unregisterLayer(id: symbol) {
  const index = layers.findIndex((layer) => layer.id === id);
  if (index === -1) return;
  const [removed] = layers.splice(index, 1);

  if (layers.length) {
    setBackgroundInert();
  } else {
    document.removeEventListener('keydown', handleDocumentKeyDown);
    document.body.style.overflow = previousBodyOverflow;
    restoreBackground();
  }

  queueMicrotask(() => {
    if (removed?.restoreFocus?.isConnected) removed.restoreFocus.focus();
  });
}

export function DialogLayer({
  open,
  onClose,
  children,
  rootClassName,
  backdropClassName,
  panelClassName,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  role = 'dialog',
  panelProps,
  panelRef: forwardedPanelRef,
  initialFocusRef,
  resolveInitialFocus,
  onOpenAutoFocus,
  dismissible = true,
  closeOnBackdrop = true,
}: DialogLayerProps) {
  const idRef = useRef(Symbol('pr-dialog-layer'));
  const rootRef = useRef<HTMLDivElement>(null);
  const panelElementRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  const resolveInitialFocusRef = useRef(resolveInitialFocus);
  const onOpenAutoFocusRef = useRef(onOpenAutoFocus);
  const [portal] = useState<HTMLElement | null>(() =>
    typeof document === 'undefined' ? null : document.createElement('div'),
  );

  useEffect(() => {
    onCloseRef.current = onClose;
    dismissibleRef.current = dismissible;
    resolveInitialFocusRef.current = resolveInitialFocus;
    onOpenAutoFocusRef.current = onOpenAutoFocus;
  }, [dismissible, onClose, onOpenAutoFocus, resolveInitialFocus]);

  const assignPanelRef = useCallback(
    (node: HTMLDivElement | null) => {
      panelElementRef.current = node;
      if (typeof forwardedPanelRef === 'function') forwardedPanelRef(node);
      else if (forwardedPanelRef) {
        (forwardedPanelRef as MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [forwardedPanelRef],
  );

  useBrowserLayoutEffect(() => {
    if (!open || !portal) return;
    portal.dataset.prDialogLayer = '';
    document.body.appendChild(portal);
    return () => portal.remove();
  }, [open, portal]);

  useBrowserLayoutEffect(() => {
    if (!open || !portal || !rootRef.current || !panelElementRef.current) return;
    const id = idRef.current;
    registerLayer({
      id,
      portal,
      root: rootRef.current,
      zIndex: 0,
      ownedPortals: new Set(),
      dialog: panelElementRef.current,
      onClose: () => onCloseRef.current(),
      get dismissible() {
        return dismissibleRef.current;
      },
      restoreFocus: document.activeElement instanceof HTMLElement ? document.activeElement : null,
      initialFocus: initialFocusRef?.current ?? null,
      resolveInitialFocus: (panel) => resolveInitialFocusRef.current?.(panel) ?? null,
      onOpenAutoFocus: (event) => onOpenAutoFocusRef.current?.(event),
    } as LayerRegistration);
    return () => unregisterLayer(id);
  }, [initialFocusRef, open, portal]);

  if (!open || !portal) return null;

  return createPortal(
    <div ref={rootRef} className={rootClassName}>
      <div
        aria-hidden="true"
        className={backdropClassName}
        onMouseDown={() => {
          // Only the top layer responds, so a click landing on a parent dialog's
          // backdrop does not close it out from under a child.
          if (topLayer()?.id === idRef.current && dismissible && closeOnBackdrop) onClose();
        }}
      />
      <div
        {...panelProps}
        ref={assignPanelRef}
        role={role}
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        tabIndex={-1}
        className={panelClassName}
      >
        {children}
      </div>
    </div>,
    portal,
  );
}
