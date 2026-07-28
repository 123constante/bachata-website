// Pre-rendered dark-basemap stills shown while the Leaflet map has not mounted
// yet (see HomeMapShell). Keyed by citySlug so each city can get its own still;
// cities without an entry fall back to today's plain dark box (no regression).
export type MapPlaceholder = {
  mobile: string;
  desktop: string;
};

export const MAP_PLACEHOLDERS: Record<string, MapPlaceholder> = {
  'london-gb': {
    mobile: '/map-placeholder/london-gb-mobile.webp',
    desktop: '/map-placeholder/london-gb-desktop.webp',
  },
};
