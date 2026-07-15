import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { checkPortraitLuminance } from "./check-portrait-luminance.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const url = process.env.SMOKE_URL ?? "http://127.0.0.1:4173/storm-apocalypse/?smoke=1";
const qualityUrl = new URL(url);
qualityUrl.searchParams.delete("smoke");
const saveKey = "storm-apocalypse-save-v1";
const scenarioFilter = process.env.SMOKE_SCENARIO;
const heroOnly = scenarioFilter === "heroes";
const loadTimeout = 180_000;
const screenshotDir = process.env.SMOKE_SCREENSHOT_DIR;
const captureOnly = process.env.SMOKE_CAPTURE_ONLY === "1";
const headedOnly = process.argv.includes("--headed") || process.env.SMOKE_HEADED === "1";
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
    weapons: { machete: true, axe: true, smg: false },
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

function edgeGap(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const dx = Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width), 0);
  const dy = Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height), 0);
  return Math.hypot(dx, dy);
}

async function runWithRetry(action, attempts = 2) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  }
  throw lastError;
}

async function readGlbMetadata(relative) {
  const glb = await readFile(resolve(root, relative));
  const jsonLength = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString("utf8").trimEnd());
  const triangles = (json.meshes ?? []).reduce((total, mesh) => total + mesh.primitives.reduce((meshTotal, primitive) => {
    const accessor = primitive.indices === undefined ? primitive.attributes?.POSITION : primitive.indices;
    return meshTotal + (accessor === undefined ? 0 : Math.floor((json.accessors?.[accessor]?.count ?? 0) / 3));
  }, 0), 0);
  return {
    triangles,
    clips: (json.animations ?? []).map((animation) => animation.name),
    bones: json.skins?.[0]?.joints?.length ?? 0,
    nodes: (json.nodes ?? []).map((node) => node.name ?? ""),
    forwardRoots: (json.nodes ?? [])
      .filter((node) => /^Npc.+R10$/u.test(node.name ?? ""))
      .map((node) => ({ name: node.name, rotation: node.rotation ?? [0, 0, 0, 1] })),
  };
}

