"use client";

import React from "react";

/**
 * Brutalist UI primitives — thin wrappers over the utility classes in
 * globals.css (.brut-panel / .brut-btn / .brut-rule / .brut-label).
 * Square corners, thick borders, no glow. Keep these dumb and presentational.
 */

type DivProps = React.HTMLAttributes<HTMLDivElement>;

/** Square bordered container. */
export function Panel({
  faint = false,
  className = "",
  children,
  ...rest
}: DivProps & { faint?: boolean }) {
  return (
    <div className={`brut-panel ${faint ? "brut-panel--faint" : ""} ${className}`} {...rest}>
      {children}
    </div>
  );
}

/** Heavy horizontal rule / ASCII-style divider. */
export function Divider({
  variant = "solid",
  className = "",
  ...rest
}: DivProps & { variant?: "solid" | "faint" | "dashed" }) {
  const mod =
    variant === "faint" ? "brut-rule--faint" : variant === "dashed" ? "brut-rule--dashed" : "";
  return <hr className={`brut-rule ${mod} ${className}`} {...rest} />;
}

/** Tiny tight uppercase label. */
export function Label({
  className = "",
  children,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={`brut-label ${className}`} {...rest}>
      {children}
    </span>
  );
}

type BrutalButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary";
  active?: boolean;
};

/** Mechanical trigger button — sinks on press, inverts on hover. */
export function BrutalButton({
  variant = "default",
  active = false,
  className = "",
  children,
  ...rest
}: BrutalButtonProps) {
  const variantClass = variant === "primary" ? "brut-btn--primary" : "";
  const activeClass = active ? "brut-btn--active" : "";
  return (
    <button className={`brut-btn ${variantClass} ${activeClass} ${className}`} {...rest}>
      {children}
    </button>
  );
}
