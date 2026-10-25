# Gaps: what professional account systems have that we do not

**Method.** Both repos were grepped before anything was called missing (Website `claude/journey-matrix`
@ 34877de, admin `main` @ 3a9ccc6). The prod figures come from read-only SELECTs (counts only) and from the
deployed edge-function list on `stsdtacfauprzrdebmzg`, 2026-10-15. Dashboard-only Auth settings (OTP expiry,
rate limits, CAPTCHA, which hook is wired) **cannot be read through SQL**. Each of those is marked *UNVERIFIED*,
with the doc that last recorded it.

**Severity.**
- HIGH: harms people or the launch now.
- MED: a real gap a professional platform would close before scale.
- LOW: polish, or a gap with a small blast radius.

## Prod facts used below

| Fact | Count |
|---|---|
| Logins (`auth.users`) | 20 (10 signed in during the last 30 days) |
| Logins never confirmed (code never entered) | **6 of 20 (30%)**. 2 of the 10 created in the last 30 days |
| Logins with a dancer row / with a complete one | 18 / 10 |
| Live sessions / logins holding one / logins with 2+ | 13 / 7 / 1 |
| Sessions older than 30 days | 7 of 13 |
| MFA factors, non-e-mail identities, pending e-mail changes | 0 / 0 / 0 |
| `member_consents` rows | **0** |
| `signup_blocked_domains` rows / `signup_allowlist` rows | **0** / 2 |
| `account_erase_requests` rows | 0 (the grace path is deployed but unused) |
| `client_error_reports`/`client_error_log`: auth, account, invite or onboarding errors in the last 30 days | 0 (only 1 admin RPC error) |
| `app_feature_flags.dancer_area_open` | **true** (since 2026-10-15 14:05) |
| Deployed edge functions | `account-erase` v1, `account-erase-due` v1, `dancer-invite-send` v1, `organiser-signup` v18. `admin-provision-person` is not deployed |
| Cron | `account-erase-due` 05:23, `unconfirmed-account-purge` 03:40, `member-action-attempts-purge-30d` 03:45 |
| Security advisors | No auth-specific finding apart from `auth_leaked_password_protection` (not relevant: there are no passwords) |

## Security

| Id | Gap | Professional norm | What exists (ref) | Sev | People | Recommended fix |
|---|---|---|---|---|---|---|
| G-S1 | **Bot protection on sign-up is off** | Google, Slack and Notion put a CAPTCHA or risk check in front of e-mail sends | No CAPTCHA in either repo. `security_captcha_enabled=false` (`docs/login-launch-gate.md:23` admin, *UNVERIFIED* now). The blocked-domain list has **0 rows**, while the disposable seed list exists only in prose (`docs/runbooks/dancer-area-open-close.md:40-43` admin) | **HIGH** | Every new visitor. Sign-up is open now (flag true) | Turn on Turnstile (dashboard) and add the widget to the e-mail step of `Auth.tsx`. Seed `signup_blocked_domains` from the runbook list via the audited admin RPC. PLAN PR-6 |
| G-S2 | **Which sign-up hook is live is unknown** | One verified, written config | v2 exists (`M/20261121170000_…:165-223`); the runbook says the dashboard still points at v1 until switched | **HIGH** | Every new visitor | If v1 is live while the area is open, every non-allowlisted sign-up gets 403. Owner reads the dashboard once (DECISIONS D9). Then add a contract check that calls the Management API `GET /v1/projects/{ref}/config/auth` and pins `hook_before_user_created_uri` |
| G-S3 | **Auth e-mail cap of 30 per hour, project-wide** | Sized to the launch | 30/h (`docs/login-launch-gate.md:23` admin, *UNVERIFIED*). It covers every code and link e-mail | **HIGH** on launch day | Every new visitor beyond the 30th in an hour | Raise it (Resend SMTP allows far more). Pin the value in the same contract check as G-S2 |
| G-S4 | OTP attempt limit not pinned | A capped number of guesses per code, lock-out and a fresh code | Client: no cap, only a re-entry guard (`MagicLinkConfirmation.tsx:46`). Server: Supabase's token-verification rate limit (per IP), not in the repo. The code has 8 digits (`src/lib/auth-otp-routing.ts:10`) | MED | Every sign-in | Pin `rate_limit_verify` and `otp_expiry` in the auth-config check. After 5 wrong codes the client shows "Send a new code". The real-OTP test (O7) asserts the length and the expiry |
| G-S5 | OTP / link expiry not pinned | 10-15 min codes, single-use links | Supabase defaults; nothing in the repo (`config.toml` has no `[auth]`) | MED | Every sign-in | Set `otp_expiry` to 900 s and pin it (PLAN PR-5/PR-6). Invite tokens are already right: sha256, 7 days, single use (`M/20261110120000_…`, `M/20261121180000_…`) |
| G-S6 | **Sign-out is global by default** | Sign out *this device*, plus a separate "Sign out of all devices" (Google, Slack) | `supabase.auth.signOut()` with default scope `global` (`src/hooks/useAuth.tsx:136-176`). Signing out on a phone ends the laptop session too | MED | 1 login has 2+ sessions today; everyone later | Default to `scope:'local'`; add "Sign out everywhere" (`scope:'global'`) in Account settings. DECISIONS D6 |
| G-S7 | No session time-box | An inactivity timeout (Google: re-auth for sensitive actions; Slack: workspace policy) | No timebox or inactivity timeout set. 7 of 13 sessions are older than 30 days | LOW | 7 sessions | Set an inactivity timeout of 90 days (dashboard, Pro). Re-check the mailbox for erase and e-mail change (`reauthenticate` OTP) |
| G-S8 | No new-sign-in notice and no device list | A "new sign-in on iPhone" e-mail; a list of active sessions | NOT FOUND in either repo | LOW | All | Later: an `auth.sessions`-backed "Where you're signed in" list using the G-S6 control. Not before launch |
| G-S9 | Team invite is a bearer token | Slack: e-mail-bound, or the admin approves. Notion: link invites can be turned off | Bearer by design; owner decision O3 keeps it. The card does not yet name who is joining | MED | 5 dancers could open a forwarded link | Build O3: "Joining as <e-mail>", "Not you? Sign out" (PLAN PR-3). Already right: rate limit 10 failed per hour, single use, 7 days |
| G-S10 | `organiser-signup` edge fn deployed (v18) and probably dead | No unused authenticated endpoints | It calls an `is_admin()` RPC with the service role, so it likely always refuses (admin `fn/organiser-signup/index.ts:143-189`, inferred) | LOW | 0 | Delete the deployment after confirming no caller (grep shows none in the Website). PLAN PR-2 |
| G-S11 | E-mail change unwalked | Confirm both addresses, notify the old one | Built with secure change (`AccountSettings.tsx:132-205`) | LOW | 0 pending | Grid row `ac.email-change`, OTP-project walk (PR-5) |

