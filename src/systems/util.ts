import type { Rect } from "../entities/player";

export function overlaps(rectA: Rect, rectB: Rect): boolean {
  return (
    rectA.x < rectB.x + rectB.w &&
    rectA.x + rectA.w > rectB.x &&
    rectA.y < rectB.y + rectB.h &&
    rectA.y + rectA.h > rectB.y
  );
}

export function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Linearly interpolates progress between start and end, clamped between 0 and 1. */
export function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * Math.max(0, Math.min(1, progress));
}

