import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { NationalityFlag } from '@/components/people/NationalityFlag';
import { Avatar } from '../../frame/Avatar';
import { TAP } from '../../roleSwitch';
import { FOCUS_RING } from '../../wall/tokens';
import { FONT, WORLD } from '../tokens';
import type { DjWorldView } from './model';

const T = WORLD.dj;
const VINYL = 196;
const LABEL = 104;
const display = { fontFamily: FONT.djDisplay, fontWeight: 400 } as const;
const SECTION = { background: T.section.background, border: `1px solid ${T.section.border}` } as const;

/** A section on the sleeve: serif heading, rows below. */
function Section({ title, children, testId }: { title: string; children: React.ReactNode; testId: string }) {
  return (
    <section data-testid={testId} className="rounded-[18px] px-3 py-3" style={SECTION}>
      <h2 className="m-0 mb-2" style={{ ...display, fontSize: 24, lineHeight: 1.15, color: T.card.ink }}>{title}</h2>
      {children}
    </section>
  );
}

/**
 * The DJ world (people arc S3): the record sleeve (vinyl with the face on the label, city and
 * flag, the DJ name big in DM Serif Display and the real name small, a count only from 2), then
 * Upcoming, Played at, booking and the dancer invite. Thin pages end after the sleeve with one
 * action, so a DJ with no dates still looks finished. All copy comes in on `view` (model.ts).
 */
