import { Avatar, Badge, ItemList, ItemRow } from '../src';

const NAMES = [
  'Ángeles Transportes',
  'Gómez y Pérez Logística',
  'Ágil Carga del Bajío',
  'Yáñez Fletes',
  'Grupo Quijano',
  'Ópalo Express',
  'Transportes Ruiz',
  'Águila Roja Mudanzas',
];

const TONES = ['danger', 'warning', 'info', 'success', undefined, 'danger', undefined, 'warning'] as const;

/** Eight three-line compact rows: avatar, title, meta, `<strong>` description, footer with a badge. */
export function CompactRows({
  density = 'compact',
  badges = true,
}: {
  density?: 'compact' | 'comfortable';
  /** Put a `sm` badge at the start of the footer of the toned rows. */
  badges?: boolean;
}) {
  return (
    <div style={{ width: 380 }}>
      <ItemList aria-label="Flotas" density={density}>
        {NAMES.map((name, index) => (
          <ItemRow
            key={name}
            leading={<Avatar name={name} size="sm" decorative />}
            title={name}
            meta="hace 3 h"
            description={
              <>
                <strong>Flota:</strong> ¿Cuándo pagan la semana quince, por favor? Gracias
              </>
            }
            footer={
              <>
                {badges && TONES[index] ? (
                  <Badge tone={TONES[index]} size="sm">
                    Pago retenido
                  </Badge>
                ) : null}
                2 aclaraciones · 1 chat · Atiende Ana Ruiz
              </>
            }
            tone={TONES[index]}
            unread={index === 1}
            selected={index === 2}
            onClick={() => undefined}
          />
        ))}
      </ItemList>
    </div>
  );
}

/** Short compact rows: one line, no leading, two lines, a trailing element and two footer badge sizes. */
export function ShortRows() {
  return (
    <div style={{ width: 380 }}>
      <ItemList aria-label="Filas cortas" density="compact">
        <ItemRow data-testid="one-line" leading={<Avatar name="Ángeles Transportes" size="sm" decorative />} title="Solo título" />
        <ItemRow data-testid="no-leading" title="Sin avatar" />
        <ItemRow
          data-testid="two-lines"
          leading={<Avatar name="Gómez y Pérez" size="sm" decorative />}
          title="Título y descripción"
          description="Una sola línea de texto"
        />
        <ItemRow
          data-testid="trailing"
          leading={<Avatar name="Yáñez Fletes" size="sm" decorative />}
          title="Con elemento final"
          trailing={
            <Badge tone="info" size="sm">
              Nuevo
            </Badge>
          }
        />
        <ItemRow
          data-testid="md-badge"
          leading={<Avatar name="Quijano" size="sm" decorative />}
          title="Insignia md"
          description="Descripción"
          footer={
            <>
              <Badge tone="danger">Pago retenido</Badge>2 aclaraciones · 1 chat
            </>
          }
        />
        <ItemRow
          data-testid="sm-badge"
          leading={<Avatar name="Quijano" size="sm" decorative />}
          title="Insignia sm"
          description="Descripción"
          footer={
            <>
              <Badge tone="danger" size="sm">
                Pago retenido
              </Badge>
              2 aclaraciones · 1 chat
            </>
          }
        />
        <ItemRow data-testid="unread" leading={<Avatar name="Ópalo Express" size="sm" decorative />} title="No leída" unread />
        <ItemRow data-testid="unread-selected" leading={<Avatar name="Ágil Carga" size="sm" decorative />} title="No leída y abierta" unread selected />
      </ItemList>
    </div>
  );
}
