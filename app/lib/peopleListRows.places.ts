import { fetchDirectoryOrganisers } from "@/lib/organiserDirectoryList";
import { fetchPublicVenuesList } from "@/services/venuePublicService";
import type { PeopleRow } from "./peopleListRows";

const MAX_ROWS = 200;

// Same read as src/pages/Organisers.tsx (fetchDirectoryOrganisers, which already
// subtracts hidden pages); same href as the page card. Never throws.
export async function loadOrganiserRows(): Promise<PeopleRow[]> {
  try {
    const orgs = await fetchDirectoryOrganisers();
    return orgs.slice(0, MAX_ROWS).map((org) => ({
      name: org.name,
      href: org.slug ? `/organisers/${org.slug}` : `/organisers/${org.id}`,
    }));
  } catch {
    return [];
  }
}

// Same read as src/pages/Venues.tsx; London view is the page's untouched list
// (rowsForCity returns every row for London). Never throws.
export async function loadVenueRows(): Promise<PeopleRow[]> {
  try {
    const venues = await fetchPublicVenuesList();
    return venues.slice(0, MAX_ROWS).map((v) => ({
      name: v.name,
      href: `/venue-entity/${v.slug ?? v.id}`,
    }));
  } catch {
    return [];
  }
}
