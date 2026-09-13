# Phase 1 Deployment Checklist

**Commit:** `bd49d05` — Phase 1 stabilization complete  
**Expected IO Reduction:** 70–85%  
**Status:** ✅ Pre-ship passed, ready to deploy

## Pre-Deployment (Local)

- [x] Run `npm run pre-ship` — all tests pass
- [x] Lint: no new errors in modified files
- [x] Feature flags working in dev (enabled by default)
- [x] Git history clean, commit message clear

## Deployment to Vercel

1. **Push to main**
   ```bash
   git push origin main
   ```
   This triggers CI workflows automatically.

2. **Set production env vars** in Vercel dashboard:
   - Go to Project Settings → Environment Variables
   - **Add/Confirm:**
     ```
     VITE_ENABLE_EVENT_TRACKING=false
     VITE_ENABLE_PROFILE_TRACKING=false
     ```
   - Leave both `false` in production
   - Leave both `true` (or unset) in development via `.env.development`

3. **Redeploy** (Vercel auto-triggers on git push, but you can manually trigger):
   - Visit: https://vercel.com/dashboard
   - Select project → Deployments → click latest → "Redeploy" (if needed)
   - Wait for build to complete (~3–5 min)

## Post-Deployment Monitoring (First 2 Hours)

1. **Check Supabase Disk IO**
   - Visit: https://app.supabase.com/project/[YOUR_PROJECT]/settings/billing/usage
   - Look for "Disk IO Budget" graph
   - **Expected:** Should drop 70–85% within 10–30 minutes
   - **Alert threshold:** If IO is still >50% of pre-Phase-1 level, investigate

2. **Verify no broken features**
   - [ ] Home page loads (fundraising / event listing still works)
   - [ ] Search works (not using profile tracking)
   - [ ] Event detail page loads (guest list should still work)
   - [ ] Raffle page loads and displays open raffles
   - [ ] No errors in browser console
   - [ ] No Sentry errors spiking

3. **User-facing verification**
   - Tracking disabled = no degradation to user experience
   - All features work normally
   - Page load times unchanged
   - Search results unchanged

## Rollback Plan (If Something Goes Wrong)

If Disk IO doesn't drop or something breaks:

1. **Quick toggle (no re-deploy):**
   ```
   Set VITE_ENABLE_EVENT_TRACKING=true in Vercel env
   Set VITE_ENABLE_PROFILE_TRACKING=true in Vercel env
   ```
   Vercel auto-redeploys with new env vars (~2 min)

2. **Full rollback (if needed):**
   ```bash
   git revert bd49d05
   git push origin main
   # Vercel redeploys automatically
   ```

## Success Criteria

✅ **Phase 1 is successful if:**
- Disk IO drops to <30% of pre-Phase-1 level (70%+ reduction)
- No user-facing features break
- No new errors in Sentry
- Search, events, raffles, profiles all work normally

## Next: Phase 2 (Week 2–3)

Once Phase 1 stabilizes for 24–48 hours:
- Move tracking to external storage (Vercel KV or S3)
- See: `PHASE-2-IMPLEMENTATION-PLAN.md`

---

## Questions?

- **What if Disk IO doesn't drop?** Check if flags are actually disabled in prod (`echo $VITE_ENABLE_EVENT_TRACKING` in deployed build)
- **Can I re-enable tracking before Phase 2?** Yes — just set env vars back to `true`. No code change needed.
- **Should I tell users about this?** No — this is an internal optimization, zero user impact.
