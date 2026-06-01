'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, hasUsers, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // First run: no users exist → redirect to signup.
  useEffect(() => {
    if (hasUsers === false) router.replace('/signup');
  }, [hasUsers, router]);

  // Already signed in.
  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [user, loading, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.replace('/dashboard');
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg.includes('401') ? 'Invalid email or password.' : msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      eyebrow="Welcome back"
      title="Sign in to JobPilot"
      footerText="No account yet?"
      footerLink={{ href: '/signup', label: 'Create one' }}
    >
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          required
        />
        {error && <div className="auth-error">{error}</div>}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting}
          style={{ marginTop: '4px', padding: '10px 16px', fontSize: '13px' }}
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthCard>
  );
}

// ---------------------------------------------------------------------------
// Shared auth UI (used by /login + /signup)
// ---------------------------------------------------------------------------
export function AuthCard({
  eyebrow, title, children, footerText, footerLink,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  footerText: string;
  footerLink: { href: string; label: string };
}) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-brand-mark">✈</span>
          <span className="auth-brand-text">JobPilot</span>
        </div>
        <div className="auth-eyebrow">{eyebrow}</div>
        <h1 className="auth-title">{title}</h1>
        {children}
        <div className="auth-footer">
          {footerText}{' '}
          <Link href={footerLink.href} className="auth-link">{footerLink.label}</Link>
        </div>
      </div>
    </div>
  );
}

export function Field({
  label, type = 'text', value, onChange, autoComplete, required,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <span className="field-label">{label}</span>
      <input
        className="input-base"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
      />
    </label>
  );
}