## Privacy

| Id | Gap | Norm | What exists | Sev | People | Fix |
|---|---|---|---|---|---|---|
| G-P1 | **Shared device: sign-out leaves person-scoped storage** | Sign-out wipes every local trace | Survive sign-out: `auth_form_state_v1` (e-mail, name, city), `auth_last_email`, `pending_profile_role`, `profile_entry_role`, `auth_pending_return_to`, `pending_level_rating`, plus sessionStorage `finish_profile_*` (MATRIX M76) | **HIGH** | Every shared phone | One `clearPersonScopedStorage()` called from `useAuth().signOut` and from the `SIGNED_OUT` auth event (catches other tabs). Grid `ac.signout.storage`. PLAN PR-3. DECISIONS D1 |
| G-P2 | **No consent record** | A versioned terms/privacy acceptance at sign-up (GDPR Art. 7(1): able to show consent) | `member_consents` and `accept_terms_v1` exist (admin `M/20261121150000_…:37-85`). The Website never calls it: **0 rows**. The footer has no legal link (MATRIX pruned list) | **HIGH** | All 20, and every new one | Add a terms + privacy line on the sign-up e-mail step and call `accept_terms_v1` in `/auth/callback` after the first sign-in. Existing logins accept once on next sign-in. Footer links to `/privacy` and `/terms`. DECISIONS D8 (copy owner) |
| G-P3 | Data export misses the extras | Google Takeout: everything about you | `my_account_export_v1` is called (`src/lib/accountSettings.ts:33-50`). `my_account_export_extras_v1` (consents, feedback and the rest) is NOT called | MED | All | Merge both into the download. PLAN PR-3 |
| G-P4 | **Grace-period erase path deployed against O4** | One deletion behaviour | Website: immediate erase (`account-erase`). Admin: `my_account_erase_request_v1`, cron `account-erase-due`, e-mails with a cancel link to a Website route that does not exist (`/app/options/data/erase`) | MED | 0 rows now; a stray call would e-mail a dead link | Retire: unschedule the cron, revoke EXECUTE on the request/cancel RPCs, undeploy `account-erase-due`, drop `erase_requested_at` from the Website type. Admin migration (owner applies). PLAN PR-2 |
| G-P5 | Erase leaves media outside `u/<uid>/` | Delete everything the person uploaded | `account-erase` skips and only counts R2 objects outside the folder (admin `fn/account-erase/handler.ts:101-122`); kept storage objects (`M/20261120170000_…:64-65`) | MED | Accounts with legacy media | Report the skipped count to the admin log and add a sweep job. Admin PR, after launch |
| G-P6 | Analytics consent | No tracking before consent (UK PECR) | `window.dataLayer` events fire (`src/lib/analytics.ts:40-50`). A consent banner was NOT CHECKED in this research | *UNVERIFIED* | All | Check in PR-6. If GTM loads trackers without consent, gate them |

## Staged rollout

