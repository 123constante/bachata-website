import { useMemo, type ReactNode } from 'react';
import { PersonFrame } from '../../frame';
import { WORLD } from '../tokens';
import { DancerWorld } from './DancerWorld';
import { dancerCard, type DancerWorldInput } from './model';
import { useDancerLower } from './useDancerLower';

/**
 * /dancers/:id with flags.personWorlds ON: the shared frame (Back + Share, role tabs) and the
 * dancer world on the dancer ground. Its own component so the flag-OFF page makes none of
 * these reads (the hooks live here, not in DancerProfile).
 */
export function DancerWorldPage({ id, slug, input, shareTitle, inviteHref, ownerPlans }: {
  id: string;
  slug: string | null | undefined;
  input: DancerWorldInput;
  shareTitle: string;
  inviteHref: string | null;
  ownerPlans?: ReactNode;
}) {
  const { name, photo, nationality, city, danceRole, languages, contacts } = input;
  const card = useMemo(
    () => dancerCard({ name, photo, nationality, city, danceRole, languages, contacts }),
    [name, photo, nationality, city, danceRole, languages, contacts],
  );
  const lower = useDancerLower(id, slug, city);
  return (
    <div data-testid="dancer-world-page" style={{ background: WORLD.dancer.ground, color: WORLD.dancer.ink }}>
      <div className="mx-auto w-full max-w-xl px-4 pb-10 pt-3">
        {/* Owner D9: Back goes where they came from; the history rule is the frame's (S3). */}
        <PersonFrame backHref="/dancers" shareTitle={shareTitle} roles={lower.roles} current="dancer" slug={slug}>
          <DancerWorld card={card} lower={lower} inviteHref={inviteHref} ownerPlans={ownerPlans} />
        </PersonFrame>
      </div>
    </div>
  );
}
