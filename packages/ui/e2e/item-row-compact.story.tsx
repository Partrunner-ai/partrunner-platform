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
export function CompactRows({ density = 'compact' }: { density?: 'compact' | 'comfortable' }) {
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
                {TONES[index] ? (
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
