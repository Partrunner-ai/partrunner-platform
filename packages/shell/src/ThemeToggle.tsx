import { useCallback, useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import type { StaffTheme } from './StaffShellContext';

export interface ThemeToggleProps {
  /** localStorage key for persistence. */
  storageKey?: string;
  /** Controlled value. Omit to use localStorage-backed standalone mode. */
  theme?: StaffTheme;
  onThemeChange?: (theme: StaffTheme) => void;
  /**
   * Include `system` in the cycle. Defaults to true for controlled usage and
   * false for standalone usage, preserving the original light/dark behavior.
   */
  allowSystem?: boolean;
  /** Controlled hosts normally apply their own provider state. */
  applyToDocument?: boolean;
  /** Accessible label; defaults to localized Spanish copy. */
  label?: string;
  className?: string;
}

const THEME_CYCLE: StaffTheme[] = ['light', 'dark', 'system'];

function nextTheme(theme: StaffTheme, allowSystem: boolean): StaffTheme {
  if (!allowSystem) return theme === 'light' ? 'dark' : 'light';
  const index = THEME_CYCLE.indexOf(theme);
  return THEME_CYCLE[(index + 1) % THEME_CYCLE.length] ?? 'system';
}

function resolveTheme(theme: StaffTheme): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function apply(theme: StaffTheme) {
  const root = document.documentElement;
  root.classList.toggle('dark', resolveTheme(theme) === 'dark');
  root.dataset.prTheme = theme;
}

/**
 * Standalone mode preserves the original light/dark toggle. Controlled hosts
 * get light/dark/system by default and own persistence plus DOM updates unless
 * `applyToDocument` is explicitly enabled.
 */
export function ThemeToggle({
  storageKey = 'pr-theme',
  theme: controlledTheme,
  onThemeChange,
  allowSystem: allowSystemOverride,
  applyToDocument = controlledTheme === undefined,
  label,
  className,
}: ThemeToggleProps) {
  const allowSystem = allowSystemOverride ?? controlledTheme !== undefined;
  const [localTheme, setLocalTheme] = useState<StaffTheme>(
    allowSystem ? 'system' : 'light',
  );
  const theme = controlledTheme ?? localTheme;

  useEffect(() => {
    if (controlledTheme !== undefined) return;
    const stored = window.localStorage.getItem(storageKey);
    const storedTheme =
      stored === 'light' ||
      stored === 'dark' ||
      (allowSystem && stored === 'system')
        ? stored
        : undefined;
    setLocalTheme(
      storedTheme ?? (allowSystem ? 'system' : resolveTheme('system')),
    );
  }, [allowSystem, controlledTheme, storageKey]);

  useEffect(() => {
    if (!applyToDocument) return;
    apply(theme);
    if (theme !== 'system') return;

    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    if (media?.addEventListener) {
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    }
    media?.addListener?.(onChange);
    return () => media?.removeListener?.(onChange);
  }, [applyToDocument, theme]);

  const toggle = useCallback(() => {
    const next = nextTheme(theme, allowSystem);
    if (controlledTheme === undefined) {
      setLocalTheme(next);
      window.localStorage.setItem(storageKey, next);
    }
    void onThemeChange?.(next);
  }, [allowSystem, controlledTheme, onThemeChange, storageKey, theme]);

  const accessibleLabel =
    label ??
    `Tema: ${theme}. Cambiar a ${nextTheme(theme, allowSystem)}`;
  return (
    <button
      type="button"
      className={`pr-iconbtn${className ? ` ${className}` : ''}`}
      aria-label={accessibleLabel}
      title={accessibleLabel}
      onClick={toggle}
    >
      {theme === 'light' ? (
        <Sun size={18} aria-hidden />
      ) : theme === 'dark' ? (
        <Moon size={18} aria-hidden />
      ) : (
        <Monitor size={18} aria-hidden />
      )}
    </button>
  );
}
