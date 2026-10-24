import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMyDancerEdit } from '../../api/useMyDancerEdit';
import { ACCOUNT_SETTINGS_LABEL } from '../../copy/sharedCopy';
import { toDancerError } from '../../api/errors';
import { NO_PROFILE_MESSAGE, PROFILE_HELP_MESSAGE } from '../../api/messageUs';
import { MessageUsLink } from '../me/ui';
import {
  ACCOUNT_SETTINGS_PATH,
  INSTALL_STEPS,
  SITE_HOME_PATH,
  detectPlatform,
  installOrder,
  optionsRows,
  shareOrCopy,
  shareUrlFor,
  type OptionsRow,
} from './optionsModel';
import { Card, FIELD_CLASS, GhostButton, SummaryRow } from '@/modules/organiser/ui';
import { DisabledRow, LINK_GHOST, LinkRow, ScreenTitle } from '../blocks';
import { Sheet } from './optionsUi';
import FeedbackSheet from './FeedbackSheet';
import SignOutControl from './SignOutControl';
import { CoupleArt } from '../art';
import NoProfileWayOut from './NoProfileWayOut';

const LOAD_FAILED_COPY = 'We could not load your options. Check your connection and try again.';

const REASON = 'mx-[4px] mb-0 mt-[2px] text-[13px] text-[var(--mut)]';

const OptionsScreen = () => {
  const profile = useMyDancerEdit();
  const [sheet, setSheet] = useState<'install' | 'feedback' | null>(null);
  const [copied, setCopied] = useState<'idle' | 'copied' | 'manual'>('idle');

  if (profile.isError) {
    // No profile / wrong profile: Retry cannot help, so say so and offer the one way out (journey matrix, check b).
    const err = toDancerError(profile.error);
    if (err.code === 'no_profile' || err.code === 'profile_mismatch') {
      return (
        <Card variant="padded" testId="dancer-screen-options">
          <ScreenTitle>Options</ScreenTitle>
          <CoupleArt />
          <p role="alert" className="my-[8px] text-[14px]">{err.message}</p>
          <MessageUsLink message={err.code === 'no_profile' ? NO_PROFILE_MESSAGE : PROFILE_HELP_MESSAGE} className={LINK_GHOST} />
          {/* Walk bug 1: never trapped here -- Account settings, Sign out, and the organiser area for an organiser. */}
          <NoProfileWayOut />
        </Card>
      );
    }
    return (
      <Card variant="padded" testId="dancer-screen-options">
        <ScreenTitle>Options</ScreenTitle>
        <p role="alert" className="my-[8px] text-[14px]">{LOAD_FAILED_COPY}</p>
        <GhostButton onClick={() => void profile.refetch()}>Retry</GhostButton>
      </Card>
    );
  }
  if (!profile.data) {
    return (
      <Card variant="padded" testId="dancer-screen-options">
        <ScreenTitle>Options</ScreenTitle>
        <p className="text-[14px] text-[var(--mut)]">Loading&hellip;</p>
      </Card>
    );
  }

  const me = profile.data;
  const rows = optionsRows(me);
  const shareUrl = shareUrlFor(me.profile_id);
  const platform = detectPlatform(typeof navigator === 'undefined' ? '' : navigator.userAgent, typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints);

  const renderRow = (row: OptionsRow) => {
    if (row.disabledReason) {
      return (
        <DisabledRow key={row.id} label={row.label} reason={row.disabledReason} testId={`opt-${row.id}`} reasonTestId={`opt-why-${row.id}`} />
      );
    }
    if (row.id === 'sign-out') return <SignOutControl key={row.id} testId={`opt-${row.id}`} />;
    if (row.href) {
      const external = /^https?:/.test(row.href);
      return external ? (
        <LinkRow key={row.id} href={row.href} external label={row.label} testId={`opt-${row.id}`} />
      ) : (
        <LinkRow key={row.id} to={row.href} label={row.label} sublabel={row.sublabel} testId={`opt-${row.id}`} />
      );
    }
    const onClick = async () => {
      if (row.id === 'share') {
        const outcome = await shareOrCopy(shareUrl, 'My dancer page');
        setCopied(outcome === 'copied' || outcome === 'manual' ? outcome : 'idle');
      }
      else if (row.id === 'install') setSheet('install');
      else if (row.id === 'feedback') setSheet('feedback');
    };
    return <SummaryRow key={row.id} label={row.label} onPress={() => void onClick()} testId={`opt-${row.id}`} />;
  };

  return (
    <section data-testid="dancer-screen-options" className="grid gap-[12px]">
      <ScreenTitle>Options</ScreenTitle>

      <div className="grid gap-[8px]">
        <Card>{rows.map(renderRow)}</Card>
        {copied === 'copied' && <p role="status" className={REASON}>Link copied</p>}
        {copied === 'manual' && (
          <div>
            <p role="status" className={REASON}>Copying is not available here. Select the link and copy it:</p>
            <input
              readOnly
              value={shareUrl}
              aria-label="Link to my page"
              data-testid="opt-share-field"
              onFocus={(e) => e.currentTarget.select()}
              className={`${FIELD_CLASS} min-h-[44px]`}
            />
          </div>
        )}
        <p className={REASON} data-testid="opt-account-settings-line">
          Hide your profile, download your data or delete your account:{' '}
          <Link to={ACCOUNT_SETTINGS_PATH} className="inline-flex min-h-[44px] items-center text-[var(--gold-fg)]">{ACCOUNT_SETTINGS_LABEL}</Link>
        </p>
      </div>

      <Card>
        <LinkRow to={SITE_HOME_PATH} label={<>&larr; Back to the Bachata Calendar website</>} testId="opt-back-to-site" />
      </Card>

      {sheet === 'feedback' && <FeedbackSheet onClose={() => setSheet(null)} />}

      {sheet === 'install' && (
        <Sheet title="Add to my phone's home screen" testId="opt-install-sheet" onClose={() => setSheet(null)}>
          {installOrder(platform).map((k) => (
            <div key={k} data-testid={`opt-install-${k}`} className="mb-[10px]">
              <h3 className="mb-[4px] mt-0 text-[15px] font-bold">{INSTALL_STEPS[k].title}</h3>
              <ol className="m-0 pl-[20px] text-[14px]">
                {INSTALL_STEPS[k].steps.map((s) => <li key={s}>{s}</li>)}
              </ol>
            </div>
          ))}
        </Sheet>
      )}

    </section>
  );
};

export default OptionsScreen;
