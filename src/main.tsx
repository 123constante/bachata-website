import { createRoot } from "react-dom/client";
import "./index.css";
import "@fontsource-variable/inter";
import { initSentry } from "@/lib/sentry";
import { attemptChunkReloadOnce } from "@/lib/staleChunk";
import { AppRoot } from "./entry-client";

// Browser-only entry: all DOM-touching bootstrapping lives here (createRoot,
// initSentry, the top-level window listeners and non-blocking font loader). The
// renderable tree itself is AppRoot, imported from ./entry-client so a future
// server entry can render it without executing any of this. SSR/ISR Phase 2.
initSentry();

if (typeof window !== 'undefined') {
  // Stale-chunk guard: force a reload when Vite can't load a hashed asset after
  // a new deploy. Once per session -- a second failure falls through to the
  // error boundaries instead of reload-looping.
  window.addEventListener('vite:preloadError', () => { attemptChunkReloadOnce() })

  if ('scrollRestoration' in window.history) {
    window.history.scrollRestoration = 'manual';
  }

  // Decorative fonts are not needed for initial render -- load them after the
  // page is interactive so they never block LCP or hold up the critical path.
  window.addEventListener('load', () => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2' +
      '?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600' +
      '&family=Manrope:wght@400;500;600;700;800' +
      '&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700' +
      '&family=JetBrains+Mono:wght@400;500;700' +
      '&family=Bebas+Neue' +
      '&family=Archivo+Black' +
      '&family=Big+Shoulders+Display:wght@700;800;900' +
      '&display=swap';
    document.head.appendChild(link);
  });
}

createRoot(document.getElementById("root")!).render(<AppRoot />);
