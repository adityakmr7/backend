'use client';

import { useState } from 'react';

/**
 * Bottom-right floating action button — "Ask Orion" entrypoint (placeholder).
 * Currently shows a tiny popover with a hint; can be wired to the AI chat later.
 */
export default function SparkleFab() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="fab"
        aria-label="Ask Orion AI"
        onClick={() => setOpen((v) => !v)}
        title="Ask Orion AI"
      >
        ✨
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Orion popover"
          style={{
            position: 'fixed',
            bottom: 88,
            right: 24,
            width: 260,
            padding: '14px 16px',
            background: 'var(--surface-3)',
            border: '1px solid var(--divider)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 51,
            fontSize: '13px',
            color: 'var(--text-primary)',
            animation: 'fadeIn 0.15s ease forwards',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: '4px' }}>✨ Ask Orion</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            Coming soon — your AI copilot for cover letters, job match rationale,
            and interview prep.
          </div>
        </div>
      )}
    </>
  );
}
