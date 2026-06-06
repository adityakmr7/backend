'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';

const PUBLIC_PATHS = ['/login', '/signup'];

function isPublic(path: string) {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * Wraps the app shell. Renders only the children for public paths (login/signup).
 * For protected paths, waits for `useAuth().user` and bounces to /login if absent.
 * Bouncer also handles the first-run case: redirects /login → /signup when no
 * users exist in the DB yet.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const { user, loading, hasUsers } = useAuth();

  // First-run redirect: on /login when no users exist, push to /signup.
  useEffect(() => {
    if (pathname === '/login' && hasUsers === false) {
      router.replace('/signup');
    }
  }, [pathname, hasUsers, router]);

  // Auth routes are for signed-out users only — bounce signed-in users home.
  useEffect(() => {
    if (loading) return;
    if (user && isPublic(pathname)) {
      router.replace('/dashboard');
    }
  }, [user, loading, pathname, router]);

  // Protected paths: bounce to /login when unauthenticated.
  useEffect(() => {
    if (loading) return;
    if (isPublic(pathname)) return;
    if (!user) router.replace('/login');
  }, [user, loading, pathname, router]);

  // Don't flash protected content while we resolve auth.
  if (loading && !isPublic(pathname)) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: '13px',
        }}
      >
        Loading…
      </div>
    );
  }

  // Public routes — but if we already know the user is signed in, render
  // nothing while the redirect above fires (avoids a flash of the login form).
  if (isPublic(pathname)) {
    if (user) return null;
    return <>{children}</>;
  }

  // Protected, signed-in.
  if (user) return <>{children}</>;

  // Protected, signed-out — redirect already firing; render nothing.
  return null;
}
