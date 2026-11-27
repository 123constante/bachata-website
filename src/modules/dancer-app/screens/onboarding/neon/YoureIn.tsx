import { useEffect } from 'react';
import { YOURE_IN_MS } from '../neonMotion';
import './neon.css';

/** Mockup stand-ins until real feed items are wired (brief B3). */
export const YOURE_IN_ROWS: readonly { emoji: string; title: string; sub: string }[] = [
  { emoji: '\u{1F389}', title: 'Bachata Sensual Social', sub: 'Tonight 21:00 \u00B7 Soho' },
  { emoji: '\u{1F483}', title: 'Salsa y Bachata Club', sub: 'Tonight 22:00 \u00B7 Camden' },
  { emoji: '\u{1F393}', title: 'Beginner class + party', sub: 'Sat 19:30 \u00B7 Shoreditch' },
  { emoji: '\u{1F91D}', title: 'Dancers looking for a partner', sub: '12 near you' },
];

/** The 2-second "You're in" moment. No buttons: it advances itself via onDone. */
export const YoureIn = ({ firstName, onDone }: { firstName: string; onDone: () => void }) => {
  useEffect(() => {
    const t = setTimeout(onDone, YOURE_IN_MS);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="neon" data-testid="youre-in">
      <div className="neon-body" style={{ top: 52 }}>
        <h1 className="fh1" style={{ font: '30px Anton,sans-serif', margin: '6px 0 0' }}>
          You&rsquo;re in, {firstName}! &#127881;
        </h1>
        <p data-testid="youre-in-sub" style={{ margin: '8px 0 14px' }}>Welcome to the London bachata scene.</p>
        {YOURE_IN_ROWS.map((r) => (
          <div key={r.title} className="lk" data-testid="youre-in-row" style={{ display: 'flex', gap: 10, padding: '8px 0' }}>
            <span aria-hidden>{r.emoji}</span>
            <span>
              <b style={{ display: 'block' }}>{r.title}</b>
              <small>{r.sub}</small>
            </span>
          </div>
        ))}
        <div className="peekbar" data-testid="youre-in-bar" style={{ marginTop: 'auto', padding: '16px 0 0' }}>
          <b style={{ display: 'block', font: '28px Anton,sans-serif', textTransform: 'uppercase' }}>Make your profile shine</b>
          <span>Add a bio and links so dancers know you.</span>
        </div>
      </div>
    </div>
  );
};
