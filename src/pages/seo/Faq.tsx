/**
 * FAQ page - targeted at "bachata London" long-tail + People-Also-Ask queries.
 * Emits FAQPage schema. Note: Google retired FAQPage blue-link rich results in
 * 2026, so the value here is People Also Ask / AI Overview coverage, on-page
 * text and internal links - not a star-styled rich result. Keep the schema
 * (harmless, may aid AI surfaces).
 */
import { Link } from 'react-router-dom';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { useSeo, SITE_ORIGIN, type SeoInput } from '@/lib/seo';

interface Faq {
  q: string;
  a: string;
  body: React.ReactNode;
}

const FAQS: Faq[] = [
  {
    q: 'Where can I dance bachata in London tonight?',
    a: "Bachata Calendar lists every bachata social, class and party in London tonight - filter by night and venue. The Tonight page shows what's on within the next few hours so you can pick a venue, time and style without trawling a dozen pages.",
    body: (
      <>
        We list every bachata social, class and party in London tonight on the{' '}
        <Link to="/tonight" className="text-primary underline">Tonight page</Link>.
        Filter by venue, by time, or by the kind of night you want - a beginner-friendly
        social, a sensual room, a Dominican floor, or a festival pre-party.
      </>
    ),
  },
  {
    q: "What's the difference between sensual bachata and Dominican bachata?",
    a: "Dominican bachata is the original style from the Dominican Republic - faster footwork, lots of free improvisation, less torso movement. Sensual bachata is a modern European style with slower tempo, body waves, dips and choreographed turn patterns. Most London socials play both; some rooms lean one way.",
    body: (
      <>
        Dominican bachata is the original style - faster, footwork-led, with lots of free
        improvisation. Sensual bachata is the modern European style - slower tempo, body
        waves, dips and choreographed turns. Most London socials play both; some rooms
        lean heavily one way. See which venues lean Dominican or sensual on the{' '}
        <Link to="/venues" className="text-primary underline">Venues page</Link>.
      </>
    ),
  },
  {
    q: 'Do I need a partner to start bachata classes in London?',
    a: 'No. Almost every bachata class in London rotates partners every couple of minutes, so anyone can join solo. Showing up alone is the norm, not the exception.',
    body: (
      <>
        No. Almost every bachata class rotates partners every couple of minutes, so
        coming alone is the norm. Browse beginner classes on the{' '}
        <Link to="/classes" className="text-primary underline">Classes page</Link>.
      </>
    ),
  },
  {
    q: 'How much do bachata classes in London cost?',
    a: 'Drop-in classes typically run from 10 to 18 pounds in London. Course blocks (4-6 weeks) usually work out cheaper per class. Many schools include free entry to that night\'s social with a class ticket.',
    body: (
      <>
        Drop-in classes typically run &pound;10-&pound;18. Course blocks of 4-6 weeks
        usually work out cheaper per class. Many schools include free entry to that
        night's social with a class ticket - look for the bundled events on the{' '}
        <Link to="/classes" className="text-primary underline">Classes page</Link>.
      </>
    ),
  },
  {
    q: 'What should I wear to a bachata social?',
    a: 'Smart-casual is the norm. Comfortable clothes you can move and sweat in. Most dancers wear leather-soled shoes or dance trainers - sticky rubber soles make turns hard. No heels required for follows; most prefer 1-3 inch dance heels or low jazz shoes.',
    body: (
      <>
        Smart-casual. Comfortable, breathable clothes - you will sweat. Leather-soled
        shoes or dance trainers are best; sticky rubber soles make turning painful.
        Follows: 1-3 inch dance heels or low jazz shoes are the norm, no requirement to
        wear heels.
      </>
    ),
  },
  {
    q: 'When are the biggest bachata festivals in the UK?',
    a: 'The UK calendar has several flagship bachata congresses through the year - usually weekend-long events with classes, parties and international artists. See the festivals listing for the current calendar.',
    body: (
      <>
        See the{' '}
        <Link to="/festivals" className="text-primary underline">Festivals page</Link>{' '}
        for every upcoming bachata congress and festival in the UK. Most are
        weekend-long, with workshops by international teachers and parties running into
        the small hours.
      </>
    ),
  },
  {
    q: 'Is bachata good for total beginners with no dance experience?',
    a: 'Yes. Bachata is one of the easiest partner dances to start - the basic step is a simple side-to-side weight shift on counts 1-2-3-tap. Most London schools run dedicated beginner classes that assume zero experience.',
    body: (
      <>
        Yes. The basic step is a simple side-to-side weight shift (1-2-3-tap) - you can
        pick it up in your first class. Most London schools run dedicated beginner
        rooms. New to it all? Read our{' '}
        <Link to="/learn-bachata-london" className="text-primary underline">beginner&rsquo;s guide</Link>{' '}
        or find a class on the{' '}
        <Link to="/classes" className="text-primary underline">Classes page</Link>.
      </>
    ),
  },
  {
    q: 'How long does it take to learn bachata?',
    a: 'Most dancers feel comfortable on a social floor after 4-8 weeks of weekly classes. Looking confident takes 6-12 months. There is no ceiling - the best dancers in London have been learning for a decade.',
    body: (
      <>
        Most people feel comfortable on a social floor after 4-8 weeks of weekly
        classes. Looking confident is more like 6-12 months. The best dancers in London
        have been at it for a decade - the ceiling is wherever you stop.
      </>
    ),
  },
  {
    q: 'What is the difference between a bachata "social" and a "party"?',
    a: "Both are dance events. A 'social' usually leads with the dancing - smaller room, fewer non-dancers, sometimes a class beforehand. A 'party' is bigger, more theatrical - bigger venue, themes, performances, often a mixed Latin music policy (bachata, salsa, kizomba).",
    body: (
      <>
        Both are dance events. A <em>social</em> leads with the dancing - smaller room,
        often a class beforehand, mostly dancers. A <em>party</em> is bigger - mixed Latin
        music (bachata, salsa, kizomba), themes, performances. Browse both on the{' '}
        <Link to="/parties" className="text-primary underline">Parties page</Link>.
      </>
    ),
  },
  {
    q: 'Where can I find bachata teachers in London?',
    a: 'Bachata Calendar has a directory of every active bachata teacher in London with their classes, schools and styles.',
    body: (
      <>
        See every active bachata teacher in London on the{' '}
        <Link to="/teachers" className="text-primary underline">Teachers page</Link>{' '}
        - filter by style, find their next class, see who they teach with.
      </>
    ),
  },
  {
    q: 'Are there bachata classes on weekends in London?',
    a: 'Yes - weekend bachata classes, workshops and intensives run every Saturday and Sunday in London. Festivals and congresses often anchor weekend programming.',
    body: (
      <>
        Yes. Weekend classes, workshops and intensives run every Saturday and Sunday.
        Festivals and congresses anchor weekend programming once a month or so. See the{' '}
        <Link to="/classes" className="text-primary underline">Classes page</Link>{' '}
        for this weekend's lineup.
      </>
    ),
  },
  {
    q: 'Do bachata socials in London play other Latin music?',
    a: 'Most socials are bachata-led but mix in salsa, kizomba, merengue and reggaeton through the night. A few rooms are bachata-only. Check the venue description on each event listing.',
    body: (
      <>
        Most socials are bachata-led but mix in salsa, kizomba, merengue and reggaeton
        through the night. A few rooms are bachata-only. Each event listing on{' '}
        <Link to="/parties" className="text-primary underline">/parties</Link>{' '}
        shows the music policy.
      </>
    ),
  },
  {
    q: "What's the difference between salsa and bachata?",
    a: 'Salsa is faster, usually danced in a slot or on a circle with lots of spins, to brassy Cuban and Puerto Rican music. Bachata is slower and more grounded, danced close in a side-to-side step to Dominican guitar music. Many London nights play both, so you can try each.',
    body: (
      <>
        Salsa is faster and spinnier, danced to brassy Cuban and Puerto Rican music;
        bachata is slower and more grounded, danced close in a side-to-side step to
        Dominican guitar music. Many London nights play both - the music policy is on
        each listing on the{' '}
        <Link to="/parties" className="text-primary underline">Parties page</Link>.
      </>
    ),
  },
  {
    q: 'Is bachata hard to learn?',
    a: 'No - bachata is widely considered the easiest Latin partner dance to begin. The basic step is a side-to-side weight shift on a 1-2-3-tap count, and you can dance it to music in your first hour. Looking polished takes months, but having fun takes one class.',
    body: (
      <>
        No. The basic step is a side-to-side weight shift (1-2-3-tap) you can do to music
        in your first hour - bachata is the easiest Latin partner dance to start. Polish
        takes months; fun takes one class. Our{' '}
        <Link to="/learn-bachata-london" className="text-primary underline">beginner&rsquo;s guide</Link>{' '}
        walks you through it.
      </>
    ),
  },
  {
    q: 'Where is bachata most popular in London?',
    a: 'South London (Kennington, Vauxhall, Clapham) is the studio heartland; Covent Garden, the City and King\'s Cross host the big club-room nights; Fulham and Hackney anchor the west and east teaching scenes. There is a bachata night within reach of almost every part of the city.',
    body: (
      <>
        South London (Kennington, Vauxhall, Clapham) is the studio heartland; Covent
        Garden, the City and King's Cross host the big club nights; Fulham and Hackney
        anchor west and east. The{' '}
        <Link to="/london-bachata-guide" className="text-primary underline">London bachata guide</Link>{' '}
        maps it area by area, and the{' '}
        <Link to="/venues" className="text-primary underline">Venues page</Link>{' '}
        lists every room.
      </>
    ),
  },
  {
    q: 'Are there free bachata events in London?',
    a: 'Yes. Some socials are free entry, and many class nights include the social for free once you have paid for the lesson. Free taster classes pop up too. Check each listing for the door price - free events are flagged where they exist.',
    body: (
      <>
        Yes - some socials are free entry, and many nights include the social for free
        with a class ticket. Free tasters appear too. Each listing shows the door price,
        so browse the{' '}
        <Link to="/parties" className="text-primary underline">Parties</Link>{' '}and{' '}
        <Link to="/tonight" className="text-primary underline">Tonight</Link>{' '}pages and
        look for the free ones.
      </>
    ),
  },
  {
    q: 'Am I too old to start bachata?',
    a: 'No. Bachata floors in London span every age from teens to people in their sixties and beyond. It is low-impact, you set your own pace, and partner rotation means you are always dancing with someone at a friendly level. Plenty of people start in their forties and fifties.',
    body: (
      <>
        No - London bachata floors span every age, from teens to dancers in their
        sixties. It is low-impact and you set your own pace. Plenty of people start in
        their forties and fifties; a beginner class is the easiest place to begin - find
        one on the{' '}
        <Link to="/classes" className="text-primary underline">Classes page</Link>.
      </>
    ),
  },
  {
    q: 'Is there bachata in London on a Saturday?',
    a: 'Yes - Saturday is one of the biggest nights. Expect flagship big-room parties, the occasional two-room salsa-and-bachata event, and festival programming when a congress is in town. See the Saturday page for this weekend.',
    body: (
      <>
        Yes - Saturday is a headline night, with big-room parties and festival events
        when a congress is in town. See what&rsquo;s on this{' '}
        <Link to="/bachata-london-saturday" className="text-primary underline">Saturday</Link>{' '}
        or browse the full{' '}
        <Link to="/parties" className="text-primary underline">Parties page</Link>.
      </>
    ),
  },
  {
    q: 'How do I meet other bachata dancers in London?',
    a: 'The fastest way is to stay for the social after a class - partner rotation means you meet most of the room in an hour. London also has a 1,800-member bachata WhatsApp community run by Bachata Community UK that shares what is on each week.',
    body: (
      <>
        Stay for the social after a class - partner rotation means you meet most of the
        room in an hour. London also has a 1,800-member bachata WhatsApp community run by
        Bachata Community UK that shares what&rsquo;s on each week; find us on Instagram{' '}
        <a
          href="https://www.instagram.com/bachata.community.uk/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline"
        >@bachata.community.uk</a>.
      </>
    ),
  },
  {
    q: 'How do I find bachata classes near me in London?',
    a: 'Use the Classes page to see beginner and improver classes across London, grouped by night and venue, or open the calendar to filter by area. Each listing shows the venue, postcode, level and price so you can pick the closest, friendliest option.',
    body: (
      <>
        The{' '}
        <Link to="/classes" className="text-primary underline">Classes page</Link>{' '}
        lists classes across London by night and venue, with postcode, level and price
        on each one. Browse by weekday from{' '}
        <Link to="/bachata-london-monday" className="text-primary underline">Monday</Link>{' '}
        onward, or read the{' '}
        <Link to="/learn-bachata-london" className="text-primary underline">beginner&rsquo;s guide</Link>{' '}
        to choose your first.
      </>
    ),
  },
];

const FaqJsonLd = () => {
  const payload = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
};

// Shared with the framework route (app/routes/faq.tsx) so the route's meta()
// and the client useSeo() emit identical head tags from one source.
export const SEO_INPUT: SeoInput = {
  title: 'Bachata in London - FAQ',
  description:
    "Common questions about bachata in London - where to dance, what to wear, how to start, what to expect. Answers from the city's bachata calendar.",
  canonical: `${SITE_ORIGIN}/faq`,
};

const Faq = () => {
  useSeo(SEO_INPUT);

  return (
    <GlobalLayout showSubheader={false}>
      <FaqJsonLd />
      <article className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            Bachata in London &mdash; FAQ
          </h1>
          <p className="text-muted-foreground text-base">
            Honest answers to the questions every London bachata dancer asks before
            their first class, first social or first festival.
          </p>
        </header>
        <div className="space-y-5">
          {FAQS.map(({ q, body }) => (
            <section key={q} className="rounded-lg border border-border/60 p-4 bg-card/30">
              <h2 className="text-lg font-bold mb-2">{q}</h2>
              <div className="text-sm leading-relaxed text-muted-foreground">{body}</div>
            </section>
          ))}
        </div>
      </article>
    </GlobalLayout>
  );
};

export default Faq;
