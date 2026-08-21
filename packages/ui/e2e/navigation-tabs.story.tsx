import { NavigationTabs, type NavigationTabsLinkProps } from '@partrunner-ai/ui';

const ITEMS = [
  { href: '/workflow', label: 'Cases', exact: true, badge: 18 },
  { href: '/workflow/confirm', label: 'To confirm', badge: 7 },
  { href: '/workflow/send', label: 'To send', badge: 4 },
  { href: '/workflow/evidence', label: 'Evidence', badge: 2 },
  { href: '/workflow/upload', label: 'To upload', badge: 1 },
  { href: '/workflow/groups', label: 'Groups' },
  { href: '/workflow/pilot', label: 'Pilot' },
  { href: '/workflow/penalties', label: 'Penalties' },
] as const;

function PreviewLink({ href, children, ...props }: NavigationTabsLinkProps) {
  return (
    <a
      href={href}
      data-router-link=""
      onClick={(event) => event.preventDefault()}
      {...props}
    >
      {children}
    </a>
  );
}

export function NavigationTabsStory({
  mode = 'light',
  currentPath = '/workflow/send',
}: {
  mode?: 'light' | 'dark';
  currentPath?: string;
}) {
  return (
    <main
      className={mode === 'dark' ? 'dark' : undefined}
      data-testid="navigation-tabs-story"
      style={{
        minHeight: '100vh',
        padding: 16,
        background: 'var(--pr-bg)',
        color: 'var(--pr-fg)',
        fontFamily: 'var(--pr-font-body)',
      }}
    >
      <section
        aria-labelledby="workflow-heading"
        style={{
          maxWidth: 1120,
          margin: '0 auto',
          padding: 16,
          border: '1px solid var(--pr-border)',
          borderRadius: 'var(--pr-radius-lg)',
          background: 'var(--pr-surface)',
          boxShadow: 'var(--pr-shadow-card)',
        }}
      >
        <p
          style={{
            margin: '0 0 4px',
            color: 'var(--pr-fg-muted)',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          Example workflow
        </p>
        <h1 id="workflow-heading" style={{ margin: '0 0 16px', fontSize: 24 }}>
          Case flow
        </h1>
        <NavigationTabs
          aria-label="Case workflow"
          currentPath={currentPath}
          items={ITEMS}
          LinkComponent={PreviewLink}
        />
      </section>
    </main>
  );
}

export function NavigationTabsLinkPolicyStory() {
  return (
    <NavigationTabs
      aria-label="Workflow resources"
      currentPath="/workflow"
      LinkComponent={PreviewLink}
      items={[
        { href: '/workflow', label: 'Cases', exact: true },
        {
          href: '/workflow/report',
          label: 'Report',
          target: '_blank',
          rel: 'noopener',
        },
        {
          href: 'https://example.com/guide',
          label: 'External guide',
          external: true,
        },
      ]}
    />
  );
}
