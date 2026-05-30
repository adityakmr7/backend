'use client';

import { useEffect, useState } from 'react';
import { API_BASE } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────
interface Profile {
  id?: string;
  name: string;
  email: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  targetRoles?: string[];
  targetLocations?: string[];
  preferredSalaryMin?: number;
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile>({
    name: '', email: '',
    linkedinUrl: '', githubUrl: '', portfolioUrl: '',
    targetRoles: [], targetLocations: [],
    preferredSalaryMin: undefined,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Tag field state (comma-separated strings)
  const [rolesStr, setRolesStr] = useState('');
  const [locStr, setLocStr] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/api/profile`)
      .then((r) => r.json())
      .then((data: Profile) => {
        if (!data.id) return; // no profile yet
        setProfile(data);
        setRolesStr((data.targetRoles ?? []).join(', '));
        setLocStr((data.targetLocations ?? []).join(', '));
      })
      .catch(() => {/* no profile yet */ })
      .finally(() => setLoading(false));
  }, []);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  async function save() {
    setSaving(true);
    try {
      const payload: Profile = {
        ...profile,
        targetRoles:     rolesStr.split(',').map((s) => s.trim()).filter(Boolean),
        targetLocations: locStr.split(',').map((s) => s.trim()).filter(Boolean),
      };
      const res = await fetch(`${API_BASE}/api/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      showToast('Settings saved successfully!');
    } catch (e) {
      showToast((e as Error).message, false);
    } finally {
      setSaving(false);
    }
  }

  function set(field: keyof Profile, value: string | number | undefined) {
    setProfile((p) => ({ ...p, [field]: value }));
  }

