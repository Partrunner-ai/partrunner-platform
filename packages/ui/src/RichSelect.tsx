'use client';

import {
  Children,
  createContext,
  forwardRef,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ChangeEvent,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type MutableRefObject,
  type ReactNode,
  type Ref,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import { Slot } from './Slot';
import { menuStyle, useAnchoredMenu, type MenuPosition } from './useAnchoredMenu';

export type RichSelectSize = 'sm' | 'md' | 'lg';

export interface RichSelectProps {
  children: ReactNode;
  value?: string | null;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Controlled popup visibility. Pair with onOpenChange. */
  open?: boolean;
  /** Initial popup visibility when the root is uncontrolled. */
  defaultOpen?: boolean;
  /** Called whenever an interaction requests a popup visibility change. */
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
  align?: 'left' | 'right';
  matchTriggerWidth?: boolean;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
  'aria-required'?: boolean | 'true' | 'false';
}

interface RichSelectItemMetadata {
  value: string;
  textValue: string;
  disabled: boolean;
}

interface RichSelectStructure {
  items: RichSelectItemMetadata[];
  searchable: boolean;
}

interface RichSelectContextValue {
  value: string | null;
  selectedText: string | null;
  open: boolean;
  disabled: boolean;
  required: boolean;
  searchable: boolean;
  id: string;
  valueId: string;
  listId: string;
  name?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  ariaInvalid?: boolean | 'true' | 'false';
  ariaRequired?: boolean | 'true' | 'false';
  query: string;
  visibleItems: RichSelectItemMetadata[];
  activeValue: string | null;
  triggerRef: MutableRefObject<HTMLButtonElement | null>;
  menuRef: MutableRefObject<HTMLDivElement | null>;
  pos: MenuPosition | null;
  itemId: (value: string) => string;
  isVisible: (value: string) => boolean;
  toggleOpen: () => void;
  openFrom: (edge?: 'first' | 'last') => void;
  close: () => void;
  select: (value: string) => void;
  setQuery: (query: string) => void;
  setActiveValue: (value: string) => void;
  moveActive: (step: 1 | -1) => void;
  moveToEdge: (edge: 'first' | 'last') => void;
  typeahead: (key: string) => string | null;
  tabOut: (backwards: boolean) => void;
}

const RichSelectContext = createContext<RichSelectContextValue | null>(null);

function useRichSelectContext(component: string): RichSelectContextValue {
  const context = useContext(RichSelectContext);
  if (!context) throw new Error(`${component} must be rendered inside RichSelect.`);
  return context;
}

function textFromNode(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) => {
      if (typeof child === 'string' || typeof child === 'number') return String(child);
      if (!isValidElement(child)) return '';
      return textFromNode((child.props as { children?: ReactNode }).children);
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function collectStructure(children: ReactNode): RichSelectStructure {
  const items: RichSelectItemMetadata[] = [];
  let searchable = false;

  const visit = (node: ReactNode) => {
    Children.forEach(node, (child) => {
      if (!isValidElement(child)) return;
      const props = child.props as {
        children?: ReactNode;
        value?: string;
        textValue?: string;
        disabled?: boolean;
      };
      if (child.type === RichSelectItem && props.value !== undefined) {
        items.push({
          value: props.value,
          textValue: props.textValue ?? textFromNode(props.children),
          disabled: props.disabled ?? false,
        });
      } else {
        if (child.type === RichSelectSearch) searchable = true;
        visit(props.children);
      }
    });
  };

  visit(children);
  return { items, searchable };
}

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();
}

const FOCUSABLE = [
  'a[href]',
  'button:not(:disabled)',
  'input:not(:disabled):not([type="hidden"])',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusAdjacent(trigger: HTMLElement, backwards: boolean): void {
  const controls = Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true',
  );
  const current = controls.indexOf(trigger);
  const next = controls[current + (backwards ? -1 : 1)];
  next?.focus();
}

/**
 * Compound single-select module for rich option content.
 *
 * The root owns value state, item discovery, search, typeahead, keyboard movement,
 * portal anchoring, and dialog ownership. Apps only compose the visible pieces.
 */
export function RichSelect({
  children,
  value: controlledValue,
  defaultValue,
  onValueChange,
  open: controlledOpen,
  defaultOpen,
  onOpenChange,
  disabled = false,
  required = false,
  id: providedId,
  name,
  align = 'left',
  matchTriggerWidth = true,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
}: RichSelectProps) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const listId = `${id}-listbox`;
  const valueId = `${id}-value`;
  const structure = useMemo(() => collectStructure(children), [children]);
  const [uncontrolledValue, setUncontrolledValue] = useState<string | null>(
    defaultValue ?? null,
  );
  const value = controlledValue === undefined ? uncontrolledValue : controlledValue;
  const isControlled = controlledValue !== undefined;
  const {
    open,
    setOpen: setAnchoredOpen,
    triggerRef,
    menuRef,
    pos,
  } = useAnchoredMenu<HTMLButtonElement>({
    open: controlledOpen,
    defaultOpen,
    onOpenChange,
    align,
    matchTriggerWidth,
  });
  const [query, setQueryState] = useState('');
  const [activeCandidate, setActiveCandidate] = useState<string | null>(null);
  const typeaheadBuffer = useRef('');
  const typeaheadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (typeaheadTimer.current) clearTimeout(typeaheadTimer.current);
    },
    [],
  );

  const visibleItems = useMemo(() => {
    const normalized = normalizeSearch(query.trim());
    if (!normalized) return structure.items;
    return structure.items.filter((item) =>
      normalizeSearch(item.textValue).includes(normalized),
    );
  }, [query, structure.items]);
  const enabledVisibleItems = visibleItems.filter((item) => !item.disabled);
  const activeValue = enabledVisibleItems.some((item) => item.value === activeCandidate)
    ? activeCandidate
    : (enabledVisibleItems[0]?.value ?? null);
  const selectedText =
    structure.items.find((item) => item.value === value)?.textValue ?? value ?? null;

  const close = useCallback(() => {
    setAnchoredOpen(false);
    setQueryState('');
  }, [setAnchoredOpen]);

  const openFrom = useCallback(
    (edge?: 'first' | 'last') => {
      if (disabled) return;
      setQueryState('');
      const enabledItems = structure.items.filter((item) => !item.disabled);
      const selectedEnabled = enabledItems.find((item) => item.value === value);
      const candidate =
        edge === 'last'
          ? enabledItems[enabledItems.length - 1]
          : edge === 'first'
            ? enabledItems[0]
            : (selectedEnabled ?? enabledItems[0]);
      setActiveCandidate(candidate?.value ?? null);
      setAnchoredOpen(true);
    },
    [disabled, setAnchoredOpen, structure.items, value],
  );

  const toggleOpen = useCallback(() => {
    if (open) close();
    else openFrom();
  }, [close, open, openFrom]);

  const select = useCallback(
    (nextValue: string) => {
      const item = structure.items.find((candidate) => candidate.value === nextValue);
      if (!item || item.disabled) return;
      if (!isControlled) setUncontrolledValue(nextValue);
      if (nextValue !== value) onValueChange?.(nextValue);
      close();
      queueMicrotask(() => triggerRef.current?.focus());
    },
    [close, isControlled, onValueChange, structure.items, triggerRef, value],
  );

  const setQuery = useCallback(
    (nextQuery: string) => {
      setQueryState(nextQuery);
      const normalized = normalizeSearch(nextQuery.trim());
      const nextItems = structure.items.filter(
        (item) =>
          !item.disabled &&
          (!normalized || normalizeSearch(item.textValue).includes(normalized)),
      );
      setActiveCandidate(nextItems[0]?.value ?? null);
    },
    [structure.items],
  );

  const moveActive = useCallback(
    (step: 1 | -1) => {
      if (enabledVisibleItems.length === 0) return;
      const current = enabledVisibleItems.findIndex((item) => item.value === activeValue);
      const next =
        current === -1
          ? step === 1
            ? 0
            : enabledVisibleItems.length - 1
          : (current + step + enabledVisibleItems.length) % enabledVisibleItems.length;
      setActiveCandidate(enabledVisibleItems[next]?.value ?? null);
    },
    [activeValue, enabledVisibleItems],
  );

  const moveToEdge = useCallback(
    (edge: 'first' | 'last') => {
      const item =
        edge === 'first'
          ? enabledVisibleItems[0]
          : enabledVisibleItems[enabledVisibleItems.length - 1];
      if (item) setActiveCandidate(item.value);
    },
    [enabledVisibleItems],
  );

  const typeahead = useCallback(
    (key: string) => {
      if (key.length !== 1 || key.trim() === '') return null;
      if (typeaheadTimer.current) clearTimeout(typeaheadTimer.current);
      typeaheadBuffer.current += normalizeSearch(key);
      typeaheadTimer.current = setTimeout(() => {
        typeaheadBuffer.current = '';
      }, 700);
      const match = structure.items.find(
        (item) =>
          !item.disabled && normalizeSearch(item.textValue).startsWith(typeaheadBuffer.current),
      );
      if (match) setActiveCandidate(match.value);
      return match?.value ?? null;
    },
    [structure.items],
  );

  const tabOut = useCallback(
    (backwards: boolean) => {
      const trigger = triggerRef.current;
      close();
      if (trigger) queueMicrotask(() => focusAdjacent(trigger, backwards));
    },
    [close, triggerRef],
  );

  const itemId = useCallback(
    (itemValue: string) => `${id}-item-${Math.max(0, structure.items.findIndex((item) => item.value === itemValue))}`,
    [id, structure.items],
  );
  const visibleValues = useMemo(
    () => new Set(visibleItems.map((item) => item.value)),
    [visibleItems],
  );
  const isVisible = useCallback((itemValue: string) => visibleValues.has(itemValue), [visibleValues]);

  const context = useMemo<RichSelectContextValue>(
    () => ({
      value,
      selectedText,
      open,
      disabled,
      required,
      searchable: structure.searchable,
      id,
      valueId,
      listId,
      name,
      ariaLabel,
      ariaLabelledBy,
      ariaDescribedBy,
      ariaInvalid,
      ariaRequired,
      query,
      visibleItems,
      activeValue,
      triggerRef,
      menuRef,
      pos,
      itemId,
      isVisible,
      toggleOpen,
      openFrom,
      close,
      select,
      setQuery,
      setActiveValue: setActiveCandidate,
      moveActive,
      moveToEdge,
      typeahead,
      tabOut,
    }),
    [
      activeValue,
      ariaDescribedBy,
      ariaInvalid,
      ariaLabel,
      ariaLabelledBy,
      ariaRequired,
      close,
      disabled,
      id,
      isVisible,
      itemId,
      listId,
      moveActive,
      moveToEdge,
      name,
      menuRef,
      open,
      openFrom,
      query,
      required,
      select,
      selectedText,
      setQuery,
      structure.searchable,
      tabOut,
      toggleOpen,
      typeahead,
      pos,
      triggerRef,
      value,
      valueId,
      visibleItems,
    ],
  );

  return (
    <RichSelectContext.Provider value={context}>
      {children}
      {name ? <input type="hidden" name={name} value={value ?? ''} disabled={disabled} /> : null}
    </RichSelectContext.Provider>
  );
}

