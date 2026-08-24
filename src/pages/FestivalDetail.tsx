import { useState, useEffect, useMemo, useRef, type CSSProperties } from "react";

import { createPortal } from "react-dom";

import { PageErrorBoundary } from "@/components/ErrorBoundary";

import { Skeleton } from "@/components/ui/skeleton";

import { useParams, useNavigate, useLocation, Link } from "react-router-dom";

import { Button } from "@/components/ui/button";


import { useSeo, buildSeoForRoute, useEntitySlugOrId, SITE_ORIGIN } from "@/lib/seo";

import { VideoEmbed } from "@/components/VideoEmbed";

import { pickPlayableVideo } from "@/lib/parseVenueVideoUrl";

import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

import { useRecordEventView } from "@/modules/event-page/useRecordEventView";

import { EventStickyActionBar } from "@/modules/event-page/bento/EventStickyActionBar";

import { useFestivalDetailQuery } from "@/modules/event-page/useFestivalDetailQuery";
import { festivalGridDays } from "@/modules/event-page/utils/festivalGridDays";

import { festivalEventQueryKey, fetchFestivalEventRow } from "@/modules/event-page/festivalEventQuery";

import { EventCancelledBanner } from "@/modules/event-page/bento/EventCancelledBanner";

import { resolveFestivalDefaultDay } from "@/modules/event-page/utils/festivalDefaultDay";
import {
  computeHeroDayStatus,
  type CancellationState,
} from "@/modules/event-page/utils/festivalHeroDayStatus";

import {
  dateKeyInTz,
  formatKeyRange,
} from "@/lib/londonDate";

import { useTodayKey } from "@/hooks/useTodayKey";

import {
  asWallClock,
  formatWallClockLocalIntl,
  formatWallClockTime,
  instantToDate,
  wallClockDateKey,
  wallClockHour,
  wallClockToInstant,
  type WallClock,
} from "@/lib/time/wallClock";

import { resolveTransportMode } from "@/lib/transportMode";

import { FestivalStoriesCover } from "@/components/festival/FestivalStoriesCover";

import { FestivalRaffleSection } from "@/modules/event-page/sections/FestivalRaffleSection";
import { FestivalPromoBanner } from "@/modules/event-page/sections/FestivalPromoBanner";

import { FestivalGroupChatSection } from "@/modules/event-page/sections/FestivalGroupChatSection";

import type { EventPageSnapshot } from "@/modules/event-page/types";

import { buildEventJsonLd } from "@/lib/buildEventJsonLd";
import { optimizedImageUrl, cssUrl } from '@/lib/imageCdn';



type FestivalEvent = {

  id: string;

  name: string;

  city: string | null;

  // Boundary brand rides the existing `as FestivalEvent` cast on the raw events
  // row: `date` is a date-only wall clock (DATE column).
  //
  // `start_time` is deliberately ABSENT. The column is timestamptz, but it holds
  // a MIX of true instants and naive local-as-UTC wall clocks row-by-row (live
  // check: 'London Latin Fest' stores 11:00Z where the tz-corrected _v2 RPC
  // reports 10:00Z) -- the very unbrandable mix that forced the move off _v1.
  // Branding it either way is a lie that reads 1h late through BST, so no
  // surface may consume it. The real-instant nucleus below comes from _v2's
  // dates.startsAt, with events.date as the date-only fallback. Do not re-add.
  date: WallClock | null;

  poster_url: string | null;

  description: string | null;

  ticket_url: string | null;

};



type FestivalDetailInnerProps = {

  snapshot?: EventPageSnapshot | null;

  /**
   * The date key ('YYYY-MM-DD') on the FESTIVAL's own calendar that the server
   * rendered this document on. Supplied by the /festival/:id route loader.
   *
   * Load-bearing for two separate reasons:
   *  1. It pins the first render (server + hydration) to one key, so the
   *     days-away label can ship in the server HTML without a #418 mismatch.
   *  2. Without it the label can only appear post-mount, so crawlers and
   *     no-JS readers never see the festival's timing cue at all.
   *
   * Absent on the /event/<slug> mount (EventPage renders this component lazily
   * inside a Suspense boundary and passes no key), and the days-away label
   * stays mount-gated there -- see its render site.
   */
  serverTodayKey?: string;

};



// ---------------------------------------------------------------------------

// Cinematic CSS -- scoped under .cinematic-festival

// Ported from the validated mockup at c:\tmp\festival-mockups\05-cinematic-timeline.html

// NOTHING INSIDE THE LITERAL BELOW IS FREE. It is a template literal, so its
// contents are never minified: every byte ships twice, once in the JS chunk
// and once inlined into each SSR document. Maintainer prose belongs HERE, in
// a // comment, not in a /* */ inside the stylesheet. (A backtick in there
// would also end the literal outright -- esbuild catches that, safe-edit's
// parse-check does not.)
//
// THE SINGLE-DAY VIEW WORKS BY HIDING, and the open column is stamped on the
// SLOT rather than counted from the ancestor. data-open is written by the same
// days.map that renders the cell, so both of the rules under the "single-day
// view" marker are independent of how many columns the schedule has.
//
// They used to be an ENUMERATION -- .tl-body[data-day="0"].."3", one
// hand-written pair per index, each naming a child position with nth-child.
// That fails OPEN: an index with no matching rule hides NOTHING, so the reader
// gets every column crushed into a 375px viewport with every empty hour row
// showing, which looks like a broken page rather than a missing stylesheet
// rule. It was live, not theoretical -- event_program_days says Tunisia
// Bachata Festival 2026 runs 2026-09-24..28, five columns, and the default-day
// effect SELECTS that fifth column on the day itself. festivalGridDays can
// produce far more: a 62-day span (wallClockDateRange's maxDays), plus one
// column per out-of-span session, plus the UNDATED bucket.
//
// Do NOT reintroduce a count here in any form. A generated list bounded by a
// constant is the same defect with a larger number, and it drags a ceiling, a
// forced fallback and a disabled toggle along with it to stay honest. Nothing
// needs to know the column count for this view to be correct.
//
// ---------------------------------------------------------------------------

