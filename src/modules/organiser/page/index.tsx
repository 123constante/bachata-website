import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Users } from 'lucide-react';
import { useOrgSurface } from '../shell/surface';
import { EmptyState, ErrorState, SkeletonRows, StatusTag, initials } from '../ui';
import { lifecycleTag } from '@/modules/organiser/shared/eventState';
import { PROFILE_WIZARD_PATH, requiredLeftText, useProfileProgress } from '@/modules/organiser/shared/profileProgress';
import type { ProfileEntity } from './profileForm';
import { useOwnPage } from './useOwnPage';
import { NO_PAGE_ADD } from '@/modules/organiser/shared/teamRules';

/**
 * C15: while required profile answers are missing, ONE line that opens the
 * wizard (no second checklist here). The number is my_profile_progress_v1's
 * required_left, the one the ring and the go-live lock read.
 */
export function RequiredLine({ organiserId }: { organiserId: string }) {
  const progress = useProfileProgress(organiserId);
  const left = progress.data?.requiredLeft ?? 0;
  if (left <= 0) return null;
  return (
    <Link to={PROFILE_WIZARD_PATH} data-testid="page-required-line" className="flex min-h-[48px] items-center gap-[8px] rounded-[12px] border border-[var(--gold)] bg-[var(--card)] px-[16px] text-[15px] font-semibold text-[var(--fg)]">
      <span className="flex-1">Required to publish: {requiredLeftText(left)}</span>
      <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] text-[var(--gold)]" />
    </Link>
  );
}

/**
 * /account/o/page (C27, tap-to-edit). The public organiser page's facts as rows
 * (photo, name, city, about, links, contact, team), each opening the EXISTING
 * edit-in-place sheet; the layer's ONE Save stays disabled until a value
 * differs and an untouched save sends nothing. A save lands on Done "Saved"
 * (C28b, D29). No review card and no status copy: a Live chip is the only
 * status mark (D22).
 */
export default function PageScreen() {
  const { home, selected, entity, bridge, layer } = useOwnPage();
  const { kind, Shell, paths, hub, addPage } = useOrgSurface();
  // P3 (W4a fix 1): the facts card is a P3 card (.p3-eip maps the editor's colours to P3 tokens)
  // and Team is the ONE Team link below it; R1 keeps its black and gold card and Team card.
  const p3 = kind === 'p3';
  const live = selected?.lifecycle_status === 'live';

  // The stored row with any unsaved draft laid over it (the layer's overlay).
  const row = (entity.data ?? null) as ProfileEntity | null;
  const name = bridge?.overlay.name ?? row?.name ?? '';
  const avatar = (bridge?.overlay.avatar_url !== undefined ? bridge.overlay.avatar_url : row?.avatar_url) ?? null;
  const bio = ((bridge?.overlay.bio !== undefined ? bridge.overlay.bio : row?.bio) ?? '').trim();

  let body: ReactNode;
  if (home.isPending || (selected && entity.isPending)) body = <SkeletonRows count={4} label="Loading your page" testId="page-loading" />;
  else if ((home.isError && !home.data) || entity.isError) {
    body = <ErrorState title="Your page did not load" onRetry={() => void (entity.isError ? entity.refetch() : home.refetch())} retrying={home.isFetching || entity.isFetching} testId="page-load-error" />;
  } else if (!selected) {
    // P3: the You tab's 0-page copy, pointing at P3 Add a page (find, claim, ask to join). R1 Home has the add.
    body = kind === 'p3'
      ? <EmptyState title={NO_PAGE_ADD.title} body={NO_PAGE_ADD.body} action={<Link to={addPage} className="inline-flex min-h-[44px] items-center font-semibold underline" data-testid="page-add-page-link">{NO_PAGE_ADD.action}</Link>} testId="page-no-organiser" />
      : <EmptyState title="You don&rsquo;t run a page yet" body={`Add a page from ${hub.label}, then edit it here.`} testId="page-no-organiser" />;
  } else if (!entity.data) {
    body = <EmptyState title="This page is not available" body={`You may no longer help run it. Pick another page from ${hub.label}.`} testId="page-missing" />;
  } else {
    body = (
      <div className="space-y-[12px]" data-testid="page-rows">
        <RequiredLine organiserId={selected.id} />
        {bridge ? (
          <div className={p3 ? 'p3-eip overflow-hidden rounded-[var(--r-card)] bg-[var(--card)] pt-[16px] text-[var(--fg)]' : 'overflow-hidden rounded-[12px] bg-[#0C0A0D] pt-[16px] text-[#F6F1EA]'} data-testid="page-facts">
            <div className="flex flex-col items-center gap-[8px] px-[16px] pb-[16px]">
              <div className="relative h-[88px] w-[88px]" data-testid="page-photo">
                {avatar ? (
                  <img src={avatar} alt={name} loading="eager" className="h-full w-full rounded-[44px] object-cover" />
                ) : (
                  <span aria-hidden="true" className="flex h-full w-full items-center justify-center rounded-full bg-[var(--card2)] text-[24px] font-bold text-[var(--fg)]">{initials(name || '?')}</span>
                )}
                {bridge.slot('photo')}
              </div>
              <div className="flex max-w-full items-center">
                {/* Its own colour: the site's base `h2` rule (index.css, hsl(--foreground), near white) beats the card's inherited one. */}
                <h2 className={p3 ? 'truncate text-[20px] font-bold leading-[28px] text-[var(--fg)]' : 'truncate text-[20px] font-bold'} data-testid="page-name">{name}</h2>
                {bridge.slot('name')}
              </div>
              {bridge.slot('meta')}
            </div>
            <div className="flex items-start gap-[4px] px-[16px] pb-[12px]" data-testid="page-about">
              {bio ? <p className="min-w-0 flex-1 whitespace-pre-line text-[14px]">{bio}</p> : <div className="min-w-0 flex-1">{bridge.slot('about-empty')}</div>}
              {bridge.slot('about')}
            </div>
            {bridge.slot('links')}
            {bridge.slot('contact')}
            {!p3 && bridge.slot('team')}
          </div>
        ) : (
          <SkeletonRows count={4} label="Loading your page" testId="page-loading" />
        )}
        <Link
          to={paths.team}
          className="flex min-h-[52px] items-center gap-[12px] rounded-[12px] bg-[var(--card)] px-[16px] text-[15px] text-[var(--fg)]"
          data-testid="page-team-link"
        >
          <Users aria-hidden="true" className="h-[16px] w-[16px] text-[var(--mut)]" />
          <span className="flex-1">Team</span>
          <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] text-[var(--mut)]" />
        </Link>
      </div>
    );
  }

  return (
    <Shell
      title={selected?.name ?? 'Your page'}
      back={hub}
      topBarEnd={live ? <StatusTag tone="live" testId="page-live-chip">{lifecycleTag('live').label}</StatusTag> : undefined}
      testId="org-page-page"
    >
      {body}
      {layer}
    </Shell>
  );
}
