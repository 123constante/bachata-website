/**
 * BachataStyleParties.tsx
 *
 * Style-split landing pages:
 *   /bachata-london-sensual-parties   → sensual bachata nights
 *   /bachata-london-dominican-parties → Dominican bachata nights
 *
 * Targets long-tail queries like "sensual bachata london", "dominican bachata
 * parties london". Derives the active style from the URL path.
 *
 * Copy discipline: no invented BPMs, prices or capacities; music taxonomy kept
 * correct (modern/urban vs traditional guitar-led); no asserted first-hand
 * attendance. Style claims are hedged ("most nights play a mix").
 */

import { Link, useLocation } from "react-router-dom";
import GlobalLayout from "@/components/layout/GlobalLayout";
import { useSeo } from "@/lib/seo";

interface StyleMeta {
  slug: "sensual" | "dominican";
  label: string;
  title: string;
  description: string;
  intro: string;
  whatItIs: string;
  floorFeel: string;
  nights: { name: string; venue: string; postcode: string; note: string }[];
  whatToExpect: string;
  shoes: string;
  otherStyle: { slug: string; label: string };
}

const STYLES: Record<string, StyleMeta> = {
  sensual: {
    slug: "sensual",
    label: "Sensual",
    title: "Sensual Bachata Parties in London",
    description:
      "Sensual bachata nights in London: the themed parties, the rooms that lean sensual, what the style asks of you, and what to wear on the floor.",
    intro:
      "London's sensual bachata nights: the themed parties, the rooms that lean sensual, and what the style asks of you.",
    whatItIs:
      "Sensual bachata is the modern European style, developed in Spain and Portugal in the late 2000s and now common across London's dance schools. It's slower and more choreographed than the original Dominican dance, built around body movement: waves, dips, isolations and turn patterns, with a strong focus on the connection between partners. It rewards control and musicality more than fast feet, which is part of why it took hold so quickly with people coming to bachata from other partner dances.",
    floorFeel:
      "On a sensual floor you'll see couples moving through waves and dips between turns, to slower and more produced music. Remixes of pop and R&B turn up as often as guitar-led bachata. The feel is smooth and deliberate rather than busy. At themed nights like Sensual Vibes the room is dressed to a concept and so are the dancers, so the evening reads as an occasion you turn up for rather than a floor you drop into.",
    nights: [
      {
        name: "Sensual Vibes",
        venue: "Unit3 Studios, Kennington",
        postcode: "SW9 6DE",
        note: "Themed sensual nights in a wood-floored studio, with the occasional masterclass guest. The crowd is sensual-leaning and the editions are worth dressing up for.",
      },
      {
        name: "Sensual Saturdays",
        venue: "Studio 68, Southwark",
        postcode: "",
        note: "A Saturday studio social with a consistent sensual programme. Smaller and more local than Sensual Vibes.",
      },
      {
        name: "Sensual Wednesdays",
        venue: "Waterloo Action Centre, Baylis Road",
        postcode: "SE1",
        note: "A progressive course that ends in a social. A soft way in if you'd rather have teaching first than walk onto a cold floor.",
      },
      {
        name: "Musketeers",
        venue: "Colab Tower, London Bridge",
        postcode: "SE1 9HB",
        note: "A mixed programme with a sensual-friendly crowd and two classes before the floor opens.",
      },
    ],
    whatToExpect:
      "Sensual floors are friendly to improvers, but most people have done a course and know the moves, so arriving with a few classes behind you helps. Sensual Wednesdays' built-in course and the teaching before Musketeers are gentler entry points than a themed Sensual Vibes night. For the bigger editions, dressing to the concept is part of the fun; the rest of the time, smart-casual and shoes you can turn in are all you need.",
    shoes:
      "Sensual rooms are almost always on wood or sprung floors. Followers often dance in a heel, since the slower style suits one, though flat dance shoes work just as well. Leaders want a smooth-soled shoe. Rubber-soled trainers grip wood and fight your turns, so they're the one thing to leave at home.",
    otherStyle: { slug: "dominican", label: "Dominican" },
  },
  dominican: {
    slug: "dominican",
    label: "Dominican",
    title: "Dominican Bachata Parties in London",
    description:
      "Dominican bachata nights in London: faster, freer and more footwork-led. Where to find the original style, what the floor feels like, and how to start.",
    intro:
      "London's Dominican bachata nights: faster, freer and more footwork-led, plus where to find the original style in the city.",
    whatItIs:
      "Dominican bachata is the original form of the dance, from the Dominican Republic. It's faster and freer than the sensual style, built on quick footwork, syncopation and improvisation, with movement that comes from the knees rather than the torso. There's far less fixed choreography: partners move in and out of hold, trade footwork, and follow the music as it goes. It asks more of you technically at the start, but the social side is relaxed once you're in.",
    floorFeel:
      "A Dominican floor moves fast and looks busier than a sensual room. Footwork, weight changes and side-steps weave through the basic step, and partners sometimes break apart to dance their own footwork before coming back together. The music spans the whole style, from older guitar-led bachata (Antony Santos, Luis Vargas) to modern urban crossovers (Aventura, Romeo Santos), and which end a night leans toward depends on the DJ.",
    nights: [
      {
        name: "La Practica",
        venue: "Ritmo Latino Studio, Vauxhall",
        postcode: "SE1 7TP",
        note: "A Friday training session: the floor is open, but people come to drill and refine. The most footwork-focused regular night in the city, and best approached with some basics already.",
      },
      {
        name: "Wild Bachata",
        venue: "Forge, Cornhill",
        postcode: "EC3V 3ND",
        note: "Footwork and partner-work workshops with a technical, Dominican lean. In the City, and after-work friendly.",
      },
      {
        name: "Santo Domingo",
        venue: "Ritmo Latino Studio, Vauxhall",
        postcode: "SE1 7TP",
        note: "A Sunday terrace party with a 5pm class beforehand. Relaxed, outdoors, and welcoming to newcomers.",
      },
      {
        name: "Rogue Bachata",
        venue: "Café Sol, Clapham",
        postcode: "SW4 7UL",
        note: "A class plus a free social, with a footwork-aware crowd. A good middle step if you're coming over from sensual.",
      },
    ],
    whatToExpect:
      "Dominican rooms forgive rough technique more readily than rigid patterns: follow the music and you'll settle in faster than if you over-choreograph. La Practica is the purest place to work on footwork, but it's hard going with no basics, so a Dominican-focused class first (La Fábrica in Hackney, or the workshops at Forge) makes a real difference. Santo Domingo on a Sunday is the easiest start, with a relaxed terrace and a 5pm class to warm up on.",
    shoes:
      "Dominican floors are fast, so you want shoes that let you pivot and change weight without slipping. Smooth-soled dance shoes suit both leaders and followers. The quick footwork is easier in flats or a low heel than in anything tall. As with any wood floor, rubber-soled trainers will work against you.",
    otherStyle: { slug: "sensual", label: "Sensual" },
  },
};

