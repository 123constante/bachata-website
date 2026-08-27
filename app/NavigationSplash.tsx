import { useEffect, useRef, useState } from "react";
import { useNavigation } from "react-router";
// The TRANSPARENT calendar mark, not brand/bc-logo.png: that one is the full
// lockup baked onto an opaque dark square, which renders as a visible box
// inside the round frame below. Verified with Pillow -- bc-logo.png and
// bachata-calendar-logo-auth.png have no alpha at all. 219x192 is already the
// right source size for a 72px mark at 3x DPR, so nothing is downscaled.
import splashMark from "@/assets/brand/bachata-calendar-icon.png";

// Wait this long before showing anything. Below ~300ms a human reads an
// appear-and-vanish overlay as a glitch rather than as progress, and most
// warm navigations finish inside it -- so this threshold is the whole reason
// a fast tap sees no splash at all.
//
// NOT YET CONFIRMED IN PRODUCTION. Measured in `react-router dev` the splash
// appeared at ~740ms, not 300ms: route-chunk compilation blocks the main
// thread, and a setTimeout cannot fire through a long task. A production build
// has no compile step there, so this should land far nearer 300ms -- but that
// is inference, not a measurement. Treat 300 as the FLOOR the code asks for,
// not the delay a reader experiences, until someone measures a real deploy.
const SHOW_DELAY_MS = 300;

// Once shown, stay up at least this long. Without it, a navigation landing at
// ~320ms puts the splash on screen for 20ms -- the exact flash SHOW_DELAY_MS
// exists to prevent, just moved 300ms later.
//
// The cost of that is NOT this number alone. Ready content stays behind the
// overlay for this hold PLUS the 300ms opacity fade, and the fade is ease-out,
// so it is still substantially opaque through the first half of it. A
// navigation arriving at ~320ms is obscured to roughly 850ms. If this is ever
// tuned, 250 + 300 is the figure to weigh, not 250.
const MIN_VISIBLE_MS = 250;

// React 18.3 does not recognise the camelCase `fetchPriority` prop -- it warns
// and tells you to spell it lowercase (React 19 added the camelCase form).
// @types/react DOES declare the camelCase one, so `fetchPriority="low"`
// typechecks clean and only fails at runtime, as a console warning on every
// render. The lowercase DOM attribute is the one React 18 passes through, and
// it is not in the JSX types, so it has to be spread.
//
// Worth keeping rather than dropping, though NOT for the reason first written
// here. The <img> no longer mounts on page load (see `armed` below), so it is
// not competing with the initial paint at all. It mounts at NAVIGATION start,
// where it competes with the route chunk and the loader request -- and those
// must win, because they are what the reader is actually waiting for. A mark
// that arrives late into a ring costs nothing; a route that does costs the
// whole navigation.
const LOW_FETCH_PRIORITY = { fetchpriority: "low" } as Record<string, string>;

/**
 * Full-screen loading splash for pending route navigations.
 *
 * WHY THIS EXISTS: in RR7 framework mode a <Link> tap runs the destination
 * route's loader BEFORE rendering anything, so the old page sits on screen
 * unchanged for the whole round-trip. Page-level skeletons never appear --
 * the new page has not started rendering -- and InitialVisiblePageTransition's
 * fade only plays on ARRIVAL. Nothing covered the wait itself.
 *
 * Rendered once from app/root.tsx; no route or page needs to know about it.
 */
