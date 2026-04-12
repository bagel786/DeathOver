// ============================================================
// Tutorial Step Definitions
// ============================================================
// 4 chapters, 19 total steps (4 + 5 + 6 + 4)
// These are pure data — no React, no store deps.
// ============================================================

export type DemoType =
  | "fielder_drag"    // ghost fielder dot moves from A to B
  | "button_click"    // ghost cursor pulses and "clicks" a button
  | "delivery_select" // ghost cycles through Length → Variation → Line
  | null;

export type RequiredAction =
  | "drag_any_fielder"      // player drags at least one fielder
  | "select_length"         // player picks a Length
  | "select_variation"      // player picks a Variation
  | "select_line"           // player picks a Line
  | "select_full_delivery"  // all three delivery fields selected
  | "bowl_delivery"         // player clicks Bowl and a ball fires
  | null;                   // no action required — Next is always enabled

export type ArrowPosition = "top" | "bottom" | "left" | "right" | "none";

export interface TutorialStep {
  id: string;
  chapter: 0 | 1 | 2 | 3;
  title: string;     // short card title
  text: string;      // display text (may use simple markdown-lite)
  voiceText: string; // TTS text — shorter, no special chars
  targetSelector: string | null;
  demoType: DemoType;
  requiresAction: RequiredAction;
  arrowPosition: ArrowPosition;
  isHandOn: boolean;  // show "Try it!" instead of "Next"
  skippable: boolean;
}

// ============================================================
// Chapter 0 — The Mission (4 steps)
// ============================================================
const CHAPTER_0: TutorialStep[] = [
  {
    id: "mission_intro",
    chapter: 0,
    title: "The Mission",
    text: "Welcome to the Death Over. You're the bowler.\n\nThe batsman needs runs off the final over to win. Your job: keep them out.",
    voiceText:
      "Welcome to the Death Over. You are the bowler defending the last six balls. Keep the runs down and you win.",
    targetSelector: null,
    demoType: null,
    requiresAction: null,
    arrowPosition: "none",
    isHandOn: false,
    skippable: true,
  },
  {
    id: "mission_scoreboard",
    chapter: 0,
    title: "Mission Control",
    text: "This is your mission control.\n\nThe big number is how many runs the batsman still needs. Balls remaining are beside it. Wickets on the next line.",
    voiceText:
      "This panel shows the runs still needed, balls left, and wickets in hand.",
    targetSelector: '[data-tutorial="match-situation"]',
    demoType: null,
    requiresAction: null,
    arrowPosition: "left",
    isHandOn: false,
    skippable: true,
  },
  {
    id: "mission_ball_dots",
    chapter: 0,
    title: "The Six Balls",
    text: "These circles are the 6 deliveries in this over.\n\nThey fill in after each ball — W for wicket, 4 for a boundary, 6, or a dot for no run.",
    voiceText:
      "These six circles represent the deliveries in the over. Each one fills in after you bowl.",
    targetSelector: '[data-tutorial="ball-dots"]',
    demoType: null,
    requiresAction: null,
    arrowPosition: "left",
    isHandOn: false,
    skippable: true,
  },
  {
    id: "mission_target",
    chapter: 0,
    title: "Win Condition",
    text: "If the batsman reaches the target — you lose.\n\nIf they run out of balls or wickets first — you win. Simple.",
    voiceText:
      "If the batsman reaches their target, you lose. Run them out of balls or wickets and you win.",
    targetSelector: '[data-tutorial="match-situation"]',
    demoType: null,
    requiresAction: null,
    arrowPosition: "left",
    isHandOn: false,
    skippable: true,
  },
];

