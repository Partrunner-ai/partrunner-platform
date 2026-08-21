'use client';

import { useCallback, useId, useMemo, useState, type AriaAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { menuStyle, useAnchoredMenu } from './useAnchoredMenu';

export interface MultiSelectOption {
  value: string;
  label: string;
  /** Additional matching text that stays out of the visible label and chips. */
  searchText?: string;
  /** Optional menu-only content before the label, such as a status dot or icon. */
  leading?: ReactNode;
}

export type MultiSelectVariant = 'field' | 'filter';

export interface MultiSelectProps
  extends Pick<
    AriaAttributes,
    'aria-label' | 'aria-labelledby' | 'aria-describedby' | 'aria-invalid' | 'aria-required'
  > {
  options: ReadonlyArray<MultiSelectOption>;
  value: string[];
  onChange: (next: string[]) => void;
  /** Controlled popup visibility. Pair with onOpenChange. */
  open?: boolean;
  /** Initial popup visibility when the field is uncontrolled. */
  defaultOpen?: boolean;
  /** Called whenever an interaction requests a popup visibility change. */
  onOpenChange?: (open: boolean) => void;
  /** Reports the raw package-owned search input for remote option loading. */
  onQueryChange?: (query: string) => void;
  /**
   * A field renders removable chips. A filter renders one compact summary so a
   * toolbar does not grow as selections accumulate.
   */
  variant?: MultiSelectVariant;
  placeholder?: string;
  /**
   * A search box inside the menu. Defaults to true for fields and false for
   * filters; it is worth enabling past a dozen options.
   */
  searchable?: boolean;
  loading?: boolean;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  /**
   * Chips shown before the rest collapse into a "+N". Keeps the trigger one line
   * tall instead of growing as selections pile up.
   */
  maxVisible?: number;
  loadingLabel?: ReactNode;
  emptyLabel?: ReactNode;
  searchLabel?: string;
  removeLabel?: (label: string) => string;
  /** Optional first menu row that resets the selection to the unfiltered state. */
  clearLabel?: ReactNode;
  fullWidth?: boolean;
  className?: string;
}

/**
 * Multiple choice from a known list. Fields expose removable chips; filters
 * collapse the same state into one toolbar-safe summary.
 *
 * The trigger is a composite widget rather than a `<button>`, which matters: chips
 * carry their own remove control, and an interactive element inside a button is
 * neither focusable nor announced. So the container takes `role="combobox"` and the
 * chips' remove buttons are real buttons within it.
 *
 * The menu portals through `useAnchoredMenu`, so it escapes a dialog's scrolling
 * body rather than being clipped by it.
 */
export function MultiSelect({
  options,
  value,
  onChange,
  open: controlledOpen,
  defaultOpen,
  onOpenChange,
  onQueryChange,
  variant = 'field',
  placeholder = 'Seleccionar…',
  searchable,
  loading = false,
  disabled = false,
  maxVisible = 2,
  loadingLabel = 'Cargando…',
  emptyLabel = 'Sin resultados',
  searchLabel = 'Buscar…',
  removeLabel = (label) => `Quitar ${label}`,
  clearLabel,
  fullWidth,
  className,
  id,
  required = false,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
}: MultiSelectProps) {
  const [query, setQuery] = useState('');
  const updateQuery = useCallback(
    (nextQuery: string) => {
      setQuery(nextQuery);
      onQueryChange?.(nextQuery);
    },
    [onQueryChange],
  );
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) updateQuery('');
      onOpenChange?.(nextOpen);
    },
    [onOpenChange, updateQuery],
  );
  const { open, setOpen, triggerRef, menuRef, pos } = useAnchoredMenu<HTMLDivElement>({
    open: controlledOpen,
    defaultOpen,
    onOpenChange: handleOpenChange,
  });
  const listId = useId();
  const valueId = `${listId}-value`;
  const isFilter = variant === 'filter';
  const showSearch = searchable ?? !isFilter;
  const isFullWidth = fullWidth ?? !isFilter;
  const hasSelection = value.length > 0;

  const labelByValue = useMemo(() => new Map(options.map((o) => [o.value, o.label])), [options]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => (o.searchText ?? o.label).toLowerCase().includes(q));
  }, [options, query]);

  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  const hidden = value.slice(maxVisible);
  const filterSummary =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? (labelByValue.get(value[0]!) ?? value[0])
        : `${placeholder} (${value.length})`;

  return (
    <div
      className={[
        'pr-multiselect',
        isFilter ? 'pr-multiselect--filter' : null,
        isFullWidth ? 'pr-multiselect--block' : null,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        ref={triggerRef}
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        /* Same as Combobox: the role does not take its name from content. */
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : (ariaLabelledBy ?? valueId)}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        aria-required={ariaRequired ?? (required || undefined)}
        aria-busy={loading || undefined}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : 0}
        onClick={() => {
          if (disabled) return;
          if (!open) updateQuery('');
          setOpen(!open);
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          // A div with a role has to bring its own keyboard contract.
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
            e.preventDefault();
            updateQuery('');
            setOpen(true);
          }
        }}
        className={`pr-multiselect__trigger${open ? ' pr-multiselect__trigger--open' : ''}${
          disabled ? ' pr-multiselect__trigger--disabled' : ''
        }${isFilter && hasSelection ? ' pr-multiselect__trigger--active' : ''}`}
      >
        {isFilter ? (
          <span id={valueId} className="pr-multiselect__summary">
            {filterSummary}
          </span>
        ) : (
          <div id={valueId} className="pr-multiselect__chips">
            {value.length === 0 ? (
              <span className="pr-multiselect__placeholder">{placeholder}</span>
            ) : (
              <>
                {value.slice(0, maxVisible).map((v) => {
                  const label = labelByValue.get(v) ?? v;
                  return (
                    <span key={v} className="pr-multiselect__chip">
                      <span className="pr-multiselect__chip-label">{label}</span>
                      <button
                        type="button"
                        className="pr-multiselect__chip-remove"
                        aria-label={removeLabel(label)}
                        disabled={disabled}
                        onClick={(e) => {
                          // The container opens the menu on click; removing a chip
                          // should not also open it.
                          e.stopPropagation();
                          toggle(v);
                        }}
                      >
                        <X size={12} aria-hidden />
                      </button>
                    </span>
                  );
                })}
                {hidden.length > 0 && (
                  <span
                    className="pr-multiselect__chip pr-multiselect__chip--count"
                    title={hidden.map((v) => labelByValue.get(v) ?? v).join(', ')}
                  >
                    +{hidden.length}
                  </span>
                )}
              </>
            )}
          </div>
        )}
        <ChevronDown size={15} className="pr-multiselect__chevron" aria-hidden />
      </div>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            style={menuStyle(pos)}
            className={`pr-multiselect__menu${isFilter ? ' pr-multiselect__menu--filter' : ''}`}
          >
            {showSearch && (
              <div className="pr-multiselect__search">
                <Search size={14} aria-hidden />
                <input
                  autoFocus
                  type="search"
                  role="searchbox"
                  value={query}
                  onChange={(e) => updateQuery(e.target.value)}
                  placeholder={searchLabel}
                  aria-label={searchLabel}
                  aria-controls={listId}
                />
              </div>
            )}
            <div className="pr-multiselect__list" role="listbox" aria-multiselectable id={listId}>
              {!loading && clearLabel != null && (
                <button
                  type="button"
                  role="option"
                  aria-selected={!hasSelection}
                  onClick={() => {
                    if (hasSelection) onChange([]);
                  }}
                  className="pr-multiselect__option pr-multiselect__option--clear"
                >
                  <span
                    className={`pr-multiselect__check${
                      !hasSelection ? ' pr-multiselect__check--on' : ''
                    }`}
                    aria-hidden
                  >
                    {!hasSelection && <Check size={12} />}
                  </span>
                  <span className="pr-multiselect__option-label">{clearLabel}</span>
                </button>
              )}
              {loading ? (
                <p className="pr-multiselect__note">{loadingLabel}</p>
              ) : filtered.length === 0 ? (
                <p className="pr-multiselect__note">{emptyLabel}</p>
              ) : (
                filtered.map((o) => {
                  const checked = value.includes(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="option"
                      aria-selected={checked}
                      onClick={() => toggle(o.value)}
                      className="pr-multiselect__option"
                    >
                      <span
                        className={`pr-multiselect__check${checked ? ' pr-multiselect__check--on' : ''}`}
                        aria-hidden
                      >
                        {checked && <Check size={12} />}
                      </span>
                      {o.leading != null && (
                        <span className="pr-multiselect__option-leading">{o.leading}</span>
                      )}
                      <span className="pr-multiselect__option-label">{o.label}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
