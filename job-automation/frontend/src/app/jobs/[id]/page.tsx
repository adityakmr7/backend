'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface JobDetail {
  id: string;
  title: string;
  company: string;
  description: string;
  applyUrl: string;
  applyMethod: string;
  location: string | null;
  isRemote: boolean;
  ycBatch: string | null;
  tags: string[];
  status: string;
  relevanceScore: number | null;
  source: string;
  postedAt: string | null;
  scrapedAt: string;
}

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.jobs.detail(id);
      setJob(data as unknown as JobDetail);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function setStatus(next: string) {
    if (!job) return;
    setUpdating(true);
    try {
      await api.jobs.updateStatus(job.id, next);
      setJob({ ...job, status: next });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return <div className="empty-state"><div className="empty-sub">Loading…</div></div>;
  }
  if (error || !job) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-icon">⚠️</div>
          <div className="empty-title">Could not load job</div>
          <div className="empty-sub">{error ?? 'Not found'}</div>
          <Link href="/jobs" className="btn btn-ghost" style={{ marginTop: '8px' }}>← Back to Jobs</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: '16px' }}>
        <Link href="/jobs" style={{ fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'none' }}>
          ← Back to Jobs
        </Link>
      </div>

      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 className="page-title">{job.title}</h1>
          <p className="page-subtitle">
            {job.company}
            {job.ycBatch && <span style={{ marginLeft: '8px' }}>· YC {job.ycBatch}</span>}
            {job.location && <span style={{ marginLeft: '8px' }}>· {job.location}</span>}
            <span style={{ marginLeft: '8px', color: 'var(--text-muted)' }}>· via {job.source}</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className={`badge badge-${job.status}`}>{job.status}</span>
          <a
            href={job.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            ↗ Apply
          </a>
        </div>
      </div>

      {/* Quick status actions */}
      <div className="card" style={{ marginBottom: '16px', padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>STATUS:</span>
          {['new', 'saved', 'applied', 'rejected'].map((s) => (
            <button
              key={s}
              className="btn btn-ghost"
              disabled={updating || job.status === s}
              onClick={() => setStatus(s)}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                ...(job.status === s
                  ? { borderColor: 'var(--brand-500)', color: 'var(--text-primary)' }
                  : {}),
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {job.tags.length > 0 && (
        <div style={{ marginBottom: '16px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {job.tags.map((t) => (
            <span
              key={t}
              style={{
                fontSize: '11px',
                padding: '3px 9px',
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

      <div className="card">
        <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '12px', color: 'var(--text-primary)' }}>
          Description
        </div>
        <div
          style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.7,
          }}
        >
          {job.description || <em style={{ color: 'var(--text-muted)' }}>No description captured.</em>}
        </div>
      </div>
    </>
  );
}
