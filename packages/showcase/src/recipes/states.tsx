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
