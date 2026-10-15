# Public journeys walk (production build, mocked backend)

How the walk was run:

- **Spec:** `tests/e2e-build/public-journeys.build.spec.ts`, one test per row of `tests/journeys/publicEntryJourneys.ts`.
- **Build:** `npm run build` with the phone-qa env and `VITE_ENABLE_ORGANISER_SELF_SERVE=true`.
- **Server:** `scripts/_serve-build.mjs` (`playwright.build.config.ts`).
- **Viewports:** 390x844, plus 360x780 for `organiser-link-new`.
- **Result:** 19/19 pass, run on 2026-10-15. Every screenshot was taken after its step's assertions passed.

What was mocked:

- **The e-mail code is mocked.** `/auth/v1/otp` and `/auth/v1/verify` are answered by the spec's fake, which tracks a session.
- **The backend is a stateful fake.** It holds the dancer profile, the strength and missing state, and the photo upload.
- **The fake uses the prod shapes.** A new account's stub has name, city and role from the sign-up form, so onboarding starts at the photo card. There are no organisers yet.

The orchestrator repeats the organiser and dancer rows on the real site with a real inbox.

| row | step | screenshot | what was on screen | pass/fail |
|---|---|---|---|---|
| claim-link-new | entry | [01-entry.png](claim-link-new/01-entry.png) | entry | pass |
| claim-link-new | auth-role | [02-auth-role.png](claim-link-new/02-auth-role.png) | auth role | pass |
| claim-link-new | auth-details | [03-auth-details.png](claim-link-new/03-auth-details.png) | auth details | pass |
| claim-link-new | auth-email | [04-auth-email.png](claim-link-new/04-auth-email.png) | auth email | pass |
| claim-link-new | code | [05-code.png](claim-link-new/05-code.png) | code | pass |
| claim-link-new | card-photo | [06-card-photo.png](claim-link-new/06-card-photo.png) | card photo | pass |
| claim-link-new | photo | [07-photo.png](claim-link-new/07-photo.png) | photo | pass |
| claim-link-new | photo-crop | [08-photo-crop.png](claim-link-new/08-photo-crop.png) | photo crop | pass |
| claim-link-new | photo-preview | [09-photo-preview.png](claim-link-new/09-photo-preview.png) | photo preview | pass |
| claim-link-new | card-in | [10-card-in.png](claim-link-new/10-card-in.png) | card in | pass |
| claim-link-new | card-years | [11-card-years.png](claim-link-new/11-card-years.png) | card years | pass |
| claim-link-new | card-styles | [12-card-styles.png](claim-link-new/12-card-styles.png) | card styles | pass |
| claim-link-new | card-nice | [13-card-nice.png](claim-link-new/13-card-nice.png) | card nice | pass |
| claim-link-new | end | [14-end.png](claim-link-new/14-end.png) | end | pass |
| dancer-link-new | entry | [01-entry.png](dancer-link-new/01-entry.png) | entry | pass |
| dancer-link-new | auth-details | [02-auth-details.png](dancer-link-new/02-auth-details.png) | auth details | pass |
| dancer-link-new | auth-email | [03-auth-email.png](dancer-link-new/03-auth-email.png) | auth email | pass |
| dancer-link-new | code | [04-code.png](dancer-link-new/04-code.png) | code | pass |
| dancer-link-new | card-photo | [05-card-photo.png](dancer-link-new/05-card-photo.png) | card photo | pass |
| dancer-link-new | photo | [06-photo.png](dancer-link-new/06-photo.png) | photo | pass |
| dancer-link-new | photo-crop | [07-photo-crop.png](dancer-link-new/07-photo-crop.png) | photo crop | pass |
| dancer-link-new | photo-preview | [08-photo-preview.png](dancer-link-new/08-photo-preview.png) | photo preview | pass |
| dancer-link-new | card-in | [09-card-in.png](dancer-link-new/09-card-in.png) | card in | pass |
| dancer-link-new | card-years | [10-card-years.png](dancer-link-new/10-card-years.png) | card years | pass |
| dancer-link-new | card-styles | [11-card-styles.png](dancer-link-new/11-card-styles.png) | card styles | pass |
| dancer-link-new | card-nice | [12-card-nice.png](dancer-link-new/12-card-nice.png) | card nice | pass |
| dancer-link-new | end | [13-end.png](dancer-link-new/13-end.png) | end | pass |
| dancer-link-new-reload | entry | [01-entry.png](dancer-link-new-reload/01-entry.png) | entry | pass |
| dancer-link-new-reload | auth-details | [02-auth-details.png](dancer-link-new-reload/02-auth-details.png) | auth details | pass |
| dancer-link-new-reload | auth-email | [03-auth-email.png](dancer-link-new-reload/03-auth-email.png) | auth email | pass |
| dancer-link-new-reload | code | [04-code.png](dancer-link-new-reload/04-code.png) | code | pass |
| dancer-link-new-reload | midway-before-reload | [05-midway-before-reload.png](dancer-link-new-reload/05-midway-before-reload.png) | midway before reload | pass |
| dancer-link-new-reload | card-photo | [06-card-photo.png](dancer-link-new-reload/06-card-photo.png) | card photo | pass |
| dancer-link-new-reload | photo | [07-photo.png](dancer-link-new-reload/07-photo.png) | photo | pass |
| dancer-link-new-reload | photo-crop | [08-photo-crop.png](dancer-link-new-reload/08-photo-crop.png) | photo crop | pass |
| dancer-link-new-reload | photo-preview | [09-photo-preview.png](dancer-link-new-reload/09-photo-preview.png) | photo preview | pass |
| dancer-link-new-reload | card-in | [10-card-in.png](dancer-link-new-reload/10-card-in.png) | card in | pass |
| dancer-link-new-reload | end | [11-end.png](dancer-link-new-reload/11-end.png) | end | pass |
| deep-link-account-o-signed-out | entry | [01-entry.png](deep-link-account-o-signed-out/01-entry.png) | entry | pass |
| deep-link-account-o-signed-out | auth-role | [02-auth-role.png](deep-link-account-o-signed-out/02-auth-role.png) | auth role | pass |
| deep-link-account-o-signed-out | auth-details | [03-auth-details.png](deep-link-account-o-signed-out/03-auth-details.png) | auth details | pass |
| deep-link-account-o-signed-out | auth-email | [04-auth-email.png](deep-link-account-o-signed-out/04-auth-email.png) | auth email | pass |
| deep-link-account-o-signed-out | code | [05-code.png](deep-link-account-o-signed-out/05-code.png) | code | pass |
| deep-link-account-o-signed-out | card-photo | [06-card-photo.png](deep-link-account-o-signed-out/06-card-photo.png) | card photo | pass |
| deep-link-account-o-signed-out | photo | [07-photo.png](deep-link-account-o-signed-out/07-photo.png) | photo | pass |
| deep-link-account-o-signed-out | photo-crop | [08-photo-crop.png](deep-link-account-o-signed-out/08-photo-crop.png) | photo crop | pass |
| deep-link-account-o-signed-out | photo-preview | [09-photo-preview.png](deep-link-account-o-signed-out/09-photo-preview.png) | photo preview | pass |
| deep-link-account-o-signed-out | card-in | [10-card-in.png](deep-link-account-o-signed-out/10-card-in.png) | card in | pass |
| deep-link-account-o-signed-out | card-years | [11-card-years.png](deep-link-account-o-signed-out/11-card-years.png) | card years | pass |
| deep-link-account-o-signed-out | card-styles | [12-card-styles.png](deep-link-account-o-signed-out/12-card-styles.png) | card styles | pass |
| deep-link-account-o-signed-out | card-nice | [13-card-nice.png](deep-link-account-o-signed-out/13-card-nice.png) | card nice | pass |
| deep-link-account-o-signed-out | end | [14-end.png](deep-link-account-o-signed-out/14-end.png) | end | pass |
| deep-link-app-signed-out | entry | [01-entry.png](deep-link-app-signed-out/01-entry.png) | entry | pass |
| deep-link-app-signed-out | auth-signin | [02-auth-signin.png](deep-link-app-signed-out/02-auth-signin.png) | auth signin | pass |
| deep-link-app-signed-out | code | [03-code.png](deep-link-app-signed-out/03-code.png) | code | pass |
| deep-link-app-signed-out | end | [04-end.png](deep-link-app-signed-out/04-end.png) | end | pass |
| organiser-link-existing-dancer | entry | [01-entry.png](organiser-link-existing-dancer/01-entry.png) | entry | pass |
| organiser-link-existing-dancer | auth-signin | [02-auth-signin.png](organiser-link-existing-dancer/02-auth-signin.png) | auth signin | pass |
| organiser-link-existing-dancer | code | [03-code.png](organiser-link-existing-dancer/03-code.png) | code | pass |
| organiser-link-existing-dancer | end | [04-end.png](organiser-link-existing-dancer/04-end.png) | end | pass |
| organiser-link-expired-link | entry | [01-entry.png](organiser-link-expired-link/01-entry.png) | entry | pass |
| organiser-link-expired-link | auth-details | [02-auth-details.png](organiser-link-expired-link/02-auth-details.png) | auth details | pass |
| organiser-link-expired-link | auth-email | [03-auth-email.png](organiser-link-expired-link/03-auth-email.png) | auth email | pass |
| organiser-link-expired-link | code | [04-code.png](organiser-link-expired-link/04-code.png) | code | pass |
| organiser-link-expired-link | expired-notice | [05-expired-notice.png](organiser-link-expired-link/05-expired-notice.png) | expired notice | pass |
| organiser-link-expired-link | auth-signin | [06-auth-signin.png](organiser-link-expired-link/06-auth-signin.png) | auth signin | pass |
| organiser-link-expired-link | code | [07-code.png](organiser-link-expired-link/07-code.png) | code | pass |
| organiser-link-expired-link | card-photo | [08-card-photo.png](organiser-link-expired-link/08-card-photo.png) | card photo | pass |
| organiser-link-expired-link | photo | [09-photo.png](organiser-link-expired-link/09-photo.png) | photo | pass |
| organiser-link-expired-link | photo-crop | [10-photo-crop.png](organiser-link-expired-link/10-photo-crop.png) | photo crop | pass |
| organiser-link-expired-link | photo-preview | [11-photo-preview.png](organiser-link-expired-link/11-photo-preview.png) | photo preview | pass |
| organiser-link-expired-link | card-in | [12-card-in.png](organiser-link-expired-link/12-card-in.png) | card in | pass |
| organiser-link-expired-link | card-years | [13-card-years.png](organiser-link-expired-link/13-card-years.png) | card years | pass |
| organiser-link-expired-link | card-styles | [14-card-styles.png](organiser-link-expired-link/14-card-styles.png) | card styles | pass |
| organiser-link-expired-link | card-nice | [15-card-nice.png](organiser-link-expired-link/15-card-nice.png) | card nice | pass |
| organiser-link-expired-link | end | [16-end.png](organiser-link-expired-link/16-end.png) | end | pass |
| organiser-link-hostile-returnto | entry | [01-entry.png](organiser-link-hostile-returnto/01-entry.png) | entry | pass |
| organiser-link-hostile-returnto | auth-details | [02-auth-details.png](organiser-link-hostile-returnto/02-auth-details.png) | auth details | pass |
| organiser-link-hostile-returnto | auth-email | [03-auth-email.png](organiser-link-hostile-returnto/03-auth-email.png) | auth email | pass |
| organiser-link-hostile-returnto | code | [04-code.png](organiser-link-hostile-returnto/04-code.png) | code | pass |
| organiser-link-hostile-returnto | card-photo | [05-card-photo.png](organiser-link-hostile-returnto/05-card-photo.png) | card photo | pass |
| organiser-link-hostile-returnto | photo | [06-photo.png](organiser-link-hostile-returnto/06-photo.png) | photo | pass |
| organiser-link-hostile-returnto | photo-crop | [07-photo-crop.png](organiser-link-hostile-returnto/07-photo-crop.png) | photo crop | pass |
| organiser-link-hostile-returnto | photo-preview | [08-photo-preview.png](organiser-link-hostile-returnto/08-photo-preview.png) | photo preview | pass |
| organiser-link-hostile-returnto | card-in | [09-card-in.png](organiser-link-hostile-returnto/09-card-in.png) | card in | pass |
| organiser-link-hostile-returnto | card-years | [10-card-years.png](organiser-link-hostile-returnto/10-card-years.png) | card years | pass |
| organiser-link-hostile-returnto | card-styles | [11-card-styles.png](organiser-link-hostile-returnto/11-card-styles.png) | card styles | pass |
| organiser-link-hostile-returnto | card-nice | [12-card-nice.png](organiser-link-hostile-returnto/12-card-nice.png) | card nice | pass |
| organiser-link-hostile-returnto | end | [13-end.png](organiser-link-hostile-returnto/13-end.png) | end | pass |
| organiser-link-magic-link | entry | [01-entry.png](organiser-link-magic-link/01-entry.png) | entry | pass |
| organiser-link-magic-link | auth-details | [02-auth-details.png](organiser-link-magic-link/02-auth-details.png) | auth details | pass |
| organiser-link-magic-link | auth-email | [03-auth-email.png](organiser-link-magic-link/03-auth-email.png) | auth email | pass |
| organiser-link-magic-link | code | [04-code.png](organiser-link-magic-link/04-code.png) | code | pass |
| organiser-link-magic-link | card-photo | [05-card-photo.png](organiser-link-magic-link/05-card-photo.png) | card photo | pass |
| organiser-link-magic-link | photo | [06-photo.png](organiser-link-magic-link/06-photo.png) | photo | pass |
| organiser-link-magic-link | photo-crop | [07-photo-crop.png](organiser-link-magic-link/07-photo-crop.png) | photo crop | pass |
| organiser-link-magic-link | photo-preview | [08-photo-preview.png](organiser-link-magic-link/08-photo-preview.png) | photo preview | pass |
| organiser-link-magic-link | card-in | [09-card-in.png](organiser-link-magic-link/09-card-in.png) | card in | pass |
| organiser-link-magic-link | card-years | [10-card-years.png](organiser-link-magic-link/10-card-years.png) | card years | pass |
| organiser-link-magic-link | card-styles | [11-card-styles.png](organiser-link-magic-link/11-card-styles.png) | card styles | pass |
| organiser-link-magic-link | card-nice | [12-card-nice.png](organiser-link-magic-link/12-card-nice.png) | card nice | pass |
| organiser-link-magic-link | end | [13-end.png](organiser-link-magic-link/13-end.png) | end | pass |
| organiser-link-new | entry | [01-entry.png](organiser-link-new/01-entry.png) | entry | pass |
| organiser-link-new | auth-details | [02-auth-details.png](organiser-link-new/02-auth-details.png) | auth details | pass |
| organiser-link-new | auth-email | [03-auth-email.png](organiser-link-new/03-auth-email.png) | auth email | pass |
| organiser-link-new | code | [04-code.png](organiser-link-new/04-code.png) | code | pass |
| organiser-link-new | card-photo | [05-card-photo.png](organiser-link-new/05-card-photo.png) | card photo | pass |
| organiser-link-new | photo | [06-photo.png](organiser-link-new/06-photo.png) | photo | pass |
| organiser-link-new | photo-crop | [07-photo-crop.png](organiser-link-new/07-photo-crop.png) | photo crop | pass |
| organiser-link-new | photo-preview | [08-photo-preview.png](organiser-link-new/08-photo-preview.png) | photo preview | pass |
| organiser-link-new | card-in | [09-card-in.png](organiser-link-new/09-card-in.png) | card in | pass |
| organiser-link-new | card-years | [10-card-years.png](organiser-link-new/10-card-years.png) | card years | pass |
| organiser-link-new | card-styles | [11-card-styles.png](organiser-link-new/11-card-styles.png) | card styles | pass |
| organiser-link-new | card-nice | [12-card-nice.png](organiser-link-new/12-card-nice.png) | card nice | pass |
| organiser-link-new | end | [13-end.png](organiser-link-new/13-end.png) | end | pass |
| organiser-link-new-closed-tab | entry | [01-entry.png](organiser-link-new-closed-tab/01-entry.png) | entry | pass |
| organiser-link-new-closed-tab | auth-details | [02-auth-details.png](organiser-link-new-closed-tab/02-auth-details.png) | auth details | pass |
| organiser-link-new-closed-tab | auth-email | [03-auth-email.png](organiser-link-new-closed-tab/03-auth-email.png) | auth email | pass |
| organiser-link-new-closed-tab | code | [04-code.png](organiser-link-new-closed-tab/04-code.png) | code | pass |
| organiser-link-new-closed-tab | midway-before-close | [05-midway-before-close.png](organiser-link-new-closed-tab/05-midway-before-close.png) | midway before close | pass |
| organiser-link-new-closed-tab | reopen-home | [06-reopen-home.png](organiser-link-new-closed-tab/06-reopen-home.png) | reopen home | pass |
| organiser-link-new-closed-tab | card-photo | [07-card-photo.png](organiser-link-new-closed-tab/07-card-photo.png) | card photo | pass |
| organiser-link-new-closed-tab | photo | [08-photo.png](organiser-link-new-closed-tab/08-photo.png) | photo | pass |
| organiser-link-new-closed-tab | photo-crop | [09-photo-crop.png](organiser-link-new-closed-tab/09-photo-crop.png) | photo crop | pass |
| organiser-link-new-closed-tab | photo-preview | [10-photo-preview.png](organiser-link-new-closed-tab/10-photo-preview.png) | photo preview | pass |
| organiser-link-new-closed-tab | card-in | [11-card-in.png](organiser-link-new-closed-tab/11-card-in.png) | card in | pass |
| organiser-link-new-closed-tab | card-years | [12-card-years.png](organiser-link-new-closed-tab/12-card-years.png) | card years | pass |
| organiser-link-new-closed-tab | card-styles | [13-card-styles.png](organiser-link-new-closed-tab/13-card-styles.png) | card styles | pass |
| organiser-link-new-closed-tab | card-nice | [14-card-nice.png](organiser-link-new-closed-tab/14-card-nice.png) | card nice | pass |
| organiser-link-new-closed-tab | end | [15-end.png](organiser-link-new-closed-tab/15-end.png) | end | pass |
| organiser-link-new-reload | entry | [01-entry.png](organiser-link-new-reload/01-entry.png) | entry | pass |
| organiser-link-new-reload | auth-details | [02-auth-details.png](organiser-link-new-reload/02-auth-details.png) | auth details | pass |
| organiser-link-new-reload | auth-email | [03-auth-email.png](organiser-link-new-reload/03-auth-email.png) | auth email | pass |
| organiser-link-new-reload | code | [04-code.png](organiser-link-new-reload/04-code.png) | code | pass |
| organiser-link-new-reload | midway-before-reload | [05-midway-before-reload.png](organiser-link-new-reload/05-midway-before-reload.png) | midway before reload | pass |
| organiser-link-new-reload | card-photo | [06-card-photo.png](organiser-link-new-reload/06-card-photo.png) | card photo | pass |
| organiser-link-new-reload | photo | [07-photo.png](organiser-link-new-reload/07-photo.png) | photo | pass |
| organiser-link-new-reload | photo-crop | [08-photo-crop.png](organiser-link-new-reload/08-photo-crop.png) | photo crop | pass |
| organiser-link-new-reload | photo-preview | [09-photo-preview.png](organiser-link-new-reload/09-photo-preview.png) | photo preview | pass |
| organiser-link-new-reload | card-in | [10-card-in.png](organiser-link-new-reload/10-card-in.png) | card in | pass |
| organiser-link-new-reload | end | [11-end.png](organiser-link-new-reload/11-end.png) | end | pass |
| organiser-link-new/360x780 | entry | [01-entry.png](organiser-link-new/360x780/01-entry.png) | entry | pass |
| organiser-link-new/360x780 | auth-details | [02-auth-details.png](organiser-link-new/360x780/02-auth-details.png) | auth details | pass |
| organiser-link-new/360x780 | auth-email | [03-auth-email.png](organiser-link-new/360x780/03-auth-email.png) | auth email | pass |
| organiser-link-new/360x780 | code | [04-code.png](organiser-link-new/360x780/04-code.png) | code | pass |
| organiser-link-new/360x780 | card-photo | [05-card-photo.png](organiser-link-new/360x780/05-card-photo.png) | card photo | pass |
| organiser-link-new/360x780 | photo | [06-photo.png](organiser-link-new/360x780/06-photo.png) | photo | pass |
| organiser-link-new/360x780 | photo-crop | [07-photo-crop.png](organiser-link-new/360x780/07-photo-crop.png) | photo crop | pass |
| organiser-link-new/360x780 | photo-preview | [08-photo-preview.png](organiser-link-new/360x780/08-photo-preview.png) | photo preview | pass |
| organiser-link-new/360x780 | card-in | [09-card-in.png](organiser-link-new/360x780/09-card-in.png) | card in | pass |
| organiser-link-new/360x780 | card-years | [10-card-years.png](organiser-link-new/360x780/10-card-years.png) | card years | pass |
| organiser-link-new/360x780 | card-styles | [11-card-styles.png](organiser-link-new/360x780/11-card-styles.png) | card styles | pass |
| organiser-link-new/360x780 | card-nice | [12-card-nice.png](organiser-link-new/360x780/12-card-nice.png) | card nice | pass |
| organiser-link-new/360x780 | end | [13-end.png](organiser-link-new/360x780/13-end.png) | end | pass |
| organiser-link-signed-in | entry | [01-entry.png](organiser-link-signed-in/01-entry.png) | entry | pass |
| organiser-link-signed-in | end | [02-end.png](organiser-link-signed-in/02-end.png) | end | pass |
| organiser-link-wrong-code | entry | [01-entry.png](organiser-link-wrong-code/01-entry.png) | entry | pass |
| organiser-link-wrong-code | auth-details | [02-auth-details.png](organiser-link-wrong-code/02-auth-details.png) | auth details | pass |
| organiser-link-wrong-code | auth-email | [03-auth-email.png](organiser-link-wrong-code/03-auth-email.png) | auth email | pass |
| organiser-link-wrong-code | code | [04-code.png](organiser-link-wrong-code/04-code.png) | code | pass |
| organiser-link-wrong-code | code-wrong | [05-code-wrong.png](organiser-link-wrong-code/05-code-wrong.png) | code wrong | pass |
| organiser-link-wrong-code | card-photo | [06-card-photo.png](organiser-link-wrong-code/06-card-photo.png) | card photo | pass |
| organiser-link-wrong-code | photo | [07-photo.png](organiser-link-wrong-code/07-photo.png) | photo | pass |
| organiser-link-wrong-code | photo-crop | [08-photo-crop.png](organiser-link-wrong-code/08-photo-crop.png) | photo crop | pass |
| organiser-link-wrong-code | photo-preview | [09-photo-preview.png](organiser-link-wrong-code/09-photo-preview.png) | photo preview | pass |
| organiser-link-wrong-code | card-in | [10-card-in.png](organiser-link-wrong-code/10-card-in.png) | card in | pass |
| organiser-link-wrong-code | card-years | [11-card-years.png](organiser-link-wrong-code/11-card-years.png) | card years | pass |
| organiser-link-wrong-code | card-styles | [12-card-styles.png](organiser-link-wrong-code/12-card-styles.png) | card styles | pass |
| organiser-link-wrong-code | card-nice | [13-card-nice.png](organiser-link-wrong-code/13-card-nice.png) | card nice | pass |
| organiser-link-wrong-code | end | [14-end.png](organiser-link-wrong-code/14-end.png) | end | pass |
| signin-both | entry | [01-entry.png](signin-both/01-entry.png) | entry | pass |
| signin-both | auth-signin | [02-auth-signin.png](signin-both/02-auth-signin.png) | auth signin | pass |
| signin-both | code | [03-code.png](signin-both/03-code.png) | code | pass |
| signin-both | end | [04-end.png](signin-both/04-end.png) | end | pass |
| signin-dancer | entry | [01-entry.png](signin-dancer/01-entry.png) | entry | pass |
| signin-dancer | auth-signin | [02-auth-signin.png](signin-dancer/02-auth-signin.png) | auth signin | pass |
| signin-dancer | code | [03-code.png](signin-dancer/03-code.png) | code | pass |
| signin-dancer | end | [04-end.png](signin-dancer/04-end.png) | end | pass |
| signin-unfinished-dancer | entry | [01-entry.png](signin-unfinished-dancer/01-entry.png) | entry | pass |
| signin-unfinished-dancer | auth-signin | [02-auth-signin.png](signin-unfinished-dancer/02-auth-signin.png) | auth signin | pass |
| signin-unfinished-dancer | code | [03-code.png](signin-unfinished-dancer/03-code.png) | code | pass |
| signin-unfinished-dancer | card-role | [04-card-role.png](signin-unfinished-dancer/04-card-role.png) | card role | pass |
| signin-unfinished-dancer | card-photo | [05-card-photo.png](signin-unfinished-dancer/05-card-photo.png) | card photo | pass |
| signin-unfinished-dancer | photo | [06-photo.png](signin-unfinished-dancer/06-photo.png) | photo | pass |
| signin-unfinished-dancer | photo-crop | [07-photo-crop.png](signin-unfinished-dancer/07-photo-crop.png) | photo crop | pass |
| signin-unfinished-dancer | photo-preview | [08-photo-preview.png](signin-unfinished-dancer/08-photo-preview.png) | photo preview | pass |
| signin-unfinished-dancer | card-in | [09-card-in.png](signin-unfinished-dancer/09-card-in.png) | card in | pass |
| signin-unfinished-dancer | card-years | [10-card-years.png](signin-unfinished-dancer/10-card-years.png) | card years | pass |
| signin-unfinished-dancer | card-styles | [11-card-styles.png](signin-unfinished-dancer/11-card-styles.png) | card styles | pass |
| signin-unfinished-dancer | card-nice | [12-card-nice.png](signin-unfinished-dancer/12-card-nice.png) | card nice | pass |
| signin-unfinished-dancer | end | [13-end.png](signin-unfinished-dancer/13-end.png) | end | pass |
| team-invite-new | entry | [01-entry.png](team-invite-new/01-entry.png) | entry | pass |
| team-invite-new | auth-role | [02-auth-role.png](team-invite-new/02-auth-role.png) | auth role | pass |
| team-invite-new | auth-details | [03-auth-details.png](team-invite-new/03-auth-details.png) | auth details | pass |
| team-invite-new | auth-email | [04-auth-email.png](team-invite-new/04-auth-email.png) | auth email | pass |
| team-invite-new | code | [05-code.png](team-invite-new/05-code.png) | code | pass |
| team-invite-new | card-photo | [06-card-photo.png](team-invite-new/06-card-photo.png) | card photo | pass |
| team-invite-new | photo | [07-photo.png](team-invite-new/07-photo.png) | photo | pass |
| team-invite-new | photo-crop | [08-photo-crop.png](team-invite-new/08-photo-crop.png) | photo crop | pass |
| team-invite-new | photo-preview | [09-photo-preview.png](team-invite-new/09-photo-preview.png) | photo preview | pass |
| team-invite-new | card-in | [10-card-in.png](team-invite-new/10-card-in.png) | card in | pass |
| team-invite-new | card-years | [11-card-years.png](team-invite-new/11-card-years.png) | card years | pass |
| team-invite-new | card-styles | [12-card-styles.png](team-invite-new/12-card-styles.png) | card styles | pass |
| team-invite-new | card-nice | [13-card-nice.png](team-invite-new/13-card-nice.png) | card nice | pass |
| team-invite-new | end | [14-end.png](team-invite-new/14-end.png) | end | pass |
