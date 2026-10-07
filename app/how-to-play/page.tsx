import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BOWLERS } from "@/engine/bowlers";

// Read: a field manual inside the game's existing black, white, and red world.
// Show real controls, explain one over in order, and return the reader to play.
export const metadata: Metadata = {
  title: "How to Play The Death Over — Cricket Game Guide",
  description:
    "Learn to play The Death Over, Safiullah Baig's browser cricket strategy game: place nine fielders, choose deliveries, bluff AI batters, and defend six balls.",
  alternates: { canonical: "/how-to-play" },
  openGraph: {
    title: "How to Play The Death Over",
    description: "The rules, bowler choices, and field-placement strategy for The Death Over cricket game.",
    url: "/how-to-play",
    type: "article",
    images: [{ url: "/images/death-over-gameplay.jpg", alt: "The Death Over field and delivery controls" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "How to Play The Death Over",
    description: "The rules, bowler choices, and field-placement strategy for The Death Over cricket game.",
    images: ["/images/death-over-gameplay.jpg"],
  },
};

const steps = [
  { title: "Choose your over", text: "Pick a bowler on the home screen. The daily challenge gives you a target to defend; Custom Game lets you set the target and wickets in hand. For a first practice game, try the default 12 runs off six balls with three wickets remaining." },
  { title: "Place your nine fielders", text: "Drag the numbered squares around the field before bowling. You can have at most five fielders outside the dashed inner ring. Protect likely scoring areas, then adjust the field before the next ball. Off and leg sides swap when a left-handed batter is on strike." },
  { title: "Select length, variation, and line", text: "Length controls where the ball pitches. Variation changes how it moves or its pace. Line controls where it passes the batter. Choose all three to enable Bowl Delivery. The available variations and length labels depend on your bowler." },
  { title: "Bowl, read, and adjust", text: "Press Bowl Delivery, watch the ball, and read the tactical feedback. Your field gives the AI clues about the next delivery. Use that information to change the line, length, variation, or field before bowling again." },
];

export default function HowToPlayPage() {
  return (
    <main className="game-guide min-h-screen px-6 py-8 sm:py-12">
      <article className="mx-auto max-w-4xl">
        <nav aria-label="Game pages" className="mb-10 flex flex-wrap gap-x-6 gap-y-3 text-sm">
          <Link href="/">← The Death Over</Link>
          <Link href="/about">About the game</Link>
        </nav>
        <header className="max-w-3xl">
          <p className="brut-label mb-4" style={{ color: "var(--blood)" }}>THE DEATH OVER / FIELD MANUAL</p>
          <h1 className="brut-data-xl text-4xl leading-none sm:text-6xl">HOW TO PLAY<br />THE DEATH OVER</h1>
          <p className="mt-6 text-base leading-relaxed sm:text-lg">
            Six balls. Nine fielders. One total to defend. The Death Over is a
            browser-based cricket strategy game created by{" "}
            <a href="https://safiullahbaig.com/">Safiullah Baig</a>.
            You control the bowling side and try to outthink the AI batter.
          </p>
          <Link href="/" className="brut-btn mt-6 inline-block text-sm no-underline">Play The Death Over →</Link>
        </header>

        <figure className="my-12">
          <Image src="/images/death-over-gameplay.jpg" alt="The Death Over practice game with a draggable cricket field, length, variation and line controls, and a target of 12 runs off six balls." width={1270} height={922} sizes="(max-width: 896px) 100vw, 896px" className="h-auto w-full border-2 border-white" />
          <figcaption className="mt-3 text-sm leading-relaxed">
            A custom practice over: field placement, delivery selection, and the match situation appear together.{" "}
            <a href="/images/death-over-gameplay.jpg">View the full-size screenshot</a>.
          </figcaption>
        </figure>

        <section aria-labelledby="rules" className="guide-section">
          <h2 id="rules">What wins the over?</h2>
          <p>The batting side wins by reaching the target. When the legal deliveries or wickets run out, finishing one run short of the target is a tie; finishing at least two runs short is a win for you. Wides and no-balls give away extras without using up a legal ball.</p>
          <p>For example, with a target of 12, conceding 10 or fewer runs is a win, 11 is a tie, and 12 or more is a loss.</p>
        </section>

        <section aria-labelledby="first-over" className="guide-section">
          <h2 id="first-over">Your first over, step by step</h2>
          <ol className="mt-6 space-y-8">
            {steps.map((step, index) => (
              <li key={step.title} className="grid grid-cols-[2rem_1fr] gap-4 sm:gap-6">
                <span aria-hidden="true" className="text-2xl font-bold" style={{ color: "var(--blood)" }}>{index + 1}</span>
                <div><h3>{step.title}</h3><p className="mt-2">{step.text}</p></div>
              </li>
            ))}
          </ol>
          <p className="mt-8">Want to learn by doing? Use the home screen&apos;s How to Play button for the interactive tutorial.</p>
        </section>

        <section aria-labelledby="bowlers" className="guide-section">
          <h2 id="bowlers">Which bowler should you choose?</h2>
          <dl className="mt-6 space-y-6">
            {BOWLERS.map((bowler) => (
              <div key={bowler.id}>
                <dt className="font-bold text-white">{bowler.name} <span className="text-sm font-normal">/ {bowler.type}</span></dt>
                <dd className="mt-2 leading-relaxed">{bowler.blurb}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6">Pace bowlers offer slower balls, cutters, and swing. The Mystery Spinner offers off breaks, leg breaks, googlies, arm balls, top spinners, and sliders. A spinner&apos;s fullest length is labeled Tossed Up; the shortest is Long Hop.</p>
        </section>

        <section aria-labelledby="bluff" className="guide-section">
          <h2 id="bluff">The field is also a bluff</h2>
          <p>Fielders do more than stop shots. The AI reads their positions to anticipate delivery length and uses previous balls to help predict variations. Five deep fielders can signal a yorker setup. Changing to a shorter delivery can challenge that expectation.</p>
          <p>That is a tradeoff, not a guaranteed trick: the same field can give several clues, and a short ball can still be hit for a boundary. Read the batter and the feedback, protect likely scoring areas, and change the plan when it gets predictable.</p>
          <p>Bowler choice matters too. The Death Specialist rewards a different length from the Express Quick. There is no delivery that guarantees a dot ball or wicket; the outcome also depends on the batter and the field.</p>
        </section>

        <footer className="guide-section pb-8">
          <h2>Take the field</h2>
          <p>Play a custom over to experiment, or try today&apos;s challenge. The game runs in your browser.</p>
          <div className="mt-6 flex flex-wrap items-center gap-6">
            <Link href="/" className="brut-btn inline-block text-sm no-underline">Play The Death Over →</Link>
            <Link href="/about">Meet the game&apos;s creator</Link>
          </div>
        </footer>
      </article>
    </main>
  );
}
