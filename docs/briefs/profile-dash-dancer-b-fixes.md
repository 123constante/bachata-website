# Brief: dancer dashboard option B, apply Opus critique fixes (admin #1545, parent #1531)
Lane normal, Opus. Docs/design only (no app code). Find the option-B dancer mockups under docs/design (see #1537/#1538 results and docs/design/mockups). Apply ALL 8 fixes below, re-run design checks (contrast>=4.5, taps>=44px, no clipping, no sideways scroll, actionable empty states), re-shoot 390x844 for: new, partial, saveOff, complete, completeEmpty, unclaimed, switch, addProfile, account. Record deliberate deviations in polish.md as owner calls. Put screenshots in the PR.

1 One-profile dancers: draw #account sheet (one side row with tick, + Add a profile, Account settings, Sign out, no "Switch" words); replace "?" placeholder with SVG person icon in plum ring.
2 Switch sheet must match shipped ProfileSwitcher.tsx: organisers first, teacher/DJ areas in a separate "Your areas" group (plain icon row), then Add a profile, settings, sign out; shipped plum dancer sheet surface; Back = 44px chevron at LEFT. Any deliberate change recorded in polish.md as an owner call.
3 #partial -> #saveOff: Edit tile says "3 of 4 done" but Edit has no photo field: add Photo row ("No photo yet" + ghost "Add photo") OR route tile to Me checklist; add 44px back chevron on Edit header.
4 Remove kicker labels above headings (craft floor ban): drop Welcome lines; "Step 1 of 4" becomes caption under segment bar; #complete heading "12 nights attended"; next-night card heading = event name with "You're going · Fri 14 Nov · Shoreditch" under it; drop ABOUT YOU; #completeEmpty starts "Your profile is complete."
5 #unclaimed too busy: remove disabled Claim button + reason (keep G-2 an open owner question); "Message us to claim it" covers D4 for now; "Not me, start my own" = text link; swap Message tile for My page.
6 #complete next-night card: make it a link to the event with chevron, height >=44.
7 No text characters as icons: authored SVG plus/person (existing 2px stroke set); DJ ring letters match SideAvatar.
8 Dashed borders mean only disabled/placeholder: notes = plain muted text no border; on #new the Options tile duplicates the Options tab: replace with Edit or an informative item.
Keep: step-of-4 segment bar; numbers never headline when empty; Save-off on Edit; pill only with 2+ profiles.
