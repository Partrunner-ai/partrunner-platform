import { useState } from 'react';
import { Badge } from '@partrunner-ai/ui';
import { ThemeToggle } from '@partrunner-ai/shell';
import {
  ShellDarkCatalog,
  ShellLightCatalog,
  UiDarkCatalog,
  UiLightCatalog,
} from '../../ui/e2e/component-gallery.story';
import { BrandMarkDemo } from './BrandMarkDemo';
import './review.css';

export type ReviewView = 'components' | 'shell' | 'brand';
export type ReviewTheme = 'light' | 'dark';

const VIEWS: Array<{ id: ReviewView; label: string }> = [
  { id: 'components', label: 'Components' },
  { id: 'shell', label: 'App shell' },
  { id: 'brand', label: 'Brand mark' },
];

function viewFromHash(): ReviewView {
  if (typeof window === 'undefined') return 'components';
  const candidate = window.location.hash.slice(1);
  return VIEWS.some(({ id }) => id === candidate)
    ? (candidate as ReviewView)
    : 'components';
}

function ShowcaseToolbar({
  view,
  theme,
  onViewChange,
  onThemeChange,
}: {
  view: ReviewView;
  theme: ReviewTheme;
  onViewChange: (view: ReviewView) => void;
  onThemeChange: (theme: ReviewTheme) => void;
}) {
  return (
    <header className="review-toolbar">
      <a
        className="review-toolbar__brand"
        href="#components"
        onClick={() => onViewChange('components')}
      >
        <span className="review-toolbar__mark" aria-hidden>
          PR
        </span>
        <span>
          <strong>PartRunner platform</strong>
          <small>Public package catalog</small>
        </span>
      </a>
      <nav className="review-toolbar__nav" aria-label="Showcase views">
        {VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="review-toolbar__tab"
            data-active={view === item.id}
            aria-pressed={view === item.id}
            onClick={() => onViewChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="review-toolbar__end">
        <ThemeToggle
          theme={theme}
          allowSystem={false}
          applyToDocument
          onThemeChange={(nextTheme) => {
            if (nextTheme !== 'system') onThemeChange(nextTheme);
          }}
        />
        <Badge tone="info" dot>
          Local showcase
        </Badge>
      </div>
    </header>
  );
}

export function ReleaseReviewApp({
  initialView,
  initialTheme = 'light',
}: {
  initialView?: ReviewView;
  initialTheme?: ReviewTheme;
}) {
  const [view, setView] = useState<ReviewView>(
    () => initialView ?? viewFromHash(),
  );
  const [theme, setTheme] = useState<ReviewTheme>(initialTheme);

  const selectView = (nextView: ReviewView) => {
    setView(nextView);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${nextView}`);
    }
  };

  return (
    <div className="review-app">
      <ShowcaseToolbar
        view={view}
        theme={theme}
        onViewChange={selectView}
        onThemeChange={setTheme}
      />
      <div className="review-app__stage">
        {view === 'components' && theme === 'light' ? <UiLightCatalog /> : null}
        {view === 'components' && theme === 'dark' ? <UiDarkCatalog /> : null}
        {view === 'shell' && theme === 'light' ? <ShellLightCatalog /> : null}
        {view === 'shell' && theme === 'dark' ? <ShellDarkCatalog /> : null}
        {view === 'brand' ? <BrandMarkDemo /> : null}
      </div>
    </div>
  );
}
