import { lazy, Suspense, useEffect, useRef } from 'react';
import { Sun } from 'lucide-react';

import { doorUrl } from '../../../raffle-win/model';

// The generator rides with this lazy file only.
const TicketQrCode = lazy(() => import('../../../tickets/TicketQrCode'));

/** Full-screen door view: big QR, caption, note, back to the dashboard. */
export type DoorWho = { name: string; photoUrl: string | null; event: string };

/** Golden Ticket door: Done on top (focused, Esc closes), big QR, who, brightness hint. */
const GoldenDoor = ({ token, onBack, who }: { token: string; onBack: () => void; who: DoorWho }) => {
  const done = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    done.current?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onBack(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onBack]);
  return (
    <section data-testid="raffle-door-view" style={{ display: 'grid', gap: 12, justifyItems: 'center', textAlign: 'center' }}>
      <button ref={done} type="button" className="da-tap" data-testid="raffle-door-back" onClick={onBack}
        style={{ minHeight: 48, minWidth: 96, justifySelf: 'end', borderRadius: 12, border: '1px solid var(--da-border)', background: 'none', color: 'var(--da-text)', fontWeight: 700, fontSize: 15 }}>
        Done
      </button>
      <b style={{ fontSize: 20 }}>Show this at the door</b>
      <div style={{ width: '100%', maxWidth: 320 }}>
        <Suspense fallback={null}><TicketQrCode token={doorUrl(window.location.origin, token)} /></Suspense>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', textAlign: 'left' }}>
        {who.photoUrl ? <img src={who.photoUrl} alt="Your photo" width={48} height={48} style={{ borderRadius: '50%', objectFit: 'cover' }} />
          : <span aria-label="Your photo" style={{ width: 48, height: 48, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--da-border)', fontWeight: 800 }}>{who.name.slice(0, 1)}</span>}
        <div><b style={{ display: 'block' }}>{who.name}</b><span style={{ fontSize: 14 }}>Free entry, {who.event}</span></div>
      </div>
      <p style={{ margin: 0, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Sun size={16} aria-hidden="true" /> <span>Turn your screen brightness all the way up</span></p>
    </section>
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
