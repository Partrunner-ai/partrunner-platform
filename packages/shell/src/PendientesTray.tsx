import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
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
  /** Enlace del encabezado. */
  viewAll: string;
  /** Enlace del pie. */
  openHome: string;
  /** Botón de una fila. */
  open: string;
  claim: string;
  claiming: string;
  claimError: string;
  /** «De Finanzas, sin tomar». */
  teamNamed: (team: string) => string;
  /** «y 3 más». */
  more: (count: number) => string;
}

export interface PendientesTrayProps {
  pendientes: StaffPendientesState;
  locale?: StaffLocale;
  /** Se llama una vez cada vez que se abre la bandeja. */
  onOpen?: () => StaffShellMutation;
  /** «Lo tomo»: toma un pendiente del equipo. Sin él, las filas del equipo sólo tienen «Abrir». */
  onClaim?: (id: string) => Promise<void>;
  /** Se llama tras tomar bien un pendiente, para pedir los datos otra vez. */
  onClaimed?: () => StaffShellMutation;
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
    viewAll: 'Ver todos en Inicio',
    openHome: 'Abrir Inicio',
    open: 'Abrir',
    claim: 'Lo tomo',
    claiming: 'Tomando…',
    claimError: 'No se pudo tomar. Intenta otra vez.',
    teamNamed: (name) => `De ${name}, sin tomar`,
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
    openHome: 'Open Home',
    open: 'Open',
    claim: 'Take it',
    claiming: 'Taking…',
    claimError: 'Could not take it. Try again.',
    teamNamed: (name) => `${name}, not taken`,
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
  onClaim,
  onClaimed,
  labels: labelOverrides,
  className,
}: PendientesTrayProps) {
  const labels = { ...MESSAGES[locale], ...labelOverrides };
  const { mine, team, items, href, loading, teamLabel } = pendientes;
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

  const [claims, setClaims] = useState<Record<string, 'pending' | 'error'>>({});
  const claiming = useRef(new Set<string>());
  const claim = async (id: string) => {
    if (!onClaim || claiming.current.has(id)) return;
    claiming.current.add(id);
    setClaims((prev) => ({ ...prev, [id]: 'pending' }));
    let ok = false;
    try {
      await onClaim(id);
      ok = true;
    } catch {
      setClaims((prev) => ({ ...prev, [id]: 'error' }));
    } finally {
      claiming.current.delete(id);
    }
    if (ok) {
      setClaims((prev) => {
        const rest = { ...prev };
        delete rest[id];
        return rest;
      });
      void onClaimed?.();
    }
  };

  const hasButton = (item: StaffPendingItem) =>
    (item.bucket === 'team' && onClaim !== undefined) || isSafePendienteHref(item.href);

  // The first row with a button in EACH section gets the primary one; the rest are outlined.
  // A row that is being claimed is skipped, so the primary never sits on a disabled button.
  const primaryIds = new Set(
    (['mine', 'team'] as const)
      .filter((bucket) => (bucket === 'mine' ? mine : team) > 0)
      .map((bucket) => items.filter((item) => item.bucket === bucket).find((item) => hasButton(item) && claims[item.id] !== 'pending')?.id)
      .filter((id): id is string => id !== undefined),
  );

  const renderItem = (item: StaffPendingItem) => {
    const meta = [item.queue, item.subtitle, item.ageLabel]
      .filter((part): part is string => typeof part === 'string' && part.trim() !== '')
      .join(' · ');
    const state = claims[item.id];
    const variant = primaryIds.has(item.id) ? 'primary' : 'outline';
    let action: ReactNode = null;
    if (item.bucket === 'team' && onClaim) {
      action = (
        <button
          type="button"
          className="pr-pendientes__action"
          data-variant={variant}
          disabled={state === 'pending'}
          aria-label={`${state === 'pending' ? labels.claiming : labels.claim}: ${item.title}`}
          onClick={() => void claim(item.id)}
        >
          {state === 'pending' ? labels.claiming : labels.claim}
        </button>
      );
    } else if (isSafePendienteHref(item.href)) {
      action = (
        <a
          className="pr-pendientes__action"
          data-variant={variant}
          href={item.href}
          aria-label={`${labels.open}: ${item.title}`}
          onClick={close}
        >
          {labels.open}
        </a>
      );
    }
    return (
      <div key={item.id} className="pr-pendientes__row" data-bucket={item.bucket}>
        <span className="pr-pendientes__copy">
          <span className="pr-pendientes__title">
            {item.verb} · {item.title}
          </span>
          {meta && <span className="pr-pendientes__meta">{meta}</span>}
          {state === 'error' && (
            <span className="pr-pendientes__error" role="alert">
              {labels.claimError}
            </span>
          )}
        </span>
        {action}
      </div>
    );
  };

  const renderSection = (bucket: 'mine' | 'team', count: number) => {
    if (count <= 0) return null;
    const listed = items.filter((item) => item.bucket === bucket);
    const rest = count - listed.length;
    const heading =
      bucket === 'mine'
        ? labels.mine
        : teamLabel
          ? labels.teamNamed(teamLabel)
          : labels.team;
    return (
      <section
        className="pr-pendientes__section"
        data-bucket={bucket}
      >
        <h3 className="pr-pendientes__heading">
          {heading} · {count}
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
            {safeHref && (
              <a className="pr-pendientes__viewall" href={safeHref} onClick={close}>
                {labels.viewAll}
              </a>
            )}
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
              {labels.openHome}
            </a>
          )}
        </section>
      )}
    </div>
  );
}
