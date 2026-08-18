import { inject } from "@vercel/analytics";
import {
  initAssets,
  getAvailableCharacters,
  registerOnCharacterLoaded,
  BACKGROUND_SPRITES,
  CHARACTER_SPRITES,
  NUMBER_SPRITES,
  areNumberSpritesReady,
  loadImageWithExtensions,
} from "./assets";
import { CONFIG } from "./config";
import { Game, type GameState } from "./game";
import {
  type LeaderboardEntry,
  getPlayerName,
  setPlayerName,
  getBestScoreForName,
  saveBestScoreForName,
  submitScore,
  fetchLeaderboard,
  initializePlayerRecord,
} from "./systems/leaderboard";

initAssets();
inject();

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d", { alpha: false })!;
const ui = document.getElementById("ui")!;

function renderScoreDOM(element: HTMLElement, meters: number): void {
  element.innerHTML = "";
  if (CONFIG.features.useSpriteScore && areNumberSpritesReady()) {
    element.className = "score sprite-score-dom";
    const str = `${meters}m`;
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      const sprite = NUMBER_SPRITES[char];
      if (sprite && sprite.img) {
        const img = document.createElement("img");
        img.src = sprite.img.src;
        img.alt = char;
        if (char === "m") {
          img.className = "m-suffix";
        }
        element.appendChild(img);
      }
    }
  } else {
    element.className = "score";
    element.innerHTML = `<span data-bind="score">${meters}</span><small>m</small>`;
  }
}

// --- Characters & Selection ---
const charList = document.getElementById("character-list")!;
const confirmBtn = document.getElementById("confirm-character-btn") as HTMLButtonElement;

let selectedId: number | null = null;

function updateSelectedCharacterDOM(): void {
  charList.querySelectorAll<HTMLElement>(".character-option").forEach((element) => {
    const id = parseInt(element.dataset.charId || "0", 10);
    if (id === selectedId) {
      element.classList.add("selected");
    } else {
      element.classList.remove("selected");
    }
  });
}

function renderCharacters(): void {
  const chars = getAvailableCharacters();

  // Rebuilds DOM elements only if list was empty, loading, or size changed
  const needsBuild =
    charList.childElementCount === 0 ||
    charList.querySelector(".hint") !== null ||
    charList.childElementCount !== chars.length;

  if (needsBuild) {
    charList.innerHTML = "";

    if (chars.length === 0) {
      charList.innerHTML = "<p class='hint'>Carregando personagens...</p>";
      confirmBtn.disabled = true;
      return;
    }

    chars.forEach((char) => {
      const div = document.createElement("div");
      div.className = "character-option";
      div.dataset.charId = String(char.id);

      div.addEventListener("click", () => {
        selectedId = char.id;
        game.setSelectedCharacter(char.id);
        updateSelectedCharacterDOM();
        confirmBtn.disabled = false;
      });

      if (char.img) {
        const imgClone = char.img.cloneNode() as HTMLImageElement;
        div.appendChild(imgClone);
      } else {
        const placeholder = document.createElement("div");
        placeholder.style.width = "40px";
        placeholder.style.height = "40px";
        placeholder.style.backgroundColor = char.fallbackColor;
        placeholder.style.borderRadius = "8px";
        placeholder.style.marginBottom = "6px";
        div.appendChild(placeholder);
      }

      const label = document.createElement("span");
      label.className = "char-label";
      label.textContent = char.name;
      div.appendChild(label);

      charList.appendChild(div);
    });
  }

  if (selectedId === null && chars.length > 0) {
    selectedId = chars[0].id;
    game.setSelectedCharacter(chars[0].id);
  }

  updateSelectedCharacterDOM();
  confirmBtn.disabled = selectedId === null;
}

registerOnCharacterLoaded(() => {
  renderCharacters();
});

// --- Scaling: renders virtual world and scales "contain" to viewport ---
let scale = 1;
let offsetX = 0;
let offsetY = 0;
let canvasW = 0;
let canvasH = 0;

