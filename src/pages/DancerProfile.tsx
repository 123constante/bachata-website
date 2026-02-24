import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { DancerProfileGrid } from "@/components/profile/DancerProfileGrid";
import {
  mapDancerPublicProfile,
  type DancerPublicRecord,
} from "@/modules/profile/dancerPublicProfile";
import { useQuery } from "@tanstack/react-query";

type AttendanceRow = {
  event_id: string;
  status: "going" | "interested";
  updated_at: string | null;
};

type AttendanceEvent = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  date: string | null;
  start_time: string | null;
  type: "festival" | "standard";
};

type AttendanceItem = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  date: string | null;
  start_time: string | null;
  type: "festival" | "standard";
  status: "going" | "interested";
};

const DancerProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [dancer, setDancer] = useState<DancerPublicRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDancer = async () => {
      if (!id) return;

      try {
        const { data, error } = await supabase
          .from("dancers")
          .select("id, user_id, first_name, surname, city, nationality, years_dancing, dancing_start_date, favorite_styles, partner_role, looking_for_partner, instagram, facebook, photo_url, hide_surname, website, achievements, favorite_songs, partner_search_role, partner_search_level, partner_practice_goals, partner_details, is_public, verified")
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          setError("Dancer not found.");
          return;
        }
        setDancer(data as DancerPublicRecord);
      } catch (err: any) {
        setError(err.message || "Failed to load dancer profile");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDancer();
  }, [id]);

  const dancerView = dancer ? mapDancerPublicProfile(dancer) : null;
  const dancerUserId = dancer?.user_id ?? null;

  const { data: attendanceRows = [] } = useQuery({
    queryKey: ["dancer-public-attendance", dancerUserId],
    queryFn: async () => {
      if (!dancerUserId) return [] as AttendanceRow[];
      const { data, error } = await supabase
        .from("event_participants")
        .select("event_id, status, updated_at")
        .eq("user_id", dancerUserId)
        .in("status", ["going", "interested"]);
      if (error) throw error;
      return (data || []) as AttendanceRow[];
    },
    enabled: Boolean(dancerUserId),
    staleTime: 1000 * 20,
  });

  const { data: attendanceEvents = [] } = useQuery({
    queryKey: ["dancer-public-attendance-events", attendanceRows.map((row) => row.event_id).join("|")],
    queryFn: async () => {
      if (!attendanceRows.length) return [] as AttendanceEvent[];
      const eventIds = attendanceRows.map((row) => row.event_id);
      const { data, error } = await supabase
        .from("events")
        .select("id, name, city, country, date, start_time, type")
        .in("id", eventIds);
      if (error) throw error;
      return (data || []) as AttendanceEvent[];
    },
    enabled: attendanceRows.length > 0,
    staleTime: 1000 * 20,
  });

  const attendanceItems = useMemo(() => {
    if (!attendanceRows.length || !attendanceEvents.length) return [] as AttendanceItem[];
    const eventMap = new Map(attendanceEvents.map((event) => [event.id, event]));
    return attendanceRows
      .map((row) => {
        const event = eventMap.get(row.event_id);
        if (!event) return null;
        return {
          id: event.id,
          name: event.name,
          city: event.city,
          country: event.country,
          date: event.date,
          start_time: event.start_time,
          type: event.type,
          status: row.status,
        } satisfies AttendanceItem;
      })
      .filter(Boolean) as AttendanceItem[];
  }, [attendanceEvents, attendanceRows]);

  const now = new Date();
  const toEventDate = (item: AttendanceItem) => {
    const raw = item.date || item.start_time;
    return raw ? new Date(raw) : null;
  };
  const isUpcoming = (item: AttendanceItem) => {
    const date = toEventDate(item);
    return date ? date >= now : false;
  };

  const upcomingEvents = useMemo(
    () => attendanceItems.filter((item) => item.type === "standard" && isUpcoming(item)),
    [attendanceItems]
  );
  const upcomingFestivals = useMemo(
    () => attendanceItems.filter((item) => item.type === "festival" && isUpcoming(item)),
    [attendanceItems]
  );

  const getNextUpcoming = (items: AttendanceItem[]) => {
    const sorted = [...items].sort((a, b) => {
      const aDate = toEventDate(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bDate = toEventDate(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aDate - bDate;
    });
    return sorted[0] ?? null;
  };

  const nextEvent = getNextUpcoming(upcomingEvents);
  const nextFestival = getNextUpcoming(upcomingFestivals);

  const formatEventDate = (item: AttendanceItem | null) => {
    if (!item) return "Date TBA";
    const date = toEventDate(item);
    if (!date) return "Date TBA";
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  };

  const formatCountdown = (item: AttendanceItem) => {
    const date = toEventDate(item);
    if (!date) return "Date TBA";

    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfEvent = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (startOfEvent <= startOfToday) return "Happening now";

    let months = (startOfEvent.getFullYear() - startOfToday.getFullYear()) * 12
      + (startOfEvent.getMonth() - startOfToday.getMonth());
    let anchor = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), startOfToday.getDate());
    anchor.setMonth(anchor.getMonth() + months);

    if (anchor > startOfEvent) {
      months -= 1;
      anchor = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), startOfToday.getDate());
      anchor.setMonth(anchor.getMonth() + months);
    }

    const msPerDay = 24 * 60 * 60 * 1000;
    const days = Math.max(0, Math.floor((startOfEvent.getTime() - anchor.getTime()) / msPerDay));

    const monthLabel = months === 1 ? "month" : "months";
    const dayLabel = days === 1 ? "day" : "days";

    if (months <= 0) return `${days} ${dayLabel}`;
    if (days <= 0) return `${months} ${monthLabel}`;
    return `${months} ${monthLabel} ${days} ${dayLabel}`;
  };

  const openAttendanceItem = (item: AttendanceItem) => {
    navigate(item.type === "festival" ? `/festival/${item.id}` : `/event/${item.id}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pb-24 pt-32">
        <div className="container max-w-4xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 auto-rows-[minmax(160px,auto)]">
            <Skeleton className="col-span-2 row-span-2 h-full rounded-xl" />
            <Skeleton className="col-span-1 row-span-1 h-full rounded-xl" />
            <Skeleton className="col-span-1 row-span-1 h-full rounded-xl" />
            <Skeleton className="col-span-2 row-span-1 h-full rounded-xl" />
            <Skeleton className="col-span-1 row-span-1 h-full rounded-xl" />
            <Skeleton className="col-span-1 row-span-1 h-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !dancer || !dancerView) {
    return (
      <div className="min-h-screen pb-24 pt-32">
        <div className="container max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-6xl mb-4"
          >
            👾
          </motion.div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {error || "Dancer not found"}
          </h1>
          <p className="text-muted-foreground mb-6">
            The profile you're looking for doesn't exist or has been removed.
          </p>
          <Button onClick={() => navigate("/dancers")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dancers
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 pt-20">
      <PageBreadcrumb items={[
        { label: 'Dancers', path: '/dancers' },
        { label: dancerView.displayName }
      ]} />
      
      <div className="container max-w-5xl mx-auto px-4 pt-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/dancers")}
          className="mb-6 hover:bg-primary/10 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dancers
        </Button>

        <DancerProfileGrid dancer={dancerView} />

        <div className="mt-10">
          <h2 className="text-2xl font-bold text-foreground mb-4">Plans</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-5 bg-gradient-to-br from-card via-card to-primary/10 border-primary/20">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold text-foreground">Events</h3>
                </div>
                <span className="text-xs text-muted-foreground">{upcomingEvents.length} saved</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Next: {nextEvent ? `${nextEvent.name} • ${formatEventDate(nextEvent)}` : "No upcoming events"}
              </p>
              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-muted-foreground">
                  Going: {upcomingEvents.filter((item) => item.status === "going").length} · Interested: {upcomingEvents.filter((item) => item.status === "interested").length}
                </span>
              </div>
              <div className="mt-4 space-y-2 max-h-56 overflow-y-auto pr-1">
                {upcomingEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No upcoming events yet.</p>
                ) : (
                  upcomingEvents.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openAttendanceItem(item)}
                      className="w-full text-left rounded-lg border border-border/60 px-3 py-2 hover:border-primary/50 transition"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.country || "Country TBA"}</p>
                        <p className="text-xs text-muted-foreground">{formatCountdown(item)}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </Card>

            <Card className="p-5 bg-gradient-to-br from-card via-card to-festival-pink/20 border-festival-pink/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-festival-pink" />
                  <h3 className="text-lg font-semibold text-foreground">Festivals</h3>
                </div>
                <span className="text-xs text-muted-foreground">{upcomingFestivals.length} saved</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Next: {nextFestival ? `${nextFestival.name} • ${formatEventDate(nextFestival)}` : "No upcoming festivals"}
              </p>
              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-muted-foreground">
                  Going: {upcomingFestivals.filter((item) => item.status === "going").length} · Interested: {upcomingFestivals.filter((item) => item.status === "interested").length}
                </span>
              </div>
              <div className="mt-4 space-y-2 max-h-56 overflow-y-auto pr-1">
                {upcomingFestivals.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No upcoming festivals yet.</p>
                ) : (
                  upcomingFestivals.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openAttendanceItem(item)}
                      className="w-full text-left rounded-lg border border-border/60 px-3 py-2 hover:border-festival-pink/60 transition"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.country || "Country TBA"}</p>
                        <p className="text-xs text-muted-foreground">{formatCountdown(item)}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DancerProfile;


