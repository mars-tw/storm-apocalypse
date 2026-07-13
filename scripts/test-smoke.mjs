import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("..", import.meta.url));
const url = process.env.SMOKE_URL ?? "http://127.0.0.1:4173/storm-apocalypse/?smoke=1";
const saveKey = "storm-apocalypse-save-v1";
const scenarioFilter = process.env.SMOKE_SCENARIO;
const loadTimeout = 180_000;
const screenshotDir = process.env.SMOKE_SCREENSHOT_DIR;
const captureOnly = process.env.SMOKE_CAPTURE_ONLY === "1";
const results = [];
let server;

function fixture() {
  return {
    version: 2,
    money: 9999,
    wave: 14,
    stallLevel: 4,
    towerBuilt: false,
    bestWave: 14,
    weapon: "axe",
    employees: { hunter: false, cashier: false, dog: false },
    pasture2Unlocked: true,
    towers: { ballista: 0, frost: 1, cannon: 0 },
    quest: {
      chapter: 15,
      completed: Array.from({ length: 14 }, (_, index) => index + 1),
      unlocks: ["stall-guide", "defense-shop", "employee-shop", "strong-cattle", "tower-upgrade", "automation", "repair", "final-alert"],
      loop: null,
    },
    stats: {
      pastureVisited: true,
      cowsKilled: 1,
      meatCollected: 3,
      meatDeposited: 3,
      sales: 1,
      totalEarned: 9999,
      zombiesKilled: 0,
      playerKills: 0,
      towerKills: 0,
      damageDealt: 0,
      damageTaken: 0,
      wavesCleared: 14,
      campaignWins: 0,
    },
    lastSavedAt: 0,
  };
}

async function reachable() {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (await reachable()) return;
  server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "4173", "--strictPort"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (await reachable()) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Vite smoke server did not become ready.");
}

function record(viewport, check, pass, detail) {
  const result = { viewport, check, pass, detail };
  results.push(result);
  console.log(`${pass ? "PASS" : "FAIL"} [${viewport}] ${check} — ${detail}`);
}

function overlaps(a, b) {
  if (!a || !b) return false;
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

async function newPage(browser, config) {
  const context = await browser.newContext({
    viewport: config.viewport,
    hasTouch: config.touch,
    isMobile: config.touch,
    deviceScaleFactor: 1,
    userAgent: config.touch
      ? "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/125 Mobile Safari/537.36"
      : undefined,
  });
  await context.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: saveKey, value: fixture() });
  const page = await context.newPage();
  const consoleErrors = [];
  const networkErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("requestfailed", (request) => networkErrors.push(`${request.url()}: ${request.failure()?.errorText ?? "failed"}`));
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: loadTimeout });
    await page.locator("#start-button").waitFor({ state: "visible", timeout: loadTimeout });
    await page.waitForFunction(() => !document.querySelector("#start-button")?.hasAttribute("disabled"), undefined, { timeout: loadTimeout });
    await page.locator("#start-button").click();
    await page.locator("#intro").waitFor({ state: "detached", timeout: 15_000 });
    const screenshotPath = screenshotDir && !captureOnly ? await captureScreenshot(page, config) : undefined;
    return { context, page, consoleErrors, screenshotPath };
  } catch (error) {
    const loadingText = await page.locator("#loading-text").textContent().catch(() => null);
    await context.close();
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error([
      detail,
      loadingText ? `loader: ${loadingText}` : "",
      consoleErrors.length ? `console: ${consoleErrors.join(" | ")}` : "",
      networkErrors.length ? `network: ${networkErrors.slice(0, 4).join(" | ")}` : "",
    ].filter(Boolean).join(" | "));
  }
}

async function captureScreenshot(page, config) {
  if (!screenshotDir) return undefined;
  const directory = resolve(root, screenshotDir);
  await mkdir(directory, { recursive: true });
  const screenshotPath = resolve(directory, `${config.viewport.width}x${config.viewport.height}.png`);
  await page.screenshot({ path: screenshotPath, timeout: 120_000 });
  return screenshotPath;
}

async function readSave(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), saveKey);
}

async function holdKey(page, key, duration) {
  await page.keyboard.down(key);
  await page.waitForTimeout(duration);
  await page.keyboard.up(key);
}

async function moveNorthUntil(page, touch, label) {
  let joystickBox;
  if (touch) {
    joystickBox = await page.locator(".joystick").boundingBox();
    assert(joystickBox, "joystick has no bounding box");
    const center = { x: joystickBox.x + joystickBox.width / 2, y: joystickBox.y + joystickBox.height / 2 };
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.mouse.move(center.x, center.y - joystickBox.height * 0.34);
  } else {
    await page.keyboard.down("w");
  }
  const deadline = Date.now() + 30_000;
  let z = Number(await page.locator("#game-canvas").getAttribute("data-player-z"));
  try {
    while (z < 7 && Date.now() < deadline) {
      await page.waitForTimeout(400);
      z = Number(await page.locator("#game-canvas").getAttribute("data-player-z"));
    }
  } finally {
    if (touch) await page.mouse.up();
    else await page.keyboard.up("w");
  }
  record(label, `${touch ? "joystick" : "keyboard"} reaches firing position`, z >= 7, `playerZ=${z.toFixed(2)}`);
}