function resize(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxDevicePixelRatio);

  // visualViewport provides accurate dimensions on iOS (handles rotation, software keyboard, address bar)
  const viewport = window.visualViewport;
  const viewportWidth = viewport ? viewport.width : window.innerWidth;
  const viewportHeight = viewport ? viewport.height : window.innerHeight;

  canvas.width = Math.round(viewportWidth * dpr);
  canvas.height = Math.round(viewportHeight * dpr);
  canvas.style.width = `${viewportWidth}px`;
  canvas.style.height = `${viewportHeight}px`;

  canvasW = viewportWidth;
  canvasH = viewportHeight;

  // contain: fits full virtual world, centered
  scale = Math.min(viewportWidth / CONFIG.world.width, viewportHeight / CONFIG.world.height);
  offsetX = (viewportWidth - CONFIG.world.width * scale) / 2;
  offsetY = (viewportHeight - CONFIG.world.height * scale) / 2;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", resize);
}
// iOS requires a brief delay after orientation change to report correct dimensions
window.addEventListener("orientationchange", () => {
  setTimeout(resize, 100);
  setTimeout(resize, 300);
});
resize();

// Attempts to lock orientation to portrait on supported browsers (Screen Orientation API)
function tryLockPortrait(): void {
  if (screen.orientation && "lock" in screen.orientation) {
    (screen.orientation as { lock: (orientation: string) => Promise<void> }).lock("portrait").catch(() => {});
  }
}
window.addEventListener("pointerdown", tryLockPortrait, { once: true });

// --- UI Wiring ---
const screens: Record<string, HTMLElement> = {};
ui.querySelectorAll<HTMLElement>("[data-screen]").forEach((element) => {
  screens[element.dataset.screen!] = element;
});

function showScreen(state: GameState | "identification" | "leaderboard"): void {
  Object.entries(screens).forEach(([name, element]) => {
    const visible = name === state;
    element.hidden = !visible && name !== "playing";
    if (name === "playing") element.hidden = true; // no overlay during gameplay
  });
  if (state === "playing") {
    Object.values(screens).forEach((element) => (element.hidden = true));
  }
}

function bindText(name: string, value: string): void {
  ui.querySelectorAll<HTMLElement>(`[data-bind="${name}"]`).forEach((element) => {
    element.textContent = value;
  });
}

const game = new Game({
  onStateChange: (state) => {
    if (state === "dead") {
      const name = getPlayerName();
      const score = game.meters;

      // Updates local personal best if beaten
      const currentBest = getBestScoreForName(name);
      if (score > currentBest) {
        saveBestScoreForName(name, score);
      }

      // ALWAYS submits score to spreadsheet (fire-and-forget).
      // submitScore is non-blocking: fires fetch and returns immediately.
      // Each call appends a new row in Google Sheets via appendRow(),
      // so simultaneous submissions from different players never collide.
      // Guest entries are excluded from online rankings.
      if (name && name.toLowerCase() !== "convidado" && score > 0) {
        submitScore(name, score);
      }

      fillDeadScreen();
    }
    showScreen(state);
  },
  onScore: () => {
    /* HUD is rendered on canvas */
  },
  onReveal: () => {
    /* hook for "artwork revealed" effect (flash, sound) in v2 */
  },
});

const shareBgList = document.getElementById("share-bg-list")!;
let selectedShareBgId = 1;

