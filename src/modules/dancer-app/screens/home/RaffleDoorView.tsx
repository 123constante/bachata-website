import { lazy, Suspense } from 'react';

// The generator rides with this lazy file only.
const TicketQrCode = lazy(() => import('../../../tickets/TicketQrCode'));

/** Full-screen door view: big QR, caption, note, back to the dashboard. */
const RaffleDoorView = ({ token, onBack }: { token: string; onBack: () => void }) => (
  <section data-testid="raffle-door-view" style={{ display: 'grid', gap: 12, justifyItems: 'center', textAlign: 'center' }}>
    <div style={{ width: '100%', maxWidth: 320 }}>
      <Suspense fallback={null}><TicketQrCode token={`r:${token}`} /></Suspense>
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
