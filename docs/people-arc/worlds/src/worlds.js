// People arc P2b -- the three worlds. render(personKey, role, filler) returns the page body.
// One frame (real site header, Back + Share, role tabs) is shared; each world owns everything below it.
/* global PEOPLE, ROLE_LABEL, tabsOf, hasTabRow, urlOf, initialsOf, namesOf, cityOf, languageLine, countryOf,
   flagOf, upcomingOf, playedOf, dateLabel, monthLabel, timeLabel, dayNum, countLabel, subLine, otherWorlds,
   socialsFor, defaultFiller */
/* eslint-disable no-unused-vars */

const HEAD_H = 106;
const FOOT_H = { 390: 483, 360: 480 };
const SHARE_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>';
const ARROW = '<span aria-hidden="true" class="arr">&rsaquo;</span>';

const flag = (p) => (p.nationality ? `<span class="flag" role="img" aria-label="${countryOf(p)}">${flagOf(p)}</span>` : '');
/** One placeholder family: a circle with initials in Inter 800, coloured by the world. */
const face = (p, name, cls) => (p.photo
  ? `<div class="face ${cls} photo" data-photo="1"><span>photo</span></div>`
  : `<div class="face ${cls}" aria-hidden="true"><b>${initialsOf(name)}</b></div>`);

// ---- shared frame ----
function frame(p, role) {
  const tabs = hasTabRow(p)
    ? `<nav class="tabs" role="tablist" aria-label="Roles">${tabsOf(p).map((r) => `<a role="tab" href="${urlOf(p, r)}" class="tab t-${r}${r === role ? ' on' : ''}" aria-selected="${r === role}">${r === role ? '' : '<i class="dot"></i>'}${ROLE_LABEL[r]}</a>`).join('')}</nav>`
    : '';
  return `<div class="topbar"><a class="back" href="/" data-action>&larr;&nbsp;Back</a><button class="share" data-action>${SHARE_SVG}&nbsp;Share</button></div>${tabs}`;
}

const contactRow = (p, label) => (p.website
  ? `<a class="contact" href="https://${p.website}" data-action><span class="k">${label}</span><span class="v">${p.website}</span>${ARROW}</a>` : '');

// ---- dancer world: the teal card ----
function dancerLower(p, filler) {
  if (filler === 1) {
    const rows = socialsFor(p);
    if (!rows.length) return '';
    const days = [...new Set(rows.map((r) => r.at.slice(0, 10)))];
    return `<section class="d-sec"><h2>Socials in ${cityOf(p)} this week</h2>${days.map((d) => `<h3>${dateLabel(d)}</h3>${rows.filter((r) => r.at.startsWith(d)).map((r) => `<a class="d-row" href="/calendar" data-action><b class="tm">${timeLabel(r.at)}</b><span><b>${r.event}</b><small>${r.venue}</small></span>${ARROW}</a>`).join('')}`).join('')}<a class="d-all" href="/calendar?type=party" data-action>All socials this week</a></section>`;
  }
  if (filler === 2) {
    const ws = otherWorlds(p, 'dancer');
    if (!ws.length) return '';
    return `<section class="d-sec"><h2>${p.name.split(' ')[0]} also</h2>${ws.map((w) => `<a class="peek peek-${w.role}" href="${w.href}" data-action><span class="pk">${ROLE_LABEL[w.role]}</span><span class="pl"><b>${w.line || `${ROLE_LABEL[w.role]} page`}</b>${w.next ? `<small>${w.next.event} &middot; ${w.next.venue}</small>` : ''}</span>${ARROW}</a>`).join('')}</section>`;
  }
  return '';
}
function dancerWorld(p, filler) {
  const n = namesOf(p, 'dancer');
  const langs = languageLine(p);
  return `<div class="d-card"><div class="kick">DANCER</div>${face(p, n.big, 'd-face')}
    <h1 class="d-name">${n.big}${flag(p)}</h1>${subLine(p) ? `<p class="d-sub">${subLine(p)}</p>` : ''}
    ${langs ? `<div class="d-rule"></div><div class="kick">SPEAKS</div><p class="d-langs">${langs}</p>` : ''}</div>
    ${contactRow(p, 'Contact')}${dancerLower(p, filler)}`;
}

