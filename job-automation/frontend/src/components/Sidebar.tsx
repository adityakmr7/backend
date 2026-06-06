'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Item {
  href: string;
  label: string;
  icon: string;
  badge?: 'NEW' | number;
}

const PRIMARY: Item[] = [
  { href: '/jobs',         label: 'Jobs',          icon: '💼' },
  { href: '/resumes',      label: 'Resume',        icon: '📄' },
  { href: '/dashboard',    label: 'Profile',       icon: '👤' },
  { href: '/applications', label: 'Applications',  icon: '🎯' },
  // { href: '/settings',     label: 'Coaching',      icon: '🧭', badge: 'NEW' },
];

const SECONDARY: Item[] = [
  // { href: '/dashboard',  label: 'Gifts',    icon: '🎁' },
  // { href: '/dashboard',  label: 'Notifs',   icon: '🔔' },
  // { href: '/dashboard',  label: 'Help',     icon: '❓' },
  { href: '/settings',   label: 'Settings', icon: '⚙' },
];

function isActive(pathname: string, href: string) {
  if (href === '/dashboard' && pathname === '/dashboard') return true;
  if (href === '/dashboard') return false;
  return pathname === href || pathname.startsWith(href + '/');
}

export default function Sidebar() {
  const pathname = usePathname() ?? '/';
  return (
    <aside className="rail" role="navigation" aria-label="Primary">
      <Link href="/dashboard" className="rail-logo" aria-label="JobPilot home">
        ✈
      </Link>

      {PRIMARY.map((item) => (
        <RailLink key={item.label} item={item} active={isActive(pathname, item.href)} />
      ))}

      <div className="rail-bottom">
        {SECONDARY.map((item) => (
          <RailLink key={item.label} item={item} active={false} />
        ))}
      </div>
    </aside>
  );
}

function RailLink({ item, active }: { item: Item; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={`rail-link ${active ? 'active' : ''}`}
      title={item.label}
      aria-current={active ? 'page' : undefined}
    >
      <span className="rail-link-icon" aria-hidden>{item.icon}</span>
      <span>{item.label}</span>
      {item.badge && <span className="rail-link-badge">{item.badge}</span>}
    </Link>
  );
}
