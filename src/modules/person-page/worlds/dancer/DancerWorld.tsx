import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { NationalityFlag } from '@/components/people/NationalityFlag';
import { useDjPageFonts } from '@/components/dj/djPageTheme';
import { Avatar } from '../../frame';
import { TAP } from '../../roleSwitch';
import { FOCUS_RING } from '../../wall/tokens';
import { FONT, ROLE_COLOUR, WORLD } from '../tokens';
import { FACE_PX, INVITE, type DancerCard, type Preview } from './model';
import type { DancerLower } from './useDancerLower';

const T = WORLD.dancer;
/** Explicit px throughout: html is ~13.5px on phones, so rem sizes render small. */
const FACE = FACE_PX;

const Arrow = () => <ChevronRight className="ml-auto h-5 w-5 shrink-0 opacity-80" aria-hidden />;

const Kicker = ({ children }: { children: ReactNode }) => (
  <div style={{ fontSize: 11, letterSpacing: '0.22em', fontWeight: 600, color: T.card.muted }}>{children}</div>
);

function Card({ card }: { card: DancerCard }) {
  return (
    <section
      data-testid="dancer-world-card"
      className="text-center"
      style={{ padding: '14px 14px 16px', borderRadius: 20, background: T.card.background, border: `1px solid ${T.card.border}`, color: T.card.ink }}
    >
      <Kicker>DANCER</Kicker>
      {/* 14px, not 10: the flag sticker rides 7px above the photo and touched the DANCER kicker. */}
      <div className="relative mx-auto mt-[14px]" style={{ width: FACE, height: FACE }}>
        <Avatar name={card.name} photo={card.photo} world="dancer" size={FACE} />
        {card.flag ? <NationalityFlag code={card.flag} size={FACE} placement="corner" /> : null}
      </div>
      <h1 data-testid="dancer-world-name" className="mt-[10px]" style={{ fontSize: 26, lineHeight: 1.15, fontWeight: 800, overflowWrap: 'anywhere', fontFamily: T.nameFont }}>
        {card.name}
      </h1>
      {card.sub ? <p data-testid="dancer-world-sub" className="mt-1" style={{ fontSize: 15, color: T.card.muted }}>{card.sub}</p> : null}
      {card.languages ? (
        <div data-testid="dancer-world-languages">
          <div aria-hidden style={{ height: 1, background: T.card.border, margin: '12px 0 10px' }} />
          <Kicker>SPEAKS</Kicker>
          <p className="mt-1" style={{ fontSize: 15, fontWeight: 700 }}>{card.languages}</p>
        </div>
      ) : null}
    </section>
  );
}

function Contacts({ card }: { card: DancerCard }) {
  if (!card.contacts.length) return null;
  return (
    <ul data-testid="dancer-world-contacts" className="mt-3 flex flex-col gap-2">
      {card.contacts.map((c) => (
        <li key={c.href}>
          <a
            href={c.href}
            {...(c.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className={`flex items-center gap-2 rounded-[14px] ${FOCUS_RING}`}
            style={{ minHeight: 52, padding: '8px 12px', background: T.section.background, border: `1px solid ${T.section.border}` }}
          >
            <span className="flex min-w-0 flex-col">
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.accent }}>{c.kicker}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: T.card.ink, overflowWrap: 'anywhere' }}>{c.label}</span>
            </span>
            <Arrow />
          </a>
        </li>
      ))}
    </ul>
  );
}

const H2 = ({ children }: { children: ReactNode }) => (
  <h2 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: T.card.ink }}>{children}</h2>
);

/** The DJ preview's line is set in the DJ serif: load it while one is on screen (ref-counted hook). */
function DjSerif() {
  useDjPageFonts();
  return null;
}

/** One preview row's height (px): the reserve below holds exactly this, the owner's S6 rule. */
const PREVIEW_ROW_PX = 64;

