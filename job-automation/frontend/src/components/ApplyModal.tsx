'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import {
  api,
  isApplyConflict,
  type ApplyMode,
  type JobDetail,
  type ResumeScoreEntry,
} from '@/lib/api';
import MarkdownPreview from './MarkdownPreview';

// ---------------------------------------------------------------------------
// Public hook — wire-once API for parents
// ---------------------------------------------------------------------------

interface ApplyModalHandle {
  open: (jobId: string, opts?: { onApplied?: (jobId: string) => void }) => void;
  close: () => void;
  modal: ReactNode;
}

/**
 * Mount `<ApplyModal />` once on a page, drive it with `useApplyModal()`.
 *
 *   const apply = useApplyModal();
 *   ...
 *   <JobCard onApply={(id) => apply.open(id, { onApplied: refresh })} />
 *   ...
 *   {apply.modal}
 */
export function useApplyModal(): ApplyModalHandle {
  const [jobId, setJobId] = useState<string | null>(null);
  const onAppliedRef = useRef<((id: string) => void) | null>(null);

  const close = useCallback(() => { setJobId(null); onAppliedRef.current = null; }, []);
  const open = useCallback(
    (id: string, opts?: { onApplied?: (id: string) => void }) => {
      onAppliedRef.current = opts?.onApplied ?? null;
      setJobId(id);
    },
    []
  );

  const modal = jobId ? (
    <ApplyModal
      jobId={jobId}
      onClose={close}
      onApplied={(id) => {
        onAppliedRef.current?.(id);
        close();
      }}
    />
  ) : null;

  return { open, close, modal };
}

// ---------------------------------------------------------------------------
// Modal component
// ---------------------------------------------------------------------------

const TONES = [
  { id: 'startup-friendly', label: '🚀 Startup' },
  { id: 'professional',     label: '💼 Professional' },
  { id: 'technical',        label: '⚙️ Technical' },
  { id: 'concise',          label: '✂️ Concise' },
] as const;

type Tone = (typeof TONES)[number]['id'];

interface Props {
  jobId: string;
  onClose: () => void;
  onApplied: (jobId: string) => void;
}

