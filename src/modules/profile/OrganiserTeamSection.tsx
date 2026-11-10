import { useState } from 'react';
import { Link } from 'react-router-dom';
import { optimizedImageUrl, srcWidthFor } from '@/lib/imageCdn';
import { emitProfileView } from '@/lib/profileViewEmit';
import { NationalityFlag } from '@/components/people/NationalityFlag';
import type { PersonBadge } from '@/modules/person-page/badges';
import type { TeamList, TeamPerson } from './organiserTeam';
import { RetryButton } from './RetryButton';
import { teamPersonLink, type BadgesState } from './teamPersonLink';

/**
 * Team (ACCEPTANCE S3, read side): the buildOrganiserTeam() answer as one
 * plain list -- no role labels, each person links to their own page (or is
 * shown, not tappable, when there is no page), nothing when the list is empty.
 * A failed read is one error line with a retry, never "no team".
 *
 * Fix round 1 (lead decision, restored from main's TeamCircle): each circle
 * carries the person's nationality flag, and the link is ROLE-AWARE -- the
 * people-badges mapping picks the page (DJ, dancer, or teacher while teacher
 * pages are open) and the profile view is typed by that page. While the badges
 * read loads or after it failed, a person with a dancer page keeps that link
 * (typed dancer); once it answered with no row, there is no link.
 *
 * Compact density: a 3-column grid of small circles (design-density rule).
 * P2: everyone shows (no "+N more"); the list comes from organiser_public_team_v1
 * in the RPC's order (teamFromPublicRows).
 */
const CREAM = '#F6F1EA';
const SERIF = "'Cormorant Garamond', Georgia, serif";

const CIRCLE = 64;
function Face({ p, nationalityCode }: { p: TeamPerson; nationalityCode: string | null }) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <span className="flex flex-col items-center gap-1 text-center">
      <span style={{ position: 'relative', width: CIRCLE, height: CIRCLE, borderRadius: '50%', padding: 2, background: 'linear-gradient(135deg,#FBEFC4,#E7BE6E,#FF6A2C)', flexShrink: 0 }}>
        <span style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%,#33202c,#120c14)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {p.avatarUrl && !imgFailed ? (
            <img src={optimizedImageUrl(p.avatarUrl, srcWidthFor(64))} alt="" width={64} height={64} className="h-full w-full object-cover" loading="lazy" onError={() => setImgFailed(true)} />
          ) : (
            <span aria-hidden="true" style={{ fontFamily: SERIF, fontSize: 20, color: 'rgba(251,239,196,0.85)' }}>{p.initials}</span>
          )}
        </span>
        <NationalityFlag code={nationalityCode} size={CIRCLE} />
      </span>
      <span data-team-name style={{ fontSize: 13, fontWeight: 600, color: CREAM, lineHeight: 1.25, overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</span>
    </span>
  );
}

export function OrganiserTeamSection({ team, failed, ownEmptyHref = null, retrying = false, onRetry, nationality, badges, badgesState }: {
  team: TeamList;
  failed: boolean;
  /** Set only when the viewer runs this page: an empty team then says so and links to Team. Visitors get null and see nothing. */
  ownEmptyHref?: string | null;
  /** The team refetch is running: Try again shows its pending state. */
  retrying?: boolean;
  onRetry: () => void;
  /** personId -> nationality code (dancer_profiles.nationality). */
  nationality: ReadonlyMap<string, string | null>;
  badges: ReadonlyMap<string, PersonBadge>;
  badgesState: BadgesState;
}) {
  if (failed && team.mode === 'empty') {
    return (
      <section className="px-5 md:px-12 py-3" style={{ borderBottom: '1px solid rgba(246,241,234,0.08)' }} data-testid="org-feed-error-team" role="status">
        <p style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, margin: 0, fontSize: 14, color: 'rgba(246,241,234,0.75)' }}>
          Couldn&rsquo;t load the team.
          <RetryButton onRetry={onRetry} pending={retrying} />
        </p>
      </section>
    );
  }
  if (team.mode === 'empty') {
    if (!ownEmptyHref) return null;
    return (
      <section data-testid="org-team-own-empty" className="px-5 md:px-12 py-3" style={{ borderBottom: '1px solid rgba(246,241,234,0.08)' }}>
        <p style={{ margin: 0, fontSize: 14, color: 'rgba(246,241,234,0.75)' }}>
          Your Team is empty. <Link to={ownEmptyHref} className="underline" style={{ color: CREAM }}>Add people in Team.</Link>
        </p>
      </section>
    );
  }
  return (
    <section data-testid="org-team" className="px-5 md:px-12 py-3" style={{ borderBottom: '1px solid rgba(246,241,234,0.08)' }}>
      <h2 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 16, lineHeight: 1.3, margin: '0 0 8px', color: CREAM }}>Team</h2>
      <ul className="grid grid-cols-3 gap-3 lg:grid-cols-6" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {team.people.map((p) => {
          const link = teamPersonLink(p, badges.get(p.personId), badgesState);
          const face = <Face p={p} nationalityCode={nationality.get(p.personId) ?? null} />;
          return (
            <li key={p.personId} data-team-person={p.personId} className="min-w-0">
              {link ? (
                <Link
                  to={link.href}
                  onClick={() => emitProfileView({ personId: link.personId, profileType: link.profileType, context: 'organiser:team' })}
                  className="block rounded-lg no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
                  style={{ minHeight: 44, padding: 4 }}
                >
                  {face}
                </Link>
              ) : (
                <div style={{ padding: 4 }}>{face}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
