import { lazy, Suspense, useEffect, useRef, useState } from 'react';

import { Card } from '@/modules/organiser/ui';
import { useAuth } from '@/hooks/useAuth';
import { rpcLoose } from '@/integrations/supabase/rpcLoose';
import { flags } from '@/lib/featureFlags';
import { londonTodayKey } from '@/lib/londonDate';
import { useMyDancerEdit } from '../../api/useMyDancerEdit';

import { doorUrl } from '../../../raffle-win/model';
import { daysUntilKey, parseMyWins, takeFreshFlag, type RaffleWinCard } from './raffleWinModel';
import RaffleDoorView from './RaffleDoorView';

const TicketQrCode = lazy(() => import('../../../tickets/TicketQrCode'));

// Decorative, fresh view only. NOT src/lib/confetti.ts: the event page imports that, and sharing it
// would make it a shared chunk (+1 first-load request on /event, chunk ratchet). A failed load no-ops.
const fireConfetti = () => {
  import('canvas-confetti').then((m) => m.default({ particleCount: 120, spread: 80, origin: { y: 0.3 } })).catch(() => undefined);
};

const plainButton = { background: 'none', border: 0, padding: 0, color: 'inherit', font: 'inherit', textAlign: 'left' as const };
const linkBtn = { ...plainButton, minHeight: 44, textDecoration: 'underline', textUnderlineOffset: 3, fontWeight: 600, fontSize: 14, color: 'var(--da-accent)' };

const GT_CSS = `
.gt-cf{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.gt-cf i{position:absolute;left:var(--x);top:var(--y);width:8px;height:8px;border-radius:2px;background:var(--c);animation:gt-fall var(--d) linear var(--w) infinite}
@keyframes gt-fall{from{transform:translateY(-20px) rotate(0)}to{transform:translateY(160px) rotate(360deg)}}
@keyframes gt-drop{from{transform:translateY(-40px) scale(.9);opacity:0}to{transform:none;opacity:1}}
@keyframes gt-pop{from{transform:scale(1.6);opacity:0}to{transform:scale(1);opacity:1}}
.gt-drop{animation:gt-drop .6s cubic-bezier(.2,.9,.3,1.2) both}
.gt-stamp{rotate:-8deg;animation:gt-pop .5s both}
@media (prefers-reduced-motion:reduce){.gt-cf{display:none}.gt-drop,.gt-stamp{animation:none}}`;
const CONFETTI = ['#f2b544', '#dc4433', '#ffffff', '#62d39d', '#ff9d8f'];
const gtBtn = (primary: boolean) => ({ minHeight: 48, width: '100%', borderRadius: 14, fontWeight: 800, fontSize: 15, border: primary ? 0 : '1px solid var(--da-border)', background: primary ? 'var(--da-accent)' : 'none', color: primary ? 'var(--da-on-accent, #fff)' : 'var(--da-text)' });
const NO_STUB = { display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '14px 16px', minHeight: 124, textAlign: 'left' as const };

