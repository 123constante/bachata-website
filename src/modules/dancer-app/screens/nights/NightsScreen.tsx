import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMyDancerEdit } from '../home/useMyDancerEdit';
import { LevelVote } from './LevelVote';
import { statusLabel, placeAndTime, type Night } from './nightsModel';
import { linkStyle } from './nightsStyles';
import { DateBlock, StatusPill } from './nightsUi';
import { useBrowseHref } from './useBrowseHref';
import { useMyNights } from './useMyNights';

const rowStyle = { display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 0', borderTop: '1px solid var(--da-border)' } as const;

const NightRow = ({ night, profileComplete, focused, past }: { night: Night; profileComplete: boolean; focused: boolean; past: boolean }) => {
  const ref = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView?.({ block: 'center' });
  }, [focused]);
  return (
    <li ref={ref} data-testid="night-row" data-series={night.seriesId} data-focused={focused ? 'true' : undefined} style={{ ...rowStyle, ...(focused ? { outline: '2px solid var(--da-accent)', outlineOffset: 2, borderRadius: 10 } : null) }}>
      <DateBlock dateKey={night.date} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <a href={night.href} style={{ color: 'var(--da-text)', fontWeight: 700, fontSize: 15, overflowWrap: 'anywhere' }}>
            {night.name}
          </a>
          <StatusPill label={statusLabel(night)} />
        </div>
        <div className="da-muted" style={{ fontSize: 13 }}>{placeAndTime(night) || 'Place to be confirmed'}</div>
        {past && !night.isFestival && night.status !== 'other' && (
          <div style={{ marginTop: 6 }}>
            <LevelVote seriesId={night.seriesId} profileComplete={profileComplete} />
          </div>
        )}
      </div>
    </li>
  );
};

const NightsScreen = () => {
  const { isLoading, isError, retry, nights } = useMyNights();
  const profile = useMyDancerEdit();
  const browseHref = useBrowseHref();
  const [params] = useSearchParams();
  const focus = params.get('focus');
  const complete = profile.data?.complete === true;
  // One focused row: the most recent past night of that series.
  const focusedKey = focus ? nights.past.find((n) => n.seriesId === focus) : undefined;

  return (
    <div data-testid="dancer-screen-nights" style={{ display: 'grid', gap: 12 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Nights</h1>
      {isLoading && <p className="da-muted" role="status">Loading your nights&hellip;</p>}
      {isError && (
        <div className="da-card" role="alert">
          <p style={{ margin: 0 }}>We couldn&rsquo;t load your nights.</p>
          <button type="button" className="da-tap" onClick={retry} style={{ ...linkStyle, background: 'none', border: 0 }}>Try again</button>
        </div>
      )}
      {!isLoading && !isError && (
        <>
          <section className="da-card" aria-label="Upcoming nights" data-testid="nights-upcoming">
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px' }}>Upcoming</h2>
            {nights.upcoming.length === 0 ? (
              <p style={{ margin: 0, fontSize: 14 }} data-testid="nights-upcoming-empty">
                You&rsquo;re not going to anything yet.{' '}
                <a href={browseHref} style={linkStyle}>Browse what&rsquo;s on</a>
              </p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {nights.upcoming.map((n, i) => (
                  <NightRow key={`${n.seriesId}-${n.date}-${i}`} night={n} profileComplete={complete} focused={false} past={false} />
                ))}
              </ul>
            )}
          </section>
          <section className="da-card" aria-label="Past nights" data-testid="nights-past">
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px' }}>Past</h2>
            {nights.past.length === 0 ? (
              <p className="da-muted" style={{ margin: 0, fontSize: 14 }} data-testid="nights-past-empty">
                Your past nights will appear here.
              </p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {nights.past.map((n, i) => (
                  <NightRow key={`${n.seriesId}-${n.date}-${i}`} night={n} profileComplete={complete} focused={n === focusedKey} past />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default NightsScreen;
