// ============================================================================
// Image loader with FALLBACK. If artwork collages are missing, each slot
// renders a labeled rectangle. Allows the game to run 100% asset-free.
// Replacing with real artwork only requires placing files in /public/assets/.
// ============================================================================

export interface Sprite {
  img: HTMLImageElement | null;
  ready: boolean;
  // fallback: drawing behavior when image asset is missing
  fallbackColor: string;
  label: string;
}

const REGISTRY: Record<string, Sprite> = {};

function makeSprite(color: string, label: string): Sprite {
  return { img: null, ready: false, fallbackColor: color, label };
}

// Game asset slots. Replace image files while preserving key names.
export const SPRITES = {
  player: "assets/player.png", // running character cutout
  obstacleLow: "assets/obstacle-low.png", // low obstacle (jump over)
  obstacleTall: "assets/obstacle-tall.png", // tall obstacle
  ground: "assets/ground.png", // ground stripe (horizontally tileable)
  // Parallax layers (far -> near). bg0 is distant/slowest.
  bg0: "assets/bg-0.png",
  bg1: "assets/bg-1.png",
  bg2: "assets/bg-2.png",
} as const;

export type SpriteKey = keyof typeof SPRITES;

const FALLBACKS: Record<SpriteKey, { color: string; label: string }> = {
  player: { color: "#e8dcc0", label: "character cutout" },
  obstacleLow: { color: "#c98a5a", label: "obstacle" },
  obstacleTall: { color: "#a86a4a", label: "obstacle" },
  ground: { color: "#2a241c", label: "" },
  bg0: { color: "#1a1712", label: "collage — background" },
  bg1: { color: "#241f18", label: "collage — midground" },
  bg2: { color: "#2e281f", label: "collage — foreground" },
};

export interface ObstacleSprite {
  id: number;
  img: HTMLImageElement | null;
  ready: boolean;
  w: number;
  h: number;
  ratio: number;
  kind: "low" | "tall";
  src: string;
  fallbackColor: string;
}

// Supports up to 25 obstacles, 20 characters, and 15 dynamic backgrounds
export const OBSTACLE_SPRITES: ObstacleSprite[] = [];
for (let i = 1; i <= 25; i++) {
  OBSTACLE_SPRITES.push({
    id: i,
    img: null,
    ready: false,
    w: 0,
    h: 0,
    ratio: 1,
    kind: i % 2 === 0 ? "low" : "tall", // initial estimate
    src: `assets/obstacles/obstacle${i}.png`,
    fallbackColor: i % 2 === 0 ? "#c98a5a" : "#a86a4a",
  });
}

export interface CharacterSprite {
  id: number;
  img: HTMLImageElement | null;
  ready: boolean;
  w: number;
  h: number;
  ratio: number;
  src: string;
  fallbackColor: string;
  name: string;
}

export const CHARACTER_SPRITES: CharacterSprite[] = [];
for (let i = 1; i <= 20; i++) {
  CHARACTER_SPRITES.push({
    id: i,
    img: null,
    ready: false,
    w: 78,
    h: 92,
    ratio: 78 / 92,
    src: `assets/characters/character${i}.png`,
    fallbackColor: i === 1 ? "#e8dcc0" : i === 2 ? "#c98a5a" : "#a86a4a",
    name: `Pers. ${i}`,
  });
}

let onCharacterLoadedCallback: (() => void) | null = null;
export function registerOnCharacterLoaded(callback: () => void): void {
  onCharacterLoadedCallback = callback;
}

export function getAvailableCharacters(): CharacterSprite[] {
  return CHARACTER_SPRITES.filter((character) => character.ready);
}

export interface BackgroundSprite {
  id: number;
  img: HTMLImageElement | null;
  ready: boolean;
  w: number;
  h: number;
  ratio: number;
  src: string;
  exists: boolean;
}

export const BACKGROUND_SPRITES: BackgroundSprite[] = [];
for (let i = 1; i <= 15; i++) {
  BACKGROUND_SPRITES.push({
    id: i,
    img: null,
    ready: false,
    w: 540,
    h: 960,
    ratio: 540 / 960,
    src: `assets/backgrounds/bg${i}.jpg`,
    exists: false,
  });
}

export interface NumberSprite {
  key: string;
  img: HTMLImageElement | null;
  ready: boolean;
  w: number;
  h: number;
  ratio: number;
}

export const NUMBER_KEYS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "m"];
export const NUMBER_SPRITES: Record<string, NumberSprite> = {};
NUMBER_KEYS.forEach((key) => {
  NUMBER_SPRITES[key] = {
    key: key,
    img: null,
    ready: false,
    w: 0,
    h: 0,
    ratio: 1,
  };
});

