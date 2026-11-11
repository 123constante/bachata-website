export interface DirectionLink {
  key: 'google' | 'apple' | 'citymapper' | 'uber';
  url: string;
}

/**
 * Destination text for the map apps: venue name first, so the app finds the
 * place itself rather than the street its address geocodes to (Holiday Inn
 * Birmingham M6 resolved to "Chapel Ln" from the address alone).
 */
export function directionsDestination(name: string, address: string): string {
  const n = name.trim();
  const a = address.trim();
  if (!n) return a;
  if (!a || a.toLowerCase() === n.toLowerCase()) return n;
  if (a.toLowerCase().startsWith(n.toLowerCase())) return a;
  return `${n}, ${a}`;
}

/** Only a real http(s) link is used; anything else falls back to the text query. */
function usableHref(href: string | null | undefined): string | null {
  const h = (href ?? '').trim();
  return /^https?:\/\//i.test(h) ? h : null;
}

export function buildDirectionLinks(input: {
  name: string;
  address: string;
  googleMapsHref?: string | null;
}): DirectionLink[] {
  const dest = directionsDestination(input.name, input.address);
  const enc = encodeURIComponent(dest);
  const encName = encodeURIComponent(input.name);
  return [
    {
      key: 'google',
      url:
        usableHref(input.googleMapsHref) ??
        `https://www.google.com/maps/dir/?api=1&destination=${enc}`,
    },
    { key: 'apple', url: `https://maps.apple.com/?daddr=${enc}` },
    {
      key: 'citymapper',
      url: `https://citymapper.com/directions?endname=${encName}&endaddress=${enc}`,
    },
    {
      key: 'uber',
      url: `https://m.uber.com/ul/?action=setPickup&dropoff[nickname]=${encName}&dropoff[formatted_address]=${enc}`,
    },
  ];
}
