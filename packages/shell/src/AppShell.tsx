import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ComponentType,
  type ReactNode,
} from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Home,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react';
import { buildAppUrl, type AppTone } from '@partrunner-ai/app-registry';
import { BrandMark } from './BrandMark';
import {
  appShellGroupsKey,
  decodeAppShellGroups,
  encodeAppShellGroups,
  parseAppShellState,
  type AppShellInitialState,
} from './sidebarPreferences';

export type { AppShellInitialState } from './sidebarPreferences';

/**
 * The standardized PartRunner sidebar. Most apps use the normal flat/accordion
 * model; Nexus can opt into the drill model, where the landing lists product
 * areas and selecting one replaces the landing with that area's leaves.
 *
 * The canonical model supports flat items, one accordion level, and an
 * optional drill landing. Deeper navigation belongs in the page as tabs or
 * sibling destinations.
 */

/** Icons travel either as a component or as a lucide name (manifests are JSON). */
export type NavIcon = LucideIcon | string;

export interface NavItem {
  /**
   * Stable key for the open/closed state of a group. Defaults to `href`, then to
   * the label — pass it explicitly when labels are translated, or switching
   * language resets which groups are open.
   */
  id?: string;
  /** Destination. Optional only for a group (an item with `children`). */
  href?: string;
  label: string;
  icon?: NavIcon;
  /** Count/label badge (e.g. unread). Numeric badges roll up to a closed group. */
  badge?: number | string;
  /** Hidden unless `can(permission)` returns true. */
  permission?: string;
  /** Absolute URL — rendered as a plain anchor, since routers can't handle it. */
  external?: boolean;
  /** Stable release-tour hook emitted as `data-tour="nav-{tourId}"`. */
  tourId?: string;
  /**
   * Sub-items, ONE level deep. An item with children is a toggle, not a link:
   * its own `href` is ignored. Children of children are not rendered.
   */
  children?: NavItem[];
}

export interface NavSection {
  id: string;
  /** Heading in normal mode; product-area name in drill mode. */
  label?: string;
  /** Drill landing metadata. Ignored by the normal sidebar. */
  icon?: NavIcon;
  description?: string;
  tone?: AppTone;
  /** Hidden unless `can(permission)` returns true. */
  permission?: string;
  items: NavItem[];
}

/**
 * Link renderer. Defaults to a plain `<a>`. Apps inject their router:
 *   Next:  ({ href, ...p }) => <Link href={href} {...p} />
 *   Vite:  ({ href, ...p }) => <RouterLink to={href} {...p} />
 */
export type LinkComponent = ComponentType<{
  href: string;
  className?: string;
  title?: string;
  children: ReactNode;
  onClick?: () => void;
  'data-active'?: string;
  'data-tour'?: string;
  'aria-current'?: 'page';
}>;

const DefaultLink: LinkComponent = ({ href, children, ...rest }) => (
  <a href={href} {...rest}>
    {children}
  </a>
);

