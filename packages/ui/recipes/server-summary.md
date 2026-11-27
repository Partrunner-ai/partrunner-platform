# Recipe: Server summary

A Server Component shows KPI tiles, an empty state and a list of linked cards, with no client code.

This is the full source of a screen that compiles and is tested. Copy the structure and
the props. Replace the sample data with the data of the app.

- `./fixtures` is sample data and two format helpers (`formatMoney`, `formatDate`). Use the
  app's own data and its shared format helpers.
- `./states` is in `states.md`.
- The `state` prop exists only to show each state in the catalogue. In an app, the state
  comes from the data request.
- The rules are in `../DESIGN.md`.

<!-- Generated from packages/showcase/src/recipes/ServerSummaryRecipe.tsx. Do not edit. -->

```tsx
// A Server Component: no "use client", no hooks, no event handlers.
// Card, StatTile, StatTileGrid and EmptyState come from '@partrunner-ai/ui/server'.
// There an icon is an element (`icon={<Truck />}`), not a component (`icon={Truck}`).
// Parts that get only plain props (Page, PageHeader, SectionHeading, Stack, Notice,
// Button, Skeleton) can still come from the main entry.
import { CheckCircle2, Clock, Lock, Timer, Truck } from 'lucide-react';
import { Button, Notice, Page, PageHeader, SectionHeading, Skeleton, Stack } from '@partrunner-ai/ui';
import { Card, EmptyState, StatTile, StatTileGrid } from '@partrunner-ai/ui/server';
import { PLACEMENTS, PROJECTS } from './fixtures';
import { type RecipeState } from './states';

export interface ServerSummaryRecipeProps {
  /** In an app, the state comes from the data request on the server. */
  state: RecipeState;
}

export function ServerSummaryRecipe({ state }: ServerSummaryRecipeProps) {
  const header = <PageHeader title="Resumen de colocadas" />;

  if (state === 'forbidden') {
    return (
      <Page>
        {header}
        <EmptyState
          icon={<Lock />}
          title="No tienes acceso a esta sección"
          description="Solo Operaciones puede verla. Pide acceso a tu administrador."
        />
      </Page>
    );
  }

  if (state === 'loading') {
    // In Next this is the route's loading.tsx or a <Suspense> fallback.
    return (
      <Page>
        {header}
        <StatTileGrid columns={4}>
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} shape="block" height={96} />
          ))}
        </StatTileGrid>
      </Page>
    );
  }

  const placements = state === 'empty' ? [] : PLACEMENTS;
  const placed = placements.filter((row) => row.status === 'placed').length;
  const pending = placements.filter((row) => row.status === 'pending').length;

  return (
    <Page>
      {header}
      {state === 'error' ? (
        <Notice
          tone="danger"
          title="No se pudo cargar el resumen"
          actions={
            // A link, not an onClick: a Server Component has no event handlers.
            <Button asChild size="sm" variant="secondary">
              <a href="?">Reintentar</a>
            </Button>
          }
        >
          Revisa tu conexión e inténtalo de nuevo. Si el problema sigue, avisa al equipo de plataforma.
        </Notice>
      ) : null}
      <StatTileGrid columns={4}>
        <StatTile label="Colocadas del mes" value={placements.length} icon={<Truck />} hint="24 nov 2026" />
        <StatTile label="Confirmadas" value={placed} icon={<CheckCircle2 />} tone="green" />
        <StatTile label="Pendientes" value={pending} icon={<Clock />} tone="amber" hint="Esperan confirmación" />
        <StatTile
          label="Tiempo promedio"
          value={placements.length === 0 ? '—' : '2.4 días'}
          icon={<Timer />}
          hint="De solicitud a colocada"
        />
      </StatTileGrid>
      <Stack gap="sm">
        <SectionHeading title="Proyectos" description="Abre un proyecto para ver sus colocadas." />
        {placements.length === 0 ? (
          <EmptyState
            icon={<Truck />}
            title="Sin colocadas este mes"
            description="Cuando se confirme una colocada, su proyecto aparece aquí."
          />
        ) : (
          PROJECTS.map((project) => (
            // `Card asChild` in a list is safe here: there is no client boundary to cross.
            <Card key={project} asChild interactive padding="sm">
              <a href={`/colocadas?proyecto=${encodeURIComponent(project)}`}>{project}</a>
            </Card>
          ))
        )}
      </Stack>
    </Page>
  );
}
```
