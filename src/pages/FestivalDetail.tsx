import {
  useState,
  useEffect,
  useMemo,
  useRef,
  // ALIASED, because line ~2300 of this file uses the DOM's global
  // KeyboardEvent on a document listener. An unaliased import would shadow it
  // there with React's synthetic one, and the two are not the same type.
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { createPortal } from "react-dom";

import { PageErrorBoundary } from "@/components/ErrorBoundary";

import { Skeleton } from "@/components/ui/skeleton";

import { useParams, useNavigate, useLocation, Link } from "react-router-dom";

import { Button } from "@/components/ui/button";


import { useEntitySlugOrId, SITE_ORIGIN } from "@/lib/seo";

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

import { EventEndedRecord } from "@/modules/event-page/bento/EventEndedRecord";
import { formatRunRange } from "@/modules/event-page/bento/utils/endedRun";
import { MoreEventsSection } from "@/modules/event-page/sections/MoreEventsSection";
import { endedRunSentence } from "@/modules/event-page/endedShareDescription";

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
  instantToDate,
  wallClockDateKey,
  wallClockHour,
  wallClockTimeKey,
  wallClockToInstant,
  type WallClock,
} from "@/lib/time/wallClock";

import { resolveTransportMode } from "@/lib/transportMode";

import { FestivalStoriesCover } from "@/components/festival/FestivalStoriesCover";

import { FestivalRaffleSection } from "@/modules/event-page/sections/FestivalRaffleSection";
import { FestivalPromoBanner } from "@/modules/event-page/sections/FestivalPromoBanner";

import { FestivalGroupChatSection } from "@/modules/event-page/sections/FestivalGroupChatSection";

import type {
  EventPageSnapshot,
  FestivalScheduleItem,
  FestivalSessionLevel,
} from "@/modules/event-page/types";

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
// THE SINGLE-DAY VIEW NO LONGER WORKS BY HIDING, and this is the note that
// used to say it did. The columns were DAYS: every day was laid out and all
// but one hidden with CSS, so the stylesheet carried the whole burden of
// showing the right one. The columns are ROOMS now, the grid is built for the
// open day alone, and the other days are not hidden -- they are not rendered.
//
// Two consequences worth keeping. First, the count problem is gone at the
// root rather than solved: nothing in this stylesheet needs to know how many
// days a festival has, so a 62-day span (wallClockDateRange's maxDays) plus a
// column per out-of-span session plus the UNDATED bucket cannot produce a rule
// with no match. The enumeration that preceded it -- .tl-body[data-day="0"]
// .."3", one hand-written nth-child pair per index -- failed OPEN, and did so
// on live data: event_program_days has Tunisia Bachata Festival 2026 running
// 2026-09-24..28, five columns, with the default-day effect selecting the
// fifth on the day itself. Do not reintroduce a count in any form.
//
// Second, "the reader is looking at the wrong day" became a REPRESENTABLE
// failure. Under the hide-based grid every day was in the DOM whatever the
// state said, so the only observable was which column was un-hidden; the
// content of the open column could never be wrong. Now each session card is
// stamped with the day index it belongs to, so the gates assert the served
// markup carries the open day's sessions and no others.
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

/* Series-termination arc W14 -- the ended record, in the slot the CTAs vacate.
   Constrained and left-aligned because the card is prose (a date and a
   sentence), and the hero's centred, letter-spaced Bebas treatment is built for
   two-word buttons: a centred paragraph under a 16vw title reads as a caption,
   not a statement. The width bound matches the hero's own text measure. */
.cinematic-festival .hero-ended{margin-top:28px;position:relative;z-index:5;width:100%;max-width:440px;text-align:left}

/* The card ships bento-palette defaults (forest green + brass) and reads each
   colour through an --ended-record-* override. This is that override: the
   cinematic page is black + orange, and the un-overridden card would land a
   ballroom-green tile inside it. Copy and structure stay in the one component. */
