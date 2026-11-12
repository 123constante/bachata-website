// Direction C -- "Next date first": a slim name strip, pill tabs, then the next date as the hero.
const F = 'Inter,system-ui,sans-serif';
const DIR = {
  letter: 'C',
  name: 'Next date first',
  pitch: 'The page answers "where can I see them next?" before anything else. The name is a slim strip with a small photo or initials, the roles are pills, and the next gig or class is the big block on the first screen, with one button to open it. Later dates follow as a short list. When the calendar has nothing, the page turns into a short fact sheet and a list of things you can do, each a full-width row.',
  page(p, role) {
    const t = TILE[role];
    const ink = CHIP[role].bg;
    const up = role === 'dancer' ? [] : upcomingOf(p, role);
    const facts = role === 'dancer' ? dancerFacts(p) : [];
    const tabs = hasTabRow(p) ? `<nav role="tablist" aria-label="Roles" style="display:flex;gap:6px;padding:0 12px 10px;">${tabsOf(p).map((r) => {
      const on = r === role;
      return `<a role="tab" aria-selected="${on}" href="${urlOf(p, r)}" style="min-width:64px;min-height:44px;display:flex;align-items:center;justify-content:center;padding:0 14px;border-radius:999px;font:700 14px/1 ${F};text-decoration:none;${on ? `background:${CHIP[r].bg};color:${CHIP[r].text};` : `border:1px solid ${WALL.line};color:${WALL.text};`}">${ROLE_LABEL[r]}</a>`;
    }).join('')}</nav>` : '';
    const strip = `<div style="display:flex;align-items:center;gap:10px;padding:12px;">
      ${avatar(p, role, 48, 12)}
      <div style="min-width:0;"><h1 style="font:800 20px/1.15 ${F};color:${WALL.text};margin:0;overflow-wrap:anywhere;">${p.name}</h1>
      <div style="font:600 13px/1.3 ${F};color:${ink};margin-top:2px;">${kickerOf(p, role)}</div></div></div>`;
    let body = '';
    if (up.length) {
      const [n, ...later] = up;
      body += `<section style="margin:0 12px;background:${t.bg};border-radius:14px;padding:12px;border:1px solid ${t.edge};">
        <div style="font:700 12px/1 ${F};letter-spacing:0.6px;text-transform:uppercase;color:${t.ink};">${role === 'dj' ? 'Next gig' : 'Teaching next'}${countLabel(up.length) ? ` &middot; ${countLabel(up.length)}` : ''}</div>
        <div style="font:800 20px/1.2 ${F};color:${GOLD};margin-top:8px;">${dateLabel(n.at)}</div>
        <div style="font:800 17px/1.25 ${F};color:${WALL.text};margin-top:4px;">${n.event}</div>
        <div style="font:500 14px/1.3 ${F};color:${t.ink};margin-top:2px;">${timeLabel(n.at)} &middot; ${n.venue}</div>
        <a data-action href="#event" style="margin-top:10px;min-height:44px;display:flex;align-items:center;justify-content:center;border-radius:10px;background:${CHIP[role].bg};color:${CHIP[role].text};font:800 15px/1 ${F};text-decoration:none;">Open event</a></section>`;
      if (later.length) {
        body += `<section style="margin:12px 12px 0;"><h2 style="font:700 12px/1 ${F};letter-spacing:0.6px;text-transform:uppercase;color:${WALL.muted};margin:0 0 6px;">Later</h2>
          ${later.map((g) => `<a href="#event" style="display:flex;gap:10px;align-items:center;min-height:44px;padding:8px 0;border-top:1px solid ${WALL.line};text-decoration:none;">
            <span style="flex:none;width:96px;font:700 13px/1.25 ${F};color:${GOLD};">${dateLabel(g.at)}</span>
            <span style="min-width:0;"><span style="display:block;font:700 14px/1.25 ${F};color:${WALL.text};">${g.event}</span><span style="display:block;font:500 12px/1.25 ${F};color:${WALL.muted};">${timeLabel(g.at)} &middot; ${g.venue}</span></span></a>`).join('')}</section>`;
      }
    }
    if (facts.length) {
      body += `<dl style="margin:0 12px;background:${cardOf(role)};border-radius:14px;padding:4px 12px;">${facts.map((f, i) => `<div style="display:flex;justify-content:space-between;gap:12px;padding:10px 0;${i ? `border-top:1px solid ${WALL.line};` : ''}"><dt style="font:600 14px/1.3 ${F};color:${WALL.muted};">${f.k}</dt><dd style="margin:0;font:700 14px/1.3 ${F};color:${WALL.text};text-align:right;">${f.v}</dd></div>`).join('')}</dl>`;
    }
    const cal = calendarAction(p, role);
    const row = (label, attrs) => `<${attrs.tag} data-action ${attrs.href ? `href="${attrs.href}"` : ''} style="width:100%;min-height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;background:transparent;border:0;border-top:1px solid ${WALL.line};font:700 15px/1.2 ${F};color:${WALL.text};text-decoration:none;text-align:left;">${label}<span aria-hidden="true" style="color:${ink};font-size:18px;">&rsaquo;</span></${attrs.tag}>`;
    body += `<div style="margin-top:12px;border-bottom:1px solid ${WALL.line};">${up.length ? '' : row(cal.label, { tag: 'a', href: cal.href })}${row('Share this page', { tag: 'button' })}</div>`;
    return `<main>${strip}${tabs}${body}</main>`;
  },
  tile(p, role) {
    const up = role === 'dj' ? upcomingOf(p, 'dj') : [];
    return `<a href="#" style="display:block;text-decoration:none;min-height:44px;">
      <div style="aspect-ratio:1/1;border-radius:999px;overflow:hidden;border:2px solid ${TILE[role].edge};">${avatar(p, role, 'fill', 999, 24)}</div>
      <div style="font:700 11px/14px ${F};color:${WALL.text};margin-top:4px;text-align:center;overflow-wrap:anywhere;">${p.name}</div>
      ${up.length ? `<div style="font:700 10px/13px ${F};color:${GOLD};text-align:center;">${dateLabel(up[0].at)}</div>` : ''}
    </a>`;
  },
  og(p, role) {
    const up = role === 'dancer' ? [] : upcomingOf(p, role);
    return `<div style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;padding:0 18px;background:${groundOf(role)};border-left:8px solid ${CHIP[role].bg};">
      <div style="display:flex;align-items:center;gap:10px;">${avatar(p, role, 48, 12)}<div style="font:800 18px/1.15 ${F};color:${WALL.text};overflow-wrap:anywhere;">${p.name}</div></div>
      ${up.length ? `<div style="font:800 16px/1.2 ${F};color:${GOLD};margin-top:10px;">${dateLabel(up[0].at)}</div><div style="font:600 13px/1.25 ${F};color:${WALL.muted};">${up[0].event}</div>` : `<div style="font:700 13px/1.2 ${F};color:${CHIP[role].bg};margin-top:10px;">${ROLE_LABEL[role]}</div>`}</div>`;
  },
};
