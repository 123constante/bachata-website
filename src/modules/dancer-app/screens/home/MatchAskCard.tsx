import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/modules/organiser/ui';
import { flags } from '@/lib/featureFlags';
import { answerMatch, fetchMatchCandidates, type MatchAnswer, type MatchCandidate } from '@/lib/profileMatch';
import { buttonStyle } from '../nights/nightsStyles';

export const MATCH_CANDIDATES_KEY = ['profile-match-candidates'] as const;

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');

const Photo = ({ c }: { c: MatchCandidate }) =>
  c.avatar_url ? (
    <img src={c.avatar_url} alt="" width={64} height={64} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', flex: 'none' }} />
  ) : (
    <div aria-hidden="true" style={{ width: 64, height: 64, borderRadius: '50%', background: '#9ca3af', color: '#fff', fontWeight: 800, fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
      {initials(c.name)}
    </div>
  );

const OneCandidate = ({ c, onHide }: { c: MatchCandidate; onHide: () => void }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [thanks, setThanks] = useState(false);
  const send = async (answer: MatchAnswer) => {
    setBusy(true);
    setError(false);
    try {
      await answerMatch(c.id, answer);
      if (answer === 'me') setThanks(true);
      else onHide();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card variant="padded" testId={`match-ask-card-${c.id}`}>
      {thanks ? (
        <p style={{ margin: 0, fontSize: 15 }} data-testid="match-ask-thanks">Thanks. We'll check and link it to you, usually within a day.</p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Photo c={c} />
            <div style={{ minWidth: 0 }}>
              <b style={{ fontSize: 18, display: 'block' }}>{c.name}</b>
              {c.city && <span className="da-muted" style={{ fontSize: 15 }}>{c.city}</span>}
            </div>
          </div>
          <button type="button" className="da-tap" disabled={busy} data-testid="match-ask-yes" style={{ ...buttonStyle, border: 0, width: '100%' }} onClick={() => void send('me')}>
            {busy ? 'Saving...' : 'Yes, this is me'}
          </button>
          <button type="button" className="da-tap" disabled={busy} data-testid="match-ask-no" style={{ background: 'none', border: '1px solid var(--da-border)', borderRadius: 12, color: 'var(--da-text)', fontWeight: 700 }} onClick={() => void send('not_me')}>
            {busy ? 'Saving...' : 'No, not me'}
          </button>
          {error && <p role="alert" style={{ margin: 0, fontSize: 15 }} data-testid="match-ask-error">Something went wrong. Try again.</p>}
        </div>
      )}
    </Card>
  );
};

/** Top of the signed-in dancer home. Flag off, or no candidates: renders nothing. */
export const MatchAskCard = () => {
  const q = useQuery({ queryKey: MATCH_CANDIDATES_KEY, queryFn: fetchMatchCandidates, enabled: flags.profileMatchAsk, staleTime: 60_000 });
  // "No, not me" hides that card here, so the heading goes with the last one.
  const [gone, setGone] = useState<string[]>([]);
  const list = (flags.profileMatchAsk ? q.data ?? [] : []).filter((c) => !gone.includes(c.id));
  if (list.length === 0) return null;
  return (
    <div style={{ display: 'grid', gap: 12, marginBottom: 12 }} data-testid="match-ask">
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Is this you?</h2>
        <p className="da-muted" style={{ margin: '4px 0 0', fontSize: 15 }}>The Bachata Calendar team may have made a page for you already.</p>
      </div>
      {list.map((c) => (
        // No refetch after an answer: the card thanks or hides locally; the next visit reads fresh.
        <OneCandidate key={c.id} c={c} onHide={() => setGone((g) => [...g, c.id])} />
      ))}
    </div>
  );
};

export default MatchAskCard;
