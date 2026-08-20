import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  description:
    "About The Death Over, a browser-based cricket strategy game created by Safiullah Baig in 2026.",
  alternates: {
    canonical: "/about",
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

        <section>
          <h2 className="brut-label" style={{ color: "var(--paper)", marginBottom: 12 }}>
            DEVELOPMENT
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
