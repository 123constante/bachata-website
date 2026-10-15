import type { CSSProperties } from 'react';
import { dateParts } from './nightsModel';

import { gradientBg } from './nightsStyles';

/** Weekday / day / month block (mockup), gradient. */
export const DateBlock = ({ dateKey }: { dateKey: string | null }) => {
  const box: CSSProperties = {
    width: 48,
    flex: '0 0 48px',
    borderRadius: 10,
    background: gradientBg,
    color: 'var(--da-on-gradient)',
    textAlign: 'center',
    padding: '4px 0',
    lineHeight: 1.1,
  };
  if (!dateKey) {
    return (
      <div style={{ ...box, fontSize: 11, padding: '10px 2px' }} aria-label="Date to be confirmed">
        TBC
      </div>
    );
  }
  const p = dateParts(dateKey);
  return (
    <div style={box} aria-hidden="true">
      <div style={{ fontSize: 11 }}>{p.weekday}</div>
      <div style={{ fontSize: 20, fontWeight: 800 }}>{p.day}</div>
      <div style={{ fontSize: 11 }}>{p.month}</div>
    </div>
  );
};

export const StatusPill = ({ label }: { label: string }) => (
  <span
    style={{
      flex: '0 0 auto',
      fontSize: 12,
      fontWeight: 700,
      padding: '3px 10px',
      borderRadius: 999,
      background: 'rgba(79,209,181,.16)',
      color: '#4FD1B5',
      border: '1px solid rgba(79,209,181,.4)',
    }}
  >
    {label}
  </span>
);

