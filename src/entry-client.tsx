import { ErrorBoundary } from "@/components/ErrorBoundary";
import App from "./App";

/**
 * The importable application root — the exact tree main.tsx mounts, minus the
 * browser-only bootstrapping (createRoot / initSentry / DOM side-effects, which
 * stay in main.tsx). Keeping this in its own module means a future server entry
 * can import the same tree to render without pulling in createRoot or the
 * DOM-only top-level code in main.tsx. SSR/ISR migration Phase 2 seam; see
 * project_ssr_isr_migration_pivot. No behavior change — main.tsx renders exactly
 * this.
 */
export const AppRoot = () => (
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
