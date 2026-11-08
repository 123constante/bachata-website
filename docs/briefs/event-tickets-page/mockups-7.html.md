# Mockups round seven (HTML source)
```html
<title>Event Tickets Round Six</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
<style>
/* Layout: sideways rows of 392px phone frames, grouped by buyer moment. Amber bottom bar with a dark button, big drawn ticket symbols picked from the ticket name, the night's programme shown once at the top. Look: site tokens, dark only by choice. */
:root{
  --ground:#101F1C; --input:#0B1513; --raised:#1A2E2A; --hair:rgba(179,138,78,.22); --edge:#93794A;
  --brass:#B38A4E; --cream:#D8CCB0; --muted:#A59474; --cta:#FF9900; --cta-ink:#1A0A04;
  --white:#FFFFFF; --off:#9AA39C; --link:#D2A767; --good:#8FD6A8; --bad:#FF8A7A; --bad-bg:#3A1A17; --ok-bg:#12301F;
  --body:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif;
  color-scheme:dark;
}
*{box-sizing:border-box}
body{background:var(--input);color:var(--cream);font-family:var(--body);font-size:13px;line-height:1.45;
  padding-inline:max(16px,env(safe-area-inset-left,0px)) max(16px,env(safe-area-inset-right,0px));padding-block:20px 48px}
h1,h2,h3{font-weight:800;letter-spacing:-.02em;margin:0;text-wrap:balance;color:var(--white);line-height:1.15}
h1{font-size:28px} h2{font-size:20px} h3{font-size:15px}
p{margin:0}
.wrap{max-width:900px;margin:0 auto;display:flex;flex-direction:column;gap:30px}
.sec{display:flex;flex-direction:column;gap:10px;min-width:0}
.note{color:var(--muted);font-size:13px;max-width:68ch}
.rec{background:var(--ground);border:1px solid var(--hair);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px}
.rec b{color:var(--white)}
.row{display:flex;gap:16px;overflow-x:auto;padding-bottom:12px;align-items:flex-start;scroll-snap-type:x proximity}
.cap{font-size:12px;color:var(--brass);font-weight:700;margin-bottom:6px}
.fr{flex:0 0 392px;scroll-snap-align:start;min-width:0}
.ph{width:392px;min-height:560px;background:var(--ground);border:1px solid var(--hair);border-radius:20px;overflow:hidden;display:flex;flex-direction:column;position:relative}
svg.i{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;flex:none}
.nav{display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid var(--hair);min-height:64px}
.back{width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-size:22px;color:var(--white);flex:none}
.nav .t{flex:1;min-width:0}
.nav b{display:block;color:var(--white);font-size:14px;line-height:1.25}
.nav span.s{font-size:12px;color:var(--cream);display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.inf{width:44px;height:44px;display:flex;align-items:center;justify-content:center;color:var(--cream)}
.tools{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid var(--hair);gap:8px}
.tools .l{font-size:13px;color:var(--muted)}
.pill{min-height:44px;display:inline-flex;align-items:center;gap:6px;padding:0 14px;border-radius:999px;border:1.5px solid var(--cream);color:var(--white);font-weight:700;font-size:13px}
.prog{padding:10px 12px;border-bottom:1px solid var(--hair);display:flex;flex-direction:column;gap:6px}
.prog .h{font-size:12px;color:var(--muted);font-weight:600}
.prog .it{display:flex;align-items:center;gap:8px;color:var(--white);font-size:13px}
.prog .it svg.i{color:var(--cream)}
.prog .it span.tm{color:var(--cream);min-width:112px}
.rows{display:flex;flex-direction:column}
.rw{display:grid;grid-template-columns:64px minmax(0,1fr) auto;gap:12px;padding:12px;border-bottom:1px solid var(--hair);align-items:center}
.rw.sel{background:rgba(255,153,0,.12);box-shadow:inset 3px 0 0 var(--cta)}
.rw.off{color:var(--off)}
.tile{width:64px;height:64px;border-radius:14px;border:1px solid var(--hair);display:flex;align-items:center;justify-content:center;color:var(--white);position:relative}
.tile svg.i{width:32px;height:32px;stroke-width:1.6}
.tile.pty{background:linear-gradient(150deg,#3C2A57,#1E1730)}
.tile.cls{background:linear-gradient(150deg,#244B40,#142A24)}
.tile.both{background:linear-gradient(150deg,#3C2A57 0 50%,#244B40 50%)}
.tile.vip{background:linear-gradient(150deg,#5A431C,#2B2010)}
.tile.free{background:linear-gradient(150deg,#245A38,#12301F)}
.tile.early{background:linear-gradient(150deg,#6A4A14,#33240A)}
.tile.gen{background:linear-gradient(150deg,#2D3F3A,#1A2A26)}
.rw.off .tile{filter:grayscale(1);opacity:.6}
.tile .ck{position:absolute;right:-6px;bottom:-6px;width:22px;height:22px;border-radius:50%;background:var(--cta);color:var(--cta-ink);display:flex;align-items:center;justify-content:center;border:2px solid var(--ground)}
.tile .ck svg.i{width:12px;height:12px;stroke-width:3}
.rw b.n{display:block;color:var(--white);font-size:14px;line-height:1.25}
.rw.off b.n{color:var(--off)}
.rw .sub{display:block;font-size:12px;color:var(--muted)}
.rw .end{display:flex;align-items:center;gap:4px;margin-top:4px;font-size:12px;color:var(--cream)}
.rw .end svg.i{width:13px;height:13px;color:var(--muted)}
.pr{text-align:right;white-space:nowrap}
.pr b{display:block;font-size:16px;font-weight:800;color:var(--white)}
.pr small{display:block;font-size:12px;color:var(--good)}
.pr .tag{font-size:12px;font-weight:700;color:var(--off)}
.fl{display:flex;flex-direction:column;gap:4px;padding:12px}
.fl .l{font-size:12px;color:var(--muted);font-weight:600}
.fld{min-height:48px;border-radius:12px;border:1.5px solid var(--edge);background:var(--input);padding:0 12px;display:flex;align-items:center;font-size:14px;color:var(--cream)}
.link{display:inline-flex;align-items:center;min-height:44px;padding:0 12px;color:var(--link);text-decoration:underline;font-size:13px;font-weight:600}
.sp{height:calc(86px + env(safe-area-inset-bottom,0px))}
.bar{margin-top:auto;border-radius:18px 18px 0 0;padding:12px 14px calc(14px + env(safe-area-inset-bottom,0px));display:flex;align-items:center;justify-content:space-between;gap:12px;background:#FF9900;color:#1A0A04}
.bar .p{font-size:20px;font-weight:800;line-height:1.1}
.bar .s{font-size:12px;margin-top:2px;color:#3A2200;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}
.btn{min-height:48px;flex:none;border-radius:999px;border:0;font:700 15px/1.1 var(--body);display:flex;align-items:center;justify-content:center;padding:0 22px;text-align:center;background:#1A0A04;color:#FFD08A}
.bar.quiet{background:#243B36;color:var(--white);border-top:2px solid var(--edge)}
.bar.quiet .s{color:var(--muted)}
.bar.quiet .btn{background:transparent;color:var(--cream);border:1.5px solid var(--edge)}
.bar.quiet .btn.off{color:var(--off);border-color:var(--hair)}
.pg{padding:14px;display:flex;flex-direction:column;gap:12px}
.big{font-size:26px;font-weight:800;color:var(--white);line-height:1.1;letter-spacing:-.02em}
.meta{font-size:13px;color:var(--cream)}
.qr{width:240px;height:240px;background:#fff;padding:12px;border-radius:10px;display:grid;grid-template-columns:repeat(21,1fr);align-self:center}
.qr i{background:#fff}.qr i.k{background:#101010}
.code{font-family:ui-monospace,Menlo,monospace;font-size:20px;letter-spacing:.2em;color:var(--white);text-align:center}
.pager{display:flex;align-items:center;justify-content:center;gap:4px}
.pager span{min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;color:var(--white);font-size:20px}
.pager em{font-style:normal;font-weight:700;color:var(--white);min-width:56px;text-align:center}
.card{background:var(--raised);border:1px solid var(--hair);border-radius:16px;padding:12px;display:flex;flex-direction:column;gap:6px;color:var(--muted)}
.card b{color:var(--white)}
.card .go{min-height:44px;border-radius:999px;border:1.5px solid var(--cta);color:var(--cta);display:flex;align-items:center;justify-content:center;font-weight:700;margin-top:6px}
.two{display:flex;gap:8px}.two>*{flex:1}
.btn2{min-height:44px;border-radius:999px;border:1.5px solid var(--cta);color:var(--cta);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;padding:0 10px;text-align:center}
.cta2{min-height:48px;border-radius:999px;background:var(--cta);color:var(--cta-ink);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;padding:0 16px}
.msg{border-radius:12px;padding:12px;font-size:13px;background:var(--raised);border:1px solid var(--hair);color:var(--cream)}
.msg b{color:var(--white)}
.msg.bad{background:var(--bad-bg);border-color:var(--bad);color:#FFD9D3}.msg.bad b{color:#FFD9D3}
.door{flex:1;min-height:560px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px;text-align:center}
.door.bad{background:var(--bad-bg);color:#FFD9D3}.door.bad .big{color:#FFD9D3}
.door.ok{background:var(--ok-bg);color:#CFF5DD}.door.ok .big{color:#CFF5DD}
.door .cta2{width:100%;margin-top:12px}
.step{display:flex;align-items:center;gap:4px}
.step span{width:44px;height:44px;border-radius:50%;border:1px solid var(--edge);background:var(--ground);display:flex;align-items:center;justify-content:center;font-size:20px}
.step em{min-width:36px;text-align:center;font-style:normal;font-weight:700}
.qrow{display:flex;align-items:center;justify-content:space-between;color:var(--white);font-weight:600}
.cmp{width:100%;border-collapse:collapse;font-size:13px}
.cmp th,.cmp td{border:1px solid var(--hair);padding:8px;text-align:left;vertical-align:top;min-width:140px}
.cmp th{background:var(--ground);color:var(--white)}
.scroll{overflow-x:auto}
.sym{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px}
.sym div{background:var(--ground);border:1px solid var(--hair);border-radius:10px;padding:10px;display:flex;align-items:center;gap:10px;font-size:13px;color:var(--white)}
.sym .tile{width:48px;height:48px;border-radius:12px}.sym .tile svg.i{width:24px;height:24px}
.gtk{padding:10px 12px 12px;border-bottom:1px solid var(--hair);display:flex;flex-direction:column;gap:8px}
.gtk .h{font-size:12px;color:var(--muted);font-weight:600}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:0;padding:0;list-style:none}
.chip{min-height:32px;display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:8px;background:var(--raised);border:1px solid var(--hair);color:var(--white);font-size:13px;font-weight:600;max-width:100%;white-space:normal}
.chip svg.i{width:15px;height:15px;color:var(--brass)}
.chip.must{border:2px solid var(--white);font-weight:800}
.chip.must svg.i{color:var(--white)}
.rule{font-size:12px;color:var(--muted);padding:0 12px 10px}
:focus-visible{outline:2px solid var(--cta);outline-offset:2px}
</style>

<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="party" viewBox="0 0 24 24"><path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/></symbol>
  <symbol id="class" viewBox="0 0 24 24"><ellipse cx="8" cy="8" rx="2.600" ry="4.200" transform="rotate(-12 8 8)"/><ellipse cx="16" cy="16" rx="2.600" ry="4.200" transform="rotate(-12 16 16)"/></symbol>
  <symbol id="both" viewBox="0 0 24 24"><path d="M8 18V7l9-2v11"/><circle cx="5.500" cy="18" r="2.200"/><circle cx="14.500" cy="16" r="2.200"/><path d="M20 3v5M17.500 5.500h5"/></symbol>
  <symbol id="vip" viewBox="0 0 24 24"><path d="M12 3l2.700 5.600 6.100.9-4.400 4.300 1 6.100L12 17l-5.400 2.900 1-6.100L3.200 9.500l6.100-.9z"/></symbol>
  <symbol id="free" viewBox="0 0 24 24"><path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.500" cy="8.500" r="1.200"/></symbol>
  <symbol id="early" viewBox="0 0 24 24"><path d="M3 18h18M7 18a5 5 0 0 1 10 0"/><path d="M12 5v3M5 9l2 2M19 9l-2 2"/></symbol>
  <symbol id="pass" viewBox="0 0 24 24"><path d="M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4z"/><path d="M9 6v12" stroke-dasharray="2 2"/></symbol>
  <symbol id="cal" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></symbol>
  <symbol id="info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.500v.5"/></symbol>
  <symbol id="tick" viewBox="0 0 24 24"><path d="M5 12.500l4.500 4.500L19 7.500"/></symbol>
  <symbol id="clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></symbol>
  <symbol id="idc" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.6-1.600 1.700-2.400 3-2.400s2.400.8 3 2.400M14.500 10h4M14.500 13.500h3"/></symbol>
  <symbol id="glass" viewBox="0 0 24 24"><path d="M5 4h14l-7 8z"/><path d="M12 12v7M8 20h8"/></symbol>
  <symbol id="hanger" viewBox="0 0 24 24"><path d="M12 8a2 2 0 1 1 2-2c0 1-2 1.500-2 3"/><path d="M12 9l-9 7.500c-.6.5-.3 1.500.5 1.500h17c.8 0 1.100-1 .5-1.500z"/></symbol>
  <symbol id="floor" viewBox="0 0 24 24"><path d="M3 9l9-5 9 5-9 5z"/><path d="M3 14l9 5 9-5"/></symbol>
  <symbol id="note" viewBox="0 0 24 24"><path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/></symbol>
  <symbol id="park" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M10 16V8h3a2.500 2.500 0 0 1 0 5h-3"/></symbol>
</svg>

<div class="wrap">

<header class="sec">
  <h1>Event tickets: round six</h1>
  <p class="note"><b style="color:var(--white)">New in round seven (round six plus critique fixes: full weekday names, chips are rounded rectangles, ID chip white not amber, ticket glyph on the deadline, a realistic one-chip frame, long text wraps). Round six notes follow:</b> a "Good to know" block under the programme on the Tickets page (section 2b), drawn three ways: everything known, some things known, nothing known. Everything else is round five unchanged.</p>
  <p class="note">Amber bar with a dark button. Bigger ticket symbols chosen from the ticket's name. The night's programme shown once at the top. Then the thank-you, My tickets and door screens redrawn in the same style. Examples with 2026 dates. Swipe each row sideways.</p>
  <div class="rec">
    <p><b>Where the row facts come from:</b> the event already has a programme in the database, so nothing new is typed. The Tickets page lists the night's items with their times, for example "Class 8:00pm" and "Party 9:00pm to 2:00am". It hides itself when an event has no programme. Per ticket, the organiser can add one optional line such as "Includes the beginners class". That one line is the only new field, and a row without it simply shows no line (the default, drawn in most frames). The programme block lists items in time order, items with no saved time last as "Time to be confirmed", the plain type when no level is saved, a real date as its title, and at most four items before a "See full programme" link.</p>
    <p><b>Symbols:</b> picked from the ticket's name. "Early bird" gets the sunrise, "class and party" gets the note with a plus, "VIP" the star, "free" the tick, and so on. Anything unmatched gets the plain ticket icon, so a wrong guess is rare and never silent. Matching is on whole words only, and "free" comes from the price being zero, never from the name. The tile is 64px, like Viagogo's picture, and sits on a tinted square so rows are easy to tell apart.</p>
    <p><b>No bottom sheet anywhere:</b> the door's "Admit without ticket" is a full page now.</p>
  </div>
</header>

<section class="sec">
  <h2>1. The event page bar</h2>
  <p class="note">The bar is amber only when there is something to press. When tickets are sold out, not open or unavailable, the bar turns quiet (dark green, grey button) so it never invites a press it can't honour. Sold out is a disabled button. "See other nights" appears there only when the event has other nights. "Already bought" also carries a small quiet "Buy more tickets" link under the bar line. "No booking fees" is said once, on the Tickets page header, and is generated from the fee setting being zero, so it vanishes on its own if a fee is ever added.</p>
  <div class="row">
    <div class="fr"><div class="cap">On sale</div><div class="ph"><div class="pg"><div class="meta">Event page content as today</div></div><div class="bar"><div><div class="p">From £8</div><div class="s">Early bird ends Wednesday 11 November</div></div><div class="btn">Buy tickets</div></div></div></div>
    <div class="fr"><div class="cap">Free event</div><div class="ph"><div class="pg"><div class="meta">Event page content as today</div></div><div class="bar"><div><div class="p">Free</div><div class="s">Sunday 15 November</div></div><div class="btn">Reserve free ticket</div></div></div></div>
    <div class="fr"><div class="cap">Already bought</div><div class="ph"><div class="pg"><div class="meta">Event page content as today</div></div><div class="bar"><div><div class="p">You're going</div><div class="s">2 tickets</div></div><div class="btn">Your tickets</div></div></div></div>
    <div class="fr"><div class="cap">Paused by the organiser</div><div class="ph"><div class="pg"><div class="meta">Event page content as today</div></div><div class="bar quiet"><div><div class="p">Tickets unavailable</div><div class="s">Check back later or contact the organiser.</div></div><div class="btn off">Unavailable</div></div></div></div>
    <div class="fr"><div class="cap">On-site tickets and an outside link</div><div class="ph"><div class="pg"><div class="meta">Event page content as today</div><div class="msg">Also available at partner-site.com ↗ (a small line near the end of the page; on-site tickets win the bar)</div></div><div class="bar"><div><div class="p">From £8</div><div class="s">Early bird ends Wednesday 11 November</div></div><div class="btn">Buy tickets</div></div></div></div>
    <div class="fr"><div class="cap">Sold out</div><div class="ph"><div class="pg"><div class="meta">Event page content as today</div></div><div class="bar quiet"><div><div class="p">Sold out</div><div class="s">Friday 20 November</div></div><div class="btn off">Sold out</div></div></div></div>
    <div class="fr"><div class="cap">Sales not open yet</div><div class="ph"><div class="pg"><div class="meta">Event page content as today</div></div><div class="bar quiet"><div><div class="p">Opens Monday 9 November</div><div class="s">Tickets go on sale at 6:00pm</div></div><div class="btn off">Not yet</div></div></div></div>
    <div class="fr"><div class="cap">Sales closed</div><div class="ph"><div class="pg"><div class="meta">Event page content as today</div></div><div class="bar quiet"><div><div class="p">Sales closed</div><div class="s">Friday 13 November</div></div><div class="btn off">Closed</div></div></div></div>
  </div>
</section>

<section class="sec">
  <h2>2. The Tickets page</h2>
  <div class="row">

    <div class="fr"><div class="cap">Several types, with the night's programme</div><div class="ph">
      <div class="nav"><span class="back" aria-label="Back">‹</span><div class="t"><b>Friday Social Night</b><span class="s">Friday 13 November · 8:00pm</span><span class="s">The Studio, 14 Dean St, London</span></div><span class="inf"><svg class="i"><use href="#info"/></svg></span></div>
      <div class="prog"><span class="h">Friday 13 November</span>
        <div class="it"><svg class="i"><use href="#class"/></svg><span class="tm">8:00pm</span>Class · Beginners</div>
        <div class="it"><svg class="i"><use href="#party"/></svg><span class="tm">9:00pm to 2:00am</span>Party</div><div class="it"><svg class="i"><use href="#party"/></svg><span class="tm">Time to be confirmed</span>Live performance</div><span class="h">Which of these a ticket covers is set by the organiser.</span></div>
      <div class="tools"><span class="l">Choose a ticket · No booking fees</span><span class="pill" role="button" aria-label="Quantity: 2 tickets, change"><svg class="i"><use href="#pass"/></svg>2 tickets</span></div>
      <div class="rows" role="radiogroup" aria-label="Ticket type">
        <div class="rw sel"><span class="tile early"><svg class="i"><use href="#early"/></svg><span class="ck"><svg class="i"><use href="#tick"/></svg></span></span><div><b class="n">Early bird · Party</b><span class="end"><svg class="i"><use href="#cal"/></svg>Ends Wednesday 11 November</span></div><div class="pr"><b>£8</b></div></div>
        <div class="rw"><span class="tile pty"><svg class="i"><use href="#party"/></svg></span><div><b class="n">Party</b></div><div class="pr"><b>£12</b></div></div>
        <div class="rw"><span class="tile both"><svg class="i"><use href="#both"/></svg></span><div><b class="n">Class + party</b><span class="sub">Includes the beginners class</span></div><div class="pr"><b>£15</b></div></div>
        <div class="rw off"><span class="tile vip"><svg class="i"><use href="#vip"/></svg></span><div><b class="n">VIP table</b></div><div class="pr"><span class="tag">Sold out</span></div></div>
      </div>
      <div class="fl"><span class="l">Email (your tickets are sent here)</span><div class="fld">sam@example.com</div></div>
      <span class="link">Have a promo code?</span>
      <div class="sp"></div>
      <div class="bar"><div><div class="p" aria-live="polite">£16.00</div><div class="s">2 × Early bird · Party</div></div><div class="btn">Continue to pay</div></div>
    </div></div>

    <div class="fr"><div class="cap">One type, no programme saved</div><div class="ph">
      <div class="nav"><span class="back">‹</span><div class="t"><b>Salsa and Bachata Social</b><span class="s">Saturday 14 November · 9:00pm</span><span class="s">Club Havana, 3 Mill Rd, London</span></div><span class="inf"><svg class="i"><use href="#info"/></svg></span></div>
      <div class="tools"><span class="l">Your ticket</span><span class="pill" role="button" aria-label="Quantity: 1 ticket, change"><svg class="i"><use href="#pass"/></svg>1 ticket</span></div>
      <div class="rows">
        <div class="rw sel"><span class="tile gen"><svg class="i"><use href="#pass"/></svg><span class="ck"><svg class="i"><use href="#tick"/></svg></span></span><div><b class="n">Entry</b><span class="end"><svg class="i"><use href="#cal"/></svg>Ends Saturday 14 November, 6pm</span></div><div class="pr"><b>£10</b></div></div>
      </div>
      <div class="fl"><span class="l">Email (your ticket is sent here)</span><div class="fld" style="color:var(--muted)">you@example.com</div></div>
      <span class="link">Have a promo code?</span>
      <div class="sp"></div>
      <div class="bar"><div><div class="p" aria-live="polite">£10.00</div><div class="s">1 × Entry</div></div><div class="btn">Continue to pay</div></div>
    </div></div>

    <div class="fr"><div class="cap">Free event</div><div class="ph">
      <div class="nav"><span class="back">‹</span><div class="t"><b>Sunday Beginners Class</b><span class="s">Sunday 15 November · 4:00pm</span><span class="s">The Studio, 14 Dean St, London</span></div><span class="inf"><svg class="i"><use href="#info"/></svg></span></div>
      <div class="prog"><span class="h">Sunday 15 November</span><div class="it"><svg class="i"><use href="#class"/></svg><span class="tm">4:00pm to 5:00pm</span>Class · Beginners</div></div>
      <div class="tools"><span class="l">Your ticket</span><span class="pill" role="button" aria-label="Quantity: 1 ticket, change"><svg class="i"><use href="#pass"/></svg>1 ticket</span></div>
      <div class="rows">
        <div class="rw sel"><span class="tile free"><svg class="i"><use href="#free"/></svg><span class="ck"><svg class="i"><use href="#tick"/></svg></span></span><div><b class="n">Free ticket</b></div><div class="pr"><b>Free</b></div></div>
      </div>
      <div class="fl"><span class="l">Email (your ticket is sent here)</span><div class="fld" style="color:var(--muted)">you@example.com</div></div>
      <div class="sp"></div>
      <div class="bar"><div><div class="p" aria-live="polite">Free</div><div class="s">1 ticket</div></div><div class="btn">Reserve free ticket</div></div>
    </div></div>

  </div>
  <p class="note">Quantity opens inline under the pill, with − and + up to 20 and the message "20 is the most you can buy at once", as drawn in round four. The email error, keyboard, signed-in and promo-code states from rounds three and four apply unchanged. Back from Stripe after cancelling: "Payment cancelled. You weren't charged. Your tickets are held until 8:12pm." Hold ran out: "Your tickets were released. Choose your tickets again."</p>
</section>

<section class="sec">
  <h2>2b. Good to know (new)</h2>
  <p class="note">A short row of facts under the programme, so a stranger knows what the night is like before paying. Each chip shows only when the fact is known. A missing fact leaves no gap and no "No bar": the chip simply isn't there. When nothing is known the whole block, heading included, is hidden. Chips are information, not buttons, so nothing here is tappable and nothing invites a press.</p>
  <div class="rec">
    <p><b>Order and wording (fixed, so every event reads the same way):</b> event length ("5 hours"), photo ID ("Bring photo ID", only when the venue says ID is required, and outlined in white and bold (amber is kept for actions) because it can stop someone getting in), bar ("Bar"), cloakroom ("Cloakroom"), floor ("[Type] floor", e.g. "Wooden floor" or "Sprung floor"; an unrecognised value shows its saved text), music ("Bachata · Salsa", at most three styles then "+2"), ticket deadline ("Tickets until Friday 13 November, 8pm"), parking ("Parking nearby" or the venue's own short note).</p>
    <p><b>Where each value comes from:</b> length from the night's start and end, else the programme's first start to last end; ID, bar, cloakroom, floor and parking from the venue, with bar and cloakroom falling back to the venue's facilities list; music from the event, else the programme items; deadline from the latest ticket close time, else the event start. A "false" bar or cloakroom is treated the same as unknown: hidden.</p>
  </div>
  <div class="row">

    <div class="fr"><div class="cap">Everything known</div><div class="ph">
      <div class="nav"><span class="back" aria-label="Back">‹</span><div class="t"><b>Friday Social Night</b><span class="s">Friday 13 November · 8:00pm</span><span class="s">The Studio, 14 Dean St, London</span></div><span class="inf"><svg class="i"><use href="#info"/></svg></span></div>
      <div class="prog"><span class="h">Friday 13 November</span>
        <div class="it"><svg class="i"><use href="#class"/></svg><span class="tm">8:00pm</span>Class · Beginners</div>
        <div class="it"><svg class="i"><use href="#party"/></svg><span class="tm">9:00pm to 1:00am</span>Party</div></div>
      <div class="gtk"><span class="h" id="gtk1">Good to know</span>
        <ul class="chips" aria-labelledby="gtk1">
          <li class="chip"><svg class="i"><use href="#clock"/></svg>5 hours</li>
          <li class="chip must"><svg class="i"><use href="#idc"/></svg>Bring photo ID</li>
          <li class="chip"><svg class="i"><use href="#glass"/></svg>Bar</li>
          <li class="chip"><svg class="i"><use href="#hanger"/></svg>Cloakroom</li>
          <li class="chip"><svg class="i"><use href="#floor"/></svg>Wooden floor</li>
          <li class="chip"><svg class="i"><use href="#note"/></svg>Bachata · Salsa</li>
          <li class="chip"><svg class="i"><use href="#pass"/></svg>Tickets until Friday 13 November, 8pm</li>
          <li class="chip"><svg class="i"><use href="#park"/></svg>Parking nearby</li>
        </ul></div>
      <div class="tools"><span class="l">Choose a ticket · No booking fees</span><span class="pill" role="button" aria-label="Quantity: 1 ticket, change"><svg class="i"><use href="#pass"/></svg>1 ticket</span></div>
      <div class="rows" role="radiogroup" aria-label="Ticket type">
        <div class="rw sel"><span class="tile pty"><svg class="i"><use href="#party"/></svg><span class="ck"><svg class="i"><use href="#tick"/></svg></span></span><div><b class="n">Party</b></div><div class="pr"><b>£12</b></div></div>
        <div class="rw"><span class="tile both"><svg class="i"><use href="#both"/></svg></span><div><b class="n">Class + party</b></div><div class="pr"><b>£15</b></div></div>
      </div>
      <div class="fl"><span class="l">Email (your tickets are sent here)</span><div class="fld" style="color:var(--muted)">you@example.com</div></div>
      <div class="sp"></div>
      <div class="bar"><div><div class="p" aria-live="polite">£12.00</div><div class="s">1 × Party</div></div><div class="btn">Continue to pay</div></div>
    </div></div>

    <div class="fr"><div class="cap">Some things known</div><div class="ph">
      <div class="nav"><span class="back" aria-label="Back">‹</span><div class="t"><b>Salsa and Bachata Social</b><span class="s">Saturday 14 November · 9:00pm</span><span class="s">Club Havana, 3 Mill Rd, London</span></div><span class="inf"><svg class="i"><use href="#info"/></svg></span></div>
      <div class="prog"><span class="h">Saturday 14 November</span>
        <div class="it"><svg class="i"><use href="#party"/></svg><span class="tm">9:00pm to 1:00am</span>Party</div></div>
      <div class="gtk"><span class="h" id="gtk2">Good to know</span>
        <ul class="chips" aria-labelledby="gtk2">
          <li class="chip"><svg class="i"><use href="#clock"/></svg>4 hours</li>
          <li class="chip"><svg class="i"><use href="#glass"/></svg>Bar</li>
          <li class="chip"><svg class="i"><use href="#note"/></svg>Bachata · Salsa</li>
          <li class="chip"><svg class="i"><use href="#pass"/></svg>Tickets until Saturday 14 November, 6pm</li>
        </ul></div>
      <div class="tools"><span class="l">Your ticket · No booking fees</span><span class="pill" role="button" aria-label="Quantity: 1 ticket, change"><svg class="i"><use href="#pass"/></svg>1 ticket</span></div>
      <div class="rows">
        <div class="rw sel"><span class="tile gen"><svg class="i"><use href="#pass"/></svg><span class="ck"><svg class="i"><use href="#tick"/></svg></span></span><div><b class="n">Entry</b></div><div class="pr"><b>£10</b></div></div>
      </div>
      <div class="fl"><span class="l">Email (your ticket is sent here)</span><div class="fld" style="color:var(--muted)">you@example.com</div></div>
      <div class="sp"></div>
      <div class="bar"><div><div class="p" aria-live="polite">£10.00</div><div class="s">1 × Entry</div></div><div class="btn">Continue to pay</div></div>
    </div></div>

    <div class="fr"><div class="cap">Only the deadline known (the realistic minimum)</div><div class="ph">
      <div class="nav"><span class="back" aria-label="Back">&lsaquo;</span><div class="t"><b>Sunday Beginners Class</b><span class="s">Sunday 15 November &middot; 4:00pm</span><span class="s">The Studio, 14 Dean St, London</span></div><span class="inf"><svg class="i"><use href="#info"/></svg></span></div>
      <div class="gtk"><span class="h" id="gtk4">Good to know</span>
        <ul class="chips" aria-labelledby="gtk4"><li class="chip"><svg class="i"><use href="#pass"/></svg>Tickets until Sunday 15 November, 4pm</li></ul></div>
      <div class="tools"><span class="l">Your ticket</span><span class="pill" role="button" aria-label="Quantity: 1 ticket, change"><svg class="i"><use href="#pass"/></svg>1 ticket</span></div>
      <div class="rows"><div class="rw sel"><span class="tile free"><svg class="i"><use href="#free"/></svg><span class="ck"><svg class="i"><use href="#tick"/></svg></span></span><div><b class="n">Free ticket</b></div><div class="pr"><b>Free</b></div></div></div>
      <div class="sp"></div>
      <div class="bar"><div><div class="p">Free</div><div class="s">1 ticket</div></div><div class="btn">Reserve free ticket</div></div>
    </div></div>

    <div class="fr"><div class="cap">Nothing known (cannot happen in practice: the deadline chip always has the event start)</div><div class="ph">
      <div class="nav"><span class="back" aria-label="Back">‹</span><div class="t"><b>Sunday Beginners Class</b><span class="s">Sunday 15 November · 4:00pm</span><span class="s">The Studio, 14 Dean St, London</span></div><span class="inf"><svg class="i"><use href="#info"/></svg></span></div>
      <div class="tools"><span class="l">Your ticket</span><span class="pill" role="button" aria-label="Quantity: 1 ticket, change"><svg class="i"><use href="#pass"/></svg>1 ticket</span></div>
      <div class="rows">
        <div class="rw sel"><span class="tile free"><svg class="i"><use href="#free"/></svg><span class="ck"><svg class="i"><use href="#tick"/></svg></span></span><div><b class="n">Free ticket</b></div><div class="pr"><b>Free</b></div></div>
      </div>
      <div class="fl"><span class="l">Email (your ticket is sent here)</span><div class="fld" style="color:var(--muted)">you@example.com</div></div>
      <div class="sp"></div>
      <div class="bar"><div><div class="p" aria-live="polite">Free</div><div class="s">1 ticket</div></div><div class="btn">Reserve free ticket</div></div>
    </div></div>

  </div>
</section>

<section class="sec">
  <h2>3. After paying</h2>
  <div class="row">

    <div class="fr"><div class="cap">Paid, 2 tickets</div><div class="ph"><div class="pg">
      <div class="big">You're in</div>
      <div class="meta">Friday Social Night · Friday 13 November · 8:00pm</div>
      <div class="qr" id="qr1" role="img" aria-label="Example QR code, ticket 1 of 2"></div>
      <div class="code">K7M2 9QXD</div>
      <div class="pager"><span aria-label="Previous ticket">‹</span><em>1 / 2</em><span aria-label="Next ticket">›</span></div>
      <div class="meta" style="text-align:center">Turn your screen brightness up at the door.</div>
      <div class="card"><b>The Studio, 14 Dean St, London W1</b><span>8:00pm class · 9:00pm party</span><div class="go">Get directions</div></div>
      <div class="two"><div class="btn2">Add to calendar</div><div class="btn2">Share event</div></div>
      <div class="two"><span class="link">All my tickets</span><span class="link">Back to the event</span></div>
    </div></div></div>

    <div class="fr"><div class="cap">Checking payment</div><div class="ph"><div class="pg">
      <div class="big">Checking your payment</div>
      <div class="msg" aria-busy="true">This usually takes a few seconds. Keep this page open. Your ticket is emailed as soon as it's confirmed.</div>
      <span class="link">Back to the event</span>
    </div></div></div>

    <div class="fr"><div class="cap">Taking longer than usual</div><div class="ph"><div class="pg">
      <div class="big">Still checking</div>
      <div class="msg"><b>This is taking longer than usual</b><br>Your payment is safe. If it goes through, we'll email your ticket to sam@example.com. You can close this page.</div>
      <div class="btn2">Check again</div>
      <span class="link">Contact the organiser</span>
    </div></div></div>

    <div class="fr"><div class="cap">Free ticket</div><div class="ph"><div class="pg">
      <div class="big">Ticket reserved</div>
      <div class="meta">Sunday Beginners Class · Sunday 15 November · 4:00pm</div>
      <div class="qr" id="qr2" role="img" aria-label="Example QR code"></div>
      <div class="code">B3HN 4TWE</div>
      <div class="card"><b>The Studio, 14 Dean St, London W1</b><div class="go">Get directions</div></div>
      <div class="two"><div class="btn2">Add to calendar</div><div class="btn2">Share event</div></div>
    </div></div></div>

    <div class="fr"><div class="cap">Payment failed</div><div class="ph"><div class="pg">
      <div class="big">Payment failed</div>
      <div class="msg bad" role="alert">We're holding your tickets until 8:12pm. If you were charged, we'll email you.</div>
      <div class="cta2">Back to the event to try again</div>
    </div></div></div>

  </div>
</section>

<section class="sec">
  <h2>4. My tickets</h2>
  <div class="row">
    <div class="fr"><div class="cap">My tickets</div><div class="ph"><div class="pg">
      <h3>My tickets</h3>
      <div class="cap" style="margin:0">Coming up</div>
      <div class="card"><b>Friday Social Night</b><span>Friday 13 November · 8:00pm · 2 tickets</span><div class="go">Show QR</div></div>
      <div class="card"><b>Sunday Beginners Class</b><span>Sunday 15 November · 4:00pm · 1 ticket</span><div class="go">Show QR</div></div>
      <div class="cap" style="margin:0">Past</div>
      <div class="card"><b>Friday Social Night</b><span>Friday 30 October · Checked in 8:42pm</span></div>
    </div></div></div>
    <div class="fr"><div class="cap">Find my tickets</div><div class="ph"><div class="pg">
      <h3>Find my tickets</h3>
      <p class="note">Enter the email you bought with. We'll send a link to your tickets.</p>
      <div class="fl" style="padding:0"><span class="l">Email</span><div class="fld" style="color:var(--muted)">you@example.com</div></div>
      <div class="cta2">Send me the link</div>
      <div class="msg">If that email has tickets, the link is on its way. Check spam too.</div>
    </div></div></div>
    <div class="fr"><div class="cap">No tickets yet</div><div class="ph"><div class="pg">
      <h3>My tickets</h3>
      <div class="msg"><b>No tickets yet</b><br>When you buy one it shows up here with its QR.</div>
      <div class="btn2">See what's on</div>
    </div></div></div>
  </div>
</section>

<section class="sec">
  <h2>5. At the door</h2>
  <p class="note">Open to anyone with the door link. The next action is always the one big button. A used ticket is refused with no override. "Admit without ticket" is a full page, because you don't want sheets.</p>
  <div class="row">
    <div class="fr"><div class="cap">Ready to scan</div><div class="ph"><div class="pg">
      <h3>Door · Friday Social Night</h3>
      <div class="card" style="min-height:230px;align-items:center;justify-content:center">Camera view</div>
      <div class="qrow"><span>Checked in tonight</span><b>86</b></div>
      <div class="btn2">Type a ticket code</div>
      <div class="btn2">Admit without ticket</div>
    </div></div></div>
    <div class="fr"><div class="cap">Camera blocked</div><div class="ph"><div class="pg">
      <h3>Door · Friday Social Night</h3>
      <div class="msg"><b>The camera is blocked</b><br>Allow camera access for this site in your phone settings, then come back. You can still type a ticket code.</div>
      <div class="cta2">Type a ticket code</div>
    </div></div></div>
    <div class="fr"><div class="cap">Ticket OK</div><div class="ph"><div class="door ok"><div class="big">Let them in</div><div>1 ticket · Early bird · Party</div><div style="font-size:13px">1 of 2 in this order scanned</div><div class="cta2">Scan next</div></div></div></div>
    <div class="fr"><div class="cap">Already used: refused</div><div class="ph"><div class="door bad" role="alert"><div class="big">Already used</div><div>Scanned at 8:42pm. Don't let them in.</div><div class="cta2">Scan next</div></div></div></div>
    <div class="fr"><div class="cap">Wrong event</div><div class="ph"><div class="door bad" role="alert"><div class="big">Not for tonight</div><div>This ticket is for Sunday Beginners Class on 15 Nov.</div><div class="cta2">Scan next</div></div></div></div>
    <div class="fr"><div class="cap">Not valid</div><div class="ph"><div class="door bad" role="alert"><div class="big">Not a valid ticket</div><div>We couldn't read this ticket, or it was refunded or cancelled. Don't let them in until the organiser checks.</div><div class="cta2">Scan next</div></div></div></div>
    <div class="fr"><div class="cap">Admit without ticket (full page)</div><div class="ph">
      <div class="nav"><span class="back">‹</span><div class="t"><b>Admit without ticket</b><span class="s">Friday Social Night</span></div></div>
      <div class="pg">
        <div class="qrow"><span>People</span><div class="step"><span>−</span><em>1</em><span>+</span></div></div>
        <div class="fl" style="padding:0"><span class="l">Note (optional)</span><div class="fld" style="color:var(--muted)">e.g. paid cash</div></div>
        <div class="msg">Counts toward tonight's total. No payment is recorded.</div>
      </div>
      <div class="sp"></div>
      <div class="bar"><div><div class="p">1 person</div><div class="s">No ticket</div></div><div class="btn">Admit</div></div>
    </div></div>
    <div class="fr"><div class="cap">Walk-up admitted</div><div class="ph"><div class="door ok"><div class="big">Admitted</div><div>1 person · paid cash</div><div style="font-size:13px">Checked in tonight: 87</div><div class="cta2">Scan next</div></div></div></div>
    <div class="fr"><div class="cap">Door link expired</div><div class="ph"><div class="pg"><h3>Door link expired</h3><div class="msg"><b>This door link has stopped working</b><br>Ask the organiser for a new one.</div></div></div></div>
  </div>
</section>

<section class="sec">
  <h2>6. Ticket symbols (picked from the name)</h2>
  <div class="sym">
    <div><span class="tile pty"><svg class="i"><use href="#party"/></svg></span>"party", "social"</div>
    <div><span class="tile cls"><svg class="i"><use href="#class"/></svg></span>"class", "lesson"</div>
    <div><span class="tile both"><svg class="i"><use href="#both"/></svg></span>"class + party", "class and social"</div>
    <div><span class="tile early"><svg class="i"><use href="#early"/></svg></span>"early bird"</div>
    <div><span class="tile vip"><svg class="i"><use href="#vip"/></svg></span>"vip", "table"</div>
    <div><span class="tile free"><svg class="i"><use href="#free"/></svg></span>price is £0 (not the name)</div>
    <div><span class="tile gen"><svg class="i"><use href="#pass"/></svg></span>anything else</div>
  </div>
  <p class="note">I cut the set from eleven to seven. The student, couple, group and workshop icons were weak guesses at that size. Those ticket types simply get the plain ticket icon next to a clear name. Matching is on whole words in the name, in this order: a price of zero means free; then early bird; then VIP; then class with party or social; then class; then party or social. "Night" and "table" are not triggers, so "Classic bachata night" and "Timetable" get the plain ticket. "Early bird class + party" keeps the sunrise, the same as "Early bird · Party".</p>
</section>

</div>

<script>
(function(){
  function qr(id,seed){
    var el=document.getElementById(id); if(!el) return;
    var n=21, s=seed, out='';
    function r(){ s=(s*1103515245+12345)&0x7fffffff; return s/0x7fffffff; }
    function finder(x,y){ var fx=[[0,0],[n-7,0],[0,n-7]]; for(var i=0;i<3;i++){var a=fx[i][0],b=fx[i][1]; if(x>=a&&x<a+7&&y>=b&&y<b+7){var dx=x-a,dy=y-b; return (dx==0||dx==6||dy==0||dy==6||(dx>=2&&dx<=4&&dy>=2&&dy<=4))?1:0;} if(x>=a-1&&x<a+8&&y>=b-1&&y<b+8) return 0;} return -1; }
    for(var y=0;y<n;y++) for(var x=0;x<n;x++){ var f=finder(x,y); var k=f>=0?f:(r()>0.5?1:0); out+='<i class="'+(k?'k':'')+'"></i>'; }
    el.innerHTML=out;
  }
  qr('qr1',7); qr('qr2',19);
})();
</script>
```
