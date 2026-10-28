import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  OLD_AFTER_DAYS,
  ageText,
  changedText,
  dateLabel,
  isOld,
  priceText,
  reviewPath,
  typeLabel,
  waitingChip,
  waitingDays,
  type QueueItem,
} from './ambassadorModel';
import { BTN, BTN_OK, BTN_PLAIN, BTN_NO, partyNote } from './DecisionSheets';

const CHIP = 'inline-flex items-center whitespace-nowrap rounded-full border border-border px-2 py-0.5 text-[12px] text-muted-foreground';

export function Chips({ item, party, now }: { item: QueueItem; party: boolean; now: Date }) {
  const days = waitingDays(item, now);
  return (
    <span className="flex flex-wrap gap-1">
      <span className={cn(CHIP, 'text-foreground')}>{typeLabel(item.targetType)}</span>
      <span className={cn(CHIP, isOld(days) && 'border-primary font-semibold text-primary')} data-testid="age-chip" data-old={isOld(days)}>
        {isOld(days) && <>&#9888;{' '}</>}{waitingChip(days)}
      </span>
      {party && <span className={cn(CHIP, 'border-primary text-primary')}>Needs an admin</span>}
    </span>
  );
}

export function EmptyState({ title, text, children, testId }: { title: string; text: string; children?: React.ReactNode; testId: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-2 px-2 py-8 text-center" data-testid={testId}>
      <h2 className="m-0 text-[17px] font-semibold">{title}</h2>
      <p className="m-0 max-w-[300px] text-[14px] text-muted-foreground">{text}</p>
      {children && <div className="flex w-full max-w-[300px] flex-col gap-2">{children}</div>}
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="space-y-3 p-3" aria-busy="true" data-testid="queue-loading">
      <Skeleton className="h-[57px] w-full" />
      <Skeleton className="h-[57px] w-full" />
      <Skeleton className="h-[57px] w-full" />
      <p className="m-0 text-center text-[12px] text-muted-foreground">Loading the queue&hellip;</p>
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <EmptyState testId="queue-error" title="Could not load the queue" text="Check your connection and try again. Nothing has been approved or rejected by this problem.">
      <button type="button" className={BTN_OK} onClick={onRetry}>Try again</button>
    </EmptyState>
  );
}

export function NoAccessState() {
  return (
    <EmptyState testId="queue-no-access" title="No access to this queue" text="This account is not an ambassador for any city, so the queue is hidden. If you should have access, ask an admin to add you.">
      <Link to="/" className={cn(BTN_PLAIN, 'no-underline')}>Back to the site</Link>
    </EmptyState>
  );
}

/** The session ended (expired token, signed out elsewhere): sign in and come back here. */
export function SignedOutState({ signInHref }: { signInHref: string }) {
  return (
    <EmptyState testId="queue-signed-out" title="You are signed out" text="Sign in again to see the queue. Nothing has been approved or rejected.">
      <Link to={signInHref} className={cn(BTN_OK, 'no-underline')}>Sign in</Link>
    </EmptyState>
  );
}

export function CaughtUpState({ cityNames }: { cityNames: string }) {
  return (
    <EmptyState testId="queue-empty" title="All caught up" text={`Nothing is waiting in ${cityNames}. New organiser pages and series show up here as soon as they are submitted. You can close this page; nothing needs you.`}>
      <Link to="/" className={cn(BTN_PLAIN, 'no-underline')}>Back to the site</Link>
    </EmptyState>
  );
}

interface ListProps {
  items: QueueItem[];
  party: ReadonlySet<string>;
  now: Date;
  showCity: boolean;
  more: { text: string; loading: boolean; error: boolean; onMore: () => void } | null;
  onOpen: (item: QueueItem) => void;
}

export function QueueList({ items, party, now, showCity, more, onOpen }: ListProps) {
  const oldest = items.reduce((m, i) => Math.max(m, waitingDays(i, now)), 0);
  return (
    <div data-testid="queue-list">
      <p className="m-0 px-3 py-2 text-[12px] text-muted-foreground" data-testid="age-bar">
        Oldest waiting <b className="text-primary">{oldest} day{oldest === 1 ? '' : 's'}</b> &middot; oldest first
      </p>
      <ul className="m-0 list-none px-3 pb-3">
        {items.map((i) => (
          <li key={i.key} className="border-b border-border">
            <button
              type="button"
              data-testid="queue-row"
              data-key={i.key}
              onClick={() => onOpen(i)}
              className="flex min-h-[56px] w-full items-center gap-2 bg-transparent py-1.5 text-left text-foreground"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <span className="line-clamp-2 text-[14px] font-semibold [overflow-wrap:anywhere]">{i.name}</span>
                {showCity && i.cityName && <span className="text-[12px] text-muted-foreground">{i.cityName}</span>}
                <Chips item={i} party={party.has(i.key)} now={now} />
              </span>
              <span aria-hidden="true" className="min-w-[24px] text-center text-[18px] text-muted-foreground">&rsaquo;</span>
            </button>
          </li>
        ))}
      </ul>
      {more && (
        <div className="space-y-2 px-3 pb-4" data-testid="queue-more">
          <p className="m-0 text-[13px] text-muted-foreground">
            {more.text}
          </p>
          {more.error && <p role="alert" className="m-0 text-[13px] text-destructive">Could not load more. Try again.</p>}
          <button type="button" className={cn(BTN_PLAIN, 'w-full')} disabled={more.loading} onClick={more.onMore}>
            {more.loading ? <>Loading&hellip;</> : 'Show more'}
          </button>
        </div>
      )}
    </div>
  );
}

function facts(i: QueueItem): [string, React.ReactNode][] {
  const rows: [string, React.ReactNode][] = [];
  if (i.organiserNames.length) rows.push([`Organiser${i.organiserNames.length > 1 ? 's' : ''}`, i.organiserNames.join(', ')]);
  if (i.targetType === 'series') {
    const extra = i.futureCount - i.nextDates.length;
    rows.push([
      i.futureCount > 1 ? 'Next dates' : 'Date',
      i.nextDates.length === 0 ? (
        <span className="text-[12px] text-muted-foreground">No upcoming dates</span>
      ) : (
        <>
          {i.nextDates.map((d) => <span key={d} className="block">{dateLabel(d)}</span>)}
          {extra > 0 && <span className="block text-[12px] text-muted-foreground">+ {extra} more ({i.futureCount} in all)</span>}
        </>
      ),
    ]);
    if (i.venueName) rows.push(['Venue', i.venueName]);
    rows.push(['Price', priceText(i)]);
    rows.push(['Flyer', i.hasFlyer ? 'Uploaded' : <span className="text-[12px] text-muted-foreground">None uploaded</span>]);
  }
  return rows;
}

interface ReviewProps {
  item: QueueItem;
  party: boolean;
  now: Date;
  onBack: () => void;
  onApprove: () => void;
  onReject: () => void;
}

export function ReviewView({ item, party, now, onBack, onApprove, onReject }: ReviewProps) {
  const rows = facts(item);
  const days = waitingDays(item, now);
  return (
    <>
      <div className="flex flex-col gap-3 p-3" data-testid="review-view">
        <button type="button" className={cn(BTN, 'self-start border-transparent bg-transparent text-foreground')} onClick={onBack} data-testid="review-back">
          &lsaquo; Back to the list
        </button>
        <h2 className="m-0 text-[17px] font-semibold [overflow-wrap:anywhere]">{item.name}</h2>
        <Chips item={item} party={party} now={now} />
        <p className="m-0 text-[12px] text-muted-foreground">
          {changedText(days)}{item.cityName && <> &middot; {item.cityName}</>}
        </p>
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[14px]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="pt-px text-[12px] text-muted-foreground">{k}</dt>
              <dd className="m-0 [overflow-wrap:anywhere]">{v}</dd>
            </div>
          ))}
        </dl>
        {item.targetType === 'organiser' && rows.length === 0 && (
          <p className="m-0 text-[12px] text-muted-foreground" data-testid="no-extras">
            What is known: the name{item.cityName ? `, the city (${item.cityName})` : ''} and that it {days <= 0 ? 'arrived today' : `has waited ${ageText(days)}`}.
            No other details were submitted, so there is nothing more to show.
          </p>
        )}
        {days >= OLD_AFTER_DAYS && <span className="sr-only">This has been waiting a week or more.</span>}
      </div>
      <div className="sticky bottom-0 z-40 border-t border-border bg-background/95 px-3 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))]" data-testid="review-bar">
        {party ? (
          <div className="rounded-[10px] border border-primary/50 bg-card px-2.5 py-2 text-[13px]" data-testid="party-note">{partyNote(item)}</div>
        ) : (
          <div className="flex gap-2">
            <button type="button" className={cn(BTN_NO, 'flex-1')} data-testid="reject-open" onClick={onReject}>Reject</button>
            <button type="button" className={cn(BTN_OK, 'flex-1')} data-testid="approve-open" onClick={onApprove}>Approve</button>
          </div>
        )}
      </div>
    </>
  );
}

export { reviewPath };
