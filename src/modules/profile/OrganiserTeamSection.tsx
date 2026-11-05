import { useState } from 'react';
import { Link } from 'react-router-dom';
import { optimizedImageUrl, srcWidthFor } from '@/lib/imageCdn';
import { emitProfileView } from '@/lib/profileViewEmit';
import type { TeamList, TeamPerson } from './organiserTeam';

/**
 * Team (ACCEPTANCE S3, read side): the buildOrganiserTeam() answer as one
 * plain list -- no role labels, each person links to their own page (or is
 * shown, not tappable, when there is no page), nothing when the list is empty.
 * A failed read is one error line with a retry, never "no team".
 *
 * Compact density: a 3-column grid of small circles (design-density rule).
 */
const CREAM = '#F6F1EA';
const GOLD = '#E7BE6E';
const SERIF = "'Cormorant Garamond', Georgia, serif";

function Face({ p }: { p: TeamPerson }) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <span className="flex flex-col items-center gap-1 text-center">
      <span style={{ width: 64, height: 64, borderRadius: '50%', padding: 2, background: 'linear-gradient(135deg,#FBEFC4,#E7BE6E,#FF6A2C)', flexShrink: 0 }}>
        <span style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%,#33202c,#120c14)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {p.avatarUrl && !imgFailed ? (
            <img src={optimizedImageUrl(p.avatarUrl, srcWidthFor(64))} alt="" width={64} height={64} className="h-full w-full object-cover" loading="lazy" onError={() => setImgFailed(true)} />
          ) : (
            <span aria-hidden="true" style={{ fontFamily: SERIF, fontSize: 20, color: 'rgba(251,239,196,0.85)' }}>{p.initials}</span>
          )}
        </span>
      </span>
      <span data-team-name style={{ fontSize: 13, fontWeight: 600, color: CREAM, lineHeight: 1.25, overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</span>
    </span>
  );
}

export function OrganiserTeamSection({ team, failed, onRetry }: { team: TeamList; failed: boolean; onRetry: () => void }) {
  const [showAll, setShowAll] = useState(false);
  if (failed && team.mode === 'empty') {
    return (
      <section className="px-5 md:px-12 py-3" style={{ borderBottom: '1px solid rgba(246,241,234,0.08)' }} data-testid="org-feed-error-team" role="status">
        <p style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, margin: 0, fontSize: 14, color: 'rgba(246,241,234,0.75)' }}>
          Couldn&rsquo;t load the team.
          <button type="button" onClick={onRetry} style={{ minHeight: 44, padding: '0 12px', background: 'none', border: 'none', color: GOLD, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Try again</button>
        </p>
      </section>
    );
  }
  if (team.mode === 'empty') return null;
  const shown = showAll ? [...team.people, ...team.overflow] : team.people;
  return (
    <section data-testid="org-team" className="px-5 md:px-12 py-3" style={{ borderBottom: '1px solid rgba(246,241,234,0.08)' }}>
      <h2 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 16, lineHeight: 1.3, margin: '0 0 8px', color: CREAM }}>Team</h2>
      <ul className="grid grid-cols-3 gap-3 lg:grid-cols-6" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {shown.map((p) => (
          <li key={p.personId} data-team-person={p.personId} className="min-w-0">
            {p.href ? (
              <Link
                to={p.href}
                onClick={() => emitProfileView({ personId: p.personId, profileType: 'dancer', context: 'organiser:team' })}
                className="block rounded-lg no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
                style={{ minHeight: 44, padding: 4 }}
              >
                <Face p={p} />
              </Link>
            ) : (
              <div style={{ padding: 4 }}><Face p={p} /></div>
            )}
          </li>
        ))}
      </ul>
      {team.overflow.length > 0 && (
        <button type="button" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll} style={{ display: 'block', width: '100%', minHeight: 44, background: 'none', border: 'none', color: GOLD, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          {showAll ? 'Show fewer' : `+${team.overflow.length} more`}
        </button>
      )}
    </section>
  );
}
