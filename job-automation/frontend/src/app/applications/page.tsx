'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────
interface ApplicationJob {
  title: string;
  company: string;
  ycBatch: string | null;
  applyUrl: string;
}

interface Application {
  id: string;
  jobId: string;
  stage: string;
  coverLetter: string | null;
  notes: string | null;
  interviewDate: string | null;
  submittedAt: string;
  job: ApplicationJob;
  resume: { name: string } | null;
}

type GroupedApplications = Record<string, Application[]>;

const STAGES: { id: string; label: string; color: string; icon: string }[] = [
  { id: 'applied',      label: 'Applied',      color: '#f59e0b', icon: '📨' },
  { id: 'phone_screen', label: 'Phone Screen',  color: '#8b5cf6', icon: '📞' },
  { id: 'technical',    label: 'Technical',     color: '#22c55e', icon: '💻' },
  { id: 'offer',        label: 'Offer',         color: '#10b981', icon: '🎉' },
  { id: 'rejected',     label: 'Rejected',      color: '#ef4444', icon: '✗'  },
  { id: 'ghosted',      label: 'Ghosted',       color: '#6b7280', icon: '👻' },
];

// ── Page ───────────────────────────────────────────────────────────────────
export default function ApplicationsPage() {
  const [groups, setGroups] = useState<GroupedApplications>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Application | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.applications.list() as GroupedApplications;
      setGroups(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const total = Object.values(groups).reduce((s, arr) => s + arr.length, 0);

  async function moveCard(appId: string, toStage: string) {
    try {
      await fetch(`http://localhost:3001/api/applications/${appId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: toStage }),
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function handleDragStart(e: React.DragEvent, appId: string) {
    setDragging(appId);
    e.dataTransfer.setData('appId', appId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDrop(e: React.DragEvent, stageId: string) {
    e.preventDefault();
    const appId = e.dataTransfer.getData('appId');
    if (appId) moveCard(appId, stageId);
    setDragging(null);
  }

  return (
    <>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Applications</h1>
          <p className="page-subtitle">
            {loading ? 'Loading…' : `${total} application${total === 1 ? '' : 's'} tracked · drag cards to update stage`}
          </p>
        </div>
        <button className="btn btn-ghost" onClick={load} style={{ fontSize: '13px' }}>
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: '14px', padding: '10px 14px', borderColor: 'rgba(239,68,68,0.3)' }}>
          <span style={{ color: '#f87171', fontSize: '13px' }}>⚠ {error}</span>
        </div>
      )}

      {/* Stats bar */}
      {!loading && total > 0 && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {STAGES.map((s) => {
            const count = groups[s.id]?.length ?? 0;
            if (count === 0) return null;
            return (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '4px 10px',
                background: 'var(--surface-2)',
                border: '1px solid var(--surface-5)',
                borderRadius: '8px',
                fontSize: '12px', color: 'var(--text-secondary)',
              }}>
                <span style={{ color: s.color }}>{s.icon}</span>
                <span style={{ fontWeight: 600 }}>{count}</span>
                <span style={{ color: 'var(--text-muted)' }}>{s.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Kanban board */}
      <div style={{
        display: 'flex', gap: '12px',
        overflowX: 'auto', paddingBottom: '20px',
        minHeight: '420px',
      }}>
        {STAGES.map((stage) => {
          const cards = groups[stage.id] ?? [];
          return (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              cards={cards}
              loading={loading}
              dragging={dragging}
              onSelect={setSelected}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              onDragEnd={() => setDragging(null)}
            />
          );
        })}
      </div>

      {/* Detail drawer */}
      {selected && (
        <AppDetailModal
          app={selected}
          onClose={() => setSelected(null)}
          onStageChange={async (s) => { await moveCard(selected.id, s); setSelected(null); }}
          onSaveNotes={async (notes) => {
            await fetch(`http://localhost:3001/api/applications/${selected.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ notes }),
            });
            setSelected({ ...selected, notes });
          }}
        />
      )}
    </>
  );
}

// ── Kanban column ──────────────────────────────────────────────────────────
function KanbanColumn({
  stage, cards, loading, dragging,
  onSelect, onDragStart, onDrop, onDragEnd,
}: {
  stage: typeof STAGES[0];
  cards: Application[];
  loading: boolean;
  dragging: string | null;
  onSelect: (a: Application) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDrop: (e: React.DragEvent, stageId: string) => void;
  onDragEnd: () => void;
}) {
  const [over, setOver] = useState(false);

  return (
    <div
      style={{
        minWidth: '230px', width: '230px',
        background: over ? `${stage.color}08` : 'var(--surface-2)',
        borderRadius: '12px',
        border: `1px solid ${over ? stage.color + '40' : 'var(--surface-5)'}`,
        display: 'flex', flexDirection: 'column',
        transition: 'all 0.15s',
      }}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { onDrop(e, stage.id); setOver(false); }}
    >
      {/* Column header */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid var(--surface-5)',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: stage.color, flexShrink: 0,
          boxShadow: `0 0 6px ${stage.color}80`,
        }} />
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>
          {stage.label}
        </span>
        <span style={{
          fontSize: '11px', fontWeight: 600,
          color: cards.length > 0 ? stage.color : 'var(--text-muted)',
          background: cards.length > 0 ? `${stage.color}18` : 'var(--surface-4)',
          padding: '1px 7px', borderRadius: '99px',
          minWidth: '20px', textAlign: 'center',
        }}>
          {loading ? '…' : cards.length}
        </span>
      </div>

      {/* Cards */}
      <div style={{ flex: 1, padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {loading && (
          <div style={{ padding: '20px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
            Loading…
          </div>
        )}
        {!loading && cards.length === 0 && (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', color: 'var(--text-muted)',
            padding: '24px 0', textAlign: 'center',
          }}>
            Drop cards here
          </div>
        )}
        {cards.map((app) => (
          <AppCard
            key={app.id}
            app={app}
            stageColor={stage.color}
            isDragging={dragging === app.id}
            onClick={() => onSelect(app)}
            onDragStart={(e) => onDragStart(e, app.id)}
            onDragEnd={onDragEnd}
          />
        ))}
      </div>
    </div>
  );
}

