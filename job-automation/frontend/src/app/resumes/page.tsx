'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type Resume, type ResumeSummary, type ResumeAnalysis, type TailorResult } from '@/lib/api';
import MarkdownPreview from '@/components/MarkdownPreview';

type Mode = 'preview' | 'edit' | 'analyze' | 'tailor';

export default function ResumesPage() {
  const [resumes, setResumes] = useState<ResumeSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [active, setActive] = useState<Resume | null>(null);
  const [mode, setMode] = useState<Mode>('preview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const loadList = useCallback(async () => {
    try {
      const list = await api.resumes.list();
      setResumes(list);
      if (!activeId && list.length > 0) setActiveId(list[0].id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useEffect(() => { loadList(); }, [loadList]);

  useEffect(() => {
    if (!activeId) { setActive(null); return; }
    (async () => {
      try {
        const r = await api.resumes.detail(activeId);
        setActive(r);
        setMode('preview');
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [activeId]);

  async function refreshActive() {
    if (!activeId) return;
    const r = await api.resumes.detail(activeId);
    setActive(r);
  }

  async function handleSaveEdit(name: string, content: string) {
    if (!active) return;
    await api.resumes.update(active.id, { name, content });
    await Promise.all([loadList(), refreshActive()]);
    setMode('preview');
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this resume? This cannot be undone.')) return;
    await api.resumes.delete(id);
    if (activeId === id) setActiveId(null);
    await loadList();
  }

  async function handleSetDefault(id: string) {
    await api.resumes.setDefault(id);
    await loadList();
    if (activeId === id) await refreshActive();
  }

  return (
    <>
      {/* ── Page header ── */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Resumes</h1>
          <p className="page-subtitle">
            Markdown variants — used for AI matching, cover letters &amp; JD tailoring
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
          <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span> Upload Resume
        </button>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: '16px', borderColor: 'rgba(239,68,68,0.3)', padding: '12px 16px' }}>
          <div style={{ color: '#f87171', fontSize: '13px' }}>⚠ {error}</div>
        </div>
      )}

      {/* ── Two-column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '272px 1fr', gap: '16px', alignItems: 'flex-start' }}>

        {/* Left — list pane */}
        <ResumeList
          resumes={resumes}
          activeId={activeId}
          loading={loading}
          onSelect={setActiveId}
          onSetDefault={handleSetDefault}
          onDelete={handleDelete}
          onUpload={() => setShowUpload(true)}
        />

        {/* Right — detail pane */}
        <div style={{ minWidth: 0 }}>
          {!active ? (
            <EmptyDetail hasResumes={resumes.length > 0} onUpload={() => setShowUpload(true)} />
          ) : (
            <ResumeDetail
              resume={active}
              mode={mode}
              setMode={setMode}
              onSave={handleSaveEdit}
            />
          )}
        </div>
      </div>

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSaved={async (id) => {
            setShowUpload(false);
            await loadList();
            setActiveId(id);
          }}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────
function EmptyDetail({ hasResumes, onUpload }: { hasResumes: boolean; onUpload: () => void }) {
  return (
    <div className="card" style={{ minHeight: '420px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="empty-state" style={{ padding: '48px 32px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.4 }}>📄</div>
        <div className="empty-title">
          {hasResumes ? 'Select a resume' : 'No resumes yet'}
        </div>
        <div className="empty-sub" style={{ maxWidth: '300px' }}>
          {hasResumes
            ? 'Pick a resume from the list to preview, edit, analyze with AI, or tailor for a job.'
            : 'Upload your resume PDF — Gemini converts it to clean markdown for AI matching.'}
        </div>
        {!hasResumes && (
          <button className="btn btn-primary" onClick={onUpload} style={{ marginTop: '16px' }}>
            Upload First Resume
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// LIST PANE
// ─────────────────────────────────────────────────────
function ResumeList({
  resumes, activeId, loading, onSelect, onSetDefault, onDelete, onUpload,
}: {
  resumes: ResumeSummary[];
  activeId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onSetDefault: (id: string) => void;
  onDelete: (id: string) => void;
  onUpload: () => void;
}) {
  return (
    <div style={{ position: 'sticky', top: '70px' }}>
      <div className="card" style={{ padding: '8px' }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 10px 10px',
          borderBottom: '1px solid var(--surface-5)',
          marginBottom: '4px',
        }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
            {loading ? '…' : `${resumes.length} variant${resumes.length === 1 ? '' : 's'}`}
          </span>
          <button
            onClick={onUpload}
            title="Upload resume"
            style={{
              background: 'var(--surface-4)',
              border: '1px solid var(--surface-5)',
              borderRadius: '6px',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              fontSize: '14px',
              lineHeight: 1,
            }}
          >+</button>
        </div>

        {/* Resume cards */}
        {resumes.length === 0 && !loading && (
          <button className="btn btn-primary" onClick={onUpload} style={{ width: '100%', marginTop: '8px' }}>
            + Upload First Resume
          </button>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {resumes.map((r) => {
            const isActive = r.id === activeId;
            const wordCount = 0; // summary doesn't include textContent
            return (
              <div
                key={r.id}
                onClick={() => onSelect(r.id)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: isActive ? 'rgba(61,90,255,0.08)' : 'transparent',
                  border: isActive ? '1px solid rgba(61,90,255,0.22)' : '1px solid transparent',
                  transition: 'all 0.12s',
                }}
              >
                {/* Name row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '6px',
                    background: isActive ? 'rgba(61,90,255,0.15)' : 'var(--surface-4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', flexShrink: 0,
                  }}>
                    📄
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      fontSize: '13px', fontWeight: 600,
                      color: isActive ? 'var(--brand-300)' : 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {r.name}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>
                      {new Date(r.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                  {r.isDefault && (
                    <span style={{
                      fontSize: '8px', fontWeight: 800,
                      background: 'var(--brand-500)', color: '#fff',
                      padding: '2px 5px', borderRadius: '4px',
                      letterSpacing: '0.6px', flexShrink: 0,
                    }}>DEFAULT</span>
                  )}
                </div>

                {/* Tags */}
                {r.tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '4px', paddingLeft: '34px' }}>
                    {r.tags.slice(0, 3).map((t) => (
                      <span key={t} style={{
                        fontSize: '9px', padding: '1px 5px',
                        background: 'var(--surface-4)', borderRadius: '4px',
                        color: 'var(--text-muted)',
                      }}>{t}</span>
                    ))}
                  </div>
                )}

                {/* Actions (only when active) */}
                {isActive && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px', paddingLeft: '34px' }}>
                    {!r.isDefault && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onSetDefault(r.id); }}
                        style={btnLink}
                      >★ Set default</button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(r.id); }}
                      style={{ ...btnLink, color: '#ef4444' }}
                    >Delete</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* AI tip */}
      {resumes.length > 0 && (
        <div style={{
          marginTop: '10px', padding: '10px 12px',
          background: 'rgba(61,90,255,0.06)',
          border: '1px solid rgba(61,90,255,0.15)',
          borderRadius: '10px',
          fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6,
        }}>
          <span style={{ color: 'var(--brand-400)', fontWeight: 600 }}>💡 Tip:</span> Keep multiple
          variants — e.g. <em>frontend</em>, <em>fullstack</em>, <em>startup</em> — and tailor each
          per job.
        </div>
      )}
    </div>
  );
}

const btnLink: React.CSSProperties = {
  background: 'none', border: 'none',
  fontSize: '11px', color: 'var(--text-muted)',
  cursor: 'pointer', padding: 0,
  textDecoration: 'underline', textUnderlineOffset: '2px',
};

// ─────────────────────────────────────────────────────
// DETAIL PANE
// ─────────────────────────────────────────────────────
const MODE_LABELS: Record<Mode, string> = {
  preview: '👁 Preview',
  edit:    '✎ Edit',
  analyze: '🔬 Analyze',
  tailor:  '🎯 Tailor',
};

function ResumeDetail({ resume, mode, setMode, onSave }: {
  resume: Resume;
  mode: Mode;
  setMode: (m: Mode) => void;
  onSave: (name: string, content: string) => Promise<void>;
}) {
  const wordCount = resume.textContent.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        padding: '12px 18px',
        borderBottom: '1px solid var(--surface-5)',
        background: 'var(--surface-2)',
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        {/* Resume info */}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {resume.name}
            </div>
            {resume.isDefault && (
              <span style={{
                fontSize: '9px', fontWeight: 800, background: 'var(--brand-500)', color: '#fff',
                padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.5px',
              }}>DEFAULT</span>
            )}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '10px' }}>
            <span>📝 {wordCount.toLocaleString()} words</span>
            <span>⏱ Updated {new Date(resume.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          </div>
        </div>

        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: '2px', background: 'var(--surface-3)', padding: '3px', borderRadius: '8px' }}>
          {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: '5px 11px',
                fontSize: '12px',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                borderRadius: '6px',
                transition: 'all 0.15s',
                background: mode === m ? 'var(--surface-1)' : 'transparent',
                color: mode === m ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.18)' : 'none',
              }}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>

        {/* Download */}
        <a
          href={api.resumes.downloadUrl(resume.id)}
          download
          title="Download .md"
          style={{
            padding: '6px 10px',
            fontSize: '12px',
            borderRadius: '7px',
            background: 'var(--surface-3)',
            border: '1px solid var(--surface-5)',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            transition: 'background 0.12s',
          }}
        >⬇ .md</a>
      </div>

      {/* Content */}
      <div style={{ padding: '24px' }}>
        {mode === 'preview' && <PreviewPane resume={resume} />}
        {mode === 'edit'    && <EditPane resume={resume} onSave={onSave} />}
        {mode === 'analyze' && <AnalyzePane resume={resume} />}
        {mode === 'tailor'  && <TailorPane resume={resume} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// PREVIEW
// ─────────────────────────────────────────────────────
function PreviewPane({ resume }: { resume: Resume }) {
  return (
    <div style={{
      background: 'var(--surface-1)',
      border: '1px solid var(--surface-5)',
      borderRadius: '10px',
      padding: '28px 32px',
      minHeight: '400px',
    }}>
      <MarkdownPreview source={resume.textContent} />
    </div>
  );
}

// ─────────────────────────────────────────────────────
// EDIT
// ─────────────────────────────────────────────────────
function EditPane({ resume, onSave }: { resume: Resume; onSave: (n: string, c: string) => Promise<void> }) {
  const [name, setName] = useState(resume.name);
  const [content, setContent] = useState(resume.textContent);
  const [saving, setSaving] = useState(false);

  // sync when resume changes
  useEffect(() => { setName(resume.name); setContent(resume.textContent); }, [resume.id]);

  const dirty = name !== resume.name || content !== resume.textContent;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
      {/* Editor */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div>
          <label className="field-label">Variant name</label>
          <input
            className="input-base"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label className="field-label">Markdown content</label>
          <textarea
            className="textarea-base"
            rows={26}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            style={{ resize: 'vertical', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
          {dirty && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Unsaved changes</span>}
          <button
            className="btn btn-primary"
            disabled={saving || !dirty}
            onClick={async () => {
              setSaving(true);
              try { await onSave(name, content); } finally { setSaving(false); }
            }}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Live preview */}
      <div>
        <label className="field-label">Live preview</label>
        <div style={{
          border: '1px solid var(--surface-5)',
          borderRadius: '10px',
          padding: '20px',
          background: 'var(--surface-1)',
          height: '560px',
          overflowY: 'auto',
        }}>
          <MarkdownPreview source={content} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// ANALYZE
// ─────────────────────────────────────────────────────
function AnalyzePane({ resume }: { resume: Resume }) {
  const [data, setData] = useState<ResumeAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true); setError(null);
    try { setData(await api.resumes.analyze(resume.id)); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 32px', gap: '16px' }}>
        <div style={{ fontSize: '40px', animation: 'spin 1.2s linear infinite' }}>⏳</div>
        <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600 }}>Analyzing resume…</div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Gemini is reading every line (~10s)</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '64px 32px', gap: '20px', textAlign: 'center',
      }}>
        {/* Hero graphic */}
        <div style={{
          width: '80px', height: '80px', borderRadius: '20px',
          background: 'linear-gradient(135deg, rgba(61,90,255,0.15), rgba(139,92,246,0.15))',
          border: '1px solid rgba(61,90,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '36px',
        }}>🔬</div>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
            AI Resume Analysis
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '380px', lineHeight: 1.7 }}>
            Gemini will score your resume, surface strengths &amp; gaps, detect your seniority level,
            and suggest targeted improvements.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '20px', fontSize: '12px', color: 'var(--text-muted)' }}>
          {['Score 0–100', 'Skill detection', 'Seniority', 'Action items'].map((f) => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: '#10b981' }}>✓</span> {f}
            </div>
          ))}
        </div>
        <button className="btn btn-primary" onClick={run} style={{ minWidth: '160px' }}>
          Run AI Analysis
        </button>
        {error && <div style={{ color: '#f87171', fontSize: '12px' }}>{error}</div>}
      </div>
    );
  }

  const scoreColor = data.overallScore >= 80 ? '#10b981' : data.overallScore >= 60 ? '#f59e0b' : '#ef4444';
  const seniorityColors: Record<string, string> = {
    junior: '#3b82f6', mid: '#8b5cf6', senior: '#10b981', staff: '#f59e0b', unknown: '#6b7280',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Score hero */}
      <div style={{
        display: 'flex', gap: '24px', alignItems: 'center',
        padding: '20px 24px',
        background: 'linear-gradient(135deg, rgba(61,90,255,0.06), rgba(139,92,246,0.04))',
        border: '1px solid rgba(61,90,255,0.15)',
        borderRadius: '12px',
      }}>
        {/* Score ring */}
        <div style={{
          width: '96px', height: '96px', borderRadius: '50%',
          background: `conic-gradient(${scoreColor} ${data.overallScore * 3.6}deg, var(--surface-4) 0deg)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          boxShadow: `0 0 20px ${scoreColor}30`,
        }}>
          <div style={{
            width: '78px', height: '78px', borderRadius: '50%',
            background: 'var(--surface-2)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
              {data.overallScore}
            </div>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              / 100
            </div>
          </div>
        </div>

        {/* Summary */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.7, marginBottom: '10px' }}>
            {data.summary}
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {data.yearsOfExperience != null && (
              <Chip icon="📅" label={`${data.yearsOfExperience}y exp`} />
            )}
            <Chip
              icon="⬆"
              label={data.seniority}
              color={seniorityColors[data.seniority]}
            />
            {data.detectedRoles.slice(0, 2).map((r) => (
              <Chip key={r} icon="🎯" label={r} />
            ))}
          </div>
        </div>

        <button
          className="btn btn-ghost"
          onClick={run}
          style={{ fontSize: '12px', flexShrink: 0 }}
        >↻ Re-run</button>
      </div>

      {/* Strengths / Weaknesses grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <BulletCard title="✓ Strengths" color="#10b981" items={data.strengths} />
        <BulletCard title="⚠ Weaknesses" color="#f59e0b" items={data.weaknesses} />
      </div>

      {/* Suggestions */}
      <BulletCard title="💡 Suggested Improvements" color="#3d5aff" items={data.suggestions} />

      {/* Skills */}
      {data.detectedSkills.length > 0 && (
        <div>
          <div className="field-label" style={{ marginBottom: '10px' }}>Detected skills</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {data.detectedSkills.map((s) => (
              <span key={s} style={{
                fontSize: '11px', padding: '3px 10px',
                background: 'var(--surface-3)',
                border: '1px solid var(--surface-5)',
                borderRadius: '99px',
                color: 'var(--text-secondary)',
              }}>{s}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ icon, label, color }: { icon: string; label: string; color?: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      fontSize: '11px', padding: '3px 8px',
      background: color ? `${color}18` : 'var(--surface-3)',
      border: `1px solid ${color ? `${color}35` : 'var(--surface-5)'}`,
      borderRadius: '6px',
      color: color ?? 'var(--text-secondary)',
      fontWeight: 500,
    }}>
      <span>{icon}</span>{label}
    </span>
  );
}

function BulletCard({ title, color, items }: { title: string; color: string; items: string[] }) {
  return (
    <div style={{
      padding: '14px 16px',
      background: 'var(--surface-2)',
      border: '1px solid var(--surface-5)',
      borderRadius: '10px',
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>
        {title}
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>None detected.</div>
      ) : (
        <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          {items.map((s, i) => (
            <li key={i} style={{ marginBottom: '5px', lineHeight: 1.6 }}>{s}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// TAILOR
// ─────────────────────────────────────────────────────
function TailorPane({ resume }: { resume: Resume }) {
  const [jd, setJd] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [result, setResult] = useState<TailorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!jd.trim()) { setError('Paste a job description first.'); return; }
    setLoading(true); setError(null);
    try {
      setResult(await api.resumes.tailor(resume.id, {
        jobDescription: jd,
        jobTitle: title || undefined,
        company: company || undefined,
      }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function download() {
    if (!result) return;
    const blob = new Blob([result.markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeCo = (company || 'tailored').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
    a.download = `${resume.name.replace(/\s+/g, '-').toLowerCase()}-for-${safeCo}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Inputs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label className="field-label">Company (optional)</label>
          <input
            className="input-base"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="e.g. Stripe"
          />
        </div>
        <div>
          <label className="field-label">Job title (optional)</label>
          <input
            className="input-base"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Senior Backend Engineer"
          />
        </div>
      </div>

      <div>
        <label className="field-label">
          Job description <span style={{ color: '#ef4444' }}>*</span>
          <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '8px' }}>
            Paste the full JD — AI rewrites your resume to match without inventing experience
          </span>
        </label>
        <textarea
          className="textarea-base"
          rows={9}
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          placeholder="Paste the full job description here…"
        />
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end' }}>
        {error && <span style={{ color: '#f87171', fontSize: '12px', flex: 1 }}>{error}</span>}
        {result && (
          <button className="btn btn-ghost" onClick={download} style={{ fontSize: '12px' }}>
            ⬇ Download .md
          </button>
        )}
        <button
          className="btn btn-primary"
          disabled={loading || !jd.trim()}
          onClick={run}
          style={{ minWidth: '140px' }}
        >
          {loading ? '✨ Tailoring… (~15s)' : result ? '↻ Re-tailor' : '🎯 Tailor Resume'}
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{
          padding: '32px', textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(61,90,255,0.05), rgba(139,92,246,0.05))',
          border: '1px solid rgba(61,90,255,0.12)',
          borderRadius: '12px',
        }}>
          <div style={{ fontSize: '32px', marginBottom: '10px', animation: 'pulse 1.5s ease-in-out infinite' }}>✨</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Gemini is rewriting your resume…
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Matching keywords, restructuring bullets, optimising for ATS (~15s)
          </div>
          <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '16px' }}>
          {/* Change notes sidebar */}
          <div style={{
            padding: '16px',
            background: 'var(--surface-2)',
            border: '1px solid var(--surface-5)',
            borderRadius: '10px',
            position: 'sticky',
            top: '70px',
            maxHeight: 'calc(100vh - 120px)',
            overflowY: 'auto',
          }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '14px' }}>📋</span> What changed
            </div>
            {result.changeNotes.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No major changes noted.</div>
            ) : (
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                {result.changeNotes.map((n, i) => (
                  <li key={i} style={{ marginBottom: '6px' }}>{n}</li>
                ))}
              </ul>
            )}

            {result.basedOn.jobTitle && (
              <div style={{
                marginTop: '16px', paddingTop: '14px',
                borderTop: '1px solid var(--surface-5)',
                fontSize: '11px', color: 'var(--text-muted)',
              }}>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>Tailored for</div>
                <div>{result.basedOn.jobTitle}</div>
                {result.basedOn.company && <div style={{ color: 'var(--brand-400)' }}>{result.basedOn.company}</div>}
              </div>
            )}
          </div>

          {/* Tailored resume preview */}
          <div style={{
            border: '1px solid var(--surface-5)',
            borderRadius: '10px',
            padding: '24px',
            background: 'var(--surface-1)',
          }}>
            <MarkdownPreview source={result.markdown} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// UPLOAD MODAL
