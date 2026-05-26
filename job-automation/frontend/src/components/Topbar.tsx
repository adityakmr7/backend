'use client';

import { usePathname } from 'next/navigation';

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/dashboard':    { title: 'Dashboard',    subtitle: 'Overview of your job search' },
  '/jobs':         { title: 'Jobs',         subtitle: 'Browse and apply to jobs' },
  '/applications': { title: 'Applications', subtitle: 'Track your application pipeline' },
  '/resumes':      { title: 'Resumes',      subtitle: 'Manage your resume variants' },
  '/settings':     { title: 'Settings',     subtitle: 'Configure your profile and preferences' },
};

interface TopbarProps {
  actions?: React.ReactNode;
}

export default function Topbar({ actions }: TopbarProps) {
  const pathname = usePathname();
  const meta = pageTitles[pathname] ?? { title: 'JobPilot', subtitle: '' };

  return (
    <header className="topbar" role="banner">
      <div>
        <div className="topbar-title">{meta.title}</div>
      </div>
      <div className="topbar-spacer" />
      <div className="topbar-actions" role="toolbar" aria-label="Page actions">
        {actions}
        <a
          id="topbar-api-docs"
          href="http://localhost:3001/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost"
          title="Open API documentation"
        >
          <span aria-hidden="true">⎋</span> API Docs
        </a>
      </div>
    </header>
  );
}
