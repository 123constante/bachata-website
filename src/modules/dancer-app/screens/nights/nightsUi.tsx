import type { CSSProperties } from 'react';
import { dateParts } from './nightsModel';
/** The accent each weekday block takes (D121): Sat/Sun violet, Mon/Thu teal, Tue/Wed gold, Fri rose. */
const WEEKDAY_TONE: Record<string, string> = {
  Sun: 'da-tone-violet', Sat: 'da-tone-violet', Mon: 'da-tone-teal', Thu: 'da-tone-teal', Tue: 'da-tone-gold', Wed: 'da-tone-gold', Fri: 'da-tone-rose',
};

/**
 * Weekday / day / month block, tinted by the weekday. The block shows the 3-letter weekday (a 48px tile cannot
 * spell "Wednesday"); the full name is in the label read aloud, and every written date spells it out (D119).
 */
export const DateBlock = ({ dateKey }: { dateKey: string | null }) => {
  const box: CSSProperties = { fontSize: 11 };
  if (!dateKey) {
    return (
      <div className="da-date da-tone-grey" style={{ ...box, padding: '10px 2px' }} aria-label="Date to be confirmed">
        TBC
      </div>
    );
  }
  const p = dateParts(dateKey);
  return (
    <div className={`da-date ${WEEKDAY_TONE[p.weekday] ?? 'da-tone-grey'}`} style={box} role="img" aria-label={`${p.fullWeekday} ${p.day} ${p.month}`}>
      <div style={{ fontSize: 11 }}>{p.weekday}</div>
      <div style={{ fontSize: 20, fontWeight: 800 }}>{p.day}</div>
      <div style={{ fontSize: 11 }}>{p.month}</div>
    </div>
  );
};

/** Status colours (D121): Going teal, Interested gold, Went violet, Was interested rose, the rest grey. */
const STATUS_TONE: Record<string, string> = { Going: 'da-tone-teal', Interested: 'da-tone-gold', Went: 'da-tone-violet', 'Was interested': 'da-tone-rose' };

export const StatusPill = ({ label }: { label: string }) => <span className={`da-tag ${STATUS_TONE[label] ?? 'da-tone-grey'}`}>{label}</span>;
