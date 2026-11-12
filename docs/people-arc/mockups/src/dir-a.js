// Direction A -- "Name card": a compact identity card, a segmented tab bar, then plain lists.
const F = 'Inter,system-ui,sans-serif';
const DIR = {
  letter: 'A',
  name: 'Name card',
  pitch: 'A business card first. The photo or initials sit beside the name in one compact card, the roles are a full-width segmented bar under it, and everything below is a plain list of what the calendar knows. Thin people get a small, finished card and two clear actions; rich people get the same card with more rows. Nothing grows to fill space.',
  page(p, role) {
    const ink = CHIP[role].bg;
    const card = cardOf(role);
    const facts = role === 'dancer' ? dancerFacts(p) : [];
    const up = role === 'dancer' ? [] : upcomingOf(p, role);
    const tabs = hasTabRow(p) ? `<nav role="tablist" aria-label="Roles" style="display:flex;gap:4px;margin-top:8px;padding:3px;border-radius:12px;background:${WALL.card};border:1px solid ${WALL.line};">${tabsOf(p).map((r) => {
      const on = r === role;
      return `<a role="tab" aria-selected="${on}" href="${urlOf(p, r)}" style="flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;border-radius:9px;font:700 14px/1 ${F};text-decoration:none;${on ? `background:${CHIP[r].bg};color:${CHIP[r].text};` : `color:${WALL.text};`}">${ROLE_LABEL[r]}</a>`;
    }).join('')}</nav>` : '';
    const factList = facts.length ? `<section style="margin-top:12px;"><h2 style="font:700 12px/1 ${F};letter-spacing:0.6px;text-transform:uppercase;color:${ink};margin:0 0 6px;">About</h2>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;">${facts.map((f) => `<div style="background:${card};border-radius:10px;padding:8px;"><div style="font:600 12px/1.2 ${F};color:${WALL.muted};">${f.k}</div><div style="font:700 14px/1.25 ${F};color:${WALL.text};margin-top:3px;">${f.v}</div></div>`).join('')}</div></section>` : '';
    const dateList = up.length ? `<section style="margin-top:12px;"><h2 style="display:flex;justify-content:space-between;font:700 12px/1 ${F};letter-spacing:0.6px;text-transform:uppercase;color:${ink};margin:0 0 6px;"><span>${datesHeading[role]}</span>${countLabel(up.length) ? `<span style="color:${WALL.muted};letter-spacing:0;text-transform:none;font-weight:600;">${countLabel(up.length)}</span>` : ''}</h2>
      <div style="display:grid;gap:6px;">${up.map((g) => `<a href="#event" style="display:block;min-height:44px;background:${card};border-radius:10px;padding:8px 12px;text-decoration:none;border-left:3px solid ${TILE[role].edge};">
        <div style="font:700 13px/1.3 ${F};color:${GOLD};">${dateLabel(g.at)} &middot; ${timeLabel(g.at)}</div>
        <div style="font:700 15px/1.3 ${F};color:${WALL.text};margin-top:2px;">${g.event}</div>
        <div style="font:500 13px/1.3 ${F};color:${WALL.muted};margin-top:1px;">${g.venue}</div></a>`).join('')}</div></section>` : '';
    const cal = calendarAction(p, role);
    const actions = `<div style="display:grid;grid-template-columns:${up.length ? '1fr' : '1fr 1fr'};gap:8px;margin-top:12px;">
      ${up.length ? '' : `<a data-action href="${cal.href}" style="min-height:44px;display:flex;align-items:center;justify-content:center;text-align:center;padding:6px 10px;border-radius:10px;background:${CHIP[role].bg};color:${CHIP[role].text};font:700 14px/1.2 ${F};text-decoration:none;">${cal.label}</a>`}
      <button data-action style="min-height:44px;border-radius:10px;background:transparent;border:1px solid ${WALL.line};color:${WALL.text};font:700 14px/1 ${F};">Share</button></div>`;
    return `<main style="padding:12px;">
      <div style="display:flex;gap:12px;align-items:center;background:${card};border-radius:14px;padding:12px;border:1px solid ${mix(WALL.line, TILE[role].edge, 0.3)};">
        ${avatar(p, role, 72, 14)}
        <div style="min-width:0;">
          <h1 style="font:800 22px/1.15 ${F};color:${WALL.text};margin:0;overflow-wrap:anywhere;">${p.name}</h1>
          <div style="font:600 14px/1.3 ${F};color:${ink};margin-top:4px;">${kickerOf(p, role)}</div>
        </div>
      </div>
      ${tabs}${dateList}${factList}${actions}
    </main>`;
  },
  tile(p, role) {
    const up = role === 'dj' ? upcomingOf(p, 'dj') : [];
    return `<a href="#" style="display:block;text-decoration:none;min-height:44px;">
      <div style="aspect-ratio:1/1;">${avatar(p, role, 'fill', 12, 28)}</div>
      <div style="font:700 11px/14px ${F};color:${WALL.text};margin-top:4px;overflow-wrap:anywhere;">${p.name}</div>
      ${up.length ? `<div style="font:700 10px/13px ${F};color:${GOLD};">${dateLabel(up[0].at)}</div>` : `<div style="font:600 10px/13px ${F};color:${CHIP[role].bg};">${ROLE_LABEL[role]}</div>`}
    </a>`;
  },
  og(p, role) {
    return `<div style="width:100%;height:100%;display:flex;align-items:center;gap:14px;padding:0 18px;background:${groundOf(role)};">
      ${avatar(p, role, 96, 16)}
      <div style="min-width:0;"><div style="font:800 20px/1.15 ${F};color:${WALL.text};overflow-wrap:anywhere;">${p.name}</div>
      <div style="display:inline-block;margin-top:6px;padding:3px 8px;border-radius:999px;background:${CHIP[role].bg};color:${CHIP[role].text};font:700 12px/1.2 ${F};">${ROLE_LABEL[role]}</div></div></div>`;
  },
};