function PreviewRow({ p }: { p: Preview }) {
  const w = WORLD[p.role];
  return (
    <Link
      to={p.href}
      data-testid={`dancer-world-preview-${p.role}`}
      className={`mt-2 flex items-center gap-3 rounded-[14px] ${FOCUS_RING}`}
      style={{ minHeight: PREVIEW_ROW_PX, padding: '10px 12px', background: w.card.background, border: `1px solid ${w.card.border}`, color: w.card.ink }}
    >
      <span
        className="shrink-0 rounded-full"
        style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 800, padding: '4px 8px', background: ROLE_COLOUR[p.role].fill, color: ROLE_COLOUR[p.role].on }}
      >
        {p.kicker}
      </span>
      <span className="flex min-w-0 flex-col">
        <b style={{ fontSize: 15, fontFamily: p.role === 'dj' ? FONT.djDisplay : FONT.teacherDisplay, fontWeight: p.role === 'dj' ? 400 : 700 }}>{p.line}</b>
        {p.detail ? <small style={{ fontSize: 13, color: w.card.muted, overflowWrap: 'anywhere' }}>{p.detail}</small> : null}
      </span>
      <Arrow />
    </Link>
  );
}

/**
 * S6 (owner): the lower half is the dancer's own dated worlds or nothing. While a teacher / DJ
 * person's dates load it holds ONE preview row (no heading: it may turn into nothing); a
 * dancer-only person, or one whose roles are still being read, gets no box at all.
 */
function Lower({ lower }: { lower: DancerLower }) {
  const half = lower.half;
  if (!half) {
    if (!lower.reserve) return null;
    return (
      <div data-testid="dancer-world-lower" data-kind="loading" aria-busy className="mt-4">
        <div data-testid="dancer-world-preview-reserve" aria-hidden className="mt-2 animate-pulse rounded-[14px]" style={{ height: PREVIEW_ROW_PX, background: T.section.row }} />
      </div>
    );
  }
  return (
    <div data-testid="dancer-world-lower" data-kind="previews" className="mt-4">
      <section>
        <H2>{half.heading}</H2>
        {half.items.some((p) => p.role === 'dj') ? <DjSerif /> : null}
        {half.items.map((p) => <PreviewRow key={p.role} p={p} />)}
      </section>
    </div>
  );
}

/** The card's height with a name and one sub line, no languages (measured at 390 and 360 on prod data). */
const CARD_SKELETON_PX = 233;

/**
 * The dancer read in flight: the world's own boxes at the sizes most pages turn into (the card and
 * the invite when this visitor will get it; no lower half, S6), so nothing below moves when it answers.
 */
export function DancerWorldSkeleton({ invite }: { invite: boolean }) {
  return (
    <div className="mt-3" aria-hidden>
      <div data-testid="dancer-world-skeleton-card" className="animate-pulse rounded-[20px]" style={{ height: CARD_SKELETON_PX, background: T.section.background }} />
      {invite ? (
        <div data-testid="dancer-world-skeleton-invite" className="mt-6 rounded-[14px] p-3" style={{ background: T.section.background, border: `1px solid ${T.section.border}` }}>
          <div style={{ height: 22 }} />
          <div className="mt-2" style={{ height: TAP }} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * The dancer world (people arc S2): the teal card, contacts, the D6 previews (S6: or nothing) and the D8
 * invite. Formats nothing itself: the card is `dancerCard()`, the lower half `useDancerLower()`.
 */
export function DancerWorld({ card, lower, inviteHref, ownerPlans }: {
  card: DancerCard;
  lower: DancerLower;
  /** The site's sign-up entry for this page; null = the viewer is signed in (no invite). */
  inviteHref: string | null;
  ownerPlans?: ReactNode;
}) {
  return (
    <div data-testid="dancer-world" className="mt-3" style={{ color: T.ink, fontFamily: FONT.body }}>
      <Card card={card} />
      <Contacts card={card} />
      <Lower lower={lower} />
      {ownerPlans ? <div className="mt-6">{ownerPlans}</div> : null}
      {inviteHref ? (
        <section data-testid="dancer-world-invite" className="mt-6 rounded-[14px] p-3 text-center" style={{ background: T.section.background, border: `1px solid ${T.section.border}` }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: T.card.ink }}>{INVITE.lead}</p>
          <Link
            to={inviteHref}
            data-testid="dancer-world-invite-button"
            className={`mt-2 flex items-center justify-center rounded-full ${FOCUS_RING}`}
            style={{ minHeight: TAP, background: ROLE_COLOUR.dancer.fill, color: ROLE_COLOUR.dancer.on, fontWeight: 800, fontSize: 15 }}
          >
            {INVITE.button}
          </Link>
        </section>
      ) : null}
    </div>
  );
}
