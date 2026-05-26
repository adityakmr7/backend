'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  {
    section: 'Main',
    items: [
      { href: '/dashboard', icon: '▦', label: 'Dashboard' },
      { href: '/jobs',      icon: '⌕', label: 'Jobs',          badge: 'NEW' },
      { href: '/applications', icon: '◧', label: 'Applications' },
    ],
  },
  {
    section: 'Tools',
    items: [
      { href: '/resumes',  icon: '◫', label: 'Resumes' },
      { href: '/settings', icon: '⚙', label: 'Settings' },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">✈</div>
        <span className="sidebar-logo-text">JobPilot</span>
        <span className="sidebar-logo-badge">Beta</span>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav" aria-label="Main navigation">
        {navItems.map((section) => (
          <div key={section.section}>
            <div className="sidebar-section-label">{section.section}</div>
            {section.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  id={`nav-${item.label.toLowerCase()}`}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="nav-item-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  {item.label}
                  {item.badge && (
                    <span className="nav-item-badge">{item.badge}</span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="nav-item" style={{ cursor: 'default' }}>
          <span className="status-dot" aria-label="API connected" />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            API connected
          </span>
        </div>
      </div>
    </aside>
  );
}