export interface AppShellProps {
  sections: NavSection[];
  /** Standard navigation, or a section-first drill navigation. */
  variant?: 'standard' | 'drill';
  /** Direct links rendered on the drill landing, above the product areas. */
  drillHomeItems?: NavItem[];
  drillBackLabel?: string;
  /**
   * Optional section override for app-owned navigation such as a lazy workspace
   * tree. Return `undefined` to use the section's normal items.
   */
  renderDrillSection?: (
    section: NavSection,
    closeSidebar: () => void,
  ) => ReactNode | undefined;
  /** Current route path, from the host app's router. */
  currentPath: string;
  brandName?: string;
  /** Small uppercase label under the brand (e.g. "Supply Ops"). */
  subtitle?: string;
  /**
   * Brand mark. Defaults to the inlined `<BrandMark />` isotype. Override it
   * only for a surface that is not PartRunner-branded.
   */
  logo?: ReactNode;
  /**
   * Where the brand block goes. Defaults to `nexusHref`, then to Nexus home.
   * Pass `null` to render the brand as static text.
   */
  brandHref?: string | null;
  /**
   * Runs instead of following `brandHref`, for the seamless exit transition.
   * Defaults to `onNexusSelect`.
   */
  onBrandSelect?: () => void;
  /** Router-aware link component. */
  LinkComponent?: LinkComponent;
  /** Resolves string icon names (from a nav manifest) to lucide components. */
  icons?: Record<string, LucideIcon>;
  /** Permission gate. Items with a `permission` are dropped when it returns false. */
  can?: (permission: string) => boolean;
  /**
   * Canonical "Nexus" item, pinned above every section. Pass `onNexusSelect` to
   * route it through the seamless exit transition:
   *   onNexusSelect={() => navigateTo(nexusUrl, 'Nexus')}
   */
  nexusHref?: string;
  onNexusSelect?: () => void;
  /** Routes cross-app leaves through the host's seamless transition. */
  onExternalSelect?: (item: NavItem) => void;
  /** Primary call to action under the brand (e.g. "Nueva solicitud"). */
  primaryAction?: ReactNode;
  /** Content pinned to the bottom of the sidebar, above the collapse control. */
  footer?: ReactNode;
  /** Topbar right-side actions (AppLauncher, ThemeToggle, UserMenu, …). */
  topbarEnd?: ReactNode;
  /** Topbar left-side content (search, breadcrumbs, …). */
  topbarStart?: ReactNode;
  /**
   * Complete shared header. When provided, replaces the legacy topbar slots.
   * Prefer `<GlobalHeader />` for new staff surfaces.
   */
  globalHeader?: ReactNode;
  collapsible?: boolean;
  /**
   * Copy for the collapse control. Defaults to Spanish; multilingual hosts
   * should pass their own translations.
   */
  labels?: {
    collapse?: string;
    expand?: string;
    /** Accessible name; falls back to `collapse`/`expand`. */
    collapseMenu?: string;
    expandMenu?: string;
  };
  collapseStorageKey?: string;
  /**
   * Where the collapsed preference lives. A cookie may be shared across a
   * configured parent domain; `localStorage` remains per origin.
   */
  collapseStorage?: 'local' | 'cookie';
  cookieDomain?: string;
  /**
   * Server-derived cookie state for the first render. Parse the request cookie
   * with `parseAppShellState` from `@partrunner-ai/shell/preferences`; passing
   * only this minimal state avoids serializing the raw cookie header and keeps
   * the rail stable before hydration.
   */
  initialState?: AppShellInitialState;
  children: ReactNode;
}

/** The route part of an href, without query or hash. */
function navPath(href: string | undefined): string | null {
  if (!href) return null;
  return href.split('?')[0]!.split('#')[0]!;
}

/**
 * Does `href` cover `currentPath`?
 *
 * `/rutas` must not match `/rutas-archivadas`, so the boundary is explicit. Note that
 * this is deliberately true for ancestors — `/dashboard` covers
 * `/dashboard/statistics` — which is what keeps a section highlighted on its own detail
 * pages. Because of that, more than one item can match at once, so callers deciding
 * what to *highlight* want `resolveActiveHref` instead.
 */
export function isNavItemActive(currentPath: string, href: string | undefined): boolean {
  if (!href) return false;
  const path = navPath(href)!;
  if (path === '/') return currentPath === '/';
  return currentPath === path || currentPath.startsWith(`${path}/`);
}

/**
 * The single href that owns `currentPath`: the most specific one that covers it.
 *
 * Highlighting cannot be decided one item at a time. `isNavItemActive` is true for
 * every ancestor, so a section index like `/dashboard` matches on
 * `/dashboard/statistics/colocadas` just as the leaf does, and the sidebar lights up
 * two entries at once — which reads as a broken menu, since a user is only ever on one
 * page.
 *
 * Longest match wins, so an index item highlights only on its own page while a leaf
 * keeps its highlight across its detail routes. Returns the normalized path so callers
 * can compare directly against `navPath(item.href)`.
 */
