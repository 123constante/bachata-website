import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MapPin } from 'lucide-react';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { flags } from '@/lib/featureFlags';
import { useProfileProgramAppearances } from '@/hooks/useProfileProgramAppearances';
import { RoleChip } from '../wall/RoleChip';
import { FOCUS_RING, HUB, WALL, WALL_FADE } from '../wall/tokens';
import type { PersonSnapshot } from '../reads';
import { FactsStrip } from './FactsStrip';
import { HubFace } from './HubFace';
import { hubModel, type HubDjRow } from './model';
import { NextEventButton } from './NextEventButton';
import { RoleCard } from './RoleCard';

/** Back to where the visitor came from when that was this site, else the dancers wall. */
export function goBackTarget(referrer: string, origin: string, historyLength: number): 'history' | '/dancers' {
  try {
    return referrer && new URL(referrer).origin === origin && historyLength > 1 ? 'history' : '/dancers';
  } catch {
    return '/dancers';
  }
}

/**
 * /people/:id with flags.personHub ON. No read of its own: the dancer and DJ rows are the loader's
 * (dehydrated under the same keys as /dancers/:id and /djs/:id), the gig list is the DJ page's own
 * timeline read, fetched after mount like there (so server and first client render match).
 */
export default function PersonHub({ person }: { person: PersonSnapshot }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDj = person.roles.includes('dj');
  const { data: appearances } = useProfileProgramAppearances('dj', mounted && isDj ? person.id : undefined, 1000);
  const dancerRow = qc.getQueryData(['dancer-profile', person.id]);
  const dj = (qc.getQueryData(['dj-profile', person.id]) as HubDjRow | undefined) ?? null;

  const m = useMemo(
    () => hubModel({ person, dancerRow, dj, appearances, opts: { teacherPagesOpen: flags.teacherDetail } }),
    [person, dancerRow, dj, appearances],
  );

  const goBack = () => {
    const to = goBackTarget(document.referrer, window.location.origin, window.history.length);
    if (to === 'history') navigate(-1);
    else navigate(to);
  };

  return (
    <GlobalLayout breadcrumbs={buildBreadcrumbs('person.detail', { entityName: person.name ?? undefined })} showSubheader={false}>
      <div data-testid="person-hub" data-lead={m.lead} style={{ ...WALL_FADE, color: WALL.text }}>
        <div className="mx-auto w-full max-w-xl px-3 pb-16 pt-3">
          <button
            type="button"
            onClick={goBack}
            data-testid="hub-back"
            className={`-ml-1 inline-flex items-center gap-1 rounded-md px-1 font-bold ${FOCUS_RING}`}
            style={{ minHeight: HUB.tap, minWidth: HUB.tap, color: WALL.text, fontSize: HUB.body }}
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            Back
          </button>

          <section className="mt-1 p-4" style={{ background: WALL.card, border: `1px solid ${WALL.line}`, borderRadius: HUB.headerRadius }}>
            <div className="flex items-center gap-4">
              <HubFace photo={m.photo} name={m.initialsFrom} lead={m.lead} flagCode={m.flagCode} />
              <div className="min-w-0 flex-1">
                <h1
                  data-testid="hub-name"
                  className="break-words"
                  style={{ fontSize: HUB.name, lineHeight: `${HUB.nameLine}px`, fontWeight: 800, overflowWrap: 'anywhere' }}
                >
                  {m.heading}
                </h1>
                {m.subName ? (
                  <div data-testid="hub-subname" className="break-words" style={{ color: WALL.muted, fontSize: HUB.sub }}>{m.subName}</div>
                ) : null}
                {m.city ? (
                  <div data-testid="hub-city" className="mt-1 inline-flex items-center gap-1" style={{ fontSize: HUB.body }}>
                    <MapPin className="h-4 w-4 shrink-0" style={{ color: WALL.muted }} aria-hidden="true" />
                    {m.city}
                  </div>
                ) : null}
                {m.tags.length > 0 ? (
                  <div data-testid="hub-chips" className="mt-2 flex flex-wrap gap-1">
                    {m.tags.map((t) => <RoleChip key={t.role} role={t.role} label={t.label} />)}
                  </div>
                ) : null}
              </div>
            </div>
            <FactsStrip facts={m.facts} />
            <NextEventButton gig={m.nextGig} />
          </section>

          <h2
            className="mx-1 mb-2 mt-5 font-extrabold uppercase"
            style={{ fontSize: HUB.sectionLabel, letterSpacing: 1.5, color: WALL.muted }}
          >
            {m.cardsHeading}
          </h2>
          <div className="grid gap-3">
            {m.cards.map((c) => <RoleCard key={c.role} card={c} personId={person.id} />)}
          </div>
        </div>
      </div>
    </GlobalLayout>
  );
}
