import { CONFIG, type PrizeTier } from "./config";
import { Player } from "./entities/player";
import { Obstacle, type ObstacleKind } from "./entities/obstacle";
import { Parallax } from "./systems/parallax";
import { overlaps, randRange, lerp } from "./systems/util";
import { getSprite, CHARACTER_SPRITES, NUMBER_SPRITES, areNumberSpritesReady } from "./assets";

export type GameState = "select-character" | "ready" | "playing" | "dead";

export interface GameCallbacks {
  onStateChange: (state: GameState) => void;
  onScore: (meters: number) => void;
  onReveal: (index: number) => void;
}

const BEST_KEY = "cola-runner:best";

export class Game {
  state: GameState = "ready";
  selectedCharId = 1;
  private player = new Player();
  private parallax = new Parallax();
  private obstacles: Obstacle[] = [];

  private worldSpeed: number = CONFIG.speed.start;
  private distancePx = 0;
  private bonusMeters = 0;
  private spawnTimer = 0;
  private firstRun = true;

  best = loadBest();

  constructor(private callbacks: GameCallbacks) {}

  setSelectedCharacter(id: number): void {
    this.selectedCharId = id;
    const character = CHARACTER_SPRITES.find((c) => c.id === id);
    if (character) {
      this.player.setCharacter(character);
    }
  }

  resetToMenu(): void {
    this.parallax.reset();
    this.obstacles = [];
    this.player.reset();
  }

  get meters(): number {
    return Math.floor(this.distancePx / CONFIG.score.pixelsPerMeter) + this.bonusMeters;
  }

  start(): void {
    const character = CHARACTER_SPRITES.find((c) => c.id === this.selectedCharId);
    if (character) {
      this.player.setCharacter(character);
    }
    this.player.reset();
    this.parallax.reset();
    this.obstacles = [];
    this.worldSpeed = CONFIG.speed.start * (this.firstRun ? CONFIG.speed.firstRunFactor : 1);
    this.distancePx = 0;
    this.bonusMeters = 0;
    this.spawnTimer = randRange(0.6, 1.0);
    this.setState("playing");
  }

  handleInput(): void {
    if (this.state === "playing") {
      this.player.requestJump();
    }
  }

  private setState(state: GameState): void {
    this.state = state;
    this.callbacks.onStateChange(state);
  }

