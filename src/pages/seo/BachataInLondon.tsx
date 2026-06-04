/**
 * BachataInLondon.tsx
 *
 * Pillar SEO page targeting "bachata london" / "bachata in london". This is the
 * top-of-funnel guide that links out to the weekday pages, classes, parties,
 * venues, teachers, festivals and the rest of the Bachata Calendar surface. It
 * is meant to read as a working map of London's bachata scene and to feed
 * internal links into every other indexable route, so it stays content-heavy
 * and link-rich rather than transactional.
 */

import { Link } from "react-router-dom";
import GlobalLayout from "@/components/layout/GlobalLayout";
import { useSeo } from "@/lib/seo";

const WEEKDAYS = [
  { slug: "monday", label: "Monday" },
  { slug: "tuesday", label: "Tuesday" },
  { slug: "wednesday", label: "Wednesday" },
  { slug: "thursday", label: "Thursday" },
  { slug: "friday", label: "Friday" },
  { slug: "saturday", label: "Saturday" },
  { slug: "sunday", label: "Sunday" },
] as const;

const BachataInLondon = () => {
  useSeo({
    title: "Bachata in London - The Complete Guide",
    description:
      "Your complete guide to bachata in London: the styles, the best venues by neighbourhood, weekly classes and parties, festivals, top promoters and DJs.",
    canonical: "https://bachatacalendar.co.uk/london-bachata-guide",
    ogType: "article",
  });

  return (
    <GlobalLayout showSubheader={false}>
      <article className="mx-auto max-w-3xl px-4 py-8 space-y-8">
        <header className="space-y-3">
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.05]">
            Bachata in London &mdash; The Complete Guide
          </h1>
          <p className="text-base text-muted-foreground">
            The styles, the venues, the weekly nights and the festivals &mdash; a working map of London&rsquo;s bachata scene, with around 55 published events running across the city right now.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">London bachata, in one paragraph</h2>
          <p className="leading-relaxed">
            London runs a genuinely busy bachata week: progressive courses on weeknights in Fulham, Hackney, Waterloo and King&rsquo;s Cross; community training sessions and terrace parties in Vauxhall; and big-room nights in Covent Garden, the City and King&rsquo;s Cross at the weekend. Around 55 bachata events are published on Bachata Calendar at any given time, spread from Brixton to Muswell Hill and from Ealing to Canary Wharf. The quickest way to read all of it is to stop thinking about &ldquo;London&rdquo; as one room and start thinking about it as five neighbourhoods, a dozen promoters, and two distinct flavours of the dance &mdash; once you can place a night on that map, you can predict almost exactly what the floor will feel like before you walk in. Most rooms play a mix of Dominican and sensual bachata, so wherever you start you&rsquo;ll hear both. Browse what&rsquo;s on right now on the{' '}
            <Link to="/tonight" className="text-primary underline">Tonight page</Link>{' '}or jump straight to a{' '}
            <Link to="/classes" className="text-primary underline">class</Link>{' '}or{' '}
            <Link to="/parties" className="text-primary underline">party</Link>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">The two styles you&rsquo;ll meet</h2>
          <p className="leading-relaxed">
            Bachata in London divides into two broad styles, and most teachers will name which one a class leans toward. <em>Dominican bachata</em> is the original style from the Dominican Republic &mdash; faster footwork, free improvisation, playful syncopation and relatively little torso movement. It rewards musicality and quick feet, and Dominican-leaning rooms tend to run footwork drills and partner play rather than long choreographies. <em>Sensual bachata</em> is the modern European style &mdash; a slower feel, body waves, dips and choreographed turn patterns, with more emphasis on connection and isolation work.
          </p>
          <p className="leading-relaxed">
            In practice most London rooms play both across a night, and a single school will often teach Dominican footwork one term and sensual styling the next. The room&rsquo;s identity tells you which way the floor will tilt: Sensual Vibes at Unit3 Studios in Kennington is unapologetically sensual, themed and body-led, while footwork-and-partnerwork programmes such as Wild Bachata at the Forge in the City put the technical, faster side of the dance front and centre. If you&rsquo;re unsure which suits you, start with a general beginners&rsquo; course &mdash; you&rsquo;ll be exposed to both and can specialise later. The{' '}
            <Link to="/teachers" className="text-primary underline">Teachers page</Link>{' '}lists who focuses on what.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">South: Brixton, Kennington, Vauxhall, Clapham</h2>
          <p className="leading-relaxed">
            South London is the studio heartland &mdash; if you want to understand London bachata in a single postcode cluster, spend a fortnight south of the river. Unit3 Studios in Kennington (Kennington Park Business Centre, off Brixton Road, SW9 6DE) is a 150-capacity wood-floor space and the home of the Sensual Vibes nights, the address most sensual dancers think of first. A short hop away in Vauxhall, Ritmo Latino Studio on Albert Embankment (SE1 7TP) is the workhorse: a large wooden-floor studio and event space with its own terrace, hosting La Practica on Fridays, the Santo Domingo terrace party on Sundays and Bachateame on Saturdays. Further out in Clapham, Caf&eacute; Sol on Clapham High Street (SW4 7UL) gives Rogue Bachata a Mexican-bar setting with a looser energy.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">Central: Soho, Covent Garden, the Strand</h2>
          <p className="leading-relaxed">
            Central London is where the club-room nights live &mdash; bachata inside proper West End venues rather than studios, so come for the party rather than the deep technical class. Sway Bar on Great Queen Street in Covent Garden (WC2B 5BZ) is the busiest of them, a central club room that cycles through Latino Royal, Latino Sway, Todo Latino and London Loves BOS nights. Soho&rsquo;s Be At One on Beak Street (W1F 9RA) runs Bailando Sundays and FK Dance in a bar setting, and The Vault at Bush House on the Strand (WC2R 1AE) adds another central room to the mix. For something grander and more occasional, Setlist @ Somerset House &mdash; the open-air River Terrace over the Thames on the Strand (WC2R 1LA) &mdash; hosts day sessions during London Latin Fest, which is about as scenic as outdoor bachata gets in this city.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">City &amp; East: Bank, Canary Wharf, Hackney</h2>
          <p className="leading-relaxed">
            The City clusters around Forge on Cornhill (EC3V 3ND), a Bank club room that carries an unusual density of brands &mdash; Makondo, Mojito Club, Wild Bachata and Latino Flava Wednesdays all run here, which makes it the easternmost anchor worth memorising for the after-work crowd. Down at London Bridge, Colab Tower (off Park Street and Southwark Bridge Road, SE1 9HB) is an immersive multi-space venue that hosts the Musketeers nights and Sensual Fridays. Out in Hackney, Platform Studios East &mdash; the Create Destroy Studios space on Morning Lane (E9 6LH) &mdash; runs the La F&aacute;brica Wednesday partnerwork programme for east-side dancers who don&rsquo;t want to schlep across town. Canary Wharf gets its turn too, with a Monthly Bachata Party at the Cocktail Club on Cabot Square (E14 4QS).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">West &amp; North: Fulham, Chelsea, Ealing, King&rsquo;s Cross</h2>
          <p className="leading-relaxed">
            West London&rsquo;s teaching hub is Dance Attic Studios in Fulham (North End Road, by Fulham Broadway, SW6 1LY), with sprung wooden floors and mirrored studios &mdash; home to Alex Boneva&rsquo;s Thursday courses and a June styling course. Chelsea&rsquo;s Marlborough Primary School on Draycott Avenue (SW3 3AP) opens its sprung-floor hall for the monthly Mambo City x LLB two-room party, and Ealing and Chiswick host Pura Nights at The Drayton Court Hotel (W13 8PH) and The George IV (W4 2DR). North of the centre, King&rsquo;s Cross is the address for the big nights: Scala on Pentonville Road (N1 9JY) is the big-room music venue that stages El Grande, London&rsquo;s flagship Latin party, while Rogue Bachata runs a Wednesday class-and-social at Keystone Crescent off Caledonian Road (N1 9DX). Reach further north and you&rsquo;ll find Spring Fiesta at Victoria Stakes in Muswell Hill (N10 3TH) and the Bachata Musicality Method tucked into a small studio at Unit 3.4 in Archway (N19 4NF). Every active venue with its postcode and weekly schedule is on the{' '}
            <Link to="/venues" className="text-primary underline">Venues page</Link>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">Classes &amp; courses</h2>
          <p className="leading-relaxed">
            If you&rsquo;ve never danced bachata, start with a structured course rather than a one-off drop-in &mdash; you&rsquo;ll build the basic step, the lead-and-follow frame and a little musicality over a few weeks instead of being thrown in cold. London&rsquo;s progressive courses run beginner classes back-to-back with higher levels so you can move up without changing school. Alex Boneva teaches a weekly Thursday progression at Dance Attic in Fulham, with Level 1 for absolute beginners from 7&ndash;8pm followed by higher levels in the same building. Sensual Wednesdays runs a four-week, three-level progressive course (beginner through advanced) at the Waterloo Action Centre on Baylis Road, and La F&aacute;brica runs a Wednesday partnerwork programme from beginners onward at Platform Studios East in Hackney.
          </p>
          <p className="leading-relaxed">
            For a fixed block you can commit to, FK Dance runs a five-week course for beginners and improvers on Sundays, 4&ndash;6pm, at &pound;40 for the whole block &mdash; good value against drop-in pricing. There&rsquo;s also a June Styling Course running Sundays through June at Dance Attic for dancers who want to work on movement and presentation rather than patterns. Drop-in classes across the city typically run &pound;10&ndash;&pound;18; Rogue Bachata&rsquo;s one-hour class is &pound;10 with the social free afterwards. Browse beginner-friendly options on the{' '}
            <Link to="/classes" className="text-primary underline">Classes page</Link>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">What a first class is actually like</h2>
          <p className="leading-relaxed">
            A typical London beginner class runs for an hour. You arrive a few minutes early, pay at the door, and join two facing lines &mdash; leaders on one side, followers on the other. The teacher walks everyone through the footwork first, then adds a simple turn or two, then puts it to music. Almost every school rotates partners every couple of minutes, so you are never stuck with one person and you meet most of the room inside the hour. If the idea of dancing with strangers feels daunting, the rotation is actually what makes it easy &mdash; everyone is a beginner together, and nobody expects you to be good yet. You don&rsquo;t need a partner, you don&rsquo;t need experience, and you don&rsquo;t need special clothes; comfortable shoes you can pivot in are enough for your first night.
          </p>
          <p className="leading-relaxed">
            Many beginner classes are followed by a social: the floor opens up, a DJ takes over, and people dance freely for the rest of the night. You are never obliged to stay, but staying for even half an hour is the fastest way to turn what you just learned into something that sticks. At Rogue Bachata, for instance, the one-hour class is followed by a social &mdash; you pay for the lesson and the dancing afterwards costs nothing.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">The weekly rhythm</h2>
          <p className="leading-relaxed">
            London&rsquo;s bachata week has a predictable shape. <strong>Wednesday</strong> is the strongest class night, with progressive courses running in parallel across the city: Sensual Wednesdays at the Waterloo Action Centre, La F&aacute;brica partnerwork in Hackney, Rogue Bachata&rsquo;s class-plus-social at Keystone Crescent in King&rsquo;s Cross, and Latino Flava Wednesdays at Forge in the City. The Forge also hosts Wild Bachata&rsquo;s footwork and partner workshops for dancers chasing the technical side of the dance. <strong>Thursday</strong> belongs to Alex Boneva&rsquo;s progressive levels at Dance Attic in Fulham. <strong>Friday</strong> is La Practica, the weekly community training session at Ritmo Latino in Vauxhall, alongside the start of the weekend party run.
          </p>
          <p className="leading-relaxed">
            <strong>Saturday</strong> is the big-room night &mdash; Bachateame at Ritmo Latino, Sensual Saturdays at Studio 68 in Southwark, and the monthly Mambo City x LLB two-room salsa-and-bachata party at Marlborough Primary School in Chelsea. <strong>Sunday</strong> winds down with the Santo Domingo terrace party at Ritmo Latino (class at 5pm, party from 6pm) and Bailando Sundays at Be At One in Soho. Browse any weekday to see the exact line-up, venue and start times:
          </p>
          <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
            {WEEKDAYS.map(({ slug, label }) => (
              <li key={slug}>
                <Link to={`/bachata-london-${slug}`} className="block rounded border border-border/60 px-3 py-2 text-center font-semibold hover:bg-primary/10 transition">{label}</Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">Parties &amp; socials</h2>
          <p className="leading-relaxed">
            Once you can hold a basic step you&rsquo;ll want to social-dance, and London&rsquo;s party brands cover every register. El Grande is the flagship big-room Latin party, run at Scala in King&rsquo;s Cross &mdash; a proper music-venue night rather than a studio social, and the closest London bachata gets to an arena night. Sensual Vibes runs themed sensual nights at Unit3 Studios in Kennington, with one-off concepts like Tropical Night and Ken vs Barbie and the occasional masterclass guest. Musketeers at Colab Tower near London Bridge bundles two classes plus the party for &pound;12 early bird or &pound;15 on the door, which makes it an easy first social if you want a lesson built in.
          </p>
          <p className="leading-relaxed">
            In the City, Forge hosts Makondo, Mojito Club and the Latino Flava Wednesdays. Sway Bar in Covent Garden runs Latino Royal, Latino Sway and Todo Latino. West London is covered by Pura Nights, which runs at both The George IV in Chiswick and The Drayton Court Hotel in Ealing, and there&rsquo;s a Monthly Bachata Party out at the Cocktail Club in Canary Wharf. See the full list, with dates and door prices, on the{' '}
            <Link to="/parties" className="text-primary underline">Parties page</Link>{' '}&mdash; or check the{' '}
            <Link to="/tonight" className="text-primary underline">Tonight page</Link>{' '}for what&rsquo;s on this evening.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">Festivals &amp; congresses</h2>
          <p className="leading-relaxed">
            Beyond the weekly nights, London hosts multi-day festivals with international guest artists, longer training blocks and late social rooms. London Latin Fest runs across Sway Bar in Covent Garden and the open-air River Terrace at Setlist @ Somerset House on the Strand, in May 2026. London Sensual Days &mdash; Summer Edition is a three-day training camp themed &ldquo;Bachata Influence vs Zouk,&rdquo; with international artists Melvin &amp; Gatica, held at Ritmo Latino Studio in Vauxhall around 19 June 2026.
          </p>
          <p className="leading-relaxed">
            If you&rsquo;re willing to travel, the Tunisia Bachata Festival 2026 runs in Gammarth, Tunisia from 24&ndash;28 September 2026 and draws a good London contingent &mdash; treat it as a destination trip rather than a London event. Worth noting: festival line-ups are largely touring international artists, so don&rsquo;t assume a festival headliner is a resident London teacher; for week-to-week learning, stick with the London schools and promoters above. Upcoming dates are on the{' '}
            <Link to="/festivals" className="text-primary underline">Festivals page</Link>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">Promoters &amp; DJs</h2>
          <p className="leading-relaxed">
            Knowing who runs a night tells you what kind of room to expect. London&rsquo;s recurring promoters include Sensual Vibes, London Loves Bachata, Ritmo Latino, FK Dance, Ola Latina, Pura, Rogue Bachata, Musketeers, Estrella Dance, Latino Flava, The Latin Collective, BOS, Salsateca, La F&aacute;brica, Bachazouk UK and Alex Boneva. Each tends to run a consistent style across its nights, so once you find a promoter whose floor you enjoy, you can follow their other events. Every active organiser is listed on the{' '}
            <Link to="/organisers" className="text-primary underline">Organisers page</Link>.
          </p>
          <p className="leading-relaxed">
            The DJ shapes a room as much as the venue does, sitting somewhere on a line from pure Dominican catalogues to remix-heavy sensual sets. Names you&rsquo;ll see on London line-ups include Bobby Blanco, Oreo Sensual, Nickchata, Tuli and Chong. If a particular sound keeps you on the floor, follow the DJ as well as the night &mdash; see who&rsquo;s playing where on the{' '}
            <Link to="/djs" className="text-primary underline">DJs page</Link>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">Before your first night &mdash; quick answers</h2>
          <p className="leading-relaxed">
            <strong>Do I need a partner?</strong> No. Beginner classes rotate partners every few minutes, so you can turn up alone and dance with the whole room. <strong>What does it cost?</strong> Drop-in classes are typically &pound;10&ndash;&pound;18; some nights, like Rogue Bachata at &pound;10, include a free social afterward, and block courses such as FK Dance&rsquo;s five weeks for &pound;40 work out cheaper per session. <strong>What do I wear?</strong> Comfortable clothes you can move in and shoes with a smooth sole that lets you turn &mdash; the studios listed here run wood or sprung floors, so trainers with grippy soles can fight you.
          </p>
          <p className="leading-relaxed">
            <strong>How long until I can social dance?</strong> The basic side-to-side step comes together quickly; a few weeks of a progressive course is usually enough to be comfortable at a beginner-friendly social like Musketeers or the Santo Domingo terrace. <strong>Where do I start tonight?</strong> Check the{' '}
            <Link to="/tonight" className="text-primary underline">Tonight page</Link>, pick a class on the{' '}
            <Link to="/classes" className="text-primary underline">Classes page</Link>, and read the{' '}
            <Link to="/faq" className="text-primary underline">FAQ page</Link>{' '}for the rest of the questions every dancer asks before their first night.
          </p>
        </section>
      </article>
    </GlobalLayout>
  );
};

export default BachataInLondon;
