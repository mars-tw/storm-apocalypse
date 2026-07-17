import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { freemem } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("..", import.meta.url));
const evidenceDir = resolve(root, process.env.R15_EVIDENCE_DIR ?? "docs/evidence/R15");
const outputPath = resolve(root, process.env.R15_VISUAL_OUTPUT ?? "docs/evidence/R15/visual-validation-r15.json");
const devUrl = process.env.R15_DEV_URL ?? "http://127.0.0.1:4173/storm-apocalypse/";
const previewUrl = process.env.R15_PREVIEW_URL ?? "http://127.0.0.1:4181/storm-apocalypse/";
const saveKey = "storm-apocalypse-save-v1";
const settingsKey = "storm-apocalypse-settings-v1";
const scenario = process.env.R15_SCENARIO ?? "all";
const results = [];
const servers = [];

function record(group, check, pass, detail) {
  const result = { group, check, pass, detail };
  results.push(result);
  console.log(`${pass ? "PASS" : "FAIL"} [${group}] ${check} — ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
}

async function waitForMemory() {
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    const freeBytes = freemem();
    if (freeBytes >= 2 * 1024 ** 3) {
      record("resource", "physical memory before browser batch is at least 2 GiB", true, `${(freeBytes / 1024 ** 3).toFixed(2)} GiB`);
      return;
    }
    record("resource", `memory wait ${attempt}/10`, false, `${(freeBytes / 1024 ** 3).toFixed(2)} GiB; retrying after 60 seconds`);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 60_000));
  }
  throw new Error("physical memory stayed below 2 GiB for all ten retries")
}

async function reachable(url) {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}

async function startServer(url, args) {
  if (await reachable(url)) return;
  const server = spawn(process.execPath, [resolve(root, "node_modules/vite/bin/vite.js"), ...args], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  servers.push(server);
  const errors = [];
  server.stderr.on("data", (chunk) => errors.push(chunk.toString()));
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (await reachable(url)) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(`server did not become ready: ${url}; ${errors.join(" ").slice(-1000)}`);
}

function fixture() {
  return {
    version: 5,
    money: 9999,
    wave: 24,
    baseHealth: 100,
    stallLevel: 4,
    towerBuilt: true,
    bestWave: 24,
    weapon: "smg",
    weapons: { machete: true, axe: true, smg: true },
    protagonistId: "mech_youth",
    requiresProtagonistSelection: false,
    employees: { hunter: 2, cashier: 2, dog: 2 },
    pasture2Unlocked: true,
    towers: { ballista: 3, frost: 3, cannon: 3 },
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
      wavesCleared: 24,
      campaignWins: 0,
    },
    lastSavedAt: 0,
  };
}

function crcTable() {
  return Array.from({ length: 256 }, (_, value) => {
    let current = value;
    for (let bit = 0; bit < 8; bit += 1) current = current & 1 ? 0xedb88320 ^ current >>> 1 : current >>> 1;
    return current >>> 0;
  });
}

const CRC_TABLE = crcTable();

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ crc >>> 8;
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, payload) {
  const name = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, payload])));
  return Buffer.concat([length, name, payload, checksum]);
}

function decodePng(data) {
  if (!data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error("not a PNG");
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat = [];
  for (let offset = 8; offset < data.length;) {
    const length = data.readUInt32BE(offset);
    const type = data.toString("ascii", offset + 4, offset + 8);
    const payload = data.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = payload.readUInt32BE(0);
      height = payload.readUInt32BE(4);
      if (payload[8] !== 8 || payload[12] !== 0) throw new Error("unsupported PNG depth/interlace");
      colorType = payload[9];
    } else if (type === "IDAT") idat.push(payload);
    offset += length + 12;
    if (type === "IEND") break;
  }
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (!channels) throw new Error(`unsupported screenshot PNG color type ${colorType}`);
  const rowBytes = width * channels;
  const inflated = inflateSync(Buffer.concat(idat));
  const raw = Buffer.alloc(height * rowBytes);
  const paeth = (left, above, upperLeft) => {
    const estimate = left + above - upperLeft;
    const dl = Math.abs(estimate - left);
    const da = Math.abs(estimate - above);
    const du = Math.abs(estimate - upperLeft);
    return dl <= da && dl <= du ? left : da <= du ? above : upperLeft;
  };
  for (let row = 0; row < height; row += 1) {
    const source = row * (rowBytes + 1);
    const filter = inflated[source];
    const destination = row * rowBytes;
    for (let column = 0; column < rowBytes; column += 1) {
      const byte = inflated[source + 1 + column];
      const left = column >= channels ? raw[destination + column - channels] : 0;
      const above = row > 0 ? raw[destination + column - rowBytes] : 0;
      const upperLeft = row > 0 && column >= channels ? raw[destination + column - rowBytes - channels] : 0;
      const value = filter === 0 ? byte
        : filter === 1 ? byte + left
          : filter === 2 ? byte + above
            : filter === 3 ? byte + Math.floor((left + above) / 2)
              : filter === 4 ? byte + paeth(left, above, upperLeft)
                : Number.NaN;
      if (!Number.isFinite(value)) throw new Error(`unsupported PNG filter ${filter}`);
      raw[destination + column] = value & 0xff;
    }
  }
  const rgba = Buffer.alloc(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    rgba[pixel * 4] = raw[pixel * channels];
    rgba[pixel * 4 + 1] = raw[pixel * channels + 1];
    rgba[pixel * 4 + 2] = raw[pixel * channels + 2];
    rgba[pixel * 4 + 3] = channels === 4 ? raw[pixel * channels + 3] : 255;
  }
  return { width, height, rgba };
}

function encodePng(image) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(image.width, 0);
  ihdr.writeUInt32BE(image.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const scanlines = Buffer.alloc(image.height * (image.width * 4 + 1));
  for (let y = 0; y < image.height; y += 1) {
    const row = y * (image.width * 4 + 1);
    scanlines[row] = 0;
    image.rgba.copy(scanlines, row + 1, y * image.width * 4, (y + 1) * image.width * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(scanlines, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function composeHorizontal(buffers) {
  const images = buffers.map(decodePng);
  const width = images.reduce((sum, image) => sum + image.width, 0);
  const height = Math.max(...images.map((image) => image.height));
  const rgba = Buffer.alloc(width * height * 4, 0);
  let offsetX = 0;
  for (const image of images) {
    for (let y = 0; y < image.height; y += 1) {
      image.rgba.copy(rgba, (y * width + offsetX) * 4, y * image.width * 4, (y + 1) * image.width * 4);
    }
    offsetX += image.width;
  }
  return encodePng({ width, height, rgba });
}

function rgbaAt(image, x, y) {
  const px = Math.max(0, Math.min(image.width - 1, Math.round(x)));
  const py = Math.max(0, Math.min(image.height - 1, Math.round(y)));
  const offset = (py * image.width + px) * 4;
  return [image.rgba[offset], image.rgba[offset + 1], image.rgba[offset + 2], image.rgba[offset + 3]];
}

function averageRect(image, rect, step = 4) {
  const total = [0, 0, 0];
  let count = 0;
  for (let y = Math.max(0, Math.floor(rect.y)); y < Math.min(image.height, Math.ceil(rect.y + rect.height)); y += step) {
    for (let x = Math.max(0, Math.floor(rect.x)); x < Math.min(image.width, Math.ceil(rect.x + rect.width)); x += step) {
      const color = rgbaAt(image, x, y);
      total[0] += color[0];
      total[1] += color[1];
      total[2] += color[2];
      count += 1;
    }
  }
  return total.map((channel) => channel / Math.max(1, count));
}

function luminance(color) {
  const channels = color.slice(0, 3).map((value) => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function parseCssColor(value) {
  const match = /rgba?\((\d+(?:\.\d+)?)[, ]+(\d+(?:\.\d+)?)[, ]+(\d+(?:\.\d+)?)/u.exec(value);
  return match ? match.slice(1, 4).map(Number) : [255, 255, 255];
}

async function textContrastGate(page, selectors, group) {
  const samples = await page.evaluate((requested) => requested.map((selector) => {
    const element = document.querySelector(selector);
    if (!element) return { selector, missing: true };
    const rect = element.getBoundingClientRect();
    return { selector, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, color: getComputedStyle(element).color };
  }), selectors);
  await page.evaluate((requested) => {
    for (const selector of requested) {
      const element = document.querySelector(selector);
      if (element) element.dataset.r15Visibility = element.style.visibility, element.style.visibility = "hidden";
    }
  }, selectors);
  const background = decodePng(await page.screenshot({ animations: "disabled" }));
  await page.evaluate((requested) => {
    for (const selector of requested) {
      const element = document.querySelector(selector);
      if (element) element.style.visibility = element.dataset.r15Visibility ?? "", delete element.dataset.r15Visibility;
    }
  }, selectors);
  const measured = samples.map((sample) => {
    if (sample.missing) return { selector: sample.selector, ratio: 0, missing: true };
    const backgroundColor = averageRect(background, sample.rect, 5);
    return { selector: sample.selector, ratio: Number(contrastRatio(parseCssColor(sample.color), backgroundColor).toFixed(2)), foreground: sample.color, background: backgroundColor.map((value) => Math.round(value)) };
  });
  record(group, "visible text contrast is at least 4.5:1 against the rendered scene", measured.every((sample) => !sample.missing && sample.ratio >= 4.5), measured);
  return measured;
}

async function waitForBackground(page) {
  await page.locator(".intro__render-scene").waitFor({ state: "visible", timeout: 180_000 });
  await page.evaluate(async () => {
    const element = document.querySelector(".intro__render-scene");
    const match = /url\(["']?(.*?)["']?\)/u.exec(getComputedStyle(element).backgroundImage);
    if (match) {
      const image = new Image();
      image.src = match[1];
      await image.decode();
    }
  });
}

async function keyArtMatrix(browser) {
  const viewports = [
    { width: 1366, height: 600, label: "1366x600" },
    { width: 390, height: 844, label: "390x844" },
    { width: 844, height: 390, label: "844x390" },
  ];
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: viewport.width === 390, hasTouch: viewport.width === 390 });
    await context.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: saveKey, value: fixture() });
    const page = await context.newPage();
    await page.goto(`${devUrl}?smoke=1&ui-only=1`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await waitForBackground(page);
    const crop = await page.evaluate(() => {
      const element = document.querySelector(".intro__render-scene");
      const rect = element.getBoundingClientRect();
      const mode = getComputedStyle(element).backgroundSize;
      const source = { width: 640, height: 360 };
      const scale = mode === "contain" ? Math.min(rect.width / source.width, rect.height / source.height) : Math.max(rect.width / source.width, rect.height / source.height);
      const rendered = { width: source.width * scale, height: source.height * scale };
      const origin = { x: rect.x + (rect.width - rendered.width) / 2, y: rect.y + (rect.height - rendered.height) / 2 };
      const normalizedFocus = { left: 0.25, top: 0.18, right: 0.86, bottom: 0.86 };
      return {
        mode,
        focus: {
          left: origin.x + normalizedFocus.left * rendered.width,
          top: origin.y + normalizedFocus.top * rendered.height,
          right: origin.x + normalizedFocus.right * rendered.width,
          bottom: origin.y + normalizedFocus.bottom * rendered.height,
        },
        viewport: { width: innerWidth, height: innerHeight },
      };
    });
    const margin = viewport.width <= 540 ? 12 : 20;
    const safe = crop.focus.left >= margin && crop.focus.top >= margin && crop.focus.right <= crop.viewport.width - margin && crop.focus.bottom <= crop.viewport.height - margin;
    record("key-art/RWD", `${viewport.label} focal bbox stays inside the viewport safe area`, safe, crop);
    await textContrastGate(page, [".intro__overline", ".intro__content h1", ".intro__content > p", ".intro__features span"], `key-art/contrast/${viewport.label}`);
    await page.screenshot({ path: resolve(evidenceDir, `after-key-art-${viewport.label}.png`), animations: "disabled" });
    await context.close();
  }
}

async function firstScreenGate(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await context.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: saveKey, value: fixture() });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 200_000, uploadThroughput: 93_750, connectionType: "cellular3g" });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.goto(`${previewUrl}?perf=1`, { waitUntil: "commit", timeout: 180_000 });
  await page.waitForFunction(() => performance.getEntriesByName("storm-key-art-rendered", "mark").length > 0, undefined, { timeout: 15_000 });
  const focus = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0];
    const element = performance.getEntriesByType("element").find((entry) => entry.identifier === "storm-key-art");
    return {
      focusMs: performance.getEntriesByName("storm-key-art-rendered", "mark")[0].startTime,
      navigation: navigation ? {
        responseStart: navigation.responseStart,
        responseEnd: navigation.responseEnd,
        domInteractive: navigation.domInteractive,
      } : null,
      element: element ? { startTime: element.startTime, renderTime: element.renderTime, loadTime: element.loadTime } : null,
    };
  });
  record("first-screen", "Fast 3G + 4x CPU key-art performance mark is at most 3000 ms", focus.focusMs <= 3_000, { ...focus, focusMs: Number(focus.focusMs.toFixed(1)), gateMs: 3000 });
  await page.screenshot({ path: resolve(evidenceDir, "after-first-screen-fast3g.png"), animations: "disabled" });
  await page.waitForFunction(() => performance.getEntriesByName("storm-first-interactive", "mark").length > 0, undefined, { timeout: 264_000 });
  const interactiveMs = await page.evaluate(() => performance.getEntriesByName("storm-first-interactive", "mark")[0].startTime);
  record("first-screen", "first interaction does not regress more than 10% from the >240000 ms before lower bound", interactiveMs <= 264_000, { beforeLowerBoundMs: 240_000, afterMs: Number(interactiveMs.toFixed(1)), regressionCeilingMs: 264_000 });
  await context.close();
}

async function gameplayPage(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await context.addInitScript(({ saveStorageKey, settingsStorageKey, save }) => {
    localStorage.setItem(saveStorageKey, JSON.stringify(save));
    const requested = new URLSearchParams(location.search).get("quality") ?? "high";
    localStorage.setItem(settingsStorageKey, JSON.stringify({ version: 1, masterVolume: 0.7, sfxVolume: 0.8, muted: true, quality: requested, screenShake: false }));
  }, { saveStorageKey: saveKey, settingsStorageKey: settingsKey, save: fixture() });
  return { context, page: await context.newPage() };
}

async function captureGameplay(page, intensity, quality, filename) {
  await page.goto(`${devUrl}?smoke=1&weather=${intensity}&quality=${quality}&visual-evidence=1`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await page.waitForFunction(() => document.querySelector("#start-button")?.hasAttribute("disabled") === false, undefined, { timeout: 180_000 });
  await page.locator("#start-button").click({ force: true });
  await page.locator("#intro").waitFor({ state: "detached", timeout: 30_000 });
  await page.evaluate(() => window.__stormStartWave?.());
  await page.waitForFunction(() => Number(document.querySelector("#game-canvas")?.dataset.activeZombies) > 0, undefined, { timeout: 30_000 });
  await page.waitForTimeout(900);
  const dataset = await page.locator("#game-canvas").evaluate((canvas) => ({
    intensity: canvas.dataset.weatherIntensity,
    quality: canvas.dataset.quality,
    farRate: Number(canvas.dataset.weatherFarRate),
    nearRate: Number(canvas.dataset.weatherNearRate),
    density: Number(canvas.dataset.weatherDensity),
    behavior: canvas.dataset.weatherBehavior,
    post: canvas.dataset.weatherPost,
    performanceTier: Number(canvas.dataset.performanceTier),
    activeZombies: Number(canvas.dataset.activeZombies),
  }));
  const screenshot = await page.screenshot({ path: resolve(evidenceDir, filename), animations: "disabled" });
  return { dataset, screenshot };
}

function patchReadability(image, point) {
  const inner = { x: point.x - 12, y: point.y - 20, width: 24, height: 40 };
  const outer = { x: point.x - 40, y: point.y - 48, width: 80, height: 96 };
  const innerColor = averageRect(image, inner, 2);
  const outerColor = averageRect(image, outer, 5);
  const localContrast = contrastRatio(innerColor, outerColor);
  let vividPixels = 0;
  let sampled = 0;
  for (let y = Math.max(0, Math.floor(outer.y)); y < Math.min(image.height, Math.ceil(outer.y + outer.height)); y += 2) {
    for (let x = Math.max(0, Math.floor(outer.x)); x < Math.min(image.width, Math.ceil(outer.x + outer.width)); x += 2) {
      const color = rgbaAt(image, x, y);
      const chroma = Math.max(...color.slice(0, 3)) - Math.min(...color.slice(0, 3));
      if (chroma >= 55 && luminance(color) >= 0.28) vividPixels += 1;
      sampled += 1;
    }
  }
  return { localContrast: Number(localContrast.toFixed(2)), vividShare: Number((vividPixels / Math.max(1, sampled)).toFixed(3)), innerColor: innerColor.map(Math.round), outerColor: outerColor.map(Math.round) };
}

async function weatherMatrix(browser, manifest) {
  const { context, page } = await gameplayPage(browser);
  const intensityCaptures = [];
  const intensityData = {};
  for (const intensity of ["low", "medium", "high"]) {
    const capture = await captureGameplay(page, intensity, "high", `after-weather-${intensity}.png`);
    intensityCaptures.push(capture.screenshot);
    intensityData[intensity] = capture;
    const expected = manifest.intensities[intensity];
    record("weather/intensity", `${intensity} profile exposes the declared particle and post-process state`, capture.dataset.intensity === intensity
      && capture.dataset.farRate === expected.farRate
      && capture.dataset.nearRate === expected.nearRate
      && capture.dataset.performanceTier === 0, capture.dataset);
  }
  await writeFile(resolve(evidenceDir, "weather-intensity-low-medium-high.png"), composeHorizontal(intensityCaptures));
  record("weather/intensity", "low/medium/high rates rise monotonically", intensityData.low.dataset.farRate < intensityData.medium.dataset.farRate
    && intensityData.medium.dataset.farRate < intensityData.high.dataset.farRate, Object.fromEntries(Object.entries(intensityData).map(([key, value]) => [key, value.dataset.farRate])));

  const qualityCaptures = [];
  const qualityData = {};
  for (const quality of ["low", "medium"]) {
    const capture = await captureGameplay(page, "high", quality, `after-quality-${quality}.png`);
    qualityCaptures.push(capture.screenshot);
    qualityData[quality] = capture;
  }
  qualityCaptures.push(intensityData.high.screenshot);
  qualityData.high = intensityData.high;
  await writeFile(resolve(evidenceDir, "quality-low-medium-high.png"), composeHorizontal(qualityCaptures));
  const behaviorEqual = new Set(Object.values(qualityData).map((entry) => entry.dataset.behavior)).size === 1;
  const postEqual = new Set(Object.values(qualityData).map((entry) => entry.dataset.post)).size === 1;
  const densityMonotonic = qualityData.low.dataset.density < qualityData.medium.dataset.density && qualityData.medium.dataset.density < qualityData.high.dataset.density;
  const ratesMonotonic = qualityData.low.dataset.farRate < qualityData.medium.dataset.farRate && qualityData.medium.dataset.farRate < qualityData.high.dataset.farRate;
  record("weather/quality", "low/medium/high keep identical weather behavior and post parameters while only density changes", behaviorEqual && postEqual && densityMonotonic && ratesMonotonic, Object.fromEntries(Object.entries(qualityData).map(([key, value]) => [key, value.dataset])));

  const vfxEventsBefore = Number(await page.locator("#game-canvas").getAttribute("data-vfx-events"));
  await page.waitForFunction((before) => window.__stormDebug?.combatVfx?.active > 0
    && Number(document.querySelector("#game-canvas")?.dataset.vfxEvents) > before
    && Number(document.querySelector("#game-canvas")?.dataset.activeZombies) > 0
    && window.__stormR15EnemyPoint?.()
    && window.__stormR15ImpactPoint?.(), vfxEventsBefore, { timeout: 45_000 });
  await page.evaluate(() => window.__stormR15FreezeFrame?.());
  const enemyPoint = await page.evaluate(() => window.__stormR15EnemyPoint?.() ?? null);
  const impactPoint = await page.evaluate(() => window.__stormR15ImpactPoint?.() ?? null);
  const hitScreenshot = await page.screenshot({ path: resolve(evidenceDir, "after-weather-high-readable-hit.png"), animations: "disabled" });
  const hitImage = decodePng(hitScreenshot);
  const enemyReadability = enemyPoint ? patchReadability(hitImage, enemyPoint) : null;
  const impactReadability = impactPoint ? patchReadability(hitImage, impactPoint) : null;
  record("weather/readability", "highest intensity keeps an enemy silhouette locally distinguishable", Boolean(enemyReadability && enemyReadability.localContrast >= 1.18), { enemyPoint, enemyReadability });
  record("weather/readability", "active ice-white hit feedback remains locally distinguishable at highest intensity", Boolean(impactReadability && impactReadability.localContrast >= 1.18), { impactPoint, impactReadability, vfxEvents: await page.locator("#game-canvas").getAttribute("data-vfx-events") });
  await textContrastGate(page, ["#hud-wave", "#hud-money", "#base-health", "#performance-chip"], "weather/HUD-high");
  await context.close();
}

await mkdir(evidenceDir, { recursive: true });
await waitForMemory();
await startServer(devUrl, ["--host", "127.0.0.1", "--port", "4173", "--strictPort"]);
await startServer(previewUrl, ["preview", "--host", "127.0.0.1", "--port", "4181", "--strictPort"]);
const weatherManifest = JSON.parse(await readFile(resolve(root, "docs/evidence/R15/weather-pipeline-r15.json"), "utf8"));
const keyArtManifest = JSON.parse(await readFile(resolve(root, "docs/evidence/R15/source-manifest-r15.json"), "utf8"));
record("memory", "desktop decoded texture budget is at most 64 MiB", keyArtManifest.gates.desktopDecodedBytes + weatherManifest.gates.proceduralTextureDecodedBytes <= 64 * 1024 ** 2, {
  keyArtBytes: keyArtManifest.gates.desktopDecodedBytes,
  weatherProceduralBytes: weatherManifest.gates.proceduralTextureDecodedBytes,
  totalBytes: keyArtManifest.gates.desktopDecodedBytes + weatherManifest.gates.proceduralTextureDecodedBytes,
});
record("memory", "mobile decoded texture budget is at most 32 MiB", keyArtManifest.gates.mobileDecodedBytes + weatherManifest.gates.proceduralTextureDecodedBytes <= 32 * 1024 ** 2, {
  keyArtBytes: keyArtManifest.gates.mobileDecodedBytes,
  weatherProceduralBytes: weatherManifest.gates.proceduralTextureDecodedBytes,
  totalBytes: keyArtManifest.gates.mobileDecodedBytes + weatherManifest.gates.proceduralTextureDecodedBytes,
});

const browser = await chromium.launch({ headless: true, args: ["--use-angle=d3d11"] });
try {
  if (scenario === "all" || scenario === "first-screen") await firstScreenGate(browser);
  if (scenario === "all" || scenario === "key-art") await keyArtMatrix(browser);
  if (scenario === "all" || scenario === "weather") await weatherMatrix(browser, weatherManifest);
} finally {
  await browser.close();
  for (const server of servers) server.kill();
}

const report = {
  release: "storm R15 Wave 2",
  scenario,
  measuredAt: new Date().toISOString(),
  conditions: {
    browser: "Playwright Chromium, single in-process browser; pages run sequentially",
    firstScreen: "production preview, Fast 3G 150ms/1.6Mbps, 4x CPU",
    gameplay: "Vite dev, ANGLE D3D11, dev-only deterministic weather and quality overrides",
    host: "concurrent shared machine; p95 shipping verdict must be repeated on the clean audit machine",
  },
  evidenceSha256: createHash("sha256").update(JSON.stringify(results)).digest("hex"),
  passed: results.filter((result) => result.pass).length,
  total: results.length,
  failed: results.filter((result) => !result.pass).length,
  allPass: results.every((result) => result.pass),
  results,
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`${report.passed}/${report.total} R15 visual checks passed; ${report.failed} failed`);
if (!report.allPass) process.exitCode = 1;
