// Direction B -- "Role poster": a full-width hero in the role colour, underline tabs, 3-column date tiles.
const F = 'Inter,system-ui,sans-serif';
const DIR = {
  letter: 'B',
  name: 'Role poster',
  pitch: 'Each tab is a poster in its role colour. The hero band carries the photo or big initials, the name and the city, so the first screen looks designed even when that is all we know. Tabs are underlined words that sit at the foot of the hero. Dates become a 3-column grid of tiles, so three gigs fit in one row; the dancer facts are a row of chips.',
  page(p, role) {
    const t = TILE[role];
    const up = role === 'dancer' ? [] : upcomingOf(p, role);
    const facts = role === 'dancer' ? dancerFacts(p) : [];
    const tabs = hasTabRow(p) ? `<nav role="tablist" aria-label="Roles" style="display:flex;justify-content:center;gap:4px;margin-top:10px;">${tabsOf(p).map((r) => {
      const on = r === role;
      return `<a role="tab" aria-selected="${on}" href="${urlOf(p, r)}" style="min-width:72px;min-height:44px;display:flex;align-items:center;justify-content:center;padding:0 10px;font:${on ? 800 : 600} 15px/1 ${F};color:${on ? WALL.text : t.ink};text-decoration:none;border-bottom:3px solid ${on ? CHIP[role].bg : 'transparent'};">${ROLE_LABEL[r]}</a>`;
    }).join('')}</nav>` : '';
    const hero = `<section style="background:${t.bg};padding:16px 12px ${hasTabRow(p) ? 0 : 16}px;text-align:center;border-bottom:1px solid ${t.edge};">
      <div style="display:flex;justify-content:center;">${avatar(p, role, 112, 999)}</div>
      <h1 style="font:900 26px/1.12 ${F};color:${WALL.text};margin:10px 0 0;overflow-wrap:anywhere;">${p.name}</h1>
      <div style="font:600 14px/1.3 ${F};color:${t.ink};margin-top:4px;">${kickerOf(p, role)}</div>
      ${tabs}</section>`;
    const grid = up.length ? `<section style="padding:12px 12px 0;">
      <h2 style="display:flex;justify-content:space-between;align-items:baseline;font:800 15px/1.2 ${F};color:${WALL.text};margin:0 0 8px;"><span>${datesHeading[role]}</span>${countLabel(up.length) ? `<span style="font:600 13px/1 ${F};color:${WALL.muted};">${countLabel(up.length)}</span>` : ''}</h2>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;">${up.map((g) => `<a href="#event" style="display:flex;flex-direction:column;min-height:44px;background:${cardOf(role)};border-radius:10px;padding:8px;text-decoration:none;border-top:3px solid ${t.edge};">
        <span style="font:800 13px/1.2 ${F};color:${GOLD};">${dateLabel(g.at)}</span>
        <span style="font:600 12px/1.25 ${F};color:${WALL.muted};margin-top:2px;">${timeLabel(g.at)}</span>
        <span style="font:700 13px/1.25 ${F};color:${WALL.text};margin-top:6px;overflow-wrap:anywhere;">${g.event}</span>
        <span style="font:500 12px/1.25 ${F};color:${WALL.muted};margin-top:2px;">${g.venue}</span></a>`).join('')}</div></section>` : '';
    const chips = facts.length ? `<section style="padding:12px 12px 0;display:flex;flex-wrap:wrap;gap:6px;justify-content:center;">${facts.map((f) => `<span style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;background:${cardOf(role)};border:1px solid ${t.edge};font:600 13px/1.2 ${F};color:${WALL.muted};">${f.k}<b style="color:${WALL.text};font-weight:800;">${f.v}</b></span>`).join('')}</section>` : '';
    const cal = calendarAction(p, role);
    const actions = `<div style="padding:12px;display:flex;gap:8px;">
      ${up.length ? '' : `<a data-action href="${cal.href}" style="flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;text-align:center;padding:6px 10px;border-radius:999px;background:${CHIP[role].bg};color:${CHIP[role].text};font:800 14px/1.2 ${F};text-decoration:none;">${cal.label}</a>`}
      <button data-action style="${up.length ? 'flex:1;' : ''}min-width:88px;min-height:44px;border-radius:999px;background:transparent;border:1px solid ${t.edge};color:${WALL.text};font:700 14px/1 ${F};">Share</button></div>`;
    return `<main>${hero}${grid}${chips}${actions}</main>`;
  },
  tile(p, role) {
    const t = TILE[role];
    const up = role === 'dj' ? upcomingOf(p, 'dj') : [];
    return `<a href="#" style="display:flex;flex-direction:column;justify-content:flex-end;aspect-ratio:3/4;border-radius:12px;overflow:hidden;position:relative;text-decoration:none;background:${t.bg};">
      <div style="position:absolute;inset:0;">${avatar(p, role, 'fill', 0, 26)}</div>
      <div style="position:relative;background:${WALL.page};padding:4px 5px;">
        <div style="font:800 11px/14px ${F};color:${WALL.text};overflow-wrap:anywhere;">${p.name}</div>
        ${up.length ? `<div style="font:700 10px/13px ${F};color:${GOLD};">${dateLabel(up[0].at)}</div>` : `<div style="font:600 10px/13px ${F};color:${CHIP[role].bg};">${ROLE_LABEL[role]}</div>`}
      </div></a>`;
  },
  og(p, role) {
    const t = TILE[role];
    return `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:${t.bg};border-bottom:6px solid ${CHIP[role].bg};">
      ${avatar(p, role, 84, 999)}
      <div style="font:900 18px/1.15 ${F};color:${WALL.text};margin-top:8px;text-align:center;padding:0 12px;overflow-wrap:anywhere;">${p.name}</div>
      <div style="font:700 12px/1.2 ${F};color:${t.ink};margin-top:2px;">${ROLE_LABEL[role]}</div></div>`;
  },
};
