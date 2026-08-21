import { forwardRef, useId, type HTMLAttributes, type ReactNode } from 'react';
import { Check } from 'lucide-react';

export interface StepperStep {
  /** Visible step name. Also the accessible name of the step control. */
  label: ReactNode;
}

export interface StepperProps extends HTMLAttributes<HTMLElement> {
  steps: ReadonlyArray<StepperStep | string>;
  /** Zero-based index of the step in progress. */
  current: number;
  /**
   * Makes COMPLETED steps navigable. Only completed ones: going back is
   * revisiting an answer, going forward is skipping validation, so future
   * steps never become buttons no matter what the handler would allow.
   */
  onStepSelect?: (index: number) => void;
  /** Accessible name of the whole sequence. */
  label?: string;
  /** Announced after a completed step's name. */
  doneLabel?: string;
}

/**
 * The Crystal wizard sequence: done steps on the brand accent, the current one
 * inverted in ink, future ones ghosted. Field-proven in the onboarding
 * prototype, where every app had grown its own copy.
 *
 * Labels collapse on narrow viewports (CSS), so the dots alone must carry the
 * sequence — which is why each dot keeps its number or check glyph.
 */
export const Stepper = forwardRef<HTMLElement, StepperProps>(function Stepper(
  {
    steps,
    current,
    onStepSelect,
    label = 'Progreso',
    doneLabel = 'completado',
    className,
    ...rest
  },
  ref,
) {
  const baseId = useId();
  return (
    <nav
      ref={ref}
      aria-label={label}
      className={['pr-stepper', className].filter(Boolean).join(' ')}
      {...rest}
    >
      <ol className="pr-stepper__list">
        {steps.map((step, index) => {
          const stepLabel = typeof step === 'string' ? step : step.label;
          const state = index < current ? 'done' : index === current ? 'current' : 'future';
          const clickable = state === 'done' && onStepSelect !== undefined;
          const labelId = `${baseId}-step-${index}`;
          const dotContent =
            state === 'done' ? <Check size={14} aria-hidden /> : <span aria-hidden>{index + 1}</span>;
          return (
            <li
              key={index}
              className={`pr-stepper__step pr-stepper__step--${state}`}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              {clickable ? (
                /* Named by the label span, so a screen reader hears the step
                   once ("Cuenta, completado, botón"), not twice. */
                <button
                  type="button"
                  className="pr-stepper__dot"
                  aria-labelledby={labelId}
                  onClick={() => onStepSelect(index)}
                >
                  {dotContent}
                </button>
              ) : (
                <span className="pr-stepper__dot">{dotContent}</span>
              )}
              {/* The label never leaves the accessibility tree: below 640px the
                  CSS collapses it to visually-hidden, not display:none, so the
                  mobile dots still announce their step names. */}
              <span id={labelId} className="pr-stepper__label">
                {stepLabel}
                {state === 'done' && <span className="pr-visually-hidden">, {doneLabel}</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
});

export interface ProgressDotsProps extends HTMLAttributes<HTMLDivElement> {
  count: number;
  /** Zero-based index of the step in progress. */
  current: number;
  /** Accessible summary; receives 1-based position. */
  label?: (current: number, count: number) => string;
}

/**
 * The mobile counterpart of `Stepper`: no labels, the active step stretched
 * into a pill. One image to assistive tech — announcing six unlabeled dots
 * one by one says less than "Paso 2 de 6" does.
 */
export const ProgressDots = forwardRef<HTMLDivElement, ProgressDotsProps>(function ProgressDots(
  { count, current, label = (step, total) => `Paso ${step} de ${total}`, className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      role="img"
      aria-label={label(current + 1, count)}
      className={['pr-progress-dots', className].filter(Boolean).join(' ')}
      {...rest}
    >
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className={[
            'pr-progress-dots__dot',
            index < current ? 'pr-progress-dots__dot--done' : null,
            index === current ? 'pr-progress-dots__dot--current' : null,
          ]
            .filter(Boolean)
            .join(' ')}
        />
      ))}
    </div>
  );
});
