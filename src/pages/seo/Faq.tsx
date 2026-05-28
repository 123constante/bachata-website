/**
 * FAQ page - targeted at "bachata London" long-tail queries.
 * Emits FAQPage schema for rich snippet eligibility in Google SERPs.
 */
import { Link } from 'react-router-dom';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { useSeo } from '@/lib/seo';

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
        rooms. Find one near you on the{' '}
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

const Faq = () => {
  useSeo({
    title: 'Bachata in London - FAQ',
    description:
      "Common questions about bachata in London - where to dance, what to wear, how to start, what to expect. Answers from the city's bachata calendar.",
    canonical: 'https://bachatacalendar.co.uk/faq',
  });

  return (
    <GlobalLayout breadcrumbs={buildBreadcrumbs('faq')}>
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
