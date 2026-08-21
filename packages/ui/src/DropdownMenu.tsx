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
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type MutableRefObject,
  type ReactNode,
  type Ref,
} from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { Slot } from './Slot';
import { menuStyle, useAnchoredMenu, type MenuPosition } from './useAnchoredMenu';

/** Alignment options shared with the anchored positioning engine. */
export type DropdownMenuAlign = 'start' | 'center' | 'end';

const ANCHOR_ALIGN = { start: 'left', center: 'center', end: 'right' } as const;

/**
 * Navigable rows, by role rather than by class.
 *
 * A menu's rows are not all one component — plain items, checkbox items and
 * (in an app's own composition) anything it gives a menu role to all have to take
 * part in the same arrow-key ring. Asking the DOM by role picks those up without
 * every row having to register itself with the root.
 */
const ITEM_SELECTOR = '[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"]';

function menuItems(menu: HTMLElement | null): HTMLElement[] {
  if (!menu) return [];
  return Array.from(menu.querySelectorAll<HTMLElement>(ITEM_SELECTOR)).filter(
    (element) => element.getAttribute('aria-disabled') !== 'true' && !element.hidden,
  );
}

/**
 * Reads the alignment off the `DropdownMenuContent` in the root's own children.
 *
 * `align` belongs to the content API, while the positioning hook needs it at
 * the root before the content renders. Collecting it
 * from the children — the same thing `RichSelect` does with its items — keeps the
 * consumer-facing shape and still gets the first measurement right. Reporting it
 * upward from the content instead would position the first paint as `start` and
 * then jump.
 */
function alignFromChildren(children: ReactNode): DropdownMenuAlign {
  let align: DropdownMenuAlign = 'start';
  const visit = (node: ReactNode) => {
    Children.forEach(node, (child) => {
      if (!isValidElement(child)) return;
      const props = child.props as { align?: DropdownMenuAlign; children?: ReactNode };
      if (child.type === DropdownMenuContent) {
        if (props.align) align = props.align;
        return;
      }
      visit(props.children);
    });
  };
  visit(children);
  return align;
}

interface DropdownMenuContextValue {
  open: boolean;
  triggerRef: MutableRefObject<HTMLButtonElement | null>;
  menuRef: MutableRefObject<HTMLDivElement | null>;
  pos: MenuPosition | null;
  /** Which edge to focus once the portal has committed, or null to leave focus alone. */
  pendingFocus: 'first' | 'last' | null;
  clearPendingFocus: () => void;
  toggle: () => void;
  openFrom: (edge: 'first' | 'last') => void;
  close: (options?: { restoreFocus?: boolean }) => void;
}

const DropdownMenuContext = createContext<DropdownMenuContextValue | null>(null);

function useDropdownMenuContext(component: string): DropdownMenuContextValue {
  const context = useContext(DropdownMenuContext);
  if (!context) throw new Error(`${component} must be rendered inside DropdownMenu.`);
  return context;
}

export interface DropdownMenuProps {
  children: ReactNode;
  /** Controlled visibility. Pair with onOpenChange. */
  open?: boolean;
  /** Initial visibility when the menu is uncontrolled. */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Viewport height the menu may occupy before it scrolls. Defaults to 280px. */
  maxHeight?: number;
}

/**
 * An actions menu hung off a trigger.
 *
 * The package keeps its menu implementation independent of a consumer's
 * component vendor and Tailwind version. It shares the positioning engine
 * behind `Select` and `Combobox`, so a
 * menu opened inside a dialog escapes the dialog's scroll container and is still
 * recognised by the dialog's focus trap instead of being fought by it.
 *
 * Unlike a select, this is a menu: rows take real DOM focus rather than
 * `aria-activedescendant`, which is what the menu pattern specifies and what screen
 * readers announce correctly.
 */
