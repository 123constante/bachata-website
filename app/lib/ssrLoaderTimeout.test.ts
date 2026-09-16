import { describe, it, expect, vi } from "vitest";
import {
  withSsrLoaderTimeout,
  SsrLoaderTimeoutError,
  isSsrLoaderTimeoutError,
} from "./ssrLoaderTimeout";

describe("isSsrLoaderTimeoutError", () => {
  it("is true for a real SsrLoaderTimeoutError", () => {
    expect(isSsrLoaderTimeoutError(new SsrLoaderTimeoutError("x", 1))).toBe(true);
  });

  it("is false for an ordinary Error, including one that merely mentions the class", () => {
    expect(isSsrLoaderTimeoutError(new Error("SsrLoaderTimeoutError"))).toBe(false);
  });

  it("is false for a non-Error thrown value", () => {
    expect(isSsrLoaderTimeoutError("boom")).toBe(false);
  });
});

// withSsrLoaderTimeout wraps the WHOLE loader export, not a single call site --
// the mechanism this file's header describes rewriting to after review found a
// per-call-site draft left two awaits (resolveOgCardImage, festivalPrefetch)
// reachable unguarded one hop past the wrapped prefetch in event.tsx, and
// home.tsx's midnight-straddle retry stacked two independent budgets for an
// undocumented worst case. These tests pin exactly the properties that rewrite
// depends on: ONE deadline covers every await inside the function, arguments
// pass through, and a late real error/value doesn't leak past an already-settled
// response -- and IS logged, in both directions.
describe("withSsrLoaderTimeout", () => {
  it("resolves with the loader's value when it settles before the deadline", async () => {
    const loader = withSsrLoaderTimeout("fast-loader", async () => "ok", 50);
    await expect(loader()).resolves.toBe("ok");
  });

  it("passes loader arguments through untouched", async () => {
    const loader = withSsrLoaderTimeout(
      "args-loader",
      async (a: number, b: number) => a + b,
      50,
    );
    await expect(loader(2, 3)).resolves.toBe(5);
  });

  it("rejects with the loader's own error when it rejects before the deadline", async () => {
    const loader = withSsrLoaderTimeout(
      "failing-loader",
      async () => {
        throw new Error("boom");
      },
      50,
    );
    await expect(loader()).rejects.toThrow("boom");
  });

  it("rejects with SsrLoaderTimeoutError when an await inside the loader never settles", async () => {
    const loader = withSsrLoaderTimeout(
      "hung-loader",
      () => new Promise<never>(() => {}),
      20,
    );
    await expect(loader()).rejects.toBeInstanceOf(SsrLoaderTimeoutError);
  });

  it("bounds the SUM of two sequential awaits under one deadline (the home.tsx straddle case)", async () => {
    // Regression pin for the defect review found: two independent per-call-site
    // timeout races back to back had an undocumented ~16s worst case. Wrapping
    // the whole loader means a second sequential await shares the FIRST call's
    // remaining budget, not a fresh one.
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const loader = withSsrLoaderTimeout(
      "straddle-loader",
      async () => {
        await delay(15);
        await delay(15);
        return "done";
      },
      20,
    );
    await expect(loader()).rejects.toBeInstanceOf(SsrLoaderTimeoutError);
  });

  it("does not reject a second time when the loader settles successfully but late", async () => {
    // The retry-interaction risk review flagged: a query that would have
    // succeeded doesn't get a second, contradictory rejection once the timeout
    // has already fired -- the promise returned to the caller settles ONCE.
    vi.useFakeTimers();
    let resolveLoader: (v: string) => void;
    const loader = withSsrLoaderTimeout(
      "late-success-loader",
      () => new Promise<string>((resolve) => { resolveLoader = resolve; }),
      20,
    );
    const result = loader();
    const assertion = expect(result).rejects.toBeInstanceOf(SsrLoaderTimeoutError);
    await vi.advanceTimersByTimeAsync(20);
    await assertion;
    resolveLoader!("late value");
    await vi.advanceTimersByTimeAsync(0);
    // No unhandled-rejection / no second settlement to observe -- the promise
    // already rejected above and cannot reject or resolve again.
    vi.useRealTimers();
  });

  it("logs a late SUCCESS distinctly, not just a late failure", async () => {
    // Review found the original late-arrival handler was wired as a bare
    // `.catch()`, which only observes a late REJECTION -- a slow-but-successful
    // DB call settling after the deadline produced zero trace, the exact case
    // this log line exists to surface for tuning the timeout value.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.useFakeTimers();
    let resolveLoader: (v: string) => void;
    const loader = withSsrLoaderTimeout(
      "late-success-log-loader",
      () => new Promise<string>((resolve) => { resolveLoader = resolve; }),
      20,
    );
    const result = loader();
    const assertion = expect(result).rejects.toBeInstanceOf(SsrLoaderTimeoutError);
    await vi.advanceTimersByTimeAsync(20);
    await assertion;
    resolveLoader!("late value");
    await vi.advanceTimersByTimeAsync(0);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('"late-success-log-loader" SUCCEEDED after its 20ms deadline'),
      "late value",
    );
    vi.useRealTimers();
    errorSpy.mockRestore();
  });

  it("logs a late FAILURE distinctly", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.useFakeTimers();
    let rejectLoader: (err: Error) => void;
    const loader = withSsrLoaderTimeout(
      "late-failure-log-loader",
      () => new Promise<never>((_resolve, reject) => { rejectLoader = reject; }),
      20,
    );
    const result = loader();
    const assertion = expect(result).rejects.toBeInstanceOf(SsrLoaderTimeoutError);
    await vi.advanceTimersByTimeAsync(20);
    await assertion;
    rejectLoader!(new Error("late boom"));
    await vi.advanceTimersByTimeAsync(0);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('"late-failure-log-loader" FAILED after its 20ms deadline'),
      expect.objectContaining({ message: "late boom" }),
    );
    vi.useRealTimers();
    errorSpy.mockRestore();
  });
});