async function holdAttack(page, touch, duration) {
  if (!touch) return holdKey(page, "Space", duration);
  const box = await page.locator("#attack-button").boundingBox();
  assert(box, "attack button has no bounding box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(40);
  const pressed = await page.locator("#attack-button").evaluate((button) => button.classList.contains("is-pressed"));
  record("390×844", "attack pressed state", pressed, `is-pressed=${pressed}`);
  await page.waitForTimeout(duration - 40);
  await page.mouse.up();
}

async function attackCount(page) {
  return Number(await page.locator("#game-canvas").getAttribute("data-attack-count"));
}

async function buySmg(page, touch) {
  if (touch) await page.locator("#shop-toggle").click();
  const smg = page.locator('[data-category="weapon"][data-id="smg"]');
  const unlocked = await smg.isEnabled();
  record(touch ? "390×844" : "1440×900", "Ch14 save unlocks SMG", unlocked, `enabled=${unlocked}`);
  if (unlocked) await smg.click();
  if (touch) await page.locator("#shop-close").click();
  const save = await readSave(page);
  const equipped = save?.weapon === "smg" && save?.money === 9639;
  record(touch ? "390×844" : "1440×900", "buy and equip SMG", equipped, `weapon=${save?.weapon}, money=${save?.money}`);
}

async function checkTouchLayout(page, label) {
  const toggle = page.locator("#shop-toggle");
  const toggleBox = await toggle.boundingBox();
  assert(toggleBox, "shop toggle has no bounding box");
  await page.mouse.move(toggleBox.x + toggleBox.width / 2, toggleBox.y + toggleBox.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(30);
  const immediateOpen = await page.locator("#command-panel").evaluate((panel) => panel.classList.contains("is-open"));
  record(label, "panel responds on pointerdown", immediateOpen, `open-before-pointerup=${immediateOpen}`);
  await page.mouse.up();
  await page.addStyleTag({ content: ".quest-panel,.command-panel{transition:none!important}" });
  await page.waitForTimeout(50);

  const panelBox = await page.locator("#command-panel").boundingBox();
  const joystickBox = await page.locator(".joystick").boundingBox();
  const attackBox = await page.locator("#attack-button").boundingBox();
  const noOverlap = !overlaps(panelBox, joystickBox) && !overlaps(panelBox, attackBox);
  record(label, "open panel avoids control hot zones", noOverlap, JSON.stringify({ panelBox, joystickBox, attackBox }));

  const probe = label === "390×844" ? { x: 20, y: 400 } : { x: 400, y: 200 };
  await page.evaluate(() => {
    window.__smokeCanvasPresses = 0;
    document.querySelector("#game-canvas")?.addEventListener("pointerdown", () => { window.__smokeCanvasPresses += 1; });
  });
  await page.mouse.click(probe.x, probe.y);
  const whileOpen = await page.evaluate(() => window.__smokeCanvasPresses);
  record(label, "open panel blocks gameplay", whileOpen === 0, `canvas-pointerdown=${whileOpen}`);

  if (await page.locator("#command-panel").evaluate((panel) => panel.classList.contains("is-open"))) {
    await page.locator("#shop-close").click();
  }
  await page.mouse.click(probe.x, probe.y);
  const afterClose = await page.evaluate(() => window.__smokeCanvasPresses);
  record(label, "closed panel restores gameplay", afterClose === 1, `canvas-pointerdown=${afterClose}`);

  const hits = await page.evaluate(() => {
    const hit = (selector) => {
      const element = document.querySelector(selector);
      const box = element?.getBoundingClientRect();
      if (!box) return false;
      const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return Boolean(top?.closest(selector));
    };
    return { joystick: hit(".joystick"), attack: hit("#attack-button") };
  });
  record(label, "closed control hit targets", hits.joystick && hits.attack, JSON.stringify(hits));
}

async function runCombat(browser, config) {
  const label = `${config.viewport.width}×${config.viewport.height}`;
  const { context, page, consoleErrors, screenshotPath } = await newPage(browser, config);
  try {
    if (captureOnly) {
      if (config.touch) await page.locator("#wave-button").click();
      else await page.keyboard.press("n");
      await page.waitForFunction(() => document.querySelector("#hud-wave")?.textContent?.includes("夜襲"), undefined, { timeout: 15_000 });
      await page.waitForTimeout(3_500);
      const capturedPath = await captureScreenshot(page, config);
      const canvas = page.locator("#game-canvas");
      const quality = await canvas.getAttribute("data-quality");
      const renderScale = await canvas.getAttribute("data-render-scale");
      const shadowMode = await canvas.getAttribute("data-shadow-mode");
      const fogDensity = await canvas.getAttribute("data-fog-density");
      record(label, "visual capture", Boolean(capturedPath), `quality=${quality}, renderScale=${renderScale}, shadow=${shadowMode}, fog=${fogDensity}`);
      return;
    }
    if (config.touch) await checkTouchLayout(page, label);
    await buySmg(page, config.touch);
    const before = await readSave(page);

    const attacksBeforeCow = await attackCount(page);
    await holdAttack(page, config.touch, 3_000);
    await page.waitForTimeout(120);
    const attacksAfterCow = await attackCount(page);
    record(label, `${config.touch ? "touch" : "keyboard"} SMG responds immediately`, attacksAfterCow > attacksBeforeCow, `attacks ${attacksBeforeCow}→${attacksAfterCow}`);
    const afterCow = await readSave(page);
    record(label, `${config.touch ? "touch" : "keyboard"} SMG damages cow`, afterCow.stats.cowsKilled > before.stats.cowsKilled, `cowsKilled ${before.stats.cowsKilled}→${afterCow.stats.cowsKilled}`);

    await moveNorthUntil(page, config.touch, label);
    if (config.touch) await page.locator("#wave-button").click();
    else await page.keyboard.press("n");
    await page.waitForTimeout(3_000);
    const waveText = await page.locator("#hud-wave").innerText();
    const waveStarted = waveText.includes("夜襲");
    record(label, "wave starts", waveStarted, waveText);
    if (!waveStarted) {
      record(label, "console errors", consoleErrors.length === 0, consoleErrors.join(" | ") || "0 errors");
      return;
    }
    await page.waitForFunction(() => Number(document.querySelector("#game-canvas")?.dataset.activeZombies) > 0, undefined, { timeout: 15_000 });
    const attacksBeforeZombie = await attackCount(page);
    await holdAttack(page, config.touch, 8_000);
    await page.waitForTimeout(150);
    const attacksAfterZombie = await attackCount(page);
    record(label, `${config.touch ? "touch" : "keyboard"} SMG hold repeats`, attacksAfterZombie - attacksBeforeZombie >= 2, `attacks ${attacksBeforeZombie}→${attacksAfterZombie}`);
    const livePlayerKills = Number(await page.locator("#game-canvas").getAttribute("data-player-kills"));
    record(label, `${config.touch ? "touch" : "keyboard"} SMG damages zombie`, livePlayerKills > before.stats.playerKills, `playerKills ${before.stats.playerKills}→${livePlayerKills}`);
    record(label, "console errors", consoleErrors.length === 0, consoleErrors.join(" | ") || "0 errors");
  } finally {
    await context.close();
  }
}

async function runLayout(browser, viewport) {
  const label = `${viewport.width}×${viewport.height}`;
  const config = { viewport, touch: true };
  const { context, page, consoleErrors } = await newPage(browser, config);
  try {
    if (captureOnly) {
      await page.locator("#wave-button").click();
      await page.waitForFunction(() => document.querySelector("#hud-wave")?.textContent?.includes("夜襲"), undefined, { timeout: 15_000 });
      await page.waitForTimeout(3_500);
      const screenshotPath = await captureScreenshot(page, config);
      record(label, "visual capture", Boolean(screenshotPath), screenshotPath ?? "no screenshot");
      return;
    }
    await checkTouchLayout(page, label);
    record(label, "console errors", consoleErrors.length === 0, consoleErrors.join(" | ") || "0 errors");
  } finally {
    await context.close();
  }
}

try {
  await ensureServer();
  const browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader"] });
  try {
    for (const scenario of [
      ["1440×900", () => runCombat(browser, { viewport: { width: 1440, height: 900 }, touch: false })],
      ["390×844", () => runCombat(browser, { viewport: { width: 390, height: 844 }, touch: true })],
      ["844×390", () => runLayout(browser, { width: 844, height: 390 })],
    ]) {
      if (scenarioFilter && scenario[0] !== scenarioFilter) continue;
      try {
        await scenario[1]();
      } catch (error) {
        record(scenario[0], "scenario completes", false, error instanceof Error ? error.message : String(error));
      }
    }
  } finally {
    await browser.close();
  }
} finally {
  server?.kill();
}

const failures = results.filter((result) => !result.pass);
console.log(`\n${results.length - failures.length}/${results.length} checks passed; ${failures.length} failed.`);
if (failures.length > 0) process.exitCode = 1;
