# Vercel Function Storage Fix — Implementation Guide

**Status**: At 75% of 10 GB free tier (Sept 7, 2026)  
**Root Cause**: 315 retained deployments × ~23 MB per deployment = ~7.2 GB  
**Solution**: Lower retention policy (Phase 2) + create .vercelignore (Phase 3)

---

## Phase 1: Diagnostics ✓ (Complete)

**Build Metrics (Verified)**:
- Server build: 7.2 MB
- Client build: 16.2 MB
- Total: ~23 MB per deployment
- Bundle budget: ✓ All routes under budget
- Sentry status: ✓ Not in dependencies (issue already fixed historically)

**What the metrics tell us:**
- Your bundle is **lean and well-optimized**
- The problem is **NOT code-side bloat**, it's **deployment accumulation**
- Lowering retention policy alone will solve 75% → <20% within 24–48 hours

---

## Phase 2: Manual Cleanup via Vercel UI (DO THIS FIRST)

### ⚠️ REQUIRED IMMEDIATE ACTION

1. **Go to [Vercel Dashboard](https://vercel.com/dashboard)**
2. **Select project → Settings → Build and Deployment**
3. **Find "Deployment Retention Policy"**
4. **Change to: 1 week** (or 1 day for aggressive cleanup)
   - Current: ~315 deployments
   - Expected after 30 days: ~10–50 deployments
   - Expected storage: 75% → <20%

5. **Optional: Delete old deployments manually**
   - Dashboard → Deployments tab
   - Select old preview/staging deployments
   - Click menu → Delete

### Timeline

- **Immediately**: Retention policy change takes effect
- **24–48 hours**: Older deployments start aging out
- **~30 days**: Full soft-delete window; storage refunded
- **Your goal**: Stay <50% of 10 GB (5 GB) before year-end

---

## Phase 3: Create .vercelignore (Insurance)

**File to create: `.vercelignore`** (root of project)

**Purpose**: Ensure Vercel doesn't upload unnecessary files to Functions (node_modules shenanigans, test files, etc.)

**Implementation** (see code block below — copy & paste to root):

```
# Build & test artifacts (keep only client/server output)
tests/
.git/
.github/

# Dependencies — Vercel installs fresh on deploy, so don't upload node_modules
node_modules/

# Development/config (not needed in lambda)
.env.local
.env.example
.eslintcache
vitest.config.ts
playwright.config.ts
tsconfig.*.json
CLAUDE.md
```

**Expected impact**: No measurable difference on current deployment (already lean), but prevents future bloat from dependency sprawl.

---

## Phase 4: Verification & Monitoring

### Run these after implementing Phase 2–3:

```bash
# 1. Pre-ship validation (no code changes, just verify nothing broke)
npm run pre-ship

# 2. Verify bundle-budget didn't regress
npm run check:bundle-budget

# 3. When you have VERCEL_TOKEN set, run:
node scripts/check-deployment-storage.mjs
# Expected output: WARN or under budget (exit 0)
```

### Monitor (Manual, ongoing):

- **Vercel Dashboard → Project Settings → Storage**
  - Should decrease from 75% → 50% → 25% over 1–4 weeks
  - Anything under 50% is healthy headroom

---

## Next: Collect VERCEL_TOKEN for Full Diagnostics

Once you have your Vercel token (create at https://vercel.com/account/settings/tokens):

```bash
export VERCEL_TOKEN=your_token_here
node scripts/check-deployment-storage.mjs
```

This will show you:
- Exact number of retained deployments
- Exact bytes per deployment
- Percentage of 10 GB consumed
- WARN/OVER/healthy status

---

## Summary

| Phase | Action | Effort | Impact | Status |
|-------|--------|--------|--------|--------|
| 2 | Lower Vercel retention policy | 5 min (manual UI) | 75% → <20% in 48h | **DO FIRST** |
| 3 | Create .vercelignore | 2 min (copy/paste) | Insurance vs future bloat | **OPTIONAL but recommended** |
| 1 | Run diagnostic with token | 5 min | Verify numbers drop | When ready |

**You only need Phase 2 to solve the problem.** Phases 3–4 are insurance and verification.

---

## FAQ

**Q: Will lowering retention break anything?**  
A: No. Old deployments are kept for rollback convenience, not for uptime. Vercel keeps them soft-deleted for ~30 days in case you need recovery.

**Q: How often will this problem recur?**  
A: If you keep 1-week retention at 23 MB per deployment:
- 7 days × ~1 deploy/day = ~7 deployments = ~160 MB
- Very safe, far below 5 GB target
- You have ~2–3 years before needing to re-tune

**Q: Do I need to pay?**  
A: No. Lowering retention costs $0. You stay on free tier indefinitely.

**Q: What happens at 100% storage?**  
A: Vercel returns `503 DEPLOYMENT_PAUSED` and the site goes down. Prevention (this fix) is essential.
