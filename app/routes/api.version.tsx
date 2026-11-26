// /api/version -- RESOURCE ROUTE (loader only). Reports the live deployment id so
// an old tab can notice a newer deploy (app/lib/staleTab.ts). No DB call, never cached.
export function loader(): Response {
  return new Response(JSON.stringify({ id: process.env.VERCEL_DEPLOYMENT_ID ?? "" }), {
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store, max-age=0",
      "cdn-cache-control": "no-store",
      "vercel-cdn-cache-control": "no-store",
    },
  });
}