export function NavigationSplash() {
  const navigation = useNavigation();
  // A plain GET navigation, and ONLY that.
  //
  // `state === "loading"` on its own does NOT exclude form posts, which is what
  // an earlier version of this comment claimed. React Router runs a non-GET
  // submission as 'submitting' and then moves it to 'loading' for the
  // revalidation phase, carrying the submission across: getLoadingNavigation()
  // sets `formMethod: submission.formMethod` when a submission is present and
  // `void 0` when it is not. So the 'loading' half of a form post WAS covered
  // by the splash -- hiding the form's own pending state, the exact thing this
  // guard exists to prevent. A test that pins 'submitting' forever cannot see
  // that, because no real navigation stays in 'submitting'.
  //
  // formMethod is the discriminator the router itself uses, so it is the one
  // used here. Latent today (nothing reachable posts through an RR action),
  // which is why it survived a round of review as a comment that read true.
  const isLoading =
    navigation.state === "loading" && navigation.formMethod == null;

  const [visible, setVisible] = useState(false);
  const shownAtRef = useRef(0);

  // STICKY: false until the first pending navigation of the session, true for
  // the rest of it. It never goes back to false, and that is the point.
  //
  // It gates the two things inside this overlay that cost something whether or
  // not anyone ever sees them: the backdrop-filter (opacity:0 is not
  // display:none, so the render surface is not freed) and a 36 KB PNG that the
  // browser fetches because the <img> is mounted and technically in-viewport.
  // That PNG is a SECOND brand request -- GlobalHeader already loads
  // bachata-calendar-logo.png, a different 53 KB file -- and neither the
  // first-load request ratchet nor the gzip budget watches images, so it would
  // have landed unmeasured on both.
  //
  // Sticky rather than `isLoading || visible` on purpose. A flag that goes
  // false again would unmount the mark and the label INSTANTLY while the root
  // is still fading out over 300ms, so the splash contents would pop out
  // rather than fade. Sticky pays the cost once, at the first navigation,
  // instead of on the initial page load -- which is the paint that matters --
  // and costs no visual artefact at all. This is an SPA: root.tsx is not
  // remounted by client-side navigation, so "once per session" is literal.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (isLoading && !armed) setArmed(true);
  }, [isLoading, armed]);

  useEffect(() => {
    if (isLoading) {
      // Already up: do NOT arm a second show timer. `visible` is a dependency
      // of this effect, so it re-runs the moment the splash appears while the
      // navigation is STILL pending. A second timer fires another
      // SHOW_DELAY_MS later and re-stamps shownAtRef, restarting the minimum
      // hold against a splash that has already been on screen for 300ms --
      // so the reader waits up to MIN_VISIBLE_MS extra on content that is
      // ready. Under fake timers without this guard: shown at 300ms,
      // re-stamped at 600ms, and still on screen at 700ms with a 150ms hold
      // left to run -- the 700ms half is what the test observed, the 150ms is
      // arithmetic off shownAtRef, not a stopwatch reading.
      //
      // Covered by "does not restart the minimum hold while the navigation is
      // still pending", which fails without this line.
      if (visible) return;

      const timer = window.setTimeout(() => {
        shownAtRef.current = Date.now();
        setVisible(true);
      }, SHOW_DELAY_MS);
      // Cleanup is what suppresses the splash on a fast navigation: the page
      // arrives, isLoading flips, and this clears the timer before it fires.
      return () => window.clearTimeout(timer);
    }

    if (!visible) return;

    const remaining = MIN_VISIBLE_MS - (Date.now() - shownAtRef.current);
    if (remaining <= 0) {
      setVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setVisible(false), remaining);
    return () => window.clearTimeout(timer);
  }, [isLoading, visible]);

  return (
    <>
      {/* THE ANNOUNCEMENT, in its own visually-hidden node.
          role="status" fires when its CONTENT changes, so the text has to
          appear and disappear. Doing that to the VISIBLE label instead --
          the first fix for this -- emptied the words on the first frame of
          the 300ms fade-out, popping them away while the overlay was still
          on screen. That is the very artefact the sticky `armed` flag pays
          to avoid, reintroduced by the fix for the announcement.
          Two nodes keeps both properties: the visible label is constant and
          fades, this one changes and speaks. An aria-hidden node is not in
          the accessibility tree to announce from at all, which is why the
          announcing node is NOT the one carrying aria-hidden below. */}
      <span role="status" aria-live="polite" className="sr-only">
        {visible ? "Loading" : ""}
      </span>

      {/* The VISUAL overlay. Always mounted; what is mounted inside it, and
          whether the backdrop-filter exists at all, is gated on `armed` --
          see that flag's comment for what those two cost.

          z-[10000] clears the z-[9999] fullscreen lightboxes (gallery, venue
          media) so navigating out of one is still covered. */}
      <div
        // Decorative. Everything here is already carried by the live region
        // above and the mark has alt="", so hiding it keeps a screen reader
        // from meeting the same word twice.
        aria-hidden="true"
        className={[
          "fixed inset-0 z-[10000] grid place-items-center",
          // pointer-events-none UNCONDITIONALLY. This is a fixed inset-0 node
          // at z-[10000]: while it captured taps, a route loader that stalled
          // left the whole UI dead -- there is a MIN_VISIBLE_MS but no MAX and
          // no dismiss -- until the socket gave up. Supabase loader calls
          // carry no fetch timeout, so that is a reachable state on a phone,
          // not a theoretical one.
          //
          // Letting taps through is also just the behaviour that shipped
          // before this component existed: during a loader round-trip the old
          // page stayed fully interactive. This is feedback, not a modal, and
          // it must never be the thing that can lock the app.
          "pointer-events-none",
          "bg-background/[.82]",
          armed ? "backdrop-blur-md" : "",
          "transition-opacity duration-300 ease-out",
          visible ? "opacity-100" : "opacity-0",
        ].join(" ")}
      >
        {armed ? (
          <div
            className={[
              "flex flex-col items-center gap-4",
              "transition-transform duration-300 ease-out motion-reduce:transition-none",
              visible ? "scale-100" : "scale-95 motion-reduce:scale-100",
            ].join(" ")}
          >
            <div
              className={[
                "grid h-[104px] w-[104px] place-items-center rounded-full",
                "border border-primary/20",
                // Only animate while actually visible -- an infinite animation
                // on a mounted but hidden node is a compositor cost paid for
                // something the reader is not being shown.
                visible ? "animate-splash-pulse motion-reduce:animate-none" : "",
              ].join(" ")}
            >
              <img
                src={splashMark}
                alt=""
                width={72}
                height={63}
                decoding="async"
                {...LOW_FETCH_PRIORITY}
                className="h-[72px] w-auto"
              />
            </div>
            {/* Constant, NOT gated on `visible` -- see the announcement note
                above. This label fades with the overlay; it never pops. */}
            <span className="text-[10px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
              Loading
            </span>
          </div>
        ) : null}
      </div>
    </>
  );
}
