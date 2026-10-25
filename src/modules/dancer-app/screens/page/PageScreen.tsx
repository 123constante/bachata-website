import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { APP_ACCOUNT_SETTINGS_PATH } from '@/lib/accountRouting';
import { toDancerError } from '../../api/errors';
import { fmt, numbersCanRetry, numbersErrorCopy, viewsDetail, VIEWS_WEEK_LABEL } from '../../api/numbersModel';
import { useMyDancerEdit } from '../../api/useMyDancerEdit';
import { useMyNumbers } from '../../api/useMyNumbers';
import { ACCOUNT_SETTINGS_LABEL } from '../../copy/sharedCopy';
import { Card, FIELD_CLASS, GhostButton, PrimaryButton } from '@/modules/organiser/ui';
import { LINK_GHOST, LINK_PRIMARY, ScreenTitle, SectionTitle, StickyActions, TEXT_ACTION } from '../blocks';
import { shareOrCopy } from '../options/optionsModel';
import NoProfileWayOut from '../options/NoProfileWayOut';
import { NO_PROFILE_MESSAGE, PROFILE_HELP_MESSAGE } from '../../api/messageUs';
import { MessageUsLink } from '../me/ui';
import { pageModel } from './pageModel';

import { CoupleArt } from '../art';

/** Review N8 (prototype checklist): a filled 20px disc with a tick when the page shows it, an empty ring when not. */
const TickDisc = ({ done }: { done: boolean }) => (
  <span
    aria-hidden="true"
    data-testid="page-look-tick"
    className={`inline-flex h-[20px] w-[20px] flex-none items-center justify-center rounded-full ${done ? 'bg-[var(--gold-fg)] text-[var(--bg)]' : 'border-2 border-[var(--line-strong)]'}`}
  >
    {done && <Check className="h-[13px] w-[13px]" strokeWidth={3} />}
  </span>
);

const PageScreen = () => {
  const profile = useMyDancerEdit({ staleTime: 60_000 });
  const numbers = useMyNumbers();
  const [copied, setCopied] = useState<'idle' | 'copied' | 'manual'>('idle');

  if (profile.isLoading) return <Card variant="padded" role="status" testId="dancer-screen-page">Loading your page&hellip;</Card>;
  if (profile.isError || !profile.data) {
    const err = toDancerError(profile.error);
    return (
      <Card variant="padded" testId="dancer-screen-page">
        <ScreenTitle>My page</ScreenTitle>
        {(err.code === 'no_profile' || err.code === 'profile_mismatch') && <CoupleArt />}
        <p role="alert" className="my-[8px] text-[14px]">{err.message}</p>
        {err.code === 'no_profile' || err.code === 'profile_mismatch' ? (
          <>
            <MessageUsLink message={err.code === 'no_profile' ? NO_PROFILE_MESSAGE : PROFILE_HELP_MESSAGE} className={LINK_GHOST} />
            <NoProfileWayOut />
          </>
        ) : (
          <button type="button" className={TEXT_ACTION} onClick={() => void profile.refetch()}>Try again</button>
        )}
      </Card>
    );
  }

  const m = pageModel(profile.data);
  const disabled = m.url === null;
  const hasPhoto = Boolean(profile.data.avatar_url);

  return (
    <section data-testid="dancer-screen-page" className="grid gap-[12px]">
      <ScreenTitle>My page</ScreenTitle>

      <div>
        <SectionTitle as="p">How your page looks</SectionTitle>
        <Card variant="padded">
          <ul data-testid="page-look" className="m-0 grid list-none gap-[8px] p-0 text-[15px]">
            {m.lookLines.map((l) => (
              <li key={l.text} data-done={String(l.done)} className={`flex items-start gap-[10px] ${l.done ? '' : 'text-[var(--mut)]'}`}>
                <TickDisc done={l.done} />
                {l.text}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card variant="padded" testId="page-views" className="da-tile-teal grid gap-[2px]">
        <b className="text-[14px]">{VIEWS_WEEK_LABEL}</b>
        {numbers.isLoading ? (
          <span className="text-[14px] text-[var(--mut)]">Loading&hellip;</span>
        ) : numbers.data ? (
          <>
            <span className="da-num text-[28px] font-extrabold" data-testid="page-views-count">{fmt(numbers.data.viewsWeek)}</span>
            <span className="da-tint text-[13px]" data-testid="page-views-detail">{viewsDetail(numbers.data, hasPhoto)}</span>
          </>
        ) : (
          <>
            <span role="status" data-testid="page-views-error" className="text-[14px]">{numbersErrorCopy(numbers.error)}</span>
            {numbersCanRetry(numbers.error) && (
              <div>
                <button type="button" className={TEXT_ACTION} data-testid="page-views-retry" onClick={() => void numbers.refetch()}>Try again</button>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Review N8: View and Share pinned at the bottom, above the tab bar (prototype .foot). */}
      <StickyActions testId="page-actions">
        {disabled ? (
          <PrimaryButton disabled aria-disabled="true" aria-describedby="page-why" testId="page-view">View my page</PrimaryButton>
        ) : (
          <a href={m.url ?? undefined} className={LINK_PRIMARY} data-testid="page-view">View my page</a>
        )}
        {disabled ? (
          <GhostButton disabled aria-disabled="true" aria-describedby="page-why" testId="page-share">Share my page</GhostButton>
        ) : (
          <GhostButton
            testId="page-share"
            onClick={async () => {
              const out = await shareOrCopy(m.url as string, 'My dancer page');
              setCopied(out === 'copied' || out === 'manual' ? out : 'idle');
            }}
          >
            Share my page
          </GhostButton>
        )}
        {m.disabledReason && (
          <p id="page-why" data-testid="page-why" className="m-0 text-[13px] text-[var(--mut)]">
            {m.disabledReason}{' '}
            {/* F8: the only way forward when View and Share are off, so a full 44px tap target (px, not rem). */}
            {m.fixHint === 'edit' && <Link to="/app/me/edit" className={TEXT_ACTION}>Edit my profile</Link>}
            {m.fixHint === 'account-settings' && <Link to={APP_ACCOUNT_SETTINGS_PATH} className={TEXT_ACTION}>{ACCOUNT_SETTINGS_LABEL}</Link>}
          </p>
        )}
        {copied === 'copied' && <p role="status" className="m-0 text-[13px] text-[var(--mut)]">Link copied</p>}
        {copied === 'manual' && m.url && (
          <input readOnly value={m.url} aria-label="Link to my page" data-testid="page-share-field" onFocus={(e) => e.currentTarget.select()} className={`${FIELD_CLASS} min-h-[44px]`} />
        )}
      </StickyActions>
    </section>
  );
};

export default PageScreen;
