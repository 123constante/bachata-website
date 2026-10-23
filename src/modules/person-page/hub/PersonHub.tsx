import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { flags } from '@/lib/featureFlags';
import { emitProfileView } from '@/lib/profileViewEmit';
import { useProfileProgramAppearances } from '@/hooks/useProfileProgramAppearances';
import { RoleChip } from '../wall/RoleChip';
import { CHIP, FOCUS_RING, FOOTER_GOLD, HUB, TILE, WALL } from '../wall/tokens';
import type { PersonBadge } from '../badges';
import type { PersonSnapshot } from '../reads';
import { HubFace } from './HubFace';
import { hubModel, MIDDOT, type AlsoCardModel, type HubDjRow, type HubModel } from './model';

/** Back to where the visitor came from when that was this site, else the dancers wall. */
export function goBackTarget(referrer: string, origin: string, historyLength: number): 'history' | '/dancers' {
  try {
    return referrer && new URL(referrer).origin === origin && historyLength > 1 ? 'history' : '/dancers';
  } catch {
    return '/dancers';
  }
}

/**
 * This person's row in a badges answer already in the query cache: the wall's when the visitor came from
 * the wall, else the one the /people loader fetched (['people-badges', [id]], dehydrated). No request.
 */
export function wallBadgeOf(qc: QueryClient, id: string): PersonBadge | null {
  for (const [, data] of qc.getQueriesData<Map<string, PersonBadge>>({ queryKey: ['people-badges'] })) {
    const row = data instanceof Map ? data.get(id) : undefined;
    if (row) return row;
  }
  return null;
}

const LABEL_STYLE = { fontSize: HUB.sectionLabel, letterSpacing: 0.6, color: WALL.muted } as const;

function AlsoCard({ card, personId, twoCol }: { card: AlsoCardModel; personId: string; twoCol: boolean }) {
  const body = (
    <>
      <span className="block break-words font-black" style={{ fontSize: HUB.alsoTitle, lineHeight: '20px' }}>{card.label}</span>
      {/* Side by side, the DJ line reserves two rows: it swaps when the gig list lands and must not grow the row. */}
      <span data-testid="hub-also-line" className="block break-words" style={{ fontSize: HUB.small, lineHeight: `${HUB.smallLine}px`, color: WALL.muted, minHeight: twoCol && card.role === 'dj' ? HUB.smallLine * 2 : undefined }}>{card.line}</span>
    </>
  );
  const box = { minHeight: HUB.alsoMinHeight, borderRadius: HUB.alsoRadius, background: WALL.card, color: WALL.text, padding: '10px 12px' };
  // A role with no page (a closed Teacher): shown so the person reads whole, never a link (dashed, aria-disabled).
  if (!card.href) {
    return (
      <div data-testid="hub-also-card" data-role={card.role} aria-disabled="true" className="flex min-w-0 flex-col justify-center gap-0.5" style={{ ...box, border: `1px dashed ${WALL.line}` }}>
        {body}
      </div>
    );
  }
  return (
    <Link
      to={card.href}
      data-testid="hub-also-card"
      data-role={card.role}
      className={`flex min-w-0 flex-col justify-center gap-0.5 ${FOCUS_RING}`}
      style={{ ...box, border: `1px solid ${TILE[card.role].edge}` }}
      onClick={() => emitProfileView({ personId, profileType: card.role, context: 'person-hub' })}
    >
      {body}
      <span className="inline-flex items-center gap-1 font-extrabold" style={{ fontSize: HUB.small, color: CHIP[card.role].bg }}>
        Open <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </span>
    </Link>
  );
}

function Hero({ m, personId }: { m: HubModel & { lead: NonNullable<HubModel['lead']> }; personId: string }) {
  const hero = m.hero;
  const accent = CHIP[m.lead];
  return (
    <section
      data-testid="hub-hero"
      data-role={m.lead}
      className="mt-1 flex flex-col items-center gap-2 p-4 text-center"
      style={{ background: WALL.card, border: `${HUB.heroBorder}px solid ${TILE[m.lead].edge}`, borderRadius: HUB.heroRadius }}
    >
      <HubFace photo={m.photo} name={m.initialsFrom} lead={m.lead} flagCode={m.flagCode} />
      <h1 data-testid="hub-name" className="max-w-full break-words font-black" style={{ fontSize: HUB.name, lineHeight: `${HUB.nameLine}px`, overflowWrap: 'anywhere' }}>
        {m.heading}
      </h1>
      {m.subName ? <div data-testid="hub-subname" className="max-w-full break-words" style={{ color: WALL.muted, fontSize: HUB.sub }}>{m.subName}</div> : null}
      {m.tags.length > 0 ? (
        <div data-testid="hub-chips" className="flex flex-wrap justify-center gap-1.5">
          {m.tags.map((t) => <RoleChip key={t.role} role={t.role} label={t.label} big />)}
        </div>
      ) : null}
      {hero ? (
        <>
          {/* One line, always reserved for a DJ: the gig line fills in when the gig list arrives, nothing moves. */}
          {hero.line !== null ? (
            <p data-testid="hub-line" className="max-w-full break-words font-bold" style={{ fontSize: HUB.line, lineHeight: `${HUB.lineHeight}px`, minHeight: HUB.lineHeight }}>
              {hero.line}
            </p>
          ) : null}
          <Link
            to={hero.href}
            data-testid="hub-cta"
            className={`mt-1 flex items-center justify-center gap-2 self-stretch px-4 font-extrabold ${FOCUS_RING}`}
            style={{ minHeight: HUB.ctaMinHeight, borderRadius: HUB.ctaRadius, fontSize: HUB.ctaText, background: accent.bg, color: accent.text }}
            onClick={() => emitProfileView({ personId, profileType: hero.role, context: 'person-hub' })}
          >
            {hero.cta}
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
          <p data-testid="hub-hint" style={{ fontSize: HUB.small, lineHeight: `${HUB.smallLine}px`, color: WALL.muted, textWrap: 'balance' }}>{hero.hint}</p>
        </>
      ) : null}
    </section>
  );
}

