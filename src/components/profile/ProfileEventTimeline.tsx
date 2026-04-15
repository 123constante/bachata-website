import { useNavigate } from 'react-router-dom';
import { CalendarDays, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useProfileProgramAppearances,
  type PersonType,
} from '@/hooks/useProfileProgramAppearances';

type ProfileEventTimelineProps = {
  personType: PersonType;
  /**
   * The profile-table ID for this person:
   *   teacher      → teacher_profiles.id
   *   dj           → dj_profiles.id        (NOT entities.id)
   *   vendor       → vendors.id
   *   videographer → videographers.id
   *   dancer       → dancer_profiles.id
   *   organiser    → entities.id
   */
  personId?: string;
  title?: string;
  emptyText?: string;
  limit?: number;
};

const formatConnectionLabel = (value: string | null): string => {
  if (!value) return 'Connected';
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const formatEventDate = (value: string | null): string => {
  if (!value) return 'Date to be announced';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date to be announced';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const ProfileEventTimeline = ({
  personType,
  personId,
  title = 'Event appearances',
  emptyText = 'No event appearances yet.',
  limit = 50,
}: ProfileEventTimelineProps) => {
  const navigate = useNavigate();

  const { data: items = [], isLoading } = useProfileProgramAppearances(
    personType,
    personId,
    limit,
  );

  return (
    <Card className="mb-6 bg-white/[0.04] border-white/10 backdrop-blur-sm">
      <CardContent className="p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">{title}</h2>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : items.length > 0 ? (
          <div className="space-y-3">
            {items.map((item) => (
              <button
                key={`${item.event_id}::${item.source}::${item.connection_label}`}
                type="button"
                onClick={() => navigate(`/event/${item.event_id}`)}
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] p-3 text-left transition-colors hover:bg-white/[0.07]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">
                      {item.event_name || 'Event'}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatEventDate(item.event_start_time)}
                      </span>
                      {item.event_location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {item.event_location}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-white/15 bg-white/[0.06]"
                  >
                    {formatConnectionLabel(item.connection_label)}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">{emptyText}</p>
        )}
      </CardContent>
    </Card>
  );
};

export default ProfileEventTimeline;
