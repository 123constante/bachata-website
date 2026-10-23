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
  if (!dateKey) {
    return (
      <div className="da-date da-tone-grey py-[10px] text-[11px]" aria-label="Date to be confirmed">
        TBC
      </div>
    );
  }
  const p = dateParts(dateKey);
  return (
    <div className={`da-date text-[11px] ${WEEKDAY_TONE[p.weekday] ?? 'da-tone-grey'}`} role="img" aria-label={`${p.fullWeekday} ${p.day} ${p.month}`}>
      <div className="text-[11px]">{p.weekday}</div>
      <div className="text-[20px] font-extrabold">{p.day}</div>
      <div className="text-[11px]">{p.month}</div>
    </div>
  );
};

/** Status colours (D121): Going teal, Interested gold, Went violet, Was interested rose, the rest grey. */
const STATUS_TONE: Record<string, string> = { Going: 'da-tone-teal', Interested: 'da-tone-gold', Went: 'da-tone-violet', 'Was interested': 'da-tone-rose' };

export const StatusPill = ({ label }: { label: string }) => <span className={`da-tag ${STATUS_TONE[label] ?? 'da-tone-grey'}`}>{label}</span>;
