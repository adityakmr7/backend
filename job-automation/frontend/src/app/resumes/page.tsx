import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Resumes',
  description: 'Manage your resume variants in Markdown format for AI-powered job matching.',
};

export default function ResumesPage() {
  return (
    <>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Resumes</h1>
          <p className="page-subtitle">Your Markdown resume variants — used for AI matching and cover letter generation</p>
        </div>
        <button id="resumes-upload-btn" className="btn btn-primary">
          + Upload Resume
        </button>
      </div>

      {/* Info card */}
      <div
        className="card"
        style={{
          marginBottom: '20px',
          padding: '14px 16px',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start',
          background: 'rgba(61,90,255,0.08)',
          borderColor: 'rgba(61,90,255,0.2)',
        }}
      >
        <span style={{ fontSize: '16px' }}>💡</span>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '3px' }}>
            Use Markdown (.md) format
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Paste your resume as Markdown. The AI reads it directly — no PDF parsing. Create multiple variants
            (e.g. <code>frontend-focused</code>, <code>full-stack</code>) and tag them for smart auto-selection.
          </div>
        </div>
      </div>

      {/* Empty state */}
      <div className="card">
        <div className="empty-state">
          <div className="empty-icon">📄</div>
          <div className="empty-title">No resumes uploaded yet</div>
          <div className="empty-sub">
            Upload your resume in Markdown format to start applying with AI-personalized cover letters
          </div>
          <button id="resumes-empty-upload-btn" className="btn btn-primary" style={{ marginTop: '8px' }}>
            + Upload First Resume
          </button>
        </div>
      </div>
    </>
  );
}
