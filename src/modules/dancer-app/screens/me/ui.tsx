import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { UseQueryResult } from '@tanstack/react-query';
import { toDancerError } from '../../api/errors';
import type { MyDancerEdit } from '../../api/types';

/** Shared bits of the Me and Edit screens (sizes in px, never rem: the phone html font-size is ~13.5px). */

export const mainButton: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 48,
  width: '100%',
  borderRadius: 12,
  border: 0,
  background: 'var(--da-accent)',
  color: 'var(--da-on-accent)',
  fontSize: 16,
  fontWeight: 700,
  textDecoration: 'none',
  cursor: 'pointer',
};

export const ghostButton: CSSProperties = {
  ...mainButton,
  background: 'transparent',
  color: 'var(--da-text)',
  border: '1px solid var(--da-border)',
  fontWeight: 600,
};

export const StrengthBar = ({ pct }: { pct: number }) => (
  <div
    role="progressbar"
    aria-label="Profile strength"
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={pct}
    style={{ height: 8, borderRadius: 999, background: 'var(--da-surface-2)', overflow: 'hidden' }}
  >
    <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', background: 'var(--da-accent)' }} />
  </div>
);

export const Avatar = ({ profile, size }: { profile: Pick<MyDancerEdit, 'avatar_url' | 'first_name' | 'display_name'>; size: number }) => {
  const initial = (profile.display_name || profile.first_name || '?').trim().charAt(0).toUpperCase();
  const box: CSSProperties = { width: size, height: size, borderRadius: '50%', flex: '0 0 auto', background: 'var(--da-surface-2)' };
  return profile.avatar_url ? (
    <img src={profile.avatar_url} alt="" style={{ ...box, objectFit: 'cover' }} data-testid="me-photo" />
  ) : (
    <span
      aria-hidden="true"
      data-testid="me-photo-placeholder"
      style={{ ...box, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: size / 2.5 }}
    >
      {initial}
    </span>
  );
};

/** Loading / error states for the query both screens share. Returns null when the data is ready. */
export const QueryGate = ({ q, id }: { q: UseQueryResult<MyDancerEdit>; id: string }): ReactNode => {
  if (q.isPending) {
    return (
      <section className="da-card" data-testid={`dancer-state-${id}`} aria-busy="true">
        <p className="da-muted" style={{ fontSize: 14, margin: 0 }}>Loading your profile&hellip;</p>
      </section>
    );
  }
  if (q.isError) {
    const err = toDancerError(q.error);
    return (
      <section className="da-card" data-testid={`dancer-state-${id}`} role="alert">
        <p style={{ fontSize: 14, margin: '0 0 10px' }} data-testid="load-error">{err.message}</p>
        <div style={{ display: 'grid', gap: 8 }}>
          <button type="button" className="da-tap" style={mainButton} onClick={() => void q.refetch()}>
            Try again
          </button>
          <Link to="/" className="da-tap" style={ghostButton}>
            Back to the Bachata Calendar website
          </Link>
        </div>
      </section>
    );
  }
  return null;
};
