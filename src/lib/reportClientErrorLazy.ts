// The ONE first-load call site for the error reporter. Callers on the first-load
// path (error boundaries, root, the global mutation hook) go through this so the
// `import()` is emitted once, not per caller. Every byte here lands on every
// route's first load (/classes had 150 B gz of headroom), so it stays this
// small; all logic, transport included, lives in the lazy
// src/lib/clientErrorReporter.ts, which imports nothing.
import type { ClientErrorKind } from "@/lib/clientErrorReporter";

/**
 * Fire-and-forget. With no arguments it installs the window handlers; with an
 * error it reports it, as `kind` (default "render", the commonest caller, so
 * the boundaries need not spell it). Argument order is for byte size too.
 */
export function reportClientErrorLazy(...args: [] | [error: unknown, kind?: ClientErrorKind]): void {
  // Two-arg then, not .catch: same swallow, fewer first-load bytes.
  import("@/lib/clientErrorReporter").then((m) => m.default(...args), () => {});
}
