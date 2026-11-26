# Recipe: State helpers

The error, no-permission and no-results blocks that the recipes share.

This is the full source of a screen that compiles and is tested. Copy the structure and
the props. Replace the sample data with the data of the app.

- `./fixtures` is sample data and two format helpers (`formatMoney`, `formatDate`). Use the
  app's own data and its shared format helpers.
- `./states` is in `states.md`.
- The `state` prop exists only to show each state in the catalogue. In an app, the state
  comes from the data request.
- The rules are in `../DESIGN.md`.

<!-- Generated from packages/showcase/src/recipes/states.tsx. Do not edit. -->

```tsx
import { type ReactNode } from 'react';
import { Lock, SearchX } from 'lucide-react';
import { Button, EmptyState, Notice } from '@partrunner-ai/ui';

export type RecipeState = 'data' | 'loading' | 'empty' | 'error' | 'forbidden';

export const STATE_OPTIONS: Array<{ value: RecipeState; label: string }> = [
  { value: 'data', label: 'Datos' },
  { value: 'loading', label: 'Cargando' },
  { value: 'empty', label: 'Vacío' },
  { value: 'error', label: 'Error' },
  { value: 'forbidden', label: 'Sin permiso' },
];

export interface RecipeProps {
  state: RecipeState;
  /** Called by «Reintentar» in the error state. */
  onRetry: () => void;
}

/** Error state: a danger Notice with one retry action. The page frame stays. */
export function ErrorNotice({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <Notice
      tone="danger"
      title={`No se pudo cargar ${what}`}
      actions={
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Reintentar
        </Button>
      }
    >
      Revisa tu conexión e inténtalo de nuevo. Si el problema sigue, avisa al equipo de plataforma.
    </Notice>
  );
}

/** No-permission state: no data, no tabs, no actions. Says who can see it. */
export function ForbiddenState({ who }: { who: string }) {
  return (
    <EmptyState
      icon={Lock}
      title="No tienes acceso a esta sección"
      description={`Solo ${who} puede verla. Pide acceso a tu administrador.`}
    />
  );
}

/** Empty state with an optional single action. */
export function NoResults({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return <EmptyState icon={SearchX} title={title} description={description} action={action} />;
}
```
