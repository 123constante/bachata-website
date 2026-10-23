# People arc S0: the wall parts of #963, date under the name

The face wall on /djs and /dancers takes only the wall work from #963 (full date "Friday 23 October",
the photo fallback for a photo that failed before hydration) and moves the DJ's next-gig date off the face.
Owner pick B (2026-10-23, mockup https://claude.ai/artifact/8T2FwYGJgRzT8yeABxQiJg): the full date as a chip
wrapped to 2 rows and covered about 40% of the face, so there is no chip on the face any more; the date is a
gold `#FFD479` line under the name (10px, 800, line-height 13px, centred, normal word wrap), full words, face
clear, DJ tiles a bit taller. Tokens: `DATE_LINE`, `SIZE.dateLine`, `SIZE.dateLineHeight` in
`src/modules/person-page/wall/tokens.ts`. Screenshots on prod data: `docs/people-arc/s0/`.
