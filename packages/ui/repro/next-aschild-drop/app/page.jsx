import Link from 'next/link';
import { MapPin, Truck, Layers, Tag, Ruler, Weight, Cog, Zap, HelpCircle } from 'lucide-react';
// Swap this import to '@partrunner-ai/ui/server' to verify the fix.
import { Card } from '@partrunner-ai/ui';

const ICONS = [MapPin, Truck, Layers, Tag, Ruler, Weight, Cog, Zap, HelpCircle];
const TONES = ['neutral', 'yellow', 'blue', 'amber', 'purple', 'green', 'rose'];

// Set REPRO_ASCHILD=0 at runtime to render the same tree without asChild
// (control: this variant never drops an item).
const USE_ASCHILD = process.env.REPRO_ASCHILD !== '0';

// Mirrors nexus-portal's app/(admin)/configuracion/page.tsx structure:
// items grouped into <section> blocks, each with its own .map() — the page
// that originally exposed the bug (PMO 1f20d7ec / 143c1bdd).
const GROUPS = {
  Geografia: ['states', 'municipalities', 'countries'],
  Vehiculos: ['vehicle-types', 'vehicle-brands', 'vehicle-models', 'vehicle-fuel-types'],
  'Operacion y comercial': [
    'route-statuses', 'type-of-miles', 'quotation-status', 'type-of-need',
    'document-types', 'project-tags', 'incident-types', 'service-levels',
  ],
  Proyectos: ['type-of-projects', 'projects-status'],
  Documentos: ['document-categories'],
  'Facturacion y fiscal': [
    'tax-regimes', 'cfdi-uses', 'payment-methods', 'payment-forms', 'payment-terms', 'price-lists',
  ],
  Supply: [
    'driver-statuses', 'flotillero-statuses', 'driver-licenses', 'flotillero-types',
    'driver-document-types', 'flotillero-document-types',
  ],
};

// Must be dynamic: the original bug only reproduces on the server-rendered
// path, not a statically prerendered one.
export const dynamic = 'force-dynamic';

export default async function Page() {
  const groups = Object.keys(GROUPS);
  const total = Object.values(GROUPS).reduce((n, list) => n + list.length, 0);
  let i = 0;

  return (
    <div>
      <p id="expected-total">expected: {total}</p>
      <div>
        {groups.map((group) => (
          <section key={group}>
            <h2>{group}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {GROUPS[group].map((slug) => {
                const Icon = ICONS[i % ICONS.length];
                const tone = TONES[i % TONES.length];
                i += 1;
                return (
                  <Card key={slug} asChild={USE_ASCHILD} tone={tone} gradient interactive padding="lg">
                    <Link href={`/configuracion/${slug}`} className="group block">
                      <div className="mb-3 flex size-11 items-center justify-center rounded-crystal-md transition-transform group-hover:scale-105">
                        <Icon className="size-5" strokeWidth={2.25} />
                      </div>
                      <h3 className="font-semibold tracking-display-tight">{slug}</h3>
                      <p className="mt-1 text-sm" data-slug={slug}>
                        card for {slug}
                      </p>
                    </Link>
                  </Card>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
