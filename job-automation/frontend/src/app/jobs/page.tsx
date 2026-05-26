'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type JobListItem } from '@/lib/api';

const FILTERS = [
  { id: 'all',     label: 'All',     status: undefined  },
  { id: 'new',     label: 'New',     status: 'new'      },
  { id: 'saved',   label: 'Saved',   status: 'saved'    },
  { id: 'applied', label: 'Applied', status: 'applied'  },
] as const;

type FilterId = (typeof FILTERS)[number]['id'];

export default function JobsPage() {
  const [filter, setFilter] = useState<FilterId>('all');
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const activeStatus = useMemo(
    () => FILTERS.find((f) => f.id === filter)?.status,
    [filter]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { limit: 100 };
      if (activeStatus) params.status = activeStatus;
      const res = await api.jobs.list(params);
      setJobs(res.jobs);
      setTotal(res.total);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [activeStatus]);

  useEffect(() => { load(); }, [load]);

  async function runScrape() {
    setScraping(true);
    setToast(null);
    try {
      // YC only by default — fast (~30s) vs full sweep
      const res = await api.jobs.scrape({ sources: ['yc'], useResumeScoring: false });
      setToast(res.message);
      await load();
    } catch (e) {
      setToast(`Scrape failed: ${(e as Error).message}`);
    } finally {
      setScraping(false);
    }
  }

  return (
    <>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Jobs</h1>
          <p className="page-subtitle">Browse and apply to YC-backed company roles</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            id="jobs-scrape-btn"
            className="btn btn-primary"
            onClick={runScrape}
            disabled={scraping}
          >
            {scraping ? '⏳ Scraping…' : '↻ Run Scrape'}
          </button>
        </div>
      </div>

      {toast && (
        <div
          className="card"
          style={{
            marginBottom: '12px',
            padding: '10px 14px',
            background: 'rgba(16,185,129,0.08)',
            borderColor: 'rgba(16,185,129,0.25)',
            fontSize: '13px',
            color: 'var(--text-primary)',
          }}
        >
          {toast}
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: '16px', padding: '14px 16px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>FILTER:</span>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              id={`filter-${f.id}`}
              className="btn btn-ghost"
              onClick={() => setFilter(f.id)}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                ...(filter === f.id
                  ? { background: 'var(--surface-4)', color: 'var(--text-primary)', borderColor: 'var(--brand-500)' }
                  : {}),
              }}
            >
              {f.label}
            </button>
          ))}
          <div style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>
            {loading ? 'loading…' : `${jobs.length} of ${total} jobs`}
          </div>
        </div>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: '16px', borderColor: 'rgba(239,68,68,0.3)' }}>
          <div style={{ color: '#f87171', fontSize: '13px' }}>{error}</div>
        </div>
      )}

      {!loading && jobs.length === 0 && !error && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <div className="empty-title">No jobs yet</div>
            <div className="empty-sub">
              Click <strong>Run Scrape</strong> to fetch fresh jobs from YC companies
            </div>
            <button
              id="jobs-empty-scrape-btn"
              className="btn btn-primary"
              style={{ marginTop: '8px' }}
              onClick={runScrape}
              disabled={scraping}
            >
              {scraping ? '⏳ Scraping…' : '↻ Run First Scrape'}
            </button>
          </div>
        </div>
      )}

      {jobs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </>
  );
}

function JobCard({ job }: { job: JobListItem }) {
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="card"
      style={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        padding: '16px 18px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '4px' }}>
            {job.title}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {job.company}
            {job.ycBatch && <span style={{ marginLeft: '8px', color: 'var(--text-muted)' }}>YC {job.ycBatch}</span>}
            {job.location && <span style={{ marginLeft: '8px', color: 'var(--text-muted)' }}>· {job.location}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          <span className={`badge badge-${job.status}`}>{job.status}</span>
          {job.relevanceScore != null && (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              match {Math.round(job.relevanceScore)}
            </span>
          )}
        </div>
      </div>
      {job.tags.length > 0 && (
        <div style={{ marginTop: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {job.tags.slice(0, 6).map((t) => (
            <span
              key={t}
              style={{
                fontSize: '10px',
                padding: '2px 7px',
                background: 'var(--surface-4)',
                color: 'var(--text-secondary)',
                borderRadius: '99px',
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
