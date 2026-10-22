import { useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { optimizedImageUrl } from '@/lib/imageCdn';
import { RoleSwitch } from '@/modules/person-page/RoleSwitchBar';
import { CHIP, FOCUS_RING, HUB, TILE, WALL, WALL_FADE } from '@/modules/person-page/wall/tokens';
import { djInkTheme } from './djPageTheme';
import { DjTurntable, type DjGig } from './DjTiles';
import { datesView, gigRows, kicker, listenLinks, nameSize, noDates, seeMoreLabel, TURNTABLE } from './djRoleModel';

// W2-C DJ page, owner pick D-C "Vinyl kept, centred", on the hub's warm ground (flags.personHub ON).
// Order (owner): hero, upcoming dates (max 3 + "See N more dates"), About, Photos, Listen & book.
// Explicit px throughout: the phone html font-size is ~13.5px, so rem sizes render small.

export type DjRolePageProps = {
  id: string | undefined;
  slug: string | null | undefined;
  name: string;
  photoUrl: string | null;
  nationalityCode?: string | null;
  cityName: string | null;
  bio: string | null;
  isLive: boolean;
  upcoming: DjGig[];
  /** The dates read has not answered yet (it runs after mount): a placeholder, never a false "No dates". */
  datesLoading: boolean;
  /** The dates read failed: say so, never a false "No dates". */
  datesFailed: boolean;
  gallery: string[];
  links: { soundcloud: string | null; mixcloud: string | null; instagram: string | null; website: string | null; facebook: string | null };
  faq: string | null;
  pricing: string | null;
  /** The Share control (today's, unchanged), placed at the foot of the page. */
  share: ReactNode;
};

const GOLD = CHIP.dj.bg;
const CARD: CSSProperties = { background: WALL.card, border: `1px solid ${WALL.line}`, borderRadius: 14 };

function Label({ children }: { children: ReactNode }) {
  return (
    <h2 className="m-0 mb-2 mt-5 px-1 font-extrabold uppercase" style={{ fontSize: 13, letterSpacing: 1.5, color: WALL.muted }}>
      {children}
    </h2>
  );
}

const ACTION_CLASS = `mt-3 inline-flex items-center rounded-[12px] px-4 font-bold ${FOCUS_RING}`;
const ACTION_STYLE: CSSProperties = { minHeight: HUB.tap, fontSize: 15, color: WALL.text, border: `1.5px solid ${GOLD}` };

function Dates({ upcoming, loading, failed, instagram }: { upcoming: DjGig[]; loading: boolean; failed: boolean; instagram: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const all = gigRows(upcoming);
  if (loading && all.length === 0) {
    return <div data-testid="dj-dates-loading" aria-busy="true" style={{ ...CARD, minHeight: 56 }} />;
  }
  if (failed && all.length === 0) {
    return (
      <p data-testid="dj-dates-failed" className="m-0 p-3" style={{ ...CARD, fontSize: 15 }}>
        Dates could not load right now. Reload the page in a moment to see them.
      </p>
    );
  }
  if (all.length === 0) {
    const e = noDates(instagram);
    return (
      <div data-testid="dj-no-dates" className="p-3" style={CARD}>
        <p className="m-0" style={{ fontSize: 15, color: WALL.text }}>{e.line}</p>
        <p className="m-0 mt-1" style={{ fontSize: 14, color: WALL.muted }}>{e.hint}</p>
        {e.action.external ? (
          <a href={e.action.href} target="_blank" rel="noopener noreferrer" data-testid="dj-no-dates-action" className={ACTION_CLASS} style={ACTION_STYLE}>
            {e.action.label}
          </a>
        ) : (
          <Link to={e.action.href} data-testid="dj-no-dates-action" className={ACTION_CLASS} style={ACTION_STYLE}>
            {e.action.label}
          </Link>
        )}
      </div>
    );
  }
  const v = datesView(all, expanded);
  return (
    <>
      <ul className="m-0 flex list-none flex-col gap-2 p-0" data-testid="dj-dates">
        {/* One event can be on the timeline twice (two sets): the key is the row, not the event. */}
        {v.rows.map((g, i) => (
          <li key={`${i}:${g.eventId}`}>
            <Link
              to={`/event/${g.eventId}`}
              data-testid="dj-date"
              data-next={g.next ? 'true' : undefined}
              className={`flex items-center gap-3 py-2 pr-3 ${FOCUS_RING}`}
              style={{ ...CARD, minHeight: 56, paddingLeft: 12, borderColor: g.next ? GOLD : WALL.line, boxShadow: g.next ? `inset 6px 0 0 ${GOLD}` : undefined }}
            >
              <span className="shrink-0 text-center" style={{ width: 48, paddingLeft: 6 }}>
                <span className="block" style={{ fontFamily: 'var(--dj-display)', fontSize: 24, lineHeight: 1, color: WALL.text }}>{g.day}</span>
                <span className="block font-extrabold uppercase" style={{ fontSize: 12, letterSpacing: 1, color: GOLD }}>{g.mon}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold" style={{ fontSize: 15, lineHeight: '20px', color: WALL.text, overflowWrap: 'anywhere' }}>{g.name}</span>
                {g.sub ? <span className="block truncate" style={{ fontSize: 14, color: WALL.muted }}>{g.sub}</span> : null}
              </span>
              <ChevronRight className="h-5 w-5 shrink-0" style={{ color: GOLD }} aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      {v.more > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          data-testid="dj-more-dates"
          className={`mt-1 w-full font-bold ${FOCUS_RING}`}
          style={{ minHeight: HUB.tap, fontSize: 15, color: GOLD }}
        >
          {seeMoreLabel(v.more)}
        </button>
      ) : null}
    </>
  );
}

export function DjRolePage(p: DjRolePageProps) {
  const links = listenLinks(p.links);
  const instagram = links.find((l) => l.key === 'instagram')?.href ?? null;
  const size = nameSize(p.name);
  return (
    <div
      data-testid="dj-role-page"
      className="dj-role"
      style={{ ...(djInkTheme as CSSProperties), ...WALL_FADE, minHeight: HUB.groundMinHeight, color: WALL.text, fontFamily: 'var(--dj-body)' }}
    >
      <div className="mx-auto w-full max-w-xl px-3 pb-10 pt-2">
        <RoleSwitch
          current="dj"
          id={p.id}
          slug={p.slug}
          fade={false}
          fallback={
            <Link to="/djs" data-testid="dj-back" className={`inline-flex items-center gap-2 px-1 text-[15px] font-bold ${FOCUS_RING}`} style={{ minHeight: HUB.tap, color: WALL.text }}>
              <ArrowLeft className="h-4 w-4" aria-hidden /> Back to DJs
            </Link>
          }
        />

        <section
          data-testid="dj-hero"
          className="mt-2 flex flex-col items-center px-3 pb-4 pt-5 text-center"
          style={{
            borderRadius: 24,
            border: `1px solid ${WALL.line}`,
            background: `radial-gradient(circle at 82% 12%, rgba(242,182,50,.18), transparent 50%), ${WALL.card}`,
          }}
        >
          <DjTurntable name={p.name} photoUrl={p.photoUrl} nationalityCode={p.nationalityCode} size={TURNTABLE} />
          <div className="mt-3 font-extrabold" style={{ fontSize: 13, letterSpacing: 2, color: GOLD }} data-testid="dj-kicker">
            {kicker(p.cityName)}
          </div>
          {p.isLive ? (
            <span className="mt-2 inline-flex items-center rounded-full px-3 font-bold" style={{ minHeight: 28, fontSize: 13, background: TILE.organiser.bg, color: TILE.organiser.ink }}>
              On the decks tonight
            </span>
          ) : null}
          <h1
            data-testid="dj-name"
            data-size={size}
            className="m-0 mt-1 w-full"
            style={{ fontFamily: 'var(--dj-display)', fontWeight: 400, fontSize: size, lineHeight: 1.05, overflowWrap: 'anywhere' }}
          >
            {p.name}
          </h1>
        </section>

        <Label>Upcoming dates</Label>
        <Dates upcoming={p.upcoming} loading={p.datesLoading} failed={p.datesFailed} instagram={instagram} />

        {p.bio?.trim() ? (
          <>
            <Label>About</Label>
            <div className="p-3" style={CARD}>
              <p className="m-0 whitespace-pre-line" style={{ fontSize: 15, lineHeight: '22px' }}>{p.bio}</p>
            </div>
          </>
        ) : null}

        {p.gallery.length > 0 ? (
          <>
            <Label>Photos</Label>
            <div className="grid grid-cols-3 gap-2" data-testid="dj-photos">
              {p.gallery.map((u, i) => (
                <a key={`${i}:${u}`} href={u} target="_blank" rel="noopener noreferrer" className={`block overflow-hidden ${FOCUS_RING}`} style={{ ...CARD, aspectRatio: '4 / 3' }}>
                  <img src={optimizedImageUrl(u, 320)} alt={`${p.name}, photo ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
                </a>
              ))}
            </div>
          </>
        ) : null}

        {links.length > 0 ? (
          <>
            <Label>Listen &amp; book</Label>
            <div className="grid grid-cols-2 gap-2" data-testid="dj-links">
              {links.map((l) => (
                <a
                  key={l.key}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center justify-center px-3 font-bold ${FOCUS_RING}`}
                  style={{ ...CARD, minHeight: 48, fontSize: 15, color: WALL.text }}
                >
                  {l.label}
                </a>
              ))}
            </div>
          </>
        ) : null}

        {p.pricing?.trim() ? (
          <>
            <Label>Pricing</Label>
            <div className="p-3" style={CARD}><p className="m-0 whitespace-pre-line" style={{ fontSize: 15, lineHeight: '22px' }}>{p.pricing}</p></div>
          </>
        ) : null}

        {p.faq?.trim() ? (
          <>
            <Label>FAQ</Label>
            <div className="p-3" style={CARD}><p className="m-0 whitespace-pre-line" style={{ fontSize: 15, lineHeight: '22px' }}>{p.faq}</p></div>
          </>
        ) : null}

        <div className="mt-4 flex justify-end">{p.share}</div>
      </div>
      {/* The turntable's motion (today's page defines the same keyframes in its own block), off for reduced motion. */}
      <style>{`
        @keyframes dj-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes dj-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
        @media (prefers-reduced-motion: reduce) {
          .dj-role *, .dj-role *::before, .dj-role *::after { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
