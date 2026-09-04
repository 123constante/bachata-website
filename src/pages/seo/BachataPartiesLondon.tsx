/**
 * BachataPartiesLondon.tsx
 *
 * Pillar SEO page targeting "bachata parties london" / "bachata nights london".
 * Covers the formats (club nights, studio socials, bar nights), the named
 * rooms, sensual vs Dominican, what a first party is like, and how to find one.
 *
 * Copy discipline: no invented numerics (door prices, capacities, BPMs) and no
 * asserted first-hand experience. Volatile facts (prices, dates) route to the
 * live /parties data rather than being hardcoded here.
 */

import { Link } from "react-router-dom";
import GlobalLayout from "@/components/layout/GlobalLayout";
import { SITE_ORIGIN, type SeoInput } from "@/lib/seo";

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

// The head input for this page. Its sole consumer is the framework route's
// meta() (app/routes/bachata-parties-london.tsx); it was shared with a client
// useSeo() call here too until arc W22 deleted that call as inert. Canonical
// uses SITE_ORIGIN -- the old hardcoded host was non-www, contradicting the
// site-wide www canonical.
export const SEO_INPUT: SeoInput = {
  title: "Bachata Parties in London - The Complete Guide",
  description:
    "A guide to bachata parties and social nights in London: the big club events, the studio socials, the bar nights, sensual vs Dominican, and how to pick your first one.",
  canonical: `${SITE_ORIGIN}/bachata-parties-london`,
  ogType: "article",
};

