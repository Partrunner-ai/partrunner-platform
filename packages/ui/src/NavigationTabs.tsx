import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ComponentType,
  type HTMLAttributeAnchorTarget,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

interface NavigationTabItemBase {
  href: string;
  label: ReactNode;
  /** Optional compact count or status shown after the label. */
  badge?: ReactNode;
  /** Show the package-owned badge placeholder while its value loads. */
  badgeLoading?: boolean;
  /** Optional accessible replacement for the visible badge value. */
  badgeAriaLabel?: string;
  /** Explicit native browsing context, including internal links opened in a new tab. */
  target?: HTMLAttributeAnchorTarget;
  rel?: string;
}

export type NavigationTabItem = NavigationTabItemBase &
  (
    | {
        external: true;
        /** External destinations are native anchors and never own the current route. */
        exact?: never;
      }
    | {
        external?: false;
        /** Match only this route instead of its descendant routes. */
        exact?: boolean;
      }
  );

export interface NavigationTabsLinkProps {
  href: string;
  className?: string;
  children: ReactNode;
  target?: HTMLAttributeAnchorTarget;
  rel?: string;
  'aria-current'?: 'page';
  'data-active'?: string;
  'data-slot'?: string;
  'data-state'?: 'active' | 'inactive';
}

export type NavigationTabsLinkComponent = ComponentType<NavigationTabsLinkProps>;

export interface NavigationTabsProps
  extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** Current route path from the host router. Query and hash values are ignored. */
  currentPath: string;
  items: readonly NavigationTabItem[];
  /** Router-aware link. Defaults to a native anchor. */
  LinkComponent?: NavigationTabsLinkComponent;
}

const DefaultLink: NavigationTabsLinkComponent = ({ href, children, ...props }) => (
  <a href={href} {...props}>
    {children}
  </a>
);

const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
// Keep one device-rounded pixel beyond the four-pixel ring when scrolling.
const FOCUS_CLEARANCE = 5;

function alignNavigationItem(list: HTMLUListElement, item: HTMLLIElement) {
  if (list.clientWidth === 0) return;

  const listBox = list.getBoundingClientRect();
  const itemBox = item.getBoundingClientRect();
  const visibleLeft = listBox.left + FOCUS_CLEARANCE;
  const visibleRight = listBox.right - FOCUS_CLEARANCE;
  let nextLeft: number | null = null;

  if (itemBox.left < visibleLeft) {
    nextLeft = list.scrollLeft - (visibleLeft - itemBox.left);
  } else if (itemBox.right > visibleRight) {
    nextLeft = list.scrollLeft + (itemBox.right - visibleRight);
  }
  if (nextLeft === null) return;

  const safeLeft = Math.max(0, nextLeft);
  if (typeof list.scrollTo === 'function') {
    list.scrollTo({ left: safeLeft, behavior: 'auto' });
  } else {
    list.scrollLeft = safeLeft;
  }
}

function normalizeRoutePath(value: string): string | null {
  const path = value.split('?')[0]!.split('#')[0]!;
  if (!path.startsWith('/')) return null;
  if (path === '/') return path;
  return path.replace(/\/+$/, '');
}

function itemMatches(currentPath: string, item: NavigationTabItem): boolean {
  if (item.external) return false;
  const current = normalizeRoutePath(currentPath);
  const target = normalizeRoutePath(item.href);
  if (!current || !target) return false;
  if (item.exact || target === '/') return current === target;
  return current === target || current.startsWith(`${target}/`);
}

/** Resolve one current route owner. The most specific matching href wins. */
export function resolveActiveNavigationHref(
  currentPath: string,
  items: readonly NavigationTabItem[],
): string | null {
  let activeHref: string | null = null;
  let activeLength = -1;

  for (const item of items) {
    if (!itemMatches(currentPath, item)) continue;
    const length = normalizeRoutePath(item.href)?.length ?? 0;
    if (length > activeLength) {
      activeHref = item.href;
      activeLength = length;
    }
  }

  return activeHref;
}

