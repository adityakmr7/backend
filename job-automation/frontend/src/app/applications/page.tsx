import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Applications',
  description: 'Track your job application pipeline with a kanban board.',
};

const STAGES = [
  { id: 'applied',       label: 'Applied',       color: '#f59e0b' },
  { id: 'phone_screen',  label: 'Phone Screen',   color: '#8b5cf6' },
  { id: 'technical',     label: 'Technical',      color: '#3d5aff' },
  { id: 'offer',         label: 'Offer',          color: '#10b981' },
  { id: 'rejected',      label: 'Rejected',       color: '#ef4444' },
  { id: 'ghosted',       label: 'Ghosted',        color: '#6b7280' },
];

export default function ApplicationsPage() {
  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Applications</h1>
        <p className="page-subtitle">Your job application pipeline</p>
      </div>

      {/* Kanban columns */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          overflowX: 'auto',
          paddingBottom: '16px',
          minHeight: '400px',
        }}
      >
        {STAGES.map((stage) => (
          <div
            key={stage.id}
            id={`kanban-col-${stage.id}`}
            style={{
              minWidth: '220px',
              width: '220px',
              background: 'var(--surface-2)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--surface-5)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Column header */}
            <div
              style={{
                padding: '12px 14px',
                borderBottom: '1px solid var(--surface-5)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: stage.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {stage.label}
              </span>
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  background: 'var(--surface-4)',
                  padding: '1px 6px',
                  borderRadius: '99px',
                }}
              >
                0
              </span>
            </div>

            {/* Empty column */}
            <div
              style={{
                flex: 1,
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                No applications
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
