'use client';

import { usePathname } from 'next/navigation';
import { type ReactNode } from 'react';
import AuthGate from './AuthGate';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import SparkleFab from './SparkleFab';

const PUBLIC_PATHS = ['/login', '/signup'];

function isPublic(path: string) {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * Top-level shell. Public routes (login/signup) render their children alone.
 * Protected routes render Sidebar + Topbar + main scroll area + decorative FAB.
 *
 * Auth state is handled by AuthGate (redirect, loading screen, etc.). This
 * component only owns layout — never auth logic.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/';
  const publicRoute = isPublic(pathname);

  return (
    <AuthGate>
      {publicRoute ? (
        <div className="auth-shell">{children}</div>
      ) : (
        <div className="app-shell">
          <Sidebar />
          <div className="main-area">
            <Topbar />
            <main
              className="page-content animate-in"
              id="main-content"
              role="main"
            >
              {children}
            </main>
          </div>
          <SparkleFab />
        </div>
      )}
    </AuthGate>
  );
}