export function DropdownMenu({
  children,
  open: controlledOpen,
  defaultOpen,
  onOpenChange,
  maxHeight,
}: DropdownMenuProps) {
  const align = useMemo(() => alignFromChildren(children), [children]);
  const {
    open,
    setOpen,
    triggerRef,
    menuRef,
    pos,
  } = useAnchoredMenu<HTMLButtonElement>({
    open: controlledOpen,
    defaultOpen,
    onOpenChange,
    align: ANCHOR_ALIGN[align],
    // A menu is as wide as its longest label. Stretching it to an icon-button
    // trigger — which is what most of these hang off — would be unreadable.
    matchTriggerWidth: false,
    maxHeight,
  });
  const [pendingFocus, setPendingFocus] = useState<'first' | 'last' | null>(null);

  const close = useCallback(
    (options?: { restoreFocus?: boolean }) => {
      setOpen(false);
      setPendingFocus(null);
      if (options?.restoreFocus !== false) {
        // After the portal unmounts, or the browser puts focus on `body` instead.
        queueMicrotask(() => triggerRef.current?.focus());
      }
    },
    [setOpen, triggerRef],
  );

  const openFrom = useCallback(
    (edge: 'first' | 'last') => {
      setPendingFocus(edge);
      setOpen(true);
    },
    [setOpen],
  );

  const toggle = useCallback(() => {
    if (open) close();
    else openFrom('first');
  }, [close, open, openFrom]);

  const clearPendingFocus = useCallback(() => setPendingFocus(null), []);

  const context = useMemo<DropdownMenuContextValue>(
    () => ({
      open,
      triggerRef,
      menuRef,
      pos,
      pendingFocus,
      clearPendingFocus,
      toggle,
      openFrom,
      close,
    }),
    [clearPendingFocus, close, menuRef, open, openFrom, pendingFocus, pos, toggle, triggerRef],
  );

  return (
    <DropdownMenuContext.Provider value={context}>{children}</DropdownMenuContext.Provider>
  );
}

export interface DropdownMenuTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export const DropdownMenuTrigger = forwardRef<HTMLButtonElement, DropdownMenuTriggerProps>(
  function DropdownMenuTrigger(
    { asChild = false, type = 'button', className, children, onClick, onKeyDown, ...props },
    forwardedRef,
  ) {
    const context = useDropdownMenuContext('DropdownMenuTrigger');
    const disabled = Boolean(props.disabled);
    const assignRef = useCallback(
      (node: HTMLButtonElement | null) => {
        context.triggerRef.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [context.triggerRef, forwardedRef],
    );

    const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      if (!event.defaultPrevented && !disabled) context.toggle();
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented || disabled) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        context.openFrom('first');
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        context.openFrom('last');
      }
      // Enter and Space are deliberately left to the button's native click.
    };

    const sharedProps = {
      ...props,
      type,
      'aria-haspopup': 'menu' as const,
      'aria-expanded': context.open,
      'data-slot': 'dropdown-menu-trigger',
      'data-state': context.open ? 'open' : 'closed',
      className: ['pr-menu__trigger', !asChild && 'pr-menu__trigger--raw', className]
        .filter(Boolean)
        .join(' '),
      onClick: handleClick,
      onKeyDown: handleKeyDown,
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

export interface DropdownMenuContentProps extends HTMLAttributes<HTMLDivElement> {
  align?: DropdownMenuAlign;
}

export const DropdownMenuContent = forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  function DropdownMenuContent(
    // `align` is consumed by the root, which reads it off these props before this
    // ever renders. Destructured here only so it does not land on the DOM node.
    { align: _align, className, children, style, onKeyDown, ...props },
    forwardedRef,
  ) {
    const context = useDropdownMenuContext('DropdownMenuContent');
    const typeahead = useRef({ buffer: '', timer: null as ReturnType<typeof setTimeout> | null });

    const assignRef = useCallback(
      (node: HTMLDivElement | null) => {
        context.menuRef.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [context.menuRef, forwardedRef],
    );

    useLayoutEffect(() => {
      if (!context.open || !context.pendingFocus) return;
      const rows = menuItems(context.menuRef.current);
      const target = context.pendingFocus === 'last' ? rows[rows.length - 1] : rows[0];
      // Same reason as RichSelect: the trigger's own click focus can land after this
      // portal commits, so defer a microtask and let the menu win deterministically.
      queueMicrotask(() => target?.focus());
      context.clearPendingFocus();
    }, [context]);

    const move = (step: 1 | -1) => {
      const rows = menuItems(context.menuRef.current);
      if (rows.length === 0) return;
      const current = rows.indexOf(document.activeElement as HTMLElement);
      const next =
        current === -1
          ? step === 1
            ? 0
            : rows.length - 1
          : (current + step + rows.length) % rows.length;
      rows[next]?.focus();
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        move(1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        move(-1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        menuItems(context.menuRef.current)[0]?.focus();
      } else if (event.key === 'End') {
        event.preventDefault();
        const rows = menuItems(context.menuRef.current);
        rows[rows.length - 1]?.focus();
      } else if (event.key === 'Tab') {
        // A menu is a single stop. Tabbing dismisses it rather than walking rows,
        // which is what the pattern says and what stops focus being lost in a portal.
        event.preventDefault();
        context.close();
      } else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const state = typeahead.current;
        if (state.timer) clearTimeout(state.timer);
        state.buffer += event.key.toLocaleLowerCase();
        state.timer = setTimeout(() => {
          state.buffer = '';
        }, 700);
        const match = menuItems(context.menuRef.current).find((row) =>
          (row.textContent ?? '').trim().toLocaleLowerCase().startsWith(state.buffer),
        );
        if (match) {
          event.preventDefault();
          match.focus();
        }
      }
    };

    if (!context.open || typeof document === 'undefined') return null;

    return createPortal(
      <div
        {...props}
        ref={assignRef}
        role="menu"
        tabIndex={-1}
        data-slot="dropdown-menu-content"
        data-state="open"
        className={['pr-menu__content', className].filter(Boolean).join(' ')}
        style={{ ...menuStyle(context.pos), ...style }}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>,
      document.body,
    );
  },
);

export interface DropdownMenuItemProps extends HTMLAttributes<HTMLDivElement> {
  disabled?: boolean;
  /**
   * Fires for both click and keyboard activation, then the menu closes.
   *
   * `preventDefault()` on the passed event keeps the menu open, which is how a row
   * that toggles something stays put.
   */
  onSelect?: (event: { preventDefault: () => void; defaultPrevented: boolean }) => void;
  /** Render the child instead of a `<div>` — for a row that is a real link. */
  asChild?: boolean;
  /** A destructive row, over the semantic danger tone rather than a local red. */
  destructive?: boolean;
  /** Leading slot, usually a 16px lucide icon. */
  icon?: ReactNode;
}

export const DropdownMenuItem = forwardRef<HTMLDivElement, DropdownMenuItemProps>(
  function DropdownMenuItem(
    {
      disabled = false,
      onSelect,
      asChild = false,
      destructive = false,
      icon,
      className,
      children,
      onClick,
      onKeyDown,
      ...props
    },
    ref,
  ) {
    const context = useDropdownMenuContext('DropdownMenuItem');

    const select = () => {
      if (disabled) return;
      let kept = false;
      onSelect?.({
        preventDefault: () => {
          kept = true;
        },
        get defaultPrevented() {
          return kept;
        },
      });
      if (!kept) context.close();
    };

    const handleClick = (event: MouseEvent<HTMLDivElement>) => {
      onClick?.(event);
      if (event.defaultPrevented) return;
      select();
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        select();
      }
    };

    const sharedProps = {
      ...props,
      role: 'menuitem',
      // Rows are reached with arrows, not Tab, so they are focusable but not tab stops.
      tabIndex: -1,
      'aria-disabled': disabled || undefined,
      'data-slot': 'dropdown-menu-item',
      'data-disabled': disabled ? '' : undefined,
      className: [
        'pr-menu__item',
        destructive ? 'pr-menu__item--destructive' : null,
        className,
      ]
        .filter(Boolean)
        .join(' '),
      onClick: handleClick,
      onKeyDown: handleKeyDown,
    };

    if (asChild) {
      return (
        <Slot {...sharedProps} ref={ref as Ref<unknown>}>
          {children}
        </Slot>
      );
    }
    return (
      <div {...sharedProps} ref={ref}>
        {icon ? (
          <span className="pr-menu__item-icon" aria-hidden>
            {icon}
          </span>
        ) : null}
        <span className="pr-menu__item-content">{children}</span>
      </div>
    );
  },
);

export interface DropdownMenuCheckboxItemProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
}

/**
 * A row that toggles instead of navigating, so it deliberately does not close the
 * menu — the point of a checkbox row is ticking several without reopening.
 */
export const DropdownMenuCheckboxItem = forwardRef<HTMLDivElement, DropdownMenuCheckboxItemProps>(
  function DropdownMenuCheckboxItem(
    { checked = false, onCheckedChange, disabled = false, className, children, onClick, onKeyDown, ...props },
    ref,
  ) {
    const toggle = () => {
      if (!disabled) onCheckedChange?.(!checked);
    };
    return (
      <div
        {...props}
        ref={ref}
        role="menuitemcheckbox"
        tabIndex={-1}
        aria-checked={checked}
        aria-disabled={disabled || undefined}
        data-slot="dropdown-menu-checkbox-item"
        data-state={checked ? 'checked' : 'unchecked'}
        data-disabled={disabled ? '' : undefined}
        className={['pr-menu__item', 'pr-menu__item--checkbox', className].filter(Boolean).join(' ')}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) toggle();
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggle();
          }
        }}
      >
        <span className="pr-menu__indicator" aria-hidden>
          {checked ? <Check size={15} /> : null}
        </span>
        <span className="pr-menu__item-content">{children}</span>
      </div>
    );
  },
);

