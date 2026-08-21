import { LayoutDashboard, MapPinned } from 'lucide-react';
import { BrandMark } from '@partrunner-ai/shell';
import './brand-mark.css';

function SidebarSlice({
  collapsed = false,
  label,
}: {
  collapsed?: boolean;
  label: string;
}) {
  return (
    <figure className="bm-slice">
      <figcaption className="bm-slice__label">{label}</figcaption>
      <div className="bm-slice__frame">
        <div className="pr-shell bm-slice__shell">
          <aside
            className="pr-sidebar bm-slice__sidebar"
            data-collapsed={String(collapsed)}
          >
            <div className="pr-sidebar__brand">
              <BrandMark />
              <div className="pr-sidebar__brand-copy">
                <div className="pr-sidebar__brand-name">PartRunner</div>
                <div className="pr-sidebar__brand-sub">Platform</div>
              </div>
            </div>
            <nav className="pr-nav" aria-label={`${label} navigation`}>
              <span className="pr-nav__item" data-active="true">
                <LayoutDashboard size={17} aria-hidden />
                <span className="pr-nav__item-label">Overview</span>
              </span>
              <span className="pr-nav__item">
                <MapPinned size={17} aria-hidden />
                <span className="pr-nav__item-label">Routes</span>
              </span>
            </nav>
          </aside>
        </div>
      </div>
    </figure>
  );
}

export function BrandMarkDemo() {
  return (
    <div className="bm">
      <header className="bm__head">
        <div>
          <p className="bm__eyebrow">Shell · brand mark</p>
          <h1 className="bm__title">Package-owned artwork</h1>
          <p className="bm__lede">
            The mark inherits its ink from the surrounding surface and its
            default size from <code>--pr-nav-brand-size</code>.
          </p>
        </div>
      </header>

      <section className="bm__section">
        <h2 className="bm__h2">Responsive shell states</h2>
        <div className="bm__row">
          <SidebarSlice label="Expanded" />
          <SidebarSlice label="Collapsed rail" collapsed />
        </div>
      </section>

      <section className="bm__section">
        <h2 className="bm__h2">Explicit size references</h2>
        <div className="bm__sizes">
          {[20, 24, 28, 30, 34, 40].map((size) => (
            <div className="bm__size" key={size}>
              <div className="bm__size-chip">
                <BrandMark size={size} />
              </div>
              <span>{size}px</span>
            </div>
          ))}
        </div>
      </section>

      <p className="bm__note bm__note--tight">
        Artwork is licensed under MIT. PartRunner trademark use is governed by
        the repository trademark notice.
      </p>
    </div>
  );
}
