// @vitest-environment jsdom
/**
 * Timing gate for app/NavigationSplash.tsx.
 *
 * WHY THIS EXISTS. The component is two numbers and a state machine, and both
 * numbers are load-bearing in a way reading cannot check:
 *
 *   SHOW_DELAY_MS   too low  -> every fast tap flashes an overlay
 *                   too high -> the wait it exists to cover goes unfeedbacked
 *   MIN_VISIBLE_MS  removed  -> a navigation landing just past SHOW_DELAY_MS
 *                              puts the splash up for ~20ms, which is the
 *                              exact flash SHOW_DELAY_MS exists to prevent,
 *                              only moved 300ms later
 *
 * The suppression case is the one worth having. It is the behaviour a reader
 * on wifi sees on EVERY navigation, it is invisible in manual testing (nothing
 * appears -- which looks identical to a broken component), and it is the first
 * thing a "simplification" of the effect would delete.
 *
 * WHAT THIS CANNOT DO. jsdom does no layout, runs no CSS animation and
 * computes no transition, so every visual claim -- the blur, the pulse, the
 * fade, the reduced-motion variant -- is invisible here. This asserts the
 * STATE MACHINE only: which class the root carries and what its live region
 * announces, at a given number of milliseconds. A green run here says nothing
 * about how the splash looks or whether the animation plays.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";

// Hoisted so the vi.mock factory below can close over it: vi.mock is lifted
// above the imports, so a plain `let` declared here would still be in its TDZ
// when the factory runs.
const nav = vi.hoisted(() => ({
  state: "idle" as "idle" | "loading" | "submitting",
  // Present on a 'loading' navigation ONLY when it is the revalidation phase
  // of a form submission -- that is how the router itself distinguishes the
  // two, and the component reads it for the same reason.
  formMethod: undefined as string | undefined,
}));

// Only useNavigation is mocked. The component imports nothing else from
// react-router, and mocking the whole module keeps this a pure unit test with
// no router, no history and no route tree to build.
vi.mock("react-router", () => ({
  useNavigation: () => nav,
}));

import { NavigationSplash } from "../../app/NavigationSplash";

const SHOW_DELAY_MS = 300;
const MIN_VISIBLE_MS = 250;

let view: ReturnType<typeof render>;

/**
 * The component renders TWO top-level nodes, and the split is load-bearing:
 * a visually-hidden live region that ANNOUNCES, then the visual overlay. They
 * are addressed separately below because the visible label is now constant --
 * reading "Loading" off the overlay would be true at every instant and would
 * assert nothing at all.
 */
function liveRegion(): HTMLElement {
  return view.container.firstElementChild as HTMLElement;
}

function root(): HTMLElement {
  return view.container.lastElementChild as HTMLElement;
}

/**
 * Read visibility from BOTH signals, not just the class -- a change that moved
 * the opacity class while leaving screen-reader users with nothing (or the
 * reverse) is a real accessibility defect that a class-only assertion waves
 * straight through.
 *
 * The assistive signal is the live region's TEXT, not aria-hidden. That is not
 * a rename: role="status" announces when its CONTENT changes, and an
 * aria-hidden node is not in the accessibility tree to announce from at all,
 * so an aria-hidden assertion can be perfectly green over a region that never
 * says a word. Reading the text asserts the thing a reader actually receives.
 */
function visible(): boolean {
  const byClass = root().className.includes("opacity-100");
  const byAnnouncement = (liveRegion().textContent ?? "").includes("Loading");
  expect(byClass).toBe(byAnnouncement);
  return byClass;
}

/**
 * Advance fake time INSIDE act() so the timer callback's setState is flushed
 * before the assertion reads the DOM. Outside act() the state lands but React
 * has not re-rendered, so every assertion would read the previous frame.
 */
