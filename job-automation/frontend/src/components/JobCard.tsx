'use client';

import Link from 'next/link';
import ScoreCircle from './ScoreCircle';
import type { JobListItem } from '@/lib/api';

interface Props {
  job: JobListItem;
  onSave?: (id: string) => void;
  onHide?: (id: string) => void;
  onApply?: (id: string) => void;
}

function timeAgo(iso?: string | null): string {
  if (!iso) return 'recent';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

function logoChar(company: string): string {
  return (company?.[0] ?? '?').toUpperCase();
}

function scoreLabel(score: number): string {
  if (score >= 85) return 'GREAT MATCH';
  if (score >= 70) return 'GOOD MATCH';
  if (score >= 55) return 'FAIR MATCH';
  return 'WEAK MATCH';
}

export default function JobCard({ job, onSave, onHide, onApply }: Props) {
  const score = job.relevanceScore ?? 0;
  const remoteTag = job.isRemote;
  return (
    <div className="job-card">
      {/* Logo */}
      <div className="job-card-logo" aria-hidden>
        {logoChar(job.company)}
      </div>

      {/* Body */}
      <div className="job-card-body">
        <div className="job-card-meta-row">
          <span className="job-card-time">{timeAgo(job.postedAt ?? job.scrapedAt)}</span>
          {remoteTag && <span className="job-card-tag">Remote</span>}
          {job.ycBatch && <span className="job-card-tag">YC {job.ycBatch}</span>}
          {job.tags?.slice(0, 2).map((t) => (
            <span key={t} className="job-card-tag">{t}</span>
          ))}
        </div>
        <Link
          href={`/jobs/${job.id}`}
          className="job-card-title"
          style={{ textDecoration: 'none' }}
        >
          {job.title}
        </Link>
        <div className="job-card-company">
          <span className="job-card-company-name">{job.company}</span>
          {job.role && <> &nbsp;/&nbsp; {job.role}</>}
        </div>
        <div className="job-card-facts">
          {job.location && (
            <span className="job-card-fact">
              <span className="job-card-fact-icon">📍</span>{job.location}
            </span>
          )}
          {job.salary && (
            <span className="job-card-fact">
              <span className="job-card-fact-icon">💰</span>{job.salary}
            </span>
          )}
          {job.equity && (
            <span className="job-card-fact">
              <span className="job-card-fact-icon">📈</span>{job.equity}
            </span>
          )}
          {job.yearsExp && (
            <span className="job-card-fact">
              <span className="job-card-fact-icon">⏱</span>{job.yearsExp}
            </span>
          )}
        </div>
        <div className="job-card-actions">
          <button
            className="job-card-icon-btn"
            title="Hide"
            onClick={() => onHide?.(job.id)}
          >🚫</button>
          <button
            className="job-card-icon-btn"
            title="Save"
            onClick={() => onSave?.(job.id)}
          >♡</button>
          <Link
            href={`/jobs/${job.id}`}
            className="btn btn-ghost"
            style={{ padding: '6px 12px', fontSize: '12px', borderRadius: 'var(--radius-pill)' }}
          >✨ Ask Orion</Link>
          <button
            className="btn btn-primary"
            style={{ padding: '8px 14px', fontSize: '12px', borderRadius: 'var(--radius-pill)', letterSpacing: '0.4px' }}
            onClick={() => onApply?.(job.id)}
          >APPLY WITH AUTOFILL</button>
        </div>
      </div>

      {/* Score panel */}
      <div className="job-card-score">
        <ScoreCircle score={score} size={92} label="" variant="dark" />
        <div className="job-card-score-label">{scoreLabel(score)}</div>
        <div className="job-card-score-extras">
          <span>• {job.source}</span>
          {job.ycBatch && <span>✓ YC {job.ycBatch}</span>}
        </div>
      </div>
    </div>
  );
}
