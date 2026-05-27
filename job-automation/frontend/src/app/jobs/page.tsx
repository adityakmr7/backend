'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, type JobListItem } from '@/lib/api';

// ── Filter config ──────────────────────────────────────────────────────────
const STATUS_FILTERS = [
  { id: 'all',     label: 'All',     status: undefined  },
  { id: 'new',     label: 'New',     status: 'new'      },
  { id: 'saved',   label: 'Saved',   status: 'saved'    },
  { id: 'applied', label: 'Applied', status: 'applied'  },
] as const;

type FilterId = (typeof STATUS_FILTERS)[number]['id'];

// ── Page ───────────────────────────────────────────────────────────────────
export default function JobsPage() {
  const [filter, setFilter]   = useState<FilterId>('all');
  const [search, setSearch]   = useState('');
  const [remote, setRemote]   = useState(false);
  const [jobs, setJobs]       = useState<JobListItem[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [toast, setToast]     = useState<string | null>(null);
  const [scrapeOpts, setScrapeOpts] = useState(false);
  const [maxJobs, setMaxJobs] = useState(100);
  const [fetchDetail, setFetchDetail] = useState(true);
  const scrapeRef = useRef<HTMLDivElement>(null);

  const activeStatus = useMemo(
    () => STATUS_FILTERS.find((f) => f.id === filter)?.status,
    [filter]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number | boolean> = { limit: 200 };
      if (activeStatus) params.status = activeStatus;
      if (remote) params.remote = true;
      const res = await api.jobs.list(params);
      setJobs(res.jobs);
      setTotal(res.total);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [activeStatus, remote]);

  useEffect(() => { load(); }, [load]);

  // Close scrape options on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (scrapeRef.current && !scrapeRef.current.contains(e.target as Node)) {
        setScrapeOpts(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function runScrape() {
    setScraping(true);
    setToast(null);
    setScrapeOpts(false);
    try {
      const res = await api.jobs.scrape({
        sources: ['waas'],
        maxJobs,
        fetchDetail,
        useResumeScoring: true,
      } as Parameters<typeof api.jobs.scrape>[0]);
      setToast(res.message);
      await load();
    } catch (e) {
      setToast(`Scrape failed: ${(e as Error).message}`);
    } finally {
      setScraping(false);
    }
  }

  // Client-side search filter
  const filtered = useMemo(() => {
    if (!search.trim()) return jobs;
    const q = search.toLowerCase();
    return jobs.filter(
      (j) =>
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.tags.some((t) => t.toLowerCase().includes(q)) ||
        (j.role ?? '').toLowerCase().includes(q)
    );
  }, [jobs, search]);

  return (
    <>
      {/* ── Header ── */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Jobs</h1>
          <p className="page-subtitle">YC-backed company roles from workatastartup.com</p>
        </div>

        {/* Scrape button + options */}
        <div style={{ position: 'relative' }} ref={scrapeRef}>
          <div style={{ display: 'flex', gap: '1px' }}>
            <button
              className="btn btn-primary"
              onClick={runScrape}
              disabled={scraping}
              style={{ borderRadius: '8px 0 0 8px', paddingRight: '14px' }}
            >
              {scraping ? '⏳ Scraping…' : '↻ Run Scrape'}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setScrapeOpts((v) => !v)}
              disabled={scraping}
              style={{ borderRadius: '0 8px 8px 0', padding: '0 10px', borderLeft: '1px solid rgba(255,255,255,0.15)' }}
              title="Scrape options"
            >▾</button>
          </div>

          {scrapeOpts && (
            <div style={{
              position: 'absolute', right: 0, top: 'calc(100% + 6px)',
              background: 'var(--surface-3)', border: '1px solid var(--surface-5)',
              borderRadius: '10px', padding: '14px 16px', zIndex: 50,
              minWidth: '240px', boxShadow: 'var(--shadow-md)',
              display: 'flex', flexDirection: 'column', gap: '12px',
            }}>
              <div>
                <label className="field-label">Max jobs</label>
                <input
                  type="number" className="input-base"
                  value={maxJobs} min={10} max={500} step={10}
                  onChange={(e) => setMaxJobs(Number(e.target.value))}
                  style={{ marginTop: '4px' }}
                />
              </div>
              <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input
                  type="checkbox" checked={fetchDetail}
                  onChange={(e) => setFetchDetail(e.target.checked)}
                  style={{ accentColor: 'var(--brand-500)' }}
                />
                Fetch rich details (equity, skills, visa)
              </label>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {fetchDetail ? '~slower, more data per job' : '~fast, listing data only'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="card" style={{
          marginBottom: '12px', padding: '10px 14px',
          background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.25)',
          fontSize: '13px', color: '#10b981',
        }}>
          ✓ {toast}
        </div>
      )}

      {/* ── Filter bar ── */}
      <div className="card" style={{ marginBottom: '14px', padding: '12px 14px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search */}
          <input
            className="input-base"
            type="search"
            placeholder="Search title, company, skill…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '220px', fontSize: '12px', padding: '6px 10px' }}
          />

          <div style={{ width: '1px', height: '20px', background: 'var(--surface-5)', flexShrink: 0 }} />

          {/* Status filters */}
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              id={`filter-${f.id}`}
              className="btn btn-ghost"
              onClick={() => setFilter(f.id)}
              style={{
                padding: '5px 11px', fontSize: '12px',
                ...(filter === f.id
                  ? { background: 'var(--surface-4)', color: 'var(--text-primary)', borderColor: 'var(--brand-500)' }
                  : {}),
              }}
            >
              {f.label}
            </button>
          ))}

          {/* Remote toggle */}
          <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer', marginLeft: '2px' }}>
            <input
              type="checkbox"
              checked={remote}
              onChange={(e) => setRemote(e.target.checked)}
              style={{ accentColor: 'var(--brand-500)' }}
            />
            Remote only
          </label>

          {/* Count */}
          <div style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>
            {loading ? 'Loading…' : `${filtered.length}${filtered.length < total ? ` of ${total}` : ''} jobs`}
          </div>
        </div>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: '14px', padding: '10px 14px', borderColor: 'rgba(239,68,68,0.3)' }}>
          <span style={{ color: '#f87171', fontSize: '13px' }}>⚠ {error}</span>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && filtered.length === 0 && !error && (
        <div className="card">
          <div className="empty-state" style={{ padding: '48px 32px' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.4 }}>🔍</div>
            <div className="empty-title">
              {search ? 'No matches for that search' : 'No jobs yet'}
            </div>
            <div className="empty-sub">
              {search
                ? 'Try a different keyword or clear the search'
                : 'Click Run Scrape to fetch fresh YC company jobs'}
            </div>
            {!search && (
              <button
                id="jobs-empty-scrape-btn"
                className="btn btn-primary"
                style={{ marginTop: '16px' }}
                onClick={runScrape}
                disabled={scraping}
              >
                {scraping ? '⏳ Scraping…' : '↻ Run First Scrape'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Job list ── */}
      {filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </>
  );
}

// ── Job card ───────────────────────────────────────────────────────────────
function JobCard({ job }: { job: JobListItem }) {
  const hasCompInfo = job.salary || job.equity || job.role || job.yearsExp;
  const daysAgo = job.postedAt
    ? Math.floor((Date.now() - new Date(job.postedAt).getTime()) / 86_400_000)
    : null;

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="card"
      style={{ display: 'block', textDecoration: 'none', color: 'inherit', padding: '14px 16px', transition: 'border-color 0.12s' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
            <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
              {job.title}
            </div>
            {job.isRemote && (
              <span style={{
                fontSize: '9px', fontWeight: 700, padding: '2px 5px',
                background: 'rgba(16,185,129,0.12)', color: '#10b981',
                borderRadius: '5px', flexShrink: 0,
              }}>REMOTE</span>
            )}
          </div>

          {/* Company row */}
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 500 }}>{job.company}</span>
            {job.ycBatch && (
              <span style={{
                fontSize: '9px', fontWeight: 700, padding: '1px 5px',
                background: 'rgba(251,191,36,0.12)', color: '#fbbf24', borderRadius: '4px',
              }}>YC {job.ycBatch}</span>
            )}
            {job.location && (
              <span style={{ color: 'var(--text-muted)' }}>· {job.location}</span>
            )}
            {daysAgo !== null && (
              <span style={{ color: 'var(--text-muted)' }}>
                · {daysAgo === 0 ? 'Today' : `${daysAgo}d ago`}
              </span>
            )}
          </div>

          {/* Comp facts */}
          {hasCompInfo && (
            <div style={{ marginTop: '7px', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {job.salary   && <span>💰 {job.salary}</span>}
              {job.equity   && <span>📈 {job.equity}</span>}
              {job.role     && <span>🛠 {job.role}</span>}
              {job.yearsExp && <span>⏱ {job.yearsExp}</span>}
            </div>
          )}
        </div>

        {/* Right col */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
          <span className={`badge badge-${job.status}`}>{job.status}</span>
          {job.relevanceScore != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{
                width: '50px', height: '4px', borderRadius: '99px',
                background: 'var(--surface-4)', overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', width: `${job.relevanceScore}%`,
                  background: job.relevanceScore >= 70 ? '#10b981' : job.relevanceScore >= 50 ? '#f59e0b' : '#ef4444',
                  borderRadius: '99px',
                }} />
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {Math.round(job.relevanceScore)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tags */}
      {job.tags.length > 0 && (
        <div style={{ marginTop: '9px', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          {job.tags.slice(0, 7).map((t) => (
            <span key={t} style={{
              fontSize: '10px', padding: '2px 7px',
              background: 'var(--surface-4)', color: 'var(--text-muted)',
              borderRadius: '99px',
            }}>{t}</span>
          ))}
          {job.tags.length > 7 && (
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>+{job.tags.length - 7}</span>
          )}
        </div>
      )}
    </Link>
  );
}