  if (loading) {
    return (
      <div className="empty-state" style={{ padding: '60px 0' }}>
        <div className="empty-sub">Loading profile…</div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Configure your profile, job preferences &amp; API credentials</p>
        </div>
        <button
          className="btn btn-primary"
          disabled={saving}
          onClick={save}
          style={{ minWidth: '120px' }}
        >
          {saving ? 'Saving…' : '✓ Save Settings'}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 200,
          padding: '12px 18px',
          background: toast.ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
          border: `1px solid ${toast.ok ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`,
          borderRadius: '10px',
          fontSize: '13px',
          color: toast.ok ? '#10b981' : '#f87171',
          boxShadow: 'var(--shadow-md)',
          animation: 'fadeIn 0.2s ease',
        }}>
          {toast.ok ? '✓ ' : '⚠ '}{toast.msg}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '660px', paddingBottom: '32px' }}>

        {/* ── Profile ── */}
        <Section title="👤 Profile" subtitle="Your public identity used in cover letters and applications">
          <FormRow>
            <Field label="Full Name" required>
              <input
                id="settings-name"
                className="input-base"
                type="text"
                value={profile.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Aditya Kumar"
              />
            </Field>
            <Field label="Email Address" required>
              <input
                id="settings-email"
                className="input-base"
                type="email"
                value={profile.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="you@gmail.com"
              />
            </Field>
          </FormRow>
          <FormRow>
            <Field label="LinkedIn URL">
              <input
                id="settings-linkedin"
                className="input-base"
                type="url"
                value={profile.linkedinUrl ?? ''}
                onChange={(e) => set('linkedinUrl', e.target.value)}
                placeholder="https://linkedin.com/in/yourname"
              />
            </Field>
            <Field label="GitHub URL">
              <input
                id="settings-github"
                className="input-base"
                type="url"
                value={profile.githubUrl ?? ''}
                onChange={(e) => set('githubUrl', e.target.value)}
                placeholder="https://github.com/yourname"
              />
            </Field>
          </FormRow>
          <Field label="Portfolio / Personal Site">
            <input
              id="settings-portfolio"
              className="input-base"
              type="url"
              value={profile.portfolioUrl ?? ''}
              onChange={(e) => set('portfolioUrl', e.target.value)}
              placeholder="https://yoursite.dev"
            />
          </Field>
        </Section>

        {/* ── Job Preferences ── */}
        <Section title="🎯 Job Preferences" subtitle="Used by AI to score relevance and filter jobs">
          <Field label="Target Roles" hint="Comma-separated">
            <input
              id="settings-roles"
              className="input-base"
              type="text"
              value={rolesStr}
              onChange={(e) => setRolesStr(e.target.value)}
              placeholder="Software Engineer, Full Stack, Backend Engineer"
            />
          </Field>
          <Field label="Target Locations" hint="Comma-separated">
            <input
              id="settings-locations"
              className="input-base"
              type="text"
              value={locStr}
              onChange={(e) => setLocStr(e.target.value)}
              placeholder="Remote, San Francisco, New York"
            />
          </Field>
          <Field label="Minimum Salary (USD)" hint="Optional — used to filter out low-paying roles">
            <input
              id="settings-salary"
              className="input-base"
              type="number"
              value={profile.preferredSalaryMin ?? ''}
              onChange={(e) => set('preferredSalaryMin', e.target.value ? Number(e.target.value) : undefined)}
              placeholder="100000"
              min={0}
              step={5000}
            />
          </Field>
        </Section>

        {/* ── AI Config ── */}
        <Section
          title="🤖 AI Config"
          subtitle="Gemini API key — stored only in your .env, never sent to any third-party"
        >
          <div style={{
            padding: '12px 14px',
            background: 'rgba(251,191,36,0.06)',
            border: '1px solid rgba(251,191,36,0.2)',
            borderRadius: '8px',
            fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6,
            marginBottom: '12px',
          }}>
            💡 Set <code style={{ color: 'var(--brand-300)' }}>GEMINI_API_KEY</code> in{' '}
            <code style={{ color: 'var(--brand-300)' }}>backend/.env</code> and restart the server.
            Updating it here only shows you the current value — it cannot be changed from the UI for security.
          </div>
          <Field label="Gemini API Key">
            <input
              id="settings-gemini-key"
              className="input-base"
              type="password"
              placeholder="Set via GEMINI_API_KEY in backend/.env"
              disabled
              style={{ opacity: 0.5 }}
            />
          </Field>
        </Section>

        {/* ── Email ── */}
        <Section
          title="✉️ Email (Gmail SMTP)"
          subtitle="Used for automated application emails — requires a Gmail App Password"
        >
          <div style={{
            padding: '12px 14px',
            background: 'rgba(251,191,36,0.06)',
            border: '1px solid rgba(251,191,36,0.2)',
            borderRadius: '8px',
            fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6,
            marginBottom: '12px',
          }}>
            ⚙ Set <code style={{ color: 'var(--brand-300)' }}>GMAIL_USER</code> and{' '}
            <code style={{ color: 'var(--brand-300)' }}>GMAIL_APP_PASSWORD</code> in{' '}
            <code style={{ color: 'var(--brand-300)' }}>backend/.env</code>.
            Generate an App Password at{' '}
            <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer"
              style={{ color: 'var(--brand-400)' }}>
              myaccount.google.com/apppasswords ↗
            </a>
          </div>
          <FormRow>
            <Field label="Gmail Address">
              <input
                id="settings-gmail-user"
                className="input-base"
                type="email"
                placeholder="Set via GMAIL_USER in backend/.env"
                disabled
                style={{ opacity: 0.5 }}
              />
            </Field>
            <Field label="App Password (16-char)">
              <input
                id="settings-gmail-pass"
                className="input-base"
                type="password"
                placeholder="Set via GMAIL_APP_PASSWORD in backend/.env"
                disabled
                style={{ opacity: 0.5 }}
              />
            </Field>
          </FormRow>
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <button
              id="settings-verify-smtp-btn"
              className="btn btn-ghost"
              style={{ fontSize: '12px' }}
              onClick={async () => {
                try {
                  const res = await fetch(`${API_BASE}/api/apply/mailer/verify`);
                  const data = await res.json() as { ok: boolean; error?: string };
                  if (data.ok) {
                    showToast('✓ Gmail SMTP connection verified successfully!');
                  } else {
                    showToast(data.error ?? 'SMTP verification failed', false);
                  }
                } catch (e) {
                  showToast((e as Error).message, false);
                }
              }}
            >
              🔌 Test SMTP Connection
            </button>
          </div>
        </Section>

        {/* ── Scraper ── */}
        <Section title="🕷 Scraper" subtitle="Configure how jobs are fetched from workatastartup.com">
          <div style={{
            padding: '14px 16px',
            background: 'var(--surface-2)', border: '1px solid var(--surface-5)', borderRadius: '10px',
            fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.8,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <Row label="Source" value="workatastartup.com (WAAS)" />
              <Row label="Schedule" value="Every 6 hours (cron)" />
              <Row label="Method" value="Pure HTTP fetch (no browser)" />
              <Row label="Max jobs/run" value="100 + Lever + Greenhouse" />
            </div>
          </div>
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-ghost"
              style={{ fontSize: '12px' }}
              onClick={async () => {
                try {
                  const res = await fetch(`${API_BASE}/api/jobs/scrape`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sources: ['waas'], maxJobs: 50, fetchDetail: false }),
                  });
                  const data = await res.json() as { message?: string };
                  showToast(data.message ?? 'Scrape triggered');
                } catch (e) {
                  showToast((e as Error).message, false);
                }
              }}
            >
              ↻ Trigger Scrape Now
            </button>
          </div>
        </Section>

        {/* Footer save */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px' }}>
          <button
            id="settings-save-btn"
            className="btn btn-primary"
            disabled={saving}
            onClick={save}
            style={{ minWidth: '140px' }}
          >
            {saving ? 'Saving…' : '✓ Save Settings'}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────
function Section({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <div className="card" style={{ padding: '20px' }}>
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '3px' }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {subtitle}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {children}
      </div>
    </div>
  );
}

function FormRow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
      {children}
    </div>
  );
}

function Field({ label, hint, required, children }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
        {label}
        {required && <span style={{ color: '#ef4444', fontSize: '12px' }}>*</span>}
        {hint && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text-muted)' }}>— {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
      <span style={{ color: 'var(--text-muted)', minWidth: '120px', fontWeight: 600 }}>{label}</span>
      <span style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}
