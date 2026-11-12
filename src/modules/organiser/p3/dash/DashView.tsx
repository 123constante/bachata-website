import { Link } from 'react-router-dom';
import { P3_PATHS } from '../shell/paths';
import { captionOf, whatsappHref } from './shareLinks';
import type { Control, DashModel } from './dashModel';

/** Presentational Home for the organiser dashboard (slice 1). Every fact comes from buildDash. */
function Btn({ c, onClick, to, testId, primary }: { c: Control; onClick?: () => void; to?: string; testId: string; primary?: boolean }) {
  const cls = primary ? 'p3-btn' : 'p3-btn p3-btn-line';
  return (
    <span>
      {to && !c.disabled ? <Link className={cls} style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }} to={to} aria-describedby={c.reason ? `${testId}-why` : undefined} data-testid={testId}>{c.label}</Link> :
      <button type="button" className={cls} style={{ minHeight: 44 }} disabled={c.disabled} aria-describedby={c.reason ? `${testId}-why` : undefined} onClick={onClick} data-testid={testId}>
        {c.label}
      </button>}
      {c.reason && <span className="p3-note" id={`${testId}-why`} data-testid={`${testId}-why`}> {c.reason}</span>}
    </span>
  );
}

export interface DashViewProps {
  model: DashModel;
  pageName: string;
  onShareNight?: (key: string) => void;
  onSharePage?: () => void;
  onRetry?: () => void;
  /** Real page link; the caption sheet and "Tell your group" use it. */
  pageLink?: string | null;
  /** Said after a share lands, e.g. "Link copied". */
  notice?: string | null;
  /** Analytics read failed: the page still draws, without opens, plus an inline retry. */
  analyticsFailed?: boolean;
}