export function DjWorld({ view, photo, bio, dates, onRetry }: {
  view: DjWorldView;
  photo: string | null;
  bio: string | null;
  /** The gig read: rows show only when 'ready'. */
  dates: 'loading' | 'failed' | 'ready';
  onRetry: () => void;
}) {
  return (
    <div data-testid="dj-world" className="flex flex-col gap-3" style={{ fontFamily: FONT.body, color: T.ink }}>
      <div data-testid="dj-sleeve" className="rounded-[22px] px-3 pb-4 pt-4 text-center" style={{ background: T.card.background, border: `1px solid ${T.card.border}` }}>
        <div
          aria-hidden
          className="mx-auto flex items-center justify-center rounded-full"
          style={{ width: VINYL, height: VINYL, background: 'repeating-radial-gradient(circle, #141010 0 2px, #211A17 2px 4px)', boxShadow: '0 0 0 2px #2C211B, 0 10px 30px #00000080' }}
        >
          <div className="relative" style={{ width: LABEL, height: LABEL }}>
            <Avatar name={view.big} photo={photo} world="dj" size={LABEL} />
          </div>
        </div>
        {view.kicker || view.flag ? (
          <div data-testid="dj-kicker" className="mt-3 flex items-center justify-center gap-2 font-bold" style={{ fontSize: 12, letterSpacing: '0.24em', color: T.accent }}>
            {view.kicker ? <span>{view.kicker}</span> : null}
            {view.flag ? (
              <span className="relative inline-block" style={{ width: 24, height: 16 }}>
                <NationalityFlag code={view.flag} size={48} placement="inset" inset={0} />
              </span>
            ) : null}
          </div>
        ) : null}
        <h1 data-testid="dj-name" className="m-0 mt-1" style={{ ...display, fontSize: view.big.length > 16 ? 32 : 40, lineHeight: 1.05, color: T.card.ink, overflowWrap: 'anywhere' }}>
          {view.big}
        </h1>
        {view.small ? <p data-testid="dj-real-name" className="m-0 mt-1" style={{ fontSize: 15, color: T.card.muted }}>{view.small}</p> : null}
        {view.count ? (
          <p data-testid="dj-count" className="m-0 mt-3 inline-block rounded-full px-3 py-1 font-bold" style={{ fontSize: 13, color: WORLD.dj.avatar.ink, background: WORLD.dj.avatar.background }}>
            {view.count}
          </p>
        ) : null}
        {bio ? <p data-testid="dj-bio" className="m-0 mt-3 whitespace-pre-line text-left" style={{ fontSize: 14, lineHeight: 1.45, color: T.card.muted }}>{bio}</p> : null}
      </div>

      {dates === 'loading' ? (
        <div data-testid="dj-dates-loading" aria-busy="true" aria-label="Loading dates" className="h-[120px] animate-pulse rounded-[18px]" style={SECTION} />
      ) : null}

      {dates === 'failed' ? (
        <Section title="Dates" testId="dj-dates-failed">
          <p className="m-0" style={{ fontSize: 14, color: T.card.muted }}>Couldn&rsquo;t load the dates.</p>
          <button
            type="button"
            onClick={onRetry}
            className={`mt-2 w-full rounded-full font-bold ${FOCUS_RING}`}
            style={{ minHeight: TAP, fontSize: 14, color: T.accent, border: `1px solid ${T.avatar.ring}` }}
          >
            Try again
          </button>
        </Section>
      ) : null}

      {dates === 'ready' && view.upcoming.length ? (
        <Section title="Upcoming" testId="dj-upcoming">
          <div className="flex flex-col gap-[6px]">
            {view.upcoming.map((g) => (
              <Link
                key={g.eventId}
                to={`/event/${g.eventId}`}
                data-testid="dj-gig"
                className={`flex items-center gap-3 rounded-[14px] px-3 py-2 ${FOCUS_RING}`}
                style={{ minHeight: 60, background: g.next ? 'linear-gradient(90deg, #4A2A14, #2A1A12)' : T.section.row, border: g.next ? '1px solid #8A5A2A' : '1px solid transparent' }}
              >
                <span aria-hidden className="w-10 flex-none text-center" style={{ ...display, fontSize: 30, color: T.accent }}>{g.day ?? ''}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  {g.when ? <small className="font-bold" style={{ fontSize: 12, color: T.accent }}>{g.when}</small> : null}
                  <b className="font-bold" style={{ fontSize: 15, lineHeight: 1.25, color: T.card.ink, overflowWrap: 'anywhere' }}>{g.name}</b>
                  {g.venue ? <span style={{ fontSize: 13, color: '#D9C2AE' }}>{g.venue}</span> : null}
                </span>
                <ChevronRight className="h-4 w-4 flex-none" style={{ color: T.card.muted }} aria-hidden />
              </Link>
            ))}
          </div>
        </Section>
      ) : null}

      {dates === 'ready' && view.played.length ? (
        <Section title="Played at" testId="dj-played">
          <div className="flex flex-wrap justify-center gap-3">
            {view.played.map((r) => (
              <Link
                key={r.eventId}
                to={`/event/${r.eventId}`}
                data-testid="dj-record"
                className={`flex flex-col items-center justify-center rounded-full p-4 text-center ${FOCUS_RING}`}
                style={{ width: 136, height: 136, border: `2px dashed ${T.avatar.ring}`, background: `radial-gradient(circle, #2A1D16 0 40%, ${T.section.background} 41%)` }}
              >
                {r.month ? <small className="font-bold uppercase" style={{ fontSize: 11, letterSpacing: '0.1em', color: T.accent }}>{r.month}</small> : null}
                <b className="mt-1 line-clamp-4" style={{ ...display, fontSize: 14, lineHeight: 1.15, color: T.card.ink, overflowWrap: 'anywhere' }}>{r.name}</b>
              </Link>
            ))}
          </div>
        </Section>
      ) : null}

      {dates === 'ready' && view.emptyAction ? (
        <Link
          to={view.emptyAction.href}
          data-testid="dj-empty-action"
          className={`flex items-center justify-center rounded-full font-bold ${FOCUS_RING}`}
          style={{ minHeight: TAP, fontSize: 14, color: T.accent, border: `1px solid ${T.avatar.ring}` }}
        >
          {view.emptyAction.label}
        </Link>
      ) : null}

      {view.book ? (
        <a
          href={view.book.href}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="dj-book"
          className={`flex items-center gap-3 rounded-[14px] px-3 py-2 ${FOCUS_RING}`}
          style={{ minHeight: TAP, ...SECTION }}
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <small className="font-bold uppercase" style={{ fontSize: 11, letterSpacing: '0.12em', color: T.accent }}>{view.book.label}</small>
            <span className="truncate" style={{ fontSize: 15, color: T.card.ink }}>{view.book.value}</span>
          </span>
          <ChevronRight className="h-4 w-4 flex-none" style={{ color: T.card.muted }} aria-hidden />
        </a>
      ) : null}

      {view.invite ? (
        <Link
          to={view.invite.href}
          data-testid="dj-invite"
          className={`flex items-center justify-center rounded-full px-3 text-center font-bold ${FOCUS_RING}`}
          style={{ minHeight: TAP, fontSize: 14, color: WORLD.dancer.avatar.ink, background: WORLD.dancer.avatar.background, border: `1px solid ${WORLD.dancer.avatar.ring}` }}
        >
          {view.invite.label}
        </Link>
      ) : null}
    </div>
  );
}