const CINEMATIC_CSS = `

.cinematic-festival{font-family:'Inter',sans-serif;background:#000;color:#f5f5f5;-webkit-font-smoothing:antialiased;overflow-x:hidden}

.cinematic-festival *{box-sizing:border-box}



/* HERO */

.cinematic-festival .hero{min-height:auto;display:flex;flex-direction:column;justify-content:flex-start;align-items:center;text-align:center;padding:0 24px 40px;position:relative;overflow:hidden;background:radial-gradient(circle at 20% 50%,rgba(236,72,153,0.15) 0%,transparent 35%),radial-gradient(circle at 80% 30%,rgba(251,146,60,0.18) 0%,transparent 40%),radial-gradient(circle at 50% 80%,rgba(168,85,247,0.12) 0%,transparent 35%),#000}

.cinematic-festival .hero::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,0.015) 0px,rgba(255,255,255,0.015) 1px,transparent 1px,transparent 4px);pointer-events:none;mix-blend-mode:overlay}

.cinematic-festival .hero::after{content:'';position:absolute;inset:0;background:radial-gradient(circle,transparent 80%,rgba(0,0,0,0.6) 100%);pointer-events:none}

/* Floating polaroid -- cover image */


.lf-lightbox{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.93);display:flex;align-items:center;justify-content:center;padding:24px;font-family:'Inter',sans-serif}
.lf-lb-img{max-width:92vw;max-height:80vh;object-fit:contain;border-radius:4px;box-shadow:0 24px 64px rgba(0,0,0,0.6)}
.lf-lb-close{position:absolute;top:16px;right:20px;width:44px;height:44px;border:1px solid rgba(255,255,255,0.3);background:rgba(0,0,0,0.45);color:#fff;font-size:26px;line-height:1;cursor:pointer;border-radius:50%}
.lf-lb-nav{position:absolute;top:50%;transform:translateY(-50%);width:48px;height:48px;border:1px solid rgba(255,255,255,0.3);background:rgba(0,0,0,0.45);color:#fff;font-size:30px;line-height:1;cursor:pointer;border-radius:50%}
.lf-lb-prev{left:20px}
.lf-lb-next{right:20px}
.lf-lb-close:hover,.lf-lb-nav:hover{background:rgba(251,146,60,0.9);border-color:#fb923c}
.lf-lb-thumbs{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);display:flex;gap:8px;padding:8px;background:rgba(0,0,0,0.45);border-radius:8px;max-width:92vw;overflow-x:auto}
.lf-lb-thumb{width:54px;height:54px;border:2px solid transparent;background:none;padding:0;cursor:pointer;border-radius:4px;overflow:hidden;flex:0 0 auto}
.lf-lb-thumb img{width:100%;height:100%;object-fit:cover;display:block;opacity:0.5;transition:opacity .2s}
.lf-lb-thumb.active{border-color:#fb923c}
.lf-lb-thumb.active img,.lf-lb-thumb:hover img{opacity:1}
@media (max-width:760px){.lf-lb-nav{width:40px;height:40px;font-size:24px}.lf-lb-thumb{width:44px;height:44px}}









@media (max-width:760px){

  .cinematic-festival .hero{min-height:auto;justify-content:flex-start;padding-top:0}

  

  

  

  .cinematic-festival .hero-pre{font-size:11px;letter-spacing:4px;white-space:nowrap}

  .cinematic-festival .hero-pre::before,.cinematic-festival .hero-pre::after{width:20px;margin:0 8px}

}



.cinematic-festival .hero-pre{font-family:'Bebas Neue',sans-serif;font-size:13px;letter-spacing:8px;color:#fb923c;margin-bottom:16px;position:relative;z-index:1}

.cinematic-festival .hero-pre::before,.cinematic-festival .hero-pre::after{content:'';display:inline-block;width:40px;height:1px;background:#fb923c;vertical-align:middle;margin:0 16px}

.cinematic-festival .hero h1{font-family:'Bebas Neue',sans-serif;font-size:clamp(48px,12vw,160px);line-height:0.9;letter-spacing:-0.02em;color:#fff;position:relative;z-index:1;text-shadow:0 0 80px rgba(251,146,60,0.4),0 0 40px rgba(236,72,153,0.2);font-weight:400;margin:0}

.cinematic-festival .hero h1 .out{color:transparent;-webkit-text-stroke:2px #fb923c;font-style:italic}

.cinematic-festival .hero-tag{font-family:'Bebas Neue',sans-serif;font-size:clamp(18px,2.4vw,26px);letter-spacing:8px;color:rgba(255,255,255,0.8);margin-top:16px;position:relative;z-index:1}



/* Date line + days-away (P2 -- replaces the date tiles). Full-opacity white
   over the black hero ground -- the old 50%-alpha month label washed out over
   light poster regions. Wraps rather than clips if it ever exceeds the
   viewport (long month-boundary spans on narrow screens). */

.cinematic-festival .hero-dateline{font-family:'Bebas Neue',sans-serif;font-size:clamp(18px,2.4vw,26px);line-height:1.3;letter-spacing:3px;color:#fff;margin-top:20px;position:relative;z-index:1;text-transform:uppercase}

.cinematic-festival .hero-days-away{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:#fb923c;margin-top:10px;position:relative;z-index:1}



/* Hero CTA */

.cinematic-festival .hero-cta{margin-top:28px;display:flex;gap:10px;position:relative;z-index:5;flex-wrap:wrap;justify-content:center;align-items:flex-start;width:100%;max-width:100%}

.cinematic-festival .btn{padding:14px 36px;border:1px solid;font-family:'Bebas Neue',sans-serif;letter-spacing:3px;font-size:13px;text-decoration:none;text-transform:uppercase;transition:all .2s;cursor:pointer;display:inline-flex;align-items:center;gap:8px;white-space:nowrap}

.cinematic-festival .btn-primary{background:#fb923c;color:#000;border-color:#fb923c;box-shadow:0 0 30px rgba(251,146,60,0.5)}

.cinematic-festival .btn-primary:hover{background:#fff;border-color:#fff}

.cinematic-festival .btn-ghost{color:#fff;border-color:rgba(255,255,255,0.3);background:transparent}

.cinematic-festival .btn-ghost:hover{border-color:#fff;color:#fb923c}

.cinematic-festival .cal-wrap{position:relative}

.cinematic-festival .cal-wrap[open] .cal-summary{border-color:#fb923c;color:#fb923c;background:rgba(251,146,60,0.05)}

.cinematic-festival .cal-wrap[open] .cal-summary .chev{transform:rotate(180deg)}

.cinematic-festival .cal-summary{list-style:none;cursor:pointer}

.cinematic-festival .cal-summary::-webkit-details-marker{display:none}

.cinematic-festival .cal-summary::marker{content:''}

.cinematic-festival .cal-summary .chev{font-size:10px;transition:transform .15s ease;opacity:0.6}

.cinematic-festival .cal-menu{position:absolute;top:calc(100% + 8px);left:50%;transform:translateX(-50%);background:#0a0a0a;border:1px solid #fb923c;min-width:280px;max-width:calc(100vw - 32px);width:max-content;z-index:20;box-shadow:0 16px 48px rgba(0,0,0,0.6),0 0 30px rgba(251,146,60,0.15)}

.cinematic-festival .cal-menu::before{content:'';position:absolute;top:-7px;left:50%;transform:translateX(-50%) rotate(45deg);width:12px;height:12px;background:#0a0a0a;border-top:1px solid #fb923c;border-left:1px solid #fb923c}

.cinematic-festival .cal-menu a{display:flex;align-items:center;gap:14px;padding:14px 18px;color:#fff;text-decoration:none;font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:0.08em;border-bottom:1px solid rgba(255,255,255,0.05);transition:background .1s,color .1s}

.cinematic-festival .cal-menu a:last-child{border-bottom:none}

.cinematic-festival .cal-menu a:hover{background:rgba(251,146,60,0.1);color:#fb923c}

.cinematic-festival .cal-menu a:hover .cal-arr{transform:translateX(4px);color:#fb923c}

.cinematic-festival .cal-menu a .cal-ico{width:28px;height:28px;display:flex;align-items:center;justify-content:center;background:rgba(251,146,60,0.1);border:1px solid rgba(251,146,60,0.3);color:#fb923c;font-family:'Bebas Neue',sans-serif;font-size:13px;font-weight:700;flex-shrink:0}

.cinematic-festival .cal-menu a .cal-arr{margin-left:auto;color:rgba(255,255,255,0.4);transition:transform .15s ease}



/* ABOUT -- collapsible description */

.cinematic-festival .about{padding:40px 24px;background:#0a0a0a;border-top:1px solid rgba(251,146,60,0.15);border-bottom:1px solid rgba(251,146,60,0.15)}

.cinematic-festival .about-wrap{max-width:720px;margin:0 auto;text-align:center}

.cinematic-festival .about-label{font-family:'Bebas Neue',sans-serif;font-size:11px;letter-spacing:6px;color:#fb923c;margin-bottom:14px;text-transform:uppercase;position:relative;display:inline-block}

.cinematic-festival .about-label::before,.cinematic-festival .about-label::after{content:'';position:absolute;top:50%;width:24px;height:1px;background:rgba(251,146,60,0.4)}

.cinematic-festival .about-label::before{right:calc(100% + 10px)}

.cinematic-festival .about-label::after{left:calc(100% + 10px)}

.cinematic-festival .about-text{font-size:14px;line-height:1.65;color:rgba(255,255,255,0.72);text-align:left;white-space:pre-line}
.cinematic-festival .about-text.is-collapsed{-webkit-mask-image:linear-gradient(180deg,#000 0,#000 calc(100% - 2.4em),transparent 100%);mask-image:linear-gradient(180deg,#000 0,#000 calc(100% - 2.4em),transparent 100%)}

.cinematic-festival .about-text b,.cinematic-festival .about-text strong{color:#fff;font-weight:600}

.cinematic-festival .about-toggle{margin-top:16px;background:#fb923c;border:1px solid #fb923c;color:#1a0a10;padding:13px 34px;font-family:'Bebas Neue',sans-serif;letter-spacing:3px;font-size:13px;text-transform:uppercase;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:6px;box-shadow:0 0 28px rgba(251,146,60,0.45)}

.cinematic-festival .about-toggle:hover{background:#fff;border-color:#fff;color:#1a0a10;box-shadow:0 0 36px rgba(251,146,60,0.6)}



/* LINEUP filmstrip */

.cinematic-festival .lineup{padding:48px 24px;background:#000;text-align:center;position:relative}

.cinematic-festival .lineup .label{font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:6px;color:#fb923c;margin-bottom:6px;position:relative;display:inline-block}

.cinematic-festival .lineup .label::before,.cinematic-festival .lineup .label::after{content:'';position:absolute;top:50%;width:40px;height:1px;background:rgba(251,146,60,0.4)}

.cinematic-festival .lineup .label::before{right:calc(100% + 12px)}

.cinematic-festival .lineup .label::after{left:calc(100% + 12px)}

.cinematic-festival .lineup .sub{font-family:'JetBrains Mono',monospace;font-size:10px;color:rgba(255,255,255,0.4);letter-spacing:0.15em;text-transform:uppercase;margin-bottom:24px}

.cinematic-festival .filmstrip{position:relative;background:#0a0a0a;margin:0 -24px;border-top:1px solid rgba(251,146,60,0.25);border-bottom:1px solid rgba(251,146,60,0.25)}

.cinematic-festival .filmstrip::before,.cinematic-festival .filmstrip::after{content:'';position:absolute;left:0;right:0;height:18px;background:repeating-linear-gradient(90deg,#fb923c 0 16px,#0a0a0a 16px,#0a0a0a 28px);z-index:1}

.cinematic-festival .filmstrip::before{top:0}

.cinematic-festival .filmstrip::after{bottom:0}

.cinematic-festival .frames{display:flex;gap:0;padding:30px 12px;overflow-x:auto;scrollbar-width:thin;scrollbar-color:rgba(251,146,60,0.4) transparent;position:relative;z-index:2}

.cinematic-festival .frames > *{flex:1 0 220px;max-width:280px}

.cinematic-festival .frame{background:#000;border:1px solid rgba(251,146,60,0.2);text-decoration:none;color:inherit;transition:all .25s ease;cursor:pointer;position:relative;margin:0 6px;display:block}

.cinematic-festival .frame::after{content:'';position:absolute;top:0;bottom:0;left:-7px;width:1px;background:rgba(251,146,60,0.2)}

.cinematic-festival .frames > *:first-child .frame::after{display:none}

.cinematic-festival .frame:hover{border-color:#fb923c;transform:translateY(-3px);box-shadow:0 16px 48px rgba(251,146,60,0.2)}

.cinematic-festival .frame:hover .frame-img{filter:grayscale(0%) contrast(1) brightness(1)}

.cinematic-festival .frame:hover .frame-name{color:#fb923c}

.cinematic-festival .frame-num{position:absolute;top:8px;left:8px;font-family:'JetBrains Mono',monospace;font-size:9px;color:#fb923c;background:rgba(0,0,0,0.75);border:1px solid rgba(251,146,60,0.4);padding:2px 6px;z-index:3;letter-spacing:0.1em;font-weight:700}

.cinematic-festival .frame-corner{position:absolute;top:8px;right:8px;font-family:'JetBrains Mono',monospace;font-size:9px;color:rgba(255,255,255,0.4);z-index:3;letter-spacing:0.1em}

.cinematic-festival .frame-img{height:260px;background-size:cover;background-position:center top;filter:grayscale(85%) contrast(1.2) brightness(0.85);transition:filter .35s ease;position:relative;background-color:#1a1a1a}

.cinematic-festival .frame-img::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 50%,rgba(0,0,0,0.7));pointer-events:none}

.cinematic-festival .frame-img::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(251,146,60,0.1),transparent 60%);mix-blend-mode:overlay;pointer-events:none}

.cinematic-festival .frame-img.no-photo{display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,rgba(251,146,60,0.2),rgba(0,0,0,0.5))}

.cinematic-festival .frame-img.no-photo .initial{font-family:'Bebas Neue',sans-serif;font-size:96px;color:#fb923c;line-height:1;letter-spacing:-0.02em;z-index:2;text-shadow:0 0 30px rgba(251,146,60,0.6)}

.cinematic-festival .frame-info{padding:12px 14px;text-align:center;border-top:1px solid rgba(251,146,60,0.15);background:#0a0a0a}

.cinematic-festival .frame-name{font-family:'Bebas Neue',sans-serif;font-size:22px;color:#fff;line-height:1;letter-spacing:-0.01em;transition:color .2s}

.cinematic-festival .frame-style{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:0.2em;color:#fb923c;text-transform:uppercase;margin-top:6px}

.cinematic-festival .frame-tag{display:inline-block;font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:0.2em;color:rgba(255,255,255,0.4);text-transform:uppercase;margin-top:4px;padding:1px 6px;border:1px solid rgba(255,255,255,0.1)}



/* PROGRAMME -- timeline grid */

.cinematic-festival .program{padding:48px 24px;background:linear-gradient(180deg,#000,#0a0a0a);position:relative}

.cinematic-festival .program::before{content:'';position:absolute;top:0;left:0;right:0;height:24px;background:repeating-linear-gradient(90deg,#000 0 40px,rgba(251,146,60,0.6) 40px 44px,#000 44px 84px)}

.cinematic-festival .program-wrap{max-width:1400px;margin:20px auto 0;position:relative}

.cinematic-festival .section-h{text-align:center;margin-bottom:28px}

.cinematic-festival .section-h .lab{font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:6px;color:#fb923c;margin-bottom:6px}

.cinematic-festival .section-h h2{font-family:'Bebas Neue',sans-serif;font-size:clamp(34px,5vw,64px);line-height:1;letter-spacing:-0.01em;font-weight:400;color:#fff;margin:0}

.cinematic-festival .section-h .sub{font-size:12px;color:rgba(255,255,255,0.5);letter-spacing:0.15em;text-transform:uppercase;margin-top:6px;font-family:'JetBrains Mono',monospace}

/* TV-Guide table grid -- flat cells with borders, type pills as chips */

.cinematic-festival .tl-grid-wrap{border:1px solid rgba(251,146,60,0.3);background:#0a0a0a;overflow:hidden}

.cinematic-festival .tl-header{display:grid;gap:0;border-bottom:1px solid rgba(251,146,60,0.4);position:sticky;top:0;background:#0a0a0a;z-index:10}

.cinematic-festival .tl-time-h{font-family:'JetBrains Mono',monospace;font-size:10px;color:rgba(255,255,255,0.4);letter-spacing:0.2em;text-transform:uppercase;padding:14px 12px;border-right:1px solid rgba(251,146,60,0.3);background:rgba(255,255,255,0.02)}

.cinematic-festival .tl-day{padding:14px 12px;border-right:1px solid rgba(251,146,60,0.15);font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#fb923c}

.cinematic-festival .tl-day:last-child{border-right:none}

.cinematic-festival .tl-day .name{display:inline}

.cinematic-festival .tl-day .date{font-family:'Bebas Neue',sans-serif;font-size:22px;color:#fff;display:block;margin-top:4px;letter-spacing:-0.01em;line-height:1}

.cinematic-festival .tl-day .date .lbl{color:rgba(255,255,255,0.5);font-size:0.55em;margin-left:6px;letter-spacing:0.15em}

.cinematic-festival .tl-day.today{background:rgba(251,146,60,0.10);box-shadow:inset 0 2px 0 #fb923c}

.cinematic-festival .tl-day-today{display:block;margin-top:5px;font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:0.18em;color:#000;background:#fb923c;border-radius:99px;padding:1px 7px;width:fit-content;margin-left:auto;margin-right:auto}

.cinematic-festival .tl-body{position:relative}

.cinematic-festival .tl-row{display:grid;gap:0;align-items:stretch;position:relative}

.cinematic-festival .tl-time{font-family:'JetBrains Mono',monospace;font-size:11px;color:rgba(255,255,255,0.5);padding:12px;display:flex;align-items:flex-start;letter-spacing:0.05em;background:rgba(255,255,255,0.02);border-right:1px solid rgba(251,146,60,0.15);border-bottom:1px solid rgba(255,255,255,0.04)}

.cinematic-festival .slot{padding:10px 12px;display:flex;flex-direction:column;justify-content:flex-start;gap:8px;border-right:1px solid rgba(255,255,255,0.05);border-bottom:1px solid rgba(255,255,255,0.04);min-height:64px}

.cinematic-festival .slot:last-child{border-right:none}

.cinematic-festival .tl-row:last-child > *{border-bottom:none}

.cinematic-festival .session{cursor:pointer;transition:background .15s ease;padding:2px 0;margin:0;background:transparent;border:none}

.cinematic-festival .slot:has(> .session):hover{background:rgba(251,146,60,0.05)}

.cinematic-festival .s-pill{display:inline-block;font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:0.15em;text-transform:uppercase;padding:2px 7px;background:rgba(251,146,60,0.15);color:#fb923c;border:1px solid rgba(251,146,60,0.4);font-weight:700;margin-bottom:6px}

.cinematic-festival .session.party .s-pill{background:rgba(236,72,153,0.15);color:#ec4899;border-color:rgba(236,72,153,0.4)}

.cinematic-festival .session.master .s-pill{background:rgba(168,85,247,0.15);color:#a855f7;border-color:rgba(168,85,247,0.4)}

.cinematic-festival .s-title{font-size:13px;font-weight:600;color:#fff;line-height:1.3;letter-spacing:-0.005em}

.cinematic-festival .s-meta{font-family:'JetBrains Mono',monospace;font-size:10px;color:rgba(255,255,255,0.5);margin-top:4px;letter-spacing:0.02em;display:flex;gap:8px;flex-wrap:wrap;align-items:center}

.cinematic-festival .s-meta .tag{padding:1px 5px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);font-size:9px;letter-spacing:0.05em}

.cinematic-festival .s-duration{font-family:'JetBrains Mono',monospace;font-size:9px;color:rgba(255,255,255,0.35);margin-top:3px;letter-spacing:0.02em}

.cinematic-festival .legend{display:flex;justify-content:center;gap:20px;margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.06);flex-wrap:wrap}

.cinematic-festival .legend-item{display:flex;align-items:center;gap:8px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;font-family:'JetBrains Mono',monospace;color:rgba(255,255,255,0.5)}

.cinematic-festival .legend-item .swatch{width:14px;height:14px;border-left:3px solid;background:rgba(255,255,255,0.04)}

.cinematic-festival .legend-item.class .swatch{border-color:#fb923c}

.cinematic-festival .legend-item.party .swatch{border-color:#ec4899}

.cinematic-festival .legend-item.master .swatch{border-color:#a855f7}



/* VENUE + ORGANISER paired row */

.cinematic-festival .vo{padding:40px 24px;background:#000;position:relative}

.cinematic-festival .vo-wrap{max-width:1100px;margin:0 auto;position:relative}

.cinematic-festival .vo-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:stretch}

.cinematic-festival .vo-col{display:flex;flex-direction:column}

.cinematic-festival .vo-col .section-h{margin-bottom:12px;text-align:left}

.cinematic-festival .vo-col .section-h .lab{font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:4px;color:#fb923c}

.cinematic-festival .v-card,.cinematic-festival .o-card{display:grid;grid-template-columns:auto 1fr 96px;align-items:stretch;background:#0a0a0a;border:2px solid #fb923c;text-decoration:none;color:inherit;transition:all .2s ease;position:relative;overflow:hidden;cursor:pointer;box-shadow:0 8px 32px rgba(251,146,60,0.1),0 2px 0 #c2410c;animation:vpulse 3s ease-in-out infinite;flex:1}

@keyframes vpulse{0%,100%{box-shadow:0 8px 32px rgba(251,146,60,0.1),0 2px 0 #c2410c}50%{box-shadow:0 8px 48px rgba(251,146,60,0.3),0 2px 0 #c2410c}}

.cinematic-festival .v-card:hover,.cinematic-festival .o-card:hover{background:#0f0a05;transform:translateY(-4px);box-shadow:0 20px 60px rgba(251,146,60,0.4),0 4px 0 #c2410c;animation:none}

.cinematic-festival .v-card:active,.cinematic-festival .o-card:active{transform:translateY(-1px);box-shadow:0 4px 16px rgba(251,146,60,0.3),0 1px 0 #c2410c}

.cinematic-festival .v-card:hover .v-img{transform:scale(1.06)}

.cinematic-festival .v-card:hover .v-cta,.cinematic-festival .o-card:hover .v-cta{background:#fff}

.cinematic-festival .v-card:hover .v-cta .arr,.cinematic-festival .o-card:hover .v-cta .arr{transform:translateX(6px)}

.cinematic-festival .o-card:hover .o-avatar{border-color:#fb923c;transform:scale(1.04)}

.cinematic-festival .v-photo{position:relative;overflow:hidden;height:150px;width:140px}

.cinematic-festival .v-img{position:absolute;inset:0;background-size:cover;background-position:center;transition:transform .4s ease}

.cinematic-festival .v-img.no-photo{background:linear-gradient(135deg,rgba(251,146,60,0.3),rgba(168,85,247,0.2))}

.cinematic-festival .v-photo::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent 50%,rgba(10,10,10,0.4));z-index:1}

.cinematic-festival .v-tag{position:absolute;top:12px;left:12px;z-index:2;font-family:'Bebas Neue',sans-serif;font-size:10px;letter-spacing:0.2em;background:rgba(0,0,0,0.75);color:#fb923c;padding:4px 8px;border:1px solid rgba(251,146,60,0.4)}

.cinematic-festival .v-body{padding:12px 14px;display:flex;flex-direction:column;gap:5px;min-width:0;justify-content:center}

.cinematic-festival .v-eyebrow{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.45)}

.cinematic-festival .v-name{font-family:'Bebas Neue',sans-serif;font-size:22px;line-height:1;letter-spacing:-0.01em;color:#fff;margin:0}

.cinematic-festival .v-addr{font-family:'JetBrains Mono',monospace;font-size:11px;color:rgba(255,255,255,0.55);letter-spacing:0.05em;line-height:1.5}

.cinematic-festival .v-stats{display:flex;gap:10px;flex-wrap:wrap;margin-top:4px}

.cinematic-festival .v-stat{display:flex;align-items:baseline;gap:4px;font-family:'JetBrains Mono',monospace}

.cinematic-festival .v-stat .n{font-family:'Bebas Neue',sans-serif;font-size:15px;color:#fb923c;line-height:1}

.cinematic-festival .v-stat .l{font-size:8px;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,0.45)}

.cinematic-festival .v-stat::after{content:'';width:3px;height:3px;background:rgba(255,255,255,0.2);border-radius:50%;margin-left:8px;align-self:center}

.cinematic-festival .v-stat:last-child::after{display:none}

.cinematic-festival .v-cta{background:#fb923c;color:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:12px 8px;transition:background .2s ease;position:relative}

.cinematic-festival .v-cta::before{content:'';position:absolute;top:0;bottom:0;left:0;width:3px;background:#c2410c}

.cinematic-festival .v-cta .lbl{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:0.25em;font-weight:700;opacity:0.7}

.cinematic-festival .v-cta .word{font-family:'Bebas Neue',sans-serif;font-size:20px;line-height:1;letter-spacing:0.04em}

.cinematic-festival .v-cta .arr{font-family:'Bebas Neue',sans-serif;font-size:22px;line-height:1;transition:transform .2s ease;margin-top:4px}

.cinematic-festival .o-avatar-wrap{padding:14px;display:flex;align-items:center;justify-content:center}

.cinematic-festival .o-avatar{width:84px;height:84px;border-radius:50%;background-size:cover;background-position:center;border:2px solid rgba(251,146,60,0.4);transition:all .25s ease;flex-shrink:0;position:relative;box-shadow:0 0 30px rgba(251,146,60,0.2)}

.cinematic-festival .o-avatar.no-photo{background:linear-gradient(135deg,#fb923c,#ec4899);display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:32px;color:#fff}

.cinematic-festival .o-avatar::after{content:'\\2605 ';position:absolute;bottom:-2px;right:-2px;width:24px;height:24px;background:#fb923c;color:#000;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:3px solid #0a0a0a;font-family:'Bebas Neue',sans-serif}

.cinematic-festival .o-body{padding:16px 8px;display:flex;flex-direction:column;gap:6px;min-width:0;justify-content:center}

.cinematic-festival .o-eyebrow{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.45)}

.cinematic-festival .o-name{font-family:'Bebas Neue',sans-serif;font-size:22px;line-height:1;letter-spacing:-0.01em;color:#fff;margin:0}

.cinematic-festival .o-bio{font-size:12px;color:rgba(255,255,255,0.6);line-height:1.4;margin-top:2px}

.cinematic-festival .o-stats{display:flex;gap:10px;flex-wrap:wrap;margin-top:6px}

.cinematic-festival .o-stat{display:flex;align-items:baseline;gap:4px;font-family:'JetBrains Mono',monospace}

.cinematic-festival .o-stat .n{font-family:'Bebas Neue',sans-serif;font-size:14px;color:#fb923c;line-height:1}

.cinematic-festival .o-stat .l{font-size:8px;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,0.45)}

.cinematic-festival .o-stat::after{content:'';width:3px;height:3px;background:rgba(255,255,255,0.2);border-radius:50%;margin-left:8px;align-self:center}

.cinematic-festival .o-stat:last-child::after{display:none}



/* TICKETS */

.cinematic-festival .tickets{padding:48px 24px;background:#000;text-align:center}

.cinematic-festival .tickets .lab{font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:6px;color:#fb923c;margin-bottom:8px}

.cinematic-festival .tickets h2{font-family:'Bebas Neue',sans-serif;font-size:clamp(34px,4.8vw,56px);letter-spacing:-0.01em;line-height:1;margin-bottom:24px;font-weight:400}

.cinematic-festival .ticket-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1px;max-width:1100px;margin:0 auto;background:rgba(251,146,60,0.3)}

.cinematic-festival .tix{background:#0a0a0a;padding:24px 14px;text-align:center;transition:all .2s;cursor:pointer}

.cinematic-festival .tix:hover{background:#000;transform:translateY(-2px)}

.cinematic-festival .tix .n{font-family:'Bebas Neue',sans-serif;letter-spacing:4px;color:rgba(255,255,255,0.6);font-size:12px;text-transform:uppercase}

.cinematic-festival .tix .p{font-family:'Bebas Neue',sans-serif;font-size:48px;line-height:1;color:#fff;letter-spacing:-0.02em;margin:10px 0 4px}

.cinematic-festival .tix .p::before{content:'\\a3 ';color:#fb923c;font-size:0.6em;margin-right:2px}

.cinematic-festival .tix .d{font-size:11px;color:rgba(255,255,255,0.4);letter-spacing:0.05em}

.cinematic-festival .end-cta{margin-top:32px}

.cinematic-festival .end-cta .btn{font-size:14px;padding:16px 48px}



.cinematic-festival footer{padding:32px 24px;background:#000;text-align:center;border-top:1px solid rgba(251,146,60,0.2)}

.cinematic-festival footer .x{font-family:'Bebas Neue',sans-serif;color:rgba(255,255,255,0.4);text-transform:uppercase;display:flex;flex-direction:column;align-items:center;gap:4px}

.cinematic-festival footer .x-org{font-size:11px;letter-spacing:5px;color:rgba(251,146,60,0.7)}

.cinematic-festival footer .x-name{font-size:13px;letter-spacing:3px;color:rgba(255,255,255,0.55)}

@media (max-width:480px){

  .cinematic-festival footer .x-org{letter-spacing:4px}

  .cinematic-festival footer .x-name{letter-spacing:2px;font-size:12px}

}



/* Mobile breakpoints */

@media (max-width:900px){

  .cinematic-festival .tl-header{display:none}

  .cinematic-festival .tl-row{grid-template-columns:60px 1fr !important;gap:0;min-height:0;padding:0}

  .cinematic-festival .tl-time{padding:10px 8px;font-size:10px}

  .cinematic-festival .slot{padding:10px 12px;min-height:0}

  /* single-day view: hide-based, count-independent. Read the note above the
     CINEMATIC_CSS declaration before touching either rule. */

  .cinematic-festival .tl-body:not([data-day="all"]) .tl-row > .slot:not([data-open]){display:none}

  .cinematic-festival .tl-body:not([data-day="all"]) .tl-row:not(:has(> .slot[data-open] > .session)){display:none}

  .cinematic-festival .day-mobile-tabs{display:flex;gap:6px;justify-content:center;margin-bottom:20px;flex-wrap:wrap;position:sticky;top:0;background:linear-gradient(180deg,#0a0a0a 0%,#0a0a0a 80%,transparent);padding:8px 0 12px;z-index:5}

  .cinematic-festival .day-tab{padding:10px 18px;background:rgba(255,255,255,0.04);border:1px solid rgba(251,146,60,0.3);color:#fb923c;font-family:'Bebas Neue',sans-serif;letter-spacing:0.15em;font-size:13px;text-transform:uppercase;cursor:pointer;transition:all .15s}

  .cinematic-festival .day-tab.active{background:#fb923c;color:#000;border-color:#fb923c}

  .cinematic-festival .lineup{padding:36px 16px}

  .cinematic-festival .filmstrip{margin:0 -16px}

  .cinematic-festival .frames{padding:20px 10px;display:grid;grid-template-columns:repeat(3,1fr);gap:6px;overflow-x:visible}

  .cinematic-festival .frames > *{min-width:0;max-width:none}

  .cinematic-festival .frame{margin:0}

  .cinematic-festival .frame-img{height:118px}

  .cinematic-festival .frame-img.no-photo .initial{font-size:46px}

  .cinematic-festival .frame-name{font-size:13px}

  .cinematic-festival .frame-style{font-size:7px;letter-spacing:0.1em}

  .cinematic-festival .frame-info{padding:8px 3px}

  .cinematic-festival .frame-num,.cinematic-festival .frame-corner{font-size:7px;padding:1px 3px}

  .cinematic-festival .frame::after{display:none}

  .cinematic-festival .vo{padding:28px 12px}

  .cinematic-festival .vo-grid{grid-template-columns:1fr 1fr;gap:10px}

  .cinematic-festival .vo-col .section-h{text-align:center;margin-bottom:8px}

  .cinematic-festival .vo-col .section-h .lab{font-size:13px;letter-spacing:2px}

  .cinematic-festival .v-card,.cinematic-festival .o-card{grid-template-columns:1fr;grid-template-rows:auto 1fr auto}

  .cinematic-festival .v-photo{width:100%;height:120px}

  .cinematic-festival .v-tag{font-size:8px;letter-spacing:0.15em;padding:3px 6px;top:8px;left:8px}

  .cinematic-festival .v-body{padding:10px 12px;gap:5px;text-align:center;align-items:center}

  .cinematic-festival .v-eyebrow{font-size:8px;letter-spacing:0.18em}

  .cinematic-festival .v-name{font-size:18px;line-height:1.05}

  .cinematic-festival .v-addr{font-size:10px;line-height:1.4}

  .cinematic-festival .v-stats{flex-direction:column;gap:4px;width:100%;align-items:center;margin-top:4px}

  .cinematic-festival .v-stat{justify-content:center;gap:5px}

  .cinematic-festival .v-stat .n{font-size:14px}

  .cinematic-festival .v-stat .l{font-size:8px}

  .cinematic-festival .v-stat::after{display:none}

  .cinematic-festival .v-cta{flex-direction:row;justify-content:center;align-items:center;gap:8px;padding:10px 8px}

  .cinematic-festival .v-cta::before{top:0;left:0;right:0;bottom:auto;height:3px;width:auto}

  .cinematic-festival .v-cta .lbl{font-size:8px;letter-spacing:0.2em}

  .cinematic-festival .v-cta .word{font-size:16px}

  .cinematic-festival .v-cta .arr{font-size:18px;margin-top:0}

  .cinematic-festival .o-avatar-wrap{padding:14px 14px 0;justify-content:center}

  .cinematic-festival .o-avatar{width:70px;height:70px;border-width:2px}

  .cinematic-festival .o-avatar::after{width:20px;height:20px;font-size:9px;bottom:0;right:0}

  .cinematic-festival .o-body{padding:8px 12px;gap:4px;text-align:center;align-items:center}

  .cinematic-festival .o-name{font-size:18px;line-height:1.05}

  .cinematic-festival .o-bio{font-size:10px;line-height:1.4}

  .cinematic-festival .o-stats{flex-direction:column;gap:4px;align-items:center;margin-top:4px}

  .cinematic-festival .o-stat{justify-content:center;gap:5px}

  .cinematic-festival .o-stat .n{font-size:13px}

  .cinematic-festival .o-stat .l{font-size:8px}

  .cinematic-festival .o-stat::after{display:none}

  .cinematic-festival .tickets{padding:36px 16px}

  .cinematic-festival .ticket-grid{grid-template-columns:1fr 1fr;gap:1px}

  .cinematic-festival .ticket-grid > .tix:last-child:nth-child(odd){grid-column:1 / -1}

  .cinematic-festival .tix{padding:16px 10px}

  .cinematic-festival .tix .p{font-size:36px;margin:6px 0 2px}

  .cinematic-festival .tix .n{font-size:11px;letter-spacing:3px}

  .cinematic-festival .tix .d{font-size:10px}

}

@media (min-width:901px){.cinematic-festival .day-mobile-tabs{display:none}}

@media (max-width:480px){

  .cinematic-festival .hero{padding:0 16px 40px}

  .cinematic-festival .hero h1{font-size:clamp(56px,16vw,80px)}

  .cinematic-festival .hero-tag{font-size:14px;letter-spacing:6px}

  .cinematic-festival .hero-dateline{font-size:17px;letter-spacing:2px}

  .cinematic-festival .hero-cta{margin-top:28px;gap:8px;flex-direction:row;flex-wrap:nowrap}

  .cinematic-festival .hero-cta .btn,.cinematic-festival .hero-cta .cal-wrap{flex:1 1 0;min-width:0;width:auto}

  .cinematic-festival .btn{padding:13px 8px;letter-spacing:2px;justify-content:center;font-size:11px}

  .cinematic-festival .cal-wrap > summary{width:100%;justify-content:center}

  .cinematic-festival .cal-menu{min-width:0;width:calc(100vw - 32px)}

}



/* === P6 hero subtitle (style + level) ==================== */

.cinematic-festival .hero-subtitle{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.65);margin-top:14px;position:relative;z-index:1;text-align:center;line-height:1.6;padding:0 16px;max-width:680px}

.cinematic-festival .hero-subtitle b{color:#fb923c;font-weight:500}

@media (max-width:480px){

  .cinematic-festival .hero-subtitle{font-size:9px;letter-spacing:0.1em;padding:0 8px}

}














.cinematic-festival .cal-cta{display:flex;justify-content:center;width:100%;margin-top:12px;position:relative;z-index:6}
.cinematic-festival .cal-pill{display:inline-flex;align-items:center;gap:7px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.22);color:rgba(255,255,255,0.92);font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.06em;padding:9px 16px;border-radius:99px;cursor:pointer;list-style:none;transition:border-color .2s,color .2s,background .2s}
.cinematic-festival .cal-pill::-webkit-details-marker{display:none}
.cinematic-festival .cal-pill::marker{content:''}
.cinematic-festival .cal-pill:hover{border-color:#fb923c;color:#fff;background:rgba(251,146,60,0.08)}
.cinematic-festival .cal-wrap[open] .cal-pill{border-color:#fb923c;color:#fff;background:rgba(251,146,60,0.06)}
.cinematic-festival .cal-pill .cal-pill-ico{color:#fb923c;flex-shrink:0}

@media (max-width:760px){

  .cinematic-festival .hero-cta .cal-wrap{flex:0 0 46px;width:46px}

  

}



/* === P3 schedule density toggle + counts ================= */

.cinematic-festival .day-tab-count{font-family:'JetBrains Mono',monospace;font-size:10px;color:rgba(255,255,255,0.45);letter-spacing:0.08em;margin-left:6px;font-weight:400}

.cinematic-festival .day-tab.active .day-tab-count{color:rgba(0,0,0,0.5)}

.cinematic-festival .day-tab.today:not(.active){border-color:rgba(251,146,60,0.7)}

.cinematic-festival .day-tab-today{margin-left:7px;font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:0.16em;text-transform:uppercase;color:#000;background:#fb923c;border-radius:99px;padding:1px 6px;vertical-align:middle}

.cinematic-festival .day-tab.active .day-tab-today{background:#000;color:#fb923c}

.cinematic-festival .all-days-toggle{display:flex;justify-content:center;margin:-6px 0 12px}

.cinematic-festival .all-days-toggle button{background:transparent;border:1px solid rgba(251,146,60,0.3);color:rgba(255,255,255,0.7);padding:6px 14px;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;cursor:pointer;transition:all .15s}

.cinematic-festival .all-days-toggle button:hover{border-color:#fb923c;color:#fb923c}

@media (min-width:901px){.cinematic-festival .all-days-toggle{display:none}}

.cinematic-festival .day-mobile-tabs[hidden]{display:none}

@media (max-width:900px){

  /* Swipe Grid mode: when showing all days on mobile, horizontal scroll with wide columns. */
  .cinematic-festival .tl-grid-wrap:has(.tl-body[data-day="all"]){overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:thin;scrollbar-color:rgba(251,146,60,0.4) transparent}

  .cinematic-festival .tl-grid-wrap:has(.tl-body[data-day="all"])::-webkit-scrollbar{height:4px}

  .cinematic-festival .tl-grid-wrap:has(.tl-body[data-day="all"])::-webkit-scrollbar-thumb{background:rgba(251,146,60,0.4)}

  .cinematic-festival .tl-grid-wrap:has(.tl-body[data-day="all"]) .tl-header{display:grid !important;grid-template-columns:60px repeat(var(--days, 3), minmax(170px, 1fr)) !important;min-width:fit-content;position:sticky;top:0;z-index:4;background:#0a0a0a}

  .cinematic-festival .tl-grid-wrap:has(.tl-body[data-day="all"]) .tl-time-h{position:sticky;left:0;z-index:2;background:#0a0a0a;padding:12px 8px;font-size:10px}

  .cinematic-festival .tl-grid-wrap:has(.tl-body[data-day="all"]) .tl-day{padding:10px 12px;font-size:10px;scroll-snap-align:start}

  .cinematic-festival .tl-grid-wrap:has(.tl-body[data-day="all"]) .tl-day .date{font-size:18px;margin-top:2px}

  .cinematic-festival .tl-body[data-day="all"]{min-width:fit-content}

  .cinematic-festival .tl-body[data-day="all"] .tl-row{display:grid !important;grid-template-columns:60px repeat(var(--days, 3), minmax(170px, 1fr)) !important;min-width:fit-content}

  .cinematic-festival .tl-body[data-day="all"] .tl-row > .slot{display:flex !important;scroll-snap-align:start}

  .cinematic-festival .tl-body[data-day="all"] .tl-time{position:sticky;left:0;z-index:2;background:#0a0a0a}

}

.cinematic-festival .tl-swipe-hint{display:none}

@media (max-width:900px){

  .cinematic-festival .tl-swipe-hint{display:flex;align-items:center;justify-content:center;gap:8px;padding:6px 16px 10px;font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(251,146,60,0.55)}

  .cinematic-festival .tl-swipe-hint span:first-child,.cinematic-festival .tl-swipe-hint span:last-child{font-size:14px}

}



/* === P2 "What's included" bullets ======================== */

.cinematic-festival .about-includes{margin:0 auto 18px;text-align:left;max-width:640px;display:grid;grid-template-columns:1fr;gap:8px 18px;padding:16px 18px;background:rgba(251,146,60,0.04);border:1px solid rgba(251,146,60,0.2)}

.cinematic-festival .about-includes-title{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#fb923c;grid-column:1/-1;margin-bottom:2px}

.cinematic-festival .about-includes-row{display:flex;gap:10px;align-items:flex-start;font-size:13px;line-height:1.55;color:rgba(255,255,255,0.88)}

.cinematic-festival .about-includes-row .check{color:#fb923c;flex-shrink:0;font-size:14px;line-height:1.45;font-weight:700}

@media (min-width:560px){

  .cinematic-festival .about-includes{grid-template-columns:1fr 1fr}

}



/* === P10 FAQ ============================================= */

.cinematic-festival .faq{padding:40px 24px;background:#000;border-top:1px solid rgba(251,146,60,0.15);border-bottom:1px solid rgba(251,146,60,0.15)}

.cinematic-festival .faq-wrap{max-width:720px;margin:0 auto}

.cinematic-festival .faq-label{font-family:'Bebas Neue',sans-serif;font-size:11px;letter-spacing:6px;color:#fb923c;margin-bottom:12px;text-transform:uppercase;text-align:center}

.cinematic-festival .faq h2{font-family:'Bebas Neue',sans-serif;font-size:clamp(28px,4vw,42px);line-height:1;letter-spacing:-0.01em;font-weight:400;color:#fff;margin:0 0 22px;text-align:center}

.cinematic-festival .faq details{border:1px solid rgba(251,146,60,0.2);background:#0a0a0a;margin-bottom:10px;transition:border-color .2s}

.cinematic-festival .faq details[open]{border-color:rgba(251,146,60,0.5)}

.cinematic-festival .faq details summary{padding:14px 18px;cursor:pointer;font-family:'Inter',sans-serif;font-size:14px;color:#fff;font-weight:500;display:flex;justify-content:space-between;align-items:center;gap:12px;list-style:none}

.cinematic-festival .faq details summary::-webkit-details-marker{display:none}

.cinematic-festival .faq details summary::marker{content:''}

.cinematic-festival .faq details summary::after{content:'+';color:#fb923c;font-family:'Bebas Neue',sans-serif;font-size:22px;line-height:1;transition:transform .2s}

.cinematic-festival .faq details[open] summary::after{content:'\\2212'}

.cinematic-festival .faq details .faq-ans{padding:0 18px 16px;font-size:13px;line-height:1.65;color:rgba(255,255,255,0.72);white-space:pre-line}



/* === Floating Add-to-Calendar FAB (Charcoal Stealth, P06 position) === */











@media (max-width:760px){.cinematic-festival .cal-mobile-trigger{display:none}}



/* Cal sheet portal: unscoped rules so a body-rendered portal still gets styled */

.cal-sheet-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:flex-end;justify-content:center;animation:cal-sheet-fade-in .15s ease;font-family:'Inter',sans-serif}

@keyframes cal-sheet-fade-in{from{opacity:0}to{opacity:1}}

.cal-sheet{background:#0a0a0a;border-top:1px solid #fb923c;border-radius:16px 16px 0 0;padding:14px 18px calc(20px + env(safe-area-inset-bottom));width:100%;max-width:520px;box-shadow:0 -16px 48px rgba(0,0,0,0.6);animation:cal-sheet-slide-up .25s cubic-bezier(0.16,1,0.3,1)}

@keyframes cal-sheet-slide-up{from{transform:translateY(100%)}to{transform:translateY(0)}}

.cal-sheet-handle{width:40px;height:4px;background:rgba(255,255,255,0.25);border-radius:2px;margin:0 auto 12px}

.cal-sheet-title{font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:0.06em;color:#fb923c;text-align:center;margin-bottom:2px;text-transform:uppercase}

.cal-sheet-sub{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:0.18em;color:rgba(255,255,255,0.55);text-align:center;text-transform:uppercase;margin-bottom:18px}

.cal-sheet-opts{display:flex;flex-direction:column;gap:8px}

.cal-sheet-opt{display:flex;align-items:center;gap:14px;padding:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);color:#fff;font-family:'Inter',sans-serif;font-size:14px;cursor:pointer;text-decoration:none;text-align:left;font-weight:500;transition:all .15s;width:100%}

.cal-sheet-opt:hover,.cal-sheet-opt:active{background:rgba(251,146,60,0.08);border-color:rgba(251,146,60,0.4)}

.cal-sheet-opt .cal-sheet-ico{width:32px;height:32px;background:rgba(251,146,60,0.12);border:1px solid rgba(251,146,60,0.4);color:#fb923c;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:14px;flex-shrink:0}

.cal-sheet-opt .cal-sheet-label{flex:1}

.cal-sheet-opt .cal-sheet-arr{color:rgba(255,255,255,0.4);font-size:14px}

.cal-sheet-cancel{margin-top:14px;width:100%;padding:12px;background:transparent;border:1px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.7);font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;cursor:pointer}

.cal-sheet-cancel:hover{border-color:rgba(255,255,255,0.4);color:#fff}



/* === Calendar bottom sheet (mobile) + desktop dropdown ============ */

.cinematic-festival .cal-mobile-trigger{display:none}

@media (max-width:760px){

  .cinematic-festival .cal-wrap-desktop{display:none}

  .cinematic-festival .cal-mobile-trigger{display:inline-flex}

}

.cinematic-festival .cal-sheet-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:100;display:flex;align-items:flex-end;justify-content:center;animation:fade-in .15s ease}

@keyframes fade-in{from{opacity:0}to{opacity:1}}

.cinematic-festival .cal-sheet{background:#0a0a0a;border-top:1px solid #fb923c;border-radius:16px 16px 0 0;padding:14px 18px calc(20px + env(safe-area-inset-bottom));width:100%;max-width:520px;box-shadow:0 -16px 48px rgba(0,0,0,0.6);animation:slide-up .25s cubic-bezier(0.16,1,0.3,1)}

@keyframes slide-up{from{transform:translateY(100%)}to{transform:translateY(0)}}

.cinematic-festival .cal-sheet-handle{width:40px;height:4px;background:rgba(255,255,255,0.25);border-radius:2px;margin:0 auto 12px}

.cinematic-festival .cal-sheet-title{font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:0.06em;color:#fb923c;text-align:center;margin-bottom:2px;text-transform:uppercase}

.cinematic-festival .cal-sheet-sub{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:0.18em;color:rgba(255,255,255,0.55);text-align:center;text-transform:uppercase;margin-bottom:18px}

.cinematic-festival .cal-sheet-opts{display:flex;flex-direction:column;gap:8px}

.cinematic-festival .cal-sheet-opt{display:flex;align-items:center;gap:14px;padding:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);color:#fff;font-family:'Inter',sans-serif;font-size:14px;cursor:pointer;text-decoration:none;text-align:left;font-weight:500;transition:all .15s}

.cinematic-festival .cal-sheet-opt:hover,.cinematic-festival .cal-sheet-opt:active{background:rgba(251,146,60,0.08);border-color:rgba(251,146,60,0.4)}

.cinematic-festival .cal-sheet-opt .cal-sheet-ico{width:32px;height:32px;background:rgba(251,146,60,0.12);border:1px solid rgba(251,146,60,0.4);color:#fb923c;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:14px;flex-shrink:0}

.cinematic-festival .cal-sheet-opt .cal-sheet-label{flex:1}

.cinematic-festival .cal-sheet-opt .cal-sheet-arr{color:rgba(255,255,255,0.4);font-size:14px}

.cinematic-festival .cal-sheet-cancel{margin-top:14px;width:100%;padding:12px;background:transparent;border:1px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.7);font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;cursor:pointer}

.cinematic-festival .cal-sheet-cancel:hover{border-color:rgba(255,255,255,0.4);color:#fff}



/* === P11 venue extra photo strip ========================= */

.cinematic-festival .v-photo-extra{height:72px;background-size:cover;background-position:center;border-top:1px solid rgba(251,146,60,0.2);background-color:#1a1a1a;filter:saturate(0.9)}


/* === Neon Night: headliners grid + description rules (orange-recolored) === */
.cinematic-festival .neon-rule{height:2px;border:0;margin:0;background:linear-gradient(90deg,transparent,#fb923c 30%,#f97316 70%,transparent);box-shadow:0 0 12px rgba(251,146,60,0.6)}
.cinematic-festival .nl-head{display:flex;align-items:center;gap:14px;max-width:1100px;margin:0 auto 22px}
.cinematic-festival .nl-head .neon-rule{flex:1}
.cinematic-festival .nl-title{font-family:'Bebas Neue',sans-serif;font-weight:400;font-size:clamp(30px,5vw,46px);line-height:1;letter-spacing:0.01em;text-transform:uppercase;color:#fff;margin:0;white-space:nowrap;text-shadow:0 0 6px rgba(251,146,60,0.9),0 0 22px rgba(251,146,60,0.65),0 0 44px rgba(249,115,22,0.45)}
.cinematic-festival .nl-count{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#fb923c;white-space:nowrap;flex-shrink:0}
.cinematic-festival .nl-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:9px;max-width:900px;margin:0 auto;justify-content:center}
.cinematic-festival .nl-frame{position:relative;display:block;aspect-ratio:3/4;border-radius:4px;overflow:hidden;text-decoration:none;color:inherit;background:#0a0a0a;box-shadow:0 0 0 1.5px rgba(251,146,60,0.8),0 0 22px -2px rgba(251,146,60,0.55),inset 0 0 30px rgba(251,146,60,0.18);transition:box-shadow .25s ease,transform .25s ease}
.cinematic-festival .nl-frame:hover{transform:translateY(-3px);box-shadow:0 0 0 1.5px #fb923c,0 0 30px -2px rgba(251,146,60,0.85),inset 0 0 34px rgba(251,146,60,0.26)}
.cinematic-festival .nl-img{position:absolute;inset:0;background-size:cover;background-position:center top;background-color:#1a1a1a;transition:transform .4s ease}
.cinematic-festival .nl-frame:hover .nl-img{transform:scale(1.05)}
.cinematic-festival .nl-img.no-photo{display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,rgba(251,146,60,0.28),rgba(0,0,0,0.55))}
.cinematic-festival .nl-img.no-photo .initial{font-family:'Bebas Neue',sans-serif;font-size:64px;line-height:1;color:#fb923c;text-shadow:0 0 24px rgba(251,146,60,0.6)}
.cinematic-festival .nl-scrim{position:absolute;inset:0;z-index:2;background:linear-gradient(0deg,rgba(7,6,11,0.92),transparent 55%);pointer-events:none}
.cinematic-festival .nl-meta{position:absolute;left:8px;right:6px;bottom:8px;z-index:3}
.cinematic-festival .nl-name{font-family:'Bebas Neue',sans-serif;font-size:16px;line-height:1.05;letter-spacing:0.01em;color:#fff}
.cinematic-festival .nl-style{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#fb923c;margin-top:3px;text-shadow:0 0 8px rgba(251,146,60,0.45)}
.cinematic-festival .nd-rule-top{margin-bottom:18px}
.cinematic-festival .nd-rule-bottom{margin-top:20px}
@media (max-width:759px){.cinematic-festival .nl-grid{grid-template-columns:repeat(3,1fr)}}
@media (min-width:760px){.cinematic-festival .nl-grid{grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;justify-content:center}.cinematic-festival .nl-name{font-size:20px}.cinematic-festival .nl-style{font-size:10px}.cinematic-festival .nl-img.no-photo .initial{font-size:88px}}
/* === Sample 08 Stories cover (replaces poster-polaroid) === */
.cinematic-festival .story-cover{position:relative;z-index:5;align-self:stretch;margin:0 -24px 22px}
.cinematic-festival .story{position:relative;aspect-ratio:16/9;border-radius:0;overflow:hidden;background:transparent}
.cinematic-festival .story .photo{position:absolute;inset:0;opacity:0;transition:opacity .6s ease}
.cinematic-festival .story .photo.on{opacity:1}
.cinematic-festival .story .photo img{width:100%;height:100%;object-fit:contain;display:block}
.cinematic-festival .story .bars{position:absolute;top:10px;left:10px;right:10px;z-index:9;display:flex;gap:6px}
.cinematic-festival .story .bar{flex:1;height:3px;border-radius:99px;background:rgba(255,255,255,0.28);overflow:hidden}
.cinematic-festival .story .bar i{display:block;height:100%;width:100%;transform-origin:left;transform:scaleX(0);background:#fb923c;border-radius:99px;box-shadow:0 0 8px rgba(251,146,60,0.6)}
.cinematic-festival .story .zone{position:absolute;top:0;bottom:0;width:32%;z-index:8;cursor:pointer;background:transparent;border:0;padding:0}
.cinematic-festival .story .zone.l{left:0}
.cinematic-festival .story .zone.r{right:0}
.cinematic-festival .story .center{position:absolute;top:0;bottom:0;left:32%;right:32%;z-index:8;cursor:zoom-in;background:transparent;border:0;padding:0}
.cinematic-festival .story .aff{position:absolute;bottom:10px;left:50%;transform:translateX(-50%);z-index:7;pointer-events:none;font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#0a0a0a;background:#fb923c;padding:5px 12px;border-radius:99px;display:flex;align-items:center;gap:5px;box-shadow:0 4px 14px rgba(251,146,60,0.5);animation:festival-aff-pulse 2.2s ease-in-out infinite}
.cinematic-festival .story .aff svg{width:11px;height:11px}
@keyframes festival-story-progress{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes festival-aff-pulse{0%,100%{transform:translateX(-50%) scale(1);box-shadow:0 4px 14px rgba(251,146,60,0.45)}50%{transform:translateX(-50%) scale(1.06);box-shadow:0 6px 20px rgba(251,146,60,0.75)}}
@media (prefers-reduced-motion:reduce){.cinematic-festival .story .aff{animation:none}}
@media (max-width:760px){.cinematic-festival .story-cover{margin-bottom:14px}}
@media (max-width:480px){.cinematic-festival .story-cover{margin-left:-16px;margin-right:-16px}}
@media (min-width:761px){.cinematic-festival .story-cover .story{aspect-ratio:auto;height:clamp(300px,46vh,460px)}}

/* === Raffle band ("Lucky Reels" slot machine) — see FestivalRaffleSection.tsx === */
.cinematic-festival .raffle-band{position:relative;background:radial-gradient(120% 90% at 50% -10%,rgba(245,213,99,0.05),transparent 60%),#000;padding:46px 24px 56px;border-top:1px solid rgba(251,146,60,0.15);border-bottom:1px solid rgba(251,146,60,0.15);overflow:hidden;font-family:'Inter',sans-serif}
.cinematic-festival .raffle-band::before,.cinematic-festival .raffle-band::after{content:"";position:absolute;top:0;bottom:0;width:16px;background-image:radial-gradient(circle,rgba(251,146,60,0.14) 2px,transparent 2.4px);background-size:16px 16px;background-position:center;opacity:.5;pointer-events:none}
.cinematic-festival .raffle-band::before{left:0}
.cinematic-festival .raffle-band::after{right:0}
/* CARD — a distinct framed container so the raffle reads as a separate, interactive unit (not event info) */
.cinematic-festival .raffle-band .rb-inner{position:relative;z-index:2;max-width:900px;margin:0 auto;background:linear-gradient(180deg,rgba(245,213,99,0.055),rgba(255,255,255,0.012));border:1px solid rgba(245,213,99,0.22);border-radius:20px;padding:36px 30px 30px;box-shadow:0 26px 60px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.05)}
.cinematic-festival .raffle-band .rb-tab{position:absolute;top:-14px;left:50%;transform:translateX(-50%);display:inline-flex;align-items:center;gap:7px;background:linear-gradient(180deg,#f7e08a,#e8c158);color:#1a0a10;font-family:'Bebas Neue',sans-serif;font-size:13px;letter-spacing:.2em;text-transform:uppercase;padding:6px 16px;border-radius:99px;box-shadow:0 6px 16px rgba(245,213,99,0.35),0 0 0 4px #000;white-space:nowrap}
.cinematic-festival .raffle-band .rb-tab .rb-tab-ico{font-size:13px;line-height:1;display:block;flex:0 0 auto}
.cinematic-festival .raffle-band .rb-head{text-align:center;margin:0 0 22px}
.cinematic-festival .raffle-band .rb-heading{font-family:'Bebas Neue',sans-serif;font-size:clamp(30px,4.2vw,50px);line-height:.95;font-weight:400;text-align:center;margin:0;color:#fff;letter-spacing:1px}
.cinematic-festival .raffle-band .rb-heading .gold{background:linear-gradient(180deg,#f7e08a 0%,#f5d563 42%,#b38a4e 100%);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:0 0 36px rgba(245,213,99,0.2)}
.cinematic-festival .raffle-band .rb-body{display:flex;gap:26px;align-items:center;justify-content:center}
.cinematic-festival .raffle-band .rb-machine-col{flex:0 0 auto;display:flex;align-items:center}
.cinematic-festival .raffle-band .rb-info-col{flex:1 1 320px;max-width:380px;display:flex;flex-direction:column;justify-content:center;gap:16px}
.cinematic-festival .raffle-band .machine-wrap{display:flex;align-items:center;justify-content:center;gap:0;margin:0}
.cinematic-festival .raffle-band .cabinet{position:relative;background:linear-gradient(180deg,#161616,#0b0b0b 60%,#080808);border:1px solid rgba(245,213,99,0.16);border-radius:18px;padding:18px 20px 15px;box-shadow:0 0 0 1px rgba(0,0,0,0.6),0 22px 48px rgba(0,0,0,0.55),0 0 46px rgba(245,213,99,0.05);width:300px}
.cinematic-festival .raffle-band .marquee{text-align:center;font-family:'Bebas Neue',sans-serif;font-size:14px;letter-spacing:5px;text-transform:uppercase;color:#f5d563;margin:0 0 12px;display:flex;align-items:center;justify-content:center;gap:12px;text-shadow:0 0 20px rgba(245,213,99,0.3)}
.cinematic-festival .raffle-band .marquee::before,.cinematic-festival .raffle-band .marquee::after{content:"";flex:0 0 auto;width:36px;height:1px;background:linear-gradient(90deg,transparent,rgba(245,213,99,0.5))}
.cinematic-festival .raffle-band .marquee::after{transform:scaleX(-1)}
.cinematic-festival .raffle-band .bulbs{display:flex;justify-content:center;gap:9px;margin:-2px 0 12px}
.cinematic-festival .raffle-band .bulbs i{width:6px;height:6px;border-radius:50%;background:#f5d563;box-shadow:0 0 7px rgba(245,213,99,0.8);animation:rb-chase 1.4s linear infinite}
.cinematic-festival .raffle-band .bulbs i:nth-child(2){animation-delay:.18s}
.cinematic-festival .raffle-band .bulbs i:nth-child(3){animation-delay:.36s}
.cinematic-festival .raffle-band .bulbs i:nth-child(4){animation-delay:.54s}
.cinematic-festival .raffle-band .bulbs i:nth-child(5){animation-delay:.72s}
.cinematic-festival .raffle-band .bulbs i:nth-child(6){animation-delay:.9s}
.cinematic-festival .raffle-band .bulbs i:nth-child(7){animation-delay:1.08s}
@keyframes rb-chase{0%,100%{opacity:.25}45%{opacity:1}}
.cinematic-festival .raffle-band .bezel{position:relative;background:linear-gradient(180deg,#ddc587,#bd9d57 20%,#8a6d3c 55%,#6e5630 80%,#a98b4a);border-radius:14px;padding:14px;box-shadow:inset 0 2px 3px rgba(255,255,255,0.4),inset 0 -3px 6px rgba(0,0,0,0.45),0 6px 16px rgba(0,0,0,0.5)}
.cinematic-festival .raffle-band .reels{position:relative;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;background:#050505;border-radius:7px;padding:8px;box-shadow:inset 0 0 0 2px rgba(0,0,0,0.8),inset 0 8px 20px rgba(0,0,0,0.9)}
.cinematic-festival .raffle-band .reel{position:relative;height:120px;overflow:hidden;border-radius:6px;background:linear-gradient(180deg,#191919,#0b0b0b);box-shadow:inset 0 0 0 1px rgba(245,213,99,0.1)}
.cinematic-festival .raffle-band .strip{position:absolute;left:0;right:0;top:0;display:flex;flex-direction:column;align-items:center;will-change:transform;transform:translateY(-30px)}
.cinematic-festival .raffle-band .sym{height:60px;flex:0 0 60px;display:flex;align-items:center;justify-content:center;font-size:34px;line-height:1;filter:drop-shadow(0 0 10px rgba(245,213,99,0.25))}
.cinematic-festival .raffle-band .reels.is-spinning .reel1 .strip{animation:rb-spin .42s linear infinite}
.cinematic-festival .raffle-band .reels.is-spinning .reel2 .strip{animation:rb-spin .52s linear infinite}
.cinematic-festival .raffle-band .reels.is-spinning .reel3 .strip{animation:rb-spin .36s linear infinite}
.cinematic-festival .raffle-band .reels.is-spinning .strip{filter:blur(.5px)}
@keyframes rb-spin{from{transform:translateY(0)}to{transform:translateY(-360px)}}
.cinematic-festival .raffle-band .reels.is-landed{box-shadow:inset 0 0 0 2px rgba(0,0,0,0.8),inset 0 8px 20px rgba(0,0,0,0.9),0 0 26px rgba(245,213,99,0.45)}
.cinematic-festival .raffle-band .reels.is-landed .reel1 .strip{animation:rb-land1 .5s cubic-bezier(.15,.85,.3,1.08) forwards}
.cinematic-festival .raffle-band .reels.is-landed .reel2 .strip{animation:rb-land2 .5s cubic-bezier(.15,.85,.3,1.08) .12s forwards}
.cinematic-festival .raffle-band .reels.is-landed .reel3 .strip{animation:rb-land3 .5s cubic-bezier(.15,.85,.3,1.08) .24s forwards}
@keyframes rb-land1{0%{transform:translateY(-118px)}70%{transform:translateY(-156px)}100%{transform:translateY(-150px)}}
@keyframes rb-land2{0%{transform:translateY(-238px)}70%{transform:translateY(-276px)}100%{transform:translateY(-270px)}}
@keyframes rb-land3{0%{transform:translateY(-178px)}70%{transform:translateY(-216px)}100%{transform:translateY(-210px)}}
.cinematic-festival .raffle-band .reel::before{content:"";position:absolute;inset:0;border-radius:6px;pointer-events:none;background:linear-gradient(180deg,rgba(0,0,0,0.85) 0%,transparent 28%,transparent 72%,rgba(0,0,0,0.85) 100%);z-index:3}
.cinematic-festival .raffle-band .reel::after{content:"";position:absolute;left:0;right:0;top:50%;height:60px;transform:translateY(-50%);pointer-events:none;z-index:2;border-top:1px solid rgba(245,213,99,0.5);border-bottom:1px solid rgba(245,213,99,0.5);background:rgba(245,213,99,0.05)}
.cinematic-festival .raffle-band .reels::after{content:"";position:absolute;inset:0;border-radius:7px;pointer-events:none;z-index:5;background:linear-gradient(115deg,transparent 38%,rgba(255,255,255,0.06) 48%,transparent 58%);background-size:240% 100%;animation:rb-shimmer 5s ease-in-out infinite}
@keyframes rb-shimmer{0%{background-position:140% 0}55%,100%{background-position:-40% 0}}
.cinematic-festival .raffle-band .reel-flash{position:absolute;inset:14px;display:flex;align-items:center;justify-content:center;z-index:8;pointer-events:none;opacity:0;transform:scale(.7);transition:opacity .18s ease,transform .28s cubic-bezier(.2,1.4,.4,1)}
.cinematic-festival .raffle-band .reel-flash.show{opacity:1;transform:scale(1)}
.cinematic-festival .raffle-band .reel-flash span{font-family:'Bebas Neue',sans-serif;font-size:17px;letter-spacing:.06em;color:#1a0a10;background:linear-gradient(180deg,#f7e08a,#f5d563);padding:7px 12px;border-radius:8px;box-shadow:0 0 26px rgba(245,213,99,0.85),0 6px 16px rgba(0,0,0,0.4);text-align:center;line-height:1.05}
.cinematic-festival .raffle-band .winline{margin:12px 2px 0;display:flex;align-items:center;justify-content:center;gap:9px;text-align:center}
.cinematic-festival .raffle-band .winline .lamp{width:7px;height:7px;border-radius:50%;flex:0 0 auto;background:#f5d563;box-shadow:0 0 9px rgba(245,213,99,0.9);animation:rb-pulse 1.2s ease-in-out infinite}
@keyframes rb-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}
.cinematic-festival .raffle-band .winline .label{font-family:'Bebas Neue',sans-serif;letter-spacing:2px;text-transform:uppercase;font-size:clamp(14px,2.2vw,18px);color:#fff;line-height:1.05}
.cinematic-festival .raffle-band .winline .label b{color:#f5d563;font-weight:400}
/* LEVER — anchored into a housing on the cabinet's right shoulder; knob rides DOWN the slot */
.cinematic-festival .raffle-band .lever-col{flex:0 0 42px;align-self:center;margin-left:-18px;position:relative;z-index:3;display:flex;align-items:center;justify-content:center}
.cinematic-festival .raffle-band .lever{position:relative;height:124px;width:42px;cursor:pointer;background:transparent;border:0;padding:0}
.cinematic-festival .raffle-band .lever::before{content:"";position:absolute;left:-4px;top:50%;transform:translateY(-50%);width:24px;height:36px;background:linear-gradient(180deg,#1b1b1b,#0c0c0c);border:1px solid rgba(245,213,99,0.18);border-radius:6px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.06),0 4px 10px rgba(0,0,0,0.5);z-index:0}
.cinematic-festival .raffle-band .lever-track{position:absolute;left:15px;top:8px;bottom:8px;width:12px;background:linear-gradient(180deg,#040404,#171717);border-radius:7px;box-shadow:inset 0 0 0 1px rgba(245,213,99,0.22),inset 0 6px 10px rgba(0,0,0,0.85);z-index:1}
.cinematic-festival .raffle-band .lever-arm{position:absolute;left:17px;top:10px;width:8px;height:52px;transform-origin:50% 100%;background:linear-gradient(90deg,#7e7e7e,#ededed 45%,#6a6a6a);border-radius:6px;box-shadow:0 2px 5px rgba(0,0,0,0.6);z-index:2;transition:transform .14s cubic-bezier(.34,1.3,.5,1)}
.cinematic-festival .raffle-band .lever-knob{position:absolute;left:4px;top:-4px;width:34px;height:34px;border-radius:50%;background:radial-gradient(circle at 34% 30%,#ff8a5a,#e0511a 58%,#7a1f05);box-shadow:0 0 16px rgba(251,146,60,0.5),inset 0 2px 4px rgba(255,255,255,0.55),inset 0 -3px 6px rgba(0,0,0,0.5);transition:transform .22s cubic-bezier(.34,1.3,.5,1);animation:rb-knob-pulse 1.8s ease-in-out infinite;z-index:3}
@keyframes rb-knob-pulse{0%,100%{box-shadow:0 0 16px rgba(251,146,60,0.45),inset 0 2px 4px rgba(255,255,255,0.55),inset 0 -3px 6px rgba(0,0,0,0.5)}50%{box-shadow:0 0 26px rgba(251,146,60,0.9),inset 0 2px 4px rgba(255,255,255,0.6),inset 0 -3px 6px rgba(0,0,0,0.5)}}
.cinematic-festival .raffle-band .lever-hint{position:absolute;bottom:-20px;left:50%;transform:translateX(-50%);white-space:nowrap;font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#f5d563;text-shadow:0 0 9px rgba(245,213,99,0.5)}
.cinematic-festival .raffle-band .lever:hover .lever-knob{transform:translateY(16px)}
.cinematic-festival .raffle-band .lever:hover .lever-arm{transform:scaleY(.74)}
.cinematic-festival .raffle-band .lever:active .lever-knob,.cinematic-festival .raffle-band .lever.is-pulled .lever-knob{transform:translateY(40px)}
.cinematic-festival .raffle-band .lever:active .lever-arm,.cinematic-festival .raffle-band .lever.is-pulled .lever-arm{transform:scaleY(.42)}
.cinematic-festival .raffle-band .rb-meta{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;margin:0;background:rgba(245,213,99,0.12);border:1px solid rgba(245,213,99,0.16);border-radius:12px;overflow:hidden}
.cinematic-festival .raffle-band .meta-cell{background:rgba(8,8,8,0.92);padding:13px 10px;text-align:center}
.cinematic-festival .raffle-band .meta-cell .k{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,0.62);margin:0 0 8px}
.cinematic-festival .raffle-band .meta-cell .v{font-family:'Bebas Neue',sans-serif;font-size:26px;line-height:.95;color:#fb923c;text-shadow:0 0 26px rgba(251,146,60,0.45);letter-spacing:1px}
.cinematic-festival .raffle-band .meta-cell .v.gold{color:#f5d563;text-shadow:0 0 26px rgba(245,213,99,0.4)}
.cinematic-festival .raffle-band .meta-cell .sub{font-family:'Inter',sans-serif;font-size:11px;color:rgba(255,255,255,0.62);margin-top:5px}
.cinematic-festival .raffle-band .cta-row{display:flex;flex-direction:column;align-items:stretch;gap:12px;margin:0}
.cinematic-festival .raffle-band .pull-btn{position:relative;width:100%;font-family:'Bebas Neue',sans-serif;letter-spacing:3px;font-size:17px;text-transform:uppercase;color:#1a0a10;background:linear-gradient(180deg,#f3d978,#ebc659 48%,#d6ac47);border:none;border-radius:11px;padding:14px 26px;cursor:pointer;box-shadow:0 8px 22px rgba(245,213,99,0.28),inset 0 1px 1px rgba(255,255,255,0.55),inset 0 -2px 5px rgba(0,0,0,0.22);transition:transform .12s ease,box-shadow .25s ease,filter .25s ease}
.cinematic-festival .raffle-band .pull-btn .lab-small{display:block;font-size:9px;letter-spacing:.22em;color:rgba(26,10,16,0.65);margin-bottom:2px;font-family:'JetBrains Mono',monospace}
.cinematic-festival .raffle-band .pull-btn:hover{filter:brightness(1.06);box-shadow:0 10px 30px rgba(245,213,99,0.5);transform:translateY(-2px)}
.cinematic-festival .raffle-band .pull-btn:active{transform:translateY(1px)}
.cinematic-festival .raffle-band .cta-foot{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,0.62);text-align:center;line-height:1.7}
.cinematic-festival .raffle-band .cta-foot b{color:#f5d563;font-weight:700}
.cinematic-festival .raffle-band .pull-btn.is-busy{opacity:.82;cursor:progress;filter:saturate(.9)}
.cinematic-festival .raffle-band .rb-trust{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,0.5);text-align:center;margin:2px 0 0;line-height:1.6}
.cinematic-festival .raffle-band .rb-chip{display:inline-flex;align-items:center;justify-content:center;gap:9px;align-self:stretch;font-family:'Bebas Neue',sans-serif;letter-spacing:2px;text-transform:uppercase;font-size:15px;color:#1a0a10;background:linear-gradient(180deg,#f3d978,#ebc659 48%,#d6ac47);border-radius:11px;padding:13px 18px;box-shadow:0 8px 22px rgba(245,213,99,0.28),inset 0 1px 1px rgba(255,255,255,0.55)}
.cinematic-festival .raffle-band .rb-chip-ico{flex:0 0 auto;width:14px;height:14px;position:relative}
.cinematic-festival .raffle-band .rb-chip-ico::before{content:'';position:absolute;left:4px;top:0;width:5px;height:9px;border:solid #1a0a10;border-width:0 2px 2px 0;transform:rotate(45deg)}
.cinematic-festival .raffle-band.is-dimmed .bezel{filter:grayscale(.45) brightness(.72)}
.cinematic-festival .raffle-band.is-dimmed .bulbs i,.cinematic-festival .raffle-band.is-dimmed .reels::after{animation:none}
@media (max-width:860px){
.cinematic-festival .raffle-band .rb-body{flex-direction:column;align-items:center;gap:22px}
.cinematic-festival .raffle-band .rb-machine-col{width:100%;justify-content:center}
.cinematic-festival .raffle-band .rb-info-col{width:100%;max-width:440px;flex:1 1 auto}
.cinematic-festival .raffle-band .lever-col{display:flex}
}
@media (max-width:480px){
.cinematic-festival .raffle-band{padding:34px 14px 52px}
.cinematic-festival .raffle-band .rb-inner{padding:30px 16px 22px;border-radius:16px}
.cinematic-festival .raffle-band .cabinet{width:100%;max-width:320px}
.cinematic-festival .raffle-band .meta-cell{padding:11px 7px}
.cinematic-festival .raffle-band::before,.cinematic-festival .raffle-band::after{display:none}
}
@media (prefers-reduced-motion:reduce){
.cinematic-festival .raffle-band .bulbs i,.cinematic-festival .raffle-band .reels::after,.cinematic-festival .raffle-band .winline .lamp,.cinematic-festival .raffle-band .lever-knob{animation:none}
}

`;



