// Pins this tab's lazy-chunk fetches to its own Vercel deployment (skew protection).
// Edge-cached documents cannot carry the server's Set-Cookie, so the client writes it.
export function setClientSkewCookie(opts: {
  enabled: boolean;
  deploymentId: string | undefined;
  flagOn: boolean;
}): void {
  if (typeof document === "undefined") return;
  if (!opts.enabled || !opts.flagOn || !opts.deploymentId) return;
  document.cookie = `__vdpl=${opts.deploymentId}; Path=/; SameSite=Strict; Secure`;
}
