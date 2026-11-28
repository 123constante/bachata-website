/**
 * One venue address line: `<street part>, <City> <POSTCODE>`.
 * Behind VITE_ENABLE_VENUE_ADD (default off = today's output exactly).
 */
export const VENUE_ADD_ENABLED = (): boolean => import.meta.env.VITE_ENABLE_VENUE_ADD === 'true';

const UK_POSTCODE_TAIL = /[,\s]*\b[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}\s*$/;
const UK_POSTCODE_LOOSE = /^([A-Za-z]{1,2}\d[A-Za-z\d]?)\s*(\d[A-Za-z]{2})$/;

const clean = (v: string | null | undefined): string => (v ?? '').replace(/\s+/g, ' ').trim();

export const normalisePostcode = (raw: string | null | undefined): string => {
  const s = clean(raw);
  if (!s) return '';
  const m = UK_POSTCODE_LOOSE.exec(s);
  return m ? `${m[1]} ${m[2]}`.toUpperCase() : s.toUpperCase();
};

export type VenueAddressInput = {
  address?: string | null;
  postcode?: string | null;
  cityName?: string | null;
};

export const formatVenueAddress = ({ address, postcode, cityName }: VenueAddressInput): string | null => {
  const city = clean(cityName);
  let street = clean(address);
  // A postcode already typed into the address is dropped; the field wins.
  street = street.replace(UK_POSTCODE_TAIL, '').trim();
  if (city) {
    const cityTail = new RegExp(`[,\\s]*\\b${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i');
    street = street.replace(cityTail, '').trim();
  }
  street = street.replace(/[,\s]+$/, '');
  const tail = [city, normalisePostcode(postcode)].filter(Boolean).join(' ');
  const line = [street, tail].filter(Boolean).join(', ');
  return line || null;
};
