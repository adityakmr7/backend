'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { AuthCard, Field } from '../login/page';

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Signed-in → /dashboard bounce is handled by AuthGate.

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await signup(email, password);
      router.replace('/dashboard');
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('409')) setError('That email is already registered. Try signing in.');
      else setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      eyebrow="Get started"
      title="Create your account"
      footerText="Already have one?"
      footerLink={{ href: '/login', label: 'Sign in' }}
    >
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
        <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="new-password" required />
        <Field label="Confirm password" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" required />
        {error && <div className="auth-error">{error}</div>}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting}
          style={{ marginTop: '4px', padding: '10px 16px', fontSize: '13px' }}
        >
          {submitting ? 'Creating…' : 'Create account'}
        </button>
      </form>
    </AuthCard>
  );
}