// ── Application card ───────────────────────────────────────────────────────
function AppCard({ app, stageColor, isDragging, onClick, onDragStart, onDragEnd }: {
  app: Application;
  stageColor: string;
  isDragging: boolean;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const daysAgo = Math.floor((Date.now() - new Date(app.submittedAt).getTime()) / 86_400_000);

  return (
    <div
      draggable
      onClick={onClick}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{
        padding: '10px 12px',
        background: isDragging ? 'var(--surface-4)' : 'var(--surface-3)',
        border: `1px solid ${isDragging ? stageColor + '60' : 'var(--surface-5)'}`,
        borderRadius: '9px',
        cursor: 'grab',
        transition: 'all 0.12s',
        opacity: isDragging ? 0.5 : 1,
        userSelect: 'none',
      }}
    >
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '3px', lineHeight: 1.3 }}>
        {app.job.title}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
        {app.job.company}
        {app.job.ycBatch && (
          <span style={{ fontSize: '9px', background: 'rgba(251,191,36,0.15)', color: '#fbbf24', padding: '1px 4px', borderRadius: '4px', fontWeight: 600 }}>
            YC {app.job.ycBatch}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
        <span>{daysAgo === 0 ? 'Today' : `${daysAgo}d ago`}</span>
        {app.resume && <span style={{ color: 'var(--brand-400)' }}>📄 {app.resume.name}</span>}
      </div>
      {app.notes && (
        <div style={{
          marginTop: '6px', fontSize: '10px', color: 'var(--text-muted)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          paddingTop: '6px', borderTop: '1px solid var(--surface-5)',
        }}>
          📝 {app.notes}
        </div>
      )}
    </div>
  );
}

// ── Detail modal ───────────────────────────────────────────────────────────
function AppDetailModal({ app, onClose, onStageChange, onSaveNotes }: {
  app: Application;
  onClose: () => void;
  onStageChange: (stage: string) => Promise<void>;
  onSaveNotes: (notes: string) => Promise<void>;
}) {
  const [notes, setNotes] = useState(app.notes ?? '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [movingTo, setMovingTo] = useState<string | null>(null);

  async function handleStageChange(s: string) {
    setMovingTo(s);
    await onStageChange(s);
    setMovingTo(null);
  }

  async function handleSaveNotes() {
    setSavingNotes(true);
    await onSaveNotes(notes);
    setSavingNotes(false);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" style={{ maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {app.job.title}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px', display: 'flex', gap: '8px' }}>
              <span>{app.job.company}</span>
              {app.job.ycBatch && <span style={{ color: '#fbbf24' }}>YC {app.job.ycBatch}</span>}
              <span>· Applied {new Date(app.submittedAt).toLocaleDateString()}</span>
            </div>
          </div>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: '4px 10px', fontSize: '16px' }}>✕</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Stage picker */}
          <div>
            <label className="field-label">Move to stage</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
              {STAGES.map((s) => (
                <button
                  key={s.id}
                  disabled={movingTo !== null || app.stage === s.id}
                  onClick={() => handleStageChange(s.id)}
                  style={{
                    padding: '5px 12px', fontSize: '11px', fontWeight: 600,
                    borderRadius: '7px', border: `1px solid ${app.stage === s.id ? s.color : 'var(--surface-5)'}`,
                    background: app.stage === s.id ? `${s.color}18` : 'var(--surface-3)',
                    color: app.stage === s.id ? s.color : 'var(--text-muted)',
                    cursor: app.stage === s.id ? 'default' : 'pointer',
                    transition: 'all 0.12s',
                    opacity: movingTo && movingTo !== s.id ? 0.5 : 1,
                  }}
                >
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Resume */}
          {app.resume && (
            <div style={{
              padding: '10px 14px',
              background: 'var(--surface-2)', border: '1px solid var(--surface-5)', borderRadius: '8px',
              fontSize: '12px', color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <span style={{ fontSize: '16px' }}>📄</span>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Resume used</div>
                <div style={{ color: 'var(--text-muted)' }}>{app.resume.name}</div>
              </div>
            </div>
          )}

          {/* Cover letter preview */}
          {app.coverLetter && (
            <div>
              <label className="field-label">Cover letter</label>
              <div style={{
                padding: '12px 14px', marginTop: '6px',
                background: 'var(--surface-2)', border: '1px solid var(--surface-5)', borderRadius: '8px',
                fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.7,
                maxHeight: '160px', overflowY: 'auto',
                whiteSpace: 'pre-wrap',
              }}>
                {app.coverLetter}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="field-label">Notes</label>
            <textarea
              className="textarea-base"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this application, interview feedback, etc."
              style={{ marginTop: '6px' }}
            />
          </div>

          {/* Apply URL */}
          <a
            href={app.job.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '12px', color: 'var(--brand-400)', textDecoration: 'none' }}
          >
            ↗ View original job posting
          </a>
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button
            className="btn btn-primary"
            disabled={savingNotes}
            onClick={handleSaveNotes}
            style={{ minWidth: '110px' }}
          >
            {savingNotes ? 'Saving…' : '✓ Save Notes'}
          </button>
        </div>
      </div>
    </div>
  );
}
