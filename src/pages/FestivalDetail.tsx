import { useState, useEffect, useMemo } from "react";

import { PageErrorBoundary } from "@/components/ErrorBoundary";

import { Skeleton } from "@/components/ui/skeleton";

import { useParams, useNavigate, Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

import PageBreadcrumb from "@/components/PageBreadcrumb";

import { buildBreadcrumbs } from "@/lib/breadcrumbs";

import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

import { useRecordEventView } from "@/modules/event-page/useRecordEventView";

import { StickyTicketButton } from "@/modules/event-page/bento/StickyTicketButton";

import { useFestivalDetailQuery } from "@/modules/event-page/useFestivalDetailQuery";

import type { EventPageSnapshot } from "@/modules/event-page/types";



type FestivalEvent = {

  id: string;

  name: string;

  city: string | null;

  date: string | null;

  start_time: string | null;

  poster_url: string | null;

  description: string | null;

  ticket_url: string | null;

};



type FestivalDetailInnerProps = {

  snapshot?: EventPageSnapshot | null;

};



// ---------------------------------------------------------------------------

// Cinematic CSS -- scoped under .cinematic-festival

// Ported from the validated mockup at c:\tmp\festival-mockups\05-cinematic-timeline.html

// ---------------------------------------------------------------------------

const CINEMATIC_CSS = `

.cinematic-festival{font-family:'Inter',sans-serif;background:#000;color:#f5f5f5;-webkit-font-smoothing:antialiased;overflow-x:hidden}

.cinematic-festival *{box-sizing:border-box}



/* HERO */

.cinematic-festival .hero{min-height:88vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:48px 24px;position:relative;overflow:hidden;background:radial-gradient(circle at 20% 50%,rgba(236,72,153,0.15) 0%,transparent 35%),radial-gradient(circle at 80% 30%,rgba(251,146,60,0.18) 0%,transparent 40%),radial-gradient(circle at 50% 80%,rgba(168,85,247,0.12) 0%,transparent 35%),#000}

.cinematic-festival .hero::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,0.015) 0px,rgba(255,255,255,0.015) 1px,transparent 1px,transparent 4px);pointer-events:none;mix-blend-mode:overlay}

.cinematic-festival .hero::after{content:'';position:absolute;inset:0;background:radial-gradient(circle,transparent 80%,rgba(0,0,0,0.6) 100%);pointer-events:none}

/* Floating polaroid -- cover image */

.cinematic-festival .poster-polaroid{position:absolute;top:48px;right:48px;width:170px;background:#fef9ed;padding:8px 8px 32px;box-shadow:0 24px 48px rgba(0,0,0,0.7),0 8px 16px rgba(0,0,0,0.4);transform:rotate(6deg);z-index:3;border:1px solid #d4b896;transition:transform .3s ease;text-decoration:none;color:inherit;display:block}

.cinematic-festival .poster-polaroid:hover{transform:rotate(2deg) translateY(-4px);box-shadow:0 32px 64px rgba(251,146,60,0.3),0 8px 16px rgba(0,0,0,0.5)}

.cinematic-festival .poster-polaroid::before{content:'';position:absolute;top:-8px;left:50%;transform:translateX(-50%);width:54px;height:14px;background:rgba(251,146,60,0.45);border:1px solid rgba(251,146,60,0.7);box-shadow:0 2px 8px rgba(0,0,0,0.3)}

.cinematic-festival .poster-polaroid img{width:100%;aspect-ratio:3/4;object-fit:cover;display:block;filter:saturate(0.9) sepia(0.1)}

.cinematic-festival .poster-polaroid .pp-caption{font-family:'Caveat',cursive;font-size:18px;color:#3a2818;text-align:center;margin-top:8px;line-height:1}

@media (max-width:760px){

  .cinematic-festival .poster-polaroid{position:relative;top:auto;right:auto;width:140px;padding:6px 6px 22px;transform:rotate(-3deg);margin:0 auto 12px;align-self:center}

  .cinematic-festival .poster-polaroid .pp-caption{font-size:13px;margin-top:6px}

  .cinematic-festival .poster-polaroid::before{width:48px;height:12px}

  .cinematic-festival .hero-pre{font-size:11px;letter-spacing:4px;white-space:nowrap}

  .cinematic-festival .hero-pre::before,.cinematic-festival .hero-pre::after{width:20px;margin:0 8px}

}



.cinematic-festival .hero-pre{font-family:'Bebas Neue',sans-serif;font-size:13px;letter-spacing:8px;color:#fb923c;margin-bottom:16px;position:relative;z-index:1}

.cinematic-festival .hero-pre::before,.cinematic-festival .hero-pre::after{content:'';display:inline-block;width:40px;height:1px;background:#fb923c;vertical-align:middle;margin:0 16px}

.cinematic-festival .hero h1{font-family:'Bebas Neue',sans-serif;font-size:clamp(48px,12vw,160px);line-height:0.9;letter-spacing:-0.02em;color:#fff;position:relative;z-index:1;text-shadow:0 0 80px rgba(251,146,60,0.4),0 0 40px rgba(236,72,153,0.2);font-weight:400;margin:0}

.cinematic-festival .hero h1 .out{color:transparent;-webkit-text-stroke:2px #fb923c;font-style:italic}

.cinematic-festival .hero-tag{font-family:'Bebas Neue',sans-serif;font-size:clamp(18px,2.4vw,26px);letter-spacing:8px;color:rgba(255,255,255,0.8);margin-top:16px;position:relative;z-index:1}



/* Date tiles */

.cinematic-festival .hero-dates{display:flex;flex-direction:column;align-items:center;gap:10px;margin-top:24px;position:relative;z-index:1}

.cinematic-festival .date-row{display:flex;align-items:stretch;gap:0;position:relative}

.cinematic-festival .day-tile{padding:14px 20px 12px;background:rgba(251,146,60,0.04);border:1px solid rgba(251,146,60,0.35);display:flex;flex-direction:column;align-items:center;gap:4px;min-width:88px;position:relative;transition:all .25s ease}

.cinematic-festival .day-tile + .day-tile{border-left:none}

.cinematic-festival .day-tile.featured{background:rgba(251,146,60,0.1);border-color:#fb923c;box-shadow:inset 0 0 24px rgba(251,146,60,0.15)}

.cinematic-festival .day-tile:hover{background:rgba(251,146,60,0.1)}

.cinematic-festival .day-tile .dow{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:0.3em;color:rgba(255,255,255,0.6);text-transform:uppercase}

.cinematic-festival .day-tile .num{font-family:'Bebas Neue',sans-serif;font-size:clamp(40px,7vw,68px);line-height:1;color:#fb923c;letter-spacing:-0.02em;text-shadow:0 0 24px rgba(251,146,60,0.55)}

.cinematic-festival .day-tile .perf{position:absolute;width:8px;height:8px;background:#0a0a0a;border:1px solid rgba(251,146,60,0.35);border-radius:50%}

.cinematic-festival .day-tile .perf.tl{top:-4px;left:-4px}

.cinematic-festival .day-tile .perf.tr{top:-4px;right:-4px}

.cinematic-festival .day-tile .perf.bl{bottom:-4px;left:-4px}

.cinematic-festival .day-tile .perf.br{bottom:-4px;right:-4px}

.cinematic-festival .date-row > .day-tile:not(:first-child) .perf.tl,

.cinematic-festival .date-row > .day-tile:not(:first-child) .perf.bl,

.cinematic-festival .date-row > .day-tile:not(:last-child) .perf.tr,

.cinematic-festival .date-row > .day-tile:not(:last-child) .perf.br{display:none}

.cinematic-festival .date-month{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.4em;color:rgba(255,255,255,0.5);text-transform:uppercase}

.cinematic-festival .date-month b{color:#fff;font-weight:600}



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



/* COUNTDOWN */

.cinematic-festival .countdown{padding:32px 24px;display:flex;justify-content:center;gap:20px;background:#000;flex-wrap:wrap;border-top:1px solid rgba(251,146,60,0.15);border-bottom:1px solid rgba(251,146,60,0.15)}

.cinematic-festival .cd-cell{text-align:center;min-width:80px}

.cinematic-festival .cd-num{font-family:'Bebas Neue',sans-serif;font-size:clamp(36px,10vw,56px);line-height:1;color:#fb923c;text-shadow:0 0 40px rgba(251,146,60,0.6),0 0 80px rgba(251,146,60,0.3);letter-spacing:-0.02em}

.cinematic-festival .cd-lbl{font-size:9px;letter-spacing:0.3em;text-transform:uppercase;color:#737373;margin-top:6px;font-family:'JetBrains Mono',monospace}



/* ABOUT -- collapsible description */

.cinematic-festival .about{padding:40px 24px;background:#0a0a0a;border-top:1px solid rgba(251,146,60,0.15);border-bottom:1px solid rgba(251,146,60,0.15)}

.cinematic-festival .about-wrap{max-width:720px;margin:0 auto;text-align:center}

.cinematic-festival .about-label{font-family:'Bebas Neue',sans-serif;font-size:11px;letter-spacing:6px;color:#fb923c;margin-bottom:14px;text-transform:uppercase;position:relative;display:inline-block}

.cinematic-festival .about-label::before,.cinematic-festival .about-label::after{content:'';position:absolute;top:50%;width:24px;height:1px;background:rgba(251,146,60,0.4)}

.cinematic-festival .about-label::before{right:calc(100% + 10px)}

.cinematic-festival .about-label::after{left:calc(100% + 10px)}

.cinematic-festival .about-text{font-size:14px;line-height:1.65;color:rgba(255,255,255,0.72);text-align:left;white-space:pre-line}

.cinematic-festival .about-text b,.cinematic-festival .about-text strong{color:#fff;font-weight:600}

.cinematic-festival .about-toggle{margin-top:16px;background:transparent;border:1px solid rgba(251,146,60,0.4);color:#fb923c;padding:10px 24px;font-family:'Bebas Neue',sans-serif;letter-spacing:3px;font-size:11px;text-transform:uppercase;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:6px}

.cinematic-festival .about-toggle:hover{background:rgba(251,146,60,0.1);border-color:#fb923c}



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

.cinematic-festival .vo-col .section-h .lab{font-family:'Bebas Neue',sans-serif;font-size:11px;letter-spacing:5px;color:#fb923c}

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

.cinematic-festival footer .x{font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:6px;color:rgba(255,255,255,0.4);text-transform:uppercase}



/* Mobile breakpoints */

@media (max-width:900px){

  .cinematic-festival .tl-header{display:none}

  .cinematic-festival .tl-row{grid-template-columns:60px 1fr !important;gap:0;min-height:0;padding:0}

  .cinematic-festival .tl-time{padding:10px 8px;font-size:10px}

  .cinematic-festival .slot{padding:10px 12px;min-height:0}

  .cinematic-festival .tl-body[data-day="0"] .tl-row > .slot:not(:nth-child(2)),

  .cinematic-festival .tl-body[data-day="1"] .tl-row > .slot:not(:nth-child(3)),

  .cinematic-festival .tl-body[data-day="2"] .tl-row > .slot:not(:nth-child(4)),

  .cinematic-festival .tl-body[data-day="3"] .tl-row > .slot:not(:nth-child(5)){display:none}

  .cinematic-festival .tl-body[data-day="0"] .tl-row:not(:has(> .slot:nth-child(2) > .session)),

  .cinematic-festival .tl-body[data-day="1"] .tl-row:not(:has(> .slot:nth-child(3) > .session)),

  .cinematic-festival .tl-body[data-day="2"] .tl-row:not(:has(> .slot:nth-child(4) > .session)),

  .cinematic-festival .tl-body[data-day="3"] .tl-row:not(:has(> .slot:nth-child(5) > .session)){display:none}

  .cinematic-festival .day-mobile-tabs{display:flex;gap:6px;justify-content:center;margin-bottom:20px;flex-wrap:wrap;position:sticky;top:0;background:linear-gradient(180deg,#0a0a0a 0%,#0a0a0a 80%,transparent);padding:8px 0 12px;z-index:5}

  .cinematic-festival .day-tab{padding:10px 18px;background:rgba(255,255,255,0.04);border:1px solid rgba(251,146,60,0.3);color:#fb923c;font-family:'Bebas Neue',sans-serif;letter-spacing:0.15em;font-size:13px;text-transform:uppercase;cursor:pointer;transition:all .15s}

  .cinematic-festival .day-tab.active{background:#fb923c;color:#000;border-color:#fb923c}

  .cinematic-festival .lineup{padding:36px 16px}

  .cinematic-festival .filmstrip{margin:0 -16px}

  .cinematic-festival .frames{padding:20px 12px;gap:0;flex-wrap:wrap;overflow-x:visible;justify-content:center;row-gap:12px}

  .cinematic-festival .frames > *{flex:0 0 calc(50% - 12px);max-width:none}

  .cinematic-festival .frame{margin:0 4px}

  .cinematic-festival .frame-img{height:170px}

  .cinematic-festival .frame-name{font-size:18px}

  .cinematic-festival .frame-style{font-size:8px;letter-spacing:0.15em}

  .cinematic-festival .frame-info{padding:10px 8px}

  .cinematic-festival .frame::after{display:none}

  .cinematic-festival .vo{padding:28px 12px}

  .cinematic-festival .vo-grid{grid-template-columns:1fr 1fr;gap:10px}

  .cinematic-festival .vo-col .section-h{text-align:center;margin-bottom:8px}

  .cinematic-festival .vo-col .section-h .lab{font-size:9px;letter-spacing:3px}

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

  .cinematic-festival .tix{padding:16px 10px}

  .cinematic-festival .tix .p{font-size:36px;margin:6px 0 2px}

  .cinematic-festival .tix .n{font-size:11px;letter-spacing:3px}

  .cinematic-festival .tix .d{font-size:10px}

}

@media (min-width:901px){.cinematic-festival .day-mobile-tabs{display:none}}

@media (max-width:760px){

  .cinematic-festival .countdown{padding:36px 16px;gap:8px}

  .cinematic-festival .cd-cell{min-width:0;flex:1 0 calc(25% - 8px)}

  .cinematic-festival .cd-lbl{font-size:9px;letter-spacing:0.2em;margin-top:4px}

}

@media (max-width:480px){

  .cinematic-festival .hero{padding:60px 16px}

  .cinematic-festival .hero h1{font-size:clamp(56px,16vw,80px)}

  .cinematic-festival .hero-tag{font-size:14px;letter-spacing:6px}

  .cinematic-festival .day-tile{min-width:72px;padding:10px 14px 8px}

  .cinematic-festival .day-tile .dow{font-size:8px;letter-spacing:0.25em}

  .cinematic-festival .hero-cta{margin-top:28px;gap:8px;flex-direction:row;flex-wrap:nowrap}

  .cinematic-festival .hero-cta .btn,.cinematic-festival .hero-cta .cal-wrap{flex:1 1 0;min-width:0;width:auto}

  .cinematic-festival .btn{padding:13px 8px;letter-spacing:2px;justify-content:center;font-size:11px}

  .cinematic-festival .cal-wrap > summary{width:100%;justify-content:center}

  .cinematic-festival .cal-menu{min-width:0;width:calc(100vw - 32px)}

}

`;



// ---------------------------------------------------------------------------

// Helpers

// ---------------------------------------------------------------------------



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



// Extract HH:MM from an ISO timestamp like "2026-06-19T17:00:00"

const extractTimeHHMM = (iso: string | null): string => {

  if (!iso) return "";

  const m = iso.match(/T(\d{2}):(\d{2})/);

  return m ? `${m[1]}:${m[2]}` : iso;

};



// Extract the hour as a number (0-23) from an ISO timestamp

const extractHour = (iso: string | null): number | null => {

  if (!iso) return null;

  const m = iso.match(/T(\d{2}):/);

  return m ? parseInt(m[1], 10) : null;

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



const FestivalDetailInner = ({ snapshot: propSnapshot }: FestivalDetailInnerProps) => {

  const { id } = useParams();

  const navigate = useNavigate();

  const [, setTick] = useState(0);

  const [activeDayIdx, setActiveDayIdx] = useState(0);

  const [descExpanded, setDescExpanded] = useState(false);



  const festivalId = id || "";



  useRecordEventView(festivalId, "public_festival_page");



  const { data: festival, isLoading: isFestivalLoading } = useQuery({

    queryKey: ["festival-event", festivalId],

    queryFn: async () => {

      const { data, error } = await supabase

        .from("events")

        .select("id, name, city, date, start_time, poster_url, description, ticket_url")

        .eq("id", festivalId)

        .eq("type", "festival")

        .maybeSingle();

      if (error) throw error;

      return data as FestivalEvent | null;

    },

    enabled: Boolean(festivalId),

  });



  const { data: snapshotPayload } = useQuery({

    queryKey: ["festival-snapshot", festivalId],

    queryFn: async () => {

      const { data, error: rpcError } = await supabase.rpc("event_view_p5" as never, {

        p_target: { series_id: festivalId },

        p_viewer: { role: "anon", shape: "snapshot_compat" },

      } as never);

      if (rpcError) throw rpcError;

      return data as Record<string, any> | null;

    },

    enabled: Boolean(festivalId) && !propSnapshot,

  });



  const effectiveSnapshot = propSnapshot ?? snapshotPayload;

  const { data: festivalDetail } = useFestivalDetailQuery(festivalId, Boolean(festivalId));



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



  // Tick the countdown every second

  useEffect(() => {

    const interval = setInterval(() => setTick((t) => t + 1), 1000);

    return () => clearInterval(interval);

  }, []);



  // --- Derived values ---

  const startDateRaw = festivalDetail?.dates.startsAt ?? festival?.date ?? festival?.start_time ?? null;

  const endDateRaw = festivalDetail?.dates.endsAt ?? null;

  const startDate = startDateRaw ? new Date(startDateRaw) : null;

  const endDate = endDateRaw ? new Date(endDateRaw) : null;



  // Header strip date label

  const formattedDate = useMemo(() => {

    if (!startDate) return "Date TBA";

    const singleDayFmt: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" };

    if (!endDate || startDate.toDateString() === endDate.toDateString()) {

      return startDate.toLocaleDateString("en-GB", singleDayFmt);

    }

    const sameMonth = startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear();

    const endStr = endDate.toLocaleDateString("en-GB", singleDayFmt);

    return sameMonth

      ? `${startDate.getDate()} \u2013 ${endStr}`

      : `${startDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} \u2013 ${endStr}`;

  }, [startDate, endDate]);



  // Countdown

  const countdown = useMemo(() => {

    if (!startDate) return { days: 0, hours: 0, mins: 0, secs: 0 };

    const diff = startDate.getTime() - Date.now();

    if (diff <= 0) return { days: 0, hours: 0, mins: 0, secs: 0 };

    return {

      days: Math.floor(diff / (1000 * 60 * 60 * 24)),

      hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),

      mins: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),

      secs: Math.floor((diff % (1000 * 60)) / 1000),

    };

  }, [startDate]);



  // Date tiles -- each day from start to end, featured = middle day if odd count

  const dateTiles = useMemo(() => {

    if (!startDate) return [] as Array<{ dow: string; num: number; featured: boolean }>;

    const end = endDate ?? startDate;

    const tiles: Array<{ dow: string; num: number; featured: boolean }> = [];

    const cur = new Date(startDate);

    while (cur <= end && tiles.length < 7) {

      tiles.push({

        dow: cur.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase().slice(0, 3),

        num: cur.getDate(),

        featured: false,

      });

      cur.setDate(cur.getDate() + 1);

    }

    if (tiles.length > 0) {

      const featuredIdx = Math.floor(tiles.length / 2);

      tiles[featuredIdx] = { ...tiles[featuredIdx], featured: true };

    }

    return tiles;

  }, [startDate, endDate]);



  const monthLabel = useMemo(() => {

    if (!startDate) return "";

    const month = startDate.toLocaleDateString("en-GB", { month: "long" });

    const year = startDate.getFullYear();

    return { month, year };

  }, [startDate]);



  // Calendar dropdown URLs

  const calUrls = useMemo(() => {

    if (!startDateRaw) return null;

    const name = festivalDetail?.identity.name ?? festival?.name ?? "Event";

    const description = festivalDetail?.identity.description ?? festival?.description ?? "";

    const venue = festivalDetail?.location.primaryVenue;

    const location = venue ? `${venue.name}${venue.address ? `, ${venue.address}` : ""}` : "";

    const gStart = formatGCalDate(startDateRaw);

    const gEnd = formatGCalDate(endDateRaw ?? startDateRaw);

    if (!gStart || !gEnd) return null;

    const enc = encodeURIComponent;

    return {

      google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${enc(name)}&dates=${gStart}/${gEnd}&details=${enc(description.slice(0, 500))}&location=${enc(location)}`,

      outlook: `https://outlook.live.com/calendar/0/deeplink/compose?subject=${enc(name)}&startdt=${enc(startDateRaw)}&enddt=${enc(endDateRaw ?? startDateRaw)}&location=${enc(location)}&body=${enc(description.slice(0, 500))}`,

    };

  }, [startDateRaw, endDateRaw, festival, festivalDetail]);



  // Schedule grid -- group by day, then by hour

  const { days, hours, sessionsByDayHour } = useMemo(() => {

    const schedule = festivalDetail?.schedule ?? [];

    if (schedule.length === 0) return { days: [] as string[], hours: [] as number[], sessionsByDayHour: {} as Record<string, typeof schedule> };



    const uniqDays = Array.from(new Set(schedule.map((s) => s.day))).sort();

    const uniqHoursSet = new Set<number>();

    const byKey: Record<string, typeof schedule> = {};

    schedule.forEach((s) => {

      const hh = extractHour(s.startTime);

      if (hh === null) return;

      uniqHoursSet.add(hh);

      const key = `${s.day}-${hh}`;

      if (!byKey[key]) byKey[key] = [];

      byKey[key].push(s);

    });

    return { days: uniqDays, hours: Array.from(uniqHoursSet).sort((a, b) => a - b), sessionsByDayHour: byKey };

  }, [festivalDetail]);



  const venue = festivalDetail?.location.primaryVenue ?? null;

  const organiser = festivalDetail?.organiser ?? null;

  const teachers = festivalDetail?.lineup.teachers ?? [];

  const ticketUrl = festivalDetail?.links.ticketUrl ?? festival?.ticket_url ?? null;

  const musicStyles = festivalDetail?.identity.musicStyles ?? [];

  const posterUrl = festivalDetail?.identity.posterUrl ?? festival?.poster_url ?? null;



  // Description preview -- first paragraph or first ~220 chars, whichever shorter

  const fullDescription = festivalDetail?.identity.description ?? festival?.description ?? null;

  const descPreview = useMemo(() => {

    if (!fullDescription) return null;

    const firstPara = fullDescription.split(/\n\s*\n/)[0].trim();

    if (firstPara.length <= 240) return firstPara;

    return firstPara.slice(0, 240).trimEnd() + "\u2026";

  }, [fullDescription]);

  const hasMoreDescription = Boolean(fullDescription && descPreview && fullDescription.trim() !== descPreview.trim());



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

    <div className="cinematic-festival min-h-screen pb-24 pt-20">

      <style dangerouslySetInnerHTML={{ __html: CINEMATIC_CSS }} />



      <PageBreadcrumb items={buildBreadcrumbs("festival.detail", { entityName: festival.name })} />



      {/* HERO */}

      <section className="hero">

        {posterUrl && (

          <a href={posterUrl} target="_blank" rel="noopener noreferrer" className="poster-polaroid" aria-label="View full festival poster">

            <img src={posterUrl} alt={`${festival.name} poster`} />

            <div className="pp-caption">the poster.</div>

          </a>

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



        {/* Date tiles */}

        {dateTiles.length > 0 && (

          <div className="hero-dates">

            <div className="date-row">

              {dateTiles.map((tile, i) => (

                <div key={i} className={`day-tile ${tile.featured ? "featured" : ""}`}>

                  <span className="perf tl" /><span className="perf tr" /><span className="perf bl" /><span className="perf br" />

                  <span className="dow">{tile.dow}</span>

                  <span className="num">{tile.num}</span>

                </div>

              ))}

            </div>

            {typeof monthLabel === "object" && (

              <div className="date-month">

                <b>{monthLabel.month}</b> &middot; {monthLabel.year}

              </div>

            )}

          </div>

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

          {calUrls && (

            <details className="cal-wrap">

              <summary className="btn btn-ghost cal-summary">

                Add to Calendar <span className="chev">&#9660;</span>

              </summary>

              <div className="cal-menu">

                <a href={calUrls.google} target="_blank" rel="noopener noreferrer">

                  <div className="cal-ico">G</div>

                  <span>Google Calendar</span>

                  <span className="cal-arr">&nearr;</span>

                </a>

                <a href={calUrls.outlook} target="_blank" rel="noopener noreferrer">

                  <div className="cal-ico">O</div>

                  <span>Outlook</span>

                  <span className="cal-arr">&nearr;</span>

                </a>

              </div>

            </details>

          )}

        </div>

      </section>



      {/* COUNTDOWN */}

      <section className="countdown">

        <div className="cd-cell"><div className="cd-num">{countdown.days}</div><div className="cd-lbl">Days</div></div>

        <div className="cd-cell"><div className="cd-num">{countdown.hours}</div><div className="cd-lbl">Hours</div></div>

        <div className="cd-cell"><div className="cd-num">{countdown.mins}</div><div className="cd-lbl">Minutes</div></div>

        <div className="cd-cell"><div className="cd-num">{countdown.secs}</div><div className="cd-lbl">Seconds</div></div>

      </section>



      {/* LINEUP */}

      {teachers.length > 0 && (

        <section className="lineup">

          <div className="label">Featuring</div>

          <div className="sub">Reel 01 &middot; {teachers.length} {teachers.length === 1 ? "Frame" : "Frames"}</div>



          <div className="filmstrip">

            <div className="frames">

              {teachers.map((teacher, i) => {

                const styleLabel = teacher.id && teacherStyles[teacher.id]

                  ? teacherStyles[teacher.id]

                  : musicStyles[0] ?? "Lineup";

                const initial = (teacher.displayName || "?").charAt(0).toUpperCase();

                const inner = (

                  <a className="frame" href={teacher.href ?? "#"}>

                    <div className="frame-num">{String(i + 1).padStart(2, "0")}</div>

                    <div className="frame-corner">{initial}-26</div>

                    {teacher.avatarUrl ? (

                      <div className="frame-img" style={{ backgroundImage: `url(${teacher.avatarUrl})` }} />

                    ) : (

                      <div className="frame-img no-photo"><span className="initial">{initial}</span></div>

                    )}

                    <div className="frame-info">

                      <div className="frame-name">{teacher.displayName ?? "Artist"}</div>

                      <div className="frame-style">{styleLabel}</div>

                      <div className="frame-tag">Headliner</div>

                    </div>

                  </a>

                );

                return (

                  <div key={teacher.id}>

                    {teacher.href ? (

                      <Link to={teacher.href} style={{ textDecoration: "none", color: "inherit", display: "block" }}>

                        {inner}

                      </Link>

                    ) : (

                      inner

                    )}

                  </div>

                );

              })}

            </div>

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

              <div className="sub">{days.length} {days.length === 1 ? "Day" : "Days"} &middot; {festivalDetail?.schedule.length ?? 0} Sessions</div>

            </div>



            {/* Mobile day-tabs */}

            <div className="day-mobile-tabs">

              {days.map((day, i) => {

                const d = new Date(day);

                const label = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });

                return (

                  <button

                    key={day}

                    className={`day-tab ${activeDayIdx === i ? "active" : ""}`}

                    onClick={() => setActiveDayIdx(i)}

                  >

                    {label}

                  </button>

                );

              })}

            </div>



            {/* Table-grid: Time Ã— Days */}

            <div className="tl-grid-wrap">

              <div className="tl-header" style={{ gridTemplateColumns: `90px repeat(${days.length}, 1fr)` }}>

                <div className="tl-time-h">Time</div>

                {days.map((day) => {

                  const d = new Date(day);

                  const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });

                  const dayNum = d.getDate();

                  const monthShort = d.toLocaleDateString("en-GB", { month: "short" });

                  return (

                    <div key={day} className="tl-day">

                      <span className="name">{weekday}</span>

                      <div className="date">{dayNum}<span className="lbl">{monthShort}</span></div>

                    </div>

                  );

                })}

              </div>



              <div className="tl-body" data-day={String(activeDayIdx)}>

                {hours.map((hour) => (

                  <div key={hour} className="tl-row" style={{ gridTemplateColumns: `90px repeat(${days.length}, 1fr)` }}>

                    <div className="tl-time">{String(hour).padStart(2, "0")}:00</div>

                    {days.map((day) => {

                      const sessions = sessionsByDayHour[`${day}-${hour}`] ?? [];

                      return (

                        <div key={day} className="slot">

                          {sessions.map((s, idx) => {

                            const cls = s.isMasterclass ? "master" : s.type === "party" ? "party" : "";

                            const pillLabel = s.isMasterclass ? "Master" : s.type === "party" ? "Party" : "Class";

                            const instructors = s.instructors.map((i) => i.displayName).filter(Boolean).join(" \u00b7 ");

                            const startTimeStr = extractTimeHHMM(s.startTime);

                            const endTimeStr = extractTimeHHMM(s.endTime);

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

                      <div className="v-img" style={{ backgroundImage: `url(${venue.imageUrl})` }} />

                    ) : (

                      <div className="v-img no-photo" />

                    )}

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

                          <span className="l">min walk to {venueStation.station}</span>

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

                      <div className="o-avatar" style={{ backgroundImage: `url(${organiser.avatarUrl})` }} />

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



      {/* ABOUT -- collapsible description */}

      {fullDescription && (

        <section className="about">

          <div className="about-wrap">

            <div className="about-label">&mdash; About the festival &mdash;</div>

            <div className="about-text">{descExpanded ? fullDescription : descPreview}</div>

            {hasMoreDescription && (

              <button type="button" className="about-toggle" onClick={() => setDescExpanded((v) => !v)}>

                {descExpanded ? "Show less \u2191" : "Read more \u2192"}

              </button>

            )}

          </div>

        </section>

      )}



      {/* TICKETS */}

      {ticketUrl && (

        <section className="tickets">

          <div className="lab">Now Booking</div>

          <h2>Reserve Your Pass.</h2>

          {festivalDetail && festivalDetail.passes.length > 0 ? (

            <>

              <div className="ticket-grid">

                {festivalDetail.passes.map((pass) => (

                  <a

                    key={pass.id}

                    href={ticketUrl}

                    target="_blank"

                    rel="noopener noreferrer"

                    className="tix"

                    style={{ textDecoration: 'none', color: 'inherit' }}

                  >

                    <div className="n">{pass.name}</div>

                    <div className="p">

                      {pass.price % 1 === 0 ? pass.price : pass.price.toFixed(2)}

                    </div>

                    {pass.description && <div className="d">{pass.description}</div>}

                  </a>

                ))}

              </div>

              <div className="end-cta">

                <a href={ticketUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">

                  Get Tickets

                </a>

              </div>

            </>

          ) : (

            <div className="end-cta">

              <a href={ticketUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">

                Get Tickets

              </a>

            </div>

          )}

        </section>

      )}



      <footer>

        <div className="x">&mdash; {organiser?.displayName ?? "Festival"} &middot; {festival.name} &mdash;</div>

      </footer>



      <StickyTicketButton ticketUrl={festival?.ticket_url ?? null} />

    </div>

  );

};



const FestivalDetail = ({ snapshot }: FestivalDetailInnerProps) => (

  <PageErrorBoundary>

    <FestivalDetailInner snapshot={snapshot} />

  </PageErrorBoundary>

);



export default FestivalDetail;

