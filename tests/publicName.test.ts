import { describe, it, expect } from 'vitest';
import { resolvePublicName, renderPublicName } from '../src/lib/publicName';

// Both directions, per CLAUDE.md's guards law:
//   POSITIVE -- the resolver returns null on exactly the production rows that
//              rendered a placeholder or a UUID as an indexed <h1>/<title>.
//   NEGATIVE -- it does NOT return null on legitimate-but-unusual names, because
//              a resolver that over-rejects noindexes healthy profiles, which is
//              a worse outcome than the bug it replaces.
//   FIDELITY -- it returns the RIGHT name, not merely a non-null one.

const UUID = '7be16d15-2779-4be8-9ef6-809353520593';

describe('resolvePublicName -- the shapes that shipped soft 404s', () => {
  it('prefers display_name, where the 44 nameless dancer profiles keep their names', () => {
    // The exact production shape: DANCER_COLS omitted display_name, so the page
    // saw only first_name/surname (both null) and rendered "Dancer".
    expect(resolvePublicName({ id: UUID, display_name: 'Kike & Nahir', first_name: null, surname: null }))
      .toBe('Kike & Nahir');
  });

  it('rejects a display_name that IS the row id (get_public_dj_v1 COALESCEs to dp.id::text)', () => {
    // Measured on prod 2026-09-01: the RPC returns display_name = the UUID for
    // /djs/dj-chino-bzuk26. A UUID is truthy, so every `?? 'DJ'` guard passed it
    // through and buildSeoForRoute indexed it as the page's title.
    expect(resolvePublicName({ id: UUID, display_name: UUID, dj_name: null })).toBeNull();
  });

  it('rejects a UUID-shaped name even when it is NOT this row id', () => {
    // The id checks are independent on purpose: a joined person/profile split
    // gives two different uuids, and comparing only against source.id would let
    // the other one through. This case exercises the SHAPE check alone.
    expect(resolvePublicName({ id: 'abc', display_name: UUID })).toBeNull();
  });

  it('rejects a name equal to the row id even when the id is NOT UUID-shaped', () => {
    // This case exercises the EQUALITY check alone -- the other half of the
    // "belt-and-braces" claim in publicName.ts. Without it, every test that
    // reached the equality branch also had a UUID-shaped candidate, so the shape
    // check short-circuited first and a mutant deleting the equality comparison
    // passed all 16 tests (verified 2026-09-01). Half the resolver's documented
    // protection was asserted by prose only.
    expect(resolvePublicName({ id: 'abc', display_name: 'abc' })).toBeNull();
    // ...and case-insensitively, which is what the .toLowerCase() pair is for.
    expect(resolvePublicName({ id: 'AbC-123', display_name: 'abc-123' })).toBeNull();
    // Non-vacuity for this pair: the same shapes with a DIFFERENT id resolve
    // normally, so the assertions above are about the equality, not about 'abc'
    // being rejected for some unrelated reason.
    expect(resolvePublicName({ id: 'xyz', display_name: 'abc' })).toBe('abc');
  });

  it('treats whitespace-only as absent (melvin has first_name = " " on prod)', () => {
    expect(resolvePublicName({ id: UUID, first_name: ' ', surname: null })).toBeNull();
    expect(resolvePublicName({ id: UUID, display_name: '   ' })).toBeNull();
  });

  it('returns null -- never a placeholder -- when nothing resolves', () => {
    // This null is what makes buildSeoForRoute emit noindex. If it ever became
    // "Dancer"/"DJ"/"Organiser" again, the page would silently rejoin the index
    // as a duplicate-titled soft 404 and nothing else would notice.
    expect(resolvePublicName({ id: UUID })).toBeNull();
    expect(resolvePublicName({})).toBeNull();
  });
});

describe('resolvePublicName -- healthy-but-unusual names stay green', () => {
  it('keeps a single-word name', () => {
    expect(resolvePublicName({ id: UUID, first_name: 'Melvin', surname: null })).toBe('Melvin');
  });

  it('keeps a surname-only row', () => {
    expect(resolvePublicName({ id: UUID, first_name: null, surname: 'Nahir' })).toBe('Nahir');
  });

  it('keeps names with accents, punctuation and non-Latin scripts', () => {
    for (const n of ['Jos\u00e9 \u00c1ngel', "O'Brien", 'Ana-Mar\u00eda Ruiz', '\u9673\u5927\u6587', 'DJ 4Real']) {
      expect(resolvePublicName({ id: UUID, display_name: n })).toBe(n);
    }
  });

  it('keeps a hex-ish stage name that is not actually a UUID', () => {
    // Guards against a lazy /[0-9a-f-]+/ rejection rule.
    expect(resolvePublicName({ id: UUID, display_name: 'Ada Face' })).toBe('Ada Face');
    expect(resolvePublicName({ id: UUID, display_name: 'deadbeef' })).toBe('deadbeef');
  });

  it('keeps a name that merely CONTAINS a uuid rather than being one', () => {
    expect(resolvePublicName({ id: UUID, display_name: `Chino (${UUID})` })).toBe(`Chino (${UUID})`);
  });

  it('resolves an organiser through `name`, which is its only name column', () => {
    expect(resolvePublicName({ id: UUID, name: 'La Familia' })).toBe('La Familia');
  });

  it('trims, rather than rejects, a name with surrounding whitespace', () => {
    expect(resolvePublicName({ id: UUID, display_name: '  La Familia  ' })).toBe('La Familia');
  });
});

describe('resolvePublicName -- precedence', () => {
  it('display_name outranks dj_name, name, and first+surname', () => {
    expect(resolvePublicName({
      id: UUID, display_name: 'Curated', dj_name: 'Stage', name: 'Generic',
      first_name: 'First', surname: 'Last',
    })).toBe('Curated');
  });

  it('falls THROUGH a rejected higher-precedence candidate rather than giving up', () => {
    // The DJ case after the RPC is fixed vs before: a poisoned display_name must
    // not mask a perfectly good dj_name sitting behind it.
    expect(resolvePublicName({ id: UUID, display_name: UUID, dj_name: 'DJ Chino' })).toBe('DJ Chino');
    expect(resolvePublicName({ id: UUID, display_name: '  ', first_name: 'Ana', surname: 'Ruiz' }))
      .toBe('Ana Ruiz');
  });
});

describe('renderPublicName', () => {
  it('substitutes the fallback only when nothing resolves', () => {
    expect(renderPublicName({ id: UUID }, 'Dancer')).toBe('Dancer');
    expect(renderPublicName({ id: UUID, display_name: 'Ana' }, 'Dancer')).toBe('Ana');
  });

  it('never returns the id, whatever the fallback', () => {
    expect(renderPublicName({ id: UUID, display_name: UUID }, 'DJ')).toBe('DJ');
  });
});
