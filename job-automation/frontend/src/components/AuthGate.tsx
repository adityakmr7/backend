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

  // Public routes render alone (no sidebar / topbar).
  if (isPublic(pathname)) return <>{children}</>;

  // Protected, signed-in.
  if (user) return <>{children}</>;

  // Protected, signed-out — redirect already firing; render nothing.
  return null;
}
