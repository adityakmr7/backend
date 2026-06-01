'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

interface PageMeta {
  title: string;
  /** Active "tab" label shown after the chevron — pulled from the URL. */
  segment?: string;
}

const PAGE_META: Record<string, PageMeta> = {
  '/dashboard':    { title: 'DASHBOARD',    segment: 'Overview' },
  '/jobs':         { title: 'JOBS',         segment: 'Recommended' },
  '/applications': { title: 'APPLICATIONS', segment: 'Pipeline' },
  '/resumes':      { title: 'RESUMES',      segment: 'Library' },
  '/settings':     { title: 'SETTINGS',     segment: 'Profile' },
};

function metaForPath(pathname: string): PageMeta {
  if (pathname.startsWith('/jobs/')) return { title: 'JOBS', segment: 'Detail' };
  return PAGE_META[pathname] ?? { title: 'JOBPILOT' };
}

export default function Topbar() {
  const pathname = usePathname() ?? '/';
  const meta = metaForPath(pathname);
  const { user, logout } = useAuth();
  const initial = (user?.email ?? '?').trim().charAt(0).toUpperCase();
  const handle = (user?.email ?? '').split('@')[0] || 'You';

  return (
    <header className="topbar" role="banner">
      <div className="topbar-section">
        <span className="topbar-eyebrow">{meta.title}</span>
        {meta.segment && (
          <>
            <span className="topbar-chevron">›</span>
            <span style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              borderBottom: '2px solid var(--text-primary)',
              paddingBottom: '2px',
            }}>{meta.segment}</span>
          </>
        )}
      </div>

      <div className="topbar-search">
        <span aria-hidden>🔎</span>
        <input
          placeholder="Search by title or company"
          aria-label="Search"
        />
      </div>

      <Link href="/settings" className="upgrade-cta" aria-label="Upgrade plan">
        <span className="upgrade-cta-spark">⚡</span>
        Upgrade to Turbo: Get Hired Faster
        <span aria-hidden>›</span>
      </Link>

      <button
        className="avatar-chip"
        onClick={logout}
        title={`Signed in as ${user?.email ?? ''} — click to sign out`}
      >
        <span className="avatar-chip-bubble">{initial}</span>
        {handle}
      </button>
    </header>
  );
}
