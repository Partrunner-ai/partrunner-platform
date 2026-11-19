import { PageSkeleton, type PageSkeletonVariant } from '@partrunner-ai/ui';

const VARIANTS: Array<{ id: PageSkeletonVariant; title: string }> = [
  { id: 'table', title: 'Tabla (por defecto)' },
  { id: 'dashboard', title: 'Tablero' },
  { id: 'detail', title: 'Detalle' },
  { id: 'cards', title: 'Tarjetas' },
  { id: 'chat', title: 'Conversaciones' },
];

export function SkeletonsDemo() {
  return (
    <div className="skeletons">
      <header>
        <p className="skeletons__eyebrow">UI · PageSkeleton</p>
        <h1 className="skeletons__title">Esqueletos de página</h1>
        <p className="skeletons__lede">
          Cada variante imita una página real. Aparecen con un retraso corto para que una carga rápida no
          parpadee.
        </p>
      </header>
      {VARIANTS.map(({ id, title }) => (
        <section key={id} className="skeletons__section">
          <h2 className="skeletons__h2">{title}</h2>
          <div className="skeletons__frame">
            <PageSkeleton variant={id} label={`Cargando ${title.toLowerCase()}`} />
          </div>
        </section>
      ))}
    </div>
  );
}
