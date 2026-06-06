'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Application } from '@/lib/api';

interface Props {
  app: Application;
  onClick: (app: Application) => void;
}

export function isFollowUpDue(a: Application): boolean {
  if (a.stage !== 'applied') return false;
  if (a.followUpSentAt) return false;
  const days = (Date.now() - new Date(a.submittedAt).getTime()) / 86_400_000;
  return days > 3;
}

function daysAgo(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d <= 0) return 'today';
  if (d === 1) return '1 day ago';
  return `${d} days ago`;
}

export default function ApplicationCard({ app, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: app.id });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const due = isFollowUpDue(app);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`kanban-card ${isDragging ? 'dragging' : ''}`}
      onClick={(e) => {
        // dnd-kit attaches its own listeners — only treat plain clicks (no drag)
        // as "open drawer". `transform` is null when not dragging.
        if (isDragging) return;
        e.preventDefault();
        onClick(app);
      }}
      {...attributes}
      {...listeners}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
        {app.job.ycBatch && (
          <span style={{
            fontSize: 9,
            fontWeight: 700,
            padding: '1px 6px',
            background: 'rgba(251,191,36,0.18)',
            color: '#b45309',
            borderRadius: 5,
            letterSpacing: 0.4,
          }}>YC {app.job.ycBatch}</span>
        )}
        {due && <span className="followup-badge">⏰ Follow-up due</span>}
        {app.interviewDate && (
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            padding: '1px 6px',
            background: 'var(--brand-100)',
            color: 'var(--brand-800)',
            borderRadius: 5,
          }}>
            📅 {new Date(app.interviewDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.25, marginBottom: 2 }}>
        {app.job.title}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
        {app.job.company}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 6, display: 'flex', gap: 6 }}>
        <span>{daysAgo(app.submittedAt)}</span>
        {app.resume && <span>· {app.resume.name}</span>}
      </div>
      {app.notes && (
        <div style={{
          marginTop: 6,
          fontSize: 11,
          color: 'var(--text-secondary)',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}>{app.notes}</div>
      )}
    </div>
  );
}
