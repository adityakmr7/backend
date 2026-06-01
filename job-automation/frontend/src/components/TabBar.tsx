'use client';

export interface TabItem {
  id: string;
  label: string;
  count?: number | null;
}

interface Props {
  tabs: readonly TabItem[];
  active: string;
  onChange: (id: string) => void;
}

export default function TabBar({ tabs, active, onChange }: Props) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          className={`tab ${active === t.id ? 'active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {t.count != null && (
            <span className="tab-count">{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
