import type { CSSProperties, ReactNode } from 'react';

/** One Options row: a 48 px tap target (shared by the full Options and the no-profile way out). */
export const ROW: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  minHeight: 48,
  padding: '0 12px',
  borderRadius: 10,
  border: '1px solid var(--da-border)',
  background: 'transparent',
  color: 'var(--da-text)',
  fontSize: 15,
  fontWeight: 600,
  textAlign: 'left',
  textDecoration: 'none',
  cursor: 'pointer',
};

export const Sheet = ({ title, testId, onClose, closeDisabled = false, children }: { title: string; testId: string; onClose: () => void; closeDisabled?: boolean; children: ReactNode }) => (
  <div
    role="dialog"
    aria-modal="true"
    aria-label={title}
    data-testid={testId}
    style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-end', background: 'rgba(0,0,0,0.55)' }}
  >
    <div
      className="da-card"
      style={{ width: '100%', maxHeight: '85dvh', overflowY: 'auto', borderRadius: '16px 16px 0 0', padding: 16, background: 'var(--da-surface)' }}
    >
      <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 8px' }}>{title}</h2>
      {children}
      <button type="button" className="da-tap" style={{ ...ROW, marginTop: 12, justifyContent: 'center' }} onClick={onClose} disabled={closeDisabled}>
        Close
      </button>
    </div>
  </div>
);
