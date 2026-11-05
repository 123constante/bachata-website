# Handover: vercel-docs-only-no-deploy-1 (ticket dt_4b0c72c66476)

- Done: brief step 3. No safe mechanism stops a docs-only push to `main`
  from creating a Vercel deployment. The conclusion and evidence are in
  `docs/pr-batching-policy.md` ("Vercel build budget"). No config or script
  changed.
- Left: the worker network blocked vercel.com and api.vercel.com, so the
  Vercel docs were read only through search results and the API was never
  queried.
- Next steps (lead):
  1. Run the API one-liner in that section before and after the next
     docs-only merge (CANCELED +1 means a deployment was created).
  2. Run it again with the skip-tag `select` to see whether any past
     tagged commit created a deployment.
  3. Owner decision: deploy production from GitHub Actions with a `paths`
     filter. This is the only route that saves the deployment, and it
     changes how production ships.
