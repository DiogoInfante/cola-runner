// ============================================================================
// All game feel parameters are configured here.
// Physics units are per SECOND (fixed timestep), ensuring consistent behavior
// on any device regardless of frame rate.
// ============================================================================

export interface PrizeTier {
  min: number; // minimum score (meters) required for this tier
  label: string; // text displayed on game over screen
  sub: string; // subtitle / instruction text
}

export const CONFIG = {
  // --- Feature Flags ---
  features: {
    useSpriteScore: true, // Enabled by default: uses monospaced sprites for score display
  },

  // --- Virtual Resolution (game is rendered here and scaled to screen) ---
  // Portrait. Scaled and centered regardless of actual screen aspect ratio.
  world: {
    width: 540,
    height: 960,
  },
  groundY: 820, // ground Y position in virtual coordinates

  // --- Player Physics (px/s) ---
  physics: {
    gravity: 3000,
    jumpVelocity: -1050,
    maxFallSpeed: 1700,
    coyoteTime: 0.09, // grace period after leaving a ledge allowing a jump
    jumpBuffer: 0.12, // buffered jump input window before landing
    allowDoubleJump: true,
  },

  // --- Player ---
  player: {
    x: 130,
    w: 78,
    h: 92,
    // Fair hitbox: slightly smaller than sprite to prevent unfair collisions.
    hitboxInsetX: 18,
    hitboxInsetY: 14,
  },

  // --- World Speed (px/s) ---
  speed: {
    start: 380,
    max: 1000,
    accelPerSec: 7, // gradual speed increase over time
    // Generous first run speed factor to prevent immediate game overs.
    firstRunFactor: 0.85,
  },

  // --- Obstacle Spawns (seconds between spawns) ---
  spawn: {
    gapStartMin: 1.15,
    gapStartMax: 1.9,
    gapFastMin: 0.72, // gap shrinks as speed increases
    gapFastMax: 1.15,
  },

  // --- Scoring ---
  score: {
    pixelsPerMeter: 42, // world movement required to increment 1 meter
    nearMissBonus: 12, // bonus distance awarded for close dodges
    nearMissMarginPx: 28, // vertical tolerance threshold for near-miss registration
  },

  // --- Prize Tiers (by distance in meters) ---
  // Linked to Instagram follow: prizes can be claimed by following and showing proof.
  tiers: [
    { min: 0, label: "Quase lá!", sub: "Chega em 150m e leva um marcador." },
    { min: 150, label: "Marcador de livro", sub: "Siga o @ e mostre na banca." },
    { min: 400, label: "Postal", sub: "Siga o @ e mostre na banca." },
    { min: 800, label: "Combo: postal + cartão", sub: "Siga o @ e mostre na banca." },
  ] as PrizeTier[],

  // --- Artwork Reveal Milestones (meters) ---
  // Background switches at milestones to display artwork collages.
  revealMilestones: [0, 120, 300, 550, 850, 1200],

  // --- Call To Action ---
  instagram: {
    handle: "@_cola_em_mim", // REPLACE with official Instagram handle
    url: "https://www.instagram.com/_cola_em_mim/", // REPLACE with official Instagram URL
  },

  // --- Performance ---
  maxDevicePixelRatio: 2, // limits DPR to save battery and maintain FPS

  // --- Leaderboard ---
  leaderboardUrl: import.meta.env.VITE_LEADERBOARD_URL || "",
} as const;

export type Config = typeof CONFIG;