export function resolveActiveHref(
  currentPath: string,
  hrefs: Iterable<string | undefined>,
): string | undefined {
  let best: string | undefined;
  for (const href of hrefs) {
    if (!isNavItemActive(currentPath, href)) continue;
    const path = navPath(href)!;
    if (best === undefined || path.length > best.length) best = path;
  }
  return best;
}

function itemKey(item: NavItem, sectionId: string): string {
  return item.id ?? item.href ?? `${sectionId}:${item.label}`;
}

/** Numeric badges of hidden children surface on the group that hides them. */
function rollUpBadge(item: NavItem): number | string | undefined {
  if (item.badge !== undefined) return item.badge;
  const total = (item.children ?? []).reduce(
    (sum, child) => sum + (typeof child.badge === 'number' ? child.badge : 0),
    0,
  );
  return total > 0 ? total : undefined;
}

function toneStyle(tone: AppTone = 'blue'): CSSProperties {
  return {
    ['--pr-tile-bg' as string]: `var(--pr-tone-${tone}-bg)`,
    ['--pr-tile-fg' as string]: `var(--pr-tone-${tone}-fg)`,
  };
}

interface SidebarContextValue {
  collapsed: boolean;
  toggleCollapsed: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

/**
 * Sidebar state, for chrome rendered outside the sidebar itself — the mobile
 * trigger in the header, most of all. Returns null outside an `<AppShell>` so a
 * header component can be reused on a page that has no shell.
 */
export function useSidebar(): SidebarContextValue | null {
  return useContext(SidebarContext);
}

/**
 * Hamburger that opens the sidebar as a drawer. Put it in the header's start
 * slot: `<GlobalHeader start={<SidebarTrigger />} />`. Hidden on wide screens by
 * CSS, and renders nothing outside an `<AppShell>`.
 */
export function SidebarTrigger({ label = 'Abrir menú' }: { label?: string }) {
  const sidebar = useSidebar();
  if (!sidebar) return null;
  return (
    <button
      type="button"
      className="pr-sidebar__trigger"
      onClick={() => sidebar.setMobileOpen(true)}
      aria-label={label}
      aria-expanded={sidebar.mobileOpen}
    >
      <Menu size={20} aria-hidden />
    </button>
  );
}

function readCollapsed(
  storage: 'local' | 'cookie',
  key: string,
): boolean {
  try {
    if (storage === 'cookie') return parseAppShellState(document.cookie, key).collapsed;
    return window.localStorage.getItem(key) === '1';
  } catch {
    // Private-mode Safari throws on storage access; a sidebar must still render.
    return false;
  }
}

function readGroups(storage: 'local' | 'cookie', key: string): Record<string, boolean> {
  try {
    if (storage === 'cookie') return parseAppShellState(document.cookie, key).groups;
    return decodeAppShellGroups(window.localStorage.getItem(appShellGroupsKey(key)));
  } catch {
    return {};
  }
}

function writeCookie(key: string, value: string, cookieDomain?: string): void {
  const domain = cookieDomain ? `; domain=${cookieDomain}` : '';
  document.cookie = `${key}=${value}; path=/; max-age=31536000; samesite=lax${domain}`;
}

function writeCollapsed(
  storage: 'local' | 'cookie',
  key: string,
  value: boolean,
  cookieDomain?: string,
): void {
  try {
    if (storage === 'cookie') {
      writeCookie(key, value ? '1' : '0', cookieDomain);
      return;
    }
    window.localStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* preference is a nicety, never a failure */
  }
}

function writeGroups(
  storage: 'local' | 'cookie',
  key: string,
  groups: Record<string, boolean>,
  cookieDomain?: string,
): void {
  try {
    const encoded = encodeAppShellGroups(groups);
    const groupsKey = appShellGroupsKey(key);
    if (storage === 'cookie') {
      writeCookie(groupsKey, encoded, cookieDomain);
      return;
    }
    window.localStorage.setItem(groupsKey, encoded);
  } catch {
    /* preference is a nicety, never a failure */
  }
}

/** Standardized sidebar + topbar chrome. Page content goes in `children`. */
export function AppShell({
  sections,
  variant = 'standard',
  drillHomeItems = [],
  drillBackLabel = 'Inicio',
  renderDrillSection,
  currentPath,
  brandName = 'Partrunner',
  subtitle,
  logo = <BrandMark />,
  brandHref,
  onBrandSelect,
  LinkComponent = DefaultLink,
  icons,
  can,
  nexusHref,
  onNexusSelect,
  onExternalSelect,
  primaryAction,
  footer,
  topbarEnd,
  topbarStart,
  globalHeader,
  collapsible = true,
  labels,
  collapseStorageKey = 'pr-sidebar-collapsed',
  collapseStorage = 'local',
  cookieDomain,
  initialState,
  children,
}: AppShellProps) {
  const hasInitialState = initialState !== undefined;
  const [collapsed, setCollapsed] = useState(initialState?.collapsed ?? false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [drillId, setDrillId] = useState<string | null>(null);
  const [showDrillLanding, setShowDrillLanding] = useState(false);
  /** Explicit user toggles only. Absent key = fall back to "is it active?". */
  const [toggled, setToggled] = useState<Record<string, boolean>>(initialState?.groups ?? {});

  useEffect(() => {
    if (hasInitialState) return;
    setCollapsed(readCollapsed(collapseStorage, collapseStorageKey));
    setToggled(readGroups(collapseStorage, collapseStorageKey));
  }, [collapseStorage, collapseStorageKey, hasInitialState]);

  useEffect(() => {
    setDrillId(null);
    setShowDrillLanding(false);
  }, [currentPath]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      writeCollapsed(collapseStorage, collapseStorageKey, next, cookieDomain);
      return next;
    });
  }, [collapseStorage, collapseStorageKey, cookieDomain]);

  const toggleGroup = useCallback(
    (key: string, open: boolean) => {
      setToggled((prev) => {
        const next = { ...prev, [key]: open };
        writeGroups(collapseStorage, collapseStorageKey, next, cookieDomain);
        return next;
      });
    },
    [collapseStorage, collapseStorageKey, cookieDomain],
  );

  const allowed = useCallback(
    (item: NavItem): boolean => !item.permission || !can || can(item.permission),
    [can],
  );

  const allowedSection = useCallback(
    (section: NavSection): boolean =>
      !section.permission || !can || can(section.permission),
    [can],
  );

  /**
   * Permission filtering happens once for items, children, and sections. A
   * group or section disappears when no visible destination remains.
   */
  const visibleSections = useMemo(
    () =>
      sections
        .map((section) => ({
          ...section,
          items: section.items
            .filter(allowed)
            .map((item) =>
              item.children
                ? { ...item, children: item.children.filter(allowed) }
                : item,
            )
            .filter((item) => !item.children || item.children.length > 0),
        }))
        .filter((section) => allowedSection(section) && section.items.length > 0),
    [sections, allowed, allowedSection],
  );

  const visibleDrillHomeItems = useMemo(
    () => drillHomeItems.filter(allowed),
    [drillHomeItems, allowed],
  );

  /**
   * Resolved once across every visible destination, because "is this item active?"
   * has no answer in isolation — only the most specific match should light up.
   */
  const activeHref = useMemo(() => {
    const hrefs: Array<string | undefined> = [];
    for (const section of visibleSections) {
      for (const item of section.items) {
        if (!item.external) hrefs.push(item.href);
        for (const child of item.children ?? []) {
          if (!child.external) hrefs.push(child.href);
        }
      }
    }
    for (const item of visibleDrillHomeItems) {
      if (!item.external) hrefs.push(item.href);
    }
    return resolveActiveHref(currentPath, hrefs);
  }, [currentPath, visibleSections, visibleDrillHomeItems]);

  const isActive = useCallback(
    (href: string | undefined) => activeHref !== undefined && navPath(href) === activeHref,
    [activeHref],
  );

  const activeDrillSectionId = useMemo(
    () =>
      visibleSections.find((section) =>
        section.items.some((item) =>
          item.children
            ? item.children.some((child) => isActive(child.href))
            : !item.external && isActive(item.href),
        ),
      )?.id ?? null,
    [isActive, visibleSections],
  );

  const currentDrillSection = showDrillLanding
    ? null
    : visibleSections.find((section) => section.id === (drillId ?? activeDrillSectionId)) ??
      null;

  const resolveIcon = (icon: NavIcon | undefined): LucideIcon | undefined => {
    if (!icon) return undefined;
    if (typeof icon === 'string') return icons?.[icon];
    return icon;
  };

  const closeDrawer = () => setMobileOpen(false);

  const collapseLabel = labels?.collapse ?? 'Colapsar';
  const expandLabel = labels?.expand ?? 'Expandir';
  const collapseMenuLabel = labels?.collapseMenu ?? `${collapseLabel} menú`;
  const expandMenuLabel = labels?.expandMenu ?? `${expandLabel} menú`;

  /**
   * `undefined` means "not specified, use the default"; explicit `null` means
   * "no link". Resolved lazily rather than in a default parameter because
   * `configureAppRegistry` can change the base domain after module load.
   */
  const resolvedBrandHref = useMemo(() => {
    if (brandHref !== undefined) return brandHref;
    if (nexusHref) return nexusHref;
    return buildAppUrl({ scheme: 'subdomain', sub: 'nexus' });
  }, [brandHref, nexusHref]);
  const brandSelect = onBrandSelect ?? (brandHref === undefined ? onNexusSelect : undefined);

  function renderLeaf(item: NavItem, sectionId: string) {
    const Icon = resolveIcon(item.icon);
    const active = isActive(item.href);
    const badge = item.badge;
    // `size` sets the SSR default; --pr-nav-icon-size wins in CSS.
    const body = (
      <>
        {Icon ? <Icon size={17} aria-hidden /> : null}
        <span className="pr-nav__item-label">{item.label}</span>
        {badge !== undefined && (
          <span className="pr-nav__badge">{badge}</span>
        )}
      </>
    );

    // An absolute URL is not a route: handing it to next/link or react-router
    // either breaks or produces a client-side navigation to nowhere.
    if (item.external) {
      return (
        <a
          key={itemKey(item, sectionId)}
          href={item.href}
          className="pr-nav__item"
          title={item.label}
          data-tour={item.tourId ? `nav-${item.tourId}` : undefined}
          target={onExternalSelect ? undefined : '_blank'}
          rel={onExternalSelect ? undefined : 'noreferrer noopener'}
          onClick={
            onExternalSelect
              ? (event) => {
                  event.preventDefault();
                  closeDrawer();
                  onExternalSelect(item);
                }
              : closeDrawer
          }
        >
          {body}
        </a>
      );
    }

    return (
      <LinkComponent
        key={itemKey(item, sectionId)}
        href={item.href ?? '#'}
        className="pr-nav__item"
        title={item.label}
        data-active={active ? 'true' : undefined}
        data-tour={item.tourId ? `nav-${item.tourId}` : undefined}
        aria-current={active ? 'page' : undefined}
        onClick={closeDrawer}
      >
        {body}
      </LinkComponent>
    );
  }

  function renderGroup(item: NavItem, sectionId: string) {
    const key = itemKey(item, sectionId);
    const children = item.children ?? [];
    const hasActiveChild = children.some((child) => isActive(child.href));
    // The group holding the current page is open unless the user closed it.
    const open = toggled[key] ?? hasActiveChild;
    const Icon = resolveIcon(item.icon);
    const badge = open ? item.badge : rollUpBadge(item);
    const panelId = `pr-nav-group-${key.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

    return (
      <div key={key} className="pr-nav__group">
        <button
          type="button"
          className="pr-nav__item pr-nav__toggle"
          onClick={() => toggleGroup(key, !open)}
          aria-expanded={open}
          aria-controls={panelId}
          data-active={hasActiveChild ? 'true' : undefined}
          title={item.label}
        >
          {Icon ? <Icon size={17} aria-hidden /> : null}
          <span className="pr-nav__item-label">{item.label}</span>
          {badge !== undefined && <span className="pr-nav__badge">{badge}</span>}
          <ChevronRight className="pr-nav__chevron" size={13} aria-hidden />
        </button>
        <div id={panelId} className="pr-nav__children" hidden={!open}>
          {children.map((child) => renderLeaf(child, sectionId))}
        </div>
      </div>
    );
  }

  const sidebarState: SidebarContextValue = {
    collapsed,
    toggleCollapsed,
    mobileOpen,
    setMobileOpen,
  };

  function renderStandardNavigation() {
    return visibleSections.map((section) => (
      <div key={section.id} className="pr-nav__section">
        {section.label && <div className="pr-nav__label">{section.label}</div>}
        {section.description && (
          <p className="pr-nav__section-description">{section.description}</p>
        )}
        {section.items.map((item) => {
          // Collapsed to a rail, a closed group would hide its children behind a
          // chevron nobody can see — so the rail shows leaves.
          if (item.children && collapsed) {
            return item.children.map((child) => renderLeaf(child, section.id));
          }
          return item.children ? renderGroup(item, section.id) : renderLeaf(item, section.id);
        })}
      </div>
    ));
  }

  function renderDrillNavigation() {
    if (currentDrillSection) {
      const SectionIcon = resolveIcon(currentDrillSection.icon);
      const customContent = renderDrillSection?.(currentDrillSection, closeDrawer);
      return (
        <div className="pr-drill__detail" data-section={currentDrillSection.id}>
          <button
            type="button"
            className="pr-drill__back"
            onClick={() => {
              setDrillId(null);
              setShowDrillLanding(true);
            }}
          >
            <ArrowLeft size={14} aria-hidden />
            <span>{drillBackLabel}</span>
          </button>

          <div className="pr-drill__header">
            {SectionIcon ? (
              <span className="pr-drill__tile-icon" style={toneStyle(currentDrillSection.tone)}>
                <SectionIcon size={26} aria-hidden />
              </span>
            ) : null}
            <div className="pr-drill__header-copy">
              <div className="pr-drill__title">
                {currentDrillSection.label ?? currentDrillSection.id}
              </div>
              {currentDrillSection.description ? (
                <div className="pr-drill__description">{currentDrillSection.description}</div>
              ) : null}
            </div>
          </div>

          <div className="pr-nav__section">
            {customContent !== undefined
              ? customContent
              : currentDrillSection.items.map((item) =>
                  item.children
                    ? renderGroup(item, currentDrillSection.id)
                    : renderLeaf(item, currentDrillSection.id),
                )}
          </div>
        </div>
      );
    }

    return (
      <div className="pr-drill__landing">
        {visibleDrillHomeItems.length > 0 ? (
          <div className="pr-nav__section">
            {visibleDrillHomeItems.map((item) => renderLeaf(item, 'drill-home'))}
          </div>
        ) : null}
        {visibleDrillHomeItems.length > 0 && visibleSections.length > 0 ? (
          <div className="pr-drill__divider" aria-hidden />
        ) : null}
        <div className="pr-drill__sections">
          {visibleSections.map((section) => {
            const SectionIcon = resolveIcon(section.icon);
            return (
              <button
                key={section.id}
                type="button"
                className="pr-drill__section"
                data-tour={`section-${section.id}`}
                onClick={() => {
                  setDrillId(section.id);
                  setShowDrillLanding(false);
                }}
              >
                {SectionIcon ? (
                  <span className="pr-drill__tile-icon" style={toneStyle(section.tone)}>
                    <SectionIcon size={24} aria-hidden />
                  </span>
                ) : null}
                <span className="pr-drill__section-copy">
                  <span className="pr-drill__section-label">{section.label ?? section.id}</span>
                  <span className="pr-drill__section-meta">
                    {section.items.length} {section.items.length === 1 ? 'módulo' : 'módulos'}
                  </span>
                </span>
                <ChevronRight className="pr-drill__section-chevron" size={15} aria-hidden />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <SidebarContext.Provider value={sidebarState}>
      <div className="pr-shell" data-variant={variant}>
        {mobileOpen && (
          <button
            type="button"
            className="pr-sidebar__backdrop"
            aria-label="Cerrar menú"
            onClick={closeDrawer}
          />
        )}

        <aside
          className="pr-sidebar"
          data-collapsed={collapsed ? 'true' : 'false'}
          data-mobile-open={mobileOpen ? 'true' : 'false'}
        >
          {/* Rendered unconditionally: CSS is the single authority on what the
              rail hides, so the mobile drawer can show labels while the desktop
              preference is still "collapsed". */}
          {resolvedBrandHref ? (
            <a
              className="pr-sidebar__brand"
              href={resolvedBrandHref}
              title={collapsed ? brandName : undefined}
              onClick={
                brandSelect
                  ? (event) => {
                      event.preventDefault();
                      closeDrawer();
                      brandSelect();
                    }
                  : closeDrawer
              }
            >
              {logo}
              <div className="pr-sidebar__brand-copy">
                <div className="pr-sidebar__brand-name">{brandName}</div>
                {subtitle && <div className="pr-sidebar__brand-sub">{subtitle}</div>}
              </div>
            </a>
          ) : (
            <div className="pr-sidebar__brand">
              {logo}
              <div className="pr-sidebar__brand-copy">
                <div className="pr-sidebar__brand-name">{brandName}</div>
                {subtitle && <div className="pr-sidebar__brand-sub">{subtitle}</div>}
              </div>
            </div>
          )}

          {primaryAction && <div className="pr-sidebar__primary">{primaryAction}</div>}

          <nav className="pr-nav" aria-label="Navegación principal">
            {nexusHref && (
              <a
                className="pr-nav__item"
                href={nexusHref}
                title="Nexus"
                onClick={
                  onNexusSelect
                    ? (event) => {
                        event.preventDefault();
                        closeDrawer();
                        onNexusSelect();
                      }
                    : closeDrawer
                }
              >
                <Home size={17} aria-hidden />
                <span className="pr-nav__item-label">Nexus</span>
              </a>
            )}

            {variant === 'drill' ? renderDrillNavigation() : renderStandardNavigation()}
          </nav>

          <div className="pr-sidebar__spacer" />

          {footer && <div className="pr-sidebar__footer">{footer}</div>}

          {collapsible && (
            <button
              type="button"
              className="pr-sidebar__collapse"
              onClick={toggleCollapsed}
              aria-expanded={!collapsed}
              aria-label={collapsed ? expandMenuLabel : collapseMenuLabel}
              title={collapsed ? expandMenuLabel : collapseMenuLabel}
            >
              {collapsed ? (
                <PanelLeftOpen size={17} aria-hidden />
              ) : (
                <PanelLeftClose size={17} aria-hidden />
              )}
              <span>{collapseLabel}</span>
            </button>
          )}
        </aside>

        <div className="pr-main">
          {globalHeader ?? (
            <header className="pr-topbar">
              <SidebarTrigger />
              {topbarStart}
              <div className="pr-topbar__spacer" />
              {topbarEnd && <div className="pr-topbar__actions">{topbarEnd}</div>}
            </header>
          )}
          <main className="pr-content">{children}</main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
}
