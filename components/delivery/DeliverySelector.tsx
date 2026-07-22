"use client";

import React from "react";
import { useGameStore } from "@/store/gameStore";
import type { DeliveryLength, DeliveryVariation, DeliveryLine } from "@/types/game";
import { getBowler } from "@/engine/bowlers";

/** The five length slots, in order. Names and hints come from the bowler. */
const LENGTH_ORDER: DeliveryLength[] = ["yorker", "full", "good_length", "short", "bouncer"];

/** Button text per variation. Which of these appear comes from the bowler. */
const VARIATION_LABELS: Record<DeliveryVariation, string> = {
  pace:        "Pace",
  slower_ball: "Slower Ball",
  off_cutter:  "Off Cutter",
  leg_cutter:  "Leg Cutter",
  outswing:    "Outswing",
  inswing:     "Inswing",

  off_break:   "Off Break",
  leg_break:   "Leg Break",
  googly:      "Googly",
  arm_ball:    "Arm Ball",
  top_spinner: "Top Spinner",
  slider:      "Slider",
};

const DELIVERY_LINES: { value: DeliveryLine; label: string }[] = [
  { value: "wide_outside_off", label: "Wide Outside Off" },
  { value: "off",              label: "Off Stump" },
  { value: "middle",           label: "Middle" },
  { value: "leg",              label: "Leg Stump" },
  { value: "wide_outside_leg", label: "Wide Down Leg" },
];

const SECTION_STYLE: React.CSSProperties = {
  background: "var(--ink)",
  border: "2px solid var(--paper)",
};

const LABEL_STYLE: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: "0.6rem",
  fontWeight: 700,
  fontFamily: "var(--mono)",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  marginBottom: "0.4rem",
};

function SelectButton({
  active,
  disabled,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      title={hint}
      className="relative px-2 py-2 text-left text-xs font-mono font-bold uppercase tracking-wide"
      style={{
        background: active ? "var(--blood)" : "var(--ink)",
        border: active ? "2px solid var(--blood)" : "2px solid var(--faint)",
        color: active ? "var(--paper)" : "var(--muted)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition: "background-color 80ms steps(2), color 80ms steps(2), border-color 80ms steps(2)",
      }}
    >
      {label}
    </button>
  );
}

export default function DeliverySelector() {
  const selectedLength    = useGameStore((s) => s.currentDelivery.length);
  const selectedVariation = useGameStore((s) => s.currentDelivery.variation);
  const selectedLine      = useGameStore((s) => s.currentDelivery.line);
  const setDeliveryLength    = useGameStore((s) => s.setDeliveryLength);
  const setDeliveryVariation = useGameStore((s) => s.setDeliveryVariation);
  const setDeliveryLine      = useGameStore((s) => s.setDeliveryLine);
  const isComplete = useGameStore((s) => s.match.isComplete);
  const bowler = getBowler(useGameStore((s) => s.bowlerId));

  return (
    <div className="flex flex-col gap-3" data-tutorial="delivery-selector">
      {/* LENGTH */}
      <div className="flex flex-col p-3 gap-2" style={SECTION_STYLE} data-tutorial="delivery-length">
        <div className="flex items-baseline justify-between">
          <p style={LABEL_STYLE}>LENGTH</p>
          <p style={{ ...LABEL_STYLE, color: "var(--blood)", marginBottom: "0.4rem" }}>
            {bowler.name}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {LENGTH_ORDER.map((value) => (
            <SelectButton
              key={value}
              active={selectedLength === value}
              disabled={isComplete}
              onClick={() => setDeliveryLength(value)}
              label={bowler.lengthLabels[value]}
              hint={bowler.lengthHints[value]}
            />
          ))}
        </div>
      </div>

      {/* VARIATION */}
      <div className="flex flex-col p-3 gap-2" style={SECTION_STYLE} data-tutorial="delivery-variation">
        <p style={LABEL_STYLE}>VARIATION</p>
        <div className="grid grid-cols-2 gap-1.5">
          {bowler.variations.map((value) => (
            <SelectButton
              key={value}
              active={selectedVariation === value}
              disabled={isComplete}
              onClick={() => setDeliveryVariation(value)}
              label={VARIATION_LABELS[value]}
              hint={bowler.variationHints[value]}
            />
          ))}
        </div>
      </div>

      {/* LINE */}
      <div className="flex flex-col p-3 gap-2" style={SECTION_STYLE} data-tutorial="delivery-line">
        <p style={LABEL_STYLE}>LINE</p>
        <div className="flex flex-col gap-1.5">
          {DELIVERY_LINES.map(({ value, label }) => (
            <button
              key={value}
              disabled={isComplete}
              onClick={() => setDeliveryLine(value)}
              className="px-3 py-2 text-xs font-mono font-bold uppercase tracking-wide text-left"
              style={{
                background: selectedLine === value ? "var(--blood)" : "var(--ink)",
                border: selectedLine === value ? "2px solid var(--blood)" : "2px solid var(--faint)",
                color: selectedLine === value ? "var(--paper)" : "var(--muted)",
                cursor: isComplete ? "not-allowed" : "pointer",
                opacity: isComplete ? 0.4 : 1,
                transition: "background-color 80ms steps(2), color 80ms steps(2), border-color 80ms steps(2)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