interface DropdownMenuRadioContextValue {
  value: string | undefined;
  onValueChange?: (value: string) => void;
}

const DropdownMenuRadioContext = createContext<DropdownMenuRadioContextValue | null>(null);

export interface DropdownMenuRadioGroupProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value?: string;
  onValueChange?: (value: string) => void;
}

/**
 * A single-choice set of rows.
 *
 * The group owns the value so the rows do not each have to be told which one is
 * current — the same reason `RichSelect` collects its items rather than having each
 * one wire itself up.
 */
export const DropdownMenuRadioGroup = forwardRef<HTMLDivElement, DropdownMenuRadioGroupProps>(
  function DropdownMenuRadioGroup({ value, onValueChange, className, ...props }, ref) {
    const context = useMemo(() => ({ value, onValueChange }), [onValueChange, value]);
    return (
      <DropdownMenuRadioContext.Provider value={context}>
        <div
          {...props}
          ref={ref}
          role="group"
          data-slot="dropdown-menu-radio-group"
          className={['pr-menu__group', className].filter(Boolean).join(' ')}
        />
      </DropdownMenuRadioContext.Provider>
    );
  },
);

export interface DropdownMenuRadioItemProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
  disabled?: boolean;
}

/**
 * One choice in a `DropdownMenuRadioGroup`.
 *
 * Unlike `DropdownMenuCheckboxItem`, this **closes** the menu. The asymmetry is
 * deliberate rather than an oversight: ticking checkboxes is a series of edits and
 * reopening between each one is the annoyance that row exists to avoid, whereas
 * picking one of several options is a completed choice and leaving the menu open
 * afterwards just makes the user dismiss it.
 */
export const DropdownMenuRadioItem = forwardRef<HTMLDivElement, DropdownMenuRadioItemProps>(
  function DropdownMenuRadioItem(
    { value, disabled = false, className, children, onClick, onKeyDown, ...props },
    ref,
  ) {
    const menu = useDropdownMenuContext('DropdownMenuRadioItem');
    const group = useContext(DropdownMenuRadioContext);
    if (!group) throw new Error('DropdownMenuRadioItem must be rendered inside DropdownMenuRadioGroup.');
    const checked = group.value === value;

    const select = () => {
      if (disabled) return;
      if (!checked) group.onValueChange?.(value);
      menu.close();
    };

    return (
      <div
        {...props}
        ref={ref}
        role="menuitemradio"
        tabIndex={-1}
        aria-checked={checked}
        aria-disabled={disabled || undefined}
        data-slot="dropdown-menu-radio-item"
        data-state={checked ? 'checked' : 'unchecked'}
        data-disabled={disabled ? '' : undefined}
        className={['pr-menu__item', 'pr-menu__item--checkbox', className].filter(Boolean).join(' ')}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) select();
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            select();
          }
        }}
      >
        <span className="pr-menu__indicator" aria-hidden>
          {checked ? <Check size={15} /> : null}
        </span>
        <span className="pr-menu__item-content">{children}</span>
      </div>
    );
  },
);

export type DropdownMenuLabelProps = HTMLAttributes<HTMLDivElement>;

export const DropdownMenuLabel = forwardRef<HTMLDivElement, DropdownMenuLabelProps>(
  function DropdownMenuLabel({ className, ...props }, ref) {
    return (
      <div
        {...props}
        ref={ref}
        data-slot="dropdown-menu-label"
        className={['pr-menu__label', className].filter(Boolean).join(' ')}
      />
    );
  },
);

export type DropdownMenuSeparatorProps = HTMLAttributes<HTMLDivElement>;

export const DropdownMenuSeparator = forwardRef<HTMLDivElement, DropdownMenuSeparatorProps>(
  function DropdownMenuSeparator({ className, ...props }, ref) {
    return (
      <div
        {...props}
        ref={ref}
        role="separator"
        data-slot="dropdown-menu-separator"
        className={['pr-menu__separator', className].filter(Boolean).join(' ')}
      />
    );
  },
);

export type DropdownMenuGroupProps = HTMLAttributes<HTMLDivElement>;

export const DropdownMenuGroup = forwardRef<HTMLDivElement, DropdownMenuGroupProps>(
  function DropdownMenuGroup({ className, ...props }, ref) {
    return (
      <div
        {...props}
        ref={ref}
        role="group"
        data-slot="dropdown-menu-group"
        className={['pr-menu__group', className].filter(Boolean).join(' ')}
      />
    );
  },
);
