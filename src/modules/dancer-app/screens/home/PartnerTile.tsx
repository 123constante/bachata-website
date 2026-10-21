import { useFeatureInterest } from '../../api/useFeatureInterest';
import { toDancerError } from '../../api/errors';
import { Card } from '@/modules/organiser/ui';

/** Review S5: a ghost, not a second filled primary (the hero's "See event" is the one primary on Home). */
const PARTNER_BUTTON_CLASS =
  'da-tap inline-flex min-h-[48px] items-center justify-center rounded-[var(--r-ctl,12px)] border border-[var(--line)] bg-[var(--card2)] px-[16px] text-[15px] font-bold text-[var(--fg)] disabled:opacity-70';

export const PARTNER_TITLE = 'Partner search: coming soon';
export const PARTNER_BODY = 'Find someone to practise and dance with.';
export const PARTNER_ASK = 'Tell me when it\u2019s ready';
export const PARTNER_DONE = 'We\u2019ll tell you';
export const PARTNER_DONE_BODY = 'We\u2019ll let you know the moment partner search opens.';

export const PARTNER_LOADING = 'Loading\u2026';
/** F15: register_feature_interest_v1 allows ONE ask per 30 days, so "wait a few minutes" was wrong. */
export const PARTNER_RATE_LIMITED = 'You can only ask once every 30 days. Please try again next month.';
/** F15: the feature name was refused; nothing the person does changes that, so no "try again". */
export const PARTNER_INVALID = 'We cannot take sign-ups for this right now. There is nothing you need to do.';

/** The words under the button after a failed ask (the tile's own copy for its two special codes). */
export const partnerErrorCopy = (err: unknown): string => {
  const e = toDancerError(err);
  if (e.code === 'rate_limited') return PARTNER_RATE_LIMITED;
  if (e.code === 'invalid_feature') return PARTNER_INVALID;
  return e.message;
};

/** "Tell me when partner search is ready": one tap, then the button is off and says why. */
export const PartnerTile = () => {
  const { registered, register, loading } = useFeatureInterest('partner_search');
  const failed = register.isError ? partnerErrorCopy(register.error) : null;
  return (
    <Card variant="padded" testId="tile-partner" className="da-tile-rose grid gap-[6px] p-[14px]">
      <b style={{ fontSize: 14 }}>{PARTNER_TITLE}</b>
      <span className="da-tint" style={{ fontSize: 13 }}>{registered ? PARTNER_DONE_BODY : PARTNER_BODY}</span>
      <button
        type="button"
        className={PARTNER_BUTTON_CLASS}
        data-testid="partner-notify"
        disabled={registered || loading || register.isPending}
        onClick={() => register.mutate()}
      >
        {/* A disabled button always says why: done, saving, or still checking (F15). */}
        {registered ? PARTNER_DONE : register.isPending ? 'Saving\u2026' : loading ? PARTNER_LOADING : PARTNER_ASK}
      </button>
      {failed && <span role="alert" data-testid="partner-error" style={{ fontSize: 13, color: 'var(--da-danger)' }}>{failed}</span>}
    </Card>
  );
};
