'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, type JobDetail } from '@/lib/api';

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
      setJob(data);
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

  const m = job.metadata;
  const founders = m?.founders ?? [];

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
            {job.isRemote && <span style={{ marginLeft: '8px' }}>· Remote</span>}
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

      {/* Compensation / role facts */}
      {(job.salary || job.equity || job.role || job.yearsExp || job.visa || job.jobType) && (
        <div className="card" style={{ marginBottom: '16px', padding: '14px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
            {job.salary && <Fact label="Salary" value={job.salary} />}
            {job.equity && <Fact label="Equity" value={job.equity} />}
            {job.role && <Fact label="Role" value={job.role} />}
            {job.jobType && <Fact label="Type" value={job.jobType} />}
            {job.yearsExp && <Fact label="Experience" value={job.yearsExp} />}
            {job.visa && <Fact label="Visa" value={job.visa} />}
          </div>
        </div>
      )}

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

      {/* Company panel */}
      {m && (
        <div className="card" style={{ marginTop: '16px' }}>
          <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '12px', color: 'var(--text-primary)' }}>
            About {job.company}
          </div>
          {m.short_description && (
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              {m.short_description}
            </div>
          )}
          {m.long_description && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.6 }}>
              {m.long_description}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
            {m.stage && <Fact label="Stage" value={m.stage} />}
            {m.industry && <Fact label="Industry" value={m.industry} />}
            {m.team_size && <Fact label="Team size" value={m.team_size} />}
            {m.year_founded && <Fact label="Founded" value={m.year_founded} />}
            {m.company_location && <Fact label="HQ" value={m.company_location} />}
          </div>
          {(m.website || m.company_linkedin || m.company_x || m.company_github) && (
            <div style={{ marginTop: '14px', display: 'flex', gap: '12px', fontSize: '12px' }}>
              {m.website && <ExtLink href={m.website} label="Website" />}
              {m.company_linkedin && <ExtLink href={m.company_linkedin} label="LinkedIn" />}
              {m.company_x && <ExtLink href={m.company_x} label="X" />}
              {m.company_github && <ExtLink href={m.company_github} label="GitHub" />}
            </div>
          )}
        </div>
      )}

      {/* Founders */}
      {founders.length > 0 && (
        <div className="card" style={{ marginTop: '16px' }}>
          <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '12px', color: 'var(--text-primary)' }}>
            Founders
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {founders.map((f, i) => (
              <div key={i} style={{ padding: '12px', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '6px' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{f.name}</div>
                    {f.title && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{f.title}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: '10px', fontSize: '11px' }}>
                    {f.linkedin && <ExtLink href={f.linkedin} label="in" />}
                    {f.x && <ExtLink href={f.x} label="X" />}
                  </div>
                </div>
                {f.bio && (
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {f.bio}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>
        {label}
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

function ExtLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: 'var(--brand-300)', textDecoration: 'none' }}
    >
      {label} ↗
    </a>
  );
}
