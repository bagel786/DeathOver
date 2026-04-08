"use client";

export default function ErrorPage({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center gap-6 p-6"
      style={{ background: "#000000" }}
    >
      <h1
        style={{
          fontFamily: "var(--font-anton), Impact, sans-serif",
          fontSize: "clamp(40px, 10vw, 80px)",
          lineHeight: 1,
          letterSpacing: "0.02em",
          color: "#ff4444",
          textTransform: "uppercase",
        }}
      >
        SOMETHING WENT WRONG
      </h1>
      <p className="font-mono text-sm text-center" style={{ color: "#6b8c76", maxWidth: 400 }}>
        An unexpected error occurred. Try again or go back home.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-6 py-3 rounded-xl font-mono text-sm tracking-widest"
          style={{
            background: "linear-gradient(135deg, #ff444418, #ff444430)",
            border: "1px solid #ff4444",
            color: "#ff4444",
            cursor: "pointer",
          }}
        >
          TRY AGAIN
        </button>
        <a
          href="/"
          className="px-6 py-3 rounded-xl font-mono text-sm tracking-widest"
          style={{
            background: "#ffffff05",
            border: "1px solid #1e3d2a",
            color: "#6b8c76",
            cursor: "pointer",
          }}
        >
          GO HOME
        </a>
      </div>
    </main>
  );
}
