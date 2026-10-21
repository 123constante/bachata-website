import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PersonAvatar } from '@/components/account/profiles/PersonAvatar';
import { Card, EmptyState, ErrorState, SkeletonRows } from '@/modules/organiser/ui';
import { fetchLineupPeople, type LineupPerson } from '../../api/lineupPeople';
import { FIND_A_NIGHT } from '../../copy/sharedCopy';
import { fullDate } from '../nights/nightsModel';
import { SectionTitle } from '../blocks';
import { HeadphonesArt } from '../art';

export const lineupPeopleQueryKey = (userId: string | undefined) => ['dancer-app', 'lineup-people', userId ?? null] as const;

const ROLE: Record<LineupPerson['roles'][number], { label: string; tone: string }> = {
  teacher: { label: 'Teacher', tone: 'da-tone-violet' },
  dj: { label: 'DJ', tone: 'da-tone-teal' },
};

/** Where the profile-view rows come from (record_profile_view_v1 p_context). */
const LINEUP_VIEW_CONTEXT = 'dancer-app:home-lineup';

/**
 * Fire-and-forget, loaded on the tap: profileViewEmit imports the eager supabase client, which /app/* keeps off its
 * first load (the lazy getSupabase; bundle-budget counts first-load chunks). Never blocks the navigation.
 */
const emitView = (p: LineupPerson) => {
  void import('@/lib/profileViewEmit')
    .then(({ emitProfileView }) => emitProfileView({ personId: p.profile_id, profileType: p.roles[0], context: LINEUP_VIEW_CONTEXT }))
    .catch(() => undefined);
};

const ROW_CLASS = 'da-tap flex min-h-[64px] items-center gap-[12px] px-[14px] py-[10px] text-[var(--fg)] no-underline';

/**
 * D124/D126: "Teachers and DJs from your nights" -- people on the line-ups of past nights the dancer went to
 * (my_nights_lineup_people_v1, no arguments). Three states: filled, empty (in words, no button: D130), load
 * error with a retry. An RPC that is not deployed yet is a load error, never a crash. No user yet (query off):
 * nothing at all, never the error state (review N2).
 * Review S3: a row is a router link (no page reload) and a tap is a profile view (.claude/rules/data-contracts.md).
 */
export const LineupPeople = () => {
  const { user } = useAuth();
  const q = useQuery({ queryKey: lineupPeopleQueryKey(user?.id), queryFn: fetchLineupPeople, enabled: Boolean(user?.id), staleTime: 2 * 60_000, retry: false });
  const label = 'Teachers and DJs from your nights';

  if (!user?.id) return null;
  if (q.isLoading) {
    return (
      <section aria-label={label} data-testid="lineup-people">
        <SectionTitle>{label}</SectionTitle>
        <SkeletonRows count={2} label="Loading teachers and DJs" />
      </section>
    );
  }
  if (q.isError || !q.data) {
    return (
      <section aria-label={label} data-testid="lineup-people">
        <SectionTitle>{label}</SectionTitle>
        <ErrorState testId="lineup-people-error" title="We couldn&rsquo;t load teachers and DJs." body="Check your connection, then try again." onRetry={() => void q.refetch()} retrying={q.isFetching} quiet />
      </section>
    );
  }
  if (q.data.people.length === 0) {
    return (
      <section aria-label={label} data-testid="lineup-people">
        <SectionTitle>{label}</SectionTitle>
        <EmptyState
          testId="lineup-people-empty"
          icon={<HeadphonesArt />}
          title="No teachers or DJs yet"
          body={`Teachers and DJs appear here after nights you went to. ${FIND_A_NIGHT}`}
        />
      </section>
    );
  }
  const more = q.data.total - q.data.people.length;
  return (
    <section aria-label={label} data-testid="lineup-people">
      <SectionTitle>{label}</SectionTitle>
      <Card>
        {q.data.people.map((p) => (
          <Link
            key={p.profile_id}
            to={p.public_path}
            data-testid="lineup-person"
            className={ROW_CLASS}
            onClick={() => emitView(p)}
          >
            <PersonAvatar photoUrl={p.avatar_url} name={p.display_name} size={44} />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-[6px]">
                <b className="text-[15px] [overflow-wrap:anywhere]">{p.display_name}</b>
                {p.roles.map((r) => (
                  <span key={r} className={`da-tag ${ROLE[r].tone}`}>{ROLE[r].label}</span>
                ))}
              </span>
              <span className="block text-[13px] text-[var(--mut)] [overflow-wrap:anywhere]">
                Last seen at {p.last_night.event_name}, {fullDate(p.last_night.on_date)}
              </span>
            </span>
            <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--mut)]" />
          </Link>
        ))}
      </Card>
      {more > 0 && (
        <p className="m-0 px-[4px] pt-[8px] text-[13px] text-[var(--mut)]" data-testid="lineup-people-more">and {more} more</p>
      )}
    </section>
  );
};
