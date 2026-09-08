/**
 * serialiseJsonLd -- behaviour.
 *
 * The defect this exists to stop: JSON.stringify escapes neither `<` nor `/`,
 * so an organiser-supplied event name containing a closing script tag ended
 * the tag on a server-rendered page and everything after it parsed as HTML.
 *
 * NO REPO-WIDE CONTRACT TEST HERE, deliberately. A first draft asserted that
 * no file containing the literal "application/ld+json" calls JSON.stringify.
 * Review MUTATION-PROVED it blind: reverting src/lib/buildOrganizationJsonLd.ts
 * to raw JSON.stringify left this suite 6/6 green with zero FAIL lines,
 * because three of the four render helpers the fix touches never contain that
 * literal at all -- and they are the ones serialising the homepage's scripts
 * and the organiser-supplied breadcrumb name on every detail page. A guard
 * that cannot see the files it guards is worse than none, so it was deleted
 * rather than patched. See queued-jsonld-sink-ownership-guard.md.
 *
 * NOTE: this file deliberately contains no backslash literals. The escape it
 * asserts is built with String.fromCharCode(92), because a backslash does not
 * survive the write path to this mount reliably -- an earlier draft of this
 * very file was rejected by the parse check for exactly that.
 */
import { describe, expect, it } from 'vitest';
import { serialiseJsonLd } from '@/lib/serialiseJsonLd';

const BREAKOUT = 'Salsa </script><img src=x onerror=alert(document.cookie)>';
const ESCAPED = String.fromCharCode(92) + 'u003c';

describe('serialiseJsonLd', () => {
  it('escapes the sequence that closes the script tag', () => {
    const out = serialiseJsonLd({ name: BREAKOUT });
    expect(out).not.toContain('</script>');
    expect(out).not.toContain('<');
    expect(out).toContain(ESCAPED);
  });

  it('round-trips to the identical string, so consumers see the same data', () => {
    const value = { name: BREAKOUT, nested: { list: ['a<b', 'c'] } };
    expect(JSON.parse(serialiseJsonLd(value))).toEqual(value);
  });

  it('escapes EVERY `<`, not just the first', () => {
    const out = serialiseJsonLd({ a: '<<<', b: '<' });
    expect(out).not.toContain('<');
    expect(out.split(ESCAPED).length - 1).toBe(4);
  });

  it('leaves a payload with no `<` byte-identical to JSON.stringify', () => {
    const clean = { '@type': 'Event', name: 'Corito Bachatero' };
    expect(serialiseJsonLd(clean)).toBe(JSON.stringify(clean));
  });
});