export interface RichSelectTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  selectSize?: RichSelectSize;
  fullWidth?: boolean;
}

export const RichSelectTrigger = forwardRef<HTMLButtonElement, RichSelectTriggerProps>(
  function RichSelectTrigger(
    {
      asChild = false,
      selectSize = 'md',
      fullWidth = false,
      type = 'button',
      disabled: disabledProp,
      className,
      children,
      onClick,
      onKeyDown,
      'aria-label': ariaLabelProp,
      'aria-labelledby': ariaLabelledByProp,
      'aria-describedby': ariaDescribedByProp,
      'aria-invalid': ariaInvalidProp,
      'aria-required': ariaRequiredProp,
      ...props
    },
    forwardedRef,
  ) {
    const context = useRichSelectContext('RichSelectTrigger');
    const disabled = context.disabled || Boolean(disabledProp);
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
      if (!event.defaultPrevented && !disabled) context.toggleOpen();
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
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        context.toggleOpen();
      } else if (!event.metaKey && !event.ctrlKey && !event.altKey) {
        const match = context.typeahead(event.key);
        if (match) {
          event.preventDefault();
          context.select(match);
        }
      }
    };

    const sharedProps = {
      ...props,
      id: props.id ?? context.id,
      type,
      role: 'combobox',
      'aria-expanded': context.open,
      'aria-haspopup': 'listbox' as const,
      'aria-controls': context.open ? context.listId : undefined,
      'aria-autocomplete': context.searchable ? ('list' as const) : ('none' as const),
      'aria-label': ariaLabelProp ?? context.ariaLabel,
      'aria-labelledby':
        ariaLabelProp ?? context.ariaLabel
          ? undefined
          : (ariaLabelledByProp ?? context.ariaLabelledBy ?? context.valueId),
      'aria-describedby': ariaDescribedByProp ?? context.ariaDescribedBy,
      'aria-invalid': ariaInvalidProp ?? context.ariaInvalid,
      'aria-required': ariaRequiredProp ?? context.ariaRequired ?? (context.required || undefined),
      disabled,
      'data-slot': 'rich-select-trigger',
      'data-state': context.open ? 'open' : 'closed',
      'data-placeholder': context.value === null ? '' : undefined,
      className: [
        'pr-rich-select__trigger',
        `pr-rich-select__trigger--${selectSize}`,
        fullWidth ? 'pr-rich-select__trigger--block' : null,
        context.open ? 'pr-rich-select__trigger--open' : null,
        className,
      ]
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
        {children ?? <RichSelectValue />}
        <ChevronDown className="pr-rich-select__chevron" size={16} aria-hidden />
      </button>
    );
  },
);