function fillDeadScreen(): void {
  const deadScoreEl = ui.querySelector<HTMLElement>(".score");
  if (deadScoreEl) {
    renderScoreDOM(deadScoreEl, game.meters);
  } else {
    bindText("score", String(game.meters));
  }
  bindText("best", String(getBestScoreForName(getPlayerName())));

  const link = ui.querySelector<HTMLAnchorElement>('[data-bind="ig-link"]')!;
  link.href = CONFIG.instagram.url;
  link.textContent = `Seguir ${CONFIG.instagram.handle}`;

  // Renders background list for sharing
  shareBgList.innerHTML = "";
  const existingBgs = BACKGROUND_SPRITES.filter((bg) => bg.exists);

  if (existingBgs.length === 0) {
    shareBgList.innerHTML = "<p class='hint'>Nenhum fundo disponível</p>";
  } else {
    if (!existingBgs.some((bg) => bg.id === selectedShareBgId)) {
      selectedShareBgId = existingBgs[0].id;
    }

    existingBgs.forEach((bg) => {
      const btn = document.createElement("button");
      btn.className = "share-bg-option";
      if (bg.id === selectedShareBgId) {
        btn.classList.add("selected");
      }

      btn.addEventListener("click", (event) => {
        event.stopPropagation(); // Prevents restarting game
        selectedShareBgId = bg.id;
        shareBgList.querySelectorAll(".share-bg-option").forEach((element, index) => {
          if (existingBgs[index].id === selectedShareBgId) {
            element.classList.add("selected");
          } else {
            element.classList.remove("selected");
          }
        });
      });

      if (bg.ready && bg.img) {
        const imgClone = bg.img.cloneNode() as HTMLImageElement;
        btn.appendChild(imgClone);
      } else {
        const placeholder = document.createElement("div");
        placeholder.className = "share-bg-option-placeholder";
        placeholder.textContent = `BG ${bg.id}`;
        placeholder.style.backgroundColor = bg.id === 1 ? "#e8dcc0" : bg.id === 2 ? "#c98a5a" : "#a86a4a";
        btn.appendChild(placeholder);

        // Preloads background in background if selected
        if (bg.exists && !bg.img) {
          const extensions = ["png", "jpg", "jpeg"];
          loadImageWithExtensions(
            `assets/backgrounds/bg${bg.id}`,
            extensions,
            (img) => {
              bg.img = img;
              bg.ready = true;
              bg.ratio = img.naturalWidth / img.naturalHeight;
              bg.h = 960;
              bg.w = Math.round(960 * bg.ratio);
              bg.src = img.src;
              // Redraws to show thumbnail
              fillDeadScreen();
            },
            () => {}
          );
        }
      }

      shareBgList.appendChild(btn);
    });
  }
}

