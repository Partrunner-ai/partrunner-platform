import { createRef } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Page } from './Page';

describe('Page', () => {
  it('renders the default width with no modifier class', () => {
    const { container } = render(<Page>content</Page>);
    const page = container.querySelector('.pr-page')!;
    expect(page.className).toBe('pr-page');
    expect(page.textContent).toBe('content');
  });

  it('adds one modifier per non-default width', () => {
    for (const width of ['narrow', 'wide', 'full'] as const) {
      const { container } = render(<Page width={width} />);
      expect(container.querySelector('.pr-page')?.className).toBe(`pr-page pr-page--${width}`);
    }
  });

  it('forwards its ref, class and rest props to the div', () => {
    const ref = createRef<HTMLDivElement>();
    render(<Page ref={ref} className="extra" id="main-page" aria-label="Colocadas" />);
    expect(ref.current?.tagName).toBe('DIV');
    expect(ref.current?.id).toBe('main-page');
    expect(ref.current?.className).toBe('pr-page extra');
    expect(ref.current?.getAttribute('aria-label')).toBe('Colocadas');
  });
});
