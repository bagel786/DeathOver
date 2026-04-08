import Link from "next/link";

export default function NotFound() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center gap-6 p-6"
      style={{ background: "#000000" }}
    >
      <h1
        style={{
          fontFamily: "var(--font-anton), Impact, sans-serif",
          fontSize: "clamp(80px, 20vw, 180px)",
          lineHeight: 1,
          letterSpacing: "0.02em",
          color: "#ffffff",
          textTransform: "uppercase",
        }}
      >
        <span style={{ color: "#00d4ff" }}>4</span>0
        <span style={{ color: "#00d4ff" }}>4</span>
      </h1>
      <p className="font-mono text-sm text-center" style={{ color: "#6b8c76", maxWidth: 400 }}>
        This page doesn&apos;t exist. Maybe it got hit for six.
      </p>
      <Link
        href="/"
        className="px-6 py-3 rounded-xl font-mono text-sm tracking-widest"
        style={{
          background: "linear-gradient(135deg, #00d4ff18, #00d4ff30)",
          border: "1px solid #00d4ff",
          color: "#00d4ff",
        }}
      >
        BACK TO CREASE
      </Link>
    </main>
  );
}
