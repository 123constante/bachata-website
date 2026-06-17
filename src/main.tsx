import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "@fontsource-variable/inter";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { initSentry } from "@/lib/sentry";
import { attemptChunkReloadOnce } from "@/lib/staleChunk";

initSentry();

// Stale-chunk guard: force a reload when Vite can't load a hashed asset after
// a new deploy. Once per session — a second failure falls through to the
// error boundaries instead of reload-looping.
window.addEventListener('vite:preloadError', () => { attemptChunkReloadOnce() })

if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

// Decorative fonts are not needed for initial render — load them after the
// page is interactive so they never block LCP or hold up the critical path.
window.addEventListener('load', () => {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href =
    'https://fonts.googleapis.com/css2' +
    '?family=Cormorant+Garamond:ital,wght@1,500;1,600' +
    '&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700' +
    '&family=JetBrains+Mono:wght@400;500;700' +
    '&family=Bebas+Neue' +
    '&family=Archivo+Black' +
    '&family=Big+Shoulders+Display:wght@700;800;900' +
    '&display=swap';
  document.head.appendChild(link);
});

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
