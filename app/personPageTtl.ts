/**
 * The edge-TTL rule of the person pages (/dancers/:id and /people/:id), kept in ONE place (People arc
 * S7b, S7c): a degraded public-page read, or a person snapshot that is not complete -- it failed,
 * missed its deadline, or answered partial (a role read it swallows failed, so a tab may be missing)
 * -- is edge-cached for boundSeconds, never the full TTL. undefined = the full TTL.
 * The routes pass DEGRADED_EDGE_TTL_SECONDS: they are the dancer-app seam files, this one is not.
 */
export function personPageTtlBound(
  degraded: boolean,
  snapshotComplete: boolean,
  boundSeconds: number,
): { edgeTtlBoundSeconds: number } | undefined {
  return degraded || !snapshotComplete ? { edgeTtlBoundSeconds: boundSeconds } : undefined;
}