const BachataPartiesLondon = () => {
  // No useSeo() here: this page renders only under app/routes/bachata-parties-london.tsx,
  // which wraps in InitialVisiblePageTransition and so sets RouteOwnsHeadContext --
  // useSeo returns before touching the head. That route's meta() owns it, from
  // SEO_INPUT above. Which useSeo calls are inert and which are live is a census,
  // not a rule of thumb -- see BentoPage.tsx before deleting another (arc W22).

  return (
    <GlobalLayout showSubheader={false}>
      <article className="mx-auto max-w-3xl px-4 py-8 space-y-8">
        <header className="space-y-3">
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.05]">
            Bachata Parties in London
          </h1>
          <p className="text-base text-muted-foreground">
            Where London dances socially, how the different nights actually run, and how to find one that suits where you are in the dance.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">Club nights, studio socials and bar nights</h2>
          <p className="leading-relaxed">
            London&rsquo;s bachata parties come in a few shapes, and the shape tells you more than the title does. Some run in proper club venues with a full sound system and a few hundred people. Others are studio socials: a class runs first, the floor opens afterwards, and the room stays small enough to actually talk between songs. Bar nights sit somewhere in between, where a Latin bar gives a room over to bachata for the evening with a looser, drop-in feel.
          </p>
          <p className="leading-relaxed">
            The label is unreliable. A night billed as a &ldquo;social&rdquo; might be thirty people in a Vauxhall studio or a few hundred at Scala. Read the venue before you decide what to expect, or filter by type on the{' '}
            <Link to="/parties" className="text-primary underline">Parties page</Link>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">The big club nights</h2>
          <p className="leading-relaxed">
            El Grande at Scala in King&rsquo;s Cross (Pentonville Road, N1 9JY) is the largest regular Latin party in the city. Scala is a music venue rather than a studio, so the night feels closer to a gig you can dance to, with a main floor, a mezzanine and a proper bar run. The crowd is big and mixed: weekly regulars alongside people who came mostly for the music. It runs roughly monthly, usually on a Saturday. Dates and tickets are on the event page.
          </p>
          <p className="leading-relaxed">
            Mambo City x LLB takes a two-room approach at Marlborough Primary School in Chelsea (Draycott Avenue, SW3 3AP): salsa in one hall, bachata in the other, running at the same time. The hall has a sprung floor that dances better than a school building has any right to, and the crowd leans experienced. It&rsquo;s a monthly fixture.
          </p>
          <p className="leading-relaxed">
            Musketeers at Colab Tower near London Bridge (off Park Street, SE1 9HB) is smaller and more community-minded. The ticket bundles two classes before the floor opens, which makes it an easy first social if you want a lesson built into the night. Current pricing is on the event listing.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">Studio socials</h2>
          <p className="leading-relaxed">
            Sensual Vibes runs themed nights at Unit3 Studios in Kennington (Kennington Park Business Centre, SW9 6DE). Each edition has a concept (Tropical Night, Ken vs Barbie, seasonal one-offs) and people dress to it. The room is wood-floored and the music leans firmly sensual, so it&rsquo;s a natural fit if that&rsquo;s your style and a striking first impression if it isn&rsquo;t.
          </p>
          <p className="leading-relaxed">
            Santo Domingo is the Sunday terrace party at Ritmo Latino Studio in Vauxhall (Albert Embankment, SE1 7TP). There&rsquo;s a class at 5pm and the party runs from 6pm on the studio&rsquo;s outdoor terrace, which is an unusual setting for London bachata. The mood is relaxed and the crowd is welcoming to newcomers. The same studio hosts Bachateame on Saturdays and La Practica on Fridays; La Practica is more a training session than a party, so the floor is open but most people use it to drill.
          </p>
          <p className="leading-relaxed">
            Rogue Bachata pairs a one-hour class with a free social afterwards. You pay for the lesson and the dancing costs nothing, which is part of why regulars suggest it as a first social. The bar-style setting keeps the pressure low. Out west, Pura Nights covers Chiswick and Ealing, running at The George IV (W4 2DR) and The Drayton Court Hotel (W13 8PH) so dancers out that way don&rsquo;t have to cross town.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">Bar and club-room nights</h2>
          <p className="leading-relaxed">
            Sway Bar on Great Queen Street in Covent Garden (WC2B 5BZ) hosts several brands in the same room at different times: Latino Royal, Latino Sway, Todo Latino and London Loves BOS. It&rsquo;s central, late, and louder than a studio. If you&rsquo;re in Zone 1 and want to end an evening dancing, it&rsquo;s the most reliable address to check.
          </p>
          <p className="leading-relaxed">
            Be At One on Beak Street in Soho (W1F 9RA) runs Bailando Sundays and FK Dance nights in a cocktail-bar setting, which suits people who&rsquo;d rather ease in than commit to a dance event. The Monthly Bachata Party at the Cocktail Club in Canary Wharf (Cabot Square, E14 4QS) does the same job for the east-London crowd. In the City, Forge on Cornhill (EC3V 3ND) carries a lot of brands (Makondo, Mojito Club, Wild Bachata, Latino Flava Wednesdays) and is the most consistent bachata address for the after-work crowd.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">Sensual or Dominican?</h2>
          <p className="leading-relaxed">
            A room&rsquo;s style depends mostly on who runs it, not where it&rsquo;s held. Sensual nights play slower, more produced music and reward body movement, waves and dips. Dominican-leaning nights run faster and more percussive, with the footwork and improvisation that come from the original Dominican style. Most bar nights play a mix and let the DJ read the crowd, so you&rsquo;ll usually hear both across an evening.
          </p>
          <p className="leading-relaxed">
            If your classes have only covered one style, the other can feel unfamiliar on the floor. A mixed-set night with a class built in, like Musketeers or Rogue Bachata, is a forgiving place to start. There are fuller guides to each style:
          </p>
          <ul className="flex flex-wrap gap-3 mt-1">
            <li>
              <Link to="/bachata-london-sensual-parties" className="block rounded border border-border/60 px-4 py-2 font-semibold hover:bg-primary/10 transition text-sm">
                Sensual bachata parties →
              </Link>
            </li>
            <li>
              <Link to="/bachata-london-dominican-parties" className="block rounded border border-border/60 px-4 py-2 font-semibold hover:bg-primary/10 transition text-sm">
                Dominican bachata parties →
              </Link>
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">What a first party is like</h2>
          <p className="leading-relaxed">
            There&rsquo;s no fixed arrival time, but turning up in the first hour gets you in before the room fills, with space to find your feet. Studio socials usually wind down around midnight; club and bar nights run later. Asking someone to dance at a studio is mostly wordless: catch their eye and tilt your head toward the floor. At a bar night it tends to be more conversational.
          </p>
          <p className="leading-relaxed">
            You don&rsquo;t need to be good first. Knowing the basic step and a turn or two is enough for most beginner-friendly nights. The quickest way to improve is to dance with as many different people as you can rather than staying with whoever you arrived with. London floors are generally patient with beginners, especially if you say you&rsquo;re new.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">Prices, tickets and what to wear</h2>
          <p className="leading-relaxed">
            Door prices change by night and by edition, so the event page is the place to check rather than anything written here. As a rough rule, studio socials are the cheapest, club nights cost more for the venue and production, and bar nights are often free or cheap to enter with you paying for drinks. Nights that fold a class into the ticket tend to be the best value per hour on the floor. Ticket links, where they exist, are on the{' '}
            <Link to="/parties" className="text-primary underline">Parties page</Link>.
          </p>
          <p className="leading-relaxed">
            On clothes, smart-casual works almost everywhere, and the themed Sensual Vibes nights are worth dressing up for. The thing that actually matters is shoes. Most studios run wood or sprung floors, so a smooth sole you can turn in beats grippy trainers, which catch and fight your pivots.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">DJs and promoters worth following</h2>
          <p className="leading-relaxed">
            Who&rsquo;s on the decks changes a night as much as where it&rsquo;s held. Names you&rsquo;ll see on London line-ups include Bobby Blanco, Oreo Sensual, Nickchata, Tuli and Chong. If a particular sound keeps you on the floor, follow the DJ as well as the night; the{' '}
            <Link to="/djs" className="text-primary underline">DJs page</Link>{' '}shows who&rsquo;s playing where.
          </p>
          <p className="leading-relaxed">
            Promoters tend to run a consistent style across their events, so following an organiser is a decent way to predict how a new night of theirs will feel. Regular names include Sensual Vibes, Ritmo Latino, Musketeers, Rogue Bachata, Ola Latina and El Grande, among others. They&rsquo;re listed on the{' '}
            <Link to="/organisers" className="text-primary underline">Organisers page</Link>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">Find a party by night of the week</h2>
          <p className="leading-relaxed">
            The party week peaks Friday to Sunday, with a second cluster of socials on Wednesday. Monday and Thursday are quieter and more class-led. The{' '}
            <Link to="/tonight" className="text-primary underline">Tonight page</Link>{' '}shows what&rsquo;s on today, or browse by day:
          </p>
          <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
            {WEEKDAYS.map((d) => (
              <li key={d}>
                <Link
                  to={`/bachata-london-${d}`}
                  className="block rounded border border-border/60 px-3 py-2 text-center font-semibold hover:bg-primary/10 transition"
                >
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">A few practical questions</h2>
          <p className="leading-relaxed">
            <strong>Can I come on my own?</strong> Yes, and most people do. You ask others on the floor, and they ask you. <strong>How much do I need to know?</strong> Enough to hold the basic step and one turn; several nights teach a class first for exactly this reason. <strong>Is it expensive?</strong> Usually not, but it varies, so check the event page for the night you&rsquo;re eyeing. <strong>Which one should I try first?</strong> Anything with a class built into the ticket, such as Rogue Bachata or Musketeers, gives you teaching and a mixed-level floor in one go. The rest of the common questions are answered on the{' '}
            <Link to="/faq" className="text-primary underline">FAQ page</Link>.
          </p>
        </section>
      </article>
    </GlobalLayout>
  );
};

export default BachataPartiesLondon;