export default function ApplyModal({ jobId, onClose, onApplied }: Props) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [scores, setScores] = useState<ResumeScoreEntry[] | null>(null);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [tone, setTone] = useState<Tone>('startup-friendly');
  const [letter, setLetter] = useState<string>('');
  const [letterLoading, setLetterLoading] = useState(false);
  const [letterError, setLetterError] = useState<string | null>(null);
  const [mode, setMode] = useState<ApplyMode>('external');
  const [recipient, setRecipient] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ message: string; applicationId: string } | null>(null);

  // ── Initial fetch: job + score ────────────────────────────────────────────
  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const [j, s] = await Promise.all([
          api.jobs.detail(jobId),
          api.ai.scoreResume(jobId).catch((e) => {
            setScoreError((e as Error).message);
            return null;
          }),
        ]);
        if (aborted) return;
        setJob(j);

        // Initial mode + recipient from job.applyMethod
        if (j.applyMethod === 'email' && j.applyEmail) {
          setMode('email');
          setRecipient(j.applyEmail);
        } else {
          setMode('external');
        }

        if (s) {
          setScores(s.scores);
          setResumeId(s.bestResumeId ?? s.scores[0]?.resumeId ?? null);
        }
      } catch (e) {
        setSubmitError((e as Error).message);
      }
    })();
    return () => { aborted = true; };
  }, [jobId]);

  // ── Body scroll lock + escape close ───────────────────────────────────────
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // ── Cover letter (re)generation ───────────────────────────────────────────
  const generateLetter = useCallback(async () => {
    if (!resumeId) return;
    setLetterLoading(true);
    setLetterError(null);
    try {
      const res = await api.ai.coverLetter({ jobId, resumeId, tone });
      setLetter(res.coverLetter);
    } catch (e) {
      setLetterError((e as Error).message);
    } finally {
      setLetterLoading(false);
    }
  }, [jobId, resumeId, tone]);

  // Auto-generate once we have a resume id, and whenever resume/tone changes
  useEffect(() => {
    if (resumeId) generateLetter();
  }, [resumeId, tone, generateLetter]);

  // ── Submit ────────────────────────────────────────────────────────────────
  async function submit() {
    if (!job) return;
    if (mode === 'email' && !recipient.trim()) {
      setSubmitError('Recipient email is required for the Email mode.');
      return;
    }
    if (mode === 'email' && !letter.trim()) {
      setSubmitError('Cover letter is required for the Email mode.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const r = await api.apply.submit(jobId, {
        resumeId: resumeId ?? undefined,
        coverLetter: letter || undefined,
        // Backend treats 'external' as record-only (no email send).
        mode: mode === 'external' ? 'record' : mode,
        applyEmail: mode === 'email' ? recipient.trim() : undefined,
      });
      if (isApplyConflict(r)) {
        setConflict({ message: r.error.message, applicationId: r.error.applicationId });
        return;
      }
      // If email mode reported an error in payload, surface but don't block:
      if (r.email?.error) {
        setSubmitError(`Recorded, but email failed: ${r.email.error}`);
        // still counts as applied — call onApplied below
      }
      if (mode === 'external') {
        window.open(job.applyUrl, '_blank', 'noopener,noreferrer');
      }
      onApplied(jobId);
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (!job) {
    return (
      <Backdrop onClose={onClose}>
        <Panel>
          <Head title="Loading…" subtitle="Fetching job + scoring resumes" onClose={onClose} />
          <div className="modal-body" style={{ minHeight: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            One moment…
          </div>
        </Panel>
      </Backdrop>
    );
  }

  if (conflict) {
    return (
      <Backdrop onClose={onClose}>
        <Panel>
          <Head title="Already applied" subtitle={`${job.company} — ${job.title}`} onClose={onClose} />
          <div className="modal-body">
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              {conflict.message}
            </div>
            <Link href="/applications" className="btn btn-primary" onClick={onClose}>
              View in pipeline →
            </Link>
          </div>
        </Panel>
      </Backdrop>
    );
  }

  return (
    <Backdrop onClose={onClose}>
      <Panel wide>
        <Head
          title={`Apply to ${job.title}`}
          subtitle={`${job.company}${job.ycBatch ? ` · YC ${job.ycBatch}` : ''}${job.location ? ` · ${job.location}` : ''}`}
          onClose={onClose}
        />

        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 18 }}>
          {/* Resume picker */}
          <ResumePicker
            scores={scores}
            scoreError={scoreError}
            selectedId={resumeId}
            onSelect={setResumeId}
          />

          {/* Cover letter editor */}
          <CoverLetterEditor
            tone={tone}
            onToneChange={setTone}
            letter={letter}
            onLetterChange={setLetter}
            loading={letterLoading}
            error={letterError}
            onRegenerate={generateLetter}
          />
        </div>

        <div
          className="modal-foot"
          style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12, padding: '14px 20px 16px' }}
        >
          {submitError && (
            <div className="auth-error" style={{ fontSize: 12 }}>{submitError}</div>
          )}

          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['email', 'external', 'record'] as const).map((m) => (
                <button
                  key={m}
                  className="btn btn-ghost"
                  onClick={() => setMode(m)}
                  style={{
                    padding: '5px 12px',
                    fontSize: 12,
                    borderRadius: 'var(--radius-pill)',
                    ...(mode === m
                      ? { borderColor: 'var(--brand-500)', color: 'var(--text-primary)', background: 'var(--brand-50)' }
                      : {}),
                  }}
                  title={
                    m === 'email' ? 'Send via Gmail SMTP'
                      : m === 'external' ? 'Record + open external URL'
                      : 'Record only — no email, no nav'
                  }
                >
                  {m === 'email' ? '✉ Email' : m === 'external' ? '↗ External' : '📌 Record only'}
                </button>
              ))}
            </div>

            {mode === 'email' && (
              <input
                className="input-base"
                placeholder="Recipient email"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                style={{ flex: 1, minWidth: 220, maxWidth: 360 }}
              />
            )}

            {mode === 'external' && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1 }}>
                Opens {new URL(job.applyUrl).hostname} after recording.
              </span>
            )}

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={submit}
                disabled={submitting || !resumeId}
                style={{ borderRadius: 'var(--radius-pill)', letterSpacing: '0.4px' }}
              >
                {submitting
                  ? 'Sending…'
                  : mode === 'email'
                    ? 'SEND EMAIL APPLICATION'
                    : mode === 'external'
                      ? 'RECORD & OPEN'
                      : 'RECORD APPLICATION'}
              </button>
            </div>
          </div>
        </div>
      </Panel>
    </Backdrop>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Backdrop({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      {children}
    </div>
  );
}

function Panel({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div
      className="modal-panel"
      onClick={(e) => e.stopPropagation()}
      style={wide ? { maxWidth: 1080 } : undefined}
    >
      {children}
    </div>
  );
}

function Head({ title, subtitle, onClose }: { title: string; subtitle?: string; onClose: () => void }) {
  return (
    <div className="modal-head">
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>
        )}
      </div>
      <button
        className="btn btn-ghost"
        onClick={onClose}
        style={{ padding: '4px 10px', fontSize: 12 }}
        aria-label="Close"
      >
        ✕
      </button>
    </div>
  );
}

