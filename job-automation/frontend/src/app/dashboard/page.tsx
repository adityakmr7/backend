'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, type JobStats } from '@/lib/api';

interface ApplicationRecord {
  id: string;
  stage: string;
  submittedAt: string;
  job?: { title: string; company: string; ycBatch?: string | null };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<JobStats | null>(null);
  const [apps, setApps] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, byStage] = await Promise.all([
          api.jobs.stats(),
          api.applications.list(),
        ]);
        setStats(s);
        const flat = Object.values(byStage).flat() as ApplicationRecord[];
        flat.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
        setApps(flat);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const applied      = apps.length;
  const interviews   = apps.filter((a) => ['phone_screen', 'technical', 'offer'].includes(a.stage)).length;
  const responses    = apps.filter((a) => a.stage !== 'applied' && a.stage !== 'ghosted').length;
  const responseRate = applied > 0 ? Math.round((responses / applied) * 100) : null;

  const cards = [
    { label: 'Jobs Scraped',  value: stats?.total ?? '—',                sub: scrapedSub(stats),         color: 'blue'   },
    { label: 'Applied',       value: applied,                            sub: 'Applications sent',       color: 'amber'  },
    { label: 'Interviews',    value: interviews,                         sub: 'Active pipeline',         color: 'green'  },
    { label: 'Response Rate', value: responseRate != null ? `${responseRate}%` : '—', sub: 'Reply rate',  color: 'purple' },
  ];

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Good morning 👋</h1>
        <p className="page-subtitle">
          {loading ? 'Loading…' : 'Your automated job search is ready.'}
        </p>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: '16px', borderColor: 'rgba(239,68,68,0.3)' }}>
          <div style={{ color: '#f87171', fontSize: '13px' }}>
            Backend unreachable — {error}. Is <code>bun run dev</code> running on :3001?
          </div>
        </div>
      )}

      <div className="grid-4" style={{ marginBottom: '24px' }}>
        {cards.map((c) => (
          <div key={c.label} className={`stat-card ${c.color}`}>
            <div className="stat-label">{c.label}</div>
            <div className="stat-value">{c.value}</div>
            <div className="stat-sub">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ fontWeight: 600, marginBottom: '12px', color: 'var(--text-primary)' }}>
          Quick Actions
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link href="/jobs" className="btn btn-primary">⌕ Browse Jobs</Link>
          <Link href="/applications" className="btn btn-ghost">◧ View Pipeline</Link>
          <Link href="/resumes" className="btn btn-ghost">◫ Upload Resume</Link>
        </div>
      </div>

      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: '12px', color: 'var(--text-primary)' }}>
          Recent Applications
        </div>
        {apps.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px' }}>
            <div className="empty-icon">📭</div>
            <div className="empty-title">No applications yet</div>
            <div className="empty-sub">Browse jobs and apply to see your activity here</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {apps.slice(0, 6).map((a) => (
              <div
                key={a.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: 'var(--surface-2)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--surface-5)',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {a.job?.title ?? 'Job'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {a.job?.company ?? ''}
                    {a.job?.ycBatch && <span> · YC {a.job.ycBatch}</span>}
                    <span> · {new Date(a.submittedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <span className={`badge badge-${a.stage === 'applied' ? 'applied' : a.stage === 'rejected' ? 'rejected' : a.stage === 'ghosted' ? 'ghosted' : 'interview'}`}>
                  {a.stage.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function scrapedSub(stats: JobStats | null): string {
  if (!stats) return 'Run a scrape to start';
  const newCount = stats.byStatus?.new ?? 0;
  return newCount > 0 ? `${newCount} new` : 'all reviewed';
}
