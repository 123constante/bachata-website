/**
 * Pillar page: Bachata in London - The Complete Guide.
 * Long-form content targeting "bachata London" and adjacent head terms.
 * Internally links to listings + entity pages for SEO juice flow.
 */
import { Link } from 'react-router-dom';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { useSeo } from '@/lib/seo';

const WEEKDAYS = [
  { slug: 'monday',    label: 'Monday' },
  { slug: 'tuesday',   label: 'Tuesday' },
  { slug: 'wednesday', label: 'Wednesday' },
  { slug: 'thursday',  label: 'Thursday' },
  { slug: 'friday',    label: 'Friday' },
  { slug: 'saturday',  label: 'Saturday' },
  { slug: 'sunday',    label: 'Sunday' },
] as const;

const BachataInLondon = () => {
  useSeo({
    title: 'Bachata in London - The Complete Guide',
    description:
      "Bachata in London - where to dance, how to start, who to learn from, when to go out. The complete guide to London's bachata scene from Bachata Calendar.",
    canonical: 'https://bachatacalendar.co.uk/london-bachata-guide',
    ogType: 'article',
  });

  return (
    <GlobalLayout showSubheader={false}>
      <article className="mx-auto max-w-3xl px-4 py-8 space-y-8">
        <header className="space-y-3">
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.05]">
            Bachata in London &mdash; The Complete Guide
          </h1>
          <p className="text-base text-muted-foreground">
            Where to dance, how to start, who to learn from, when to go out.
            Everything you need to plug into London&rsquo;s bachata community.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">London bachata, in one paragraph</h2>
          <p className="leading-relaxed">
            London has one of Europe&rsquo;s busiest bachata scenes &mdash; classes most
            weeknights, socials in every zone, and at least one festival a month
            within reach of a Tube ride. The scene splits roughly into{' '}
            <em>sensual</em> rooms (slower, body-led) and <em>Dominican</em> rooms
            (faster, footwork-led), but most venues play both. You can dance every
            night of the week, learn from world-touring teachers without leaving
            zone 2, and find a partner-rotating beginner class within five miles of
            wherever you live.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">Where to dance</h2>
          <p className="leading-relaxed">
            Bachata in London happens in dedicated dance studios, club rooms inside
            mixed-music nightclubs, and pop-up venues that change with the season.
            See every active venue, with its weekly schedule and the kind of room
            it runs, on the{' '}
            <Link to="/venues" className="text-primary underline">Venues page</Link>.
            Browse by night on the{' '}
            <Link to="/tonight" className="text-primary underline">Tonight page</Link>{' '}
            or by event type on{' '}
            <Link to="/parties" className="text-primary underline">/parties</Link>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">How to start</h2>
          <p className="leading-relaxed">
            If you have never danced bachata before, start with a dedicated
            beginners&rsquo; class. Most schools rotate partners every couple of
            minutes &mdash; you don&rsquo;t need to bring anyone, and you&rsquo;ll
            meet the rest of the room in your first hour. Bachata&rsquo;s basic step
            is a simple side-to-side weight shift on counts 1-2-3-tap, and you can
            pick it up in a single session. Find a beginner-friendly class near you
            on the{' '}
            <Link to="/classes" className="text-primary underline">Classes page</Link>{' '}
            &mdash; or browse teachers directly on the{' '}
            <Link to="/teachers" className="text-primary underline">Teachers page</Link>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">The weekly rhythm</h2>
          <p className="leading-relaxed">
            London&rsquo;s bachata calendar follows a predictable weekly shape: each
            weekday has its own anchor socials and class schools, with the
            big-room parties anchored on Friday and Saturday. Browse by weekday to
            see what&rsquo;s on, where, and at what time:
          </p>
          <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
            {WEEKDAYS.map(({ slug, label }) => (
              <li key={slug}>
                <Link
                  to={`/bachata-london-${slug}`}
                  className="block rounded border border-border/60 px-3 py-2 text-center font-semibold hover:bg-primary/10 transition"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">Festivals &amp; congresses</h2>
          <p className="leading-relaxed">
            The UK&rsquo;s bachata festivals run year-round &mdash; weekend
            intensives with international teachers, hours-long social rooms,
            performances and competitions. London is the centre of gravity but the
            UK calendar includes events across the country. See the next dates on
            the{' '}
            <Link to="/festivals" className="text-primary underline">Festivals page</Link>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">Promoters &amp; organisers</h2>
          <p className="leading-relaxed">
            Most weekly socials and parties are run by a handful of long-standing
            promoters and schools. Knowing who runs which night helps you find a
            room that matches the kind of dancing you want. See every active
            organiser on the{' '}
            <Link to="/organisers" className="text-primary underline">Organisers page</Link>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">DJs</h2>
          <p className="leading-relaxed">
            The DJ defines the room as much as the venue does. London bachata DJs
            sit on a spectrum from pure Dominican catalogues to remix-heavy
            sensual sets. See who&rsquo;s playing where on the{' '}
            <Link to="/djs" className="text-primary underline">DJs page</Link>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">Common questions</h2>
          <p className="leading-relaxed">
            For practical questions &mdash; how much classes cost, what to wear,
            how long it takes to learn, whether you need a partner &mdash; the{' '}
            <Link to="/faq" className="text-primary underline">FAQ page</Link>{' '}
            has straight answers to the questions every dancer asks before their
            first night.
          </p>
        </section>

        <footer className="text-sm text-muted-foreground pt-6 border-t border-border/40">
          Bachata Calendar is the open calendar for London&rsquo;s bachata
          community. Every event listed here is verified. If you organise a class,
          social or festival and want it listed, get in touch via the{' '}
          <Link to="/profile" className="text-primary underline">profile page</Link>.
        </footer>
      </article>
    </GlobalLayout>
  );
};

export default BachataInLondon;
