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
      {/* Drag glow ring (shown only while dragging) */}
      {isDragging ? (
        <circle
          cx={position.x}
          cy={position.y}
          r="4"
          fill="none"
          stroke="#00d4ff"
          strokeWidth="0.5"
          opacity="0.5"
        >
          <animate attributeName="r" values="3;5;3" dur="1s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0.1;0.5" dur="1s" repeatCount="indefinite" />
        </circle>
      ) : (
        /* Idle pulse ring (shown when not dragging) */
        <circle
          cx={position.x}
          cy={position.y}
          r="2"
          fill="none"
          stroke="#00d4ff"
          strokeWidth="0.3"
          opacity="0.3"
        >
          <animate attributeName="r" values="2;3;2" dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0;0.3" dur="3s" repeatCount="indefinite" />
        </circle>
      )}

      {/* Fielder dot */}
      <circle
        cx={position.x}
        cy={position.y}
        r={isDragging ? 2.8 : 2.2}
        fill={isDragging ? "#ffffff" : "#00d4ff"}
        stroke={isDragging ? "#00d4ff" : "#001a2a"}
        strokeWidth={isDragging ? 0.6 : 0.5}
        style={{ transition: "r 0.1s, fill 0.1s" }}
      />

      {/* Fielder number */}
      <text
        x={position.x}
        y={position.y + 0.65}
        textAnchor="middle"
        fontSize="1.6"
        fontWeight="bold"
        fill="#001a2a"
        fontFamily="monospace"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {fielder.id}
      </text>

      {/* Highlight ring when fielder stops the ball */}
      <AnimatePresence>
        {isHighlighted && (
          <motion.circle
            key="highlight"
            cx={position.x}
            cy={position.y}
            fill="none"
            stroke="#ffffff"
            strokeWidth="0.8"
            initial={{ r: 2, opacity: 0 }}
            animate={{ r: 7, opacity: [0, 0.9, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, delay: 0.45, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>
    </g>
  );
}