export interface RichSelectValueProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  placeholder?: ReactNode;
  children?: ReactNode | ((value: string | null) => ReactNode);
}

export const RichSelectValue = forwardRef<HTMLSpanElement, RichSelectValueProps>(
  function RichSelectValue(
    { placeholder = 'Seleccionar…', children, className, id, ...props },
    ref,
  ) {
    const context = useRichSelectContext('RichSelectValue');
    const content =
      typeof children === 'function'
        ? children(context.value)
        : (children ?? context.selectedText ?? placeholder);
    return (
      <span
        {...props}
        ref={ref}
        id={id ?? context.valueId}
        data-slot="rich-select-value"
        data-placeholder={context.value === null ? '' : undefined}
        className={[
          'pr-rich-select__value',
          context.value === null ? 'pr-rich-select__value--placeholder' : null,
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {content}
      </span>
    );
  },
);

export type RichSelectContentProps = HTMLAttributes<HTMLDivElement>;

export const RichSelectContent = forwardRef<HTMLDivElement, RichSelectContentProps>(
  function RichSelectContent(
    { className, children, style, onKeyDown, ...props },
    forwardedRef,
  ) {
    const context = useRichSelectContext('RichSelectContent');
    const listRef = useRef<HTMLDivElement>(null);
    const childArray = Children.toArray(children);
    const searchChildren = childArray.filter(
      (child) => isValidElement(child) && child.type === RichSelectSearch,
    );
    const optionChildren = childArray.filter(
      (child) => !(isValidElement(child) && child.type === RichSelectSearch),
    );

    const assignRef = useCallback(
      (node: HTMLDivElement | null) => {
        context.menuRef.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [context.menuRef, forwardedRef],
    );

    useLayoutEffect(() => {
      if (!context.open) return;
      const target = context.menuRef.current?.querySelector<HTMLElement>(
        '[data-slot="rich-select-search"], [role="listbox"]',
      );
      // The trigger's browser click focus can land after this portal commits. Defer
      // one microtask so the popup focus wins deterministically in real browsers.
      queueMicrotask(() => target?.focus());
    }, [context.menuRef, context.open]);

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) return;
      const typing = event.target instanceof HTMLInputElement;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        context.moveActive(1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        context.moveActive(-1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        context.moveToEdge('first');
      } else if (event.key === 'End') {
        event.preventDefault();
        context.moveToEdge('last');
      } else if (event.key === 'Enter' || (event.key === ' ' && !typing)) {
        if (context.activeValue) {
          event.preventDefault();
          context.select(context.activeValue);
        }
      } else if (event.key === 'Tab') {
        event.preventDefault();
        context.tabOut(event.shiftKey);
      } else if (!typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const match = context.typeahead(event.key);
        if (match) event.preventDefault();
      }
    };

    if (!context.open || typeof document === 'undefined') return null;

    return createPortal(
      <div
        {...props}
        ref={assignRef}
        data-slot="rich-select-content"
        data-state="open"
        className={['pr-rich-select__content', className].filter(Boolean).join(' ')}
        style={{ ...menuStyle(context.pos), ...style }}
        onKeyDown={handleKeyDown}
      >
        {searchChildren}
        <div
          ref={listRef}
          id={context.listId}
          role="listbox"
          tabIndex={searchChildren.length > 0 ? -1 : 0}
          aria-activedescendant={
            context.activeValue ? context.itemId(context.activeValue) : undefined
          }
          className="pr-rich-select__list"
        >
          {optionChildren}
        </div>
      </div>,
      document.body,
    );
  },
);

export interface RichSelectSearchProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'value' | 'onChange'> {
  onQueryChange?: (query: string) => void;
}

export const RichSelectSearch = forwardRef<HTMLInputElement, RichSelectSearchProps>(
  function RichSelectSearch(
    {
      placeholder = 'Buscar…',
      className,
      onQueryChange,
      onKeyDown,
      'aria-label': ariaLabel,
      ...props
    },
    ref,
  ) {
    const context = useRichSelectContext('RichSelectSearch');
    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
      context.setQuery(event.target.value);
      onQueryChange?.(event.target.value);
    };
    return (
      <div className="pr-rich-select__search-shell">
        <Search size={15} aria-hidden />
        <input
          {...props}
          ref={ref}
          type="search"
          role="searchbox"
          value={context.query}
          placeholder={placeholder}
          aria-label={ariaLabel ?? (typeof placeholder === 'string' ? placeholder : 'Buscar')}
          aria-controls={context.listId}
          aria-activedescendant={
            context.activeValue ? context.itemId(context.activeValue) : undefined
          }
          data-slot="rich-select-search"
          className={['pr-rich-select__search', className].filter(Boolean).join(' ')}
          onChange={handleChange}
          onKeyDown={onKeyDown}
        />
      </div>
    );
  },
);

export interface RichSelectItemProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
  textValue?: string;
  disabled?: boolean;
}

