// Pre-rendered basemap stills shown while the Leaflet map has not mounted yet
// (see HomeMapShell). Keyed by citySlug so each city can get its own still;
// cities without an entry fall back to today's plain dark box (no regression).
//
// RENDERED FROM THE LIVE PROVIDER, at the live default view -- Esri Dark Gray
// Base + Reference composited at centre 51.5085,-0.128, zoom 12.5 (EventMap.tsx
// LONDON / zoom default). That is the point of them, and it is a property that
// has to be MAINTAINED, not a one-off: the CARTO renders these replaced were a
// near-black z11 texture (luma 13.3) sitting in front of a mid-grey z12.5 map
// (luma 77), so mount flipped both tone and cartography. These measure 77.2
// (mobile) and 76.9 (desktop), i.e. the still, the .leaflet-container ground in
// homeMap.css and the first real tile are now one tone.
// Re-render, do not hand-edit, whenever the tile provider or the default view
// changes -- and move HomeMapShell's static credit with them. Generator and both
// quality steps: ~/.claude/plans/queued-home-map-esri-residuals.md item 4.
//
// STILL OPEN, AND NOT CLOSED BY THIS SWAP: we host CACHED, DERIVED basemap
// rasters here with no subscription of any kind. That was the exposure when
// they were CARTO renders -- the same one that put "API KEY REQUIRED" into
// production tiles -- and re-rendering them from Esri changes WHICH provider's
// terms are in question, not WHETHER caching them is permitted. Esri's ArcGIS
// Online terms are the ones to read now, and nobody has read them; treat this
// as unresolved rather than as fixed. Recording it here because the CARTO
// failure reached prod undetected by exactly this route -- HTTP 200, no error,
// no guard -- so the note is the only thing watching it.
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