/**
 * Horizontal route navigation with native link semantics.
 *
 * Use this for routes, not in-panel tabs. The app owns routing and supplies its
 * current path; the component owns active-route resolution, overflow, badges,
 * focus styling, and keeping the current item visible on narrow screens.
 */
export const NavigationTabs = forwardRef<HTMLElement, NavigationTabsProps>(
  function NavigationTabs(
    { currentPath, items, LinkComponent = DefaultLink, className, ...props },
    ref,
  ) {
    const listRef = useRef<HTMLUListElement | null>(null);
    const activeItemRef = useRef<HTMLLIElement | null>(null);
    const activeHref = useMemo(
      () => resolveActiveNavigationHref(currentPath, items),
      [currentPath, items],
    );

    useBrowserLayoutEffect(() => {
      const list = listRef.current;
      const activeItem = activeItemRef.current;
      if (!list || !activeItem) return;

      const alignCurrentItem = () => {
        const focusedElement = list.ownerDocument.activeElement;
        const focusedItem =
          focusedElement && list.contains(focusedElement)
            ? focusedElement.closest<HTMLLIElement>('.pr-navigation-tabs__item')
            : null;
        alignNavigationItem(list, focusedItem ?? activeItem);
      };

      alignCurrentItem();
      if (typeof ResizeObserver === 'undefined') {
        window.addEventListener('resize', alignCurrentItem);
        return () => window.removeEventListener('resize', alignCurrentItem);
      }

      const observer = new ResizeObserver(alignCurrentItem);
      observer.observe(list);
      for (const item of list.children) observer.observe(item);
      return () => observer.disconnect();
    }, [activeHref, items]);

    return (
      <nav
        {...props}
        ref={ref}
        data-slot="navigation-tabs"
        className={['pr-navigation-tabs', className].filter(Boolean).join(' ')}
      >
        <ul ref={listRef} className="pr-navigation-tabs__list">
          {items.map((item) => {
            const active = item.href === activeHref;
            const showBadge = item.badgeLoading || item.badge != null;
            const target = item.external ? (item.target ?? '_blank') : item.target;
            const rel = item.rel ?? (target === '_blank' ? 'noopener noreferrer' : undefined);
            const content = (
              <>
                <span className="pr-navigation-tabs__label">{item.label}</span>
                {showBadge ? (
                  <span
                    className="pr-navigation-tabs__badge"
                    data-slot="navigation-tab-badge"
                    data-loading={item.badgeLoading ? '' : undefined}
                    aria-hidden={item.badgeLoading ? true : undefined}
                    aria-label={
                      !item.badgeLoading && item.badgeAriaLabel
                        ? item.badgeAriaLabel
                        : undefined
                    }
                  >
                    {item.badgeLoading ? null : item.badge}
                  </span>
                ) : null}
              </>
            );
            return (
              <li
                key={item.href}
                ref={active ? activeItemRef : undefined}
                className="pr-navigation-tabs__item"
                data-active={active ? '' : undefined}
                onFocus={(event) => {
                  const list = listRef.current;
                  if (list) alignNavigationItem(list, event.currentTarget);
                }}
              >
                {item.external ? (
                  <a
                    href={item.href}
                    target={target}
                    rel={rel}
                    data-slot="navigation-tab"
                    data-state="inactive"
                    className="pr-navigation-tabs__link"
                  >
                    {content}
                  </a>
                ) : (
                  <LinkComponent
                    href={item.href}
                    target={target}
                    rel={rel}
                    aria-current={active ? 'page' : undefined}
                    data-active={active ? '' : undefined}
                    data-slot="navigation-tab"
                    data-state={active ? 'active' : 'inactive'}
                    className="pr-navigation-tabs__link"
                  >
                    {content}
                  </LinkComponent>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    );
  },
);