export function areNumberSpritesReady(): boolean {
  return NUMBER_KEYS.every((key) => NUMBER_SPRITES[key]?.ready && NUMBER_SPRITES[key]?.img !== null);
}

export function loadImageWithExtensions(
  basePath: string,
  extensions: string[],
  onload: (img: HTMLImageElement) => void,
  onerror: () => void
): void {
  let extIndex = 0;

  function tryNext(): void {
    if (extIndex >= extensions.length) {
      onerror();
      return;
    }
    const ext = extensions[extIndex];
    const img = new Image();
    img.onload = () => {
      onload(img);
    };
    img.onerror = () => {
      extIndex++;
      tryNext();
    };
    img.src = `${basePath}.${ext}`;
  }

  tryNext();
}

export function initAssets(): void {
  (Object.keys(SPRITES) as SpriteKey[]).forEach((key) => {
    const fallback = FALLBACKS[key];
    const sprite = makeSprite(fallback.color, fallback.label);
    REGISTRY[key] = sprite;

    const img = new Image();
    img.onload = () => {
      sprite.img = img;
      sprite.ready = true;
    };
    img.onerror = () => {
      // File missing: uses fallback without breaking execution
      sprite.ready = false;
    };
    img.src = SPRITES[key];
  });

  const extensions = ["png", "jpg", "jpeg"];

  // Loads custom obstacles
  OBSTACLE_SPRITES.forEach((sprite) => {
    loadImageWithExtensions(
      `assets/obstacles/obstacle${sprite.id}`,
      extensions,
      (img) => {
        const ratio = img.naturalWidth / img.naturalHeight;
        // Classifies into low or tall based on aspect ratio
        const kind = ratio >= 0.85 ? "low" : "tall";
        const targetHeight = kind === "low" ? 96 : 148;
        let h = targetHeight;
        let w = targetHeight * ratio;
        const maxWidth = 130;
        if (w > maxWidth) {
          w = maxWidth;
          h = maxWidth / ratio;
        }
        sprite.img = img;
        sprite.ready = true;
        sprite.w = Math.round(w);
        sprite.h = Math.round(h);
        sprite.ratio = ratio;
        sprite.kind = kind;
        sprite.src = img.src;
      },
      () => {
        sprite.ready = false;
        if (sprite.kind === "low") {
          sprite.w = 84;
          sprite.h = 96;
        } else {
          sprite.w = 88;
          sprite.h = 148;
        }
      }
    );
  });

  // Loads character options
  CHARACTER_SPRITES.forEach((character) => {
    loadImageWithExtensions(
      `assets/characters/character${character.id}`,
      extensions,
      (img) => {
        const ratio = img.naturalWidth / img.naturalHeight;
        const targetHeight = 92; // design height for player
        let h = targetHeight;
        let w = targetHeight * ratio;
        const maxWidth = 90;
        const minWidth = 55;
        if (w > maxWidth) {
          w = maxWidth;
          h = maxWidth / ratio;
        } else if (w < minWidth) {
          w = minWidth;
          h = minWidth / ratio;
        }
        character.img = img;
        character.ready = true;
        character.w = Math.round(w);
        character.h = Math.round(h);
        character.ratio = ratio;
        character.src = img.src;
        if (onCharacterLoadedCallback) {
          onCharacterLoadedCallback();
        }
      },
      () => {
        character.ready = false;
      }
    );
  });

  // Probes background files and loads initial two into memory
  BACKGROUND_SPRITES.forEach((bg) => {
    loadImageWithExtensions(
      `assets/backgrounds/bg${bg.id}`,
      extensions,
      (img) => {
        bg.exists = true;
        bg.ratio = img.naturalWidth / img.naturalHeight;
        bg.h = 960;
        bg.w = Math.round(960 * bg.ratio);
        bg.src = img.src;

        // Only bg1 and bg2 are kept in memory initially
        if (bg.id <= 2) {
          bg.img = img;
          bg.ready = true;
        } else {
          bg.img = null;
          bg.ready = false;
        }
      },
      () => {
        bg.exists = false;
        bg.ready = false;
        bg.img = null;
      }
    );
  });

  // Loads monospaced digit sprites (and 'm' suffix) for score counter
  NUMBER_KEYS.forEach((key) => {
    loadImageWithExtensions(
      `assets/numbers/${key}`,
      extensions,
      (img) => {
        const num = NUMBER_SPRITES[key];
        if (num) {
          num.img = img;
          num.ready = true;
          num.w = img.naturalWidth;
          num.h = img.naturalHeight;
          num.ratio = img.naturalWidth / img.naturalHeight;
        }
      },
      () => {
        const num = NUMBER_SPRITES[key];
        if (num) {
          num.ready = false;
          num.img = null;
        }
      }
    );
  });
}

export function getSprite(key: SpriteKey): Sprite {
  return REGISTRY[key];
}





