import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import {
  type StaffLocale,
  type StaffNotification,
} from './StaffShellContext';
import { useDismiss } from './useDismiss';

export interface NotificationCenterLabels {
  trigger: string;
  title: string;
  markAllRead: string;
  empty: string;
  loading: string;
  viewAll: string;
}

export interface NotificationCenterProps {
  items: readonly StaffNotification[];
  unreadCount: number;
  href: string;
  locale?: StaffLocale;
  loading?: boolean;
  onNotificationRead?: (id: string) => void;
  onMarkAllRead?: () => void;
  labels?: Partial<NotificationCenterLabels>;
  className?: string;
}

const DEFAULT_LABELS: NotificationCenterLabels = {
  trigger: 'Notificaciones',
  title: 'Notificaciones',
  markAllRead: 'Marcar todas como leídas',
  empty: 'No tienes notificaciones nuevas.',
  loading: 'Cargando notificaciones…',
  viewAll: 'Ver todas en Nexus',
};

function formatTimestamp(timestamp: string, locale: StaffLocale): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-MX' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(date);
}

/** Compact global inbox preview. The full feed remains owned by Nexus. */
export function NotificationCenter({
  items,
  unreadCount,
  href,
  locale = 'es',
  loading = false,
  onNotificationRead,
  onMarkAllRead,
  labels: labelOverrides,
  className,
}: NotificationCenterProps) {
  const labels = { ...DEFAULT_LABELS, ...labelOverrides };
  // This panel is an unread inbox, not a history: a notification leaves it the
  // moment it is read. The full feed is Nexus's, which is what `viewAll` is for.
  // Reading is per-item truth (`readAt`), not `unreadCount`, so a host that
  // miscounts can never hide something the user has not actually read.
  const pending = items.filter((item) => !item.readAt);
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

  const triggerLabel =
    unreadCount > 0
      ? `${labels.trigger}: ${unreadCount}`
      : labels.trigger;

  return (
    <div
      ref={wrapperRef}
      className={`pr-notifications${className ? ` ${className}` : ''}`}
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
        <Bell size={18} aria-hidden />
        {unreadCount > 0 && (
          <span className="pr-badge-dot" aria-hidden>
            {unreadCount > 99 ? '99+' : unreadCount}
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
            {unreadCount > 0 && onMarkAllRead && (
              <button
                type="button"
                className="pr-notifications__mark-all"
                onClick={() => void onMarkAllRead()}
              >
                <CheckCheck size={15} aria-hidden />
                <span>{labels.markAllRead}</span>
              </button>
            )}
          </div>

          <div className="pr-notifications__list">
            {loading && pending.length === 0 ? (
              <p className="pr-notifications__empty" role="status">
                {labels.loading}
              </p>
            ) : pending.length === 0 ? (
              <p className="pr-notifications__empty">{labels.empty}</p>
            ) : (
              pending.map((item) => {
                const content = (
                  <>
                    <span className="pr-notifications__item-copy">
                      <span className="pr-notifications__item-title">
                        {item.title}
                      </span>
                      {item.body && (
                        <span className="pr-notifications__item-body">
                          {item.body}
                        </span>
                      )}
                      <span className="pr-notifications__item-meta">
                        {item.sourceLabel && <span>{item.sourceLabel}</span>}
                        <time dateTime={item.createdAt}>
                          {item.timeLabel ??
                            formatTimestamp(item.createdAt, locale)}
                        </time>
                      </span>
                    </span>
                  </>
                );

                if (item.href) {
                  // Un aviso puede apuntar a otro producto o a un archivo fuera
                  // de PartRunner (una carpeta de Drive, por ejemplo). Sacar a
                  // alguien de la app en la que está trabajando para ver un
                  // adjunto le cuesta el contexto entero: la pestaña actual, el
                  // panel abierto y a dónde volver.
                  //
                  // Un destino RELATIVO sí es una ruta de la app anfitriona, así
                  // que se queda en la misma pestaña. Mismo criterio que la
                  // navegación externa del sidebar en AppShell, y por la misma
                  // razón que documenta ahí: una URL absoluta no es una ruta.
                  //
                  // `StaffNotification` no tiene bandera `external` (a
                  // diferencia de `NavItem`), y añadir una obligaría a cada app
                  // a marcar cada aviso. Se deduce del propio href.
                  const isAbsolute = /^https?:\/\//i.test(item.href);
                  return (
                    <a
                      key={item.id}
                      href={item.href}
                      className="pr-notifications__item"
                      target={isAbsolute ? '_blank' : undefined}
                      rel={isAbsolute ? 'noreferrer noopener' : undefined}
                      onClick={() => {
                        // Sin await, a propósito: el contrato de
                        // `markNotificationRead` promete no bloquear la
                        // navegación, y esperar aquí puede costar la pestaña
                        // nueva (el navegador descarta lo que no viene de un
                        // gesto directo del usuario).
                        void onNotificationRead?.(item.id);
                        close();
                      }}
                    >
                      {content}
                    </a>
                  );
                }

                return (
                  <button
                    key={item.id}
                    type="button"
                    className="pr-notifications__item"
                    disabled={!onNotificationRead}
                    onClick={() => void onNotificationRead?.(item.id)}
                  >
                    {content}
                  </button>
                );
              })
            )}
          </div>

          <a className="pr-notifications__footer" href={href} onClick={close}>
            {labels.viewAll}
          </a>
        </section>
      )}
    </div>
  );
}
