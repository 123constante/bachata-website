# People arc P0 -- prod shapes (counts only)

Surveyed 2026-10-23 on prod (`stsdtacfauprzrdebmzg`), read-only. A "person" is a `dancer_profiles` row;
roles are what `get_public_person_roles_v1(id)` returns (the same function the hub uses). "Live" = not
archived and `is_active` not false (the site's `NOT_DEACTIVATED` rule). Upcoming gig = a row of
`get_profile_event_timeline_v2('dj', id)` starting from now. Photo = `dancer_profiles.avatar_url` set
(the DJ / teacher photo columns are separate; see REPORT section 2).

## Role combinations x fields (live people)

| Roles (DB answer) | People | Photo | Claimed | Name > 16 chars | Empty bio | No languages | No nationality | DJ gig upcoming | DJ 2+ upcoming | Teaching upcoming |
|---|---|---|---|---|---|---|---|---|---|---|
| teacher only | 62 | 20 | 0 | 6 | 62 | 62 | 60 | 0 | 0 | 21 |
| dancer + teacher | 36 | 36 | 0 | 2 | 30 | 34 | 31 | 0 | 0 | 14 |
| dancer only | 26 | 21 | 0 | 1 | 24 | 23 | 24 | 0 | 0 | 0 |
| dancer + dj + teacher | 25 | 25 | 5 | 2 | 24 | 15 | 16 | 11 | 6 | 13 |
| dancer + dj | 10 | 10 | 1 | 0 | 10 | 10 | 9 | 3 | 1 | 0 |
| no public role | 6 | 1 | 0 | 0 | 6 | 6 | 6 | 0 | 0 | 0 |
| dj only | 4 | 0 | 0 | 1 | 4 | 4 | 4 | 2 | 0 | 0 |
| dj + teacher | 1 | 0 | 0 | 0 | 1 | 1 | 1 | 1 | 0 | 0 |
| **total live** | **170** | 113 | 6 | 12 | 161 | 155 | 151 | 17 | 7 | 48 |

Hidden (archived or deactivated): **17** rows, all with no public role. These must 404.

What the table says before any screenshot: the typical person is **almost empty** -- 95% have no bio,
91% no languages, 89% no nationality, and 36% are teacher-only (whose pages are closed on prod). The
"rich" profile the pages were designed around is a handful of people.

## Examples captured (one real person per shape)

Ids only; names appear in the screenshots because they are public display names.

| Shape | Id | Why this one |
|---|---|---|
| dancer-photo | 00422bf9-1f6e-4d15-b598-dcfbc1a7d5f3 | dancer only, photo, everything else empty |
| dancer-nophoto | 440f99dd-140f-409f-bf13-65eb9cb4ddcf | dancer only, no photo |
| dancer-longname | 6f05d2f6-ce40-4964-8325-4f2e3d3b19e3 | 21-char name |
| dj-gig-nophoto | 59150b2d-0963-4cea-80fd-76c2d48ab23c | DJ only, 1 upcoming gig, no avatar |
| dj-nogig-nophoto | 7be16d15-2779-4be8-9ef6-809353520593 | DJ only, no gig |
| dj-longname | bccc8a0c-daec-414d-ad21-81aa658ebba1 | DJ only, 20-char name, 1 gig |
| teacher-photo | 0786f332-8082-4574-aad4-df56be2be5d7 | teacher only, photo |
| teacher-nophoto | 0dd8819b-1aa1-4c6e-9747-f09b2c177a0c | teacher only, no photo |
| teacher-longname | a7f1f56b-f54f-4f84-bbb0-26ee6e88640e | teacher only, 20-char name |
| dancer-teacher-longname | a9ec2cdb-9486-4c96-abfb-c44120d5c40a | pair, 17-char name, has nationality |
| dancer-dj-gig | 11549aa4-599a-4be1-96e2-262f0696f9b1 | pair, 1 gig |
| dancer-dj-nogig | 061c6300-763c-4496-9556-2f883b3b7723 | pair, no gig |
| dancer-dj-claimed-2gigs | ae3bffbb-a8d5-44e4-9080-6b217f2b03f9 | pair, claimed, 2 gigs, nationality |
| dj-teacher-gig-nophoto | a8f270d4-4d39-46da-920f-81da41135a0e | the only DJ + teacher, no avatar |
| all3-nogig | 225cfe43-1558-4342-a4a4-09900f33b7de | all three, no gig |
| all3-gig4 | 076e6e97-0259-42d3-98d1-5c5d25a8f4b2 | all three, 4 gigs |
| all3-claimed-rich | 456af8d2-aa47-4055-8d5d-08afaa90cfb4 | all three, claimed, 3 gigs, languages + nationality |
| all3-longname-gig | ddb6bc80-fd55-4dbc-8b25-a99cb22510df | all three, 18-char name, 1 gig |
| noroles-live | 0f5f2045-167c-483f-a725-a5e8890ccfa3 | live row, no public role, empty name |
| archived | 5959a9a2-c529-46bf-a5d6-ab821ad30e81 | archived (must 404 on every URL) |

## Shapes NOT covered

- **Teacher-only with an upcoming class** as its own example (21 exist); teacher-photo / teacher-nophoto
  were picked for photo, not classes.
- **Dancer + dj + teacher with no photo**: zero on prod, nothing to capture.
- **Claimed dancer-only / teacher-only**: zero on prod.
- **A person with a bio**: 9 on prod, none picked as its own shape (the rich example has none); bio
  rendering is covered from code only.
- **Lists over the 100-row API cap**: the walls hold 170 people; whether every tile loads is in REPORT
  section 5.
