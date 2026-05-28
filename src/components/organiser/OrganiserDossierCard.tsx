import { Link } from 'react-router-dom';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { emitProfileView } from '@/lib/profileViewEmit';

type Props = {
  id: string;
  name: string;
  avatarUrl: string | null;
  organisationCategory: string | null;
  cityName: string | null;
  eventCount: number;
  nextEventDate: string | null;
  isLive?: boolean;
};

const getMonogram = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2) || '?';

const formatNextEventDate = (date: string | null): string => {
  if (!date) return 'No upcoming';
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);

  const diffTime = d.getTime() - today.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);

  if (diffDays === 0) return 'Tonight';
  if (diffDays === 1) return 'Tomorrow';

  const weekday = d.toLocaleDateString('en-GB', { weekday: 'short' });
  const day = d.getDate();
  const month = d.toLocaleDateString('en-GB', { month: 'short' });
  return `${weekday} ${day} ${month}`;
};

export const OrganiserDossierCard = ({
  id,
  name,
  avatarUrl,
  organisationCategory,
  cityName,
  eventCount,
  nextEventDate,
  isLive,
}: Props) => {
  const [imgFailed, setImgFailed] = useState(false);
  const monogram = getMonogram(name);
  const nextLabel = formatNextEventDate(nextEventDate);
  const categoryLabel = organisationCategory || 'Organiser';
  const eventLabel = eventCount === 1 ? '1 event' : `${eventCount} events`;

  return (
    <Link
      to={`/organisers/${id}`}
      onClick={() =>
        emitProfileView({
          personId: id,
          profileType: 'organiser',
          context: 'listing:organisers',
        })
      }
      className={cn(
        'group flex gap-3 rounded-lg border p-3 transition-all',
        'border-white/5 bg-white/[0.02] hover:border-primary/30 hover:bg-primary/5',
        isLive && 'border-green-500/30 bg-green-500/5'
      )}
      aria-label={`${name} Ã¢â‚¬â€ organiser profile`}
    >
      {/* Avatar circle */}
      <div className="flex-shrink-0">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/5 text-sm font-bold text-primary/60">
          {avatarUrl && !imgFailed ? (
            <img
              src={avatarUrl}
              alt=""
              className="h-full w-full rounded-full object-cover"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <span className="font-bold">{monogram}</span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {/* Name + role */}
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="truncate text-sm font-semibold leading-tight text-foreground">
            {name}
          </h3>
          <span className="inline-flex w-fit rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-primary/80">
            {categoryLabel}
          </span>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="min-w-0">
            {nextEventDate ? (
              <div className="font-semibold text-foreground">
                {nextLabel === 'Tonight' ? (
                  <span className="text-green-500">&middot; {nextLabel} &middot;</span>
                ) : (
                  nextLabel
                )}
              </div>
            ) : null}
          </div>
          <div className="min-w-0 text-right">
            <div className="font-semibold text-foreground">{eventCount}</div>
            <div className="text-muted-foreground">{eventCount === 1 ? 'event' : 'events'}</div>
          </div>
          {cityName && (
            <div className="col-span-2 truncate text-muted-foreground">{cityName}</div>
          )}
        </div>
      </div>

      {/* Live indicator */}
      {isLive && (
        <div className="flex-shrink-0 self-center">
          <div className="flex h-2 w-2 rounded-full bg-green-500 shadow-lg shadow-green-500/60" />
        </div>
      )}
    </Link>
  );
};

export default OrganiserDossierCard;
