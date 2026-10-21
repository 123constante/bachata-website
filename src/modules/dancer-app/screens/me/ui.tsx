import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { UseQueryResult } from '@tanstack/react-query';
import { toDancerError } from '../../api/errors';
import type { MyDancerEdit } from '../../api/types';
import { CoupleArt } from '../art';
import { NO_NAME_YET, ownPublicName } from '../../api/publicName';
import { Card, PrimaryButton } from '@/modules/organiser/ui';
import { LINK_GHOST, LINK_PRIMARY } from '../blocks';
import { PersonAvatar } from '@/components/account/profiles/PersonAvatar';
import { NO_PROFILE_MESSAGE, PROFILE_HELP_MESSAGE, dancerMessageUsUrl } from '../../api/messageUs';

/** Shared bits of the Me and Edit screens (sizes in px, never rem: the phone html font-size is ~13.5px). */

export const StrengthBar = ({ pct }: { pct: number }) => (
  <div
    role="progressbar"
    aria-label="Profile strength"
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={pct}
    className="h-[8px] overflow-hidden rounded-full bg-[var(--card2)]"
  >
    <div className="da-bar-fill" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%' }} />
  </div>
);

/** The dancer's own avatar: the ONE PersonAvatar, named by the public name (no name yet -> a person glyph). */
export const Avatar = ({
  profile,
  size,
}: {
  profile: Pick<MyDancerEdit, 'avatar_url' | 'first_name' | 'display_name' | 'surname' | 'hide_surname_publicly'>;
  size: number;
}) => {
  const name = ownPublicName(profile);
  return (
    <PersonAvatar
      photoUrl={profile.avatar_url}
      name={name === NO_NAME_YET ? null : name}
      size={size}
      loading="eager"
      imgTestId="me-photo"
      placeholderTestId="me-photo-placeholder"
    />
  );
};

/** The dancer "Message us" control: WhatsApp, pre-filled. Wherever copy says "Message us", this is on screen. */
export const MessageUsLink = ({ message, className = LINK_PRIMARY }: { message: string; className?: string }) => (
  <a href={dancerMessageUsUrl(message)} target="_blank" rel="noopener noreferrer" className={className} data-testid="message-us">
    Message us on WhatsApp
  </a>
);

/** Loading / error states for the query both screens share. Returns null when the data is ready. */
export const QueryGate = ({ q, id }: { q: UseQueryResult<MyDancerEdit>; id: string }): ReactNode => {
  if (q.isPending) {
    return (
      <Card variant="padded" testId={`dancer-state-${id}`} aria-busy="true">
        <p className="m-0 text-[14px] text-[var(--mut)]">Loading your profile&hellip;</p>
      </Card>
    );
  }
  if (q.isError) {
    const err = toDancerError(q.error);
    // A profile the server cannot find (or match) is not fixed by retrying: its copy says
    // "Message us", so the control is Message us (as Onboarding's, audit M23).
    const needsUs = err.code === 'no_profile' || err.code === 'profile_mismatch';
    return (
      <Card variant="padded" testId={`dancer-state-${id}`} role="alert">
        {needsUs && <CoupleArt />}
        <p className="mb-[10px] text-[14px]" data-testid="load-error">{err.message}</p>
        <div className="grid gap-[8px]">
          {needsUs ? (
            <MessageUsLink message={err.code === 'no_profile' ? NO_PROFILE_MESSAGE : PROFILE_HELP_MESSAGE} />
          ) : (
            <PrimaryButton onClick={() => void q.refetch()}>Try again</PrimaryButton>
          )}
          <Link to="/" className={LINK_GHOST}>
            Back to the Bachata Calendar website
          </Link>
        </div>
      </Card>
    );
  }
  return null;
};
