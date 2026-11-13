// Claim-first (flags.claimFirstInvite, docs/briefs/claim-first-organiser-invite.md): the invite link shows the
// organisation the person is taking over BEFORE anything about the person. The real case: an invitee asked for
// "A bit about you" first typed the organisation's name as their own first name. This screen writes nothing;
// "Yes" only moves on (the claim itself is still the one redeem on the Join tap).
import { JOIN_COPY } from './joinCopy';
import type { JoinPreview } from './joinModel';
import { BTN, GHOST, Lead } from './JoinScreens';

export function ClaimScreen({ preview, onConfirm }: { preview: JoinPreview; onConfirm: () => void }) {
  const logo = preview.organiserLogoUrl ?? null;
  const name = preview.organiserName;
  return (
    <div className="flex flex-col gap-3" data-testid="join-claim">
      <p className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">{JOIN_COPY.claim.tag}</p>
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3" data-testid="join-claim-card">
        {logo ? (
          <img src={logo} alt="" width={64} height={64} className="h-16 w-16 flex-none rounded-xl object-cover" data-testid="join-claim-logo" />
        ) : (
          <span aria-hidden="true" className="grid h-16 w-16 flex-none place-items-center rounded-xl bg-primary/20 text-[26px] font-bold" data-testid="join-claim-initial">{name.slice(0, 1).toUpperCase()}</span>
        )}
        <p className="min-w-0 break-words text-[20px] font-bold leading-tight" data-testid="join-claim-name">{name}</p>
      </div>
      <h1 className="text-[20px] font-bold leading-tight" data-testid="join-claim-heading">{JOIN_COPY.claim.heading}</h1>
      <Lead testId="join-claim-by">{JOIN_COPY.claim.invitedBy(preview.inviterFirstName)}</Lead>
      <Lead testId="join-claim-next">{JOIN_COPY.claim.body}</Lead>
      <button type="button" className={BTN} onClick={onConfirm} data-testid="join-claim-confirm">{JOIN_COPY.claim.button}</button>
      <a href={JOIN_COPY.help.url} target="_blank" rel="noopener noreferrer" className={GHOST} data-testid="join-claim-help">{JOIN_COPY.claim.notYours}</a>
    </div>
  );
}