async function checkR8Assets() {
  const files = [
    "public/images/ui/atlas/ui-atlas-low.png",
    "public/images/ui/atlas/ui-atlas-medium.png",
    "public/images/ui/atlas/ui-atlas-high.png",
    "public/images/ui/background/menu-background.png",
    "public/images/ui/chrome/panel-9s.png",
    "public/images/ui/chrome/button-9s.png",
    "public/images/characters/protagonist-butcher-matron.png",
    "public/images/characters/protagonist-vet-sniper.png",
    "public/images/characters/protagonist-mech-youth.png",
  ];
  const details = [];
  let valid = true;
  for (const relative of files) {
    try {
      const path = resolve(root, relative);
      const info = await stat(path);
      const data = await readFile(path);
      const png = data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const width = png ? data.readUInt32BE(16) : 0;
      const height = png ? data.readUInt32BE(20) : 0;
      const itemValid = info.size > 2_048 && width >= 128 && height >= 128;
      valid &&= itemValid;
      details.push(`${relative.split("/").at(-1)}=${width}x${height}/${info.size}B`);
    } catch (error) {
      valid = false;
      details.push(`${relative}=missing:${error instanceof Error ? error.message : String(error)}`);
    }
  }
  try {
    const preset = JSON.parse(await readFile(resolve(root, "public/images/ui/render-preset-r8.json"), "utf8"));
    const palettes = preset.preset?.characterPalettes ?? {};
    const paletteValid = ["butcher_matron", "vet_sniper", "mech_youth"].every((id) => palettes[id]?.main?.length === 3 && palettes[id]?.accent);
    valid &&= paletteValid && preset.preset?.surfaceResponse?.metal?.metallic > 0 && preset.preset?.surfaceResponse?.cloth?.metallic === 0;
    details.push(`preset=R8/palettes:${Object.keys(palettes).length}`);
  } catch (error) {
    valid = false;
    details.push(`render-preset-r8.json=missing:${error instanceof Error ? error.message : String(error)}`);
  }

  const heroSpecs = [
    ["butcher", "public/models/custom/characters/protagonist-butcher-matron.glb"],
    ["sniper", "public/models/custom/characters/protagonist-vet-sniper.glb"],
    ["mechanic", "public/models/custom/characters/protagonist-mech-youth.glb"],
  ];
  for (const [name, path] of heroSpecs) {
    try {
      const meta = await readGlbMetadata(path);
      const expected = ["attack_melee", "attack_ranged", "idle", "run"];
      const itemValid = meta.triangles >= 3_000 && meta.triangles <= 6_000 && meta.bones === 18 && expected.every((clip) => meta.clips.includes(clip));
      valid &&= itemValid;
      details.push(`${name}=${meta.triangles}tris/${meta.bones}bones/${meta.clips.length}clips`);
    } catch (error) {
      valid = false;
      details.push(`${name}=invalid:${error instanceof Error ? error.message : String(error)}`);
    }
  }

  for (const variant of ["ash", "frost", "rust"]) {
    try {
      const meta = await readGlbMetadata(`public/models/custom/zombies/zombie-${variant}.glb`);
      const expected = ["Walk", "Idle_Attack", "HitReact", "Death"];
      const itemValid = meta.triangles >= 1_200 && meta.triangles <= 2_500 && expected.every((clip) => meta.clips.includes(clip));
      valid &&= itemValid;
      details.push(`zombie-${variant}=${meta.triangles}tris/${meta.clips.length}clips`);
    } catch (error) {
      valid = false;
      details.push(`zombie-${variant}=invalid:${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const npcProps = {
    "npc-lao-zhou.glb": ["LaoZhouConicalHat", "LaoZhouPipeStem"],
    "npc-nurse-lin.glb": ["NurseLinMedicalBag"],
    "npc-kid-bao.glb": ["KidBaoOversizeBackpack"],
    "npc-scout-he.glb": ["ScoutHeBinocularL"],
  };
  for (const [file, props] of Object.entries(npcProps)) {
    try {
      const meta = await readGlbMetadata(`public/models/custom/characters/${file}`);
      const itemValid = meta.bones === 18 && ["Idle", "Walk"].every((clip) => meta.clips.includes(clip)) && props.every((prop) => meta.nodes.some((node) => node.includes(prop)));
      valid &&= itemValid;
      details.push(`${file}=${meta.bones}bones/${meta.clips.join("+")}/${props.join("+")}`);
    } catch (error) {
      valid = false;
      details.push(`${file}=invalid:${error instanceof Error ? error.message : String(error)}`);
    }
  }

  record("assets/R8", "R8 character art, palettes and animation assets satisfy the shipping contract", valid, details.join(", "));

  try {
    const meta = await readGlbMetadata("public/models/custom/boss-zombie.glb");
    const clips = meta.clips;
    const expected = ["Walk", "Idle_Attack", "HitReact", "Death"];
    record("animation/R8", "Boss stays within budget and has walk, attack, hurt and death clips", meta.triangles <= 8_000 && meta.triangles >= 2_500 && expected.every((clip) => clips.includes(clip)), `tris=${meta.triangles}, clips=${clips.join(",")}`);
  } catch (error) {
    record("animation/R8", "Boss stays within budget and has walk, attack, hurt and death clips", false, error instanceof Error ? error.message : String(error));
  }
}

async function checkR10Assets() {
  const specs = [
    ["hunter", "public/models/custom/characters/staff-hunter.glb", 18, ["idle", "walk", "run", "attack"]],
    ["cashier", "public/models/custom/characters/staff-cashier.glb", 18, ["idle", "walk", "run"]],
    ["customer-traveler", "public/models/custom/characters/customer-traveler.glb", 18, ["idle", "walk", "run"]],
    ["customer-forager", "public/models/custom/characters/customer-forager.glb", 18, ["idle", "walk", "run"]],
    ["customer-refugee", "public/models/custom/characters/customer-refugee.glb", 18, ["idle", "walk", "run"]],
    ["shepherd-dog", "public/models/custom/characters/staff-shepherd-dog.glb", 19, ["idle", "walk", "run"]],
  ];
  const details = [];
  let valid = true;
  for (const [name, path, bones, clips] of specs) {
    try {
      const meta = await readGlbMetadata(path);
      const forward = meta.forwardRoots[0]?.rotation ?? [];
      const forwardValid = forward.length === 4
        && Math.abs(forward[0]) < 0.01
        && Math.abs(Math.abs(forward[1]) - 1) < 0.01
        && Math.abs(forward[2]) < 0.01
        && Math.abs(forward[3]) < 0.01;
      const itemValid = meta.triangles >= 3_000
        && meta.triangles <= 4_000
        && meta.bones === bones
        && clips.every((clip) => meta.clips.includes(clip))
        && forwardValid;
      valid &&= itemValid;
      details.push(`${name}=${meta.triangles}tris/${meta.bones}bones/${meta.clips.join("+")}/root180=${forwardValid}`);
    } catch (error) {
      valid = false;
      details.push(`${name}=invalid:${error instanceof Error ? error.message : String(error)}`);
    }
  }
  record("assets/R10", "staff, customer variants and articulated dog meet the R10 geometry, clip and forward contract", valid, details.join(", "));

  try {
    const meta = await readGlbMetadata("public/models/custom/strong-cow-accessories.glb");
    const authoredParts = ["StrongCowHornBaseL", "StrongCowHornBaseR", "StrongCowEmberCollar"];
    const itemValid = meta.triangles > 0
      && meta.triangles <= 800
      && meta.clips.length === 0
      && authoredParts.every((part) => meta.nodes.some((node) => node.includes(part)));
    record("assets/R10", "strong-cow horns and emissive collar ship as an authored Blender GLB", itemValid, `tris=${meta.triangles}, parts=${authoredParts.join("+")}`);
  } catch (error) {
    record("assets/R10", "strong-cow horns and emissive collar ship as an authored Blender GLB", false, error instanceof Error ? error.message : String(error));
  }

  try {
    const source = await readFile(resolve(root, "src/game/StormGame.ts"), "utf8");
    const legacyTokens = ["survivor.glb", "customer.glb", "createProceduralDog", "strong-cow-horn-material", "strong-cow-ember-collar"];
    const expectedModels = ["staff-hunter.glb", "staff-cashier.glb", "staff-shepherd-dog.glb", "strong-cow-accessories.glb"];
    const itemValid = legacyTokens.every((token) => !source.includes(token)) && expectedModels.every((token) => source.includes(token));
    record("wiring/R10", "runtime uses only authored R10 staff, dog and strong-cow accessory assets", itemValid, `legacy=${legacyTokens.filter((token) => source.includes(token)).join("+") || "none"}`);
  } catch (error) {
    record("wiring/R10", "runtime uses only authored R10 staff, dog and strong-cow accessory assets", false, error instanceof Error ? error.message : String(error));
  }
}

async function checkControlSpacing(page, label) {
  const selectors = ["#quest-toggle", "#shop-toggle", ".joystick", ".tower-dock", "#wave-button", "#weapon-button", "#attack-button"];
  const controls = [];
  for (const selector of selectors) {
    const locator = page.locator(selector);
    if (await locator.isVisible()) controls.push({ selector, box: await locator.boundingBox() });
  }
  const pairs = [];
  let valid = true;
  for (let left = 0; left < controls.length; left += 1) {
    for (let right = left + 1; right < controls.length; right += 1) {
      const a = controls[left];
      const b = controls[right];
      const gap = edgeGap(a.box, b.box);
      pairs.push(`${a.selector}/${b.selector}=${gap.toFixed(1)}px`);
      valid &&= !overlaps(a.box, b.box) && gap >= 8;
    }
  }
  record(label, "visible buttons do not overlap and keep 8px spacing", valid, pairs.join(", "));
}

async function measureR11Controls(page, config, consoleErrors) {
  const selectors = [
    { name: "tower-ballista", selector: '[data-tower-dock="ballista"]' },
    { name: "tower-frost", selector: '[data-tower-dock="frost"]' },
    { name: "tower-cannon", selector: '[data-tower-dock="cannon"]' },
    { name: "wave", selector: "#wave-button" },
    { name: "weapon", selector: "#weapon-button" },
    { name: "attack", selector: "#attack-button" },
  ];
  const result = await page.evaluate((items) => {
    const rectData = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: Number(rect.left.toFixed(1)),
        top: Number(rect.top.toFixed(1)),
        right: Number(rect.right.toFixed(1)),
        bottom: Number(rect.bottom.toFixed(1)),
        width: Number(rect.width.toFixed(1)),
        height: Number(rect.height.toFixed(1)),
      };
    };
    const controls = items.map((item) => {
      const element = document.querySelector(item.selector);
      if (!element) return { ...item, exists: false, visible: false, minHit: false, centerInViewport: false, hitSelf: false };
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const visible = style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      const centerInViewport = center.x >= 0 && center.x < window.innerWidth && center.y >= 0 && center.y < window.innerHeight;
      const hit = centerInViewport ? document.elementFromPoint(center.x, center.y) : null;
      return {
        ...item,
        exists: true,
        visible,
        rect: rectData(element),
        center: { x: Number(center.x.toFixed(1)), y: Number(center.y.toFixed(1)) },
        minHit: rect.width >= 44 && rect.height >= 44,
        centerInViewport,
        hitSelf: Boolean(hit?.closest(item.selector)),
        hit: hit ? [hit.tagName.toLowerCase(), hit.id, hit.className].filter(Boolean).join("#") : null,
      };
    });
    const joystick = document.querySelector(".joystick");
    const joystickRect = joystick?.getBoundingClientRect();
    const joystickStyle = joystick ? getComputedStyle(joystick) : null;
    const joystickVisible = Boolean(joystick && joystickRect && joystickStyle?.display !== "none" && joystickStyle?.visibility !== "hidden" && joystickRect.width > 0 && joystickRect.height > 0);
    const overlaps = [];
    for (let left = 0; left < controls.length; left += 1) {
      for (let right = left + 1; right < controls.length; right += 1) {
        const a = controls[left];
        const b = controls[right];
        if (!a.rect || !b.rect) continue;
        const overlap = a.rect.left < b.rect.right && a.rect.right > b.rect.left && a.rect.top < b.rect.bottom && a.rect.bottom > b.rect.top;
        if (overlap) overlaps.push(`${a.name}/${b.name}`);
      }
    }
    return { controls, joystickVisible, overlaps, viewport: { width: window.innerWidth, height: window.innerHeight } };
  }, selectors);
  const failures = result.controls.filter((control) => !control.exists || !control.visible || !control.minHit || !control.centerInViewport || !control.hitSelf);
  record(config.label, "bottom control centers stay in viewport and hit themselves", failures.length === 0 && result.overlaps.length === 0, JSON.stringify({ failures, overlaps: result.overlaps, viewport: result.viewport }));
  record(config.label, "desktop does not expose virtual joystick", config.touch || !result.joystickVisible, `joystickVisible=${result.joystickVisible}`);
  record(config.label, "console errors", consoleErrors.length === 0, consoleErrors.join(" | ") || "0 errors");
}

async function checkR11DesktopViewports(page, consoleErrors) {
  const desktopScenarios = [
    { label: "R11 controls 1920x1080", viewport: { width: 1920, height: 1080 }, touch: false },
    { label: "R11 controls 1440x780", viewport: { width: 1440, height: 780 }, touch: false },
    { label: "R11 controls 1366x600", viewport: { width: 1366, height: 600 }, touch: false },
    { label: "R11 controls 1280x640", viewport: { width: 1280, height: 640 }, touch: false },
  ];
  const originalViewport = page.viewportSize();
  try {
    for (const config of desktopScenarios) {
      await page.setViewportSize(config.viewport);
      await page.waitForTimeout(120);
      await measureR11Controls(page, config, consoleErrors);
    }
  } finally {
    if (originalViewport) {
      await page.setViewportSize(originalViewport);
      await page.waitForTimeout(120);
    }
  }
}

async function newPage(browser, config, savedState = fixture()) {
  const context = await browser.newContext({
    viewport: config.viewport,
    hasTouch: config.touch,
    isMobile: false,
    deviceScaleFactor: 1,
    userAgent: config.touch
      ? "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/125 Mobile Safari/537.36"
      : undefined,
  });
  if (savedState) {
    await context.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: saveKey, value: savedState });
  }
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
    try {
      await page.locator("#start-button").click({ timeout: 15_000 });
    } catch {
      await page.evaluate(() => document.querySelector("#start-button")?.click());
    }
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

async function checkQualityDetection(browser, config) {
  const context = await browser.newContext({
    viewport: config.viewport,
    hasTouch: config.touch,
    isMobile: config.mobile,
    deviceScaleFactor: 1,
    userAgent: config.userAgent,
  });
  await context.addInitScript(({ cores, memory }) => {
    Object.defineProperty(navigator, "hardwareConcurrency", { configurable: true, get: () => cores });
    Object.defineProperty(navigator, "deviceMemory", { configurable: true, get: () => memory });
  }, { cores: config.cores, memory: config.memory });
  const page = await context.newPage();
  try {
    await page.goto(qualityUrl.toString(), { waitUntil: "domcontentloaded", timeout: loadTimeout });
    const canvas = page.locator("#game-canvas");
    await canvas.waitFor({ state: "visible", timeout: loadTimeout });
    await page.waitForFunction(() => Boolean(document.querySelector("#game-canvas")?.dataset.quality), undefined, { timeout: loadTimeout });
    const quality = await canvas.getAttribute("data-quality");
    const shadowMode = await canvas.getAttribute("data-shadow-mode");
    const passed = quality === config.expectedQuality && shadowMode === config.expectedShadow;
    record(config.label, "automatic quality", passed, `quality=${quality}, shadow=${shadowMode}, cores=${String(config.cores)}, memory=${String(config.memory)}`);
  } finally {
    await context.close();
  }
}

async function checkInputHints(browser, config) {
  const context = await browser.newContext({
    viewport: config.viewport,
    hasTouch: config.touch,
    isMobile: config.touch,
    deviceScaleFactor: 1,
    userAgent: config.touch
      ? "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/125 Mobile Safari/537.36"
      : undefined,
  });
  if (config.touchscreenDesktop) {
    // 真觸控筆電特徵：主指標 fine（滑鼠）、any-pointer coarse、maxTouchPoints>0
    // Playwright hasTouch 會把主指標也變 coarse，與實機不符，故用覆寫模擬
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "maxTouchPoints", { get: () => 10 });
      const nativeMatchMedia = window.matchMedia.bind(window);
      window.matchMedia = (query) => {
        if (/any-pointer:\s*coarse/.test(query)) return { matches: true, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false };
        return nativeMatchMedia(query);
      };
    });
  }
  await context.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: saveKey, value: fixture() });
  const page = await context.newPage();
  const label = config.touchscreenDesktop
    ? "hints/touchscreen-desktop 1440×900"
    : config.touch ? "hints/mobile 390×844" : "hints/desktop 1440×900";
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: loadTimeout });
    await page.locator("#start-button").waitFor({ state: "visible", timeout: loadTimeout });
    const startHint = await page.locator("#start-button small").innerText();
    const contextHint = await page.locator("#context-prompt").innerText();
    if (config.touch) {
      record(label, "CTA uses touch hint without WASD", !startHint.includes("WASD") && startHint.includes("虛擬搖桿"), startHint);
      record(label, "game prompt uses touch hint without WASD", !contextHint.includes("WASD") && contextHint.includes("虛擬搖桿"), contextHint);
    } else {
      record(label, "CTA keeps desktop WASD hint", startHint.includes("WASD"), startHint);
      record(label, "game prompt keeps desktop WASD hint", contextHint.includes("WASD"), contextHint);
    }
  } finally {
    await context.close();
  }
}

async function checkHeadedWebGl(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await context.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: saveKey, value: fixture() });
  const page = await context.newPage();
  const consoleMessages = [];
  const observedAt = Date.now();
  page.on("console", (message) => {
    if (message.type() === "warning" || message.type() === "error") consoleMessages.push(`+${Date.now() - observedAt}ms ${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => consoleMessages.push(`+${Date.now() - observedAt}ms pageerror: ${error.message}`));
  try {
    await page.goto(qualityUrl.toString(), { waitUntil: "domcontentloaded", timeout: loadTimeout });
    await page.locator("#start-button").waitFor({ state: "visible", timeout: loadTimeout });
    await page.waitForFunction(() => !document.querySelector("#start-button")?.hasAttribute("disabled"), undefined, { timeout: loadTimeout });
    await page.locator("#start-button").evaluate((button) => button.click());
    await page.locator("#intro").waitFor({ state: "detached", timeout: 15_000 });
    await page.waitForTimeout(30_000);

    const canvas = page.locator("#game-canvas");
    const state = {
      quality: await canvas.getAttribute("data-quality"),
      shadow: await canvas.getAttribute("data-shadow-mode"),
      postEffects: await canvas.getAttribute("data-post-effects"),
      performanceTier: await canvas.getAttribute("data-performance-tier"),
      renderScale: await canvas.getAttribute("data-render-scale"),
    };
    const glMessages = consoleMessages.filter((message) => /GL_INVALID|WebGL|glDraw|sampler type|texture format|too many errors/i.test(message));
    const nonGlMessages = consoleMessages.filter((message) => !glMessages.includes(message));
    record(
      "headed Chrome 1440×900",
      "30 seconds produce zero WebGL warnings",
      glMessages.length === 0,
      `browser=${browser.version()}, state=${JSON.stringify(state)}, GL warnings=${glMessages.length}, console warn/error=${consoleMessages.length}${glMessages.length ? `, GL sample=${glMessages.slice(0, 3).join(" | ")}` : ""}${nonGlMessages.length ? `, non-GL sample=${nonGlMessages.slice(0, 3).join(" | ")}` : ""}`,
    );
  } finally {
    await context.close();
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
  if (!touch) {
    await page.keyboard.down("Space");
    await page.waitForFunction(() => document.querySelector("#game-canvas")?.dataset.playerAnimation === "attack_ranged", undefined, { timeout: 15_000 });
    const animation = await page.locator("#game-canvas").getAttribute("data-player-animation");
    await page.waitForTimeout(duration - 100);
    await page.keyboard.up("Space");
    return animation;
  }
  const box = await page.locator("#attack-button").boundingBox();
  assert(box, "attack button has no bounding box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(40);
  const pressed = await page.locator("#attack-button").evaluate((button) => button.classList.contains("is-pressed"));
  record("390×844", "attack pressed state", pressed, `is-pressed=${pressed}`);
  await page.waitForFunction(() => document.querySelector("#game-canvas")?.dataset.playerAnimation === "attack_ranged", undefined, { timeout: 15_000 });
  const animation = await page.locator("#game-canvas").getAttribute("data-player-animation");
  await page.waitForTimeout(duration - 40);
  await page.mouse.up();
  return animation;
}

async function attackCount(page) {
  return Number(await page.locator("#game-canvas").getAttribute("data-attack-count"));
}

async function checkProtagonistSelectionAndAnimations(browser) {
  const protagonists = ["butcher_matron", "vet_sniper", "mech_youth"];
  const context = await browser.newContext({ viewport: { width: 1100, height: 760 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: loadTimeout });
    await page.locator("#start-button").waitFor({ state: "visible", timeout: loadTimeout });
    await page.waitForFunction(() => !document.querySelector("#start-button")?.hasAttribute("disabled"), undefined, { timeout: loadTimeout });
    const cards = page.locator(".character-card[data-protagonist]");
    const cardCount = await cards.count();
    record("hero/selection", "three protagonist choices", cardCount === 3, `cards=${cardCount}`);
    const portraits = await cards.locator("img").evaluateAll((images) => images.map((image) => ({
      complete: image.complete,
      width: image.naturalWidth,
      height: image.naturalHeight,
      source: image.currentSrc,
    })));
    record(
      "hero/selection",
      "three Blender selection-card portraits load",
      portraits.length === 3 && portraits.every((portrait) => portrait.complete && portrait.width >= 256 && portrait.height >= 384),
      JSON.stringify(portraits),
    );
    for (const protagonist of protagonists) {
      const selectedCard = page.locator(`.character-card[data-protagonist="${protagonist}"]`);
      await selectedCard.evaluate((card) => card.click());
      const cardSelected = await selectedCard.evaluate((card) => card.classList.contains("is-selected") && card.getAttribute("aria-pressed") === "true");
      record(`hero/${protagonist}`, "selection card switches", cardSelected, `selected=${cardSelected}`);
    }
    await page.locator('.character-card[data-protagonist="butcher_matron"]').evaluate((card) => card.click());
    await page.locator("#start-button").evaluate((button) => button.click());
    await page.locator("#intro").waitFor({ state: "detached", timeout: 15_000 });
    const canvas = page.locator("#game-canvas");

    for (const protagonist of protagonists) {
      await page.evaluate((id) => window.__stormSelectProtagonist?.(id), protagonist);
      await page.waitForFunction((id) => document.querySelector("#game-canvas")?.dataset.protagonist === id, protagonist, { timeout: 10_000 });
      const selectedId = await canvas.getAttribute("data-protagonist");
      record(`hero/${protagonist}`, "selected model enters game", selectedId === protagonist, `protagonist=${selectedId}`);
      const clips = (await canvas.getAttribute("data-player-clips") ?? "").split(",").filter(Boolean);
      const expectedClips = ["attack_melee", "attack_ranged", "idle", "run"];
      record(
        `hero/${protagonist}`,
        "shared four-clip contract",
        expectedClips.every((clip) => clips.some((name) => name.endsWith(clip))),
        `clips=${clips.join(",")}`,
      );
      await page.keyboard.down("d");
      await page.waitForFunction(() => document.querySelector("#game-canvas")?.dataset.playerAnimation === "run", undefined, { timeout: 5_000 });
      await page.waitForTimeout(650);
      const runAnimation = await canvas.getAttribute("data-player-animation");
      const runForwardX = Number(await canvas.getAttribute("data-player-mesh-forward-x"));
      const runForwardZ = Number(await canvas.getAttribute("data-player-mesh-forward-z"));
      await page.keyboard.up("d");
      record(`hero/${protagonist}`, "movement switches to run", runAnimation === "run", `animation=${runAnimation}`);
      record(
        `hero/${protagonist}`,
        "moving right faces mesh toward +X",
        runForwardX > 0.9 && Math.abs(runForwardZ) < 0.2,
        `meshForward=(${runForwardX.toFixed(3)},${runForwardZ.toFixed(3)})`,
      );
      await page.waitForFunction(() => document.querySelector("#game-canvas")?.dataset.playerAnimation === "idle", undefined, { timeout: 15_000 });
      await page.locator("#game-canvas").click({ position: { x: 20, y: 20 } });
      await page.keyboard.press("Space");
      await page.waitForFunction(() => document.querySelector("#game-canvas")?.dataset.playerAnimation === "attack_melee", undefined, { timeout: 15_000 });
      const attackForwardX = Number(await canvas.getAttribute("data-player-mesh-forward-x"));
      const attackForwardZ = Number(await canvas.getAttribute("data-player-mesh-forward-z"));
      record(`hero/${protagonist}`, "attack interrupts with melee clip", true, "animation=attack_melee observed");
      record(
        `hero/${protagonist}`,
        "melee attack preserves +X mesh facing",
        attackForwardX > 0.9 && Math.abs(attackForwardZ) < 0.2,
        `meshForward=(${attackForwardX.toFixed(3)},${attackForwardZ.toFixed(3)})`,
      );
      await page.waitForFunction(() => document.querySelector("#game-canvas")?.dataset.playerAnimation === "idle", undefined, { timeout: 15_000 });
      record(`hero/${protagonist}`, "one-shot returns to idle", true, "animation=idle");
      record(`hero/${protagonist}`, "console errors", consoleErrors.length === 0, consoleErrors.join(" | ") || "0 errors");
    }
  } finally {
    await context.close();
  }
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

async function checkR9UX(page, label, touch) {
  if (touch && !await page.locator("#command-panel").evaluate((panel) => panel.classList.contains("is-open"))) {
    await page.locator("#shop-toggle").click();
    await page.waitForFunction(() => document.querySelector("#command-panel")?.classList.contains("is-open"), undefined, { timeout: 5_000 });
  }

  const uiVersion = await page.locator("#app").getAttribute("data-ui-version");
  record(label, "R11 UI version marker", uiVersion === "R11", `ui=${uiVersion}`);

  const towerButtons = page.locator("[data-tower-dock]");
  const towerButtonCount = await towerButtons.count();
  const towerButtonsVisible = towerButtonCount === 3 && await towerButtons.evaluateAll((buttons) => buttons.every((button) => {
    const box = button.getBoundingClientRect();
    return box.width >= 44 && box.height >= 44;
  }));
  record(label, "bottom tower dock exposes three fixed tower actions", towerButtonsVisible, `buttons=${towerButtonCount}`);

  const weaponVisible = await page.locator("#weapon-button").isVisible();
  const weaponEnabled = await page.locator("#weapon-button").isEnabled();
  record(label, "weapon cycle button sits beside attack", weaponVisible && weaponEnabled, `visible=${weaponVisible}, enabled=${weaponEnabled}`);

  const tabCount = await page.locator("[data-shop-tab]").count();
  const visibleSections = await page.locator("[data-shop-section]").evaluateAll((sections) => sections.filter((section) => !section.hidden).map((section) => section.dataset.shopSection));
  const towerPanelButtons = await page.locator("[data-tower]").count();
  record(label, "command panel uses four tabs and removes tower section", tabCount === 4 && visibleSections.length === 1 && towerPanelButtons === 0, `tabs=${tabCount}, visible=${visibleSections.join(",")}, towerButtons=${towerPanelButtons}`);

  for (const tab of ["employee", "regular", "expansion", "weapon"]) {
    await page.locator(`[data-shop-tab="${tab}"]`).click();
    const visible = await page.locator("[data-shop-section]").evaluateAll((sections) => sections.filter((section) => !section.hidden).map((section) => section.dataset.shopSection));
    record(label, `tab ${tab} shows one section`, visible.length === 1 && visible[0] === tab, `visible=${visible.join(",")}`);
  }

  if (touch) await page.locator("#shop-close").click();

  const point = await page.evaluate(() => window.__stormWorldPoint?.("tower", "ballista") ?? null);
  const pointValid = point && Number.isFinite(point.x) && Number.isFinite(point.y);
  if (pointValid) {
    await page.mouse.click(point.x, point.y);
    await page.waitForFunction(() => {
      const popover = document.querySelector("#world-action-popover");
      return popover && !popover.hidden && popover.dataset.actionType === "tower" && popover.dataset.actionId === "ballista";
    }, undefined, { timeout: 5_000 });
  }
  const popoverState = await page.locator("#world-action-popover").evaluate((popover) => ({
    hidden: popover.hidden,
    type: popover.dataset.actionType,
    id: popover.dataset.actionId,
    text: popover.textContent,
  }));
  record(label, "clicking a 3D build pad opens local tower action", Boolean(pointValid) && !popoverState.hidden && popoverState.type === "tower" && popoverState.id === "ballista" && /建造|升級/.test(popoverState.text ?? ""), JSON.stringify({ point, popoverState }));
  await page.mouse.click(12, 12);
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
    if (!config.touch && config.viewport.width === 1440 && config.viewport.height === 900) {
      await checkR11DesktopViewports(page, consoleErrors);
    }
    if (config.touch && config.viewport.width === 390 && config.viewport.height === 844) {
      await measureR11Controls(page, { label: "R11 controls 390x844", viewport: config.viewport, touch: true }, consoleErrors);
    }
    await checkControlSpacing(page, label);
    if (config.touch) await checkTouchLayout(page, label);
    await checkR9UX(page, label, config.touch);
    await buySmg(page, config.touch);
    const before = await readSave(page);

    const attacksBeforeCow = await attackCount(page);
    const rangedAnimation = await holdAttack(page, config.touch, 3_000);
    await page.waitForTimeout(120);
    const attacksAfterCow = await attackCount(page);
    record(label, `${config.touch ? "touch" : "keyboard"} SMG responds immediately`, attacksAfterCow > attacksBeforeCow, `attacks ${attacksBeforeCow}→${attacksAfterCow}`);
    record(label, "SMG switches to ranged clip", rangedAnimation === "attack_ranged", `animation=${rangedAnimation}`);
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
    await page.waitForFunction(() => document.querySelector("#game-canvas")?.dataset.towerAnimations?.includes("frost:attack"), undefined, { timeout: 15_000 });
    const towerAnimations = await page.locator("#game-canvas").getAttribute("data-tower-animations");
    record(label, "tower fire triggers authored clip", towerAnimations?.includes("frost:attack") === true, `animations=${towerAnimations}`);
    const attacksBeforeZombie = await attackCount(page);
    await holdAttack(page, config.touch, 8_000);
    await page.waitForTimeout(150);
    const attacksAfterZombie = await attackCount(page);
    record(label, `${config.touch ? "touch" : "keyboard"} SMG hold repeats`, attacksAfterZombie - attacksBeforeZombie >= 2, `attacks ${attacksBeforeZombie}→${attacksAfterZombie}`);
    const livePlayerKills = Number(await page.locator("#game-canvas").getAttribute("data-player-kills"));
    record(label, `${config.touch ? "touch" : "keyboard"} SMG damages zombie`, livePlayerKills > before.stats.playerKills, `playerKills ${before.stats.playerKills}→${livePlayerKills}`);
    if (!config.touch) {
      await page.keyboard.down("s");
      await page.waitForFunction(() => Number(document.querySelector("#game-canvas")?.dataset.playerZ) <= -19, undefined, { timeout: 12_000 });
      await page.keyboard.up("s");
      await page.waitForFunction(() => document.querySelector("#game-canvas")?.dataset.towerAnimationLod?.includes("frost:paused"), undefined, { timeout: 5_000 });
      const towerLod = await page.locator("#game-canvas").getAttribute("data-tower-animation-lod");
      record(label, "distant tower animation LOD pauses", towerLod?.includes("frost:paused") === true, `lod=${towerLod}`);
    }
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
    await checkControlSpacing(page, label);
    await checkTouchLayout(page, label);
    await checkR9UX(page, label, true);
    record(label, "console errors", consoleErrors.length === 0, consoleErrors.join(" | ") || "0 errors");
  } finally {
    await context.close();
  }
}

try {
  const luminance = await checkPortraitLuminance(root);
  record("assets/R8.1", "portraits and menu background pass the luminance gate", luminance.pass, luminance.detail);
  await checkR8Assets();
  await checkR10Assets();
  await ensureServer();
  const launchBrowser = () => chromium.launch(headedOnly
    ? { headless: false, channel: "chrome" }
    : { headless: true, args: ["--use-angle=swiftshader"] });
  let browser = await launchBrowser();
  try {
    if (headedOnly) {
      await checkHeadedWebGl(browser);
    } else {
      if ((!scenarioFilter || heroOnly) && !captureOnly) {
        if (heroOnly) {
          try {
            await checkProtagonistSelectionAndAnimations(browser);
          } catch (error) {
            record("hero/coverage", "protagonist animation coverage completes", false, error instanceof Error ? error.message : String(error));
          }
        } else {
          await browser.close();
          browser = await launchBrowser();
          const desktopUa = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36";
          const mobileUa = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/125 Mobile Safari/537.36";
          for (const config of [
            { label: "quality/4-core desktop", viewport: { width: 1440, height: 900 }, touch: false, mobile: false, userAgent: desktopUa, cores: 4, memory: 4, expectedQuality: "中", expectedShadow: "realtime" },
            { label: "quality/missing desktop metrics", viewport: { width: 1440, height: 900 }, touch: false, mobile: false, userAgent: desktopUa, cores: undefined, memory: undefined, expectedQuality: "中", expectedShadow: "realtime" },
            { label: "quality/compact constrained touch", viewport: { width: 900, height: 700 }, touch: true, mobile: false, userAgent: desktopUa, cores: 4, memory: 4, expectedQuality: "低", expectedShadow: "blob" },
            { label: "quality/mobile", viewport: { width: 390, height: 844 }, touch: true, mobile: true, userAgent: mobileUa, cores: 8, memory: 8, expectedQuality: "低", expectedShadow: "blob" },
          ]) {
            try {
              await runWithRetry(() => checkQualityDetection(browser, config));
            } catch (error) {
              record(config.label, "automatic quality", false, error instanceof Error ? error.message : String(error));
            }
          }
          await checkInputHints(browser, { viewport: { width: 1440, height: 900 }, touch: false });
          await checkInputHints(browser, { viewport: { width: 390, height: 844 }, touch: true });
          // 觸控筆電：有觸控能力但主指標是滑鼠、寬視口 → 必須維持桌機 WASD 介面
          await checkInputHints(browser, { viewport: { width: 1440, height: 900 }, touch: false, touchscreenDesktop: true });
          await browser.close();
          browser = await launchBrowser();
        }
      }
      for (const scenario of [
        ["1440×900", () => runCombat(browser, { viewport: { width: 1440, height: 900 }, touch: false })],
        ["390×844", () => runCombat(browser, { viewport: { width: 390, height: 844 }, touch: true })],
        ["844×390", () => runLayout(browser, { width: 844, height: 390 })],
      ]) {
        if (heroOnly) continue;
        if (scenarioFilter && scenario[0] !== scenarioFilter) continue;
        try {
          await runWithRetry(() => scenario[1]());
        } catch (error) {
          record(scenario[0], "scenario completes", false, error instanceof Error ? error.message : String(error));
        }
        if (!scenarioFilter) {
          await browser.close();
          browser = await launchBrowser();
        }
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
