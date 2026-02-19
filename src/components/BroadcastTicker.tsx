import { useEffect, useState } from "react";

const headlines = [
  "LIVE: 378 dancers heading out tonight across the city",
  "Thursday Bachata at Salsa Street looking PACKED — 34 confirmed",
  "DJ Korke dropping a surprise set at Bar Salsa Temple",
  "Kizomba Connection at Flow Dance — only 12 spots left",
  "New workshop announced: Sensual Bachata Fundamentals this Saturday",
  "Latin Collective reports record turnout this week",
];

interface BroadcastTickerProps {
  eventCount?: number;
}

const BroadcastTicker = ({ eventCount = 3 }: BroadcastTickerProps) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const tickerText = headlines.join("   ///   ");

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 h-11 flex items-stretch border-t border-red-600/60 bg-neutral-950/95 backdrop-blur-sm select-none">
      {/* BREAKING badge */}
      <div className="flex-shrink-0 flex items-center bg-red-600 px-4">
        <span className="text-xs font-black uppercase tracking-widest text-white">
          Breaking
        </span>
      </div>

      {/* Scrolling ticker */}
      <div className="flex-1 overflow-hidden relative">
        {/* fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-neutral-950 to-transparent z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-neutral-950 to-transparent z-10" />

        <div className="flex items-center h-full animate-ticker-scroll whitespace-nowrap">
          <span className="text-sm text-white/90 font-medium pr-[50vw]">
            {tickerText}
          </span>
          <span className="text-sm text-white/90 font-medium pr-[50vw]">
            {tickerText}
          </span>
        </div>
      </div>

      {/* LIVE section + clock */}
      <div className="flex-shrink-0 flex items-center gap-4 px-4 bg-neutral-900/80 border-l border-white/10">
        {/* Live dot */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-green-400">
            Live
          </span>
          <span className="text-xs text-white/50 hidden sm:inline">
            {eventCount} events
          </span>
        </div>

        {/* Clock */}
        <span className="font-mono text-xs tabular-nums text-white/70">
          {time.toLocaleTimeString("en-GB")}
        </span>
      </div>
    </div>
  );
};

export default BroadcastTicker;
