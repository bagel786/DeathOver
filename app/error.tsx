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
      style={{ background: "var(--ink)" }}
    >
      <h1
        className="brut-data-xl text-center"
        style={{
          fontSize: "clamp(40px, 10vw, 80px)",
          lineHeight: 1,
          color: "var(--blood)",
          textTransform: "uppercase",
        }}
      >
        SOMETHING WENT WRONG
      </h1>
      <p className="font-mono text-sm text-center" style={{ color: "var(--muted)", maxWidth: 400 }}>
        An unexpected error occurred. Try again or go back home.
      </p>
      <div className="flex gap-3">
        <button onClick={reset} className="brut-btn brut-btn--primary text-sm">
          TRY AGAIN
        </button>
        <a href="/" className="brut-btn text-sm flex items-center">
          GO HOME
        </a>
      </div>
    </main>
  );
}