async function shareInstagram(): Promise<void> {
  const bg = BACKGROUND_SPRITES.find((b) => b.id === selectedShareBgId);
  if (!bg) return;

  if (!bg.ready || !bg.img) {
    alert("O fundo ainda está carregando, tente novamente em alguns instantes.");
    return;
  }

  // 1. Creates story canvas (1080 x 1920)
  const shareCanvas = document.createElement("canvas");
  shareCanvas.width = 1080;
  shareCanvas.height = 1920;
  const shareCtx = shareCanvas.getContext("2d")!;

  const width = shareCanvas.width;
  const height = shareCanvas.height;

  // 2. Renders stretched background (Aspect Fill)
  const imgW = bg.img.naturalWidth;
  const imgH = bg.img.naturalHeight;
  const scaleRatio = Math.max(width / imgW, height / imgH);
  const drawX = (width - imgW * scaleRatio) / 2;
  const drawY = (height - imgH * scaleRatio) / 2;
  shareCtx.drawImage(bg.img, drawX, drawY, imgW * scaleRatio, imgH * scaleRatio);

  // 3. Dark overlay for contrast
  shareCtx.fillStyle = "rgba(15, 14, 12, 0.4)";
  shareCtx.fillRect(0, 0, width, height);

  const grad = shareCtx.createLinearGradient(0, height * 0.5, 0, height);
  grad.addColorStop(0, "rgba(15, 14, 12, 0)");
  grad.addColorStop(1, "rgba(15, 14, 12, 0.85)");
  shareCtx.fillStyle = grad;
  shareCtx.fillRect(0, height * 0.5, width, height * 0.5);

  // 4. Renders central card
  const cardW = 860;
  const cardH = 960;
  const cardX = (width - cardW) / 2;
  const cardY = (height - cardH) / 2 - 80;

  shareCtx.fillStyle = "rgba(20, 18, 15, 0.85)";
  shareCtx.strokeStyle = "rgba(232, 220, 192, 0.35)";
  shareCtx.lineWidth = 4;

  const radius = 40;
  shareCtx.beginPath();
  shareCtx.moveTo(cardX + radius, cardY);
  shareCtx.arcTo(cardX + cardW, cardY, cardX + cardW, cardY + cardH, radius);
  shareCtx.arcTo(cardX + cardW, cardY + cardH, cardX, cardY + cardH, radius);
  shareCtx.arcTo(cardX, cardY + cardH, cardX, cardY, radius);
  shareCtx.arcTo(cardX, cardY, cardX + cardW, cardY, radius);
  shareCtx.closePath();
  shareCtx.fill();
  shareCtx.stroke();

  // 5. Title
  shareCtx.fillStyle = "#e8dcc0";
  shareCtx.font = "bold 78px system-ui, -apple-system, sans-serif";
  shareCtx.textAlign = "center";
  shareCtx.fillText("COLA RUNNER", width / 2, cardY + 160);

  shareCtx.fillStyle = "#b8b1a3";
  shareCtx.font = "bold 32px system-ui, -apple-system, sans-serif";
  shareCtx.fillText("MINHA PONTUAÇÃO", width / 2, cardY + 220);

  // 6. Score (using sprites if feature flag is enabled)
  const scoreStr = `${game.meters}m`;

  if (CONFIG.features.useSpriteScore && areNumberSpritesReady()) {
    const digitH = 165;
    const gap = 8;

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

    let startX = (width - totalW) / 2;
    const topY = cardY + 310;

    for (let i = 0; i < scoreStr.length; i++) {
      const char = scoreStr[i];
      const sprite = NUMBER_SPRITES[char];
      if (sprite && sprite.img) {
        const isM = char === "m";
        const h = isM ? Math.round(digitH * 0.72) : digitH;
        const charW = Math.round(h * sprite.ratio);
        const drawYPos = isM ? topY + (digitH - h) : topY;
        shareCtx.drawImage(sprite.img, startX, drawYPos, charW, h);
        startX += charW + gap;
      }
    }
  } else {
    shareCtx.fillStyle = "#f5f1e8";
    shareCtx.font = "bold 180px system-ui, -apple-system, sans-serif";
    shareCtx.textAlign = "center";
    shareCtx.fillText(`${game.meters}m`, width / 2, cardY + 430);
  }

  // 7. Character
  const activeChar = CHARACTER_SPRITES.find((c) => c.id === game.selectedCharId);
  if (activeChar && activeChar.ready && activeChar.img) {
    const charH = 240;
    const charW = charH * activeChar.ratio;
    const charX = (width - charW) / 2;
    const charY = cardY + 540;
    shareCtx.drawImage(activeChar.img, charX, charY, charW, charH);
  }

  // 8. Footer / Sticker
  shareCtx.fillStyle = "#e8dcc0";
  shareCtx.font = "bold 46px system-ui, -apple-system, sans-serif";
  shareCtx.fillText("@_cola_em_mim", width / 2, height - 240);

  shareCtx.fillStyle = "#b8b1a3";
  shareCtx.font = "32px system-ui, -apple-system, sans-serif";
  shareCtx.fillText("Jogue você também!", width / 2, height - 180);

  // 9. Share
  shareCanvas.toBlob((blob) => {
    if (!blob) return;
    shareBlob(blob);
  }, "image/png");
}

async function shareBlob(blob: Blob): Promise<void> {
  // Naming the file with Instagram handle helps iOS/Android prioritize Instagram in share sheet
  const file = new File([blob], `cola-runner-@_cola_em_mim-${game.meters}m.png`, { type: "image/png" });

  // Path 1 — Web Share API with image file (iOS Safari 15+, Android Chrome)
  // Sending pure image file allows native share sheet to identify media type
  // and position Instagram / Instagram Stories at top of recommendations.
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: "Cola Runner @_cola_em_mim",
      });
      return; // success
    } catch (error) {
      // User canceled picker - no-op
      if ((error as Error).name === "AbortError") return;
      // Unexpected error - fallback to download below
    }
  }

  // Path 2 — Fallback: download + instructions (desktop or unsupported browsers)
  const url = URL.createObjectURL(blob);
  const downloadAnchor = document.createElement("a");
  downloadAnchor.href = url;
  downloadAnchor.download = file.name;
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  document.body.removeChild(downloadAnchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showShareToast("Imagem baixada! Abra o Instagram, vá em Stories e escolha a imagem da galeria.");
}

