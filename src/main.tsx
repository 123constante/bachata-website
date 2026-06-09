import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { initSentry } from "@/lib/sentry";
import { captureTouchDebugFlag } from "@/lib/touchDebug";

initSentry();
// TEMPORARY: capture ?touchdebug=1 before React renders / the `/` redirect
// drops the query string. Inert unless the flag is present. Revert with the
// rest of the touch-debug scaffolding.
captureTouchDebugFlag();

if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
