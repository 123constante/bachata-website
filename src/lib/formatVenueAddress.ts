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
  const fieldPostcode = normalisePostcode(postcode);
  // City only counts as a duplicate after a comma, or when it is the whole string
  // ("Calle de Madrid" keeps its Madrid).
  const cityTail = city
    ? new RegExp(`(?:^|,)\\s*${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i')
    : null;
  let street = clean(address);
  let found = '';
  for (let prev = ''; prev !== street; ) {
    prev = street;
    const pc = UK_POSTCODE_TAIL.exec(street);
    if (pc) {
      if (!found) found = normalisePostcode(pc[0].replace(/^[,\s]+/, ''));
      street = street.replace(UK_POSTCODE_TAIL, '');
    }
    if (cityTail) street = street.replace(cityTail, '');
    street = street.replace(/[,\s]+$/, '').trim();
  }
  // The field wins; a postcode typed only into the address is lifted, not lost.
  const tail = [city, fieldPostcode || found].filter(Boolean).join(' ');
  const line = [street, tail].filter(Boolean).join(', ');
  return line || null;
};