// ---- DJ world: the record sleeve ----
function djWorld(p) {
  const n = namesOf(p, 'dj');
  const up = upcomingOf(p, 'dj');
  const played = playedOf(p, 'dj');
  const kick = [cityOf(p) ? cityOf(p).toUpperCase() : null].filter(Boolean).join('');
  const count = countLabel(up.length, 'gigs coming up');
  return `<div class="s-hero"><div class="vinyl"><div class="label">${face(p, n.big, 's-face')}</div></div>
    ${kick || p.nationality ? `<div class="s-kick">${kick}${flag(p)}</div>` : ''}
    <h1 class="s-name">${n.big}</h1>${n.small ? `<p class="s-real">${n.small}</p>` : ''}
    ${count ? `<p class="s-count">${count}</p>` : ''}</div>
    ${up.length ? `<section class="s-sec"><h2>Upcoming</h2>${up.map((g, i) => `<a class="s-row${i === 0 ? ' first' : ''}" href="/event" data-action><span class="s-day">${dayNum(g.at)}</span><span class="s-txt"><small>${dateLabel(g.at)} &middot; ${timeLabel(g.at)}</small><b>${g.event}</b><i>${g.venue}</i></span>${ARROW}</a>`).join('')}</section>` : ''}
    ${played.length ? `<section class="s-sec"><h2>Played at</h2><div class="s-played">${played.map((x) => `<a class="rec" href="/event" data-action><small>${monthLabel(x.at)}</small><b>${x.event}</b></a>`).join('')}</div></section>` : ''}
    ${!up.length && !played.length ? `<a class="s-cta" href="/calendar?type=party" data-action>Parties this week</a>` : ''}
    ${contactRow(p, `Book ${n.big}`)}`;
}

// ---- teacher world: the studio timetable ----
function teacherWorld(p) {
  const n = namesOf(p, 'teacher');
  const up = upcomingOf(p, 'teacher');
  const langs = languageLine(p);
  const lines = [cityOf(p) && `Teaches in ${cityOf(p)}`, langs && `Speaks ${langs}`].filter(Boolean);
  return `<div class="t-paper"><div class="t-band"><span>TEACHER</span><i class="holes" aria-hidden="true"></i></div>
    <div class="t-body">${face(p, n.big, 't-face')}<div class="t-id"><h1 class="t-name">${n.big}${flag(p)}</h1>${lines.map((l) => `<p class="t-line">${l}</p>`).join('')}</div></div></div>
    ${up.length ? `<section class="t-sec"><h2>${up.length >= 2 ? 'Next classes' : 'Next class'}</h2>${up.map((c) => `<a class="t-row" href="/event" data-action><span class="t-time">${timeLabel(c.at)}</span><span class="t-txt"><b>${dateLabel(c.at)}</b><small>${c.event} &middot; ${c.venue}</small></span>${ARROW}</a>`).join('')}</section>`
    : `<a class="t-cta" href="/calendar?type=class" data-action>Classes this week</a>`}
    ${contactRow(p, `Learn with ${n.big.split(' ')[0]}`)}`;
}

function render(personKey, role, filler) {
  const p = PEOPLE[personKey];
  const f = role === 'dancer' ? (filler || defaultFiller(p, role)) : null;
  const body = role === 'dj' ? djWorld(p) : role === 'teacher' ? teacherWorld(p) : dancerWorld(p, f);
  return `<div class="site-head" aria-label="site header (live pixels)"></div>
  <main class="world w-${role}${f === 3 ? ' short' : ''}" data-filler="${f || ''}">${frame(p, role)}<div class="stage">${body}</div></main>
  <div class="site-foot" aria-label="site footer (live pixels)"></div>`;
}