const BachataStyleParties = () => {
  const location = useLocation();
  const styleMatch = location.pathname.match(/\/bachata-london-(sensual|dominican)-parties/);
  const meta = styleMatch ? STYLES[styleMatch[1]] : undefined;

  useSeo(
    meta
      ? {
          title: meta.title,
          description: meta.description,
          canonical: `https://bachatacalendar.co.uk/bachata-london-${meta.slug}-parties`,
          ogType: "article",
        }
      : { title: "Bachata Parties in London", description: "Bachata party styles in London.", noindex: true },
  );

  if (!meta) {
    return (
      <GlobalLayout showSubheader={false}>
        <div className="mx-auto max-w-2xl px-4 py-12 text-center space-y-3">
          <h1 className="text-2xl font-bold">Style not found</h1>
          <p className="text-muted-foreground">
            <Link to="/bachata-parties-london" className="text-primary underline">
              See all bachata parties in London
            </Link>
          </p>
        </div>
      </GlobalLayout>
    );
  }

  return (
    <GlobalLayout showSubheader={false}>
      <article className="mx-auto max-w-3xl px-4 py-8 space-y-8">
        <header className="space-y-3">
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.05]">
            {meta.title}
          </h1>
          <p className="text-base text-muted-foreground">{meta.intro}</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">What {meta.label.toLowerCase()} bachata is</h2>
          <p className="leading-relaxed">{meta.whatItIs}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">What the floor feels like</h2>
          <p className="leading-relaxed">{meta.floorFeel}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">The {meta.label.toLowerCase()} nights in London</h2>
          <ul className="space-y-4">
            {meta.nights.map((n) => (
              <li key={n.name} className="rounded border border-border/60 p-4 space-y-1">
                <div className="font-bold text-base">{n.name}</div>
                <div className="text-xs text-muted-foreground">
                  {n.venue}{n.postcode ? ` · ${n.postcode}` : ""}
                </div>
                <p className="text-sm leading-relaxed">{n.note}</p>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            Current dates and door prices are on the{' '}
            <Link to="/parties" className="text-primary underline">Parties page</Link>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">What to expect &amp; how to prepare</h2>
          <p className="leading-relaxed">{meta.whatToExpect}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">Shoes</h2>
          <p className="leading-relaxed">{meta.shoes}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">Related</h2>
          <ul className="flex flex-wrap gap-3">
            <li>
              <Link
                to={`/bachata-london-${meta.otherStyle.slug}-parties`}
                className="block rounded border border-border/60 px-4 py-2 font-semibold hover:bg-primary/10 transition text-sm"
              >
                {meta.otherStyle.label} bachata parties →
              </Link>
            </li>
            <li>
              <Link
                to="/bachata-parties-london"
                className="block rounded border border-border/60 px-4 py-2 font-semibold hover:bg-primary/10 transition text-sm"
              >
                All bachata parties in London →
              </Link>
            </li>
            <li>
              <Link
                to="/london-bachata-guide"
                className="block rounded border border-border/60 px-4 py-2 font-semibold hover:bg-primary/10 transition text-sm"
              >
                The London bachata guide →
              </Link>
            </li>
          </ul>
        </section>
      </article>
    </GlobalLayout>
  );
};

export default BachataStyleParties;
