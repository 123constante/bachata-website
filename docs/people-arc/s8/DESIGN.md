# People S8 -- a "website" that is really Instagram

Brief: `briefs/PEOPLE-S8-instagram-label-brief.md` (branch `brief/people-arc`). S6 critique finding 3.

## Before / after

| Stored `website_url` | Before (row) | After (row) |
|---|---|---|
| `https://www.instagram.com/ben_bachatero/?hl=en` | WEBSITE `www.instagram.com/ben_bachatero/?hl=en` | INSTAGRAM `@ben_bachatero` |
| `https://m.instagram.com/<name>` | WEBSITE `m.instagram.com/<name>` | INSTAGRAM `@<name>` |
| `https://www.instagram.com/p/<id>/?igsh=x` (a post) | WEBSITE, raw with query | WEBSITE `instagram.com/p/<id>` (no handle guessed) |
| `https://www.facebook.com/<name>/?ref=x` | WEBSITE, raw with query | FACEBOOK `facebook.com/<name>` |
| `https://www.facebook.com/profile.php?id=1` | WEBSITE, raw with query | WEBSITE `facebook.com/profile.php` (ambiguous: stays a website) |
| `https://www.CarlaDance.com/classes/#x` | WEBSITE `www.CarlaDance.com/classes/#x` | WEBSITE `carladance.com/classes` |

The link (`href`) is always the stored URL, untouched. Only the label and the kind changed.

## Rules

- A label never shows a scheme, `www.`, a `?query`, a `#hash` or a trailing slash. The host is lowercased.
  The cleaning is `linkText`, which the DJ and teacher worlds already use. There is one rule, not two.
- If the host is `instagram.com` (bare, `www.` or `m.`) and the path is exactly one handle-shaped
  segment that is not one of Instagram's own pages (`p`, `reel`, `reels`, `tv`, `explore`, `stories`,
  `accounts`, `direct`), the link is an Instagram row labelled `@handle`.
- Facebook works the same way: one profile-shaped segment, not `profile.php`, `people`, `groups`,
  `pages`, `events`, `share` and similar. Anything else stays a website.
- One handle never gets two rows. If the dancer's own Instagram link shows the same handle
  (case-insensitive), the website row is dropped. A different handle gets its own Instagram row.
  Facebook follows the same rule.

## Where it shows

`websiteContact` in `src/modules/dancer-app/public-page/model.ts` is the one mapping. It feeds:
- the flag-OFF dancer page (`PublicDancerPageV2`, `model.contacts`);
- the dancer world (`DancerProfile.tsx` hands `worldModel.contacts` to `WorldContact`).

The DJ and teacher worlds do not share this mapping. They show ONE contact value through
`linkText`, which already drops the query. The DJ page's own `splitInstagramWebsite`
(`src/components/dj/djContacts.ts`) applies a different, older rule: a non-profile Instagram URL
is dropped, and an Instagram website is dropped whenever an Instagram link exists, even with a different handle. Making the two rules
match is left as a follow-up. It sits outside the dancer-app folder, and the brief scopes this PR
to the dancer mapping.
