import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/modules/organiser/ui';
import { useAuth } from '@/hooks/useAuth';
import { rpcLoose } from '@/integrations/supabase/rpcLoose';
import { triggerGlobalConfetti } from '@/lib/confetti';
import { parseMyWins, takeFreshFlag } from './raffleWinModel';
import RaffleDoorView from './RaffleDoorView';

const TicketQrCode = lazy(() => import('../../../tickets/TicketQrCode'));

const plainButton = { background: 'none', border: 0, padding: 0, color: 'inherit', font: 'inherit', textAlign: 'left' as const };
const linkBtn = { ...plainButton, minHeight: 44, textDecoration: 'underline', textUnderlineOffset: 3, fontWeight: 600, fontSize: 14, color: 'var(--da-accent)' };

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
  const q = useQuery({
    queryKey: ['raffle_my_wins_v1', user?.id],
    enabled: signedIn,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await rpcLoose('raffle_my_wins_v1');
      if (error) throw new Error(error.message);
      return parseMyWins(data);
    },
  });
  const card = q.data ?? null;
  const hasCard = !!card;
  useEffect(() => { if (fresh && hasCard) triggerGlobalConfetti(); }, [fresh, hasCard]);

  if (!signedIn || !card) return null;
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
              {n.posterUrl && <img data-testid="raffle-win-flyer" src={n.posterUrl} alt="" width={64} height={80} style={{ objectFit: 'cover', borderRadius: 10, flex: 'none' }} />}
              <div>
                <b data-testid="raffle-win-title" style={{ fontSize: 17 }}>{n.title}</b>
                <div data-testid="raffle-win-date" style={{ fontSize: 14, fontWeight: 600 }}>{n.dateLine}</div>
                {n.venue && <div data-testid="raffle-win-venue" style={{ fontSize: 13 }}>{n.venue}</div>}
              </div>
            </div>
          ) : (
            <b data-testid="raffle-win-locked">Your night is locked.</b>
          )}
          <div ref={qrRef} style={{ display: 'grid', justifyItems: 'center', gap: 6 }}>
            <button type="button" className="da-tap" data-testid="raffle-win-qr" aria-label="Enlarge the QR for the door"
              onClick={() => setDoor(true)} style={{ ...plainButton, width: 168, lineHeight: 0 }}>
              <Suspense fallback={null}><TicketQrCode token={`r:${card.qrToken}`} /></Suspense>
            </button>
            <b style={{ fontSize: 15 }}>Show this at the door.</b>
            {fresh && n && (
              <button type="button" className="da-tap" data-testid="raffle-win-share" style={linkBtn} onClick={() => onShare?.()}>
                Share my win
              </button>
            )}
          </div>
        </div>
      </Card>
    </section>
  );
};

export default HomeRaffleWin;
