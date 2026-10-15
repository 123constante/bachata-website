/**
 * The accessible tree of a rendered screen as text: one line per node that has
 * a role or readable text -- role, accessible name, disabled, href. NOT raw
 * HTML: a class rename or a wrapper div changes nothing here, a changed word,
 * a control that disappears, a link that points elsewhere or a button that
 * becomes disabled changes a line. That is what a regression snapshot of
 * "today's behaviour" must pin.
 */
import { computeAccessibleName } from 'dom-accessibility-api';

const IMPLICIT_ROLE: Record<string, string> = {
  a: 'link', button: 'button', h1: 'heading', h2: 'heading', h3: 'heading', h4: 'heading',
  h5: 'heading', h6: 'heading', select: 'combobox', textarea: 'textbox', img: 'img',
  nav: 'navigation', main: 'main', header: 'banner', footer: 'contentinfo', form: 'form',
  dialog: 'dialog', ul: 'list', ol: 'list', li: 'listitem', table: 'table',
};

const INPUT_ROLE: Record<string, string> = {
  checkbox: 'checkbox', radio: 'radio', button: 'button', submit: 'button', reset: 'button',
  range: 'slider', number: 'spinbutton', search: 'searchbox', hidden: '',
};

const roleOf = (el: Element): string => {
  const explicit = el.getAttribute('role');
  if (explicit) return explicit.split(/\s+/)[0];
  const tag = el.tagName.toLowerCase();
  if (tag === 'a') return el.hasAttribute('href') ? 'link' : '';
  if (tag === 'input') return INPUT_ROLE[(el.getAttribute('type') ?? 'text').toLowerCase()] ?? 'textbox';
  return IMPLICIT_ROLE[tag] ?? '';
};

// Roles that only add noise as lines of their own (their text/children carry the content).
const STRUCTURAL = new Set(['list', 'listitem', 'main', 'banner', 'contentinfo', 'form', 'table', 'presentation', 'none']);

const LEAF = new Set(['button', 'link', 'radio', 'checkbox', 'heading', 'img', 'textbox', 'combobox', 'searchbox', 'switch', 'tab', 'option', 'slider', 'spinbutton', 'menuitem']);

const INLINE = new Set(['strong', 'b', 'em', 'i', 'span', 'code', 'small', 'u', 'mark', 'br', 'time']);
const isInlineText = (c: Element): boolean =>
  INLINE.has(c.tagName.toLowerCase()) && !c.getAttribute('role') && Array.from(c.children).every(isInlineText);

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

const hidden = (el: Element) =>
  el.getAttribute('aria-hidden') === 'true' || el.hasAttribute('hidden') || (el as HTMLElement).style?.display === 'none';

export function a11yTree(root: ParentNode = document.body): string {
  const lines: string[] = [];
  const walk = (el: Element, depth: number) => {
    if (hidden(el)) return;
    const tag = el.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'svg') return;
    const role = roleOf(el);
    let indent = depth;
    if (role && !STRUCTURAL.has(role)) {
      const bits = [role];
      const name = clean(computeAccessibleName(el));
      if (name) bits.push(JSON.stringify(name));
      if (role === 'heading') bits.push(`level=${tag.startsWith('h') && tag.length === 2 ? tag[1] : el.getAttribute('aria-level') ?? ''}`);
      if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') bits.push('[disabled]');
      const checked = el.getAttribute('aria-checked') ?? ((el as HTMLInputElement).checked ? 'true' : null);
      if (checked) bits.push(`[checked=${checked}]`);
      const pressed = el.getAttribute('aria-pressed');
      if (pressed) bits.push(`[pressed=${pressed}]`);
      const expanded = el.getAttribute('aria-expanded');
      if (expanded) bits.push(`[expanded=${expanded}]`);
      if (role === 'link' && el.getAttribute('href') !== null) bits.push(`href=${el.getAttribute('href')}`);
      if (tag === 'input' && role === 'textbox') bits.push(`value=${JSON.stringify((el as HTMLInputElement).value)}`);
      if ((el as HTMLInputElement).required) bits.push('[required]');
      lines.push(`${'  '.repeat(depth)}${bits.join(' ')}`);
      indent = depth + 1;
      const nested = el.querySelector('[role],a,button,input,select,textarea,h1,h2,h3,h4,h5,h6');
      if (LEAF.has(role) && !nested) return; // the name already carries the text
    }
    // A text block with inline-only children (<strong>, <span>...) reads as ONE line.
    if (!LEAF.has(role) && el.children.length > 0 && Array.from(el.children).every(isInlineText)) {
      const all = clean(el.textContent ?? '');
      if (all) lines.push(`${'  '.repeat(indent)}text ${JSON.stringify(all)}`);
      return;
    }
    // Own text nodes (direct children) that are not already a control's name.
    const own = clean(
      Array.from(el.childNodes)
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent ?? '')
        .join(' '),
    );
    if (own && !LEAF.has(role)) lines.push(`${'  '.repeat(indent)}text ${JSON.stringify(own)}`);
    for (const child of Array.from(el.children)) walk(child, indent);
  };
  for (const child of Array.from((root as Element).children ?? [])) walk(child, 0);
  return lines.join('\n');
}
