import { spawn, spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { constants as osConstants, setPriority } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("..", import.meta.url));
const appRoot = process.env.PERF_APP_ROOT ? resolve(root, process.env.PERF_APP_ROOT) : root;
const url = process.env.PERF_URL ?? "http://127.0.0.1:4173/storm-apocalypse/?perf=1";
const outputPath = process.env.PERF_OUTPUT ? resolve(root, process.env.PERF_OUTPUT) : undefined;
const runs = Number(process.env.PERF_RUNS ?? 3);
const warmupMs = Number(process.env.PERF_WARMUP_MS ?? 8_000);
const sampleMs = Number(process.env.PERF_SAMPLE_MS ?? 6_000);
const angleBackend = process.env.PERF_ANGLE ?? "d3d11";
const p95GateMs = Number(process.env.PERF_P95_GATE_MS ?? 18);
const profileFilter = process.env.PERF_PROFILE;
const meshAudit = process.env.PERF_MESH_AUDIT === "1";
const saveKey = "storm-apocalypse-save-v1";
let server;
let processPriority = "normal";
let browserScheduling = "default";

if (process.platform === "win32" && process.env.PERF_PRIORITY !== "normal") {
  try {
    setPriority(0, osConstants.priority.PRIORITY_HIGH);
    processPriority = "high";
  } catch (error) {
    console.warn(`Unable to raise benchmark priority: ${error instanceof Error ? error.message : String(error)}`);
  }
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

async function reachable() {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (await reachable()) return;
  server = spawn(process.execPath, [resolve(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "4173", "--strictPort"], {
    cwd: appRoot,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (await reachable()) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
  }
  throw new Error("Vite performance server did not become ready.");
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

async function measureProfile(browser, profile) {
  const samples = [];
  for (let run = 1; run <= runs; run += 1) {
    const context = await browser.newContext({
      viewport: profile.viewport,
      hasTouch: profile.touch,
      isMobile: profile.touch,
      deviceScaleFactor: 1,
      userAgent: profile.touch
        ? "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/125 Mobile Safari/537.36"
        : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36",
    });
    await context.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: saveKey, value: fixture() });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.locator("#start-button").waitFor({ state: "visible", timeout: 180_000 });
    await page.waitForFunction(() => document.querySelector("#start-button")?.hasAttribute("disabled") === false, undefined, { timeout: 180_000 });
    await page.locator("#start-button").click({ force: true, timeout: 180_000 });
    await page.locator("#intro").waitFor({ state: "detached", timeout: 180_000 });
    if (profile.touch) await page.locator("#wave-button").click();
    else await page.keyboard.press("n");
    await page.waitForFunction(() => document.querySelector("#hud-wave")?.textContent?.includes("夜襲"), undefined, { timeout: 30_000 });
    await page.waitForTimeout(warmupMs);
    const frameTimes = await page.evaluate((duration) => new Promise((resolvePromise) => {
      const samples = [];
      const startedAt = performance.now();
      let previous = startedAt;
      const frame = (now) => {
        const delta = now - previous;
        previous = now;
        if (delta > 0) samples.push(delta);
        if (now - startedAt >= duration) {
          resolvePromise(samples);
          return;
        }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }), sampleMs);
    frameTimes.sort((a, b) => a - b);
    const p95 = frameTimes[Math.min(frameTimes.length - 1, Math.floor(frameTimes.length * 0.95))];
    const canvas = page.locator("#game-canvas");
    const activeMeshNames = meshAudit
      ? await page.evaluate(() => window.__stormR15ActiveMeshNames?.() ?? [])
      : undefined;
    const sample = {
      run,
      p95FrameMs: Number(p95.toFixed(2)),
      medianFrameMs: Number(median(frameTimes).toFixed(2)),
      fps: Number(await canvas.getAttribute("data-fps")),
      drawCalls: Number(await canvas.getAttribute("data-draw-calls")),
      activeMeshes: Number(await canvas.getAttribute("data-active-meshes")),
      activeZombies: Number(await canvas.getAttribute("data-active-zombies")),
      quality: await canvas.getAttribute("data-quality"),
      renderScale: Number(await canvas.getAttribute("data-render-scale")),
      performanceTier: Number(await canvas.getAttribute("data-performance-tier")),
      weatherFarRate: Number(await canvas.getAttribute("data-weather-far-rate")),
      weatherNearRate: Number(await canvas.getAttribute("data-weather-near-rate")),
      ...(activeMeshNames ? { activeMeshNames } : {}),
      errors,
    };
    samples.push(sample);
    console.log(`${profile.label} run ${run}: p95=${sample.p95FrameMs}ms, fps=${sample.fps}, DC=${sample.drawCalls}, meshes=${sample.activeMeshes}, zombies=${sample.activeZombies}`);
    await context.close();
  }
  return {
    profile: profile.label,
    viewport: profile.viewport,
    conditions: { renderer: `Chromium ANGLE ${angleBackend}`, processPriority, browserScheduling, warmupMs, sampleMs, wave: 25, runs },
    runs: samples,
    median: {
      p95FrameMs: median(samples.map((sample) => sample.p95FrameMs)),
      fps: median(samples.map((sample) => sample.fps)),
      drawCalls: median(samples.map((sample) => sample.drawCalls)),
      activeMeshes: median(samples.map((sample) => sample.activeMeshes)),
    },
    pass: samples.every((sample) => sample.p95FrameMs <= p95GateMs && sample.errors.length === 0),
  };
}

await ensureServer();
const browser = await chromium.launch({ headless: true, args: [`--use-angle=${angleBackend}`] });
if (process.platform === "win32" && process.env.PERF_PRIORITY !== "normal") {
  const scheduling = spawnSync("powershell", ["-NoProfile", "-Command", "Get-Process chrome-headless-shell -ErrorAction SilentlyContinue | ForEach-Object { $_.PriorityClass = 'High'; $_.ProcessorAffinity = 15 }"], { windowsHide: true });
  if (scheduling.status === 0) browserScheduling = "high/p-threads-0x0f";
}
try {
  const report = {
    measuredAt: new Date().toISOString(),
    profiles: [],
  };
  for (const profile of [
    { label: "desktop-1440x900", viewport: { width: 1440, height: 900 }, touch: false },
    { label: "mobile-390x844", viewport: { width: 390, height: 844 }, touch: true },
  ].filter((profile) => !profileFilter || profile.label === profileFilter)) {
    report.profiles.push(await measureProfile(browser, profile));
  }
  report.gate = { p95FrameMs: p95GateMs, allRunsRequired: true };
  report.allProfilesPass = report.profiles.every((profile) => profile.pass);
  if (outputPath) {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  console.log(JSON.stringify(report, null, 2));
  if (!report.allProfilesPass) process.exitCode = 1;
} finally {
  await browser.close();
  server?.kill();
}
