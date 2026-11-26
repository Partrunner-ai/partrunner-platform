import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { Label, SegmentedControl } from '@partrunner-ai/ui';
import { FormRecipe } from './FormRecipe';
import { InboxRecipe } from './InboxRecipe';
import { ListPageRecipe } from './ListPageRecipe';
import { RecordPageRecipe } from './RecordPageRecipe';
import { WorkQueueRecipe } from './WorkQueueRecipe';
import { STATE_OPTIONS, type RecipeProps, type RecipeState } from './states';
import './recipes.css';

type RecipeId = 'list' | 'inbox' | 'record' | 'form' | 'queue';

const RECIPES: Array<{ value: RecipeId; label: string; Component: ComponentType<RecipeProps> }> = [
  { value: 'list', label: 'Lista', Component: ListPageRecipe },
  { value: 'inbox', label: 'Bandeja', Component: InboxRecipe },
  { value: 'record', label: 'Ficha', Component: RecordPageRecipe },
  { value: 'form', label: 'Formulario', Component: FormRecipe },
  { value: 'queue', label: 'Cola', Component: WorkQueueRecipe },
];

const STATES = STATE_OPTIONS.map((option) => option.value);

/** Reads `#recipes/<recipe>[/<state>]`. */
function readHash(): { recipe: RecipeId; state: RecipeState } {
  const [, recipe, state] = (typeof window === 'undefined' ? '' : window.location.hash.slice(1)).split('/');
  return {
    recipe: RECIPES.some((item) => item.value === recipe) ? (recipe as RecipeId) : 'list',
    state: STATES.includes(state as RecipeState) ? (state as RecipeState) : 'data',
  };
}

export function RecipesDemo() {
  const [{ recipe, state }, setSelection] = useState(readHash);
  const [attempt, setAttempt] = useState(0);
  const retryTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.history.replaceState(null, '', `#recipes/${recipe}${state === 'data' ? '' : `/${state}`}`);
  }, [recipe, state]);

  useEffect(() => () => window.clearTimeout(retryTimer.current), []);

  const onRetry = useCallback(() => {
    setSelection((current) => ({ ...current, state: 'loading' }));
    window.clearTimeout(retryTimer.current);
    retryTimer.current = window.setTimeout(() => {
      setSelection((current) => ({ ...current, state: 'data' }));
    }, 700);
  }, []);

  const Active = RECIPES.find((item) => item.value === recipe)?.Component ?? ListPageRecipe;

  return (
    <div>
      <div className="recipes-bar">
        <div className="recipes-bar__group recipes-bar__scroll">
          <SegmentedControl<RecipeId>
            aria-label="Receta"
            value={recipe}
            onChange={(next) => {
              setSelection({ recipe: next, state: 'data' });
              setAttempt((value) => value + 1);
            }}
            options={RECIPES.map(({ value, label }) => ({ value, label }))}
          />
        </div>
        <div className="recipes-bar__group">
          <Label id="recipes-state-label">Estado</Label>
          <div className="recipes-bar__scroll">
            <SegmentedControl<RecipeState>
              aria-labelledby="recipes-state-label"
              value={state}
              onChange={(next) => setSelection((current) => ({ ...current, state: next }))}
              options={STATE_OPTIONS}
            />
          </div>
        </div>
      </div>
      <Active key={`${recipe}-${attempt}`} state={state} onRetry={onRetry} />
    </div>
  );
}