/**
 * /people/:id with flags.personHub ON, W2-D option C: one hero card for the main role, an "Also" row, About.
 * Only people with two or more held roles get here (the loader forwards everyone else: personPageRedirect).
 * No read of its own: the dancer and DJ rows and the badges row are the loader's (dehydrated), the gig list
 * is the DJ page's own timeline read, fetched after mount like there (so server and first client render match).
 */
export default function PersonHub({ person }: { person: PersonSnapshot }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDj = person.roles.includes('dj');
  const timeline = useProfileProgramAppearances('dj', mounted && isDj ? person.id : undefined, 1000);
  // A failed read counts as "no gigs", so the gig line never stays on "Checking".
  const appearances = timeline.isError ? [] : timeline.data;
  const dancerRow = qc.getQueryData(['dancer-profile', person.id]);
  const dj = (qc.getQueryData(['dj-profile', person.id]) as HubDjRow | undefined) ?? null;
  // Fixed at first paint: which role leads never changes after that (no card swap when the gig list lands).
  // No badges row at all (its read failed): "no gig known", so the lead stays where it first painted.
  const [wallBadge] = useState<PersonBadge>(() => wallBadgeOf(qc, person.id)
    ?? { id: person.id, roles: person.heldRoles ?? person.roles, djName: null, djHasUpcoming: false, nextGigDate: null });

  const m = useMemo(
    () => hubModel({ person, dancerRow, dj, appearances, wallBadge, opts: { teacherPagesOpen: flags.teacherDetail } }),
    [person, dancerRow, dj, appearances, wallBadge],
  );

  const goBack = () => {
    const to = goBackTarget(document.referrer, window.location.origin, window.history.length);
    if (to === 'history') navigate(-1);
    else navigate(to);
  };

  return (
    <GlobalLayout
      breadcrumbs={buildBreadcrumbs('person.detail', { entityName: person.name ?? undefined })}
      showSubheader={false}
      gradientPalette="wall"
    >
      <div data-testid="person-hub" data-lead={m.lead ?? 'none'} className="flex flex-col" style={{ background: WALL.page, minHeight: HUB.groundMinHeight, color: WALL.text }}>
        <div className="mx-auto w-full max-w-xl flex-1 px-3 pb-5 pt-1">
          <button
            type="button"
            onClick={goBack}
            data-testid="hub-back"
            className={`-ml-1 inline-flex items-center gap-1.5 rounded-md px-1 font-bold ${FOCUS_RING}`}
            style={{ minHeight: HUB.tap, minWidth: HUB.tap, color: WALL.text, fontSize: HUB.body }}
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            Back
          </button>

          {m.lead ? (
            <Hero m={m as HubModel & { lead: NonNullable<HubModel['lead']> }} personId={person.id} />
          ) : (
            <section data-testid="hub-empty" className="mt-1 p-4 text-center" style={{ background: WALL.card, border: `1px solid ${WALL.line}`, borderRadius: HUB.heroRadius }}>
              <h1 data-testid="hub-name" className="break-words font-black" style={{ fontSize: HUB.name, lineHeight: `${HUB.nameLine}px`, overflowWrap: 'anywhere' }}>{m.heading}</h1>
              <p className="mt-2" style={{ fontSize: HUB.body, color: WALL.muted }}>No public page for this person yet. You can browse the dancers instead.</p>
              <Link
                to="/dancers"
                className={`mt-3 inline-flex items-center justify-center px-4 font-extrabold ${FOCUS_RING}`}
                style={{ minHeight: HUB.tap, borderRadius: HUB.ctaRadius, background: CHIP.dancer.bg, color: CHIP.dancer.text, fontSize: HUB.body }}
              >
                Browse dancers
              </Link>
            </section>
          )}

          {m.also.length > 0 ? (
            <>
              <h2 className="mx-1 mb-2 mt-3.5 font-extrabold uppercase" style={LABEL_STYLE}>Also</h2>
              <div data-testid="hub-also" className="grid gap-2" style={{ gridTemplateColumns: m.also.length === 1 ? '1fr' : '1fr 1fr' }}>
                {m.also.map((c) => <AlsoCard key={c.role} card={c} personId={person.id} twoCol={m.also.length > 1} />)}
              </div>
            </>
          ) : null}

          {m.about.length > 0 ? (
            <div data-testid="hub-about" className="mt-3 pt-2.5" style={{ borderTop: `1px solid ${WALL.line}` }}>
              <h2 className="font-extrabold uppercase" style={LABEL_STYLE}>About</h2>
              <p className="mt-1 break-words" style={{ fontSize: HUB.body, lineHeight: '20px', color: WALL.muted }}>{m.about.join(MIDDOT)}</p>
            </div>
          ) : null}
        </div>
        {/* Soft fade into the footer gold (owner: no hard seam); index.css paints the footer's top gap gold on this route only. */}
        <div aria-hidden="true" data-hub-footer-join="" style={{ height: HUB.fade, background: `linear-gradient(to bottom, ${WALL.page} 0px, ${FOOTER_GOLD} ${HUB.fade}px)` }} />
      </div>
    </GlobalLayout>
  );
}