function ResumePicker({
  scores, scoreError, selectedId, onSelect,
}: {
  scores: ResumeScoreEntry[] | null;
  scoreError: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const selected = useMemo(
    () => scores?.find((s) => s.resumeId === selectedId) ?? null,
    [scores, selectedId]
  );

  if (scoreError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="field-label">Resume</div>
        <div className="auth-error" style={{ fontSize: 12 }}>
          Couldn&apos;t score resumes: {scoreError}
        </div>
        <Link href="/resumes" className="btn btn-ghost" style={{ fontSize: 12 }}>
          Upload a resume →
        </Link>
      </div>
    );
  }

  if (!scores) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="field-label">Scoring resumes…</div>
        <Shimmer h={60} /><Shimmer h={60} /><Shimmer h={60} />
      </div>
    );
  }

  if (scores.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="field-label">Resume</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          No resumes uploaded yet.
        </div>
        <Link href="/resumes" className="btn btn-primary" style={{ fontSize: 12 }}>
          Upload your first resume
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="field-label" style={{ margin: 0 }}>Resume · ranked by match</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {scores.map((s) => {
          const isActive = s.resumeId === selectedId;
          return (
            <button
              key={s.resumeId}
              onClick={() => onSelect(s.resumeId)}
              style={{
                textAlign: 'left',
                padding: '10px 12px',
                borderRadius: 12,
                border: `1px solid ${isActive ? 'var(--brand-500)' : 'var(--divider)'}`,
                background: isActive ? 'var(--brand-50)' : 'var(--surface-3)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <ScorePill score={s.score} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.resumeName}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {s.recommendation.replace('_', ' ')}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <div style={{ marginTop: 4, padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--divider)', borderRadius: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
          {selected.matchedSkills.length > 0 && (
            <Line label="Matched" items={selected.matchedSkills} tone="ok" />
          )}
          {selected.missingSkills.length > 0 && (
            <Line label="Missing" items={selected.missingSkills} tone="warn" />
          )}
        </div>
      )}
    </div>
  );
}

function ScorePill({ score }: { score: number }) {
  const bg = score >= 80 ? '#16a34a' : score >= 60 ? '#f59e0b' : '#9ca3af';
  return (
    <div
      style={{
        width: 38,
        height: 38,
        borderRadius: 10,
        background: bg,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: 13,
        flexShrink: 0,
      }}
    >
      {Math.round(score)}
    </div>
  );
}

function Line({ label, items, tone }: { label: string; items: string[]; tone: 'ok' | 'warn' }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <span style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.5,
        color: tone === 'ok' ? 'var(--brand-700)' : '#b45309',
        marginRight: 6,
      }}>{label.toUpperCase()}</span>
      {items.slice(0, 6).join(', ')}
      {items.length > 6 && <> + {items.length - 6} more</>}
    </div>
  );
}

function CoverLetterEditor({
  tone, onToneChange, letter, onLetterChange, loading, error, onRegenerate,
}: {
  tone: Tone;
  onToneChange: (t: Tone) => void;
  letter: string;
  onLetterChange: (s: string) => void;
  loading: boolean;
  error: string | null;
  onRegenerate: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div className="field-label" style={{ margin: 0 }}>Cover letter</div>
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {TONES.map((t) => (
            <button
              key={t.id}
              onClick={() => onToneChange(t.id)}
              className="btn btn-ghost"
              style={{
                padding: '3px 9px',
                fontSize: 11,
                borderRadius: 'var(--radius-pill)',
                ...(tone === t.id
                  ? { borderColor: 'var(--brand-500)', color: 'var(--text-primary)', background: 'var(--brand-50)' }
                  : {}),
              }}
            >{t.label}</button>
          ))}
          <button
            onClick={onRegenerate}
            className="btn btn-ghost"
            style={{ padding: '3px 9px', fontSize: 11, borderRadius: 'var(--radius-pill)' }}
            title="Regenerate with the current resume + tone"
            disabled={loading}
          >↻</button>
        </div>
      </div>

      {error && <div className="auth-error" style={{ fontSize: 12 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, minHeight: 280 }}>
        <textarea
          className="textarea-base"
          value={letter}
          onChange={(e) => onLetterChange(e.target.value)}
          placeholder={loading ? 'Generating cover letter…' : 'Edit the AI draft, or write your own.'}
          rows={14}
          disabled={loading}
          style={{ minHeight: 280 }}
        />
        <div style={{
          padding: 14,
          background: 'var(--surface-1)',
          border: '1px solid var(--divider)',
          borderRadius: 10,
          overflowY: 'auto',
          maxHeight: 360,
        }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Shimmer h={12} /><Shimmer h={12} /><Shimmer h={12} /><Shimmer h={12} /><Shimmer h={12} w="80%" />
            </div>
          ) : letter ? (
            <MarkdownPreview source={letter} />
          ) : (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Preview appears here.</span>
          )}
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -4 }}>
        Resume will be attached as <code>.md</code> when sent via email. (PDF export is on the roadmap.)
      </div>
    </div>
  );
}

function Shimmer({ h, w }: { h: number; w?: number | string }) {
  return (
    <div
      aria-hidden
      style={{
        height: h,
        width: w ?? '100%',
        borderRadius: 6,
        background: 'linear-gradient(90deg, var(--surface-2) 0%, var(--surface-4) 50%, var(--surface-2) 100%)',
        backgroundSize: '200% 100%',
        animation: 'jp-shimmer 1.2s linear infinite',
      }}
    />
  );
}
