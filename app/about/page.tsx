import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About The Death Over",
  description:
    "About The Death Over, a browser-based cricket strategy game created by Safiullah Baig in 2026.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "About The Death Over",
    description:
      "How Safiullah Baig created The Death Over, a browser-based cricket strategy game about defending the final over.",
    url: "/about",
    type: "website",
  },
};

export default function AboutPage() {
  return (
    <main
      className="min-h-screen flex flex-col items-center p-6"
      style={{ background: "var(--ink)", color: "var(--paper)" }}
    >
      <div className="w-full flex flex-col gap-8" style={{ maxWidth: 760 }}>
        <header className="pt-8">
          <p className="brut-label" style={{ color: "var(--blood)", marginBottom: 10 }}>
            PRODUCT INFO
          </p>
          <h1 className="brut-data-xl" style={{ fontSize: "clamp(34px, 8vw, 72px)", lineHeight: 0.95 }}>
            ABOUT THE DEATH OVER
          </h1>
          <hr className="brut-rule" style={{ marginTop: 18 }} />
        </header>

        <section className="font-mono text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
          <h2 className="brut-label" style={{ color: "var(--paper)", marginBottom: 12 }}>
            WHAT IS THE DEATH OVER?
          </h2>
          <p>
            The Death Over is a browser-based cricket strategy game created by{" "}
            <a
              href="https://safiullahbaig.com/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--paper)", textDecoration: "underline" }}
            >
              Safiullah Baig
            </a>{" "}
            in 2026. It explores the decision-making involved in defending the final over of a cricket match: field placement, delivery selection, batter tendencies, bluffing, and risk.
          </p>
        </section>

        <section className="font-mono text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
          <h2 className="brut-label" style={{ color: "var(--paper)", marginBottom: 12 }}>
            HOW DO YOU PLAY?
          </h2>
          <p>
            You control the bowling side with six balls to defend a total. Place nine
            fielders, choose a bowler and delivery, and try to deceive the AI batter.
            Field placement and delivery selection affect each ball&apos;s outcome.
          </p>
          <p className="mt-3">
            Play the daily challenge or set your own target and wickets remaining in
            a custom game. The game runs in your browser.
          </p>
          <p className="mt-3">
            <Link href="/" style={{ color: "var(--paper)", textDecoration: "underline" }}>
              Play The Death Over
            </Link>
          </p>
          <p className="mt-3">
            <Link href="/how-to-play" style={{ color: "var(--paper)", textDecoration: "underline" }}>
              Read the gameplay rules, bowler guide, and field-placement strategy
            </Link>
          </p>
        </section>

        <section>
          <h2 className="brut-label" style={{ color: "var(--paper)", marginBottom: 12 }}>
            WHO CREATED THE DEATH OVER?
          </h2>
          <ul className="font-mono text-sm flex flex-col gap-2" style={{ color: "var(--muted)" }}>
            <li>Created and developed by Safiullah Baig</li>
            <li>AI batter archetypes</li>
            <li>Probability engine</li>
            <li>Field-placement system</li>
            <li>Bluff and deception mechanics</li>
            <li>Daily challenge mode</li>
          </ul>
        </section>

        <section>
          <h2 className="brut-label" style={{ color: "var(--paper)", marginBottom: 12 }}>
            LINKS
          </h2>
          <ul className="font-mono text-sm flex flex-col gap-2" style={{ color: "var(--muted)" }}>
            <li>
              <a
                href="https://safiullahbaig.com/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--paper)", textDecoration: "underline" }}
              >
                Safiullah Baig
              </a>
            </li>
            <li>
              <a
                href="https://github.com/bagel786/DeathOver"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--paper)", textDecoration: "underline" }}
              >
                DeathOver on GitHub
              </a>
            </li>
          </ul>
        </section>

        <footer className="font-mono text-xs pb-8" style={{ color: "var(--faint)" }}>
          <Link href="/" style={{ color: "var(--paper)", textDecoration: "underline" }}>
            Return to The Death Over
          </Link>
        </footer>
      </div>
    </main>
  );
}
