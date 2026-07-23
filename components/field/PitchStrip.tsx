import type { BattingHand } from "@/types/game";

export default function PitchStrip({ battingHand = "right" }: { battingHand?: BattingHand }) {
  // Pitch runs vertically through center.
  // TOP (y≈37-42) = BATSMAN'S end (WK / slip region above)
  // BOTTOM (y≈58-63) = BOWLER'S end (bowler runs in from below)
  //
  // Off side is LEFT of the pitch (~270°) for a right-hander. The batsman stands
  // on the leg side of their stumps, so the stance marker sits right for a
  // right-hander and left for a left-hander.
  const stanceX = battingHand === "left" ? 47.5 : 52.5;
  return (
    <g>
      {/* Pitch surface — wireframe outline */}
      <rect
        x="45.5" y="37" width="9" height="26"
        fill="var(--ink)"
        stroke="var(--paper)"
        strokeWidth="0.4"
      />

      {/* Stumps — batsman end (TOP) */}
      <g stroke="var(--paper)" strokeWidth="0.35" opacity="0.9">
        <line x1="48.8" y1="37" x2="48.8" y2="40" />
        <line x1="50"   y1="37" x2="50"   y2="40" />
        <line x1="51.2" y1="37" x2="51.2" y2="40" />
        {/* Bails */}
        <line x1="48.5" y1="37.1" x2="51.5" y2="37.1" strokeWidth="0.5" />
      </g>

      {/* Batsman's stance — which side of the stumps they guard from */}
      <g>
        <circle cx={stanceX} cy="40" r="1.1" fill="var(--blood)" />
        <line
          x1={stanceX} y1="40" x2={stanceX} y2="43.2"
          stroke="var(--blood)" strokeWidth="0.4"
        />
        {/* Spelled out — the stance offset alone is too subtle to read */}
        <text
          x={battingHand === "left" ? 44.5 : 55.5}
          y="41"
          textAnchor={battingHand === "left" ? "end" : "start"}
          fontSize="2.4"
          fill="var(--blood)"
          fontFamily="var(--mono)"
          letterSpacing="0.2"
        >
          {battingHand === "left" ? "LHB" : "RHB"}
        </text>
      </g>

      {/* Popping crease (batsman end) */}
      <line
        x1="44" y1="42" x2="56" y2="42"
        stroke="var(--paper)"
        strokeWidth="0.3"
        opacity="0.6"
      />

      {/* Popping crease (bowler end) */}
      <line
        x1="44" y1="58" x2="56" y2="58"
        stroke="var(--paper)"
        strokeWidth="0.3"
        opacity="0.6"
      />

      {/* Bowling crease (bowler end, BOTTOM) */}
      <line
        x1="44" y1="60" x2="56" y2="60"
        stroke="var(--paper)"
        strokeWidth="0.4"
        opacity="0.8"
      />

      {/* Stumps — bowler end (BOTTOM) */}
      <g stroke="var(--paper)" strokeWidth="0.35" opacity="0.9">
        <line x1="48.8" y1="60" x2="48.8" y2="63" />
        <line x1="50"   y1="60" x2="50"   y2="63" />
        <line x1="51.2" y1="60" x2="51.2" y2="63" />
        {/* Bails */}
        <line x1="48.5" y1="62.9" x2="51.5" y2="62.9" strokeWidth="0.5" />
      </g>
    </g>
  );
}