.cinematic-festival .ended-record{--ended-record-bg:rgba(255,255,255,0.04);--ended-record-border:rgba(251,146,60,0.32);--ended-record-accent:#fb923c;--ended-record-fg:#fff;--ended-record-fg-muted:rgba(255,255,255,0.72)}

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

/* TIMETABLE -- rooms across, hours down. Light on purpose: see PRODUCT.md. */

.cinematic-festival .program-wrap{--tl-paper:#F2F2EF;--tl-ink:#000;--tl-ink-soft:rgba(0,0,0,0.74);--tl-ink-mute:rgba(0,0,0,0.58);--tl-hdr-bg:#000;--tl-hdr-ink:#fff;--tl-hdr-ink2:rgba(255,255,255,0.78);--tl-edge:#000;--tl-drop:rgba(0,0,0,0.85);--lv-beginner:#15803D;--lv-improver:#0369A1;--lv-intermediate:#C2410C;--lv-advanced:#BE185D;--lv-multi:#0F766E;--lv-open:#6D28D9;--lv-none:#5A6675;--tl-rowh:80px;--tl-gaph:26px;--tl-colw:210px;--tl-tgw:48px;--tl-headh:50px;--tl-boxh:360px}

.cinematic-festival .tl-body{position:relative}

.cinematic-festival .tl-box:focus-visible{outline:3px solid #fb923c;outline-offset:4px}

.cinematic-festival .tl-box{position:relative;overflow:auto;background:var(--tl-paper);border:3px solid var(--tl-edge);box-shadow:8px 8px 0 var(--tl-drop)}

.cinematic-festival .tl-box::-webkit-scrollbar{width:6px;height:6px}

.cinematic-festival .tl-box::-webkit-scrollbar-thumb{background:var(--tl-edge)}

.cinematic-festival .tl-grid{display:grid;min-width:max-content;position:relative}

.cinematic-festival .tl-corner{position:sticky;left:0;top:0;z-index:9;background:var(--tl-hdr-bg)}

/* STICKY ONLY BELOW 901px, and that is a consequence of the settled design,
   not an oversight. .tl-box is given a height (--tl-boxh) only inside the
   <=900px query below, so above that width it grows to fit and its scrollport
   never scrolls on the block axis -- which leaves the top: offset here, and on
   .tl-ev-label, with no scroll range to stick within. On desktop the box opens
   out and the whole day is on the page at once, so there is nothing to stick
   TO; the rules are inert rather than wrong. Giving the box a desktop height
   would make them live again and is a DESIGN decision, not a fix -- do not add
   one here without settling that first.
   NO BACKTICKS IN THIS BLOCK: it lives inside a JS template literal, where a
   backtick ends the string and the parse error lands 3,000 lines away. */
.cinematic-festival .tl-room{position:sticky;top:0;z-index:6;background:var(--tl-hdr-bg);padding:9px 12px;min-height:var(--tl-headh);display:flex;flex-direction:column;justify-content:center}

.cinematic-festival .tl-room-name{color:var(--tl-hdr-ink);text-transform:uppercase;font-size:12px;font-weight:800;letter-spacing:0.05em;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

.cinematic-festival .tl-room-count{color:var(--tl-hdr-ink2);font-size:11.5px;font-weight:600;line-height:1.25;margin-top:1px}

.cinematic-festival .tl-hour{position:sticky;left:0;z-index:4;background:var(--tl-paper);color:var(--tl-ink);font-weight:800;font-size:12px;padding:7px 8px 0 0;text-align:right}

.cinematic-festival .tl-cellbg{border-top:1px solid var(--tl-edge)}

.cinematic-festival .tl-gap{position:sticky;left:0;display:flex;align-items:center}

.cinematic-festival .tl-gap::before{content:'';position:absolute;left:12px;right:12px;top:50%;border-top:1px dashed var(--tl-ink-mute)}

.cinematic-festival .tl-gap span{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;color:var(--tl-ink-soft);background:var(--tl-paper);padding:0 10px;position:sticky;left:calc(var(--tl-tgw) + 5px);z-index:2}

/* Session card. NO overflow:hidden -- a clipping ancestor kills the sticky
   label outright, which is the whole reason the label can float. */

.cinematic-festival .tl-ev{position:relative;z-index:3;margin:4px;background:var(--lv-none);border:2px solid var(--tl-edge);box-shadow:3px 3px 0 var(--tl-drop);padding:9px 11px;align-self:stretch;transition:transform .12s ease,box-shadow .12s ease}

.cinematic-festival .tl-ev.l-beginner{background:var(--lv-beginner)}
.cinematic-festival .tl-ev.l-improver{background:var(--lv-improver)}
.cinematic-festival .tl-ev.l-intermediate{background:var(--lv-intermediate)}
.cinematic-festival .tl-ev.l-advanced{background:var(--lv-advanced)}
.cinematic-festival .tl-ev.l-multi{background:var(--lv-multi)}
.cinematic-festival .tl-ev.l-open{background:var(--lv-open)}

.cinematic-festival .tl-ev-label{position:sticky;top:var(--tl-headh);z-index:2;display:flex;flex-direction:column;gap:3px}

.cinematic-festival .tl-ev-who{color:#fff;font-weight:800;font-size:14px;text-transform:uppercase;line-height:1.14}

.cinematic-festival .tl-ev-what{color:#fff;font-weight:700;font-size:12px;line-height:1.28}

.cinematic-festival .tl-ev-meta{color:#fff;font-weight:700;font-size:11.5px;letter-spacing:0.02em}

.cinematic-festival .tl-ev-tags{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:4px}

.cinematic-festival .tl-ev-tag{display:inline-block;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.07em;background:var(--tl-edge);color:var(--tl-paper);padding:2px 8px}

.cinematic-festival .tl-ev-tag.ghost{background:transparent;color:var(--tl-edge);box-shadow:inset 0 0 0 2px var(--tl-edge)}

.cinematic-festival .tl-ev-roster i.more{font-style:italic;font-weight:600;opacity:0.85}

.cinematic-festival .tl-ev-roster{margin-top:7px;padding-top:7px;border-top:2px solid rgba(0,0,0,0.4);display:flex;flex-direction:column;gap:2px}

.cinematic-festival .tl-ev-roster b{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.07em;color:#fff;margin-bottom:2px}

.cinematic-festival .tl-ev-roster i{font-style:normal;font-size:12.5px;font-weight:700;color:#fff;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* Over three hours: wash the colour back so a long social reads as a backdrop
   rather than a wall. A LAYERED GRADIENT, not color-mix() -- if color-mix is
   unsupported the declaration is dropped and the card keeps a saturated
   background under ink recoloured for a washed one, i.e. dark on dark. */

.cinematic-festival .tl-ev.long{background-image:linear-gradient(0deg,rgba(242,242,239,0.74) 0,rgba(242,242,239,0.74) 100%);border-left-width:8px}

.cinematic-festival .tl-ev.long .tl-ev-who,.cinematic-festival .tl-ev.long .tl-ev-what,.cinematic-festival .tl-ev.long .tl-ev-meta,.cinematic-festival .tl-ev.long .tl-ev-roster b,.cinematic-festival .tl-ev.long .tl-ev-roster i{color:var(--tl-ink)}

.cinematic-festival .tl-ev.long .tl-ev-roster{border-top-color:rgba(0,0,0,0.35)}

/* Empty day -- a real state, not a blank grid. */

.cinematic-festival .tl-empty{background:var(--tl-paper);border:3px solid var(--tl-edge);box-shadow:8px 8px 0 var(--tl-drop);padding:26px 18px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;min-height:180px}

.cinematic-festival .tl-empty-mark{font-size:30px;line-height:1;color:var(--tl-ink);margin-bottom:8px}

.cinematic-festival .tl-empty-title{font-size:19px;font-weight:800;color:var(--tl-ink);text-transform:uppercase;line-height:1.15}

.cinematic-festival .tl-empty-body{font-size:13.5px;font-weight:500;color:var(--tl-ink-soft);margin-top:8px;line-height:1.5;max-width:34ch}

.cinematic-festival .tl-note{display:flex;justify-content:space-between;padding:9px 3px 0}

.cinematic-festival .tl-note span{font-size:12px;font-weight:600;color:rgba(255,255,255,0.62)}

.cinematic-festival .legend{display:flex;justify-content:center;gap:16px;margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.12);flex-wrap:wrap}

.cinematic-festival .legend-item{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:rgba(255,255,255,0.78)}

.cinematic-festival .legend-item .swatch{width:11px;height:11px;display:block;background:var(--lv-none);border:1px solid rgba(255,255,255,0.35)}

.cinematic-festival .legend-item.l-beginner .swatch{background:var(--lv-beginner)}
.cinematic-festival .legend-item.l-improver .swatch{background:var(--lv-improver)}
.cinematic-festival .legend-item.l-intermediate .swatch{background:var(--lv-intermediate)}
.cinematic-festival .legend-item.l-advanced .swatch{background:var(--lv-advanced)}
.cinematic-festival .legend-item.l-multi .swatch{background:var(--lv-multi)}
.cinematic-festival .legend-item.l-open .swatch{background:var(--lv-open)}

@media (hover:hover){
  .cinematic-festival .tl-ev:hover{transform:translate(-1px,-1px);box-shadow:5px 5px 0 var(--tl-drop)}
}

/* Keep the state change, drop the travel -- killing the feedback outright is
   the usual over-correction here. */

@media (prefers-reduced-motion:reduce){
  .cinematic-festival .tl-ev{transition:box-shadow .12s ease}
  .cinematic-festival .tl-ev:hover{transform:none;box-shadow:5px 5px 0 var(--tl-drop)}
}



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

  /* THE TRAPPED BOX. Mobile only: a fixed height plus overscroll-behavior so
     the timetable never scrolls the page underneath it, on either axis. The
     desktop rule is the ABSENCE of these -- the box opens out to its full
     height, which is why they must stay inside this media block. */

  .cinematic-festival .tl-box{height:var(--tl-boxh);overscroll-behavior:none;-webkit-overflow-scrolling:touch}

  .cinematic-festival .program{padding:36px 16px}

  .cinematic-festival .tl-ev-who{font-size:13px}

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




/* === Day picker ========================================== */

.cinematic-festival .day-picker{display:flex;gap:8px;overflow-x:auto;padding:13px 0 15px;scrollbar-width:none;-webkit-overflow-scrolling:touch}

.cinematic-festival .day-picker::-webkit-scrollbar{display:none}

.cinematic-festival .day-tab{flex:0 0 auto;display:flex;align-items:baseline;gap:7px;min-height:46px;padding:10px 15px;border-radius:999px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.16);color:#fff;cursor:pointer;font:inherit;transition:background .15s,border-color .15s}

.cinematic-festival .day-tab-wd{font-size:12px;font-weight:600;color:rgba(255,255,255,0.82)}

.cinematic-festival .day-tab-num{font-size:18px;font-weight:800;letter-spacing:-0.02em}

.cinematic-festival .day-tab-count{font-size:12px;font-weight:600;color:rgba(255,255,255,0.74)}

.cinematic-festival .day-tab.active{background:#fff;border-color:#fff;color:#111}

.cinematic-festival .day-tab.active .day-tab-wd{color:#3A3A3A}

.cinematic-festival .day-tab.active .day-tab-count{color:#4A4A4A}

.cinematic-festival .day-tab.today:not(.active){border-color:#fb923c}

.cinematic-festival .day-tab-today{font-size:11px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;color:#111;background:#fb923c;border-radius:99px;padding:2px 8px;align-self:center}

.cinematic-festival .day-tab.active .day-tab-today{background:#111;color:#fb923c}

.cinematic-festival .day-tab:focus-visible{outline:3px solid #fb923c;outline-offset:3px}



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
// ---------------------------------------------------------------------------
// Timetable model -- rooms across, hours down, ONE DAY at a time.
// ---------------------------------------------------------------------------
// Pure and module-scoped, so every decision about lanes, spans and gaps can be
// read without rendering the page. The renderer below only turns what this
// returns into grid coordinates; it makes no layout decisions of its own.
//
// The columns are ROOMS, not days -- that is the whole shape change. A festival
// runs several rooms at once and the reader's question is "what is on at
// 16:00", which a day-per-column grid cannot answer at all. A festival that has
// published NO rooms renders exactly one column, and that is CORRECT rather
// than a case to design around: Tunisia Bachata Festival 2026 carries 14
// programme items with room empty and levels empty on every one of them, so one
// grey column is a true rendering of what the organiser has published. Inventing
// a room or a level there would put false information on a public page.

// The order is the SOURCE and the union is derived from it, not the other way
// round. Written as two lists, adding a level and forgetting the array leaves
// `indexOf` returning -1, which sorts the new level silently to the FRONT of
// the legend instead of failing to compile.
const TIMETABLE_LEVEL_ORDER = [
  "beginner",
  "improver",
  "intermediate",
  "advanced",
  "multi",
  "open",
  "none",
] as const;

type TimetableLevelKey = (typeof TIMETABLE_LEVEL_ORDER)[number];

// The spelling the other four surfaces already use (ScheduleBlock, PeopleStack,
// FestivalProgramSection): the same session must not read differently on
// /festival/:id than it does on /event/:slug.
const LEVEL_LABEL_FULL: Record<FestivalSessionLevel, string> = {
  beginner: "Beginner",
  improver: "Improver",
  intermediate: "Intermediate",
  advanced: "Advanced",
  open_level: "Open Level",
};

/** The four NAMED levels, in canonical order -- `open_level` is not one of them. */
const NAMED_LEVELS = ["beginner", "improver", "intermediate", "advanced"] as const;

// Colour is BY LEVEL, and the legend beneath the grid has to stay honest about
// it -- so a session carrying more than one level is not painted as its first
// one. It reads "All levels" and shares the open-level swatch. A session with no
// level is grey and says so; nothing is inferred.
const timetableLevel = (
  levels: FestivalSessionLevel[],
): { key: TimetableLevelKey; label: string } => {
  if (levels.length === 0) return { key: "none", label: "No level set" };

  // THE CONTRACT IS IN `FestivalScheduleItem.levels`: "All four named = 'All
  // levels'. `open_level` alone = 'Open Level'." Reading ANY multi-level
  // session as "All levels" advertised a beginner+improver class as open to
  // advanced dancers -- false information about a real event, on a public page.
  // A partial set is listed as what it is.
  const named = NAMED_LEVELS.filter((l) => levels.includes(l));
  if (levels.includes("open_level")) return { key: "open", label: "Open Level" };
  if (named.length === NAMED_LEVELS.length) return { key: "open", label: "All levels" };
  if (named.length > 1) {
    return { key: "multi", label: named.map((l) => LEVEL_LABEL_FULL[l]).join(", ") };
  }
  // `levels` non-empty but carrying nothing recognisable: say nothing rather
  // than pick one. Unreachable through the codec, and not worth a lie if it is.
  if (named.length === 0) return { key: "none", label: "No level set" };
  return { key: named[0], label: LEVEL_LABEL_FULL[named[0]] };
};

/** Minutes since midnight of a stored wall clock, read as-stored. */
const wallClockMinutes = (wc: WallClock | null | undefined): number | null => {
  const key = wallClockTimeKey(wc);
  if (!key) return null;
  const hh = Number(key.slice(0, 2));
  const mm = Number(key.slice(3, 5));
  return Number.isFinite(hh) && Number.isFinite(mm) ? hh * 60 + mm : null;
};

const minutesToHHMM = (m: number): string =>
  `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

const DEFAULT_SESSION_MINUTES = 60;
const LONG_SESSION_MINUTES = 180;

// The longest a session may run PAST MIDNIGHT before the wrap is read as a data
// fault rather than an all-nighter. A 9-hour 21:00-06:00 party is real; a
// 23-hour one is a start/end typo, and without this bound it claims every hour
// row on the day.
const MAX_WRAP_MINUTES = 720;

// The programme day runs 08:00 to 07:59 the next morning, which is the axis
// `src/lib/programDayRollover.ts` already puts the DATA on. Hours are
// normalised onto one continuous axis, so a 01:00 session sorts after the
// 23:00 party it follows instead of to the top of the grid -- and shares a row
// with a 23:00-02:00 party that wrapped onto the same hour, rather than
// rendering a second row with the same clock label.
//
// THE BOUNDARY IS 8, NOT 9, and it is not a free choice: `ROLLOVER_HOUR = 8`
// there rolls back sessions starting STRICTLY BEFORE 08:00 ("exclusive of
// 08:00", in its own words), so 08:00-08:59 belongs to its OWN day's morning.
// This constant read 9 while its comment claimed parity with that file, which
// put an 08:30 bootcamp at the BOTTOM of its day behind a fabricated 10-hour
// gap -- the data said morning, the axis said tomorrow.
const DAY_AXIS_START_HOUR = 8;

const roomOf = (item: FestivalScheduleItem): string | null => {
  const raw = item.venueRoom;
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
};

// End time is the field the data is least honest about, so every reading is
// BOUNDED rather than trusted:
//   missing              -> one hour, which occupies exactly one row
//   equal to start       -> unknown, treated as missing. NOT as 24 hours, which
//                           is what a bare `end <= start -> +1 day` rule does to
//                           a 20:00-20:00 row
//   earlier than start   -> an overnight party, wrapped past midnight, UNLESS
//                           the wrap exceeds MAX_WRAP_MINUTES, which reads as a
//                           typo and falls back to the default hour
//
// DURATION IS COMPUTED ON THE RAW CLOCK and the axis shift applied afterwards,
// so the two cannot disagree. An earlier version clamped with
// `Math.min(end, start + 1440)`, which was unreachable in both branches --
// wrapped ends are always under start+1440 by construction, and un-wrapped ones
// are under 1440 outright. It read as a bound and was dead code, so a 10:00 ->
// 09:00 typo still produced a 23-hour card spanning the whole day.
const sessionSpanMinutes = (
  item: FestivalScheduleItem,
): { start: number; end: number; endPublished: boolean } | null => {
  const rawStart = wallClockMinutes(item.startTime);
  if (rawStart === null) return null;
  const rawEnd = wallClockMinutes(item.endTime);

  // `endPublished` SEPARATES THE LAYOUT DECISION FROM THE CLAIM. A session with
  // no end time still needs a height, so it gets DEFAULT_SESSION_MINUTES -- but
  // the organiser published no end, and the card must not print one. Rendering
  // the fallback as a clock range told readers a 20:00 session ends at 21:00 on
  // the sole authority of this constant.
  let duration: number;
  let endPublished: boolean;
  if (rawEnd === null || rawEnd === rawStart) {
    duration = DEFAULT_SESSION_MINUTES;
    endPublished = false;
  } else if (rawEnd > rawStart) {
    duration = rawEnd - rawStart;
    endPublished = true;
  } else {
    const wrapped = rawEnd + 1440 - rawStart;
    // Over the bound the wrap is read as a start/end typo. Rejecting the value
    // is right; asserting a DIFFERENT one in its place is not, so the card
    // falls back to start-only rather than to "start to start+1h".
    endPublished = wrapped <= MAX_WRAP_MINUTES;
    duration = endPublished ? wrapped : DEFAULT_SESSION_MINUTES;
  }

  const start = rawStart < DAY_AXIS_START_HOUR * 60 ? rawStart + 1440 : rawStart;
  return { start, end: start + duration, endPublished };
};

type TimetableRow = { kind: "hour"; hour: number } | { kind: "gap"; hours: number };

type TimetableRoom = {
  name: string | null;
  lanes: number;
  count: number;
  /** 0-based column this room's header starts at; it spans `lanes` of them. */
  startColumn: number;
};

type TimetableCell = {
  key: string;
  item: FestivalScheduleItem;
  room: string | null;
  /** 0-based index into the flattened room/lane column list. */
  column: number;
  /** 0-based indices into `rows`, inclusive at both ends. */
  rowStart: number;
  rowEnd: number;
  startMin: number;
  endMin: number;
  /**
   * Did the ORGANISER publish an end time, or is `endMin` the layout fallback?
   *
   * `endMin` always holds something because a card needs a height. Printing
   * that fallback as a clock range told readers a 20:00 session ends at 21:00
   * on the authority of DEFAULT_SESSION_MINUTES alone. False when no end was
   * published, when end == start, and when the wrap exceeded MAX_WRAP_MINUTES
   * (a rejected end must render as start-only, not as a different wrong end).
   */
  endPublished: boolean;
  isLong: boolean;
  level: { key: TimetableLevelKey; label: string };
  /** "Party" / "Masterclass", or null for an ordinary class. */
  typeTag: string | null;
  /**
   * Whether the card is tall enough for a tag ROW. When false the type is
   * folded into the meta line instead of getting its own 28px band, which a
   * one-row card cannot afford.
   */
  tagRow: boolean;
  /**
   * How many artist names this card has ROOM for.
   *
   * The card must not clip (`overflow:hidden` on it silently disables the
   * sticky label) and it carries `z-index:3`, so a roster longer than the card
   * paints straight over the session below it. A one-hour workshop with four
   * instructors needs ~108px of label inside ~54px of card. Bounding the list
   * here, where the row span is known, is what keeps the card honest without
   * clipping it.
   */
  maxRoster: number;
};

/**
 * The exposed content of the grid, in the order the eye reads it.
 *
 * GAPS AND SESSIONS TOGETHER, because they are the only two things in the grid
 * that are NOT aria-hidden, and DOM order is the order a screen reader and a
 * keyboard walk take. Emitting them in separate passes -- every gap, then every
 * session -- announced "3 hours free, 5 hours free" up front and then the whole
 * day, which is exactly the mismatch the cells' row-then-column sort exists to
 * prevent. One ordering, one pass, both kinds.
 */
type TimetableFlowItem =
  | { kind: "gap"; row: number; column: number; hours: number }
  | { kind: "cell"; row: number; column: number; cell: TimetableCell };

type TimetableLayout = {
  rooms: TimetableRoom[];
  columns: number;
  rows: TimetableRow[];
  cells: TimetableCell[];
  flow: TimetableFlowItem[];
};

const EMPTY_TIMETABLE: TimetableLayout = { rooms: [], columns: 0, rows: [], cells: [], flow: [] };

// What a card of N rows can hold.
//
// EVERY FIGURE HERE WAS MEASURED IN THE BROWSER, not derived. The first attempt
// estimated them and was wrong in both directions -- a three-row card still
// overflowed by 25px and a one-row card by 2px -- which is the whole reason
// these are named constants with a note rather than arithmetic inline.
//
// TIMETABLE_ROW_PX MIRRORS `--tl-rowh` in CINEMATIC_CSS and the two must move
// together; this is the same coupling shape as the `--bento-cell` fallback, and
// it is real: change the CSS row height alone and every tall card silently
// mis-sizes its roster. The rest are the rendered heights of the card's own
// parts at the sizes that stylesheet sets.
const TIMETABLE_ROW_PX = 80;
const CARD_CHROME_PX = 30;
const CARD_FIXED_TEXT_PX = 35;
const CARD_TAG_ROW_PX = 28;
const ROSTER_HEADER_PX = 31;
const ROSTER_LINE_PX = 18;

// A one-row card cannot afford a tag ROW at all -- 15px name + 17px meta + 28px
// tag needs 60px of the 50px such a card has inside its padding. Below this the
// type is folded into the meta line instead, which costs nothing.
const MIN_ROWS_FOR_TAG_ROW = 2;

/**
 * How many roster LINES a card can show, counting the "and N more" line as one
 * of them. Zero means the roster block does not fit and the artist count
 * belongs on the meta line.
 */
const rosterCapacity = (rowSpan: number, hasTagRow: boolean): number => {
  const usable =
    rowSpan * TIMETABLE_ROW_PX -
    CARD_CHROME_PX -
    CARD_FIXED_TEXT_PX -
    (hasTagRow ? CARD_TAG_ROW_PX : 0) -
    ROSTER_HEADER_PX;
  return Math.max(0, Math.floor(usable / ROSTER_LINE_PX));
};

/** One day's sessions, placed into room columns and hour rows. */
const buildTimetableLayout = (items: FestivalScheduleItem[]): TimetableLayout => {
  const timed = items.flatMap((item) => {
    const span = sessionSpanMinutes(item);
    return span ? [{ item, span }] : [];
  });
  if (timed.length === 0) return EMPTY_TIMETABLE;

  // Rooms in FIRST-APPEARANCE order. The RPC already returns programme items in
  // the organiser's own sort_order, so this preserves that rather than imposing
  // an alphabetical order on top of it.
  const hasRooms = timed.some(({ item }) => roomOf(item) !== null);
  const roomNames: (string | null)[] = [];
  if (hasRooms) {
    for (const { item } of timed) {
      const name = roomOf(item);
      if (!roomNames.includes(name)) roomNames.push(name);
    }
  } else {
    roomNames.push(null);
  }

  // Greedy interval partitioning per room: reuse the first lane whose last
  // session has already finished, else open a new one. Exercised by real data,
  // not defensive -- London Latin Fest runs THREE classes at once in a single
  // room on two of its days (16:00 on 24 May, 18:00 on 25 May).
  //
  // PARTITIONED ON HOUR ROWS, NOT ON MINUTES, because the row is the unit this
  // grid can actually place a card in. Partitioning on minutes let two sessions
  // that merely ABUT -- 20:00-20:30 and 20:30-21:00 -- share a lane: neither
  // overlaps in time, so both took lane 0, and both then floored into hour row
  // 20 and the same column. CSS Grid puts identical coordinates in the same
  // area and `.tl-ev` is `align-self:stretch`, so the later card covered the
  // earlier one completely and a session vanished from a public page.
  //
  // Two sessions sharing an hour row therefore need two lanes even when their
  // minutes do not collide. That is the honest rendering while rows are whole
  // hours: they genuinely occupy the same row.
  const groups = roomNames.map((name) => {
    const inRoom = timed
      .filter(({ item }) => roomOf(item) === name)
      .sort((a, b) => a.span.start - b.span.start || a.span.end - b.span.end);

    const laneEndHours: number[] = [];
    const placed = inRoom.map(({ item, span }) => {
      const firstHour = Math.floor(span.start / 60);
      const endHourExclusive = Math.ceil(span.end / 60);
      const found = laneEndHours.findIndex((end) => end <= firstHour);
      const lane = found === -1 ? laneEndHours.length : found;
      laneEndHours[lane] = endHourExclusive;
      return { item, span, lane };
    });

    return { name, placed, lanes: Math.max(laneEndHours.length, 1) };
  });

  // Hours any session touches. Empty hours are absent from this set, which is
  // what lets the run below collapse them into one thin labelled break instead
  // of a stack of blank rows.
  const covered = new Set<number>();
  for (const group of groups) {
    for (const { span } of group.placed) {
      for (let h = Math.floor(span.start / 60); h < Math.ceil(span.end / 60); h += 1) covered.add(h);
    }
  }
  const hours = [...covered].sort((a, b) => a - b);

  const rows: TimetableRow[] = [];
  const rowOfHour = new Map<number, number>();
  hours.forEach((hour, i) => {
    if (i > 0 && hour - hours[i - 1] > 1) rows.push({ kind: "gap", hours: hour - hours[i - 1] - 1 });
    rowOfHour.set(hour, rows.length);
    rows.push({ kind: "hour", hour });
  });

  // A room's lanes are contiguous, so a lane's column IS its room's start
  // column plus the lane index. The lookup Map this replaced was keyed
  // `${gi}:${lane}` and read through a `?? 0` that could never fire -- which
  // reads as a safety net while actually being a silent "put the card in
  // column 0" if lane numbering ever changes. The arithmetic has no
  // unreachable branch to reason about.
  const roomStartColumn: number[] = [];
  let columns = 0;
  groups.forEach((group, gi) => {
    roomStartColumn[gi] = columns;
    columns += group.lanes;
  });

  const cells: TimetableCell[] = [];
  groups.forEach((group, gi) => {
    group.placed.forEach(({ item, span, lane }, pi) => {
      const rowStart = rowOfHour.get(Math.floor(span.start / 60));
      if (rowStart === undefined) return;
      const lastHour = rowOfHour.get(Math.ceil(span.end / 60) - 1);
      const rowEnd = lastHour === undefined || lastHour < rowStart ? rowStart : lastHour;
      const isLong = span.end - span.start > LONG_SESSION_MINUTES;
      // The type the old card carried on its Class / Master / Party pill.
      // Colour is by LEVEL now, so nothing else on the card distinguishes a
      // party from a workshop -- and on a festival with no levels published
      // (Tunisia: 14 items, every `levels` empty) that left every card an
      // identical grey block. An ordinary class stays untagged; it is the
      // default and a tag on all of them would say nothing.
      const typeTag = item.isMasterclass
        ? "Masterclass"
        : item.type === "party"
          ? "Party"
          : null;
      const tagRow =
        (typeTag !== null || isLong) && rowEnd - rowStart + 1 >= MIN_ROWS_FOR_TAG_ROW;
      cells.push({
        key: item.id ?? `${gi}-${pi}`,
        item,
        room: group.name,
        column: roomStartColumn[gi] + lane,
        rowStart,
        rowEnd,
        startMin: span.start,
        endMin: span.end,
        endPublished: span.endPublished,
        isLong,
        level: timetableLevel(item.levels),
        typeTag,
        tagRow,
        maxRoster: rosterCapacity(rowEnd - rowStart + 1, tagRow),
      });
    });
  });

  // VISUAL ORDER -- row first, then column -- and `flow` is the SINGLE OWNER of
  // it. Position lives in CSS grid coordinates here, so source order is not
  // reading order; a screen reader and a keyboard walk both follow the DOM, and
  // would otherwise be read the day in an order the eye never sees. This sort
  // is the ARIA contract, not a tidy-up.
  //
  // `cells` DELIBERATELY CARRIES NO ORDER OF ITS OWN. It used to be sorted here
  // too, and once the renderer moved to `flow` that sort stopped affecting any
  // output while still reading as the thing enforcing the contract -- a mutant
  // reversing it went from killing a case to surviving silently. Its only other
  // consumers are a length check and the legend, neither of which cares. One
  // owner, so there is no second line to mistake for this one.
  //
  // Gap rows share the ordering rather than forming a pass of their own. Column
  // -1 puts a gap ahead of anything in its row, which is where it reads: the
  // break comes before the session that ends it.
  const flow: TimetableFlowItem[] = [
    ...rows.flatMap((row, i) =>
      row.kind === "gap" ? [{ kind: "gap" as const, row: i, column: -1, hours: row.hours }] : [],
    ),
    ...cells.map((cell) => ({
      kind: "cell" as const,
      row: cell.rowStart,
      column: cell.column,
      cell,
    })),
  ].sort((a, b) => a.row - b.row || a.column - b.column);

  const rooms: TimetableRoom[] = groups.map((g, gi) => ({
    name: g.name,
    lanes: g.lanes,
    count: g.placed.length,
    startColumn: roomStartColumn[gi],
  }));

  return { rooms, columns, rows, cells, flow };
};

type FestivalSnapshotPayload = {
  occurrence_effective?: {
    is_cancelled?: boolean | null;
    cancellation_reason_label?: string | null;
  } | null;
  // Series-termination arc W14. The snake_case half of the ended facts, for the
  // standalone /festival/:id mount that reads the raw event_view_p5 payload
  // rather than the parsed snapshot EventPage hands down. Same three keys
  // useEventPageQuery.parseEventPageSnapshot maps to lifecycleStatus / endedOn /
  // ranFrom -- verified against the live compat RPC on 2026-09-04, which admits
  // lifecycle_status IN ('live','paused','ended') and emits ended_on and
  // ran_from as naive 'YYYY-MM-DD' London dates.
  event?: {
    lifecycle_status?: string | null;
    ended_on?: string | null;
    ran_from?: string | null;
    format?: string | null;
    type?: string | null;
    category?: string | null;
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

  // THE ALL-DAYS GRID IS GONE, and with it its `showAllDays` state, its toggle,
  // its swipe hint and its viewport-seeded mount effect. It existed because the
  // columns used to be DAYS: on a phone that grid could only show one column, so
  // a second mode was needed to see the rest. The columns are ROOMS now and the
  // day picker above the box is the day navigation on every viewport, so a
  // days-across mode would be a second, competing navigation for the same
  // question -- and a rooms-by-days grid is not a surface any design here
  // describes. Removing it also removes the last reader of window.innerWidth on
  // this page, which is what made the seed a hydration hazard in the first place.
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

  // Series-termination arc W14 -- the SERIES has stopped for good.
  //
  // Read off the same two snapshot shapes as isCancelled above, and for the same
  // reason: EventPage hands down a parsed camelCase snapshot, while a standalone
  // /festival/:id mount holds only the raw event_view_p5 payload. Reading one of
  // the two would have made the tombstone appear on exactly one of the two URLs
  // that serve this page.
  //
  // isCancelled and isEnded are INDEPENDENT: a festival can finish its run with
  // its final day called off, so the cancelled banner still renders above this.
  const endedSource = propSnapshot?.event ?? null;
  const isEnded =
    endedSource !== null
      ? endedSource.lifecycleStatus === "ended"
      : snapshotPayload?.event?.lifecycle_status === "ended";
  // ended_on is authoritative; ran_from may legitimately be missing, and a null
  // range is the date-free copy path rather than a defensive one (see endedRun).
  const endedRanFrom = endedSource
    ? endedSource.ranFrom
    : (snapshotPayload?.event?.ran_from ?? null);
  const endedOn = endedSource
    ? endedSource.endedOn
    : (snapshotPayload?.event?.ended_on ?? null);
  const endedRunRange = isEnded ? formatRunRange(endedRanFrom, endedOn) : null;
  // The NOUN is derived from the real format/type/category, never hard-coded to
  // "festival". This page is reached by sniffIsFestival, which is BROADER than
  // format === 'festival' -- it also routes a multi-day-schedule or passes-carrying
  // series here whatever its format says. Hard-coding the word would print "This
  // festival has finished" on a course, and would contradict the og:description,
  // which derives the same noun from the same three fields (endedShareDescription).
  const endedFormat = endedSource ? endedSource.format : (snapshotPayload?.event?.format ?? null);
  const endedType = endedSource ? endedSource.type : (snapshotPayload?.event?.type ?? null);
  const endedCategory = endedSource
    ? endedSource.category
    : (snapshotPayload?.event?.category ?? null);

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

  // No useSeo() here -- see the same note in BentoPage.tsx. Both URLs that
  // serve this page (/festival/:id and /event/:id) are framework routes whose
  // meta() owns the head: app/routes/festival.tsx builds the very same
  // buildSeoForRoute('festival.detail', ...) input and swaps in W14's ended
  // description over it. RouteOwnsHeadContext makes any useSeo() call in this
  // subtree inert, so the one that stood here changed nothing (arc W17). Deleted
  // rather than annotated-and-kept for the reason BentoPage.tsx gives: on an ended
  // run this call's input and the route's meta() DISAGREE, so keeping it stores
  // the defect instead of a fallback. That note also carries the correction worth
  // reading before you generalise from either file -- the catchall route does not
  // wrap, and useSeo is genuinely live on the pages it hosts.



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

  // `hours` is no longer a row list -- the timetable derives its own rows per
  // day, because which hours are occupied is a property of the OPEN DAY and not
  // of the festival. It survives as the second half of the section's render
  // gate: a schedule whose every start time is unparseable must not put an
  // empty grid on the page, and that is the one question this set answers.
  const { days, hasTimedSession, sessionsByDay } = useMemo(() => {

    const schedule = festivalDetail?.schedule ?? [];

    // NB: the empty-branch seed MUST be WallClock[] -- an `[] as string[]` seed
    // makes `days` a union of array types, TS infers .map params as the
    // intersection `string & WallClock`, and the brand silently launders back
    // to string (new Date(day) compiled without error before this fix).

    if (schedule.length === 0) return { days: [] as WallClock[], hasTimedSession: false, sessionsByDay: {} as Record<string, typeof schedule> };



    // Columns come from the festival's SPAN, not from the sessions that happen
    // to exist -- see festivalGridDays for why that distinction is the whole
    // bug. Kept as a pure function so the session-less-middle-day case is
    // testable without rendering this page.
    const uniqDays: WallClock[] = festivalGridDays(
      schedule,
      festivalDetail?.dates.localStart,
      festivalDetail?.dates.localEnd,
    );

    // This used to collect the distinct hours as a sorted array, back when the
    // hours were the grid's ROWS. The rows come from `buildTimetableLayout`
    // now, and the only surviving question is whether the festival has ANY
    // session with a readable start -- so it is a boolean, named for what it
    // answers. Same predicate as before (`wallClockHour`), so the same
    // sessions are skipped: this is not a behaviour change.
    let hasTimed = false;

    const byKey: Record<string, typeof schedule> = {};

    schedule.forEach((s) => {

      const hh = wallClockHour(s.startTime);

      if (hh === null) return;

      hasTimed = true;

      const key = wallClockDateKey(s.day) ?? '';

      if (!byKey[key]) byKey[key] = [];

      byKey[key].push(s);

    });

    return { days: uniqDays, hasTimedSession: hasTimed, sessionsByDay: byKey };

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
    () => computeHeroDayStatus({ startKey, endKey, todayKey, isCancelled, cancellationState, isEnded }),
    [startKey, endKey, todayKey, isCancelled, cancellationState, isEnded],
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
  // pointing past the last column. `days[i]` is then `undefined`, so the
  // timetable is handed nothing and the reader gets the "Nothing scheduled"
  // empty state on a festival that has a full programme.
  //
  // (This paragraph used to describe `data-open` being stamped on no cell and
  // the hide-every-other-slot CSS rule therefore hiding every column. Both were
  // deleted with the day-column grid; the clamp still matters, but for the
  // reason above. The blank-schedule SYMPTOM is unchanged, which is exactly why
  // a stale explanation here survives reading -- it still describes what you
  // see.)
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

  // THE UNDATED COLUMN KEYS ON `''`, NOT ON NULL, and that distinction is the
  // whole of finding 1. `sessionsByDay` buckets on `wallClockDateKey(s.day) ??
  // ''`, so a session whose day is unusable lands under `''` -- and
  // `festivalGridDays` appends a column for exactly that case, because (its
  // words) losing it "was a silent regression: the session became unreachable
  // in the UI". Reading the key as `null` and feeding the grid `[]` reintroduced
  // that, with the day chip above still counting the session it would not show.
  //
  // `undefined` (no such day at all) stays distinct from `''` (the undated
  // day): the first must render nothing, the second must render its bucket.
  // `dayKeys` (above) ALREADY holds exactly `wallClockDateKey(d) ?? ''` per
  // day, and its own comment says it exists so these derivations stop drifting
  // apart. Re-deriving it here put the undated-column sentinel in a fourth
  // place. `dayKeys[i]` is `undefined` out of range and `''` for the undated
  // day, which is precisely the distinction the note above protects.
  const activeDayKey = dayKeys[activeDayIdx] ?? null;

  // Which column of the picker a given day key belongs to. Used to stamp each
  // rendered session with the day it ACTUALLY comes from -- see the note on
  // `data-day` at the card itself for why that is not the same as the open one.
  const dayIndexByKey = useMemo(() => {
    const byKey = new Map<string, number>();
    // Built from `dayKeys`, so the UNDATED column's `''` sentinel is defined in
    // ONE place. A card on that column needs a real stamp or it reads -1 and
    // the gate rejects the page.
    dayKeys.forEach((key, i) => {
      if (!byKey.has(key)) byKey.set(key, i);
    });
    return byKey;
  }, [dayKeys]);

  // THE OPEN DAY IS THE ONLY DAY THAT EXISTS in the grid. The previous design
  // rendered every day as a column and hid all but one with CSS; the columns are
  // rooms now, so the other days are not laid out and then hidden, they are not
  // built. That makes "the reader is looking at the wrong day" a representable
  // failure rather than a stylesheet one, which is what the gates assert on.
  const timetable = useMemo(
    () => buildTimetableLayout(activeDayKey === null ? [] : (sessionsByDay[activeDayKey] ?? [])),
    [sessionsByDay, activeDayKey],
  );

  // The legend lists the levels PRESENT on the open day, in canonical order --
  // never the full set, which would advertise a beginner stream on a day that
  // has none.
  //
  // ONE ROW PER COLOUR. Keying by (colour, label) rendered "Open Level" and
  // "All levels" as two rows painted the SAME purple, so a reader matching a
  // card against the legend got two answers and no way to choose -- a colour
  // key whose colour does not identify the row beside it. Sharing a swatch and
  // sharing a row are the same claim, so the labels that share a colour share
  // a line. `multi` is the exception: its labels are per-session lists, so the
  // row names the colour and the CARD carries the detail.
  const timetableLegend = useMemo(() => {
    const byKey = new Map<TimetableLevelKey, Set<string>>();
    for (const cell of timetable.cells) {
      const labels = byKey.get(cell.level.key) ?? new Set<string>();
      labels.add(cell.level.label);
      byKey.set(cell.level.key, labels);
    }
    return [...byKey.entries()]
      .map(([key, labels]) => ({
        key,
        label: key === "multi" ? "Multiple levels" : [...labels].sort().join(" / "),
      }))
      .sort(
        (a, b) =>
          TIMETABLE_LEVEL_ORDER.indexOf(a.key) - TIMETABLE_LEVEL_ORDER.indexOf(b.key),
      );
  }, [timetable]);

  // Roving tabindex: only the selected day chip is in the tab order, and the
  // arrow keys move between them. Without this a reader tabbing through a
  // fourteen-day festival pays fourteen stops before reaching the grid.
  const dayTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const dayPickerRef = useRef<HTMLDivElement | null>(null);

  // KEEP THE OPEN CHIP ON SCREEN. The picker is a non-wrapping horizontal
  // scroller and the chips carry full weekday names, so about three fit a 375px
  // viewport. A festival that opens on its own middle day -- which is the whole
  // point of the default-day seed -- would otherwise load showing days 1-3 with
  // nothing highlighted, while the grid below shows a day the reader cannot see
  // selected.
  //
  // `scrollLeft` on the strip, NOT `scrollIntoView`: the latter walks every
  // scrollable ancestor and would yank the PAGE to the timetable on load, which
  // is a worse bug than the one it fixes. Effect-only, so the server renders
  // nothing position-dependent.
  useEffect(() => {
    const strip = dayPickerRef.current;
    const chip = dayTabRefs.current[activeDayIdx];
    if (!strip || !chip) return;
    if (strip.scrollWidth <= strip.clientWidth) return;
    // MEASURED FROM THE STRIP, not from `offsetParent`. `.day-picker` sets no
    // `position`, so a chip's `offsetLeft` resolves against `.program-wrap`
    // (which is `position:relative`) -- correct only while the picker's left
    // edge sits at x=0 inside that wrapper. Padding on the wrapper, a margin on
    // the picker, or a sibling beside it would silently offset every load by
    // that gap, putting the open chip off-centre or off-screen: the exact
    // failure this effect exists to prevent. The delta is offset-independent.
    const offsetInStrip = chip.offsetLeft - strip.offsetLeft;
    strip.scrollLeft = Math.max(0, offsetInStrip - (strip.clientWidth - chip.clientWidth) / 2);
  }, [activeDayIdx, days.length]);

  const handleDayTabKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>, i: number) => {
    const count = days.length;
    if (count === 0) return;
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % count;
    else if (e.key === "ArrowLeft") next = (i - 1 + count) % count;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = count - 1;
    if (next < 0) return;
    e.preventDefault();
    setPickedDayIdx(next);
    dayTabRefs.current[next]?.focus();
  };

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
              // Series-termination arc W14. buildEventJsonLd returns BEFORE the
              // offers block when this is set, so `offers` below is passed and
              // then dropped -- deliberately, so the decision has one owner
              // rather than a second copy of the rule at this call site. Both of
              // that function's offer branches assert availability: InStock, so
              // without this a finished festival told Google its passes were on
              // sale from the same document whose record card says it has ended.
              isEnded,
              endDate: endIso,
              // W14: the rich result must not keep the sales pitch on a page
              // whose record card says the run has finished -- BentoPage makes
              // exactly this swap, and its comment is the reasoning. Same
              // sentence, same owner (endedRunSentence), same three fields the
              // record card derives its noun from, so the page, the
              // og:description and the structured data cannot disagree.
              description: isEnded
                ? endedRunSentence({
                    format: endedFormat,
                    type: endedType,
                    category: endedCategory,
                    ranFrom: endedRanFrom,
                    endedOn,
                  })
                : (festivalDetail?.identity.description ?? festival.description ?? null),
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


      {/* Series-termination arc P4b: the sticky wrapper is REQUIRED here.
          EventCancelledBanner used to carry `sticky top-[60px] z-30 w-full` on its
          own root; that moved to a wrapper in BentoPage so an ended banner could
          stack above it without the two siblings overlapping at a shared offset.
          This call site is the other consumer, and without the wrapper the red
          banner would simply scroll away on a cancelled festival. */}
      {isCancelled && (
        <div className="sticky top-[60px] z-30 w-full">
          <EventCancelledBanner reasonLabel={cancellationReasonLabel} />
        </div>
      )}

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



        {/* CTAs -- or, for a series that has ended, the record card that REPLACES
            them (series-termination arc W14).

            Placed here rather than above the hero, where the cancelled banner
            sits, because the two states want different treatments. A cancellation
            is an alarm a visitor has to act on, so it is sticky and interrupts;
            an ended run is a record, and the honest place for it is exactly where
            the "Get Tickets" button would have been, directly under the date
            line that gives it context. Substituting it there is also what stops
            the defect this item names: the page cannot both say "finished" and
            offer the sell, because they are the same slot.

            The record is the ONLY thing in this branch -- no "Tickets TBA"
            fallback, which on a finished festival would read as a promise. */}
        {isEnded ? (

          <div className="hero-ended">
            <EventEndedRecord
              className="ended-record"
              runRange={endedRunRange}
              eventFormat={endedFormat}
              eventType={endedType}
              eventCategory={endedCategory}
            />
          </div>

        ) : (

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

        )}

        {!isEnded && calUrls && (
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

        {/* W14: a discount code on a finished run is an offer that cannot be
            taken. BentoPage drops promo codes on the same reasoning. */}
        {!isEnded && <FestivalPromoBanner codes={festivalDetail?.promoCodes ?? []} />}

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

      {days.length > 0 && hasTimedSession && (
        <section className="program">
          <div className="program-wrap">
            <div className="section-h">
              <div className="lab">Programme</div>
              <h2>The Schedule.</h2>
              <div className="sub">{days.length} {days.length === 1 ? "Day" : "Days"}</div>
            </div>

            {/* THE DAY PICKER, on every viewport -- there is no second day
                navigation any more, so it is not a mobile affordance.

                A REAL TABLIST. These used to be plain buttons carrying
                `aria-selected`, which is invalid on a bare button and is
                simply dropped: the whole selected/unselected distinction
                reached a screen reader through nothing but colour. They are
                now role="tab" inside a role="tablist", driving one tabpanel,
                with a roving tabindex and arrow-key movement -- so a reader on
                a fourteen-day festival does not pay fourteen tab stops to get
                past the picker.

                `className` KEEPS `active` alongside `aria-selected`. The class
                is the style hook and the attribute is the semantics; both
                gates and the stylesheet read the class, and dropping it to
                "let ARIA do it" would leave the chip unstyled. */}
            <div className="day-picker" ref={dayPickerRef} role="tablist" aria-label="Festival days">
              {days.map((day, i) => {
                const weekday = formatWallClockLocalIntl(day, { weekday: "long" }) ?? "";
                const dayNum = formatWallClockLocalIntl(day, { day: "numeric" }) ?? "";
                const dayKey = wallClockDateKey(day);
                const count = (sessionsByDay[dayKey ?? ""] ?? []).length;
                const isToday = canRenderClockDerived && dayKey === todayKey;
                const isActive = activeDayIdx === i;
                return (
                  <button
                    key={dayKey ?? `day-${i}`}
                    ref={(el) => { dayTabRefs.current[i] = el; }}
                    type="button"
                    role="tab"
                    id={`festival-day-tab-${i}`}
                    aria-controls="festival-timetable-panel"
                    aria-selected={isActive}
                    tabIndex={isActive ? 0 : -1}
                    className={`day-tab ${isActive ? "active" : ""} ${isToday ? "today" : ""}`}
                    onClick={() => setPickedDayIdx(i)}
                    onKeyDown={(e) => handleDayTabKeyDown(e, i)}
                  >
                    <span className="day-tab-wd">{weekday}</span>
                    <span className="day-tab-num">{dayNum}</span>
                    {/* The separator is load-bearing, not decoration. Without
                        it the chip renders "Friday 4 3" -- date then count,
                        two unlabelled numbers running together -- and on a day
                        whose count matches its date, "Friday 4 4". */}
                    <span className="day-tab-count" aria-hidden="true">&middot; {count}</span>
                    {isToday && <span className="day-tab-today">Today</span>}
                    <span className="sr-only">{count === 1 ? "1 session" : `${count} sessions`}</span>
                  </button>
                );
              })}
            </div>

            {/* `data-day` is STATE, and it is now the ONLY place the open day
                is observable from the served HTML -- the grid below holds one
                day's sessions and nothing else, so there is no second column
                to compare it against. Keep `className` first and `data-day`
                immediately after it: the SSR gate reads the pair as adjacent
                attributes, which is what makes it a markup assertion rather
                than a substring search over the whole document. */}
            <div
              className="tl-body"
              data-day={String(activeDayIdx)}
              role="tabpanel"
              id="festival-timetable-panel"
              aria-labelledby={`festival-day-tab-${activeDayIdx}`}
            >
              {timetable.cells.length === 0 ? (
                <div className="tl-empty">
                  <div className="tl-empty-mark" aria-hidden="true">&mdash;</div>
                  <div className="tl-empty-title">Nothing scheduled</div>
                  <div className="tl-empty-body">
                    This day is part of the festival, but nothing has been published for
                    it yet. Try another day above.
                  </div>
                </div>
              ) : (
                // FOCUSABLE HERE, NOT ON THE PANEL. `.tl-box` is the scroll
                // container -- on mobile it is 360px tall with
                // `overscroll-behavior:none`, so it holds the only scrollbar
                // that reaches the rest of the day. `tabIndex` on the outer
                // `.tl-body`, which has no overflow, gave the keyboard a focus
                // ring on an element that does not scroll: arrow keys moved the
                // page instead and everything below the fourth row was
                // unreachable in browsers that do not auto-focus scroll regions.
                <div className="tl-box" tabIndex={0}>
                  <div
                    className="tl-grid"
                    style={{
                      gridTemplateColumns: `var(--tl-tgw) repeat(${timetable.columns}, ${
                        timetable.columns === 1 ? "minmax(150px,1fr)" : "var(--tl-colw)"
                      })`,
                      gridTemplateRows: `var(--tl-headh) ${timetable.rows
                        .map((r) => (r.kind === "hour" ? "var(--tl-rowh)" : "var(--tl-gaph)"))
                        .join(" ")}`,
                    }}
                  >
                    <div className="tl-corner" style={{ gridRow: 1, gridColumn: 1 }} aria-hidden="true" />

                    {/* Room headers span their lanes -- one room running three
                        classes at once is three columns under one heading. */}
                    {timetable.rooms.map((room, ri) => (
                      <div
                        key={`${room.name ?? "unset"}-${ri}`}
                        className="tl-room"
                        style={{ gridRow: 1, gridColumn: `${room.startColumn + 2} / span ${room.lanes}` }}
                        aria-hidden="true"
                      >
                        <span className="tl-room-name">
                          {room.name ?? (timetable.rooms.length > 1 ? "Room not set" : "All sessions")}
                        </span>
                        <span className="tl-room-count">
                          {room.count === 1 ? "1 session" : `${room.count} sessions`}
                        </span>
                      </div>
                    ))}

                    {/* The hour rail. Scaffolding, so aria-hidden and its DOM
                        position does not matter -- each session states its own
                        time in its label. The GAP rows are not here: they are
                        exposed content and travel in the ordered flow below,
                        interleaved with the sessions. */}
                    {timetable.rows.map((row, ri) =>
                      row.kind === "hour" ? (
                        <div
                          key={`hour-${ri}`}
                          className="tl-hour"
                          style={{ gridRow: ri + 2, gridColumn: 1 }}
                          aria-hidden="true"
                        >
                          {minutesToHHMM(row.hour * 60)}
                        </div>
                      ) : null,
                    )}

                    {/* ONE rule per hour row, not one per cell. `.tl-cellbg`
                        is a bare `border-top` and `.tl-grid` declares no column
                        gap, so N abutting segments and one spanning element
                        paint the same pixels -- while the per-cell form cost
                        `hours x columns` nodes on every render AND every SSR
                        response, scaling with the two dimensions this design
                        just made variable. If a COLUMN separator is ever
                        wanted, the per-cell form has to come back. */}
                    {timetable.rows.map((row, ri) =>
                      row.kind === "hour" ? (
                        <div
                          key={`cellbg-${ri}`}
                          className="tl-cellbg"
                          style={{ gridRow: ri + 2, gridColumn: "2 / -1" }}
                          aria-hidden="true"
                        />
                      ) : null,
                    )}

                    {/* THE EXPOSED CONTENT, in the order the eye reads it --
                        gap rows and sessions interleaved by row, from one
                        ordered list. Everything above this point is aria-hidden
                        scaffolding, so this is the whole of what a screen
                        reader hears, and it hears it in visual order.

                        No role="grid": sessions span rows, DOM order is
                        CSS-driven, and ARIA grid semantics with spanning cells
                        are fragile enough that they mislead more than they
                        help. Each session carries its whole meaning in one
                        label instead.

                        NO <button>. The mockup put an absolutely-positioned
                        button under the sticky label, because sticky inside a
                        button is unreliable -- Chromium applies the offset
                        unconditionally and parks every label part-way down its
                        own card. Nothing here is clickable (a session has no
                        page of its own), so a button would announce a control
                        that does nothing. The label is plain text in document
                        order, the visual block is aria-hidden, and sticky works
                        because it is not inside a button and the card has no
                        clipping ancestor. If sessions ever gain a destination,
                        the sibling-button shape is the fix -- do not put sticky
                        inside it. */}
                    {timetable.flow.map((entry) => {
                      if (entry.kind === "gap") {
                        // An empty stretch is real information -- the
                        // difference between a festival that pauses for lunch
                        // and one that has not published its afternoon.
                        return (
                          <div
                            key={`gap-${entry.row}`}
                            className="tl-gap"
                            style={{
                              gridRow: entry.row + 2,
                              gridColumn: "1 / -1",
                            }}
                          >
                            <span>
                              {entry.hours === 1 ? "1 hour free" : `${entry.hours} hours free`}
                            </span>
                          </div>
                        );
                      }

                      const cell = entry.cell;
                      const people = [...cell.item.instructors, ...cell.item.djs]
                        .map((p) => p.displayName)
                        .filter((n): n is string => Boolean(n));
                      const solo = people.length === 1;
                      const from = minutesToHHMM(cell.startMin);
                      const to = minutesToHHMM(cell.endMin);
                      // BOUNDED BY WHAT THE CARD CAN HOLD. The card cannot clip
                      // (that would kill the sticky label) and it sits above its
                      // neighbours, so an unbounded roster paints over the
                      // session below it.
                      //
                      // The "and N more" line COSTS A LINE, so it is taken out
                      // of the budget rather than added on top of it -- which
                      // is what made the first version of this still overflow.
                      const roster = people.length > 1 && cell.maxRoster > 0;
                      const shown =
                        !roster || people.length <= cell.maxRoster
                          ? people
                          : people.slice(0, cell.maxRoster - 1);
                      const hidden = people.length - shown.length;
                      const label = [
                        solo ? people[0] : cell.item.title,
                        solo ? cell.item.title : "",
                        cell.typeTag ?? "",
                        cell.room ? `in ${cell.room}` : "",
                        cell.endPublished ? `${from} to ${to}` : `from ${from}, no end published`,
                        cell.level.label,
                        // The FULL count, never the truncated one -- the label
                        // is not space-constrained and must not under-report.
                        people.length > 1 ? `${people.length} artists` : "",
                      ].filter(Boolean).join(", ");

                      return (
                        <div
                          key={cell.key}
                          className={`tl-ev l-${cell.level.key} ${cell.isLong ? "long" : ""}`}
                          data-day={String(
                            dayIndexByKey.get(wallClockDateKey(cell.item.day) ?? "") ?? -1,
                          )}
                          style={{
                            gridRow: `${cell.rowStart + 2} / ${cell.rowEnd + 3}`,
                            gridColumn: cell.column + 2,
                          }}
                        >
                          <span className="sr-only">{label}</span>
                          <span className="tl-ev-label" aria-hidden="true">
                            {cell.tagRow && (
                              <span className="tl-ev-tags">
                                {cell.typeTag && <span className="tl-ev-tag">{cell.typeTag}</span>}
                                {cell.isLong && <span className="tl-ev-tag ghost">Ongoing</span>}
                              </span>
                            )}
                            <span className="tl-ev-who">{solo ? people[0] : cell.item.title}</span>
                            {solo && <span className="tl-ev-what">{cell.item.title}</span>}
                            {/* Whatever did not earn its own band lands here.
                                A short card gets its type and its artist count
                                on the meta line rather than losing them. */}
                            <span className="tl-ev-meta">
                              {cell.endPublished ? `${from}–${to}` : from}
                              {/* \u00b7, never a pasted middle dot and never
                                  &middot;: an HTML entity inside a template
                                  literal ships as the literal seven characters,
                                  and raw Unicode punctuation is what the cp1252
                                  round-trip corrupts (see CLAUDE.md). */}
                              {!cell.tagRow && cell.typeTag ? ` \u00b7 ${cell.typeTag}` : ""}
                              {` \u00b7 ${cell.level.label}`}
                              {!roster && people.length > 1 ? ` \u00b7 ${people.length} artists` : ""}
                            </span>
                            {roster && (
                              <span className="tl-ev-roster">
                                <b>{people.length} artists</b>
                                {shown.map((n, pi) => <i key={`${cell.key}-p-${pi}`}>{n}</i>)}
                                {hidden > 0 && <i className="more">and {hidden} more</i>}
                              </span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* THE NOTE DESCRIBES THE GRID, never the viewport. It used to say
                "scroll inside the box" unconditionally -- but the rule that
                makes `.tl-box` scroll on the block axis lives only in the
                <=900px media query, and a narrow day does not scroll
                horizontally either, so on desktop it instructed the reader to
                scroll something already fully visible. The room count is the
                claim worth making and it holds at every width.

                `timetable.columns` is the LANE count, not what the reader sees:
                a day with three concurrent classes in one room and one in
                another renders TWO room headings and said "4 columns". Rooms
                are what carry a heading, so rooms are what the note counts. */}
            {timetable.cells.length > 0 && timetable.rooms.length > 1 && (
              <div className="tl-note" aria-hidden="true">
                <span>{`${timetable.rooms.length} rooms, side by side`}</span>
              </div>
            )}

            {/* The levels PRESENT on the open day, never the full set -- a
                legend advertising a beginner stream on a day that has none is
                worse than no legend. */}
            {timetableLegend.length > 0 && (
              <div className="legend">
                {timetableLegend.map((lv) => (
                  <div key={`${lv.key}-${lv.label}`} className={`legend-item l-${lv.key}`}>
                    <span className="swatch" />{lv.label}
                  </div>
                ))}
              </div>
            )}
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



      {/* Community — "Join the group chat" band (renders only when a link is set).
          W14: not on an ended run. BentoPage hides its GroupChatBlock on the same
          rule -- a dead date must not advertise a chat to join for it. */}
      {!isEnded && <FestivalGroupChatSection url={festivalDetail?.links.groupChatUrl ?? null} />}

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



      {/* RAFFLE — festival-native slot-machine band (FestivalRaffleSection.tsx).
          W14: hidden on an ended run, exactly as BentoPage adds 'raffle' to its
          hidden blocks when isEnded -- an entry form for a draw that has already
          happened (or will never happen) is the clearest form of this defect. */}
      {!isEnded && <FestivalRaffleSection eventId={festivalId} />}

      {/* TICKETS — the section W14 exists for. Promising "this festival has
          finished" in the record card above and then rendering a priced pass
          grid with a Get Tickets button below is worse than a stale invitation,
          which is why the ended share copy was gated shut until this landed. */}
      {!isEnded && (ticketUrl || passes.length > 0) && (
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



      {/* THE WAY OFF THE PAGE (arc W14, added after review).
          EventEndedRecord's copy ends "Have a look at what else is on below",
          and until this landed that promise was FALSE on this route: BentoPage
          keeps it with a MoreEventsSection door plus a bottom strip, and this
          page had neither -- while the same change suppressed the raffle, group
          chat, promo codes and the whole tickets section, making a finished
          festival a longer dead end than before, at the one moment an onward
          link matters most. A tombstone must always offer a way off itself.

          Ended only: a live festival's page ends on its ticket CTA, and that is
          not a state this arc has any business restyling.

          All three blocks, unlike BentoPage -- it splits them because it renders
          the door ABOVE its grid and the strip below, and splitting avoids
          showing the organiser twice. There is one instance here, so it carries
          the lot. `pillIsTheWayOut` for the reason BentoPage gives: the
          organiser strip and this-week can both legitimately come back empty (an
          organiser whose only series just ended, in a quiet week), and the
          calendar pill is what keeps the promise from being empty too. */}
      {isEnded && (
        <MoreEventsSection
          pillIsTheWayOut
          sectionLabel="Still running from this organiser"
          fallbackSectionLabel="Other organisers in this city"
          currentEventId={festivalId || null}
          organiserId={organiserId}
          organiserName={organiser?.displayName ?? null}
          citySlug={festivalDetail?.location.city?.slug ?? null}
          cityName={festivalDetail?.location.city?.name ?? festival.city ?? null}
        />
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
        // W14: the sticky bar is the last surface that can still sell a finished
        // run, and it follows the reader down the whole page. Directions and
        // Share stay -- a record is a thing people still look up and pass on --
        // but the ticket pill and add-to-calendar are actions on a date that
        // will not happen. Same split BentoPage makes on `over`.
        ticketUrl={isEnded ? null : ticketUrl}
        shareTitle={festivalDetail?.identity.name ?? festival?.name ?? "Festival"}
        shareSubtitle={shareSubtitle}
        canAddToCalendar={!isEnded && !!calUrls}
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