export const RichSelectItem = forwardRef<HTMLDivElement, RichSelectItemProps>(
  function RichSelectItem(
    {
      value,
      textValue: _textValue,
      disabled = false,
      className,
      children,
      onClick,
      onMouseMove,
      ...props
    },
    ref,
  ) {
    const context = useRichSelectContext('RichSelectItem');
    const selected = context.value === value;
    const active = context.activeValue === value;
    const hidden = !context.isVisible(value);

    const handleClick = (event: MouseEvent<HTMLDivElement>) => {
      onClick?.(event);
      if (!event.defaultPrevented && !disabled) context.select(value);
    };
    const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
      onMouseMove?.(event);
      if (!event.defaultPrevented && !disabled) context.setActiveValue(value);
    };

    return (
      <div
        {...props}
        ref={ref}
        id={context.itemId(value)}
        role="option"
        aria-selected={selected}
        aria-disabled={disabled || undefined}
        hidden={hidden}
        data-slot="rich-select-item"
        data-state={selected ? 'checked' : 'unchecked'}
        data-highlighted={active ? '' : undefined}
        data-disabled={disabled ? '' : undefined}
        className={['pr-rich-select__item', className].filter(Boolean).join(' ')}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
      >
        <span className="pr-rich-select__item-content">{children}</span>
        <span className="pr-rich-select__indicator" aria-hidden>
          {selected ? <Check size={15} /> : null}
        </span>
      </div>
    );
  },
);

