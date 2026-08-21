'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type AriaAttributes,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X } from 'lucide-react';
import { menuStyle, useAnchoredMenu } from './useAnchoredMenu';

export interface ComboboxOption {
  value: string;
  label: string;
}

export interface ComboboxProps
  extends Pick<
    AriaAttributes,
    'aria-label' | 'aria-labelledby' | 'aria-describedby' | 'aria-invalid' | 'aria-required'
  > {
  /** The chosen option. Carries its label so the trigger renders without a refetch. */
  value: ComboboxOption | null;
  onChange: (next: ComboboxOption | null) => void;
  /** Called with the trimmed query, debounced. Async so it can hit a server. */
  onSearch: (query: string) => Promise<ComboboxOption[]>;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  /** Hides the clear button — for a field that must always hold a value. */
  clearable?: boolean;
  loadingLabel?: ReactNode;
  emptyLabel?: ReactNode;
  clearLabel?: string;
  /** Milliseconds before a keystroke becomes a request. */
  debounceMs?: number;
  fullWidth?: boolean;
  className?: string;
}

/**
 * A select whose options come from a server.
 *
 * For catalogues too large to ship to the client — a fleet list, a driver list —
 * where the value is one option and the search has to be asynchronous.
 *
 * Two things it handles that a hand-rolled one usually does not. Responses are
 * matched to the request that asked for them, so a slow reply for "ab" cannot
 * overwrite the results for "abc" that arrived first. And the menu renders in a
 * portal registered with `DialogLayer`, so it escapes the scrolling body of a dialog
 * instead of being clipped by it — which is where these fields normally live.
 */
export function Combobox({
  value,
  onChange,
  onSearch,
  placeholder = 'Buscar…',
  disabled = false,
  clearable = true,
  loadingLabel = 'Buscando…',
  emptyLabel = 'Sin resultados',
  clearLabel = 'Quitar selección',
  debounceMs = 250,
  fullWidth = true,
  className,
  id,
  required = false,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
}: ComboboxProps) {
  const { open, setOpen, triggerRef, menuRef, pos } = useAnchoredMenu<HTMLButtonElement>();
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<ComboboxOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const reqId = useRef(0);
  const listId = useId();
  const valueId = `${listId}-value`;

  useEffect(() => {
    if (!open) return;
    // Each request carries a ticket; only the newest one is allowed to write. Without
    // this a slow reply for a shorter query lands after a faster one for a longer
    // query and silently replaces it.
    const myId = ++reqId.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await onSearch(query.trim());
        if (myId === reqId.current) {
          setOptions(res);
          setActive(0);
        }
      } finally {
        if (myId === reqId.current) setLoading(false);
      }
    }, debounceMs);
    return () => clearTimeout(t);
  }, [query, open, onSearch, debounceMs]);

  const choose = (o: ComboboxOption) => {
    onChange(o);
    setOpen(false);
  };

  return (
    <div
      className={[
        'pr-combobox',
        fullWidth ? 'pr-combobox--block' : null,
        clearable && value && !disabled ? 'pr-combobox--has-clear' : null,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        /* `combobox` takes its name from the author, not from its content — without
           this the trigger is announced with no name at all. Pointing at the value
           span means the name is whatever the field currently reads as, and an
           explicit `aria-label` from the caller still wins. */
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : (ariaLabelledBy ?? valueId)}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        aria-required={ariaRequired ?? (required || undefined)}
        aria-busy={loading || undefined}
        disabled={disabled}
        onClick={() => {
          setQuery('');
          setOpen((o) => !o);
        }}
        className={`pr-combobox__trigger${open ? ' pr-combobox__trigger--open' : ''}`}
      >
        <span id={valueId} className={`pr-combobox__value${value ? '' : ' pr-combobox__value--empty'}`}>
          {value ? value.label : placeholder}
        </span>
        <ChevronDown size={15} className="pr-combobox__chevron" aria-hidden />
      </button>

      {/*
        The clear control is a sibling, not a child of the trigger. Nesting one
        interactive element inside another leaves it unreachable by keyboard and
        unannounced — the version this came from used a `<span role="button">`
        inside the trigger, which reads as a button and cannot be focused.
      */}
      {clearable && value && !disabled && (
        <button
          type="button"
          className="pr-combobox__clear"
          aria-label={clearLabel}
          onClick={() => onChange(null)}
        >
          <X size={15} aria-hidden />
        </button>
      )}

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div ref={menuRef} style={menuStyle(pos)} className="pr-combobox__menu">
            <div className="pr-combobox__search">
              <Search size={14} aria-hidden />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                aria-label={placeholder}
                aria-controls={listId}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setActive((i) => Math.min(i + 1, options.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setActive((i) => Math.max(i - 1, 0));
                  } else if (e.key === 'Enter') {
                    const o = options[active];
                    if (o) {
                      e.preventDefault();
                      choose(o);
                    }
                  }
                }}
              />
            </div>
            <div className="pr-combobox__list" role="listbox" id={listId}>
              {loading ? (
                <p className="pr-combobox__note">{loadingLabel}</p>
              ) : options.length === 0 ? (
                <p className="pr-combobox__note">{emptyLabel}</p>
              ) : (
                options.map((o, i) => (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={value?.value === o.value}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(o)}
                    className={`pr-combobox__option${i === active ? ' pr-combobox__option--active' : ''}`}
                  >
                    <span className="pr-combobox__option-label">{o.label}</span>
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
