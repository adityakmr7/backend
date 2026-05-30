'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api, type JobDetail } from '@/lib/api';
import { API_BASE } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────
interface CoverLetterResult {
  coverLetter: string;
  wordCount: number;
  jobTitle: string;
  company: string;
}

interface ScoreResult {
  scores: Array<{
    resumeId: string;
    resumeName: string;
    score: number;
    matchedSkills: string[];
    missingSkills: string[];
    strengthAreas: string[];
    improvements: string[];
    recommendation: 'strong_match' | 'good_match' | 'weak_match';
  }>;
  bestResumeId: string;
}

type Tab = 'overview' | 'cover-letter' | 'score';

const TONES = [
  { id: 'startup-friendly', label: '🚀 Startup', desc: 'Direct, builder mentality, energetic' },
  { id: 'professional',     label: '💼 Professional', desc: 'Formal, polished, measured' },
  { id: 'technical',        label: '⚙️ Technical', desc: 'Deep on stack, systems-minded' },
  { id: 'concise',          label: '✂️ Concise', desc: 'Tight, no fluff, bullets mindset' },
] as const;

// ── Page ───────────────────────────────────────────────────────────────────
export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [job, setJob]       = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [tab, setTab]       = useState<Tab>('overview');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setJob(await api.jobs.detail(id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function setStatus(next: string) {
    if (!job) return;
    await api.jobs.updateStatus(job.id, next);
    setJob({ ...job, status: next });
  }

  if (loading) {
    return (
      <div className="empty-state" style={{ padding: '80px 0' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>⏳</div>
        <div className="empty-sub">Loading job…</div>
      </div>
    );
  }
  if (error || !job) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-icon">⚠️</div>
          <div className="empty-title">Could not load job</div>
          <div className="empty-sub">{error ?? 'Not found'}</div>
          <Link href="/jobs" className="btn btn-ghost" style={{ marginTop: '12px' }}>← Back to Jobs</Link>
        </div>
      </div>
    );
  }

  const m = job.metadata;
  const founders = m?.founders ?? [];

  return (
    <>
      {/* ── Breadcrumb ── */}
      <div style={{ marginBottom: '14px' }}>
        <Link href="/jobs" style={{ fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'none' }}>
          ← Jobs
        </Link>
      </div>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '20px' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              {job.title}
            </h1>
            {job.isRemote && (
              <span style={{
                fontSize: '10px', fontWeight: 700, padding: '2px 7px',
                background: 'rgba(16,185,129,0.12)', color: '#10b981',
                borderRadius: '6px', flexShrink: 0,
              }}>REMOTE</span>
            )}
            <span className={`badge badge-${job.status}`}>{job.status}</span>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>{job.company}</span>
            {job.ycBatch && (
              <span style={{
                fontSize: '10px', fontWeight: 700, padding: '1px 6px',
                background: 'rgba(251,191,36,0.12)', color: '#fbbf24', borderRadius: '5px',
              }}>YC {job.ycBatch}</span>
            )}
            {job.location && <span style={{ color: 'var(--text-muted)' }}>· {job.location}</span>}
            <span style={{ color: 'var(--text-muted)' }}>· via {job.source}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
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

      {/* ── Compensation facts ── */}
      {(job.salary || job.equity || job.role || job.yearsExp || job.visa || job.jobType) && (
        <div className="card" style={{ marginBottom: '14px', padding: '14px 18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' }}>
            {job.salary   && <Fact icon="💰" label="Salary"      value={job.salary} />}
            {job.equity   && <Fact icon="📈" label="Equity"      value={job.equity} />}
            {job.role     && <Fact icon="🛠" label="Role"        value={job.role} />}
            {job.jobType  && <Fact icon="📋" label="Type"        value={job.jobType} />}
            {job.yearsExp && <Fact icon="⏱" label="Experience"  value={job.yearsExp} />}
            {job.visa     && <Fact icon="🛂" label="Visa"        value={job.visa} />}
          </div>
        </div>
      )}

      {/* ── Status actions ── */}
      <div className="card" style={{ marginBottom: '14px', padding: '10px 14px' }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginRight: '4px' }}>
            Status
          </span>
          {['new', 'saved', 'applied', 'rejected'].map((s) => (
            <button
              key={s}
              className="btn btn-ghost"
              disabled={job.status === s}
              onClick={() => setStatus(s)}
              style={{
                padding: '4px 10px', fontSize: '11px', fontWeight: 600,
                ...(job.status === s
                  ? { borderColor: 'var(--brand-500)', color: 'var(--text-primary)', background: 'var(--surface-4)' }
                  : {}),
              }}
            >{s}</button>
          ))}
        </div>
      </div>

      {/* ── Skills tags ── */}
      {job.tags.length > 0 && (
        <div style={{ marginBottom: '16px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {job.tags.map((t) => (
            <span key={t} style={{
              fontSize: '11px', padding: '3px 9px',
              background: 'var(--surface-4)', color: 'var(--text-secondary)',
              borderRadius: '99px', border: '1px solid var(--surface-5)',
            }}>{t}</span>
          ))}
        </div>
      )}

      {/* ── Tab bar ── */}
      <div style={{
        display: 'flex', gap: '2px',
        background: 'var(--surface-3)', padding: '4px',
        borderRadius: '10px', marginBottom: '16px',
        width: 'fit-content',
      }}>
        {([
          { id: 'overview',     label: '📄 Overview' },
          { id: 'cover-letter', label: '✉️ Cover Letter' },
          { id: 'score',        label: '🎯 Resume Match' },
        ] as { id: Tab; label: string }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '7px 16px', fontSize: '13px', fontWeight: 500,
              border: 'none', cursor: 'pointer', borderRadius: '8px',
              transition: 'all 0.15s',
              background: tab === t.id ? 'var(--surface-1)' : 'transparent',
              color: tab === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* ── Tab content ── */}
      {tab === 'overview' && (
        <OverviewTab job={job} founders={founders} m={m} />
      )}
      {tab === 'cover-letter' && (
        <CoverLetterTab job={job} onApplied={() => { setJob({ ...job, status: 'applied' }); }} />
      )}
      {tab === 'score' && (
        <ScoreTab job={job} />
      )}
    </>
  );
}

