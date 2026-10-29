# Handover: festivalClientState flake triage (dt_a20a444ffdc8)

Brief: `brief/festival-flake:docs/briefs/festival-flake-triage.md` (sha bee8fba).
Branch: `claude/festival-flake-triage`. Tests-only; no DB, no product code.

## Cause (proved, hypothesis (b))

`app/InitialVisiblePageTransition.tsx` renders `<Suspense fallback={plain}>
<PageTransition>{children}</PageTransition></Suspense>` once the module-scoped
`clientNavigated` flag is set. The fallback (`plain`) and the resolved tree are
DIFFERENT tree positions, so when the lazy `PageTransition` chunk resolves the
whole page REMOUNTS and any state picked on the fallback is lost.

In the test file the control case ("reaches the destination festival") makes the
first lazy render, during its `navigateTo`. `await act(async () => {})` drains
microtasks only; the module import is real I/O (vite-node transforms
PageTransition + framer-motion). On a loaded CI runner it was still pending when
the next case ("shows no frame...") mounted, and resolved during that case's
`user.click(dayTabs[2])` -> remount -> `openDay` reads 0 (`expected +0 to be 2`).

Evidence:
- Gating the import with a `vi.mock` that waits on a manual release, and
  releasing just before the click, reproduces the exact CI failure
  deterministically (openDay 0 after the click).
- Before the fix, the control case's `navigateTo` ended on the FALLBACK (no
  motion style on `.route-shell`); it asserted over a tree about to be thrown away.
- Why the flake started around 07:33Z is not proved. No commit in the window
  touched the test, the harness, or the festival route; most likely runner load
  (more test files in the suite) widened the import latency. Hypothesis (c) is
  not supported by `git log`.

## Fix

`mountFestival` awaits `import('@/components/PageTransition')` when
`throughRoute` is set, before mounting. lazy()'s own import is then a cache hit
that settles inside `navigateTo`'s async act(). Measured with the import delayed
0/300/2000ms: the navigation lands on the resolved tree every time; 8/8 green.

## Proof

- Loaded loop (6-8 busy-loop CPU hogs on 4 cores, TZ=Europe/London): 20/20 green
  (12 on the first commit, 8 after the comment-only review fix).
- Mutation: `key={params.id}` deleted from `app/routes/festival.tsx` -> 3/3 red,
  at the intended window line `{ commit: 0, open: 1 }`, not on the setup click.
- Other cases: only the two throughRoute cases render the lazy wrapper; the
  direct-mount cases have no Suspense boundary. No other case has this race.

## Product note (reported, NOT fixed -- brief forbids product code)

The same remount can happen in production: a client navigation before the
PageTransition chunk is cached (the warm-up runs up to ~600ms after first mount,
longer on a slow network) shows the page in the fallback, then remounts it when
the chunk arrives. Anything the reader did in between (a day pick, a lightbox) is
lost and mount effects run twice. The window is narrow. A product fix would make
the fallback and the resolved tree the same position (or not suspend at all);
that is a separate, owner-approved change.

## Review

One independent review on a different model: no blocking findings. Its two
comment-accuracy points (soften "DOES settle"; cross-reference the SETTLE note)
were applied as the one fix round.

## Left / next

- Watch the next few `unit (Europe/London, full)` runs on main after merge.
- `bin/check-integrity.sh` and `.githooks/pre-commit` are mode 100644 in git, so
  `npm run lint` exits 126 on that link in a fresh checkout; run with `bash` passed.
  Not in this PR's scope.
