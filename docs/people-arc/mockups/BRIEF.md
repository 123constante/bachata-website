# People arc P2 -- screen brief

Five lines per screen: who opens it, what they want on the first screen, what must be one tap away.

## Wall tile (`/dancers`, `/djs`, `/teachers`)
1. Opened by: someone browsing the wall, mostly on a phone, often a newcomer to London bachata.
2. Wants: to recognise a face or a name, and to see who is playing or teaching soon.
3. First screen: 4 columns of tiles; each has photo or initials, the name, and either the next date in gold
   under the name (DJ with a gig) or the role.
4. One tap away: that person's page, on the wall's role tab.
5. Must not: show "Playing soon" or a count of 1; empty tiles do not exist (every row has a name).

## Person page -- Teacher tab (`/teachers/<slug>`)
1. Opened by: a dancer looking for a class, or a student who wants to find their teacher again.
2. Wants: where and when this teacher is teaching next.
3. First screen: name, photo or initials, "Teacher &middot; City", the next classes (48 of 124 teachers have one).
4. One tap away: the class's event page; when there is no class, the calendar's classes in their city; Share.
5. Must not: show an empty "Connect" card, raw language codes, or a teacher page that 404s.

## Person page -- DJ tab (`/djs/<slug>`)
1. Opened by: a dancer choosing a party, often from a shared link.
2. Wants: when and where this DJ plays next.
3. First screen: name, "DJ &middot; City", next gigs with full dates ("Thursday 29 October"), count only from 2.
4. One tap away: the gig's event page; with no gigs, this week's parties; Share.
5. Must not: show "No gigs listed" filler or a date block without the word for the day.

## Person page -- Dancer tab (`/dancers/<slug>`)
1. Opened by: someone who met them on the floor, or the dancer showing their own page.
2. Wants: to be sure it is the right person; then how they dance (lead / follow) and what they speak.
3. First screen: name, photo or initials, "Dancer &middot; City", the filled facts only (the calendar has no dancer dates).
4. One tap away: this week's socials in their city; Share; the other role tabs when they have them.
5. Must not: promise "style, level and how to say hi" when none of it exists, or show "0 years".

## Link preview card (WhatsApp / Instagram)
1. Opened by: whoever receives the shared link in a chat.
2. Wants: to know who and what before tapping.
3. Shows: og:title "Name &middot; Role in City" (role from the link), a one-line description from real facts
   (next date, or the dancer facts, or "On Bachata Calendar"), and an image of the face or initials in the role colour.
4. One tap away: the page, on the same role tab as the link.
5. Must not: describe content the page does not have.