// ============================================================
// Chapter 1 — Your Army (5 steps)
// ============================================================
const CHAPTER_1: TutorialStep[] = [
  {
    id: "army_intro",
    chapter: 1,
    title: "Your Army",
    text: "You have 9 fielders on the ground, controlled entirely by you.\n\nWhere you place them determines what shots cost the batsman runs — and what shots are free.",
    voiceText:
      "You control nine fielders. Where you place them determines whether the batsman scores runs.",
    targetSelector: null,
    demoType: null,
    requiresAction: null,
    arrowPosition: "none",
    isHandOn: false,
    skippable: true,
  },
  {
    id: "army_field_overview",
    chapter: 1,
    title: "The Field",
    text: "The blue dots are your fielders. The dashed circle is the 30-yard ring — the fielding restriction means you can only put 5 fielders outside it.",
    voiceText:
      "The blue dots are your fielders. The dashed circle is the 30-yard restriction. Maximum five fielders outside it.",
    targetSelector: '[data-tutorial="cricket-field"]',
    demoType: null,
    requiresAction: null,
    arrowPosition: "right",
    isHandOn: false,
    skippable: true,
  },
  {
    id: "army_demo_drag",
    chapter: 1,
    title: "Dragging Fielders",
    text: "Watch — fielders move like this.\n\nDrag them anywhere on the field to set your defensive shape.",
    voiceText:
      "Watch how a fielder is moved. Grab the dot and drag it to a new position.",
    targetSelector: '[data-tutorial="cricket-field"]',
    demoType: "fielder_drag",
    requiresAction: null,
    arrowPosition: "right",
    isHandOn: false,
    skippable: true,
  },
  {
    id: "army_try_drag",
    chapter: 1,
    title: "Your Turn",
    text: "Move at least one fielder to a new spot.\n\nDrag any blue dot on the field.",
    voiceText:
      "Your turn. Drag at least one blue fielder dot to a new position.",
    targetSelector: '[data-tutorial="cricket-field"]',
    demoType: null,
    requiresAction: "drag_any_fielder",
    arrowPosition: "right",
    isHandOn: true,
    skippable: false,
  },
  {
    id: "army_placement_tip",
    chapter: 1,
    title: "Good",
    text: "You can move fielders again any time before bowling.\n\nCover the zones where you think the batsman will hit — but don't be too obvious about it.",
    voiceText:
      "You can adjust fielders before every ball. Cover where you think the batsman will hit.",
    targetSelector: '[data-tutorial="cricket-field"]',
    demoType: null,
    requiresAction: null,
    arrowPosition: "right",
    isHandOn: false,
    skippable: true,
  },
];

// ============================================================
// Chapter 2 — The Delivery (6 steps)
// ============================================================
const CHAPTER_2: TutorialStep[] = [
  {
    id: "delivery_intro",
    chapter: 2,
    title: "The Delivery",
    text: "Before you bowl, you choose the delivery — three decisions:\n\nLENGTH. VARIATION. LINE.\n\nAll three must be set before you can bowl.",
    voiceText:
      "Before bowling, you choose three things: the length, the variation, and the line.",
    targetSelector: null,
    demoType: null,
    requiresAction: null,
    arrowPosition: "none",
    isHandOn: false,
    skippable: true,
  },
  {
    id: "delivery_length",
    chapter: 2,
    title: "Length",
    text: "LENGTH is where the ball bounces.\n\nYorker: full, aimed at the feet — hardest to hit.\nFull: driveable slot ball.\nGood Length: stock delivery.\nShort/Bouncer: forces the pull.",
    voiceText:
      "Length is where the ball bounces. Yorker aims at the feet and is the hardest to score off in the death.",
    targetSelector: '[data-tutorial="delivery-length"]',
    demoType: "button_click",
    requiresAction: null,
    arrowPosition: "right",
    isHandOn: false,
    skippable: true,
  },
  {
    id: "delivery_variation",
    chapter: 2,
    title: "Variation",
    text: "VARIATION is how the ball moves.\n\nSlower Ball is the death-over weapon — hard to time. But batsmen expect it.\n\nSeam movement (cutters, swing) creates extra problems.",
    voiceText:
      "Variation changes how the ball moves. Slower balls are devastating but predictable if you overuse them.",
    targetSelector: '[data-tutorial="delivery-variation"]',
    demoType: "button_click",
    requiresAction: null,
    arrowPosition: "right",
    isHandOn: false,
    skippable: true,
  },
  {
    id: "delivery_line",
    chapter: 2,
    title: "Line",
    text: "LINE is which stump you're targeting.\n\nOff Stump tightens the batsman up. Wide Leg is risky — likely to be called wide and cost you free runs.",
    voiceText:
      "Line is which stump you aim at. Off stump is tight. Wide leg risks a costly no-ball.",
    targetSelector: '[data-tutorial="delivery-line"]',
    demoType: null,
    requiresAction: null,
    arrowPosition: "right",
    isHandOn: false,
    skippable: true,
  },
  {
    id: "delivery_try_all",
    chapter: 2,
    title: "Pick Your Delivery",
    text: "Choose a Length, a Variation, and a Line.\n\nAll three must be selected before the bowl button activates.",
    voiceText:
      "Now pick a length, variation, and line. All three are required.",
    targetSelector: '[data-tutorial="delivery-selector"]',
    demoType: null,
    requiresAction: "select_full_delivery",
    arrowPosition: "right",
    isHandOn: true,
    skippable: false,
  },
  {
    id: "delivery_bowl_ready",
    chapter: 2,
    title: "Bowl It",
    text: "The bowl button lights up when all three are selected.\n\nHit it — bowl your first delivery.",
    voiceText:
      "The bowl button is ready. Hit it and bowl your first delivery.",
    targetSelector: '[data-tutorial="bowl-button"]',
    demoType: null,
    requiresAction: "bowl_delivery",
    arrowPosition: "top",
    isHandOn: true,
    skippable: false,
  },
];

