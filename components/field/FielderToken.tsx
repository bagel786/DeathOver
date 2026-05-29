"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Fielder } from "@/types/game";

interface FielderTokenProps {
  fielder: Fielder;
  isDragging: boolean;
  isDisabled: boolean;
  isHighlighted: boolean;
  onDragStart: () => void;
  onHover: (label: string | null) => void;
}

export default function FielderToken({
  fielder,
  isDragging,
  isDisabled,
  isHighlighted,
  onDragStart,
  onHover,
}: FielderTokenProps) {
  const { position, label } = fielder;
  const x = position.x;
  const y = position.y;

  // Square marker — white outline at rest, solid red block while dragging.
  const half = isDragging ? 2.6 : 2.1;
  const fill = isDragging ? "var(--blood)" : "var(--ink)";
  const stroke = isDragging ? "var(--blood)" : "var(--paper)";
  const textFill = "var(--paper)";

  return (
    <g
      style={{ cursor: isDisabled ? "default" : "grab" }}
      onPointerDown={(e) => {
        if (isDisabled) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        onDragStart();
      }}
      onPointerEnter={() => onHover(label)}
      onPointerLeave={() => onHover(null)}
    >
      {/* Crosshair guides while dragging (mechanical, no glow) */}
      {isDragging && (
        <g stroke="var(--blood)" strokeWidth="0.25" opacity="0.7">
          <line x1={x - 6} y1={y} x2={x + 6} y2={y} />
          <line x1={x} y1={y - 6} x2={x} y2={y + 6} />
        </g>
      )}

      {/* Fielder square */}
      <rect
        x={x - half}
        y={y - half}
        width={half * 2}
        height={half * 2}
        fill={fill}
        stroke={stroke}
        strokeWidth="0.5"
      />

      {/* Fielder number */}
      <text
        x={x}
        y={y + 0.7}
        textAnchor="middle"
        fontSize="2"
        fontWeight="bold"
        fill={textFill}
        fontFamily="var(--mono)"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {fielder.id}
      </text>

      {/* Highlight square when this fielder stops the ball */}
      <AnimatePresence>
        {isHighlighted && (
          <motion.rect
            key="highlight"
            fill="none"
            stroke="var(--paper)"
            strokeWidth="0.7"
            initial={{ x: x - 2, y: y - 2, width: 4, height: 4, opacity: 0 }}
            animate={{
              x: x - 6, y: y - 6, width: 12, height: 12,
              opacity: [0, 1, 0],
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, delay: 0.45, ease: "linear" }}
          />
        )}
      </AnimatePresence>
    </g>
  );
}
