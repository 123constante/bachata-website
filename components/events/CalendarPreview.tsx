import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { Calendar, RefreshCw, AlertCircle } from "lucide-react";

const DEFAULT_COVER =
  "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800";

type TabKey = "all" | "classes" | "parties";

type CalendarEvent = {
  event_id: string;
  name: string;
  photo_url?: string[] | string | null;
  location?: string | null;
  instance_date: string;
  start_time?: string | null;
  end_time?: string | null;
  meta_data?: any;
  key_times?: any;
  has_class?: boolean | null;
  has_party?: boolean | null;
  class_start?: string | null;
  class_end?: string | null;
  party_start?: string | null;
  party_end?: string | null;
  type?: string | null;
  city_slug?: string | null;
};

type GroupedEvents = Record<string, CalendarEvent[]>;

const normalizeKeyTimes = (input: any) => {
  if (!input) return {};
  if (typeof input === "string") {
    try {
      return JSON.parse(input);
    } catch {
      return {};
    }
  }
  return input;
};

const parsePhoto = (value?: string[] | string | null) => {
  if (!value) return null;
  if (Array.isArray(value)) {
    return value[0] || null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed[0];
        }
      } catch {
        return value;
      }
    }
    return value;
  }
  return null;
};

const toTime = (value?: string | null) => {
  if (!value) return "TBA";
  const parts = value.includes("T") ? value.split("T") : value.split(" ");
  const time = parts[1] || parts[0] || "";
  return time.substring(0, 5) || "TBA";
};

const dayKeyFromInstance = (instanceDate: string) => {
  if (!instanceDate) return "";
  if (instanceDate.includes("T")) {
    return instanceDate.split("T")[0];
  }
  if (instanceDate.includes(" ")) {
    return instanceDate.split(" ")[0];
  }
  return instanceDate;
};

const formatDayLabel = (dayKey: string) => {
  const parsed = new Date(`${dayKey}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return dayKey;
  }
  return parsed.toLocaleDateString("en-GB", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
};

export const CalendarPreview: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cityFilter, setCityFilter] = useState("london");

  const range = useMemo(() => {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 90);
    return { start, end };
  }, []);

  const fetchCalendar = async () => {
    setLoading(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc(
      "get_calendar_events",
      {
        range_start: range.start.toISOString(),
        range_end: range.end.toISOString(),
        city_slug_param: cityFilter || null,
      }
    );

    if (rpcError) {
      console.error("RPC Error:", rpcError);
      setError(rpcError.message);
      setEvents([]);
      setLoading(false);
      return;
    }

    console.log("Calendar RPC Data:", data); // Check console to see if events arrive
    
    const sorted = (data as CalendarEvent[])
      .slice()
      .sort(
        (a, b) =>
          new Date(a.instance_date).getTime() -
          new Date(b.instance_date).getTime()
      );

    setEvents(sorted);
    setLoading(false);
  };

  useEffect(() => {
    fetchCalendar();
  }, [cityFilter, range]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const keyTimes = normalizeKeyTimes(
        event.key_times || event.meta_data?.key_times || {}
      );
      const hasParty =
        event.has_party ?? (keyTimes.party?.active === true ? true : false);
      const hasClass =
        event.has_class ?? (keyTimes.classes?.active === true ? true : false);

      if (activeTab === "parties") return hasParty;
      if (activeTab === "classes") return hasClass;
      return true;
    });
  }, [activeTab, events]);

  const groupedEvents = useMemo(() => {
    return filteredEvents.reduce((acc, event) => {
      const dayKey = dayKeyFromInstance(event.instance_date);
      if (!acc[dayKey]) {
        acc[dayKey] = [];
      }
      acc[dayKey].push(event);
      return acc;
    }, {} as GroupedEvents);
  }, [filteredEvents]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-primary/10 bg-card/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-base font-semibold">
          <Calendar className="h-5 w-5 text-primary" />
          Calendar Preview
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "classes", "parties"] as TabKey[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                activeTab === tab
                  ? "border-primary bg-primary/20 text-primary"
                  : "border-border/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
          <div className="flex items-center gap-2">
            <input
              value={cityFilter}
              onChange={(event) => setCityFilter(event.target.value)}
              className="h-9 w-28 rounded-full border border-border/60 bg-background px-3 text-xs text-foreground"
              placeholder="City"
            />
            <button
              type="button"
              onClick={fetchCalendar}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-primary/30 px-3 text-xs font-semibold text-primary transition hover:bg-primary/10"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-primary/10 bg-surface/40 p-8 text-center text-muted-foreground">
          Loading events...
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedEvents).map(([dayKey, dayEvents]) => (
            <div key={dayKey} className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {formatDayLabel(dayKey)}
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {dayEvents.map((event) => {
                  const photo = parsePhoto(event.photo_url) || DEFAULT_COVER;
                  const classTime = `${toTime(event.class_start)}-${toTime(
                    event.class_end
                  )}`;
                  const partyTime = `${toTime(event.party_start)}-${toTime(
                    event.party_end
                  )}`;
                  const fallbackTime = `${toTime(event.start_time)}-${toTime(
                    event.end_time
                  )}`;

                  return (
                    <div
                      key={`${event.event_id}-${event.instance_date}`}
                      className="overflow-hidden rounded-2xl border border-primary/10 bg-card/60"
                    >
                      <div className="h-36 w-full overflow-hidden">
                        <img
                          src={photo}
                          alt={event.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div className="space-y-2 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-base font-semibold leading-tight">
                            {event.name}
                          </h4>
                          {event.city_slug && (
                            <span className="rounded-full border border-primary/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-primary">
                              {event.city_slug}
                            </span>
                          )}
                        </div>
                        {event.location && (
                          <p className="text-xs text-muted-foreground">
                            {event.location}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                          {activeTab !== "parties" && (
                            <span className="rounded-full bg-festival-blue/20 px-2 py-1 text-festival-blue">
                              Class {event.class_start || event.class_end ? classTime : fallbackTime}
                            </span>
                          )}
                          {activeTab !== "classes" && (
                            <span className="rounded-full bg-festival-pink/20 px-2 py-1 text-festival-pink">
                              Party {event.party_start || event.party_end ? partyTime : fallbackTime}
                            </span>
                          )}
                          {activeTab === "classes" && !event.class_start && !event.class_end && (
                            <span className="rounded-full bg-festival-blue/20 px-2 py-1 text-festival-blue">
                              Time {fallbackTime}
                            </span>
                          )}
                          {activeTab === "parties" && !event.party_start && !event.party_end && (
                            <span className="rounded-full bg-festival-pink/20 px-2 py-1 text-festival-pink">
                              Time {fallbackTime}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {!loading && Object.keys(groupedEvents).length === 0 && (
            <div className="rounded-2xl border border-primary/10 bg-surface/40 p-10 text-center text-muted-foreground">
              No events found in the selected range.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
