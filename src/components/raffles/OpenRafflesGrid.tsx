// =============================================================================
// OpenRafflesGrid — the "Live raffles" band on the /raffles page.
//
// Renders a compact 2-up (mobile) grid of every event with an open raffle.
// Card hierarchy (dancer-first): day chip (Tonight / Tomorrow / Friday 13 Jun)
// -> event name as the hero (links to the event page) -> demoted "Win:" prize
// line -> live countdown + entry count -> Enter button + "we only call the
// winner" reassurance. Entering opens the EXISTING RaffleEntryDialog inline
// (same submit_raffle_entry flow as the event page — no navigation, no payment).
//
// Balancing: a 2-column grid with an odd number of cards leaves an orphan in
// the last row, so when the count is odd we append a soft CTA "filler" tile.
// =============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { OpenRaffle } from '@/hooks/useOpenRaffles';
import { RaffleEntryDialog } from '@/modules/event-page/bento/modals/RaffleEntryDialog';
import { raffleEnteredKey } from '@/lib/raffleSession';
import {
  parseCutoffMs,
  countdownParts,
  raffleDayLabel,
  useRaffleNow,
} from '@/modules/event-page/utils/raffleCountdown';

const HOT_THRESHOLD_MS = 30 * 60_000; // < 30 min to close = urgent (red)

function isAlreadyEntered(eventId: string): boolean {
  try {
    const key = raffleEnteredKey(eventId);
    return !!key && window.sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

// -- Live "closes in" pill ----------------------------------------------------
const CardCountdown: React.FC<{ cutoffAt: string | null }> = ({ cutoffAt }) => {
  const cutoffMs = parseCutoffMs(cutoffAt);
  const now = useRaffleNow(cutoffMs, false);
  if (cutoffMs == null) return <span className="rp-cd">&mdash;</span>;

  const remaining = cutoffMs - now;
  if (remaining <= 0) return <span className="rp-cd rp-cd-hot">Closing</span>;

  const { days, hours, mins } = countdownParts(remaining);
  const label =
    days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  const hot = remaining <= HOT_THRESHOLD_MS;
  return <span className={`rp-cd${hot ? ' rp-cd-hot' : ''}`}>{label}</span>;
};

// -- One raffle card ----------------------------------------------------------
const RaffleCard: React.FC<{
  raffle: OpenRaffle;
  entered: boolean;
  onEnter: (r: OpenRaffle) => void;
}> = ({ raffle, entered, onEnter }) => {
  const day = raffleDayLabel(raffle.start_time);
  const showVenue = !!raffle.venue_name && raffle.venue_name !== raffle.title;
  return (
    <article className="rp-card">
      {day && (
        <div className="rp-card-top">
          <span className={`rp-day rp-day-${day.tone}`}>{day.label}</span>
        </div>
      )}
      <Link to={`/event/${raffle.event_id}`} className="rp-title">
        <span className="rp-title-name">{raffle.title}</span>
        {showVenue && <span className="rp-title-venue">{raffle.venue_name}</span>}
      </Link>
      <p className="rp-prize">
        <span className="rp-prize-lbl">Win:</span>{' '}
        {raffle.prize_text || 'a free night of dancing'}
      </p>
      <div className="rp-meta">
        <div className="rp-mbox">
          <CardCountdown cutoffAt={raffle.cutoff_at} />
          <span className="rp-mcap">Closes in</span>
        </div>
        <div className="rp-mbox">
          <span className="rp-num">{raffle.entry_count}</span>
          <span className="rp-mcap">Dancers in</span>
        </div>
      </div>
      {entered ? (
        <div className="rp-entered">{'\u{1F389}'} You&rsquo;re in</div>
      ) : (
        <button className="rp-enter" onClick={() => onEnter(raffle)}>
          Enter raffle
        </button>
      )}
      <div className="rp-reassure">Free &middot; we only call the winner</div>
    </article>
  );
};

// -- Filler tile (keeps the 2-col grid balanced on odd counts) ----------------
const FillerTile: React.FC = () => (
  <Link to="/parties" className="rp-card rp-filler">
    <span className="rp-filler-emoji" aria-hidden="true">{'\u{1F3B0}'}</span>
    <span className="rp-filler-txt">More raffles drop before parties</span>
    <span className="rp-filler-cta">Browse what&rsquo;s on &rarr;</span>
  </Link>
);

interface Props {
  raffles: OpenRaffle[];
  loading: boolean;
  error: boolean;
}

export const OpenRafflesGrid: React.FC<Props> = ({ raffles, loading, error }) => {
  const [selected, setSelected] = useState<OpenRaffle | null>(null);
  // Track which events this browser has entered (seeded from sessionStorage).
  const [enteredIds, setEnteredIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const next = new Set<string>();
    for (const r of raffles) if (isAlreadyEntered(r.event_id)) next.add(r.event_id);
    setEnteredIds(next);
  }, [raffles]);

  const handleEnter = useCallback((r: OpenRaffle) => setSelected(r), []);

  const handleSubmitted = useCallback(() => {
    if (!selected) return;
    const id = selected.event_id;
    try {
      const key = raffleEnteredKey(id);
      if (key) window.sessionStorage.setItem(key, '1');
    } catch {
      /* sandboxed storage — non-fatal */
    }
    setEnteredIds((prev) => new Set(prev).add(id));
  }, [selected]);

  return (
    <section id="rp-live" className="rp-section">
      <div className="rp-head">
        <h2 className="rp-h2">Live raffles</h2>
        <span className="rp-livedot"><i />Open now</span>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rp-card rp-skel" />
          ))}
        </div>
      ) : error || raffles.length === 0 ? (
        <div className="rp-empty">
          <span className="rp-empty-emoji" aria-hidden="true">{'\u{1F3B0}'}</span>
          <p className="rp-empty-title">No live raffles right now</p>
          <p className="rp-empty-sub">
            Raffles open in the hours before a party. Check back soon &mdash; or browse
            what&rsquo;s on tonight.
          </p>
          <Link to="/tonight" className="rp-empty-cta">See tonight&rsquo;s parties &rarr;</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {raffles.map((r) => (
            <RaffleCard
              key={r.event_id}
              raffle={r}
              entered={enteredIds.has(r.event_id)}
              onEnter={handleEnter}
            />
          ))}
          {/* balance the 2-up grid when the card count is odd */}
          {raffles.length % 2 === 1 && <FillerTile />}
        </div>
      )}

      <RaffleEntryDialog
        open={!!selected}
        onOpenChange={(v) => { if (!v) setSelected(null); }}
        eventId={selected?.event_id ?? ''}
        consentVersion={selected?.consent_version ?? null}
        onSubmitted={handleSubmitted}
      />
    </section>
  );
};

export default OpenRafflesGrid;
