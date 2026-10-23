// ER-FIX2-S5, owner click F-C5-5 (binding): a NEW draft venue stores address = 'Area, POSTCODE',
// exactly the line the Add-a-venue sheet shows, never 'ward, district'.
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn() } }));

import * as postcode from '../postcode';
import { createVenueDraft } from '../venueApi';

const ok = (result: Record<string, unknown>) => async () => ({ ok: true, status: 200, json: async () => ({ result: { postcode: 'E1 6AN', latitude: 51.5, longitude: -0.07, ...result } }) });

describe('F-C5-5: the stored address is the sheet line', () => {
  it.each([
    ['ward and district', { admin_ward: 'Spitalfields', admin_district: 'Tower Hamlets' }, 'Spitalfields', 'Spitalfields, E1 6AN'],
    ['parish only (rural)', { parish: 'Hambleden', admin_district: 'Wycombe' }, 'Hambleden', 'Hambleden, E1 6AN'],
    ['district only', { admin_district: 'Tower Hamlets' }, 'Tower Hamlets', 'Tower Hamlets, E1 6AN'],
    ['no area at all', {}, '', 'E1 6AN'],
  ])('%s', async (_n, result, area, line) => {
    const r = await postcode.lookupPostcode('e16an', ok(result));
    expect(r.ok && r.found.area).toBe(area);
    expect(r.ok && r.found.address).toBe(line);
    expect(r.ok && postcode.placeLine(r.found)).toBe(line);
  });

  it('the create sends the sheet line as p_address even from a place read before the fix', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { venue_id: 'n1', existing: false }, error: null });
    await createVenueDraft('New', { postcode: 'E1 6AN', lat: 51.5, lng: -0.07, address: 'Spitalfields, Tower Hamlets', area: 'Spitalfields' }, rpc);
    expect(rpc.mock.calls[0][1].p_address).toBe('Spitalfields, E1 6AN');
    expect(rpc.mock.calls[0][1].p_area).toBe('Spitalfields');
  });
});
