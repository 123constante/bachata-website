import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, MapPin, Loader2, Inbox } from 'lucide-react';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCity } from '@/contexts/CityContext';
import { buildCityPath } from '@/lib/cityPath';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';

type AttendanceRow = {
  event_id: string;
  status: string;
  updated_at: string | null;
};

type EventRow = {
  id: string;
  name: string | null;
  date: string | null;
  city: string | null;
  type: string | null;
};

type AttendanceCard = {
  event_id: string;
  name: string;
  date: string | null;
  city: string | null;
  type: string | null;
  status: string;
  updated_at: string | null;
};

const formatDate = (value?: string | null) => {
  if (!value) return 'Date TBA';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Date TBA';
  return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const STATUS_LABEL: Record<string, string> = {
  going: 'Going',
  interested: 'Interested',
  registered: 'Registered',
  attended: 'Attended',
  cancelled: 'Cancelled',
};

const statusBadgeClass = (status: string) => {
  const key = status.toLowerCase();
  if (key === 'going' || key === 'attended') {
    return 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100';
  }
  if (key === 'interested' || key === 'registered') {
    return 'border-cyan-400/40 bg-cyan-500/15 text-cyan-100';
  }
  if (key === 'cancelled') {
    return 'border-red-400/40 bg-red-500/15 text-red-100';
  }
  return 'border-slate-500/40 bg-slate-700/30 text-slate-200';
};

const renderStatusLabel = (status: string) => {
  const key = status.toLowerCase();
  return STATUS_LABEL[key] ?? (status ? status[0].toUpperCase() + status.slice(1) : 'Unknown');
};

const fetchMyAttendance = async (): Promise<AttendanceCard[]> => {
  const { data: rows, error } = await supabase.rpc('get_my_event_attendance_v1');
  if (error) throw error;

  const attendance = (rows ?? []) as AttendanceRow[];
  if (!attendance.length) return [];

  const eventIds = Array.from(new Set(attendance.map((row) => row.event_id)));
  const { data: eventRows, error: eventsError } = await supabase
    .from('events')
    .select('id, name, date, city, type')
    .in('id', eventIds);

  if (eventsError) throw eventsError;

  const eventMap = new Map<string, EventRow>(((eventRows ?? []) as EventRow[]).map((row) => [row.id, row]));

  return attendance
    .map((row) => {
      const event = eventMap.get(row.event_id);
      if (!event) return null;
      return {
        event_id: row.event_id,
        name: event.name ?? 'Untitled event',
        date: event.date,
        city: event.city,
        type: event.type,
        status: row.status,
        updated_at: row.updated_at,
      } satisfies AttendanceCard;
    })
    .filter((row): row is AttendanceCard => row !== null);
};

const MyAttendance = () => {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { citySlug } = useCity();
  const navigate = useNavigate();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<AttendanceCard[]>({
    queryKey: ['my-event-attendance', user?.id],
    queryFn: fetchMyAttendance,
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });

  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => {
      const aTime = a.date ? new Date(a.date).getTime() : 0;
      const bTime = b.date ? new Date(b.date).getTime() : 0;
      if (aTime !== bTime) return bTime - aTime;
      const aUpd = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const bUpd = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return bUpd - aUpd;
    });
  }, [data]);

  const showLoading = isAuthLoading || (Boolean(user?.id) && isLoading);
  const calendarPath = citySlug ? buildCityPath(citySlug, 'calendar') : '/parties';

  return (
    <GlobalLayout breadcrumbs={buildBreadcrumbs('profile.attendance')} backHref="/profile">
      <div className="px-4 pt-4 pb-24">
        <div className="max-w-5xl mx-auto space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-foreground">My Event Attendance</h1>
              <p className="text-xs text-muted-foreground">
                Events you have marked as going or interested.
              </p>
            </div>
            {data && data.length > 0 && (
              <Badge className="border border-cyan-400/35 bg-cyan-500/10 text-cyan-100">
                {data.length} {data.length === 1 ? 'event' : 'events'}
              </Badge>
            )}
          </div>

          {showLoading && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
            </div>
          )}

          {!showLoading && isError && (
            <Card className="border border-red-400/40 bg-red-950/40">
              <CardContent className="p-3 flex flex-col gap-2">
                <p className="text-sm text-red-100">
                  Failed to load attendance: {error instanceof Error ? error.message : 'Unknown error'}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="self-start border-red-400/40 bg-red-950/30 hover:bg-red-900/40 text-red-100"
                  onClick={() => void refetch()}
                  disabled={isFetching}
                >
                  {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  Retry
                </Button>
              </CardContent>
            </Card>
          )}

          {!showLoading && !isError && sorted.length === 0 && (
            <Card className="border border-dashed border-slate-700 bg-slate-900/40">
              <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-900/80">
                  <Inbox className="h-4 w-4 text-slate-400" />
                </span>
                <p className="text-sm text-foreground">No event attendance yet.</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Tap "Going" or "Interested" on any event page and it will show up here.
                </p>
                <Button
                  size="sm"
                  className="mt-1 bg-primary hover:bg-primary/90"
                  onClick={() => navigate(calendarPath)}
                >
                  Browse events
                </Button>
              </CardContent>
            </Card>
          )}

          {!showLoading && !isError && sorted.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {sorted.map((item) => {
                const targetPath =
                  (item.type ?? '').toLowerCase() === 'festival'
                    ? `/festival/${item.event_id}`
                    : `/event/${item.event_id}`;
                return (
                  <button
                    key={item.event_id}
                    type="button"
                    onClick={() => navigate(targetPath)}
                    className="text-left rounded-xl border border-slate-700 bg-slate-900/65 p-3 hover:border-cyan-300/45 hover:bg-slate-900/85 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground line-clamp-2 leading-tight">
                        {item.name}
                      </p>
                      <Badge className={`text-[10px] border shrink-0 ${statusBadgeClass(item.status)}`}>
                        {renderStatusLabel(item.status)}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {formatDate(item.date)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {item.city || 'City TBA'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </GlobalLayout>
  );
};

export default MyAttendance;