function tick(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/**
 * Advance in small steps, asserting the splash is hidden at EVERY step.
 *
 * PROVEN NECESSARY BY MUTATION, not written defensively. Deleting the show
 * timer's clearTimeout -- the single line the suppression contract rests on --
 * left the end-of-span form of this assertion completely green: the orphaned
 * timer fires at SHOW_DELAY_MS, shows the splash, and MIN_VISIBLE_MS hides it
 * again, so the whole defect opens and closes INSIDE the span and the settled
 * state at the end is correct. Any future defect of that shape (a wrong frame
 * that self-corrects) needs sampling too; a settled-state assertion is blind
 * to all of them.
 */
function tickNeverVisible(totalMs: number, stepMs = 25) {
  for (let elapsed = 0; elapsed < totalMs; elapsed += stepMs) {
    tick(stepMs);
    expect(visible()).toBe(false);
  }
}

/**
 * Flip the mocked navigation state and re-render, the way a real nav does.
 *
 * `formMethod` defaults to undefined, which is what the router supplies for an
 * ordinary GET navigation; pass one to model the revalidation phase of a form
 * submission.
 */
function setNavState(
  state: "idle" | "loading" | "submitting",
  formMethod?: string,
) {
  nav.state = state;
  nav.formMethod = formMethod;
  act(() => {
    view.rerender(<NavigationSplash />);
  });
}

beforeEach(() => {
  // Fake timers also fake Date, which the component reads via Date.now() to
  // measure how long the splash has been up. Both must move together or the
  // MIN_VISIBLE_MS arithmetic reads a real clock against a fake timer.
  vi.useFakeTimers();
  nav.state = "idle";
  // Reset explicitly: `nav` is hoisted module state shared by every test, so a
  // formMethod left behind by one case would silently suppress the splash in
  // the next and read as a pass.
  nav.formMethod = undefined;
  view = render(<NavigationSplash />);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("NavigationSplash", () => {
  it("renders hidden when no navigation is pending", () => {
    expect(visible()).toBe(false);
  });

  it("stays hidden for a navigation that finishes before the threshold", () => {
    setNavState("loading");
    tick(SHOW_DELAY_MS - 1);
    expect(visible()).toBe(false);

    setNavState("idle");
    // Well past the threshold, SAMPLED THROUGHOUT: if the pending timer were
    // not cleared on arrival, the splash would appear here -- on a navigation
    // that has already finished. This is the suppression contract, and the
    // sampling is what makes it enforceable (see tickNeverVisible).
    tickNeverVisible(SHOW_DELAY_MS * 4);
  });

  it("shows once a navigation outlives the threshold", () => {
    setNavState("loading");
    tick(SHOW_DELAY_MS - 1);
    expect(visible()).toBe(false);

    tick(1);
    expect(visible()).toBe(true);
  });

  it("holds the splash for the minimum once it has been shown", () => {
    setNavState("loading");
    tick(SHOW_DELAY_MS);
    expect(visible()).toBe(true);

    // Arrives 20ms after the splash appeared -- the flash case. Without
    // MIN_VISIBLE_MS this hides immediately and the overlay was on screen for
    // 20ms.
    tick(20);
    setNavState("idle");
    expect(visible()).toBe(true);

    // Still held one tick before the minimum elapses.
    tick(MIN_VISIBLE_MS - 20 - 1);
    expect(visible()).toBe(true);

    tick(1);
    expect(visible()).toBe(false);
  });

  it("does not extend a navigation that already outlived the minimum", () => {
    setNavState("loading");
    tick(SHOW_DELAY_MS + MIN_VISIBLE_MS + 500);
    expect(visible()).toBe(true);

    // The minimum is already satisfied, so arrival hides it on the same tick
    // rather than adding another MIN_VISIBLE_MS on top.
    setNavState("idle");
    expect(visible()).toBe(false);
  });

  it("does not restart the minimum hold while the navigation is still pending", () => {
    setNavState("loading");
    tick(SHOW_DELAY_MS);
    expect(visible()).toBe(true);

    // TWO tick calls, deliberately. The commit for that first show has now
    // landed, so the effect has re-run with visible=true while isLoading is
    // STILL true -- and that re-run is where a show timer can be armed a
    // second time. Waiting past another SHOW_DELAY_MS is what lets that
    // second timer actually FIRE and re-stamp the "shown at" mark. Fold it
    // into the tick above and the re-armed timer is created and then cleared
    // by the arrival, so the defect never executes and this test goes green
    // against a broken component.
    tick(SHOW_DELAY_MS + 100);

    // Visible for 700ms now, far past MIN_VISIBLE_MS, so arrival must hide on
    // the same tick. A re-stamped mark makes the component believe it has
    // only been up 100ms, and it then covers ready content for ~150ms more.
    setNavState("idle");
    expect(visible()).toBe(false);
  });

  it("ignores form submissions while they are submitting", () => {
    // The easy half. 'submitting' is a pending navigation too, but covering
    // the screen while a form posts hides the form's own pending state.
    setNavState("submitting");
    tick(SHOW_DELAY_MS * 4);
    expect(visible()).toBe(false);
  });

  it("ignores the loading phase of a form submission", () => {
    // The half that actually matters, and the one the test above CANNOT see.
    // No real navigation stays in 'submitting': React Router moves a non-GET
    // submission on to 'loading' for revalidation and carries formMethod with
    // it. That phase is indistinguishable from an ordinary navigation by
    // `state` alone, so on state alone the splash covers the form mid-post --
    // precisely what the exclusion above exists to prevent.
    //
    // Unreachable in the app today (nothing posts through an RR action), which
    // is exactly why it needs a test rather than a comment: there is no
    // surface on which anyone would notice it regressing.
    setNavState("loading", "POST");
    tickNeverVisible(SHOW_DELAY_MS * 4);
  });

  it("shows again on a second navigation after the first was suppressed", () => {
    setNavState("loading");
    tick(SHOW_DELAY_MS - 1);
    setNavState("idle");
    tickNeverVisible(1000);

    // A suppressed navigation must not leave the component latched: the timer
    // state has to be clean enough for the NEXT one to show normally.
    setNavState("loading");
    tick(SHOW_DELAY_MS);
    expect(visible()).toBe(true);
  });

  it("mounts nothing expensive until the first navigation", () => {
    // What this overlay costs a reader who never navigates is exactly two
    // nodes: the 36 KB mark (fetched because a mounted <img> is technically
    // in-viewport) and the backdrop-filter surface. Both are gated on `armed`.
    //
    // jsdom cannot measure a fetch or a compositor surface -- but it can see
    // whether the things that CAUSE them exist, and that is the whole of the
    // contract. Without this the gating could be deleted for looking like
    // dead weight and every test here would stay green.
    expect(root().querySelector("img")).toBeNull();
    expect(root().className).not.toContain("backdrop-blur-md");

    setNavState("loading");
    expect(root().querySelector("img")).not.toBeNull();
    expect(root().className).toContain("backdrop-blur-md");

    // STICKY. It must not un-arm on arrival: the mark and the label would
    // unmount on the first frame of the fade-out and pop away mid-fade.
    setNavState("idle");
    expect(root().querySelector("img")).not.toBeNull();
  });

  it("never captures pointer events, shown or hidden", () => {
    // A fixed inset-0 node at z-[10000] that swallows taps turns a stalled
    // route loader into a dead UI -- there is a MIN_VISIBLE_MS but no MAX and
    // no dismiss, and Supabase loader calls carry no fetch timeout.
    expect(root().className).toContain("pointer-events-none");

    setNavState("loading");
    tick(SHOW_DELAY_MS);
    expect(visible()).toBe(true);
    expect(root().className).toContain("pointer-events-none");
  });
});
