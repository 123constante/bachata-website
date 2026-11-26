import { lazy, Suspense, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Sun } from 'lucide-react';

import { doorUrl } from '../../../raffle-win/model';

// The generator rides with this lazy file only.
const TicketQrCode = lazy(() => import('../../../tickets/TicketQrCode'));

/** Full-screen door view: big QR, caption, note, back to the dashboard. */
export type DoorWho = { name: string; photoUrl: string | null; event: string };

/** Golden Ticket door (prototype A): full-screen white sheet portalled over the whole app. */
const GoldenDoor = ({ token, onBack, who }: { token: string; onBack: () => void; who: DoorWho }) => {
  const done = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    done.current?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onBack(); };
    window.addEventListener('keydown', k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, [onBack]);
  const size = 'min(310px,78vw)';
  return createPortal(
    <section data-testid="golden-door-sheet" style={{ position: 'fixed', inset: 0, zIndex: 99, background: '#fff', color: '#111', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24, textAlign: 'center' }}>
      <span data-testid="raffle-door-view" style={{ display: 'none' }} />
      <button ref={done} type="button" className="da-tap" data-testid="raffle-door-back" onClick={onBack}
        style={{ position: 'absolute', top: 14, right: 14, minHeight: 48, padding: '0 20px', borderRadius: 24, background: '#f0ebe6', color: '#111', fontWeight: 800, fontSize: 15, border: 0 }}>
        Done
      </button>
      <h2 data-testid="golden-door-heading" style={{ color: '#111', fontFamily: 'Fraunces,Georgia,serif', fontWeight: 800, fontSize: 26, margin: 0 }}>Show this at the door</h2>
      <div style={{ background: '#fff', width: size, height: size, boxSizing: 'border-box', padding: `calc(${size} * 0.06)`, borderRadius: `calc(${size} * 0.08)`, boxShadow: '0 0 0 2px #eee' }}>
        <Suspense fallback={null}><TicketQrCode fill token={doorUrl(window.location.origin, token)} /></Suspense>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
        {who.photoUrl ? <img src={who.photoUrl} alt="Your photo" width={60} height={60} style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', border: '2px solid #eee' }} />
          : <span aria-label="Your photo" data-testid="golden-door-avatar" style={{ width: 60, height: 60, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg,#f2b544,#dc4433)', color: '#fff', fontWeight: 800, fontSize: 25, border: '2px solid #eee' }}>{who.name.slice(0, 1)}</span>}
        <div><b style={{ display: 'block', fontSize: 22, fontWeight: 800 }}>{who.name}</b><span style={{ fontSize: 14, color: '#555' }}>Free entry, {who.event}</span></div>
      </div>
      <p style={{ margin: 0, fontSize: 13, color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Sun size={16} aria-hidden="true" /> <span>Turn your screen brightness all the way up</span></p>
    </section>,
    document.body,
  );
};

const RaffleDoorView = ({ token, onBack, who }: { token: string; onBack: () => void; who?: DoorWho }) => who ? <GoldenDoor token={token} onBack={onBack} who={who} /> : (
  <section data-testid="raffle-door-view" style={{ display: 'grid', gap: 12, justifyItems: 'center', textAlign: 'center' }}>
    <div style={{ width: '100%', maxWidth: 320 }}>
      <Suspense fallback={null}><TicketQrCode token={doorUrl(window.location.origin, token)} /></Suspense>
    </div>
    <b style={{ fontSize: 20 }}>Show this at the door.</b>
    <p style={{ margin: 0, fontSize: 14 }}>This code does not expire. Your organiser can cancel it.</p>
    <button type="button" className="da-tap" data-testid="raffle-door-back" onClick={onBack}
      style={{ minHeight: 48, width: '100%', borderRadius: 12, border: '1px solid var(--da-border)', background: 'none', color: 'var(--da-text)', fontWeight: 700, fontSize: 15 }}>
      Back to my dashboard
    </button>
  </section>
);

export default RaffleDoorView;