const RichSelectGroupContext = createContext<string | null>(null);

export type RichSelectGroupProps = HTMLAttributes<HTMLDivElement>;

export const RichSelectGroup = forwardRef<HTMLDivElement, RichSelectGroupProps>(
  function RichSelectGroup({ className, children, 'aria-labelledby': labelledBy, ...props }, ref) {
    const generatedId = useId();
    const labelId = `${generatedId}-label`;
    return (
      <RichSelectGroupContext.Provider value={labelId}>
        <div
          {...props}
          ref={ref}
          role="group"
          aria-labelledby={labelledBy ?? labelId}
          data-slot="rich-select-group"
          className={['pr-rich-select__group', className].filter(Boolean).join(' ')}
        >
          {children}
        </div>
      </RichSelectGroupContext.Provider>
    );
  },
);

export type RichSelectLabelProps = HTMLAttributes<HTMLDivElement>;

export const RichSelectLabel = forwardRef<HTMLDivElement, RichSelectLabelProps>(
  function RichSelectLabel({ className, id, ...props }, ref) {
    const groupLabelId = useContext(RichSelectGroupContext);
    return (
      <div
        {...props}
        ref={ref}
        id={id ?? groupLabelId ?? undefined}
        data-slot="rich-select-label"
        className={['pr-rich-select__label', className].filter(Boolean).join(' ')}
      />
    );
  },
);

export type RichSelectSeparatorProps = HTMLAttributes<HTMLDivElement>;

export const RichSelectSeparator = forwardRef<HTMLDivElement, RichSelectSeparatorProps>(
  function RichSelectSeparator({ className, ...props }, ref) {
    return (
      <div
        {...props}
        ref={ref}
        role="separator"
        data-slot="rich-select-separator"
        className={['pr-rich-select__separator', className].filter(Boolean).join(' ')}
      />
    );
  },
);

export type RichSelectEmptyProps = HTMLAttributes<HTMLParagraphElement>;

export const RichSelectEmpty = forwardRef<HTMLParagraphElement, RichSelectEmptyProps>(
  function RichSelectEmpty({ className, ...props }, ref) {
    const context = useRichSelectContext('RichSelectEmpty');
    if (context.visibleItems.length > 0) return null;
    return (
      <p
        {...props}
        ref={ref}
        role="status"
        data-slot="rich-select-empty"
        className={['pr-rich-select__empty', className].filter(Boolean).join(' ')}
      />
    );
  },
);
