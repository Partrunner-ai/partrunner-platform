// Isolates the drop from Next.js entirely: renders the same Card(asChild)+Link+
// lucide-icon tree with react-dom/server's renderToPipeableStream directly.
import { createElement as h } from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import { PassThrough } from 'node:stream';
import { Card } from '@partrunner-ai/ui';
import { MapPin, Truck, Layers, Tag, Ruler, Weight, Cog, Zap, HelpCircle } from 'lucide-react';

const ICONS = [MapPin, Truck, Layers, Tag, Ruler, Weight, Cog, Zap, HelpCircle];
const TONES = ['neutral', 'yellow', 'blue', 'amber', 'purple', 'green', 'rose'];

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

let i = 0;
const useAsChild = process.env.REPRO_ASCHILD !== '0';

function Page() {
  const groups = Object.keys(GROUPS);
  return h(
    'div',
    null,
    groups.map((group) =>
      h(
        'section',
        { key: group },
        h('h2', null, group),
        h(
          'div',
          { className: 'grid' },
          GROUPS[group].map((slug) => {
            const Icon = ICONS[i % ICONS.length];
            const tone = TONES[i % TONES.length];
            i += 1;
            return h(
              Card,
              { key: slug, asChild: useAsChild, tone, gradient: true, interactive: true, padding: 'lg' },
              h(
                'a',
                { href: `/configuracion/${slug}`, className: 'group block' },
                h(
                  'div',
                  { className: 'mb-3 flex size-11 items-center justify-center' },
                  h(Icon, { className: 'size-5', strokeWidth: 2.25 }),
                ),
                h('h3', null, slug),
                h('p', { 'data-slug': slug }, `card for ${slug}`),
              ),
            );
          }),
        ),
      ),
    ),
  );
}

const totalExpected = Object.values(GROUPS).reduce((n, l) => n + l.length, 0);

const chunks = [];
const passthrough = new PassThrough();
passthrough.on('data', (c) => chunks.push(c));
passthrough.on('end', () => {
  const html = Buffer.concat(chunks).toString('utf8');
  const cardCount = (html.match(/class="pr-card/g) || []).length;
  const slugCount = new Set((html.match(/data-slug="[a-z0-9-]*"/g) || [])).size;
  console.log(`asChild=${useAsChild} expected=${totalExpected} pr-card-count=${cardCount} unique-slugs=${slugCount}`);
  if (slugCount < totalExpected) {
    const allSlugs = [];
    for (const list of Object.values(GROUPS)) allSlugs.push(...list);
    const present = new Set((html.match(/data-slug="([a-z0-9-]*)"/g) || []).map((m) => m.slice(11, -1)));
    console.log('MISSING:', allSlugs.filter((s) => !present.has(s)));
  }
});

const { pipe } = renderToPipeableStream(h(Page), {
  onAllReady() {
    pipe(passthrough);
  },
  onError(err) {
    console.error('renderToPipeableStream error:', err);
  },
});
