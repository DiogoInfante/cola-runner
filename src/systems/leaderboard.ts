import { CONFIG } from "../config";

export interface LeaderboardEntry {
  name: string;
  score: number;
}

const PLAYER_NAME_KEY = "cola-runner:player-name";
const LOCAL_LEADERBOARD_KEY = "cola-runner:local-leaderboard";
const BEST_SCORE_PREFIX = "cola-runner:best-for:";
const LEGACY_BEST_KEY = "cola-runner:best";

/**
 * Returns the active player's name.
 * Returns an empty string if none is set.
 */
export function getPlayerName(): string {
  try {
    return localStorage.getItem(PLAYER_NAME_KEY) || "";
  } catch {
    return "";
  }
}

/**
 * Sets the active player's name and saves it to localStorage.
 */
export function setPlayerName(name: string): void {
  try {
    const cleanName = name.trim();
    localStorage.setItem(PLAYER_NAME_KEY, cleanName);
    initializePlayerRecord(cleanName);
  } catch {
    /* ignore storage issues */
  }
}

/**
 * Returns true if the current player is playing as guest.
 */
export function isGuest(): boolean {
  const name = getPlayerName().toLowerCase();
  return name === "convidado" || name === "";
}

/**
 * Initializes the player record, migrating legacy high score if applicable.
 * Returns the highest score recorded.
 */
export function initializePlayerRecord(name: string): number {
  const cleanName = name.trim();
  if (!cleanName) return 0;

  try {
    const key = BEST_SCORE_PREFIX + cleanName;
    const existing = localStorage.getItem(key);
    if (existing !== null) {
      return parseInt(existing, 10) || 0;
    }

    // Attempts to migrate legacy score record
    const legacyVal = localStorage.getItem(LEGACY_BEST_KEY);
    const score = legacyVal ? parseInt(legacyVal, 10) || 0 : 0;
    localStorage.setItem(key, String(score));
    return score;
  } catch {
    return 0;
  }
}

/**
 * Returns the highest score recorded for a specific player name.
 */
export function getBestScoreForName(name: string): number {
  const cleanName = name.trim();
  if (!cleanName) return 0;

  try {
    const key = BEST_SCORE_PREFIX + cleanName;
    const scoreVal = localStorage.getItem(key);
    return scoreVal !== null ? parseInt(scoreVal, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

/**
 * Saves the highest score for a specific player name.
 * Also updates the legacy score record if higher.
 */
export function saveBestScoreForName(name: string, score: number): void {
  const cleanName = name.trim();
  if (!cleanName) return;

  try {
    localStorage.setItem(BEST_SCORE_PREFIX + cleanName, String(score));

    // Syncs with legacy score record for backward compatibility
    const legacyVal = localStorage.getItem(LEGACY_BEST_KEY);
    const legacyScore = legacyVal ? parseInt(legacyVal, 10) || 0 : 0;
    if (score > legacyScore) {
      localStorage.setItem(LEGACY_BEST_KEY, String(score));
    }
  } catch {
    // ignore storage issues
  }
}

/**
 * Returns the local leaderboard entries (offline cache).
 */
export function getLocalLeaderboard(): LeaderboardEntry[] {
  try {
    const leaderboardData = localStorage.getItem(LOCAL_LEADERBOARD_KEY);
    if (leaderboardData) {
      return JSON.parse(leaderboardData) as LeaderboardEntry[];
    }
  } catch {
    // ignore storage issues
  }
  return [];
}

/**
 * Saves the leaderboard list locally (offline fallback).
 */
function saveLocalLeaderboard(entries: LeaderboardEntry[]): void {
  try {
    localStorage.setItem(LOCAL_LEADERBOARD_KEY, JSON.stringify(entries));
  } catch {
    // ignore storage issues
  }
}

/**
 * Submits a score to Google Sheets via Apps Script Web App.
 *
 * FIRE-AND-FORGET: Non-blocking execution. Each invocation triggers
 * an independent fetch that appends a new row in Google Sheets via Apps Script.
 *
 * Does not write to local cache. Active player score is merged
 * optimistically into the UI via mergeActivePlayerScore() during render.
 */
export function submitScore(name: string, score: number): void {
  const cleanName = name.trim();
  if (!cleanName || score <= 0) return;

  // Returns early if no endpoint URL is configured (offline mode)
  if (!CONFIG.leaderboardUrl) return;

  // Triggers fire-and-forget fetch to Google Sheets
  const url = `${CONFIG.leaderboardUrl}?action=add&name=${encodeURIComponent(cleanName)}&score=${score}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  fetch(url, { signal: controller.signal, redirect: "follow" })
    .then((response) => {
      clearTimeout(timeoutId);
      if (!response.ok) {
        console.warn("Leaderboard: unexpected server response", response.status);
      }
    })
    .catch((error) => {
      clearTimeout(timeoutId);
      if ((error as Error).name !== "AbortError") {
        console.warn("Leaderboard: failed to submit score:", error);
      }
    });
}

/**
 * Fetches current leaderboard entries.
 *
 * Fetches fresh remote data, falling back to memory cache and localStorage if offline.
 */
export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  if (!CONFIG.leaderboardUrl) {
    return getLocalLeaderboard();
  }

  // Always attempts to fetch fresh data from server
  const freshData = await fetchRemote();
  if (freshData) return freshData;

  // Fallback: memory cache from last successful remote fetch
  if (lastRemoteData) return lastRemoteData;

  // Final fallback: local storage cache
  return getLocalLeaderboard();
}

// Memory cache for last successful remote response
let lastRemoteData: LeaderboardEntry[] | null = null;

/**
 * Fetches remote data from Google Sheets with a timeout.
 */
async function fetchRemote(): Promise<LeaderboardEntry[] | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(CONFIG.leaderboardUrl, {
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        lastRemoteData = data as LeaderboardEntry[];
        // Saves to localStorage as offline fallback
        saveLocalLeaderboard(lastRemoteData);
        return lastRemoteData;
      }
    }
  } catch (error) {
    console.warn("Leaderboard: failed to load online rankings:", error);
  }
  return null;
}



