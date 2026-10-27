/**
 * The teacher tip's Instagram rule behind ONE lazy edge (teacherListingLink in
 * listingRequestCopy.ts). A wrapper, not a re-export: a dynamic import of the
 * lib-org-ui member itself made rollup emit a namespace object into that
 * group, which /app loads.
 */
import { normalizeInstagramHandle, type InstagramResult } from '@/lib/instagramHandle';

export function teacherInstagramHandle(raw: string): InstagramResult {
  return normalizeInstagramHandle(raw);
}
