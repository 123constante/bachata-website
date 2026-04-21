import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, ArrowUpRight, Copy, Check, X } from 'lucide-react';
import type { EventPageModel } from '@/modules/event-page/types';

const GOLD = '#FFA500';
const SUCCESS = '#1D9E75';

type Props = {
  hero: EventPageModel['hero'];
  shortDateLabel: string | null;
  location: EventPageModel['location'];
  actions: EventPageModel['actions'];
  promoCodes: EventPageModel['promoCodes'];
  organiser: EventPageModel['organiser'];
};

const pillClass =
  'flex w-full min-w-0 items-center gap-2 rounded-full border-[0.5px] border-black/10 bg-white px-3 py-[6px] text-[13px] font-medium text-left disabled:opacity-80';

const pillLabel = 'min-w-0 flex-1 truncate overflow-hidden text-ellipsis whitespace-nowrap';

const VenuePill = ({ id, name }: { id: string; name: string }) => (
  <Link to={`/venue-entity/${id}`} className={pillClass}>
    <span className="shrink-0 text-[14px] leading-none" aria-hidden>📍</span>
    <span className={pillLabel} style={{ color: GOLD }}>{name}</span>
    <ChevronRight className="h-3 w-3 shrink-0 text-black/40" />
  </Link>
);

const TicketsPill = ({ href }: { href: string }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className={pillClass}>
    <span className="shrink-0 text-[14px] leading-none" aria-hidden>🎟️</span>
    <span className={pillLabel} style={{ color: GOLD }}>Tickets</span>
    <ArrowUpRight className="h-3 w-3 shrink-0 text-black/40" />
  </a>
);

const SinglePromoPill = ({ code }: { code: string }) => {
  const [copied, setCopied] = useState(false);
  const onCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!navigator?.clipboard) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // silent fail
    }
  };
  return (
    <button type="button" onClick={onCopy} className={pillClass}>
      <span className="shrink-0 text-[14px] leading-none" aria-hidden>🏷️</span>
      <span className={pillLabel} style={{ color: GOLD }}>{code}</span>
      {copied
        ? <Check className="h-3 w-3 shrink-0" style={{ color: SUCCESS }} />
        : <Copy className="h-3 w-3 shrink-0 text-black/40" />
      }
    </button>
  );
};

const PromoSheetRow = ({ code }: { code: EventPageModel['promoCodes']['items'][number] }) => {
  const [copied, setCopied] = useState(false);
  const discount = code.discount_type === 'percent'
    ? `${code.discount_amount}% off`
    : `£${code.discount_amount} off`;
  const onCopy = async () => {
    if (!navigator?.clipboard) return;
    try {
      await navigator.clipboard.writeText(code.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // silent fail
    }
  };
  return (
    <li>
      <button
        type="button"
        onClick={onCopy}
        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left"
      >
        <div>
          <p className="font-mono text-sm font-bold text-white">{code.code}</p>
          <p className="text-[11px] text-white/50">{discount}</p>
        </div>
        {copied
          ? <Check className="h-4 w-4 shrink-0" style={{ color: SUCCESS }} />
          : <Copy className="h-4 w-4 shrink-0 text-white/40" />
        }
      </button>
    </li>
  );
};

const MultiPromoPill = ({ codes }: { codes: EventPageModel['promoCodes']['items'] }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={pillClass}>
        <span className="shrink-0 text-[14px] leading-none" aria-hidden>🏷️</span>
        <span className={pillLabel} style={{ color: GOLD }}>{codes.length} codes</span>
        <ChevronRight className="h-3 w-3 shrink-0 text-black/40" />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/60"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full rounded-t-2xl bg-background p-4 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.15em] text-white/50">Promo codes</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1 text-white/60 hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="space-y-2">
              {codes.map((c) => (
                <PromoSheetRow key={c.id} code={c} />
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
};

const OrganiserPill = ({
  person,
}: {
  person: NonNullable<EventPageModel['organiser']['person']>;
}) => {
  const navigate = useNavigate();
  const initial = (person.displayName ?? '').trim().charAt(0).toUpperCase() || '•';
  const onClick = () => {
    if (person.href) navigate(person.href);
  };
  return (
    <button type="button" onClick={onClick} disabled={!person.href} className={pillClass}>
      {person.avatarUrl ? (
        <img src={person.avatarUrl} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" />
      ) : (
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
          style={{ backgroundColor: GOLD }}
          aria-hidden
        >
          {initial}
        </span>
      )}
      <span className={pillLabel} style={{ color: GOLD }}>{person.displayName}</span>
      {person.href && <ChevronRight className="h-3 w-3 shrink-0 text-black/40" />}
    </button>
  );
};

export const EventHeroMetaBlock = ({
  hero,
  shortDateLabel,
  location,
  actions,
  promoCodes,
  organiser,
}: Props) => {
  const hasVenue = Boolean(location.venueName && location.venueId);
  const hasTickets = Boolean(actions.ticketUrl);
  const hasPromo = promoCodes.items.length > 0;
  const hasOrganiser = Boolean(organiser.person?.displayName);
  const hasAnyMeta = Boolean(shortDateLabel) || hasVenue || hasTickets || hasPromo || hasOrganiser;

  if (!hero.imageUrl && !hasAnyMeta) return null;

  return (
    <section className="grid grid-cols-2 items-start gap-3">
      {/* LEFT — cover */}
      <div className="h-[200px] overflow-hidden rounded-lg border-[0.5px] border-white/15 bg-white/[0.04]">
        {hero.imageUrl ? (
          <img
            src={hero.imageUrl}
            alt={hero.imageAlt}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-[20px] font-semibold tracking-[0.15em] text-white/55">
              {hero.monogram}
            </span>
          </div>
        )}
      </div>

      {/* RIGHT — date + pills */}
      <div className="flex min-w-0 flex-col justify-center gap-[7px]">
        {shortDateLabel && (
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-[20px] leading-none" aria-hidden>📅</span>
            <span className="truncate text-[14px] font-medium text-white">{shortDateLabel}</span>
          </div>
        )}
        {hasVenue && <VenuePill id={location.venueId!} name={location.venueName!} />}
        {hasTickets && <TicketsPill href={actions.ticketUrl!} />}
        {hasPromo && (
          promoCodes.items.length === 1
            ? <SinglePromoPill code={promoCodes.items[0].code} />
            : <MultiPromoPill codes={promoCodes.items} />
        )}
        {hasOrganiser && <OrganiserPill person={organiser.person!} />}
      </div>
    </section>
  );
};