export function DashView({ model: m, pageName, onShareNight, onSharePage, onRetry, pageLink = null, notice = null, analyticsFailed = false }: DashViewProps) {
  if (m.load === 'loading') {
    return (
      <div className="p3-card p3-state" data-testid="dash-loading" aria-busy="true">
        <strong>Loading your nights&hellip;</strong>
        <p className="p3-note">Buttons wake up as soon as your nights load.</p>
        <Btn c={{ ...m.sharePage, disabled: true, reason: 'Wakes up when your nights load.' }} testId="dash-share-page" />
      </div>
    );
  }
  if (m.load === 'error') {
    return (
      <div className="p3-card p3-state" role="alert" data-testid="dash-error">
        <strong>We couldn&rsquo;t load your nights</strong>
        <p>Your page and events are still live. Check your connection, then try again.</p>
        <button type="button" className="p3-btn p3-btn-line" style={{ minHeight: 44 }} onClick={onRetry} data-testid="dash-retry">Try again</button>
        <Btn c={m.sharePage} onClick={onSharePage} testId="dash-share-page" />
      </div>
    );
  }
  const hero = m.hero!;
  const nightLink = hero.night?.link ?? null;
  const noLink = hero.action === 'share-night' && !nightLink;
  return (
    <div className="p3-stack" data-testid="dash">
      <section className="p3-card p3-hero" aria-label={hero.title} data-testid="dash-hero" data-kind={hero.kind}>
        <div className="p3-hero-name">{hero.title}</div>
        {hero.headline && <div className="p3-when" data-testid="dash-headline">{hero.headline}</div>}
        <div className="p3-row-s">{hero.why}</div>
        {hero.action === 'new-event' ? (
          <Link className="p3-btn" style={{ minHeight: 44 }} to={P3_PATHS.create} data-testid="dash-hero-action">{hero.actionLabel}</Link>
        ) : (
          <span>
            <button type="button" className="p3-btn" style={{ minHeight: 44 }} disabled={noLink} aria-describedby={noLink ? 'dash-hero-action-why' : undefined} onClick={() => hero.night && onShareNight?.(hero.night.key)} data-testid="dash-hero-action">{hero.actionLabel}</button>
            {noLink && <span className="p3-note" id="dash-hero-action-why" data-testid="dash-hero-action-why"> This night has no public link yet.</span>}
          </span>
        )}
        {nightLink && hero.night && (
          <details data-testid="dash-caption">
            <summary style={{ minHeight: 44 }}>Caption for your group</summary>
            <p className="p3-row-s" style={{ whiteSpace: 'pre-line' }} data-testid="dash-caption-text">{captionOf(hero.night.name, hero.night.when, nightLink)}</p>
            <a className="p3-btn p3-btn-line" style={{ minHeight: 44 }} href={whatsappHref(`${captionOf(hero.night.name, hero.night.when, nightLink)}`)} target="_blank" rel="noopener noreferrer" data-testid="dash-whatsapp">Send on WhatsApp</a>
          </details>
        )}
        {analyticsFailed && (
          <p className="p3-note" role="status" data-testid="dash-analytics-failed">Opens aren&rsquo;t showing right now. <button type="button" className="p3-link" style={{ minHeight: 44 }} onClick={onRetry} data-testid="dash-analytics-retry">Try again</button></p>
        )}
        {notice && <p className="p3-ok" role="status" data-testid="dash-share-notice">{notice}</p>}
      </section>

      {m.nightsRow && (
        <p className="p3-row-t" data-testid="dash-nights-row">
          {m.nightsRow.text}
          {m.nightsRow.going !== null && <> &middot; {m.nightsRow.going} going</>}
          {m.nightsRow.tickets !== null && <> &middot; {m.nightsRow.tickets} tickets sold</>}
        </p>
      )}

      {m.rail.length > 0 && (
        <ul className="p3-card p3-list" aria-label={`Nights of ${pageName}`} data-testid="dash-rail">
          {m.rail.map((r) => (
            <li key={r.night.key} className="p3-todo" data-cancelled={r.cancelled || undefined} data-hero={r.isHero || undefined}>
              <div className="p3-row-t" style={r.cancelled ? { textDecoration: 'line-through' } : undefined}>{r.night.name}</div>
              <div className="p3-row-s">{r.night.when}{r.tag && <> &middot; <strong>{r.tag}</strong></>}</div>
              {r.stats && <div className="p3-row-s" data-testid="dash-rail-stats">{r.stats}</div>}
            </li>
          ))}
        </ul>
      )}
      {m.seeAll && <Link className="p3-link" to={P3_PATHS.events} data-testid="dash-see-all">{m.seeAll.label}</Link>}

      {m.cancelledNote && (
        <details className="p3-card" data-testid="dash-cancelled-note">
          <summary style={{ minHeight: 44 }}>{m.cancelledNote.summary}</summary>
          <p>{m.cancelledNote.body}</p>
          <button type="button" className="p3-btn p3-btn-line" style={{ minHeight: 44 }} onClick={onSharePage} disabled={!pageLink} data-testid="dash-tell-group">{m.cancelledNote.action}</button>
          {pageLink && <a className="p3-link" href={whatsappHref(`${pageName}: ${pageLink}`)} target="_blank" rel="noopener noreferrer" data-testid="dash-tell-group-wa"> or on WhatsApp</a>}
        </details>
      )}

      <section className="p3-card" aria-label="Your page" data-testid="dash-page">
        {m.profile && (
          <div data-testid="dash-profile">
            <div className="p3-row-t">{m.profile.complete ? 'Profile complete' : `Profile ${m.profile.percent}% done`}</div>
            {m.profile.next && <div className="p3-row-s" data-testid="dash-profile-sentence">{m.profile.next.sentence}</div>}
            {m.profile.control && <Btn c={m.profile.control} to={P3_PATHS.youPage} testId="dash-profile-action" />}
          </div>
        )}
        <Btn c={m.sharePage} onClick={onSharePage} testId="dash-share-page" />
        <p className="p3-row-s" data-testid="dash-team-line">{m.team.line}</p>
        <Btn c={m.team.control} to={P3_PATHS.youTeamAdd} testId="dash-team-action" />
        {m.cityAverage && <p className="p3-note" data-testid="dash-city-average">{m.cityAverage.text}</p>}
      </section>
    </div>
  );
}
