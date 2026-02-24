---
applyTo: "src/**/auth/**,src/pages/Auth.tsx,src/pages/AuthCallback.tsx,src/pages/Onboarding.tsx"
description: "Auth flow guardrails for auth components and auth-related pages."
---

# Auth Scope Rules

- Keep protected flows aligned with existing route patterns in `src/App.tsx`: authenticated pages stay behind `AuthGuard`.
- Preserve current auth transition behavior (`/auth` -> callback -> onboarding/profile) and avoid adding parallel auth routes unless explicitly requested.
- Dev quick-login is local/dev-only: only rely on it when `VITE_DEV_AUTH_EMAIL` and `VITE_DEV_AUTH_PASSWORD` are both present and `import.meta.env.DEV` is true.
- Do not weaken auth gating or fallback behavior for unauthenticated users when editing auth UI.
