# Join outcomes walk results (390x844)

| Case | Landed on (step/stop) | Heading | Bar |
|---|---|---|---|
| 01 done / join-tap | done | Join Salsa Norte on Bachata Calendar | pass |
| 02 done-already-member / join-tap | done | Join Salsa Norte on Bachata Calendar | pass |
| 03 wrong-account / join-tap | join/wrong_account | This link is for a different email | pass |
| 04 email-unproven / join-tap | join/email_unproven | Sign in with a code to continue | pass |
| 05 not-linked / join-tap | join/not_linked | We couldn’t join your profiles automatically | FAIL: primary actions = 0 |
| 06 dead-used / join-tap | dead | This link was already used | pass |
| 07 dead-expired / join-tap | dead | This link has run out | pass |
| 08 dead-revoked / join-tap | dead | This link was withdrawn | pass |
| 09 dead-invalid / join-tap | dead | This link does not work | FAIL: primary actions = 0 |
| 10 rate-limited / join-tap | join/rate_limited | Too many tries | FAIL: primary actions = 0 |
| 11 team-full / join-tap | join/refused | This team is full | pass |
| 12 unconfirmed-account / join-tap | join/refused | Confirm your account first | FAIL: primary actions = 0 |
| 13 profile-incomplete / join-tap | join | Join Salsa Norte? | pass |
| 14 sign-in / join-tap | email | Join Salsa Norte on Bachata Calendar | pass |
| 15 network-failed / join-tap | join/network | Something went wrong | pass |
| 16 done / after-sign-in | done | Join Salsa Norte on Bachata Calendar | pass |
| 17 done-already-member / after-sign-in | done | Join Salsa Norte on Bachata Calendar | pass |
| 18 wrong-account / after-sign-in | join/wrong_account | This link is for a different email | pass |
| 19 email-unproven / after-sign-in | join/email_unproven | Sign in with a code to continue | pass |
| 20 not-linked / after-sign-in | join/not_linked | We couldn’t join your profiles automatically | FAIL: primary actions = 0 |
| 21 dead-used / after-sign-in | dead | This link was already used | pass |
| 22 dead-expired / after-sign-in | dead | This link has run out | pass |
| 23 dead-revoked / after-sign-in | dead | This link was withdrawn | pass |
| 24 dead-invalid / after-sign-in | dead | This link does not work | FAIL: primary actions = 0 |
| 25 rate-limited / after-sign-in | join/rate_limited | Too many tries | FAIL: primary actions = 0 |
| 26 team-full / after-sign-in | join/refused | This team is full | pass |
| 27 unconfirmed-account / after-sign-in | join/refused | Confirm your account first | FAIL: primary actions = 0 |
| 28 profile-incomplete / after-sign-in | join | Join Salsa Norte? | pass |
| 29 sign-in / after-sign-in | email | Join Salsa Norte on Bachata Calendar | pass |
| 30 network-failed / after-sign-in | join/network | Something went wrong | pass |