function showShareToast(message: string): void {
  const previousToast = document.getElementById("share-toast");
  if (previousToast) previousToast.remove();

  const toast = document.createElement("div");
  toast.id = "share-toast";
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("visible"));
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 350);
  }, 6000);
}

// --- Input ---
function jump(event: Event): void {
  event.preventDefault();
  game.handleInput();
}
canvas.addEventListener("pointerdown", jump);
window.addEventListener("keydown", (event) => {
  if (event.code === "Space" || event.code === "ArrowUp") jump(event);
});

// --- Leaderboard Helpers ---
let lastScreenBeforeLeaderboard: "select-character" | "dead" = "select-character";

const nameInput = document.getElementById("player-name-input") as HTMLInputElement;
const confirmNameBtn = document.getElementById("confirm-name-btn") as HTMLButtonElement;
const readyPlayerNameEl = document.getElementById("ready-player-name")!;

function validateNameInput(value: string): void {
  if (confirmNameBtn) {
    confirmNameBtn.disabled = value.trim().length < 3;
  }
}

nameInput?.addEventListener("input", () => {
  validateNameInput(nameInput.value);
});

nameInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && confirmNameBtn && !confirmNameBtn.disabled) {
    confirmNameBtn.click();
  }
});

function updateReadyScreenName(): void {
  if (readyPlayerNameEl) {
    readyPlayerNameEl.textContent = getPlayerName() || "Convidado";
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Optimistically merges active player's local score into leaderboard list.
 * Ensures player sees their best score immediately before server confirmation.
 */
function mergeActivePlayerScore(data: LeaderboardEntry[]): LeaderboardEntry[] {
  const activeName = getPlayerName().trim();
  if (!activeName || activeName.toLowerCase() === "convidado") return data;

  const activeBest = getBestScoreForName(activeName);
  if (activeBest <= 0) return data;

  const merged = [...data];
  const existingIdx = merged.findIndex(
    (entry) => entry.name.toLowerCase() === activeName.toLowerCase()
  );
  if (existingIdx !== -1) {
    if (activeBest > merged[existingIdx].score) {
      merged[existingIdx].score = activeBest;
    }
  } else {
    merged.push({ name: activeName, score: activeBest });
  }

  merged.sort((a, b) => b.score - a.score);
  return merged.slice(0, 10);
}

/**
 * Renders leaderboard rows in DOM.
 */
function renderLeaderboardRows(data: LeaderboardEntry[]): void {
  const statusEl = document.getElementById("leaderboard-status")!;
  const listEl = document.getElementById("leaderboard-list")!;
  if (!statusEl || !listEl) return;

  if (data.length === 0) {
    statusEl.hidden = false;
    statusEl.textContent = "Nenhuma pontuação registrada ainda.";
    listEl.hidden = true;
    return;
  }

  const activeNameLower = getPlayerName().trim().toLowerCase();

  listEl.innerHTML = "";
  data.forEach((entry, index) => {
    const row = document.createElement("div");
    row.className = "leaderboard-row";
    if (entry.name.toLowerCase() === activeNameLower && activeNameLower !== "convidado") {
      row.classList.add("highlight-player");
    }

    row.innerHTML = `
      <span class="rank">#${index + 1}</span>
      <span class="name">${escapeHtml(entry.name)}</span>
      <span class="score-val">${entry.score}m</span>
    `;
    listEl.appendChild(row);
  });

  statusEl.hidden = true;
  listEl.hidden = false;
}

/**
 * Loads and renders leaderboard.
 *
 * Always fetches fresh data from Google Sheets, showing loading state while fetching.
 * Merges active player's score optimistically via mergeActivePlayerScore().
 */
async function loadAndRenderLeaderboard(): Promise<void> {
  const statusEl = document.getElementById("leaderboard-status")!;
  const listEl = document.getElementById("leaderboard-list")!;

  if (!statusEl || !listEl) return;

  // Shows loading state while fetching fresh data
  statusEl.hidden = false;
  statusEl.textContent = "Carregando placar...";
  listEl.hidden = true;

  try {
    const data = await fetchLeaderboard();
    renderLeaderboardRows(mergeActivePlayerScore(data));
  } catch (error) {
    statusEl.textContent = "Erro ao carregar o placar.";
    statusEl.hidden = false;
    listEl.hidden = true;
  }
}

// Button handlers & zero-friction restart
ui.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;

  if (action === "confirm-name") {
    if (nameInput) {
      const name = nameInput.value.trim();
      if (name.length >= 3) {
        setPlayerName(name);
        updateReadyScreenName();
        game.best = getBestScoreForName(name);
        showScreen("select-character");
        renderCharacters();
      }
    }
    return;
  }

  if (action === "play-guest") {
    setPlayerName("Convidado");
    updateReadyScreenName();
    game.best = getBestScoreForName("Convidado");
    showScreen("select-character");
    renderCharacters();
    return;
  }

  if (action === "show-identification") {
    showScreen("identification");
    if (nameInput) {
      const currentName = getPlayerName();
      nameInput.value = currentName === "Convidado" ? "" : currentName;
      validateNameInput(nameInput.value);
      setTimeout(() => nameInput.focus(), 50);
    }
    return;
  }

  if (action === "view-leaderboard") {
    lastScreenBeforeLeaderboard = game.state === "dead" ? "dead" : "select-character";
    showScreen("leaderboard");
    loadAndRenderLeaderboard();
    return;
  }

  if (action === "back-to-menu") {
    showScreen(lastScreenBeforeLeaderboard);
    return;
  }

  if (action === "change-character") {
    game.resetToMenu();
    showScreen("select-character");
    renderCharacters();
    return;
  }

  if (action === "share-instagram") {
    shareInstagram();
    return;
  }

  if (action === "start" || action === "restart") {
    game.start();
    return;
  }

  // Tapping anywhere on game over screen (except CTA links / share options) restarts game
  if (
    game.state === "dead" &&
    !target.closest('[data-bind="ig-link"]') &&
    !target.closest('[data-action="change-character"]') &&
    !target.closest('[data-action="share-instagram"]') &&
    !target.closest('[data-action="view-leaderboard"]') &&
    !target.closest(".share-bg-option")
  ) {
    game.start();
  }
});

// Leaderboard flow initialization
const initialName = getPlayerName();
updateReadyScreenName();
if (initialName) {
  initializePlayerRecord(initialName);
}
game.best = getBestScoreForName(initialName);

game.resetToMenu();
showScreen("identification");
if (nameInput) {
  nameInput.value = initialName === "Convidado" ? "" : initialName;
  validateNameInput(nameInput.value);
}

// --- Fixed Timestep Loop (stable physics across any FPS) ---
const STEP = 1 / 120; // physics step duration
let accumulator = 0;
let lastTime = performance.now();

function frame(now: number): void {
  let deltaTime = (now - lastTime) / 1000;
  lastTime = now;
  if (deltaTime > 0.25) deltaTime = 0.25; // prevents "spiral of death" after background tab throttling

  accumulator += deltaTime;
  while (accumulator >= STEP) {
    game.update(STEP);
    accumulator -= STEP;
  }

  // Fills entire canvas with background color to eliminate black bars on any aspect ratio
  ctx.fillStyle = "#0f0e0c";
  ctx.fillRect(0, 0, canvasW, canvasH);

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  game.render(ctx);
  ctx.restore();

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);