| Id | Gap | Norm | What exists | Sev | Fix |
|---|---|---|---|---|---|
| G-R1 | Sign-up kill switch depends on G-S2 | One switch, tested | `dancer_area_open` (runtime, audited writer `admin_dancer_area_set_open_v1`). False means allowlist-only, **only if hook v2 is wired** | **HIGH** until G-S2 is verified | Verify the hook, then add a rehearsal row: flag false, a new e-mail is refused, an allowlisted e-mail passes (test project, PR-5) |
| G-R2 | Website account routes have only a build-time flag | Runtime flags (LaunchDarkly-style) | `VITE_ENABLE_ORGANISER_SELF_SERVE` (`src/lib/featureFlags.ts:43`), so a redeploy is needed to flip it | LOW | Keep it. The DB flag is the real kill switch. Write it in the runbook |
| G-R3 | No percent rollout | Gradual rollout | The allowlist plus the area flag give staged access by person | LOW | Not needed at 20 logins. The allowlist IS the staged rollout. Revisit past about 500 |

## Observability

| Id | Gap | Norm | What exists | Sev | Fix |
|---|---|---|---|---|---|
| G-O1 | **No sign-up funnel** | Per-step conversion with alerts on drops | Only `auth_viewed`, `auth_auto_switched_to_signup`, `auth_code_verified` (`Auth.tsx:137,283,291`; `MagicLinkConfirmation.tsx:53`). `auth_code_send_clicked` is defined but not used by `Auth.tsx`. Nothing for callback outcome, claim or invite | **HIGH** | 30% of logins never entered their code, and nobody could see it. Add events: `auth_code_sent`, `auth_code_failed{reason}`, `auth_callback{outcome}`, `auth_landing{state}`, `onboarding_end`, `invite_redeem{status}`, `claim{status}`. Add a weekly admin query on `auth.users` (unconfirmed versus confirmed) |
| G-O2 | **Auth failures are not reported** | Sentry with auth-step tags | The home-made reporter has no user id (`src/lib/clientErrorReporter.ts:1-17`). Callback fallbacks, timeouts and sign-out failures report nothing. 0 auth errors were captured in 30 days | **HIGH** | Report `navigateToSignedInFallback`, the callback `timeout` and `expired`, `signOut` `failed`, and gate `error` with a `step` tag. No PII (no e-mail) |
| G-O3 | No redirect-loop detector | Loop guard plus alert | NOT FOUND | MED | A tiny router hook: the same 2 paths alternating more than 4 times in 10 s reports `redirect_loop` and shows a "Something went wrong, go Home" card |
| G-O4 | People are not told about decisions | Slack and Meta e-mail on access granted, team add, invite | Grant/decline, team add and remove: no e-mail (no matches in admin `fn/`) | MED | Resend e-mails from the resolving RPCs' callers (edge fn). After launch |
| G-O5 | Edge functions have no error tracking | Sentry | NOT FOUND in admin `fn/` | LOW | Log to `client_error_reports` with `source='edge'` |

## Accessibility

| Id | Gap | What exists | Sev | Fix |
|---|---|---|---|---|
| G-A1 | Focus does not move to the code box | Good labels: `<label>`, `aria-invalid`/`describedby`, `role=alert`, `autoComplete=one-time-code`, `inputMode=numeric` (`MagicLinkConfirmation.tsx:98-139`). But no `autoFocus` or focus move | MED | Focus the input on mount, and announce "Code sent to <e-mail>" in a polite live region |
| G-A2 | No automated a11y check on account screens | `PublicClaimCard` moves focus (`:132-139`); no axe run found | MED | Run `@axe-core/playwright` inside the existing build walks (one assertion per J row end). PLAN PR-1 |
| G-A3 | Keyboard-only walk never recorded | — | LOW | One walk row per entry in PR-1's WALK, by Tab and Enter only |

## E-mail deliverability

| Id | Gap | What exists | Sev | Fix |
|---|---|---|---|---|
| G-D1 | **DMARC `p=none` with no report address, unverified** | SPF `include:amazonses.com` on `send.`, DKIM `resend._domainkey`, DMARC `p=none`, no `rua` (admin `docs/audits/launch-readiness-2026-10-09.md:21,219-224`); unverified on 10-12 (`docs/go-live-checklist-2026-10-12.md:19`). Not re-read here: the worker has no DNS tool | MED | Add `rua=mailto:` to collect reports; after 2 clean weeks move to `p=quarantine`. Owner (DNS) |
| G-D2 | No apex MX: replies to `hello@` / `login@` bounce | Same doc | MED | Add inbound (Resend inbound, or forwarding) so "reply to this e-mail" works. Gmail and Yahoo bulk-sender rules favour a working reply path |
| G-D3 | Two senders | `login@` (Auth SMTP) and `hello@` (edge fns via the Resend API) | LOW | Keep both, aligned on the same DKIM domain; check in the D1 report |

## Already at professional grade (no action)

- One login with many sides, and no stored active side (`switcherItems`).
- returnTo goes through one sanitiser and is carried in the URL.
- Fail-closed gates.
- Hashed, single-use, expiring invite tokens with a redeem rate limit.
- Mailbox proof for claims (`_mailbox_proven_p5`).
- Secure e-mail change.
- Immediate erase with refusal rules.
- Unconfirmed-login purge.
- The per-member action rate limiter.
- An audited, runtime sign-up flag.
