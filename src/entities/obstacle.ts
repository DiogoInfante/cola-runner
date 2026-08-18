import { CONFIG } from "../config";
import { OBSTACLE_SPRITES, type ObstacleSprite } from "../assets";
import { roundRect, type Rect } from "./player";

export type ObstacleKind = "low" | "tall";

export class Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: ObstacleKind;
  scored = false; // already counted as passed?
  nearMissChecked = false;
  sprite: ObstacleSprite;

  constructor(kind: ObstacleKind, spawnX: number) {
    this.kind = kind;
    this.x = spawnX;

    // Filters ready sprites of the correct type
    const pool = OBSTACLE_SPRITES.filter((sprite) => sprite.ready && sprite.kind === kind);
    if (pool.length > 0) {
      this.sprite = pool[Math.floor(Math.random() * pool.length)];
    } else {
      // If none found, tries any ready sprite
      const readyPool = OBSTACLE_SPRITES.filter((sprite) => sprite.ready);
      if (readyPool.length > 0) {
        this.sprite = readyPool[Math.floor(Math.random() * readyPool.length)];
      } else {
        // Ultimate fallback if no sprites are loaded yet
        this.sprite = OBSTACLE_SPRITES[Math.floor(Math.random() * OBSTACLE_SPRITES.length)];
      }
    }

    if (this.sprite.ready) {
      this.w = this.sprite.w;
      this.h = this.sprite.h;
    } else {
      if (kind === "low") {
        this.w = 84;
        this.h = 96;
      } else {
        this.w = 88;
        this.h = 148;
      }
    }
    this.y = CONFIG.groundY - this.h;
  }

  update(deltaTime: number, worldSpeed: number): void {
    this.x -= worldSpeed * deltaTime;
  }

  offscreen(): boolean {
    return this.x + this.w < -60;
  }

  hitbox(): Rect {
    // Fair hitbox with 10px inset for collage cutouts
    const insetX = 10;
    const insetY = 10;
    return {
      x: this.x + insetX,
      y: this.y + insetY,
      w: Math.max(10, this.w - insetX * 2),
      h: Math.max(10, this.h - insetY * 2),
    };
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.sprite.ready && this.sprite.img) {
      // Late adjustment if sprite loaded after spawn
      if (this.w === 56 || this.w === 62 || this.w === 84 || this.w === 88) {
        this.w = this.sprite.w;
        this.h = this.sprite.h;
        this.y = CONFIG.groundY - this.h;
      }
      ctx.drawImage(this.sprite.img, this.x, this.y, this.w, this.h);
    } else {
      ctx.fillStyle = this.sprite.fallbackColor;
      roundRect(ctx, this.x, this.y, this.w, this.h, 6);
      ctx.fill();
    }
  }
}

