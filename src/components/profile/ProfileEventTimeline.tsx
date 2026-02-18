import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

type ProfileEventTimelineProps = {
  personType: 'dancer' | 'organiser' | 'teacher' | 'dj' | 'vendor' | 'videographer';
  personId?: string;
  title?: string;
  emptyText?: string;
  limit?: number;
};

const formatConnectionLabel = (value: string | null) => {
  if (!value) return 'Connected';
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const formatEventDate = (value: string | null) => {
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
  title = 'Connected events',
  emptyText = 'No connected events yet.',
  limit = 50,
}: ProfileEventTimelineProps) => {
  const navigate = useNavigate();

  const { data: timeline = [], isLoading } = useQuery({
    queryKey: ['profile-event-timeline', personType, personId, limit],
    enabled: !!personId,
    queryFn: async () => {
      if (!personId) return [];
      const { data, error } = await (supabase.rpc as any)('get_profile_event_timeline', {
        p_person_type: personType,
        p_person_id: personId,
        p_limit: limit,
        p_offset: 0,
      });

      if (error) throw error;
      return (data || []) as any[];
    },
  });

  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">{title}</h2>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : timeline.length > 0 ? (
          <div className="space-y-3">
            {timeline.map((item: any) => (
              <button
                key={`${item.event_id}-${item.connection_label}-${item.sort_order}`}
                type="button"
                onClick={() => navigate(`/event/${item.event_id}`)}
                className="w-full rounded-lg border border-festival-teal/25 bg-muted/30 p-3 text-left transition-colors hover:bg-muted/60"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{item.event_name || 'Event'}</p>
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
                  <Badge variant="outline" className="border-festival-teal/30 bg-background/60">
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