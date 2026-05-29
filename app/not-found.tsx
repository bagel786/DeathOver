import Link from "next/link";

export default function NotFound() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center gap-6 p-6"
      style={{ background: "var(--ink)" }}
    >
      <h1
        className="brut-data-xl"
        style={{
          fontSize: "clamp(80px, 20vw, 180px)",
          lineHeight: 1,
          color: "var(--paper)",
          textTransform: "uppercase",
        }}
      >
        <span style={{ color: "var(--blood)" }}>4</span>0
        <span style={{ color: "var(--blood)" }}>4</span>
      </h1>
      <p className="font-mono text-sm text-center" style={{ color: "var(--muted)", maxWidth: 400 }}>
        This page doesn&apos;t exist. Maybe it got hit for six.
      </p>
      <Link href="/" className="brut-btn brut-btn--primary text-sm">
        BACK TO CREASE
      </Link>
    </main>
  );
}
