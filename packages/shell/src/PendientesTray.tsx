import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ListTodo } from 'lucide-react';
import type {
  StaffLocale,
  StaffPendientesState,
  StaffPendingItem,
  StaffShellMutation,
} from './StaffShellContext';
import { formatPendingCount, isSafePendienteHref, pendingTone } from './pendientes';
import { useDismiss } from './useDismiss';

export interface PendientesTrayLabels {
  trigger: string;
  title: string;
  mine: string;
  team: string;
  empty: string;
  loading: string;
  viewAll: string;
  /** «y 3 más». */
  more: (count: number) => string;
}

export interface PendientesTrayProps {
  pendientes: StaffPendientesState;
  locale?: StaffLocale;
  /** Se llama una vez cada vez que se abre la bandeja. */
  onOpen?: () => StaffShellMutation;
  labels?: Partial<PendientesTrayLabels>;
  className?: string;
}

const MESSAGES: Record<StaffLocale, PendientesTrayLabels> = {
  es: {
    trigger: 'Pendientes',
    title: 'Pendientes',
    mine: 'Te toca',
    team: 'De tu equipo, sin tomar',
    empty: 'No tienes pendientes.',
    loading: 'Cargando pendientes…',
    viewAll: 'Ver todo en Inicio',
    more: (count) => `y ${count} más`,
  },
  en: {
    trigger: 'To-dos',
    title: 'To-dos',
    mine: 'Yours',
    team: 'Your team, not taken',
    empty: 'Nothing to do.',
    loading: 'Loading to-dos…',
    viewAll: 'See all on Home',
    more: (count) => `and ${count} more`,
  },
};

/**
 * Bandeja de pendientes junto a la campana. La campana informa; esto es lo que
 * la persona debe hacer o aprobar. El shell no pide nada: el anfitrión pasa
 * los datos.
 */
export function PendientesTray({
  pendientes,
  locale = 'es',
  onOpen,
  labels: labelOverrides,
  className,
}: PendientesTrayProps) {
  const labels = { ...MESSAGES[locale], ...labelOverrides };
  const { mine, team, items, href, loading } = pendientes;
  const total = mine + team;
  const safeHref = isSafePendienteHref(href) ? href : undefined;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLElement>(null);
  const popoverId = useId();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(wrapperRef, open, close, triggerRef);

  useEffect(() => {
    if (open) popoverRef.current?.focus();
  }, [open]);

  // Igual que la campana: `onOpen` sólo en el flanco false → true.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) onOpen?.();
    wasOpen.current = open;
  }, [open, onOpen]);

  const tone = pendingTone({ mine, team });
  const triggerLabel = `${labels.trigger}: ${total}`;

  const renderItem = (item: StaffPendingItem) => {
    const content = (
      <span className="pr-notifications__item-copy">
        <span className="pr-pendientes__kicker">
          {item.verb} · {item.queue}
        </span>
        <span className="pr-notifications__item-title">{item.title}</span>
        {(item.subtitle || item.ageLabel) && (
          <span className="pr-notifications__item-meta">
            {item.subtitle && <span>{item.subtitle}</span>}
            {item.ageLabel && <span>{item.ageLabel}</span>}
          </span>
        )}
      </span>
    );
    if (isSafePendienteHref(item.href)) {
      return (
        <a
          key={item.id}
          href={item.href}
          className="pr-notifications__item"
          data-bucket={item.bucket}
          onClick={close}
        >
          {content}
        </a>
      );
    }
    return (
      <div
        key={item.id}
        className="pr-notifications__item pr-pendientes__row"
        data-bucket={item.bucket}
      >
        {content}
      </div>
    );
  };

  const renderSection = (bucket: 'mine' | 'team', count: number) => {
    if (count <= 0) return null;
    const listed = items.filter((item) => item.bucket === bucket);
    const rest = count - listed.length;
    return (
      <section
        className="pr-pendientes__section"
        data-bucket={bucket}
        aria-label={labels[bucket]}
      >
        <h3 className="pr-pendientes__heading">
          <span>{labels[bucket]}</span>
          <span className="pr-pendientes__count">{count}</span>
        </h3>
        {listed.map(renderItem)}
        {rest > 0 && safeHref && (
          <a className="pr-pendientes__more" href={safeHref} onClick={close}>
            {labels.more(rest)}
          </a>
        )}
      </section>
    );
  };

  return (
    <div
      ref={wrapperRef}
      className={`pr-notifications pr-pendientes${className ? ` ${className}` : ''}`}
    >
      <button
        ref={triggerRef}
        type="button"
        className="pr-iconbtn"
        aria-label={triggerLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen((value) => !value)}
      >
        <ListTodo size={18} aria-hidden />
        {total > 0 && (
          <span className="pr-badge-dot" data-tone={tone} aria-hidden>
            {formatPendingCount(total)}
          </span>
        )}
      </button>

      {open && (
        <section
          ref={popoverRef}
          id={popoverId}
          className="pr-notifications__popover"
          role="dialog"
          aria-label={labels.title}
          tabIndex={-1}
        >
          <div className="pr-notifications__header">
            <h2>{labels.title}</h2>
          </div>

          <div className="pr-notifications__list">
            {loading && items.length === 0 ? (
              <p className="pr-notifications__empty" role="status">
                {labels.loading}
              </p>
            ) : total === 0 ? (
              <p className="pr-notifications__empty">{labels.empty}</p>
            ) : (
              <>
                {renderSection('mine', mine)}
                {renderSection('team', team)}
              </>
            )}
          </div>

          {safeHref && (
            <a className="pr-notifications__footer" href={safeHref} onClick={close}>
              {labels.viewAll}
            </a>
          )}
        </section>
      )}
    </div>
  );
}
