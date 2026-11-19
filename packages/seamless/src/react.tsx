'use client';

import * as React from 'react';

import { BRAND } from './core';

function TransitionMark() {
  return (
    <span
      aria-hidden
      className="seamless-splash-logo"
      style={{
        display: 'grid',
        width: 56,
        height: 56,
        placeItems: 'center',
        borderRadius: 16,
        background: BRAND.black,
        color: BRAND.yellow,
        fontSize: 20,
        fontWeight: 800,
        letterSpacing: '-0.04em',
      }}
    >
      PR
    </span>
  );
}

/**
 * Entry splash: covers the screen with the PartRunner brand while the app
 * hydrates, chaining Nexus's exit transition. Auto-hides once `minDurationMs`
 * has passed since navigation start (at mount on a normal load) and re-shows
 * briefly on bfcache return (`pageshow`). Place `<SeamlessSplash />` as high as
 * possible (root layout).
 */
export function SeamlessSplash({ minDurationMs = 360 }: { minDurationMs?: number }) {
  const [visible, setVisible] = React.useState(true);

  React.useEffect(() => {
    // The minimum counts from navigation start, so on a normal load the time the
    // page already spent loading is not waited for a second time.
    const remaining = Math.max(0, minDurationMs - performance.now());
    const t = window.setTimeout(() => setVisible(false), remaining);
    return () => window.clearTimeout(t);
  }, [minDurationMs]);

  React.useEffect(() => {
    let t: number | undefined;
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        setVisible(true);
        t = window.setTimeout(() => setVisible(false), minDurationMs);
      }
    };
    window.addEventListener('pageshow', onPageShow);
    return () => {
      window.removeEventListener('pageshow', onPageShow);
      if (t !== undefined) window.clearTimeout(t);
    };
  }, [minDurationMs]);

  return (
    <div
      aria-hidden={!visible}
      data-seamless-splash
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: BRAND.yellow,
        backgroundImage: BRAND.yellowGradient,
        opacity: visible ? 1 : 0,
        visibility: visible ? 'visible' : 'hidden',
        pointerEvents: visible ? 'all' : 'none',
        transition: 'opacity .2s cubic-bezier(.22,1,.36,1), visibility .2s',
      }}
    >
      <TransitionMark />
      <style>{`
        @keyframes seamlessPulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.06);opacity:.85} }
        .seamless-splash-logo { animation: seamlessPulse 1.1s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce){ .seamless-splash-logo{ animation:none } }
      `}</style>
    </div>
  );
}

interface ExitOverlayState {
  active: boolean;
  label: string | null;
}

const ExitCtx = React.createContext<{ navigateTo: (url: string, label?: string) => void } | null>(
  null,
);

/**
 * Exit-transition provider. Wrap the app; any link can call
 * `useSeamlessExit().navigateTo(url, label)` to show the yellow overlay and
 * navigate in the same tab (e.g. back to Nexus).
 */
export function SeamlessExitProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<ExitOverlayState>({ active: false, label: null });
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // A page restored from the bfcache still has the overlay on: clear it.
  React.useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setState({ active: false, label: null });
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  const navigateTo = React.useCallback((url: string, label?: string) => {
    setState({ active: true, label: label ?? null });
    // No fixed wait: navigate after the overlay has had one paint. The old page
    // stays on screen until the next one commits, so the overlay stays visible.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.location.href = url;
      });
    });
  }, []);

  const value = React.useMemo(() => ({ navigateTo }), [navigateTo]);

  return (
    <ExitCtx.Provider value={value}>
      {children}
      {mounted && (
        <div
          aria-hidden={!state.active}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: BRAND.yellow,
            backgroundImage: BRAND.yellowGradient,
            opacity: state.active ? 1 : 0,
            visibility: state.active ? 'visible' : 'hidden',
            pointerEvents: state.active ? 'all' : 'none',
            transition: 'opacity .2s cubic-bezier(.22,1,.36,1), visibility .2s',
          }}
        >
          <TransitionMark />
        </div>
      )}
    </ExitCtx.Provider>
  );
}

export function useSeamlessExit() {
  const ctx = React.useContext(ExitCtx);
  return (
    ctx ?? {
      navigateTo: (url: string) => {
        window.location.href = url;
      },
    }
  );
}

/**
 * Link back to Nexus with the exit transition. Canonical visible label:
 * **"Nexus"**. Pass a resolved URL from the host; client code never receives
 * the server configuration or its JWT secret.
 */
export function BackToNexus({
  nexusUrl,
  className,
  children,
}: {
  nexusUrl: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const { navigateTo } = useSeamlessExit();
  return (
    <a
      href={nexusUrl}
      onClick={(e) => {
        e.preventDefault();
        navigateTo(nexusUrl, 'Nexus');
      }}
      className={className}
    >
      {children ?? 'Nexus'}
    </a>
  );
}
