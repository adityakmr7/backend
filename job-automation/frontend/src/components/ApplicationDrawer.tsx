'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  api,
  APPLICATION_STAGES,
  type Application,
  type ApplicationStage,
} from '@/lib/api';
import MarkdownPreview from './MarkdownPreview';
import { isFollowUpDue } from './ApplicationCard';

interface Props {
  app: Application;
  onChange: (next: Application) => void; // optimistic update upstream
  onClose: () => void;
  onDeleted: (id: string) => void;
}

// Local datetime → "YYYY-MM-DDTHH:mm" for <input type="datetime-local">.
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60_000);
  return local.toISOString().slice(0, 16);
}

const STAGE_LABEL: Record<ApplicationStage, string> = {
  applied: 'Applied',
  phone_screen: 'Phone Screen',
  technical: 'Technical',
  offer: 'Offer',
  rejected: 'Rejected',
  ghosted: 'Ghosted',
};

export default function ApplicationDrawer({ app, onChange, onClose, onDeleted }: Props) {
  // Local editable state (committed to server on blur / button click)
  const [notes, setNotes] = useState(app.notes ?? '');
  const [interviewLocal, setInterviewLocal] = useState(toLocalInput(app.interviewDate));
  const [stage, setStage] = useState<ApplicationStage>(app.stage);
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingInterview, setSavingInterview] = useState(false);
  const [sendingFollowUp, setSendingFollowUp] = useState(false);
  const [followUpResult, setFollowUpResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showCover, setShowCover] = useState(false);

  // If the parent swaps payloads (e.g. user opens a different card), reset.
  useEffect(() => {
    setNotes(app.notes ?? '');
    setInterviewLocal(toLocalInput(app.interviewDate));
    setStage(app.stage);
    setFollowUpResult(null);
    setError(null);
  }, [app.id, app.notes, app.interviewDate, app.stage]);

  const saveStage = useCallback(async (next: ApplicationStage) => {
    setStage(next);
    try {
      const updated = await api.applications.patch(app.id, { stage: next });
      onChange({ ...app, ...updated });
    } catch (e) {
      setError((e as Error).message);
      setStage(app.stage); // rollback
    }
  }, [app, onChange]);

  const saveNotes = useCallback(async () => {
    if ((notes ?? '') === (app.notes ?? '')) return;
    setSavingNotes(true);
    try {
      const updated = await api.applications.patch(app.id, { notes: notes || null });
      onChange({ ...app, ...updated });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingNotes(false);
    }
  }, [app, notes, onChange]);

  const saveInterview = useCallback(async () => {
    const cur = toLocalInput(app.interviewDate);
    if (interviewLocal === cur) return;
    setSavingInterview(true);
    try {
      const updated = await api.applications.patch(app.id, {
        interviewDate: interviewLocal || null,
      });
      onChange({ ...app, ...updated });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingInterview(false);
    }
  }, [app, interviewLocal, onChange]);

  async function sendFollowUp() {
    setSendingFollowUp(true);
    setFollowUpResult(null);
    try {
      const r = await api.followUp.send(app.id, app.job.applyEmail ?? undefined);
      setFollowUpResult(`✓ Sent to ${r.to}`);
      // Refetch the full app to update followUpSentAt
      const updated = await api.applications.detail(app.id);
      onChange(updated);
    } catch (e) {
      setError(`Follow-up failed: ${(e as Error).message}`);
    } finally {
      setSendingFollowUp(false);
    }
  }

  async function deleteApplication() {
    if (!confirm(`Delete application to ${app.job.company}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.applications.delete(app.id);
      onDeleted(app.id);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setDeleting(false);
    }
  }

  const due = isFollowUpDue(app);

  return (
    <>
      <div className="drawer-head">
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.6, textTransform: 'uppercase' }}>
            {app.job.company}
            {app.job.ycBatch && <> · YC {app.job.ycBatch}</>}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2, lineHeight: 1.25 }}>
            {app.job.title}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
            Applied {new Date(app.submittedAt).toLocaleDateString()}
            {app.resume && <> · {app.resume.name}</>}
          </div>
        </div>
        <button
          className="btn btn-ghost"
          onClick={onClose}
          style={{ padding: '4px 10px', fontSize: 12 }}
          aria-label="Close drawer"
        >✕</button>
      </div>

      <div className="drawer-body">
        {error && <div className="auth-error" style={{ fontSize: 12 }}>{error}</div>}

        {/* Stage */}
        <div>
          <label className="field-label">Stage</label>
          <select
            className="input-base"
            value={stage}
            onChange={(e) => saveStage(e.target.value as ApplicationStage)}
          >
            {APPLICATION_STAGES.map((s) => (
              <option key={s} value={s}>{STAGE_LABEL[s]}</option>
            ))}
          </select>
        </div>

        {/* Interview date */}
        <div>
          <label className="field-label">Interview date</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input-base"
              type="datetime-local"
              value={interviewLocal}
              onChange={(e) => setInterviewLocal(e.target.value)}
              onBlur={saveInterview}
              style={{ flex: 1 }}
            />
            {interviewLocal && (
              <button
                className="btn btn-ghost"
                onClick={() => { setInterviewLocal(''); setTimeout(saveInterview, 0); }}
                style={{ fontSize: 11 }}
                title="Clear interview date"
              >Clear</button>
            )}
          </div>
          {savingInterview && (
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>saving…</div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="field-label">Notes</label>
          <textarea
            className="textarea-base"
            rows={5}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            placeholder="Recruiter name, interview prep, links, gotchas…"
          />
          {savingNotes && (
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>saving…</div>
          )}
        </div>

        {/* Follow-up */}
        <div style={{
          padding: '12px 14px',
          background: due ? 'rgba(245,158,11,0.06)' : 'var(--surface-2)',
          border: `1px solid ${due ? 'rgba(245,158,11,0.25)' : 'var(--divider)'}`,
          borderRadius: 'var(--radius-md)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            {due ? '⏰ Follow-up due' : 'Follow-up'}
          </div>
          {app.followUpSentAt ? (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              ✓ Sent on {new Date(app.followUpSentAt).toLocaleString()}
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                {app.job.applyEmail
                  ? <>Recipient: <code style={{ fontSize: 11 }}>{app.job.applyEmail}</code></>
                  : 'No recipient email on file — set one on the job, or use the apply URL manually.'}
              </div>
              <button
                className="btn btn-primary"
                style={{ padding: '6px 12px', fontSize: 12 }}
                onClick={sendFollowUp}
                disabled={sendingFollowUp || !app.job.applyEmail}
              >
                {sendingFollowUp ? 'Sending…' : '✉ Send follow-up email'}
              </button>
              {followUpResult && (
                <div style={{ fontSize: 11, color: 'var(--brand-700)', marginTop: 6 }}>{followUpResult}</div>
              )}
            </>
          )}
        </div>

        {/* Cover letter */}
        {app.coverLetter && (
          <div>
            <button
              className="btn btn-ghost"
              onClick={() => setShowCover((v) => !v)}
              style={{ fontSize: 12, marginBottom: 6 }}
            >
              {showCover ? '▾' : '▸'} Cover letter
            </button>
            {showCover && (
              <div style={{
                padding: 14,
                background: 'var(--surface-1)',
                border: '1px solid var(--divider)',
                borderRadius: 'var(--radius-md)',
                maxHeight: 320,
                overflowY: 'auto',
              }}>
                <MarkdownPreview source={app.coverLetter} />
              </div>
            )}
          </div>
        )}

        {/* Apply URL */}
        {app.job.applyUrl && (
          <a
            href={app.job.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost"
            style={{ fontSize: 12, alignSelf: 'flex-start' }}
          >
            ↗ Open job posting
          </a>
        )}
      </div>

      <div className="drawer-foot">
        <button
          className="btn btn-ghost"
          onClick={deleteApplication}
          disabled={deleting}
          style={{ color: '#b91c1c', borderColor: 'rgba(239,68,68,0.3)' }}
        >
          {deleting ? 'Deleting…' : '🗑 Delete'}
        </button>
        <button className="btn btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </>
  );
}