// ─────────────────────────────────────────────────────
function UploadModal({ onClose, onSaved }: { onClose: () => void; onSaved: (id: string) => void }) {
  const [stage, setStage] = useState<'pick' | 'review'>('pick');
  const [name, setName] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [makeDefault, setMakeDefault] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.pdf') && !file.type.includes('pdf')) {
      setError('Only PDF files are supported. Please upload a .pdf file.');
      return;
    }
    setUploading(true); setError(null);
    setProgress('Extracting text from PDF…');
    try {
      await new Promise(r => setTimeout(r, 400));
      setProgress('Cleaning &amp; converting to markdown with Gemini…');
      const res = await api.resumes.uploadPdf(file);
      setName(res.suggestedName);
      setMarkdown(res.markdown);
      setStage('review');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      setProgress('');
    }
  }

  async function save() {
    if (!name.trim() || !markdown.trim()) return;
    setSaving(true); setError(null);
    try {
      const { id } = await api.resumes.create({ name: name.trim(), content: markdown, isDefault: makeDefault });
      onSaved(id);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel"
        style={{ maxWidth: stage === 'review' ? '860px' : '480px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-head">
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {stage === 'pick' ? '📤 Upload Resume' : '✅ Review Extracted Markdown'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {stage === 'pick'
                ? 'Drop a PDF — Gemini converts it to clean, editable markdown'
                : 'Review the extracted content, tweak if needed, then save'}
            </div>
          </div>
          <button
            className="btn btn-ghost"
            onClick={onClose}
            style={{ padding: '4px 10px', fontSize: '16px', lineHeight: 1 }}
          >✕</button>
        </div>

        <div className="modal-body">
          {/* Error banner */}
          {error && (
            <div style={{
              padding: '10px 14px',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: '8px',
              color: '#f87171',
              fontSize: '12px',
              marginBottom: '14px',
            }}>⚠ {error}</div>
          )}

          {/* STAGE: pick */}
          {stage === 'pick' && (
            <>
              <div
                className={`dropzone ${dragOver ? 'drag-over' : ''}`}
                onClick={() => !uploading && fileInput.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault(); setDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleFile(f);
                }}
                style={{ minHeight: '200px', cursor: uploading ? 'wait' : 'pointer' }}
              >
                {uploading ? (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '40px', marginBottom: '12px', animation: 'spin 1.2s linear infinite' }}>⏳</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                      Processing PDF…
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}
                      dangerouslySetInnerHTML={{ __html: progress }}
                    />
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      width: '64px', height: '64px', margin: '0 auto 16px',
                      borderRadius: '16px',
                      background: 'rgba(61,90,255,0.08)',
                      border: '2px dashed rgba(61,90,255,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '28px',
                    }}>📄</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                      Drop your PDF resume here
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                      or click to browse
                    </div>
                    <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                      {['PDF only', 'Any size', 'AI-cleaned'].map((f) => (
                        <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <span style={{ color: '#10b981' }}>✓</span> {f}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="application/pdf,.pdf"
                style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />

              {/* Or — paste markdown directly */}
              <div style={{
                textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)',
                margin: '14px 0 4px',
              }}>
                ─── or ───
              </div>
              <button
                className="btn btn-ghost"
                style={{ width: '100%', fontSize: '12px' }}
                onClick={() => { setMarkdown(''); setName('My Resume'); setStage('review'); }}
              >
                ✎ Paste / write markdown directly
              </button>
            </>
          )}

          {/* STAGE: review */}
          {stage === 'review' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label className="field-label">Variant name</label>
                  <input
                    className="input-base"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Fullstack v2"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="field-label">Markdown content</label>
                  <textarea
                    className="textarea-base"
                    rows={22}
                    value={markdown}
                    onChange={(e) => setMarkdown(e.target.value)}
                    style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11.5px', resize: 'vertical' }}
                  />
                </div>
                <label style={{
                  display: 'flex', gap: '8px', alignItems: 'center',
                  fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer',
                }}>
                  <input
                    type="checkbox"
                    checked={makeDefault}
                    onChange={(e) => setMakeDefault(e.target.checked)}
                    style={{ accentColor: 'var(--brand-500)' }}
                  />
                  Set as default resume (used for AI scoring)
                </label>
              </div>

              <div>
                <label className="field-label">Preview</label>
                <div style={{
                  border: '1px solid var(--surface-5)',
                  borderRadius: '10px',
                  padding: '16px',
                  background: 'var(--surface-1)',
                  height: '488px',
                  overflowY: 'auto',
                }}>
                  {markdown ? <MarkdownPreview source={markdown} /> : (
                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', marginTop: '40px' }}>
                      Start typing markdown to see a preview…
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-foot">
          {stage === 'pick' && (
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          )}
          {stage === 'review' && (
            <>
              <button className="btn btn-ghost" onClick={() => setStage('pick')}>← Re-upload</button>
              <button
                className="btn btn-primary"
                disabled={saving || !name.trim() || !markdown.trim()}
                onClick={save}
                style={{ minWidth: '120px' }}
              >
                {saving ? 'Saving…' : '✓ Save Resume'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
