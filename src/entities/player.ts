import { CONFIG } from "../config";
import { getSprite, CHARACTER_SPRITES, type CharacterSprite } from "../assets";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class Player {
  x = CONFIG.player.x;
  y = 0;
  vy = 0;
  w: number = CONFIG.player.w;
  h: number = CONFIG.player.h;
  char: CharacterSprite = CHARACTER_SPRITES[0];

  private grounded = true;
  private coyote = 0; // remaining coyote time
  private buffer = 0; // remaining jump buffer time
  private jumpsUsed = 0;

  setCharacter(character: CharacterSprite): void {
    this.char = character;
    this.w = character.ready ? character.w : CONFIG.player.w;
    this.h = character.ready ? character.h : CONFIG.player.h;
    if (this.grounded) {
      this.y = CONFIG.groundY - this.h;
    }
  }

  reset(): void {
    this.y = CONFIG.groundY - this.h;
    this.vy = 0;
    this.grounded = true;
    this.coyote = 0;
    this.buffer = 0;
    this.jumpsUsed = 0;
  }

  /** Called on input (touch/space). Buffers input; jump execution occurs in update(). */
  requestJump(): void {
    this.buffer = CONFIG.physics.jumpBuffer;
  }

  update(deltaTime: number): void {
    const physics = CONFIG.physics;

    if (this.buffer > 0) this.buffer -= deltaTime;
    if (this.coyote > 0) this.coyote -= deltaTime;

    const canGroundJump = this.grounded || this.coyote > 0;
    const canDoubleJump = physics.allowDoubleJump && this.jumpsUsed < 2;

    if (this.buffer > 0 && (canGroundJump || canDoubleJump)) {
      this.vy = physics.jumpVelocity;
      this.jumpsUsed = canGroundJump ? 1 : this.jumpsUsed + 1;
      this.grounded = false;
      this.coyote = 0;
      this.buffer = 0;
    }

    // gravity
    this.vy = Math.min(this.vy + physics.gravity * deltaTime, physics.maxFallSpeed);
    this.y += this.vy * deltaTime;

    // ground collision
    const floor = CONFIG.groundY - this.h;
    if (this.y >= floor) {
      if (!this.grounded) {
        this.grounded = true;
        this.jumpsUsed = 0;
      }
      this.y = floor;
      this.vy = 0;
      this.coyote = CONFIG.physics.coyoteTime;
    } else {
      this.grounded = false;
    }
  }

  /** Fair hitbox: slightly smaller than sprite to prevent unfair collisions. */
  hitbox(): Rect {
    // Proportional insets based on character dimensions
    const insetX = Math.round(this.w * 0.23);
    const insetY = Math.round(this.h * 0.15);
    return {
      x: this.x + insetX,
      y: this.y + insetY,
      w: this.w - insetX * 2,
      h: this.h - insetY * 2,
    };
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.char && this.char.ready && this.char.img) {
      ctx.drawImage(this.char.img, this.x, this.y, this.w, this.h);
    } else {
      const fallbackSprite = getSprite("player");
      if (fallbackSprite.ready && fallbackSprite.img) {
        ctx.drawImage(fallbackSprite.img, this.x, this.y, this.w, this.h);
      } else {
        ctx.fillStyle = this.char ? this.char.fallbackColor : fallbackSprite.fallbackColor;
        roundRect(ctx, this.x, this.y, this.w, this.h, 10);
        ctx.fill();
        ctx.fillStyle = "#17140f";
        ctx.font = "11px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          this.char ? this.char.name : fallbackSprite.label,
          this.x + this.w / 2,
          this.y + this.h / 2
        );
      }
    }
  }
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
): void {
  const cornerRadius = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + cornerRadius, y);
  ctx.arcTo(x + w, y, x + w, y + h, cornerRadius);
  ctx.arcTo(x + w, y + h, x, y + h, cornerRadius);
  ctx.arcTo(x, y + h, x, y, cornerRadius);
  ctx.arcTo(x, y, x + w, y, cornerRadius);
  ctx.closePath();
}