// ============================================================
// Chapter 3 — The Bluff (4 steps)
// ============================================================
const CHAPTER_3: TutorialStep[] = [
  {
    id: "bluff_intro",
    chapter: 3,
    title: "The Bluff",
    text: "Here's the twist: the AI batsman reads your field to predict what delivery is coming — and adjusts their shot accordingly.",
    voiceText:
      "The AI batsman reads your fielding setup to predict what you will bowl, then plays the right shot.",
    targetSelector: null,
    demoType: null,
    requiresAction: null,
    arrowPosition: "none",
    isHandOn: false,
    skippable: true,
  },
  {
    id: "bluff_feedback_explained",
    chapter: 3,
    title: "Reading the Feedback",
    text: "After each ball, this panel tells you if the AI read you.\n\n✓ GREEN means you surprised them — the bluff worked.\n✗ RED means they saw it coming.",
    voiceText:
      "This panel shows whether the AI predicted your delivery. Green means you bluffed them. Red means they read you.",
    targetSelector: '[data-tutorial="feedback-panel"]',
    demoType: null,
    requiresAction: null,
    arrowPosition: "left",
    isHandOn: false,
    skippable: true,
  },
  {
    id: "bluff_mechanic",
    chapter: 3,
    title: "How to Bluff",
    text: "Set your fielders to suggest one delivery — then bowl something different.\n\nDeep mid-wicket fielders signal a leg-side attack. Bowl outside off instead. The AI adjusts for what they expect, not what you throw.",
    voiceText:
      "Place fielders to suggest one delivery, then bowl something else entirely. The AI prepares for the expected delivery, not the real one.",
    targetSelector: '[data-tutorial="feedback-panel"]',
    demoType: null,
    requiresAction: null,
    arrowPosition: "left",
    isHandOn: false,
    skippable: true,
  },
  {
    id: "bluff_go",
    chapter: 3,
    title: "You're Ready",
    text: "That's everything you need to know.\n\nBowl smart. Bluff the batsman. Defend that total.\n\nGood luck.",
    voiceText:
      "That is everything. Bowl smart, bluff the batsman, and defend your total. Good luck.",
    targetSelector: null,
    demoType: null,
    requiresAction: null,
    arrowPosition: "none",
    isHandOn: false,
    skippable: true,
  },
];

// ============================================================
// Exports
// ============================================================

export const ALL_STEPS: TutorialStep[] = [
  ...CHAPTER_0,
  ...CHAPTER_1,
  ...CHAPTER_2,
  ...CHAPTER_3,
];

export const CHAPTER_DEFS = [
  { number: 1, title: "THE MISSION",   subtitle: "What you're defending",       icon: "🎯" },
  { number: 2, title: "YOUR ARMY",     subtitle: "Place your 9 fielders",       icon: "🔵" },
  { number: 3, title: "THE DELIVERY",  subtitle: "Length, Variation, and Line", icon: "🎳" },
  { number: 4, title: "THE BLUFF",     subtitle: "Fool the AI batsman",         icon: "🧠" },
];

/** Steps per chapter — precomputed for navigation */
export const STEPS_PER_CHAPTER: number[] = [
  CHAPTER_0.length,  // 4
  CHAPTER_1.length,  // 5
  CHAPTER_2.length,  // 6
  CHAPTER_3.length,  // 4
];

/** Global step index at the start of each chapter */
export const CHAPTER_OFFSETS: number[] = STEPS_PER_CHAPTER.reduce<number[]>(
  (acc, count, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + STEPS_PER_CHAPTER[i - 1]);
    return acc;
  },
  []
);
