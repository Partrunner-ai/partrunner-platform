import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type MutableRefObject,
} from 'react';

export type TabsOrientation = 'horizontal' | 'vertical';
export type TabsActivationMode = 'automatic' | 'manual';
export type TabsListVariant = 'default' | 'line';

export interface TabsProps extends Omit<HTMLAttributes<HTMLDivElement>, 'defaultValue'> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  orientation?: TabsOrientation;
  activationMode?: TabsActivationMode;
  dir?: 'ltr' | 'rtl';
}

interface TabIds {
  triggerId: string;
  panelId: string;
}

interface TabsContextValue {
  value: string | null;
  setValue: (value: string) => void;
  orientation: TabsOrientation;
  activationMode: TabsActivationMode;
  dir: 'ltr' | 'rtl';
  idsFor: (value: string) => TabIds;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(component: string): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) throw new Error(`${component} must be rendered inside Tabs.`);
  return context;
}

/**
 * Compound tabs with one selection and keyboard-navigation owner.
 *
 * Apps compose labels and panels; the root owns controlled/uncontrolled state,
 * ARIA relationships, roving focus, activation mode, and orientation.
 */
export const Tabs = forwardRef<HTMLDivElement, TabsProps>(function Tabs(
  {
    value: controlledValue,
    defaultValue,
    onValueChange,
    orientation = 'horizontal',
    activationMode = 'automatic',
    dir = 'ltr',
    className,
    children,
    ...props
  },
  ref,
) {
  const [uncontrolledValue, setUncontrolledValue] = useState<string | null>(
    defaultValue ?? null,
  );
  const value = controlledValue === undefined ? uncontrolledValue : controlledValue;
  const isControlled = controlledValue !== undefined;
  const baseId = useId();
  const idsByValue = useRef(new Map<string, TabIds>());

  const idsFor = useCallback(
    (tabValue: string) => {
      const existing = idsByValue.current.get(tabValue);
      if (existing) return existing;
      const index = idsByValue.current.size;
      const ids = {
        triggerId: `${baseId}-tab-${index}`,
        panelId: `${baseId}-panel-${index}`,
      };
      idsByValue.current.set(tabValue, ids);
      return ids;
    },
    [baseId],
  );

  const setValue = useCallback(
    (nextValue: string) => {
      if (nextValue === value) return;
      if (!isControlled) setUncontrolledValue(nextValue);
      onValueChange?.(nextValue);
    },
    [isControlled, onValueChange, value],
  );

  const context = useMemo(
    () => ({ value, setValue, orientation, activationMode, dir, idsFor }),
    [activationMode, dir, idsFor, orientation, setValue, value],
  );

  return (
    <TabsContext.Provider value={context}>
      <div
        {...props}
        ref={ref}
        data-slot="tabs"
        data-orientation={orientation}
        dir={dir}
        className={['pr-tabs', `pr-tabs--${orientation}`, className]
          .filter(Boolean)
          .join(' ')}
      >
        {children}
      </div>
    </TabsContext.Provider>
  );
});

export interface TabsListProps extends HTMLAttributes<HTMLDivElement> {
  variant?: TabsListVariant;
}

export const TabsList = forwardRef<HTMLDivElement, TabsListProps>(function TabsList(
  { variant = 'default', className, ...props },
  ref,
) {
  const { orientation } = useTabsContext('TabsList');
  return (
    <div
      {...props}
      ref={ref}
      role="tablist"
      aria-orientation={orientation}
      data-slot="tabs-list"
      data-variant={variant}
      className={['pr-tabs__list', `pr-tabs__list--${variant}`, className]
        .filter(Boolean)
        .join(' ')}
    />
  );
});

export interface TabsTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(function TabsTrigger(
  {
    value,
    disabled = false,
    type = 'button',
    className,
    onClick,
    onKeyDown,
    children,
    ...props
  },
  forwardedRef,
) {
  const context = useTabsContext('TabsTrigger');
  const localRef = useRef<HTMLButtonElement | null>(null);
  const active = context.value === value;
  const ids = context.idsFor(value);

  const assignRef = useCallback(
    (node: HTMLButtonElement | null) => {
      localRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) {
        (forwardedRef as MutableRefObject<HTMLButtonElement | null>).current = node;
      }
    },
    [forwardedRef],
  );

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (!event.defaultPrevented && !disabled) context.setValue(value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;

    const list = event.currentTarget.closest<HTMLElement>('[role="tablist"]');
    if (!list) return;
    const tabs = Array.from(
      list.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'),
    ).filter((tab) => tab.getAttribute('aria-disabled') !== 'true' && !tab.hidden);
    const currentIndex = tabs.indexOf(event.currentTarget);
    if (currentIndex === -1 || tabs.length === 0) return;

    let nextIndex: number | null = null;
    if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else if (context.orientation === 'horizontal') {
      const forwardKey = context.dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
      const backwardKey = context.dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
      if (event.key === forwardKey) nextIndex = (currentIndex + 1) % tabs.length;
      if (event.key === backwardKey) nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else {
      if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % tabs.length;
      if (event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = tabs[nextIndex];
    nextTab?.focus();
    const nextValue = nextTab?.dataset.value;
    if (nextValue && context.activationMode === 'automatic') context.setValue(nextValue);
  };

  return (
    <button
      {...props}
      ref={assignRef}
      id={ids.triggerId}
      type={type}
      role="tab"
      aria-selected={active}
      aria-controls={ids.panelId}
      disabled={disabled}
      tabIndex={active || context.value === null ? 0 : -1}
      data-slot="tabs-trigger"
      data-value={value}
      data-state={active ? 'active' : 'inactive'}
      data-active={active ? '' : undefined}
      className={['pr-tabs__trigger', className].filter(Boolean).join(' ')}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {children}
    </button>
  );
});

export interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
  /** Keep an inactive panel mounted while retaining native hidden semantics. */
  forceMount?: boolean;
}

export const TabsContent = forwardRef<HTMLDivElement, TabsContentProps>(function TabsContent(
  { value, forceMount = false, className, children, ...props },
  ref,
) {
  const context = useTabsContext('TabsContent');
  const active = context.value === value;
  const ids = context.idsFor(value);
  if (!active && !forceMount) return null;

  return (
    <div
      {...props}
      ref={ref}
      id={ids.panelId}
      role="tabpanel"
      aria-labelledby={ids.triggerId}
      tabIndex={active ? 0 : -1}
      hidden={!active}
      data-slot="tabs-content"
      data-state={active ? 'active' : 'inactive'}
      className={['pr-tabs__content', className].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
});