// ---------------------------------------------------------------------------

// Helpers

// ---------------------------------------------------------------------------



// Generate an RFC 5545 .ics file for a single all-spanning event,
// then trigger a download via blob URL.

const downloadIcsFile = (params: {

  uid: string;

  title: string;

  description: string;

  location: string;

  startIso: string;

  endIso: string;

  url: string;

}) => {

  const fmtUtc = (iso: string) => {

    const d = new Date(iso);

    if (isNaN(d.getTime())) return "";

    const pad = (n: number) => String(n).padStart(2, "0");

    return (

      d.getUTCFullYear().toString() +

      pad(d.getUTCMonth() + 1) +

      pad(d.getUTCDate()) + "T" +

      pad(d.getUTCHours()) +

      pad(d.getUTCMinutes()) +

      pad(d.getUTCSeconds()) + "Z"

    );

  };

  const escape = (s: string) =>

    s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

  const lines = [

    "BEGIN:VCALENDAR",

    "VERSION:2.0",

    "PRODID:-//Bachata Calendar//Festival//EN",

    "CALSCALE:GREGORIAN",

    "METHOD:PUBLISH",

    "BEGIN:VEVENT",

    `UID:${escape(params.uid)}@bachatacalendar.co.uk`,

    `DTSTAMP:${fmtUtc(new Date().toISOString())}`,

    `DTSTART:${fmtUtc(params.startIso)}`,

    `DTEND:${fmtUtc(params.endIso)}`,

    `SUMMARY:${escape(params.title)}`,

    `DESCRIPTION:${escape(params.description)}`,

    `LOCATION:${escape(params.location)}`,

    `URL:${escape(params.url)}`,

    "END:VEVENT",

    "END:VCALENDAR",

    "",

  ];

  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });

  const url = URL.createObjectURL(blob);

  const slug = params.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  const a = document.createElement("a");

  a.href = url;

  a.download = `${slug || "event"}.ics`;

  document.body.appendChild(a);

  a.click();

  document.body.removeChild(a);

  setTimeout(() => URL.revokeObjectURL(url), 1000);

};