/** Golden Ticket (VITE_ENABLE_RAFFLE_GOLDEN_TICKET): the five win states on the dancer home. */
const GoldenWin = ({ card, fresh, onRetry, onShare }: { card: RaffleWinCard; fresh: boolean; onRetry: () => void; onShare?: () => void }) => {
  const profile = useMyDancerEdit({ staleTime: 60_000 }).data;
  const [door, setDoor] = useState(false);
  const [toast, setToast] = useState('');
  const n = card.night;
  const first = profile?.first_name?.trim() || 'there';
  const title = n?.title ?? 'your night';
  if (door) return <RaffleDoorView token={card.qrToken} onBack={() => setDoor(false)} who={{ name: first, photoUrl: profile?.avatar_url ?? null, event: title }} />;
  const share = async () => {
    onShare?.();
    const url = window.location.origin;
    try {
      if (typeof navigator.share === 'function') { await navigator.share({ title, text: `I won a free night at ${title}!`, url }); return; }
      await navigator.clipboard.writeText(url);
      setToast('Link copied. Send it to a friend!');
    } catch { /* cancelled or blocked: nothing to say */ }
  };
  const h = new Date().getHours();
  const hi = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  const days = n?.dateKey ? daysUntilKey(londonTodayKey(), n.dateKey) : null;
  const when = days === null ? '' : days <= 0 ? 'is tonight' : days === 1 ? 'is tomorrow' : `is in ${days} days`;
  const won = fresh && !card.attended && !!n;
  const heading = won ? `You won, ${first}!` : card.attended ? 'You\u2019re in. Enjoy the night!' : n ? `Your free night ${when}` : 'Your free night';
  const meta = { margin: '2px 0 0', fontSize: 14, display: 'flex', gap: 6, alignItems: 'center' };
  const shareBtn = <button type="button" className="da-tap" data-testid="gt-share" style={gtBtn(won)} onClick={() => void share()}>&#8599; Tell a friend</button>;
  return (
    <section data-testid="raffle-win-card" style={{ display: 'grid', gap: 12, position: 'relative' }}>
      <style>{GT_CSS}</style>
      {won && (
        <div className="gt-cf" aria-hidden="true" data-testid="gt-confetti">
          {Array.from({ length: 18 }, (_, i) => (
            <i key={i} style={{ '--x': `${(i * 37 + 9) % 100}%`, '--y': `${(i * 23) % 80}%`, '--c': CONFETTI[i % 5], '--d': `${2.6 + (i % 5) * 0.5}s`, '--w': `-${((i * 0.37) % 3).toFixed(2)}s` } as React.CSSProperties} />
          ))}
        </div>
      )}
      {!won && <p style={{ margin: 0, fontSize: 14 }}>{hi}, {first}</p>}
      <h1 data-testid="gt-heading" style={{ margin: 0, fontSize: won ? 28 : 24 }}>{heading}</h1>
      {won && <p style={{ margin: 0, fontSize: 15 }}>Free entry to {title}. This is your ticket.</p>}
      <div data-testid="raffle-win-ticket" className={won ? 'gt-drop' : undefined} style={{ borderRadius: 22, overflow: 'hidden', border: '1px solid var(--da-border)', background: 'var(--da-card, transparent)' }}>
        {n ? (
          <>
            <div style={{ position: 'relative', height: 170, display: 'grid', placeItems: 'center', background: n.posterUrl ? undefined : 'var(--da-border)' }}>
              {n.posterUrl ? <img data-testid="raffle-win-flyer" src={n.posterUrl} alt="" width={400} height={170} style={{ width: '100%', height: 170, objectFit: 'cover' }} /> : <b data-testid="gt-flyer-title" style={{ fontSize: 22 }}>{n.title}</b>}
              {!card.attended && <span data-testid="gt-chip" style={{ position: 'absolute', top: 12, left: 12, background: 'var(--da-accent)', color: 'var(--da-on-accent, #fff)', fontWeight: 800, fontSize: 12, padding: '4px 10px', borderRadius: 10 }}>FREE ENTRY</span>}
              {card.attended && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(20,60,40,.55)' }}><em className="gt-stamp" data-testid="gt-stamp" style={{ fontStyle: 'normal', fontWeight: 800, fontSize: 34, color: '#fff', border: '4px solid #fff', borderRadius: 14, padding: '4px 18px' }}>YOU&rsquo;RE IN</em></div>}
            </div>
            <div style={{ padding: '14px 16px 12px' }}>
              <b data-testid="raffle-win-title" style={{ fontSize: 18 }}>{n.title}</b>
              <p data-testid="raffle-win-date" style={meta}>&#128197; {n.dateLine}{n.timeLine ? `, ${n.timeLine}` : ''}</p>
              {n.venue && <p data-testid="raffle-win-venue" style={meta}>&#128205; {n.venue}</p>}
            </div>
          </>
        ) : (
          <div data-testid="gt-lockbox" style={{ padding: '18px 16px', display: 'grid', gap: 8, justifyItems: 'center', textAlign: 'center' }}>
            <span aria-hidden="true" style={{ fontSize: 26 }}>&#128274;</span>
            <b style={{ fontSize: 18 }}>Your night is locked</b>
            <p style={{ margin: 0, fontSize: 14 }}>We can&rsquo;t show the details right now. Your free entry is safe and your code still works.</p>
            <button type="button" className="da-tap" data-testid="gt-retry" style={gtBtn(false)} onClick={onRetry}>Try again</button>
          </div>
        )}
        <div style={{ position: 'relative', borderTop: '2px dashed var(--da-border)', margin: '0 14px' }} data-testid="gt-perf" />
        {card.attended ? (
          <div data-testid="raffle-win-attended" style={NO_STUB}>
            <span aria-hidden="true" style={{ width: 92, height: 92, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 48, background: 'rgba(98,211,157,.2)', color: '#2a9d6a', flex: 'none' }}>&#10003;</span>
            <span><b style={{ display: 'block', fontSize: 17 }}>The door has scanned you</b><span style={{ fontSize: 13 }}>Nothing more to show. Go and dance.</span></span>
          </div>
        ) : (
          <button type="button" className="da-tap" data-testid="raffle-win-qr" aria-label="Tap to show at the door" onClick={() => setDoor(true)} style={{ ...plainButton, ...NO_STUB }}>
            <span style={{ width: 92, flex: 'none', lineHeight: 0 }}><Suspense fallback={null}><TicketQrCode token={doorUrl(window.location.origin, card.qrToken)} /></Suspense></span>
            <span>
              <b style={{ display: 'block', fontSize: 17, lineHeight: 1.2 }}>Tap to show at the door</b>
              <span style={{ fontSize: 13 }}>Opens big and bright</span><br />
              <span style={{ display: 'inline-block', marginTop: 8, background: 'var(--da-accent)', color: 'var(--da-on-accent, #fff)', fontWeight: 800, fontSize: 13, padding: '8px 12px', borderRadius: 14 }}>&#10530; Make it big</span>
            </span>
          </button>
        )}
      </div>
      {(won || card.attended || !!n) && shareBtn}
      {!card.attended && <p data-testid="gt-safe" style={{ margin: 0, fontSize: 13, display: 'flex', gap: 8 }}>&#128737;&#65039; <span>Your code never runs out. Only the organiser can cancel it.</span></p>}
      {toast && <div role="status" data-testid="gt-toast" style={{ fontSize: 14, fontWeight: 600 }}>{toast}</div>}
    </section>
  );
};

/**
 * Dashboard ticket card for a raffle winner (lazy: mounted by HomeScreen, so it rides outside the
 * first load). Renders NOTHING when the signed-in user has no locked win. `onShare` is supplied by W6.
 */
const HomeRaffleWin = ({ onShare }: { onShare?: () => void }) => {
  const { user } = useAuth();
  const signedIn = !!user && !user.is_anonymous;
  const [fresh] = useState(takeFreshFlag);
  const [door, setDoor] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  // Plain effect, not react-query: Home renders in tests and shells without a QueryClientProvider.
  const [card, setCard] = useState<RaffleWinCard | null>(null);
  const [tick, setTick] = useState(0);
  const userId = user?.id;
  useEffect(() => {
    if (!signedIn) { setCard(null); return; }
    let live = true;
    void (async () => {
      try {
        const { data, error } = await rpcLoose('raffle_my_wins_v1');
        if (live) setCard(error ? null : parseMyWins(data));
      } catch {
        if (live) setCard(null);
      }
    })();
    return () => { live = false; };
  }, [signedIn, userId, tick]);
  const hasCard = !!card;
  useEffect(() => { if (fresh && hasCard) fireConfetti(); }, [fresh, hasCard]);

  if (!signedIn || !card) return null;
  if (flags.raffleGoldenTicket) return <GoldenWin card={card} fresh={fresh} onRetry={() => setTick((t) => t + 1)} onShare={onShare} />;
  if (door) return <RaffleDoorView token={card.qrToken} onBack={() => setDoor(false)} />;
  const n = card.night;
  return (
    <section data-testid="raffle-win-card" style={{ display: 'grid', gap: 8 }}>
      {fresh ? (
        <div data-testid="raffle-win-banner">
          <h1 style={{ margin: 0, fontSize: 24 }}>You are in</h1>
          <button type="button" className="da-tap" data-testid="raffle-win-banner-link" style={linkBtn}
            onClick={() => qrRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })}>
            Saved in your dashboard. We have emailed it to you.
          </button>
        </div>
      ) : (
        <h1 style={{ margin: 0, fontSize: 24 }}>Your dashboard</h1>
      )}
      <Card variant="padded" testId="raffle-win-ticket">
        <div style={{ display: 'grid', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase' }}>Your free night</span>
          {n ? (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {n.posterUrl && <img data-testid="raffle-win-flyer" src={n.posterUrl} alt="" loading="lazy" width={64} height={80} style={{ objectFit: 'cover', borderRadius: 10, flex: 'none' }} />}
              <div>
                <b data-testid="raffle-win-title" style={{ fontSize: 17 }}>{n.title}</b>
                <div data-testid="raffle-win-date" style={{ fontSize: 14, fontWeight: 600 }}>{n.dateLine}</div>
                {n.venue && <div data-testid="raffle-win-venue" style={{ fontSize: 13 }}>{n.venue}</div>}
              </div>
            </div>
          ) : (
            <b data-testid="raffle-win-locked">Your night is locked.</b>
          )}
          {card.attended ? (
            <b data-testid="raffle-win-attended" style={{ fontSize: 15 }}>You&rsquo;re in. Enjoy the night</b>
          ) : (
          <div ref={qrRef} style={{ display: 'grid', justifyItems: 'center', gap: 6 }}>
            <button type="button" className="da-tap" data-testid="raffle-win-qr" aria-label="Enlarge the QR for the door"
              onClick={() => setDoor(true)} style={{ ...plainButton, width: 168, lineHeight: 0 }}>
              <Suspense fallback={null}><TicketQrCode token={doorUrl(window.location.origin, card.qrToken)} /></Suspense>
            </button>
            <b style={{ fontSize: 15 }}>Show this at the door.</b>
            {fresh && n && (
              <button type="button" className="da-tap" data-testid="raffle-win-share" style={linkBtn} onClick={() => onShare?.()}>
                Share my win
              </button>
            )}
          </div>
          )}
        </div>
      </Card>
    </section>
  );
};

export default HomeRaffleWin;
