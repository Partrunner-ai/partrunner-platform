import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

export interface ValidationSummaryError {
  fieldId: string;
  label: ReactNode;
  message: ReactNode;
}

export interface ValidationSummaryProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  errors: readonly ValidationSummaryError[];
  title?: ReactNode;
  /** Focuses the summary after an unsuccessful submit. Off by default to avoid stealing focus. */
  focusOnMount?: boolean;
}

export const ValidationSummary = forwardRef<HTMLElement, ValidationSummaryProps>(
  function ValidationSummary(
    {
      errors,
      title = 'Corrige los siguientes campos',
      focusOnMount = false,
      className,
      id,
      ...rest
    },
    forwardedRef,
  ) {
    const generatedId = useId();
    const summaryId = id ?? generatedId;
    const titleId = `${summaryId}-title`;
    const localRef = useRef<HTMLElement | null>(null);
    const previousErrorCount = useRef(0);

    useEffect(() => {
      if (focusOnMount && errors.length > 0 && previousErrorCount.current === 0) {
        localRef.current?.focus();
      }
      previousErrorCount.current = errors.length;
    }, [errors.length, focusOnMount]);

    if (errors.length === 0) return null;

    return (
      <section
        {...rest}
        ref={(node) => {
          localRef.current = node;
          if (typeof forwardedRef === 'function') forwardedRef(node);
          else if (forwardedRef) forwardedRef.current = node;
        }}
        id={summaryId}
        className={['pr-validation-summary', className].filter(Boolean).join(' ')}
        role="alert"
        tabIndex={-1}
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className="pr-validation-summary__title">
          {title}
        </h2>
        <ul className="pr-validation-summary__list">
          {errors.map((error, index) => (
            <li key={`${error.fieldId}-${index}`} className="pr-validation-summary__item">
              <a className="pr-validation-summary__link" href={`#${error.fieldId}`}>
                <span className="pr-validation-summary__field">{error.label}:</span>{' '}
                {error.message}
              </a>
            </li>
          ))}
        </ul>
      </section>
    );
  },
);
