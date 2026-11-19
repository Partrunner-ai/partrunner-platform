import type { FocusEvent, PointerEvent } from 'react';
import { sameAppOrigin } from './appOrigin';

/** Wait this long on an item before warming its origin, so a pointer passing over does nothing. */
export const PRELOAD_INTENT_MS = 100;

/** Origins already warmed on this page (one preconnect per origin, ever). */
const warmed = new Set<string>();
/** Pending intent timers, one per origin. */
const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** Forget every warmed target and timer. Tests only. */
export function resetPreloadState(): void {
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
  warmed.clear();
}

function saveDataOn(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}

/** The origin to warm, or `null` when this page must not warm it. */
function warmTarget(href: string | null | undefined): string | null {
  if (typeof window === 'undefined' || !href) return null;
  if (saveDataOn()) return null;
  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  // The current app is already loaded; its own links are the router's job.
  if (sameAppOrigin(url.href, window.location.href)) return null;
  return url.origin;
}

/**
 * Warm the target app: open its connection (DNS, TCP, TLS) before the click.
 * Once per origin per page. It never fetches a document: staff pages are
 * dynamic and not cacheable, so a prefetch would cost a render for nothing.
 */
export function preloadApp(href: string | null | undefined): void {
  const origin = warmTarget(href);
  if (!origin || warmed.has(origin)) return;
  warmed.add(origin);
  try {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = origin;
    link.dataset.prPreload = '';
    document.head.appendChild(link);
  } catch {
    /* a warm-up must never break the page */
  }
}

function cancel(key: string): void {
  const timer = timers.get(key);
  if (timer !== undefined) {
    clearTimeout(timer);
    timers.delete(key);
  }
}

function schedule(href: string): void {
  const key = warmTarget(href);
  if (!key || warmed.has(key) || timers.has(key)) return;
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      preloadApp(href);
    }, PRELOAD_INTENT_MS),
  );
}

function keyOf(href: string): string {
  return warmTarget(href) ?? '';
}

/**
 * Event props for a link that leaves for another app. A mouse or pen hover,
 * or keyboard focus, starts a short timer; leaving cancels it. Touch never
 * warms. Spread the result on the `<a>`.
 */
export function preloadOnIntent(href: string | null | undefined) {
  if (!href) return {};
  return {
    onPointerEnter: (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      schedule(href);
    },
    onPointerLeave: () => cancel(keyOf(href)),
    onFocus: (event: FocusEvent<HTMLElement>) => {
      // A tap focuses the link too; only keyboard focus shows intent.
      let visible: boolean;
      try {
        visible = event.currentTarget.matches(':focus-visible');
      } catch {
        return;
      }
      if (visible) schedule(href);
    },
    onBlur: () => cancel(keyOf(href)),
  };
}
