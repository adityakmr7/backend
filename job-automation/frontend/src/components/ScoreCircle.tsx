'use client';

interface Props {
  /** 0..100 */
  score: number;
  /** Outer diameter in px (default 92). */
  size?: number;
  /** Label under the number, default "MATCH". */
  label?: string;
  /** Optional tone override. Default greens for >=80, ambers 60-79, reds below. */
  tone?: 'auto' | 'mint' | 'amber' | 'red';
  /** Dark variant (for the job-card score panel). */
  variant?: 'light' | 'dark';
}

function resolveColor(score: number, tone: Props['tone']): { from: string; to: string } {
  if (tone === 'mint') return { from: '#4ade80', to: '#22c55e' };
  if (tone === 'amber') return { from: '#fbbf24', to: '#f59e0b' };
  if (tone === 'red') return { from: '#f87171', to: '#ef4444' };
  if (score >= 80) return { from: '#4ade80', to: '#22c55e' };
  if (score >= 60) return { from: '#fbbf24', to: '#f59e0b' };
  return { from: '#f87171', to: '#ef4444' };
}

/** Conic-gradient match score ring. Used on job cards and resume analysis. */
export default function ScoreCircle({ score, size = 92, label = 'MATCH', tone = 'auto', variant = 'light' }: Props) {
  const safe = Math.max(0, Math.min(100, Math.round(score)));
  const { from, to } = resolveColor(safe, tone);
  const trackColor = variant === 'dark' ? 'rgba(255,255,255,0.10)' : 'var(--surface-4)';
  const centerColor = variant === 'dark' ? 'transparent' : 'var(--surface-3)';
  const numberColor = variant === 'dark' ? '#fff' : 'var(--text-primary)';
  const labelColor = variant === 'dark' ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)';
  const inner = size - 16;

  return (
    <div
      role="img"
      aria-label={`${label} score ${safe}%`}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `conic-gradient(${to} ${safe * 3.6}deg, ${trackColor} 0deg)`,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: inner,
          height: inner,
          borderRadius: '50%',
          background: centerColor,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{
          fontSize: size >= 80 ? '24px' : '18px',
          fontWeight: 700,
          color: numberColor,
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {safe}<span style={{ fontSize: '12px', fontWeight: 600, color: labelColor, marginLeft: 1 }}>%</span>
        </div>
      </div>
      {label && (
        <div style={{
          position: 'absolute',
          bottom: -22,
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.8px',
          color: labelColor,
        }}>{label}</div>
      )}
      {/* hide gradient `from` color usage warning */}
      <span style={{ display: 'none' }}>{from}</span>
    </div>
  );
}
