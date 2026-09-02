import { forwardRef, type HTMLAttributes } from 'react';

/** Max content width: 768, 1280, 1536px, or none. */
export type PageWidth = 'narrow' | 'default' | 'wide' | 'full';

export interface PageProps extends HTMLAttributes<HTMLDivElement> {
  width?: PageWidth;
}

/**
 * The page container: Crystal rhythm (16 → 24 → 32px padding), centred and capped,
 * with a 24px vertical stack between its children. Every screen starts here so
 * width and outer padding stop being decided per file.
 */
export const Page = forwardRef<HTMLDivElement, PageProps>(function Page(
  { width = 'default', className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      {...rest}
      data-slot="page"
      className={['pr-page', width === 'default' ? null : `pr-page--${width}`, className]
        .filter(Boolean)
        .join(' ')}
    />
  );
});
