/**
 * Page-options nav bar.
 *
 * Purpose: The reusable switcher for in-page sections. It renders as a
 *   full-width horizontal bar pinned to the top of the workspace — whenever a
 *   page has options, they live here. On small screens it scrolls horizontally.
 * Args: tabs — the options (label + optional numeric badge); active — current
 *   key; onChange — selection handler.
 */
export interface PageTab {
  key: string;
  label: string;
  badge?: number;
}

export function PageTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: PageTab[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <nav className="page-tabs" role="tablist" aria-label="Page sections">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={active === t.key}
          className={`pagetab${active === t.key ? ' pagetab--active' : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
          {t.badge !== undefined && <span className="count">{t.badge}</span>}
        </button>
      ))}
    </nav>
  );
}