const formatGCalDate = (iso: string | null): string | null => {

  if (!iso) return null;

  const d = new Date(iso);

  if (isNaN(d.getTime())) return null;

  const pad = (n: number) => String(n).padStart(2, "0");

  return (

    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +

    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`

  );

};



// The range formatting, key validation and end-key clamping all live in
// src/lib/londonDate.ts (the calendar-time authority) -- this page only
// chooses the styles ('long' for the hero, 'short' for the share subtitle)
// and the live-window policy in heroDayStatus below.



// P2: parse "What's included:" bullets from a description blob.

const parseIncludedItems = (desc: string | null | undefined): string[] => {

  if (!desc) return [];

  const lines = desc.split(/\r?\n/);

  const startIdx = lines.findIndex((l) => /what's\s+included/i.test(l));

  if (startIdx < 0) return [];

  const out: string[] = [];

  for (let i = startIdx + 1; i < lines.length; i++) {

    const trimmed = lines[i].trim();

    if (!trimmed) {

      if (out.length > 0) break;

      continue;

    }

    const m = trimmed.match(/^[-*\u2022]\s*(.+)$/);

    if (!m) {

      if (out.length > 0) break;

      continue;

    }

    out.push(m[1].trim());

  }

  return out;

};



const splitTitleIntoLines = (name: string): string[] => {

  // Strip dash-delimited suffix (e.g., "London Sensual Days - June 2026 Edition")

  const cleaned = name.trim().split(/\s+[\u2013\u2014-]\s+/)[0];

  const words = cleaned.split(/\s+/);

  if (words.length <= 1) return [cleaned];

  if (words.length === 2) return words; // index 1 gets stroked

  if (words.length === 3) return words; // 3 lines, middle (index 1) gets stroked

  // 4+ words: split into 2 lines roughly equal; line-2 (index 1) gets stroked

  const mid = Math.ceil(words.length / 2);

  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];

};



// ---------------------------------------------------------------------------



/**
 * The raw event_view_p5 payload as read on a standalone /festival/:id mount
 * (snake_case). Only the fields this page actually reads are named; the rest
 * stays `unknown` rather than `any` so a new read has to declare itself here.
 */
type FestivalSnapshotPayload = {
  occurrence_effective?: {
    is_cancelled?: boolean | null;
    cancellation_reason_label?: string | null;
  } | null;
  [key: string]: unknown;
};

const FestivalDetailInner = ({ snapshot: propSnapshot, serverTodayKey }: FestivalDetailInnerProps) => {

  const { id } = useParams();

  const navigate = useNavigate();

  const { pathname } = useLocation();

  // Which day tab is open, as an OVERRIDE rather than as the value: `null`
  // means "nobody has decided yet", and the rendered index falls back to a
  // pure, render-time seed derived from the loader's pinned key (see
  // `seedDayIdx` below). That is what lets the SERVER-rendered document open
  // the day it badges. The mount-gated effect and a user's tab click both
  // write here, and either one wins over the seed permanently.
  const [pickedDayIdx, setPickedDayIdx] = useState<number | null>(null);

  // SSR-safe: seed a DETERMINISTIC value so the server and the client's first
  // render agree. Reading window.innerWidth here rendered `true` on the server
  // and `false` on a mobile client -> React #418/#425 hydration mismatch once
  // PR #99 made festivals SSR content at /event/<slug>. Mobile-first default
  // (single-day tabs, ~95% of traffic); the mount effect below upgrades desktop
  // (>900px) to the all-days grid. Users can still toggle either way.
  const [showAllDays, setShowAllDays] = useState(false);

  const [isCalSheetOpen, setIsCalSheetOpen] = useState(false);

  const [descExpanded, setDescExpanded] = useState(false);

  // Poster/flyer gallery lightbox: index of the image being viewed, or null when closed.
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);



  // The URL param may be a slug OR a uuid. Entity queries below hit uuid
  // columns / RPCs (event_view_p5, get_public_festival_detail), so a raw slug
  // 400s. When rendered by EventPage the resolved snapshot is passed in and
  // carries the real uuid; standalone /festival/:id (and the canonicalised
  // /event/<slug> URL) must resolve slug -> uuid first.
  const { id: resolvedEventId, slug: resolvedSlug } = useEntitySlugOrId(id, "events");
  const festivalId = propSnapshot?.eventId ?? resolvedEventId ?? "";



  useRecordEventView(festivalId, "public_festival_page");



  const { data: festival, isLoading: isFestivalLoading } = useQuery({

    queryKey: festivalEventQueryKey(festivalId),

    queryFn: async () => (await fetchFestivalEventRow(festivalId)) as FestivalEvent | null,

    enabled: Boolean(festivalId),

  });



  const snapshotQueryEnabled = Boolean(festivalId) && !propSnapshot;

  const {
    data: snapshotPayload,
    isSuccess: snapshotSucceeded,
    isError: snapshotFailed,
  } = useQuery({

    queryKey: ["festival-snapshot", festivalId],

    queryFn: async () => {

      const { data, error: rpcError } = await supabase.rpc("event_view_p5" as never, {

        p_target: { series_id: festivalId },

        p_viewer: { role: "anon", shape: "snapshot_compat" },

      } as never);

      if (rpcError) throw rpcError;

      return data as FestivalSnapshotPayload | null;

    },

    enabled: snapshotQueryEnabled,

  });



  const effectiveSnapshot = propSnapshot ?? snapshotPayload;

  // Whole-festival cancelled state -- from the parsed snapshot (camelCase, via
  // EventPage) or the raw event_view_p5 payload (snake_case, standalone
  // /festival/:id mount). Drives the visible banner + JSON-LD eventStatus.
  const isCancelled =
    propSnapshot?.occurrenceEffective?.isCancelled === true ||
    snapshotPayload?.occurrence_effective?.is_cancelled === true;

  const cancellationReasonLabel =
    propSnapshot?.occurrenceEffective?.cancellationReasonLabel ??
    (typeof snapshotPayload?.occurrence_effective?.cancellation_reason_label === "string"
      ? (snapshotPayload.occurrence_effective.cancellation_reason_label as string)
      : null);

  // How much do we know about cancellation? THREE states, not two -- see
  // computeHeroDayStatus for why the distinction is load-bearing. Derived as a
  // plain value so the memo below can depend on it honestly: depending on
  // `snapshotPayload` via a bare read inside the memo left it stale, and a
  // non-cancelled festival then kept the "stay silent" result forever (the
  // cancelled path recomputed because isCancelled itself flipped, so the bug hid
  // in the common case).
  //
  //   known       the fact arrived (prop snapshot, or the query succeeded).
  //   unknowable  the query errored, or never ran at all (no festivalId). The
  //               previous predicate treated this as "not yet" and held the hero
  //               blank permanently on healthy festivals whose dates had loaded.
  //   pending     still in flight.
  const cancellationState: CancellationState =
    Boolean(propSnapshot) || snapshotSucceeded
      ? "known"
      : snapshotFailed || !snapshotQueryEnabled
        ? "unknowable"
        : "pending";

  const { data: festivalDetail } = useFestivalDetailQuery(festivalId, Boolean(festivalId));

  useSeo(
    buildSeoForRoute('festival.detail', {
      entityName: festival?.name,
      entitySlug: resolvedSlug ?? undefined,
      cityDisplay: (festival?.city as string | null | undefined) ?? undefined,
      ogImage: festival?.poster_url ?? undefined,
      isLoading: isFestivalLoading,
    }),
  );



  // Venue gallery (P11): second photo if the venue has more imagery

  const venueIdForGallery = festivalDetail?.location.primaryVenue?.id ?? null;

  const { data: venueGallery } = useQuery({

    queryKey: ["festival-venue-gallery", venueIdForGallery],

    enabled: Boolean(venueIdForGallery),

    queryFn: async () => {

      if (!venueIdForGallery) return null;

      const { data, error } = await supabase

        .from("venues")

        .select("gallery_urls")

        .eq("id", venueIdForGallery)

        .maybeSingle();

      if (error) return null;

      return (data?.gallery_urls as string[] | null) ?? null;

    },

    staleTime: 5 * 60 * 1000,

  });



  // Organiser bio + event count -- augments the RPC's id/displayName/avatarUrl

  const organiserId = festivalDetail?.organiser?.id ?? null;

  const { data: organiserStats } = useQuery({

    queryKey: ["organiser-stats", organiserId],

    enabled: Boolean(organiserId),

    queryFn: async () => {

      if (!organiserId) return null;

      const [profileRes, countRes] = await Promise.all([

        supabase

          .from("organiser_profiles")

          .select("bio, created_at")

          .eq("id", organiserId)

          .maybeSingle(),

        supabase

          .from("event_entities")

          .select("event_id", { count: "exact", head: true })

          .eq("organiser_profile_id", organiserId)

          .eq("role", "organiser"),

      ]);

      return {

        bio: (profileRes.data?.bio as string | null) ?? null,

        createdAt: (profileRes.data?.created_at as string | null) ?? null,

        eventCount: countRes.count ?? 0,

      };

    },

    staleTime: 1000 * 60 * 5,

  });



  // `mounted` is the fallback half of the clock-display gate: where no route
  // loader pinned the day, a clock-reading display (the days-away line, the
  // schedule's today badges) must wait for hydration or the server and first
  // client render disagree -- the clock differs build-vs-client, a React #418
  // mismatch on /event/<slug> under SSR. `canRenderClockDerived` below is the
  // single predicate those DISPLAYS actually read; do not gate one on raw
  // `mounted`, which is blind to the pin and hides the label needlessly.
  //
  // Non-display consumers are the other way round: the default-day effect below
  // deliberately waits for raw `mounted`, because it LATCHES and so must not act
  // on a pinned key that has not yet been checked against the client clock.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {

    setMounted(true);

    // Post-mount: upgrade desktop viewports to the all-days grid. SSR-safe --
    // window is only read AFTER hydration (see the showAllDays seed above).
    if (typeof window !== "undefined" && window.innerWidth > 900) setShowAllDays(true);

  }, []);



  // --- Derived values ---

  const eventTz = festivalDetail?.dates.timezone ?? "Europe/London";

  // A date-only wall clock (legacy events.date) -> the event-tz midnight
  // instant. Last-resort start when no real instant is available.
  const dateOnlyStartInstant = (wc: WallClock | null | undefined): Date | null => {
    const key = wallClockDateKey(wc);
    return key ? wallClockToInstant(asWallClock(`${key}T00:00:00`), eventTz) : null;
  };

  // Real-instant nucleus: dates.startsAt/endsAt are TRUE UTC instants (_v2).
  // events.start_time is NOT in this chain -- see the FestivalEvent type: that
  // column mixes true instants with naive local-as-UTC stamps per row, so using
  // it read 1h late through BST on exactly the path nobody watches. When _v2 has
  // no instant, fall back to the event-tz midnight of events.date (a genuine
  // date-only wall clock) so the days-away line / JSON-LD / calendar links
  // still carry a defensible value instead of a silently wrong one.
  const startInstant =
    instantToDate(festivalDetail?.dates.startsAt ?? null) ??
    dateOnlyStartInstant(festival?.date ?? null);

  const endInstant = instantToDate(festivalDetail?.dates.endsAt ?? null);

  // Stable scalars for links/JSON-LD/memo deps. startInstant is a fresh Date on
  // every render, so NOTHING may depend on its object identity.
  const startIso = startInstant ? startInstant.toISOString() : null;

  const endIso = endInstant ? endInstant.toISOString() : null;

  // Calendar-day keys for DISPLAY (date line/labels/tabs): event-timezone date-only
  // wall clocks from _v2, then the legacy date column, then the instant read in
  // the event timezone. Never local-Date getters -- that was the wrong-day bug.
  const startKey =
    wallClockDateKey(festivalDetail?.dates.localStart ?? null) ??
    wallClockDateKey(festival?.date ?? null) ??
    (startInstant ? dateKeyInTz(startInstant, eventTz) : null);

  const endKey =
    wallClockDateKey(festivalDetail?.dates.localEnd ?? null) ??
    (endInstant ? dateKeyInTz(endInstant, eventTz) : null);



  // The hero's single date line, complete in one read: weekday + day + month +
  // year, with no day cap and both months/years spelled out across a boundary.

  const heroDateLine = useMemo(() => formatKeyRange(startKey, endKey, "long"), [startKey, endKey]);



  // Calendar dropdown URLs

  const calUrls = useMemo(() => {

    if (!startIso) return null;

    const name = festivalDetail?.identity.name ?? festival?.name ?? "Event";

    const description = festivalDetail?.identity.description ?? festival?.description ?? "";

    const venue = festivalDetail?.location.primaryVenue;

    const location = venue ? `${venue.name}${venue.address ? `, ${venue.address}` : ""}` : "";

    // startIso/endIso are REAL UTC instants, so the compact-UTC GCal form and
    // the Outlook startdt/enddt now land at the true moment (pre-brand these
    // carried the naive local-as-UTC stamp: 1h late all BST season).

    const gStart = formatGCalDate(startIso);

    const gEnd = formatGCalDate(endIso ?? startIso);

    if (!gStart || !gEnd) return null;

    const enc = encodeURIComponent;

    return {

      google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${enc(name)}&dates=${gStart}/${gEnd}&details=${enc(description.slice(0, 500))}&location=${enc(location)}`,

      outlook: `https://outlook.live.com/calendar/0/deeplink/compose?subject=${enc(name)}&startdt=${enc(startIso)}&enddt=${enc(endIso ?? startIso)}&location=${enc(location)}&body=${enc(description.slice(0, 500))}`,

    };

  }, [startIso, endIso, festival, festivalDetail]);



  // Schedule grid -- group by day, then by hour

  const { days, hours, sessionsByDayHour } = useMemo(() => {

    const schedule = festivalDetail?.schedule ?? [];

    // NB: the empty-branch seed MUST be WallClock[] -- an `[] as string[]` seed
    // makes `days` a union of array types, TS infers .map params as the
    // intersection `string & WallClock`, and the brand silently launders back
    // to string (new Date(day) compiled without error before this fix).

    if (schedule.length === 0) return { days: [] as WallClock[], hours: [] as number[], sessionsByDayHour: {} as Record<string, typeof schedule> };



    // Columns come from the festival's SPAN, not from the sessions that happen
    // to exist -- see festivalGridDays for why that distinction is the whole
    // bug. Kept as a pure function so the session-less-middle-day case is
    // testable without rendering this page.
    const uniqDays: WallClock[] = festivalGridDays(
      schedule,
      festivalDetail?.dates.localStart,
      festivalDetail?.dates.localEnd,
    );

    const uniqHoursSet = new Set<number>();

    const byKey: Record<string, typeof schedule> = {};

    schedule.forEach((s) => {

      const hh = wallClockHour(s.startTime);

      if (hh === null) return;

      uniqHoursSet.add(hh);

      const key = `${wallClockDateKey(s.day) ?? ''}-${hh}`;

      if (!byKey[key]) byKey[key] = [];

      byKey[key].push(s);

    });

    return { days: uniqDays, hours: Array.from(uniqHoursSet).sort((a, b) => a - b), sessionsByDayHour: byKey };

  }, [festivalDetail]);



  // Today's date key on the FESTIVAL's calendar (not the visitor's browser
  // zone and not London's): flips at the event's own midnight, re-anchors on
  // visibility/focus, and survives long-lived tabs. THE page's single clock —
  // it drives the today badges, the days-away figure and the default day tab.
  //
  // Seeded from the route loader's key where there is one, so the first render
  // (server AND hydration) agrees on the day and the days-away label can ship
  // in the server HTML. The hook re-checks against the real clock immediately
  // on mount, so an edge-cached document generated before the festival's
  // midnight self-corrects within a tick of hydration rather than showing a
  // stale figure for up to a minute.
  const todayKey = useTodayKey(eventTz, serverTodayKey);

  // Whether a todayKey-derived display is safe to render on THIS render.
  //
  // With a `serverTodayKey` the loader pinned the day, so the server and the
  // first client render derive the same answer from the same key: the text can
  // ship in the crawled HTML. Without one -- the /event/<slug> mount, which
  // renders this component lazily and passes no key -- `todayKey` comes from
  // whichever clock ran first, so every such display must wait for `mounted`.
  // Server and client can straddle midnight there, and that is exactly the
  // React #418 mismatch the mount gate was added for.
  //
  // One name for one rule: the hero's days-away label and both schedule
  // "today" badges are the same gate and drifted apart once already.
  const canRenderClockDerived = Boolean(serverTodayKey) || mounted;

  // The hero's timing cue, in whole calendar days on the event's calendar
  // (midnight-to-midnight, matching CalendarListView): "In N days" before,
  // "Today" on the start day, "Happening now" mid-run, nothing after. Render
  // site is mount-gated (todayKey reads the clock: #418).
  // The rules (and the three-state cancellation reasoning) live in the extracted
  // pure predicate, where the unit gate can reach them. This predicate was wrong
  // three commits running while it was inline here and untestable.
  const heroDayStatus = useMemo(
    () => computeHeroDayStatus({ startKey, endKey, todayKey, isCancelled, cancellationState }),
    [startKey, endKey, todayKey, isCancelled, cancellationState],
  );

  // The grid's day columns and its session days, as plain 'YYYY-MM-DD' keys.
  // Both default-day picks below need exactly this pair; deriving it once is
  // what stops them drifting apart the way the badge and the tab did.
  const dayKeys = useMemo(() => days.map((d) => wallClockDateKey(d) ?? ""), [days]);
  const sessionDayKeys = useMemo(
    () =>
      new Set(
        (festivalDetail?.schedule ?? [])
          .map((s) => wallClockDateKey(s.day))
          .filter((k): k is string => Boolean(k)),
      ),
    [festivalDetail?.schedule],
  );

  // THE RENDER-TIME SEED. Derived from the LOADER's pinned key, never from the
  // live clock, so the server render and the client's first (hydration) render
  // compute the same index from the same input -- no #418 mismatch, and no
  // dependence on `mounted`, which is false in both.
  //
  // This is what closes the gap that made the crawled document badge day 3 and
  // open day 1: the today badges were un-gated by the pin (see
  // `canRenderClockDerived`) while the only default-day pick was mount-gated,
  // so the two disagreed on every server-rendered load.
  //
  // A SEED IS NOT A LATCH, and that distinction is the whole safety argument.
  // The effect below still refuses to LATCH against the pinned key, for the
  // reason documented there: that document is edge-cached and can predate the
  // festival's midnight. This value latches nothing -- the moment the effect
  // (or a tab click) writes `pickedDayIdx`, the seed stops being read for the
  // rest of the page's life. A stale pin therefore costs one corrected tab a
  // tick after hydration, where before this seed EVERY load opened day 1.
  //
  // With no pinned key (`/event/<slug>`) there is nothing to seed from and this
  // is 0, exactly as before.
  const seedDayIdx = useMemo(
    () => resolveFestivalDefaultDay(dayKeys, sessionDayKeys, serverTodayKey ?? null),
    [dayKeys, sessionDayKeys, serverTodayKey],
  );

  // CLAMPED, because the picked index can outlive the schedule it was picked
  // from: a refetch that shortens the schedule leaves an earlier tab click
  // pointing past the last column, and an index past the last column matches no
  // cell -- `data-open` is stamped on nothing, the hide-every-other-slot rule
  // therefore hides EVERY slot, and the schedule renders blank.
  //
  // Stamping the open column on the slot made this view independent of the
  // column COUNT, not of the INDEX, so the clamp is not redundant with it.
  //
  // A REFETCH IS THE ONLY PATH THAT REACHES THIS, and this comment named the
  // wrong one for weeks. It said the clamp existed because `pickedDayIdx`
  // outlives a festival-to-festival NAVIGATION. It does not: both route entry
  // points render this page under `key={params.id}` -- app/routes/festival.tsx
  // and app/routes/event.tsx, since the RR7 migration (0729ecc, 2567376) -- so
  // a param change REMOUNTS the subtree and every destination starts from a
  // null pick. Measured through the real route component, both directions:
  // with the key, 8 commits and every one opens the destination's own seed;
  // with it deleted, the first commit opens the leaked index. The navigation
  // was never the danger; the key was already there.
  //
  // WHAT IT LEAVES UNDONE, unchanged: the clamp BOUNDS a stale pick, it does
  // not DROP one. `pickedDayIdx` keeps the out-of-range value, so the reader
  // silently gets the last column rather than the day they chose, and a later
  // refetch restoring the longer schedule springs the view back to the stale
  // index with no user action. `defaultedForRef.current === eid` means the
  // effect below will not re-pick either. That residual, and the two candidate
  // fixes for it (write the pick back, or re-run resolveFestivalDefaultDay when
  // dayKeys changes), are queued in
  // ~/.claude/plans/queued-festival-clamp-writeback-and-route-twin.md -- the
  // only referrer that file has.
  //
  // GATED BY EXACTLY ONE CASE, and it is worth knowing which. "a refetch that
  // SHORTENS the schedule" in tests/client/festivalClientState.test.tsx picks
  // day 2 of a 3-day festival, lands a 2-day payload for the SAME eventId, and
  // pins the open column to the last one. Reverting this line to
  // `pickedDayIdx ?? seedDayIdx` reds it with an empty array -- the blank grid
  // described above, reproduced. Nothing else covers it: the case that USED to
  // claim the clamp drove a navigation on an UNKEYED tree and passed with the
  // clamp reverted. Delete or weaken that case and this line is untested again,
  // with a green suite saying nothing.
  const activeDayIdx = Math.min(pickedDayIdx ?? seedDayIdx, Math.max(days.length - 1, 0));

  // Correct the seed against the REAL client clock when the festival is live
  // (else leave day 1). Runs once per festival load -- a ref keyed on eventId
  // stops it from overriding a user's later tab click or re-firing on unrelated
  // re-renders. `todayKey` is in the dep list because the effect reads it, but
  // the same ref makes it inert after the first pick: a midnight rollover
  // advances the badges and deliberately leaves the open tab where the user
  // left it.
  //
  // WAITING FOR `mounted` IS LOAD-BEARING, not a stray SSR guard. This pick
  // LATCHES, so it must not run against the SERVER's pinned key: that document
  // is edge-cached (s-maxage + SWR) and can have been generated before the
  // festival's midnight, and the latch would make the correction inert. The
  // schedule would then stay on yesterday's tab while the today badge, which
  // does not latch, marked the right day. `mounted` is exactly the "the pin has
  // been checked against the real client clock" signal.
  //
  // WHY THAT IS STILL TRUE ALONGSIDE THE SEED: the seed is read only until this
  // runs, and this always overwrites it. The pre-hydration document opens the
  // pinned day; the first mounted render opens the true day. Never the reverse.
  //
  // ON ORDERING, because the previous wording here had it backwards and someone
  // will act on it: useTodayKey's mount check is the LATER effect in this
  // component, not an earlier one -- `setMounted`'s effect is registered near
  // the top and `useTodayKey` is not called until some 160 lines further down.
  // The first render with `mounted === true` does still carry the corrected
  // key, but that holds because React 18 batches both state updates into ONE
  // commit, NOT because of hook order. Reordering these hooks changes nothing;
  // separating them across commits (a flushSync, a Suspense boundary, an await
  // between them) would, and would give exactly one latched render against the
  // stale pin -- the failure this paragraph exists to prevent.
  const defaultedForRef = useRef<string | null>(null);
  useEffect(() => {
    const eid = festivalDetail?.eventId ?? null;
    if (!eid || !mounted || dayKeys.length === 0 || defaultedForRef.current === eid) return;
    defaultedForRef.current = eid;
    // The gap-day rule -- withhold `todayKey` when today has no sessions, so a
    // visitor arriving on a rest day opens day 1 rather than a blank column --
    // now lives in resolveFestivalDefaultDay, shared with the seed above. It
    // used to be inline here, which is precisely why the seed could not exist.
    setPickedDayIdx(resolveFestivalDefaultDay(dayKeys, sessionDayKeys, todayKey));
    // `mounted` is a dep, not just a read: it is the edge this effect waits for.
    // Without it the effect runs once with mounted === false, bails, and never
    // re-runs when the flag flips (dayKeys and todayKey are typically unchanged
    // in that commit) -- the schedule would never be corrected off the seed.
  }, [festivalDetail?.eventId, dayKeys, sessionDayKeys, todayKey, mounted]);



  const venue = festivalDetail?.location.primaryVenue ?? null;

  const organiser = festivalDetail?.organiser ?? null;

  // Headliners filmstrip: if the event lists meta_data.headliner_ids, show only those
  // (in that order); otherwise fall back to the full teacher lineup. The schedule grid
  // still credits every teacher per session regardless.
  const allTeachers = festivalDetail?.lineup.teachers ?? [];
  const headlinerIds = ((festival?.meta_data as { headliner_ids?: unknown } | null)?.headliner_ids);
  const teachers = Array.isArray(headlinerIds) && headlinerIds.length > 0
    ? headlinerIds
        .map((hid) => allTeachers.find((t) => t.id === hid))
        .filter((t): t is (typeof allTeachers)[number] => Boolean(t))
    : allTeachers;

  const ticketUrl = festivalDetail?.links.ticketUrl ?? festival?.ticket_url ?? null;

  const directionsUrl = useMemo(() => {
    const v = festivalDetail?.location.primaryVenue;
    if (!v) return null;
    const query = [v.name, v.address].filter(Boolean).join(', ');
    if (!query) return null;
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
  }, [festivalDetail]);

  const shareSubtitle = useMemo(() => formatKeyRange(startKey, endKey, "short"), [startKey, endKey]);

  // Paid passes, ordered by the day they cover then by price. Free (£0) passes
  // are excluded from the "Reserve Your Pass" grid — there's nothing to book.
  const passes = (festivalDetail?.passes ?? [])
    .map((p) => ({ pass: p, amount: p.earlyBirdPrice ?? p.price }))
    .filter(({ amount }) => amount > 0)
    .sort(
      (a, b) =>
        (a.pass.coversDays[0] ?? "").localeCompare(b.pass.coversDays[0] ?? "") ||
        a.amount - b.amount,
    )
    .map(({ pass }) => pass);

  const musicStyles = festivalDetail?.identity.musicStyles ?? [];

  const posterUrl = festivalDetail?.identity.posterUrl ?? festival?.poster_url ?? null;

  // P5 festival video / aftermovie — first playable URL (YouTube/Vimeo/direct).
  const festivalVideo = pickPlayableVideo(festivalDetail?.identity.videoUrls ?? null);

  // Flyer gallery for the lightbox: poster first, then the day/gallery images, deduped.
  const galleryImages = Array.from(
    new Set(
      [posterUrl, ...(festivalDetail?.identity.galleryUrls ?? [])].filter(
        (u): u is string => Boolean(u),
      ),
    ),
  );

  // Keyboard controls for the flyer lightbox (Esc closes, arrows navigate).
  useEffect(() => {
    if (lightboxIndex === null || galleryImages.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null);
      else if (e.key === "ArrowRight")
        setLightboxIndex((i) => (i === null ? i : (i + 1) % galleryImages.length));
      else if (e.key === "ArrowLeft")
        setLightboxIndex((i) =>
          i === null ? i : (i + galleryImages.length - 1) % galleryImages.length,
        );
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, galleryImages.length]);



  // Description preview -- first paragraph or first ~220 chars, whichever shorter

  const fullDescription = festivalDetail?.identity.description ?? festival?.description ?? null;

  const descPreview = useMemo(() => {

    if (!fullDescription) return null;

    const firstPara = fullDescription.split(/\n\s*\n/)[0].trim();

    if (firstPara.length <= 240) return firstPara;

    return firstPara.slice(0, 240).trimEnd() + "\u2026";

  }, [fullDescription]);

  const hasMoreDescription = Boolean(fullDescription && descPreview && fullDescription.trim() !== descPreview.trim());



  // P2: structured "What's included" bullets parsed from description

  const includedItems = useMemo(() => parseIncludedItems(fullDescription), [fullDescription]);



  // Derive each teacher's primary style by tallying sessions they teach

  // (most-frequent session.style wins). Falls back to the festival's first

  // music_style if no styled sessions are found.

  const teacherStyles = useMemo(() => {

    const schedule = festivalDetail?.schedule ?? [];

    const tally: Record<string, Record<string, number>> = {};

    schedule.forEach((session) => {

      const style = session.style;

      if (!style) return;

      session.instructors.forEach((i) => {

        if (!i.id) return;

        if (!tally[i.id]) tally[i.id] = {};

        tally[i.id][style] = (tally[i.id][style] ?? 0) + 1;

      });

    });

    const result: Record<string, string> = {};

    Object.entries(tally).forEach(([teacherId, styleCounts]) => {

      const sorted = Object.entries(styleCounts).sort((a, b) => b[1] - a[1]);

      if (sorted[0]) result[teacherId] = sorted[0][0];

    });

    return result;

  }, [festivalDetail]);



  // Hero subtitle -- dance style(s) + audience level summary (P6)

  const heroSubtitle = useMemo(() => {

    const stylesRaw = festivalDetail?.identity.musicStyles ?? [];

    const styleText = stylesRaw.length > 0

      ? stylesRaw.map((s) => s.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())).join(" \u00d7 ")

      : null;

    const schedule = festivalDetail?.schedule ?? [];

    const levelSet = new Set<string>();

    schedule.forEach((s) => (s.levels ?? []).forEach((l) => levelSet.add(l)));

    let levelText: string | null = null;

    if (levelSet.size > 0) {

      const hasOpen = levelSet.has("open_level");

      const hasIntPlus = levelSet.has("intermediate") || levelSet.has("advanced");

      const hasBeg = levelSet.has("beginner") || levelSet.has("improver");

      if (hasOpen && hasIntPlus) levelText = "Open level + intermediate+ Masterclasses";

      else if (hasOpen && hasBeg) levelText = "Beginner to open level";

      else if (hasOpen) levelText = "Open level";

      else if (hasIntPlus && hasBeg) levelText = "All levels";

      else if (hasIntPlus) levelText = "Intermediate+";

      else if (hasBeg) levelText = "Beginner / improver";

    }

    if (!styleText && !levelText) return null;

    return { styleText, levelText };

  }, [festivalDetail]);



  // Title split -- break long names across lines

  const titleLines = useMemo(() => {

    const name = festivalDetail?.identity.name ?? festival?.name ?? "";

    return splitTitleIntoLines(name);

  }, [festivalDetail, festival]);



  if (isFestivalLoading) {

    return (

      <div className="min-h-screen pt-[84px] pb-24 bg-black">

        <div className="max-w-4xl mx-auto px-4 space-y-4 mt-4">

          <Skeleton className="h-72 w-full rounded-2xl" />

          <Skeleton className="h-24 w-full rounded-2xl" />

          <div className="grid grid-cols-2 gap-4">

            <Skeleton className="h-40 rounded-2xl" />

            <Skeleton className="h-40 rounded-2xl" />

          </div>

          <Skeleton className="h-48 w-full rounded-2xl" />

        </div>

      </div>

    );

  }



  if (!festival) {

    return (

      <div className="min-h-screen flex items-center justify-center bg-black text-white">

        <div className="text-center">

          <h1 className="text-xl font-bold">Festival not found</h1>

          <Button onClick={() => navigate("/festivals")} className="mt-4">

            Back to Festivals

          </Button>

        </div>

      </div>

    );

  }



  const venueStation = venue?.nearestStation ?? null;

  const venueCapacity = venue?.capacity ?? null;

  const venueFloor = venue?.floorType ?? null;

  const organiserBio = organiserStats?.bio ?? null;

  const organiserEventCount = organiserStats?.eventCount ?? 0;



  return (

    <div className="cinematic-festival min-h-screen pb-24 pt-0">

      <style dangerouslySetInnerHTML={{ __html: CINEMATIC_CSS }} />




      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildEventJsonLd({
              name: festivalDetail?.identity.name ?? festival.name,
              // Surface-aware URL: the same festival serves at /event/<slug>
              // (its sitemap-canonical URL) AND /festival/<slug>, and JSON-LD
              // url must agree with each surface's canonical. Only the PREFIX
              // comes from the router pathname (identical server/client); the
              // slug stays resolved -- reading the whole pathname emitted the
              // uuid path on the server and the slug path on the client (#418).
              url: `${SITE_ORIGIN}${pathname.startsWith("/event/") ? "/event" : "/festival"}/${resolvedSlug ?? festival.id}`,
              // Real UTC instants (pre-brand this shipped the naive local-as-UTC
              // stamp: Google read startDate 1h late all BST season).
              startDate: startIso ?? "",
              isCancelled,
              endDate: endIso,
              description:
                festivalDetail?.identity.description ?? festival.description ?? null,
              image: posterUrl ? [posterUrl] : null,
              venue: venue
                ? {
                    name: venue.name,
                    address: venue.address,
                    city: festivalDetail?.location.city?.name ?? festival.city,
                  }
                : { city: festivalDetail?.location.city?.name ?? festival.city },
              organiser: organiser
                ? {
                    name: organiser.displayName ?? "Bachata Calendar",
                    url: organiser.href,
                  }
                : null,
              performers: [
                ...allTeachers.map((p) => ({
                  name: p.displayName ?? "",
                  type: "Person" as const,
                })),
                ...(festivalDetail?.lineup.djs ?? []).map((p) => ({
                  name: p.displayName ?? "",
                  type: "Person" as const,
                })),
              ],
              offers: passes.map((p) => ({
                url: ticketUrl,
                name: p.name,
                price: p.price,
                currency: p.currency ?? "GBP",
              })),
            }),
          ),
        }}
      />


      {isCancelled && <EventCancelledBanner reasonLabel={cancellationReasonLabel} />}

      {/* HERO */}

      <section className="hero">

        {galleryImages.length > 0 && (
          <FestivalStoriesCover
            images={galleryImages}
            title={festival.name}
            onExpand={(i) => setLightboxIndex(i)}
            paused={lightboxIndex !== null}
          />
        )}

        {organiser?.displayName && <div className="hero-pre">{organiser.displayName} Presents</div>}

        <h1>

          {titleLines.map((line, i) => (

            <span key={i} className={i === 1 ? "out" : ""}>

              {line}

              {i < titleLines.length - 1 && <br />}

            </span>

          ))}

        </h1>

        {festivalDetail?.identity.edition && (

          <div className="hero-tag">&mdash; {festivalDetail.identity.edition.toUpperCase()} &mdash;</div>

        )}



        {/* Hero subtitle: style + level (P6) */}

        {heroSubtitle && (

          <div className="hero-subtitle">

            {heroSubtitle.styleText && <><b>{heroSubtitle.styleText}</b><br /></>}

            {heroSubtitle.levelText && <span>{heroSubtitle.levelText}</span>}

          </div>

        )}



        {/* Date line + days-away (P2 -- the tile row is retired) */}

        {heroDateLine && (

          <>

            <div className="hero-dateline">{heroDateLine}</div>

            {/* Always-rendered line box: the box itself must be in the server
                HTML either way, or its pop-in shifts the Get Tickets CTA under
                the tap.

                The LABEL is clock-derived, so it renders only when doing so is
                safe on this render -- see `canRenderClockDerived`. */}

            <div className="hero-days-away">
              {(canRenderClockDerived && heroDayStatus?.label) || "\u00A0"}
            </div>

          </>

        )}



        {/* CTAs */}

        <div className="hero-cta">

          {ticketUrl ? (

            <a href={ticketUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">

              Get Tickets

            </a>

          ) : (

            <button type="button" className="btn btn-primary" disabled style={{ opacity: 0.5, cursor: "not-allowed" }}>

              Tickets TBA

            </button>

          )}

          

        </div>

        {calUrls && (
          <div className="cal-cta">
            <details className="cal-wrap cal-wrap-desktop">
              <summary className="cal-pill" aria-label="Add to calendar" title="Add to calendar">
                <svg className="cal-pill-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                <span>Add to Calendar</span>
              </summary>
              <div className="cal-menu">
                <a href={calUrls.google} target="_blank" rel="noopener noreferrer">
                  <div className="cal-ico">G</div>
                  <span>Google Calendar</span>
                  <span className="cal-arr">&#8599;</span>
                </a>
                <a href={calUrls.outlook} target="_blank" rel="noopener noreferrer">
                  <div className="cal-ico">O</div>
                  <span>Outlook</span>
                  <span className="cal-arr">&#8599;</span>
                </a>
              </div>
            </details>
            <button
              type="button"
              className="cal-pill cal-mobile-trigger"
              aria-haspopup="dialog"
              onClick={() => setIsCalSheetOpen(true)}
            >
              <svg className="cal-pill-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
              <span>Add to Calendar</span>
            </button>
          </div>
        )}

        <FestivalPromoBanner codes={festivalDetail?.promoCodes ?? []} />

      </section>




      {/* LINEUP */}

      {teachers.length > 0 && (

        <section className="lineup">
        <div className="nl-head">
          <h2 className="nl-title">Headliners</h2>
          <hr className="neon-rule" />
          <span className="nl-count">{teachers.length} {teachers.length === 1 ? "Act" : "Acts"}</span>
        </div>
        <div className="nl-grid">
          {teachers.map((teacher) => {
            const styleLabel = teacher.id && teacherStyles[teacher.id]
              ? teacherStyles[teacher.id]
              : musicStyles[0] ?? "Lineup";
            const initial = (teacher.displayName || "?").charAt(0).toUpperCase();
            const inner = (
              <>
                {teacher.avatarUrl ? (
                  <div className="nl-img" style={{ backgroundImage: cssUrl(teacher.avatarUrl, 160) }} />
                ) : (
                  <div className="nl-img no-photo"><span className="initial">{initial}</span></div>
                )}
                <div className="nl-scrim" />
                <div className="nl-meta">
                  <div className="nl-name">{teacher.displayName ?? "Artist"}</div>
                  <div className="nl-style">{styleLabel}</div>
                </div>
              </>
            );
            return teacher.href ? (
              <Link key={teacher.id} to={teacher.href} className="nl-frame">{inner}</Link>
            ) : (
              <div key={teacher.id} className="nl-frame">{inner}</div>
            );
          })}
        </div>
      </section>

      )}

      {/* AFTERMOVIE / VIDEO — dedicated section (not the cover). Renders only
          when the festival series has a playable video URL. */}
      {festivalVideo && (
        <section className="lineup">
          <div className="nl-head">
            <h2 className="nl-title">Aftermovie</h2>
            <hr className="neon-rule" />
          </div>
          <div className="mx-auto aspect-video w-full max-w-3xl overflow-hidden rounded-xl border border-white/10 bg-black">
            <VideoEmbed
              video={festivalVideo}
              poster={posterUrl}
              title={festivalDetail?.identity.name ?? festival?.name ?? "Festival"}
            />
          </div>
        </section>
      )}

      {/* PROGRAMME / SCHEDULE */}

      {days.length > 0 && hours.length > 0 && (

        <section className="program">

          <div className="program-wrap">

            <div className="section-h">

              <div className="lab">Programme</div>

              <h2>The Schedule.</h2>

              <div className="sub">{days.length} {days.length === 1 ? "Day" : "Days"}</div>

            </div>



            {/* Mobile day-tabs (P3: with session counts + all-days toggle) */}

            <div className="all-days-toggle">

              {/* A plain ACTION button, not a toggle-state one. The label always
                  names what tapping DOES -- "Single day" while the all-days view
                  is up, "View all N days" otherwise -- so an `aria-pressed` on
                  top of it contradicted the name it sat on: with the all-days
                  view showing, a screen reader announced "Single day, pressed",
                  i.e. that single-day was ON when it is the thing that is off.
                  The name carries the whole meaning; the state attribute only
                  ever fought it.

                  AND THE SAME GOES FOR THE VISUAL CHANNEL. This carried
                  `className={showAllDays ? "active" : ""}` alongside the
                  aria-pressed, painting `.all-days-toggle button.active`'s
                  orange "on" treatment on a button reading "Single day" while
                  the all-days grid was up -- telling a sighted reader exactly
                  what the attribute told a screen-reader one. Removing one
                  channel and leaving the other would have been half a fix, so
                  the class and its now-dead rule go with it. */}
              <button

                type="button"

                onClick={() => setShowAllDays((v) => !v)}

              >

                {showAllDays ? "Single day" : `View all ${days.length} days`}

              </button>

            </div>

            <div className="day-mobile-tabs" hidden={showAllDays} aria-hidden={showAllDays}>

              {days.map((day, i) => {

                const label = formatWallClockLocalIntl(day, { weekday: "short", day: "numeric" }) ?? "";

                // Compare KEYS, not the branded values. `day` is now rebuilt
                // from the span, so it is a date-only WallClock that need not
                // be byte-identical to the schedule's own `s.day` (which can
                // carry a time suffix -- sniffIsFestival guards for exactly
                // that shape). `===` silently read 0 for every tab beside a
                // visibly populated column; the grid cells were unaffected
                // because they already route through wallClockDateKey.
                const dayKey = wallClockDateKey(day);
                const count = (festivalDetail?.schedule ?? []).filter(
                  (s) => wallClockDateKey(s.day) === dayKey,
                ).length;

                const isToday = canRenderClockDerived && wallClockDateKey(day) === todayKey;

                return (

                  <button

                    key={wallClockDateKey(day) ?? `day-${i}`}

                    className={`day-tab ${activeDayIdx === i ? "active" : ""} ${isToday ? "today" : ""}`}

                    onClick={() => setPickedDayIdx(i)}

                  >

                    {label}<span className="day-tab-count">&middot; {count}</span>

                    {isToday && <span className="day-tab-today">Today</span>}

                  </button>

                );

              })}

            </div>



            {showAllDays && days.length > 1 && (
              <div className="tl-swipe-hint" aria-hidden="true">
                <span>&laquo;</span><span>swipe to change day</span><span>&raquo;</span>
              </div>
            )}

            {/* Table-grid: Time x Days */}

            <div className="tl-grid-wrap" style={{ "--days": days.length } as CSSProperties}>

              <div className="tl-header" style={{ gridTemplateColumns: `90px repeat(${days.length}, 1fr)` }}>

                <div className="tl-time-h">Time</div>

                {days.map((day, i) => {

                  const weekday = formatWallClockLocalIntl(day, { weekday: "short" }) ?? "";

                  const dayNum = formatWallClockLocalIntl(day, { day: "numeric" }) ?? "";

                  const monthShort = formatWallClockLocalIntl(day, { month: "short" }) ?? "";

                  const isToday = canRenderClockDerived && wallClockDateKey(day) === todayKey;

                  return (

                    <div key={wallClockDateKey(day) ?? `day-${i}`} className={`tl-day ${isToday ? "today" : ""}`}>

                      <span className="name">{weekday}</span>

                      <div className="date">{dayNum}<span className="lbl">{monthShort}</span></div>

                      {isToday && <span className="tl-day-today">Today</span>}

                    </div>

                  );

                })}

              </div>



              {/* `data-day` is STATE, not a style hook for the open column any
                  more -- the CSS reads only `[data-day="all"]` (which view is
                  up), never the index. The index is still stamped because it is
                  the one place the chosen column is observable from the served
                  HTML, which is what the SSR default-day gate asserts on. */}
              <div className="tl-body" data-day={showAllDays ? "all" : String(activeDayIdx)}>

                {hours.map((hour) => (

                  <div key={hour} className="tl-row" style={{ gridTemplateColumns: `90px repeat(${days.length}, 1fr)` }}>

                    <div className="tl-time">{String(hour).padStart(2, "0")}:00</div>

                    {days.map((day, dayIdx) => {

                      const sessions = sessionsByDayHour[`${wallClockDateKey(day) ?? ''}-${hour}`] ?? [];

                      return (

                        // THE OPEN COLUMN, stamped where it is KNOWN. `dayIdx`
                        // and `activeDayIdx` are both in scope right here, so
                        // the cell can say whether it is the open one instead
                        // of the stylesheet counting child positions from the
                        // ancestor -- which is what forced an enumeration, and
                        // with it a ceiling, a fallback and a disabled toggle.
                        // `|| undefined` so the attribute is ABSENT rather than
                        // `data-open="false"` on closed cells: the CSS matches
                        // on presence (`:not([data-open])`), and an attribute
                        // that were always present would match every column and
                        // hide none -- failing open, the exact mode this
                        // replaced. See CINEMATIC_CSS.
                        <div
                          key={wallClockDateKey(day) ?? `day-${dayIdx}`}
                          className="slot"
                          data-open={dayIdx === activeDayIdx || undefined}
                        >

                          {sessions.map((s, idx) => {

                            const cls = s.isMasterclass ? "master" : s.type === "party" ? "party" : "";

                            const pillLabel = s.isMasterclass ? "Master" : s.type === "party" ? "Party" : "Class";

                            const instructors = s.instructors.map((i) => i.displayName).filter(Boolean).join(" \u00b7 ");

                            const startTimeStr = formatWallClockTime(s.startTime, { hour12: false }) ?? "";

                            const endTimeStr = formatWallClockTime(s.endTime, { hour12: false }) ?? "";

                            const dur = endTimeStr ? `${startTimeStr} \u2014 ${endTimeStr}` : startTimeStr;

                            const levels = s.levels.length > 0 ? s.levels.map((l) => l.replace(/_/g, " ")).join(", ") : null;

                            return (

                              <div key={s.id ?? idx} className={`session ${cls}`}>

                                <span className="s-pill">{pillLabel}</span>

                                <div className="s-title">{s.title}</div>

                                <div className="s-meta">

                                  {instructors && <span>{instructors}</span>}

                                  {levels && <span className="tag">{levels}</span>}

                                </div>

                                <div className="s-duration">{dur}</div>

                              </div>

                            );

                          })}

                        </div>

                      );

                    })}

                  </div>

                ))}

              </div>

            </div>



            <div className="legend">

              <div className="legend-item class"><span className="swatch" />Class</div>

              <div className="legend-item master"><span className="swatch" />Masterclass</div>

              <div className="legend-item party"><span className="swatch" />Party</div>

            </div>

          </div>

        </section>

      )}



      {/* VENUE + ORGANISER */}

      <section className="vo">

        <div className="vo-wrap">

          <div className="vo-grid">



            {venue && (

              <div className="vo-col">

                <div className="section-h"><div className="lab">&mdash; THE VENUE &mdash;</div></div>

                <a href={`/venue-entity/${venue.id}`} className="v-card">

                  <div className="v-photo">

                    {venue.imageUrl ? (

                      <div className="v-img" style={{ backgroundImage: cssUrl(venue.imageUrl, 480) }} />

                    ) : (

                      <div className="v-img no-photo" />

                    )}

                    {(() => {

                      const extras = (venueGallery ?? []).filter((u) => u && u !== venue.imageUrl);

                      if (extras.length === 0) return null;

                      return (

                        <div className="v-photo-extra" style={{ backgroundImage: cssUrl(extras[0], 320) }} aria-hidden="true" />

                      );

                    })()}

                    <div className="v-tag">&#9733; FESTIVAL HOST</div>

                  </div>

                  <div className="v-body">

                    <div className="v-eyebrow">The studio</div>

                    <h3 className="v-name">{venue.name}</h3>

                    {venue.address && <div className="v-addr">{venue.address}</div>}

                    <div className="v-stats">

                      {venueCapacity && (

                        <div className="v-stat">

                          <span className="n">{venueCapacity.toLocaleString()}</span>

                          <span className="l">cap</span>

                        </div>

                      )}

                      {venueStation?.walkingMinutes && (

                        <div className="v-stat">

                          <span className="n">{venueStation.walkingMinutes}</span>

                          <span className="l">min {resolveTransportMode(venueStation.mode).isWalk ? 'walk to' : 'from'} {venueStation.station}</span>

                        </div>

                      )}

                      {venueFloor && (

                        <div className="v-stat">

                          <span className="n">{venueFloor.toUpperCase()}</span>

                          <span className="l">floor</span>

                        </div>

                      )}

                    </div>

                  </div>

                  <div className="v-cta">

                    <span className="lbl">VISIT</span>

                    <span className="word">VENUE</span>

                    <span className="arr">&rarr;</span>

                  </div>

                </a>

              </div>

            )}



            {organiser && (

              <div className="vo-col">

                <div className="section-h"><div className="lab">&mdash; THE ORGANISER &mdash;</div></div>

                <a href={`/organisers/${organiser.id}`} className="o-card">

                  <div className="o-avatar-wrap">

                    {organiser.avatarUrl ? (

                      <div className="o-avatar" style={{ backgroundImage: cssUrl(organiser.avatarUrl, 160) }} />

                    ) : (

                      <div className="o-avatar no-photo">{(organiser.displayName || "?").charAt(0)}</div>

                    )}

                  </div>

                  <div className="o-body">

                    <div className="o-eyebrow">Festival organiser</div>

                    <h3 className="o-name">{organiser.displayName ?? "Organiser"}</h3>

                    {organiserBio && <div className="o-bio">{organiserBio}</div>}

                    {organiserEventCount > 0 && (

                      <div className="o-stats">

                        <div className="o-stat">

                          <span className="n">{organiserEventCount}</span>

                          <span className="l">{organiserEventCount === 1 ? "event hosted" : "events hosted"}</span>

                        </div>

                      </div>

                    )}

                  </div>

                  <div className="v-cta">

                    <span className="lbl">VISIT</span>

                    <span className="word">PROFILE</span>

                    <span className="arr">&rarr;</span>

                  </div>

                </a>

              </div>

            )}



          </div>

        </div>

      </section>



      {/* Community — "Join the group chat" band (renders only when a link is set) */}
      <FestivalGroupChatSection url={festivalDetail?.links.groupChatUrl ?? null} />

      {/* FAQ -- renders only when events.faq is populated (P10) */}

      {(() => {

        const raw = (festival as { faq?: string | null } | null)?.faq?.trim() ?? "";

        if (!raw) return null;

        let items: Array<{ q: string; a: string }> = [];

        try {

          const parsed = JSON.parse(raw);

          if (Array.isArray(parsed)) {

            items = parsed

              .map((it: unknown) => {

                const obj = it && typeof it === "object" ? (it as Record<string, unknown>) : {};

                const q = typeof obj.q === "string" ? obj.q : typeof obj.question === "string" ? obj.question : "";

                const a = typeof obj.a === "string" ? obj.a : typeof obj.answer === "string" ? obj.answer : "";

                return { q: q.trim(), a: a.trim() };

              })

              .filter((it) => it.q && it.a);

          }

        } catch {

          items = [{ q: "About this festival", a: raw }];

        }

        if (items.length === 0) return null;

        return (

          <section className="faq">

            <div className="faq-wrap">

              <div className="faq-label">&mdash; Frequently asked &mdash;</div>

              <h2>Good to know.</h2>

              {items.map((it, i) => (

                <details key={i}>

                  <summary>{it.q}</summary>

                  <div className="faq-ans">{it.a}</div>

                </details>

              ))}

            </div>

          </section>

        );

      })()}



      {/* ABOUT -- collapsible description */}

      {fullDescription && (

        <section className="about">
        <div className="about-wrap">
          <hr className="neon-rule nd-rule-top" />
          {includedItems.length > 0 && (
            <div className="about-includes">
              <div className="about-includes-title">What&rsquo;s included</div>
              {includedItems.map((it, i) => (
                <div key={i} className="about-includes-row">
                  <span className="check" aria-hidden="true">&#10003;</span>
                  <span>{it}</span>
                </div>
              ))}
            </div>
          )}
          <div className={`about-text${!descExpanded && hasMoreDescription ? " is-collapsed" : ""}`}>{descExpanded ? fullDescription : descPreview}</div>
          {hasMoreDescription && (
            <button type="button" className="about-toggle" onClick={() => setDescExpanded((v) => !v)}>
              {descExpanded ? "Show less \u2191" : "Read more \u2192"}
            </button>
          )}
          <hr className="neon-rule nd-rule-bottom" />
        </div>
      </section>

      )}



      {/* RAFFLE — festival-native slot-machine band (FestivalRaffleSection.tsx) */}
      <FestivalRaffleSection eventId={festivalId} />

      {/* TICKETS */}
      {(ticketUrl || passes.length > 0) && (
        <section className="tickets">
          <div className="lab">Now Booking</div>
          <h2>Reserve Your Pass.</h2>
          {passes.length > 0 && (
            <div className="ticket-grid">
              {passes.map((pass) => {
                const amount = pass.earlyBirdPrice ?? pass.price;
                const sub = pass.description ?? pass.tier;
                return (
                  <a
                    key={pass.id}
                    href={ticketUrl ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tix"
                  >
                    <div className="n">{pass.name}</div>
                    <div className="p">{amount}</div>
                    {sub && <div className="d">{sub}</div>}
                  </a>
                );
              })}
            </div>
          )}
          {ticketUrl && (
            <div className="end-cta">
              <a href={ticketUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                Get Tickets
              </a>
            </div>
          )}
        </section>
      )}



      <footer>

        <div className="x">
          <div className="x-line x-org">&mdash; {organiser?.displayName ?? "Festival"} &mdash;</div>
          <div className="x-line x-name">{festival.name.replace(/ - /g, " — ")}</div>
        </div>

      </footer>



      {/* Flyer gallery lightbox (poster + day flyers) */}

      {lightboxIndex !== null && galleryImages.length > 0 && createPortal(

        <div className="lf-lightbox" role="dialog" aria-modal="true" aria-label="Festival flyers" onClick={() => setLightboxIndex(null)}>

          <button type="button" className="lf-lb-close" aria-label="Close" onClick={() => setLightboxIndex(null)}>&times;</button>

          {galleryImages.length > 1 && (

            <button type="button" className="lf-lb-nav lf-lb-prev" aria-label="Previous flyer" onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => (i === null ? i : (i + galleryImages.length - 1) % galleryImages.length)); }}>&#8249;</button>

          )}

          <img className="lf-lb-img" src={galleryImages[lightboxIndex]} alt={`${festival.name} flyer ${lightboxIndex + 1} of ${galleryImages.length}`} onClick={(e) => e.stopPropagation()} loading="lazy"/>

          {galleryImages.length > 1 && (

            <button type="button" className="lf-lb-nav lf-lb-next" aria-label="Next flyer" onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => (i === null ? i : (i + 1) % galleryImages.length)); }}>&#8250;</button>

          )}

          {galleryImages.length > 1 && (

            <div className="lf-lb-thumbs" onClick={(e) => e.stopPropagation()}>

              {galleryImages.map((src, i) => (

                <button type="button" key={src} className={`lf-lb-thumb${i === lightboxIndex ? " active" : ""}`} aria-label={`View flyer ${i + 1}`} onClick={() => setLightboxIndex(i)}>

                  <img src={optimizedImageUrl(src, 96)} alt="" loading="lazy"/>

                </button>

              ))}

            </div>

          )}

        </div>,

        document.body,

      )}



      {/* Add-to-Calendar lives in the CTA (.cal-cta); floating FAB removed. */}



      {/* Mobile bottom sheet: add event to calendar (portal so position:fixed escapes the framer-motion ancestor) */}

      {calUrls && isCalSheetOpen && createPortal(

        <div

          className="cal-sheet-backdrop cinematic-festival"

          role="dialog"

          aria-modal="true"

          aria-labelledby="cal-sheet-title"

          onClick={() => setIsCalSheetOpen(false)}

        >

          <div className="cal-sheet" onClick={(e) => e.stopPropagation()}>

            <div className="cal-sheet-handle" aria-hidden="true" />

            <div id="cal-sheet-title" className="cal-sheet-title">Save event</div>

            <div className="cal-sheet-sub">{festival?.name}</div>

            <div className="cal-sheet-opts">

              <button

                type="button"

                className="cal-sheet-opt"

                onClick={() => {

                  // startIso/endIso are real UTC instants, so fmtUtc's Z-form
                  // DTSTART/DTEND now land at the true moment (pre-brand the
                  // naive stamp made .ics entries 1h late all BST season).
                  if (!startIso) return;

                  downloadIcsFile({

                    uid: festival?.id ?? festivalId,

                    title: festival?.name ?? "Festival",

                    description: fullDescription ?? "",

                    location: venue ? `${venue.name}${venue.address ? ", " + venue.address : ""}` : "",

                    startIso: startIso,

                    endIso: endIso ?? startIso,

                    url: window.location.href,

                  });

                  setIsCalSheetOpen(false);

                }}

              >

                <span className="cal-sheet-ico">A</span>

                <span className="cal-sheet-label">Apple Calendar (.ics)</span>

                <span className="cal-sheet-arr">&#8594;</span>

              </button>

              <a

                href={calUrls.google}

                target="_blank"

                rel="noopener noreferrer"

                className="cal-sheet-opt"

                onClick={() => setIsCalSheetOpen(false)}

              >

                <span className="cal-sheet-ico">G</span>

                <span className="cal-sheet-label">Google Calendar</span>

                <span className="cal-sheet-arr">&#8599;</span>

              </a>

              <a

                href={calUrls.outlook}

                target="_blank"

                rel="noopener noreferrer"

                className="cal-sheet-opt"

                onClick={() => setIsCalSheetOpen(false)}

              >

                <span className="cal-sheet-ico">O</span>

                <span className="cal-sheet-label">Outlook</span>

                <span className="cal-sheet-arr">&#8599;</span>

              </a>

            </div>

            <button

              type="button"

              className="cal-sheet-cancel"

              onClick={() => setIsCalSheetOpen(false)}

            >

              Cancel

            </button>

          </div>

        </div>,

        document.body

      )}



      <EventStickyActionBar
        eventId={festivalId || null}
        directionsUrl={directionsUrl}
        ticketUrl={ticketUrl}
        shareTitle={festivalDetail?.identity.name ?? festival?.name ?? "Festival"}
        shareSubtitle={shareSubtitle}
        canAddToCalendar={!!calUrls}
        onAddToCalendar={() => setIsCalSheetOpen(true)}
        accentColor="#fb923c"
      />

    </div>

  );

};



const FestivalDetail = ({ snapshot, serverTodayKey }: FestivalDetailInnerProps) => (

  <PageErrorBoundary>

    <FestivalDetailInner snapshot={snapshot} serverTodayKey={serverTodayKey} />

  </PageErrorBoundary>

);



export default FestivalDetail;