  update(deltaTime: number): void {
    if (this.state !== "playing") return;

    // accelerates the world speed over time
    const targetMax = CONFIG.speed.max;
    this.worldSpeed = Math.min(targetMax, this.worldSpeed + CONFIG.speed.accelPerSec * deltaTime);
    this.distancePx += this.worldSpeed * deltaTime;

    this.player.update(deltaTime);

    // parallax + reveal
    const crossed = this.parallax.update(deltaTime, this.worldSpeed, this.meters);
    if (crossed) this.callbacks.onReveal(this.parallax.currentReveal);

    // spawn
    this.spawnTimer -= deltaTime;
    if (this.spawnTimer <= 0) {
      this.spawnObstacle();
      this.spawnTimer = this.nextGap();
    }

    // move / score / collide
    const playerHitbox = this.player.hitbox();
    for (const obstacle of this.obstacles) {
      obstacle.update(deltaTime, this.worldSpeed);

      // scores upon passing
      if (!obstacle.scored && obstacle.x + obstacle.w < this.player.x) {
        obstacle.scored = true;
      }

      // near-miss: close dodge over obstacle -> awards bonus distance
      if (!obstacle.nearMissChecked && obstacle.x + obstacle.w < playerHitbox.x) {
        obstacle.nearMissChecked = true;
        const clearance = obstacle.y - (this.player.y + CONFIG.player.h);
        if (clearance >= 0 && clearance <= CONFIG.score.nearMissMarginPx) {
          this.bonusMeters += CONFIG.score.nearMissBonus;
        }
      }

      // collision -> game over
      if (overlaps(playerHitbox, obstacle.hitbox())) {
        this.die();
        return;
      }
    }

    // In-place removal to avoid array allocations each frame
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      if (this.obstacles[i].offscreen()) {
        this.obstacles.splice(i, 1);
      }
    }
    this.callbacks.onScore(this.meters);
  }

  private spawnObstacle(): void {
    // higher speed increases chance of tall obstacles
    const progress = (this.worldSpeed - CONFIG.speed.start) / (CONFIG.speed.max - CONFIG.speed.start);
    const tallChance = lerp(0.25, 0.55, progress);
    const kind: ObstacleKind = Math.random() < tallChance ? "tall" : "low";
    this.obstacles.push(new Obstacle(kind, CONFIG.world.width + 40));
  }

  private nextGap(): number {
    const progress = (this.worldSpeed - CONFIG.speed.start) / (CONFIG.speed.max - CONFIG.speed.start);
    const minGap = lerp(CONFIG.spawn.gapStartMin, CONFIG.spawn.gapFastMin, progress);
    const maxGap = lerp(CONFIG.spawn.gapStartMax, CONFIG.spawn.gapFastMax, progress);
    return randRange(minGap, maxGap);
  }

  private die(): void {
    this.firstRun = false;
    if (this.meters > this.best) {
      this.best = this.meters;
      saveBest(this.best);
    }
    this.setState("dead");
  }

  currentTier(): PrizeTier {
    const metersDistance = this.meters;
    let tier = CONFIG.tiers[0];
    for (const t of CONFIG.tiers) if (metersDistance >= t.min) tier = t;
    return tier;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { width, height } = CONFIG.world;

    this.parallax.render(ctx);

    // Ground — extends beyond virtual world bounds on both axes to prevent
    // visible seams on different device aspect ratios
    const groundSprite = getSprite("ground");
    ctx.fillStyle = groundSprite.fallbackColor;
    ctx.fillRect(-500, CONFIG.groundY, width + 1000, height - CONFIG.groundY + 1000);

    for (const obstacle of this.obstacles) obstacle.render(ctx);
    this.player.render(ctx);

    // HUD score display during gameplay
    if (this.state === "playing") {
      const scoreStr = `${this.meters}m`;

      if (CONFIG.features.useSpriteScore && areNumberSpritesReady()) {
        const digitH = 46;
        const gap = 3;

        // Calculates total score width (including scaled 'm' suffix sprite)
        let totalW = 0;
        for (let i = 0; i < scoreStr.length; i++) {
          const char = scoreStr[i];
          const sprite = NUMBER_SPRITES[char];
          if (sprite) {
            const isM = char === "m";
            const h = isM ? Math.round(digitH * 0.72) : digitH;
            const charW = Math.round(h * sprite.ratio);
            totalW += charW + (i < scoreStr.length - 1 ? gap : 0);
          }
        }

        const endX = width - 24;
        let curX = endX - totalW;
        const topY = 24;

        for (let i = 0; i < scoreStr.length; i++) {
          const char = scoreStr[i];
          const sprite = NUMBER_SPRITES[char];
          if (sprite && sprite.img) {
            const isM = char === "m";
            const h = isM ? Math.round(digitH * 0.72) : digitH;
            const charW = Math.round(h * sprite.ratio);
            const drawY = isM ? topY + (digitH - h) : topY;
            ctx.drawImage(sprite.img, curX, drawY, charW, h);
            curX += charW + gap;
          }
        }
      } else {
        // Pure text fallback if feature flag is disabled or assets unavailable
        ctx.font = "bold 34px system-ui, sans-serif";
        ctx.textAlign = "right";

        ctx.strokeStyle = "rgba(15,14,12,0.85)";
        ctx.lineWidth = 6;
        ctx.lineJoin = "round";
        ctx.strokeText(`${this.meters}m`, width - 24, 60);

        ctx.fillStyle = "rgba(245,241,232,0.95)";
        ctx.fillText(`${this.meters}m`, width - 24, 60);
      }
    }
  }
}

function loadBest(): number {
  try {
    return parseInt(localStorage.getItem(BEST_KEY) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(value));
  } catch {
    /* private mode / storage blocked: ignore */
  }
}


