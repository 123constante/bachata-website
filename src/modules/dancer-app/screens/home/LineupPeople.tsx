import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { PersonAvatar } from '@/components/account/profiles/PersonAvatar';
import { Card, EmptyState, ErrorState, SectionLabel, SkeletonRows } from '@/modules/organiser/ui';
import { fetchLineupPeople, type LineupPerson } from '../../api/lineupPeople';
import { fullDate } from '../nights/nightsModel';
import { HeadphonesArt } from '../art';

export const lineupPeopleQueryKey = (userId: string | undefined) => ['dancer-app', 'lineup-people', userId ?? null] as const;

const ROLE: Record<LineupPerson['roles'][number], { label: string; tone: string }> = {
  teacher: { label: 'Teacher', tone: 'da-tone-violet' },
  dj: { label: 'DJ', tone: 'da-tone-teal' },
};

/**
 * D124/D126: "Teachers and DJs from your nights" -- people on the line-ups of past nights the dancer went to
 * (my_nights_lineup_people_v1, no arguments). Three states: filled, empty (in words, no button: D130), load
 * error with a retry. An RPC that is not deployed yet is a load error, never a crash.
 */
export const LineupPeople = () => {
  const { user } = useAuth();
  const q = useQuery({ queryKey: lineupPeopleQueryKey(user?.id), queryFn: fetchLineupPeople, enabled: Boolean(user?.id), staleTime: 2 * 60_000, retry: false });
  const label = 'Teachers and DJs from your nights';

  if (q.isLoading) {
    return (
      <section aria-label={label} data-testid="lineup-people">
        <SectionLabel>{label}</SectionLabel>
        <SkeletonRows count={2} label="Loading teachers and DJs" />
      </section>
    );
  }
  if (q.isError || !q.data) {
    return (
      <section aria-label={label} data-testid="lineup-people">
        <SectionLabel>{label}</SectionLabel>
        <ErrorState testId="lineup-people-error" title="We couldn&rsquo;t load teachers and DJs." body="Check your connection, then try again." onRetry={() => void q.refetch()} retrying={q.isFetching} quiet />
      </section>
    );
  }
  if (q.data.people.length === 0) {
    return (
      <section aria-label={label} data-testid="lineup-people">
        <SectionLabel>{label}</SectionLabel>
        <EmptyState
          testId="lineup-people-empty"
          icon={<HeadphonesArt />}
          title="No teachers or DJs yet"
          body="Teachers and DJs appear here after nights you went to. Find your next night with the Bachata Calendar link at the top left."
        />
      </section>
    );
  }
  return (
    <section aria-label={label} data-testid="lineup-people">
      <SectionLabel>{label}</SectionLabel>
      <Card>
        {q.data.people.map((p) => (
          <a key={p.profile_id} href={p.public_path} data-testid="lineup-person" style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 64, padding: '10px 14px', color: 'var(--fg)', textDecoration: 'none' }}>
            <PersonAvatar photoUrl={p.avatar_url} name={p.display_name} size={44} />
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <b style={{ fontSize: 15, overflowWrap: 'anywhere' }}>{p.display_name}</b>
                {p.roles.map((r) => (
                  <span key={r} className={`da-tag ${ROLE[r].tone}`}>{ROLE[r].label}</span>
                ))}
              </span>
              <span style={{ display: 'block', fontSize: 13, color: 'var(--mut)', overflowWrap: 'anywhere' }}>
                Last seen at {p.last_night.event_name}, {fullDate(p.last_night.on_date)}
              </span>
            </span>
          </a>
        ))}
      </Card>
    </section>
  );
};
