'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type JobListItem, type JobStats } from '@/lib/api';
import TabBar, { type TabItem } from '@/components/TabBar';
import PillFilter from '@/components/PillFilter';
import JobCard from '@/components/JobCard';

const TABS = [
  { id: 'recommended', label: 'Recommended', filter: { status: 'new' } },
  { id: 'liked',       label: 'Liked',       filter: { status: 'saved' } },
  { id: 'applied',     label: 'Applied',     filter: { status: 'applied' } },
  { id: 'external',    label: 'External',    filter: { applyMethod: 'external' } },
] as const;

type TabId = (typeof TABS)[number]['id'];

function countForTab(id: TabId, stats: JobStats | null): number | null {
  if (!stats) return null;
  switch (id) {
    case 'recommended': return stats.byStatus?.new ?? 0;
    case 'liked':       return stats.byStatus?.saved ?? 0;
    case 'applied':     return stats.byStatus?.applied ?? 0;
    case 'external':    return stats.byApplyMethod?.external ?? 0;
  }
}

export default function JobsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('recommended');
  const [search, setSearch]       = useState('');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [jobs, setJobs]           = useState<JobListItem[]>([]);
  const [stats, setStats]         = useState<JobStats | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [busy, setBusy]           = useState<string | null>(null); // per-job id

  const filters = useMemo(() => TABS.find((t) => t.id === activeTab)!.filter, [activeTab]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number | boolean> = { limit: 100, ...filters };
      if (remoteOnly) params.remote = true;
      if (search.trim()) params.role = search.trim();
      const [list, s] = await Promise.all([
        api.jobs.list(params),
        api.jobs.stats().catch(() => null),
      ]);
      setJobs(list.jobs);
      setStats(s);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filters, remoteOnly, search]);

  useEffect(() => { load(); }, [load]);

  const tabItems: TabItem[] = TABS.map((t) => ({
    id: t.id,
    label: t.label,
    count: countForTab(t.id, stats),
  }));

  async function setStatus(id: string, status: string) {
    setBusy(id);
    try {
      await api.jobs.updateStatus(id, status);
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 260px', gap: '24px' }}>
      {/* MAIN COLUMN */}
      <div style={{ minWidth: 0 }}>
        {/* Tabs */}
        <div style={{ borderBottom: '1px solid var(--divider)', marginBottom: '20px' }}>
          <TabBar
            tabs={tabItems}
            active={activeTab}
            onChange={(id) => setActiveTab(id as TabId)}
          />
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
          <PillFilter withCaret>🌍 United States</PillFilter>
          <PillFilter withCaret>Software Engineer</PillFilter>
          <PillFilter withCaret>Senior Level</PillFilter>
          <PillFilter withCaret>Full-time</PillFilter>
          <PillFilter
            withCaret
            variant={remoteOnly ? 'strong' : 'default'}
            onClick={() => setRemoteOnly((v) => !v)}
            title="Toggle remote-only filter"
          >
            {remoteOnly ? '🌐 Remote only' : 'Onsite / Remote'}
          </PillFilter>
          <PillFilter withCaret>Date Posted</PillFilter>
          <PillFilter withCaret>Industry</PillFilter>
          <PillFilter variant="strong">🔒 Hidden Jobs</PillFilter>
          <PillFilter variant="strong">⋯ All Filters</PillFilter>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <PillFilter withCaret>❓ Recommended</PillFilter>
          </div>
        </div>

        {/* Inline search (in addition to topbar) */}
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <input
            className="input-base"
            placeholder="Filter loaded jobs by title or role…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: '320px', borderRadius: 'var(--radius-pill)', padding: '8px 16px' }}
          />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {loading ? 'Loading…' : `${jobs.length} jobs`}
          </span>
        </div>

        {error && (
          <div className="auth-error" style={{ marginBottom: '12px' }}>{error}</div>
        )}

        {/* Job cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onSave={(id) => setStatus(id, 'saved')}
              onHide={(id) => setStatus(id, 'rejected')}
              onApply={(id) => setStatus(id, 'applied')}
            />
          ))}
          {busy && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>updating…</div>}
          {!loading && jobs.length === 0 && (
            <div className="card">
              <div className="empty-state">
                <div className="empty-icon">🔍</div>
                <div className="empty-title">No jobs in this tab yet</div>
                <div className="empty-sub">
                  Try the other tabs, run a scrape from the Dashboard, or clear filters.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT RAIL */}
      <aside>
        <div className="card" style={{ padding: '16px', position: 'sticky', top: '78px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <span className="avatar-chip-bubble" style={{ width: 28, height: 28 }}>A</span>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Aditya</div>
            <span style={{
              marginLeft: 'auto',
              fontSize: '11px',
              padding: '3px 8px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--brand-100)',
              color: 'var(--brand-800)',
              fontWeight: 700,
              letterSpacing: '0.4px',
            }}>🌿 Free Plan</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '8px',
          }}>
            Your Saved Filters
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '18px' }}>＋</button>
          </div>
          <div style={{
            padding: '10px 12px',
            border: '1px solid var(--divider)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--surface-2)',
          }}>
            <span style={{ color: 'var(--brand-500)' }}>│</span>
            <div style={{ fontSize: '12px', color: 'var(--text-primary)', flex: 1 }}>
              Full Stack Engineer + 2 roles, US
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>✎</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
