export default function PitchStrip() {
  // Pitch runs vertically through center.
  // TOP (y≈37-42) = BATSMAN'S end (WK / slip region above)
  // BOTTOM (y≈58-63) = BOWLER'S end (bowler runs in from below)
  return (
    <g>
      {/* Pitch surface */}
      <rect
        x="45.5" y="37" width="9" height="26"
        rx="0.5"
        fill="#c8a96e"
        stroke="#a08040"
        strokeWidth="0.3"
      />

      {/* Stumps — batsman end (TOP) */}
      <g stroke="#ffffff" strokeWidth="0.35" opacity="0.9">
        <line x1="48.8" y1="37" x2="48.8" y2="40" />
        <line x1="50"   y1="37" x2="50"   y2="40" />
        <line x1="51.2" y1="37" x2="51.2" y2="40" />
        {/* Bails */}
        <line x1="48.5" y1="37.1" x2="51.5" y2="37.1" strokeWidth="0.5" />
      </g>

      {/* Popping crease (batsman end) */}
      <line
        x1="44" y1="42" x2="56" y2="42"
        stroke="#ffffff"
        strokeWidth="0.3"
        opacity="0.6"
      />

      {/* Popping crease (bowler end) */}
      <line
        x1="44" y1="58" x2="56" y2="58"
        stroke="#ffffff"
        strokeWidth="0.3"
        opacity="0.6"
      />

      {/* Bowling crease (bowler end, BOTTOM) */}
      <line
        x1="44" y1="60" x2="56" y2="60"
        stroke="#ffffff"
        strokeWidth="0.4"
        opacity="0.8"
      />

      {/* Stumps — bowler end (BOTTOM) */}
      <g stroke="#ffffff" strokeWidth="0.35" opacity="0.9">
        <line x1="48.8" y1="60" x2="48.8" y2="63" />
        <line x1="50"   y1="60" x2="50"   y2="63" />
        <line x1="51.2" y1="60" x2="51.2" y2="63" />
        {/* Bails */}
        <line x1="48.5" y1="62.9" x2="51.5" y2="62.9" strokeWidth="0.5" />
      </g>
    </g>
  );
}
