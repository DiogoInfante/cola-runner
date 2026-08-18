import { CONFIG } from "../config";
import { getSprite, type SpriteKey, BACKGROUND_SPRITES, loadImageWithExtensions, type BackgroundSprite } from "../assets";

interface Layer {
  key: SpriteKey;
  factor: number; // fraction of world speed (0 = static, 1 = foreground speed)
  offset: number;
}

// ============================================================================
// Parallax: layers moving at different speeds create depth and a dynamic world.
// The "reveal" system changes the distant background at distance milestones.
// ============================================================================
export class Parallax {
  private layers: Layer[] = [
    { key: "bg0", factor: 0.15, offset: 0 },
    { key: "bg1", factor: 0.4, offset: 0 },
    { key: "bg2", factor: 0.7, offset: 0 },
  ];

  private revealIndex = 0;
  private bgIndex = 0;
  private cachedExistingBgs: typeof BACKGROUND_SPRITES = [];

  private getExistingBgs(): typeof BACKGROUND_SPRITES {
    const existing = BACKGROUND_SPRITES.filter((bg) => bg.exists).sort((a, b) => a.id - b.id);
    if (existing.length > 0) {
      this.cachedExistingBgs = existing;
    }
    return this.cachedExistingBgs;
  }

  reset(): void {
    this.layers.forEach((layer) => (layer.offset = 0));
    this.revealIndex = 0;
    this.bgIndex = 0;
    this.cachedExistingBgs = BACKGROUND_SPRITES.filter((bg) => bg.exists).sort((a, b) => a.id - b.id);
    if (this.cachedExistingBgs.length > 0) {
      this.manageMemory(this.cachedExistingBgs);
    }
  }

  private manageMemory(existingBgs: BackgroundSprite[]): void {
    const total = existingBgs.length;
    if (total === 0) return;

    // Keep only current and next background loaded in memory
    const currentIdx = this.bgIndex % total;
    const nextIdx = (this.bgIndex + 1) % total;

    existingBgs.forEach((bg, idx) => {
      if (idx === currentIdx || idx === nextIdx) {
        if (!bg.ready && !bg.img) {
          const extensions = ["png", "jpg", "jpeg"];
          loadImageWithExtensions(
            `assets/backgrounds/bg${bg.id}`,
            extensions,
            (img) => {
              bg.img = img;
              bg.ready = true;
            },
            () => {
              bg.ready = false;
            }
          );
        }
      } else {
        // Unloads unused backgrounds from memory to save RAM/GPU
        if (bg.ready || bg.img) {
          bg.img = null;
          bg.ready = false;
        }
      }
    });
  }

  /** Returns true when crossing a new milestone (to trigger effects/feedback). */
  update(deltaTime: number, worldSpeed: number, metersDistance: number): boolean {
    const existingBgs = this.getExistingBgs();
    if (existingBgs.length > 0) {
      this.manageMemory(existingBgs);
    }

    for (const layer of this.layers) {
      if (layer.key === "bg0") {
        if (existingBgs.length > 0) {
          // Attempts to obtain current background
          const currentBg = existingBgs[this.bgIndex % existingBgs.length];
          const wrapW = currentBg ? currentBg.w : CONFIG.world.width;
          layer.offset += worldSpeed * layer.factor * deltaTime;

          if (layer.offset >= wrapW) {
            layer.offset -= wrapW;
            this.bgIndex = (this.bgIndex + 1) % existingBgs.length;
          }
        } else {
          layer.offset = (layer.offset + worldSpeed * layer.factor * deltaTime) % CONFIG.world.width;
        }
      } else {
        layer.offset = (layer.offset + worldSpeed * layer.factor * deltaTime) % CONFIG.world.width;
      }
    }

    let crossed = false;
    const nextMilestone = CONFIG.revealMilestones[this.revealIndex + 1];
    if (nextMilestone !== undefined && metersDistance >= nextMilestone) {
      this.revealIndex++;
      crossed = true;
    }
    return crossed;
  }

  get currentReveal(): number {
    return this.revealIndex;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { width, height } = CONFIG.world;
    const existingBgs = this.getExistingBgs();

    for (const layer of this.layers) {
      if (layer.key === "bg0") {
        if (existingBgs.length > 0) {
          let drawX = -layer.offset;
          let currentIndex = this.bgIndex;

          while (drawX < width) {
            const bg = existingBgs[currentIndex % existingBgs.length];

            if (bg && bg.ready && bg.img) {
              ctx.drawImage(bg.img, drawX, 0, bg.w, height);
              drawX += bg.w;
            } else {
              // If the next background is not ready, renders current background as fallback to prevent black gaps
              const fallbackBg = existingBgs[this.bgIndex % existingBgs.length];
              if (fallbackBg && fallbackBg.ready && fallbackBg.img) {
                ctx.drawImage(fallbackBg.img, drawX, 0, fallbackBg.w, height);
                drawX += fallbackBg.w;
              } else {
                drawX += width; // prevents infinite loop
              }
            }
            currentIndex++;
          }
        } else {
          // Original fallback if no custom background is ready
          const sprite = getSprite(layer.key);
          const shade = 1 + this.revealIndex * 0.06;
          ctx.fillStyle = adjustColorBrightness(sprite.fallbackColor, shade);
          ctx.fillRect(0, 0, width, height);
          if (sprite.label) {
            ctx.fillStyle = "rgba(245,241,232,0.25)";
            ctx.font = "13px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(
              `${sprite.label} — obra ${this.revealIndex + 1}`,
              width / 2,
              120
            );
          }
        }
      } else {
        // Extra layers (bg1, bg2) - rendered only when ready, avoiding fallbacks that obscure main background
        const sprite = getSprite(layer.key);
        if (sprite.ready && sprite.img) {
          const drawX = -layer.offset;
          ctx.drawImage(sprite.img, drawX, 0, width, height);
          ctx.drawImage(sprite.img, drawX + width, 0, width, height);
        }
      }
    }
  }
}

function adjustColorBrightness(hex: string, factor: number): string {
  const hexValue = parseInt(hex.slice(1), 16);
  const red = Math.min(255, Math.round(((hexValue >> 16) & 255) * factor));
  const green = Math.min(255, Math.round(((hexValue >> 8) & 255) * factor));
  const blue = Math.min(255, Math.round((hexValue & 255) * factor));
  return `rgb(${red},${green},${blue})`;
}



