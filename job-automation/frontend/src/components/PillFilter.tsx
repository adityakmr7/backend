'use client';

import { type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  variant?: 'default' | 'strong' | 'lock';
  onClick?: () => void;
  title?: string;
  /** Show a small caret on the right to suggest dropdown behavior. */
  withCaret?: boolean;
}

export default function PillFilter({ children, variant = 'default', onClick, title, withCaret }: Props) {
  const klass =
    variant === 'strong' ? 'pill pill-strong'
      : variant === 'lock' ? 'pill pill-lock'
      : 'pill';
  return (
    <button type="button" className={klass} onClick={onClick} title={title}>
      {children}
      {withCaret && <span className="pill-caret">▾</span>}
    </button>
  );
}