// ── Overview tab ───────────────────────────────────────────────────────────
function OverviewTab({ job, founders, m }: {
  job: JobDetail;
  founders: NonNullable<NonNullable<JobDetail['metadata']>['founders']>;
  m: JobDetail['metadata'];
}) {
  return (
    <>
      {/* Description */}
      <div className="card" style={{ marginBottom: '14px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
          Job Description
        </div>
        <div style={{
          fontSize: '13px', color: 'var(--text-secondary)',
          whiteSpace: 'pre-wrap', lineHeight: 1.8,
        }}>
          {job.description || <em style={{ color: 'var(--text-muted)' }}>No description captured.</em>}
        </div>
      </div>

      {/* Company panel */}
      {m && (
        <div className="card" style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
            About {job.company}
          </div>
          {m.short_description && (
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
              {m.short_description}
            </div>
          )}
          {m.long_description && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.7 }}>
              {m.long_description}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '14px' }}>
            {m.stage          && <Fact icon="🏢" label="Stage"    value={m.stage} />}
            {m.industry       && <Fact icon="🏭" label="Industry" value={m.industry} />}
            {m.team_size      && <Fact icon="👥" label="Team"     value={m.team_size} />}
            {m.year_founded   && <Fact icon="📅" label="Founded"  value={m.year_founded} />}
            {m.company_location && <Fact icon="📍" label="HQ"    value={m.company_location} />}
          </div>
          {(m.website || m.company_linkedin || m.company_x || m.company_github) && (
            <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
              {m.website          && <ExtLink href={m.website}          label="Website" />}
              {m.company_linkedin && <ExtLink href={m.company_linkedin} label="LinkedIn" />}
              {m.company_x        && <ExtLink href={m.company_x}        label="X" />}
              {m.company_github   && <ExtLink href={m.company_github}   label="GitHub" />}
            </div>
          )}
        </div>
      )}

      {/* Founders */}
      {founders.length > 0 && (
        <div className="card">
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
            Founders
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {founders.map((f, i) => (
              <div key={i} style={{
                padding: '12px 14px', background: 'var(--surface-2)',
                borderRadius: '9px', border: '1px solid var(--surface-5)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '6px' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{f.name}</div>
                    {f.title && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{f.title}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: '10px', fontSize: '11px' }}>
                    {f.linkedin && <ExtLink href={f.linkedin} label="LinkedIn" />}
                    {f.x        && <ExtLink href={f.x}        label="X" />}
                  </div>
                </div>
                {f.bio && (
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{f.bio}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ── Cover Letter tab ───────────────────────────────────────────────────────
function CoverLetterTab({ job, onApplied }: { job: JobDetail; onApplied: () => void }) {
  const [tone, setTone]         = useState<string>('startup-friendly');
  const [result, setResult]     = useState<CoverLetterResult | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [copied, setCopied]     = useState(false);
  const [editing, setEditing]   = useState(false);
  const [edited, setEdited]     = useState('');

  // Apply panel state
  const [showApply, setShowApply]   = useState(false);
  const [applyEmail, setApplyEmail] = useState('');
  const [applying, setApplying]     = useState(false);
  const [applyResult, setApplyResult] = useState<string | null>(null);

  const coverText = editing ? edited : (result?.coverLetter ?? '');

  async function generate() {
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/ai/cover-letter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, tone }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as CoverLetterResult;
      setResult(data);
      setEdited(data.coverLetter);
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(coverText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function download() {
    const blob = new Blob([coverText], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `cover-letter-${job.company.replace(/\s+/g,'-').toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function applyViaEmail() {
    if (!applyEmail.trim()) return;
    setApplying(true); setApplyResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/apply/${job.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'email',
          coverLetter: coverText,
          applyEmail: applyEmail.trim(),
        }),
      });
      const data = await res.json() as { message: string };
      setApplyResult(data.message);
      onApplied();
    } catch (e) {
      setApplyResult(`Error: ${(e as Error).message}`);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Tone picker */}
      <div className="card" style={{ padding: '16px 18px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>
          Tone
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
          {TONES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTone(t.id)}
              style={{
                padding: '10px 14px', borderRadius: '9px', cursor: 'pointer',
                textAlign: 'left', border: `1px solid ${tone === t.id ? 'var(--brand-500)' : 'var(--surface-5)'}`,
                background: tone === t.id ? 'rgba(61,90,255,0.08)' : 'var(--surface-2)',
                transition: 'all 0.12s',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 600, color: tone === t.id ? 'var(--brand-300)' : 'var(--text-primary)', marginBottom: '2px' }}>
                {t.label}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.desc}</div>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '14px', justifyContent: 'flex-end', alignItems: 'center' }}>
          {error && <span style={{ color: '#f87171', fontSize: '12px', flex: 1 }}>{error}</span>}
          <button
            className="btn btn-primary"
            disabled={loading}
            onClick={generate}
            style={{ minWidth: '180px' }}
          >
            {loading
              ? '✨ Generating…'
              : result
              ? '↻ Regenerate'
              : '✨ Generate Cover Letter'}
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{
          padding: '40px', textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(61,90,255,0.05), rgba(139,92,246,0.04))',
          border: '1px solid rgba(61,90,255,0.12)', borderRadius: '12px',
        }}>
          <div style={{ fontSize: '36px', marginBottom: '12px', animation: 'pulse 1.4s ease-in-out infinite' }}>✨</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Writing your cover letter…
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Gemini is reading the JD and your resume (~10s)
          </div>
          <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <>
          {/* Toolbar */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {result.wordCount} words
              {' · '}
              <span style={{ color: 'var(--brand-400)' }}>{TONES.find(t => t.id === tone)?.label}</span>
            </div>
            <div style={{ flex: 1 }} />
            <button
              className="btn btn-ghost"
              onClick={() => { setEditing(!editing); if (!editing) setEdited(result.coverLetter); }}
              style={{ fontSize: '12px' }}
            >
              {editing ? '👁 Preview' : '✎ Edit'}
            </button>
            <button className="btn btn-ghost" onClick={download} style={{ fontSize: '12px' }}>
              ⬇ Download
            </button>
            <button
              className="btn btn-ghost"
              onClick={copy}
              style={{ fontSize: '12px', minWidth: '80px' }}
            >
              {copied ? '✓ Copied!' : '⎘ Copy'}
            </button>
          </div>

          {/* Letter display / edit */}
          {editing ? (
            <textarea
              className="textarea-base"
              rows={18}
              value={edited}
              onChange={(e) => setEdited(e.target.value)}
              style={{ fontSize: '13px', lineHeight: 1.8, fontFamily: 'inherit' }}
            />
          ) : (
            <div style={{
              padding: '24px 28px',
              background: 'var(--surface-1)',
              border: '1px solid var(--surface-5)',
              borderRadius: '12px',
              fontSize: '13px', color: 'var(--text-secondary)',
              whiteSpace: 'pre-wrap', lineHeight: 1.9,
            }}>
              {coverText}
            </div>
          )}

          {/* Apply via email panel */}
          <div className="card" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showApply ? '14px' : 0 }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  ✉️ Send as Email Application
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Send this cover letter via Gmail SMTP + attach your default resume
                </div>
              </div>
              <button
                className={`btn ${showApply ? 'btn-ghost' : 'btn-primary'}`}
                onClick={() => setShowApply(!showApply)}
                style={{ fontSize: '12px', flexShrink: 0 }}
              >
                {showApply ? '✕ Cancel' : 'Send Email'}
              </button>
            </div>

            {showApply && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label className="field-label">Hiring email address</label>
                  <input
                    className="input-base"
                    type="email"
                    value={applyEmail}
                    onChange={(e) => setApplyEmail(e.target.value)}
                    placeholder="hiring@company.com"
                    style={{ marginTop: '6px' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                  {applyResult && (
                    <span style={{
                      fontSize: '12px', flex: 1,
                      color: applyResult.startsWith('Error') || applyResult.startsWith('⚠') ? '#f87171' : '#10b981',
                    }}>
                      {applyResult}
                    </span>
                  )}
                  <button
                    className="btn btn-primary"
                    disabled={applying || !applyEmail.trim()}
                    onClick={applyViaEmail}
                    style={{ minWidth: '140px' }}
                  >
                    {applying ? 'Sending…' : '✉️ Send Application'}
                  </button>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  ⚠ Requires <code style={{ color: 'var(--brand-400)' }}>GMAIL_USER</code> +{' '}
                  <code style={{ color: 'var(--brand-400)' }}>GMAIL_APP_PASSWORD</code> set in{' '}
                  <code style={{ color: 'var(--brand-400)' }}>backend/.env</code>.
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Empty state */}
      {!result && !loading && !error && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '56px 32px', textAlign: 'center', gap: '16px',
        }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '18px',
            background: 'linear-gradient(135deg, rgba(61,90,255,0.12), rgba(139,92,246,0.10))',
            border: '1px solid rgba(61,90,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '32px',
          }}>✉️</div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
              AI-Powered Cover Letter
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '380px', lineHeight: 1.7 }}>
              Gemini reads your resume + the full job description and writes a 3-paragraph,
              hook-first cover letter tailored to {job.company}. No filler, no templates.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '20px', fontSize: '12px', color: 'var(--text-muted)' }}>
            {['Company-specific hook', 'Real metrics', 'No "I am passionate"', '280 words max'].map((f) => (
              <div key={f} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <span style={{ color: '#10b981' }}>✓</span> {f}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Resume Match (Score) tab ───────────────────────────────────────────────
function ScoreTab({ job }: { job: JobDetail }) {
  const [data, setData]     = useState<ScoreResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  async function run() {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/ai/score-resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id }),
      });
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json() as ScoreResult);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const recColor = (r: string) =>
    r === 'strong_match' ? '#10b981' : r === 'good_match' ? '#f59e0b' : '#ef4444';

  const recLabel = (r: string) =>
    r === 'strong_match' ? '✅ Strong match' : r === 'good_match' ? '⚡ Good match' : '✗ Weak match';

  if (loading) {
    return (
      <div style={{ padding: '56px', textAlign: 'center' }}>
        <div style={{ fontSize: '36px', marginBottom: '12px', animation: 'pulse 1.4s ease-in-out infinite' }}>🎯</div>
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
          Scoring all resume variants…
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Gemini compares each resume against the JD (~10s per variant)
        </div>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '56px 32px', textAlign: 'center', gap: '16px',
      }}>
        <div style={{
          width: '72px', height: '72px', borderRadius: '18px',
          background: 'linear-gradient(135deg, rgba(61,90,255,0.12), rgba(139,92,246,0.10))',
          border: '1px solid rgba(61,90,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '32px',
        }}>🎯</div>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Resume Match Score
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '360px', lineHeight: 1.7 }}>
            Scores all your resume variants against this job description and ranks them.
            Identifies matched skills, gaps, and improvement suggestions.
          </div>
        </div>
        {error && <div style={{ color: '#f87171', fontSize: '12px' }}>{error}</div>}
        <button className="btn btn-primary" onClick={run} style={{ minWidth: '160px' }}>
          🎯 Score My Resumes
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" onClick={run} style={{ fontSize: '12px' }}>↻ Re-score</button>
      </div>

      {data.scores.map((s, i) => (
        <div
          key={s.resumeId}
          className="card"
          style={{
            padding: '16px 18px',
            border: `1px solid ${s.resumeId === data.bestResumeId ? 'rgba(61,90,255,0.4)' : 'var(--surface-5)'}`,
            background: s.resumeId === data.bestResumeId ? 'rgba(61,90,255,0.04)' : 'var(--surface-3)',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            {/* Score circle */}
            <div style={{
              width: '60px', height: '60px', borderRadius: '50%', flexShrink: 0,
              background: `conic-gradient(${recColor(s.recommendation)} ${s.score * 3.6}deg, var(--surface-4) 0deg)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 14px ${recColor(s.recommendation)}30`,
            }}>
              <div style={{
                width: '46px', height: '46px', borderRadius: '50%',
                background: 'var(--surface-2)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{s.score}</div>
                <div style={{ fontSize: '8px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>/100</div>
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{s.resumeName}</div>
                {s.resumeId === data.bestResumeId && (
                  <span style={{
                    fontSize: '9px', fontWeight: 800, background: 'var(--brand-500)', color: '#fff',
                    padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.5px',
                  }}>BEST MATCH</span>
                )}
                {i === 0 && s.resumeId !== data.bestResumeId && null}
              </div>
              <span style={{
                fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px',
                background: `${recColor(s.recommendation)}18`, color: recColor(s.recommendation),
              }}>{recLabel(s.recommendation)}</span>
            </div>
          </div>

          {/* Skills grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div style={{
              padding: '10px 12px', background: 'rgba(16,185,129,0.06)',
              border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px',
            }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#10b981', marginBottom: '6px' }}>✓ Matched</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {s.matchedSkills.length === 0
                  ? <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>None</span>
                  : s.matchedSkills.map((sk) => (
                      <span key={sk} style={{
                        fontSize: '10px', padding: '2px 6px',
                        background: 'rgba(16,185,129,0.12)', color: '#10b981',
                        borderRadius: '4px',
                      }}>{sk}</span>
                    ))
                }
              </div>
            </div>
            <div style={{
              padding: '10px 12px', background: 'rgba(239,68,68,0.05)',
              border: '1px solid rgba(239,68,68,0.18)', borderRadius: '8px',
            }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#f87171', marginBottom: '6px' }}>✗ Missing</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {s.missingSkills.length === 0
                  ? <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>None</span>
                  : s.missingSkills.map((sk) => (
                      <span key={sk} style={{
                        fontSize: '10px', padding: '2px 6px',
                        background: 'rgba(239,68,68,0.1)', color: '#f87171',
                        borderRadius: '4px',
                      }}>{sk}</span>
                    ))
                }
              </div>
            </div>
          </div>

          {/* Improvements */}
          {s.improvements.length > 0 && (
            <div style={{
              padding: '10px 12px', background: 'rgba(61,90,255,0.05)',
              border: '1px solid rgba(61,90,255,0.15)', borderRadius: '8px',
            }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--brand-400)', marginBottom: '6px' }}>💡 To improve this match</div>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                {s.improvements.map((imp, j) => (
                  <li key={j} style={{ marginBottom: '2px' }}>{imp}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Shared helpers ─────────────────────────────────────────────────────────
function Fact({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function ExtLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      style={{ color: 'var(--brand-400)', textDecoration: 'none', fontSize: '12px' }}>
      {label} ↗
    </a>
  );
}
