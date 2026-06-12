import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
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

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
