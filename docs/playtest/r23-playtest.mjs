// R23 實玩錄證腳本：以 Playwright 自啟 Chromium，在四個視口實際操作並截圖。
// 用法：node docs/playtest/r23-playtest.mjs <輸出資料夾> [before|after]
// 需先在 5101 埠啟動 vite dev server（或以 PLAYTEST_URL 指定）。
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const outDir = resolve(process.argv[2] ?? "docs/evidence/r23/playtest");
const phase = process.argv[3] ?? "after";
const url = process.env.PLAYTEST_URL ?? "http://127.0.0.1:5101/storm-apocalypse/";
const saveKey = "storm-apocalypse-save-v1";
const viewports = [
  { id: "desktop-1366x768", width: 1366, height: 768, touch: false },
  { id: "laptop-1366x600", width: 1366, height: 600, touch: false },
  { id: "phone-portrait-390x844", width: 390, height: 844, touch: true },
  { id: "phone-landscape-844x390", width: 844, height: 390, touch: true },
].filter((viewport) => !process.env.PLAYTEST_VIEWPORT || viewport.id.startsWith(process.env.PLAYTEST_VIEWPORT));

function waveFixture(wave) {
  return {
    version: 5, money: 600, wave, baseHealth: 100, stallLevel: 2, towerBuilt: true, bestWave: wave,
    weapon: "axe", protagonistId: "butcher_matron", requiresProtagonistSelection: false,
    weapons: { machete: true, axe: true, smg: false },
    employees: { hunter: 1, cashier: 1, dog: 0 }, pasture2Unlocked: false,
    towers: { ballista: 1, frost: 1, cannon: 0 },
    quest: { chapter: 15, completed: Array.from({ length: 14 }, (_, index) => index + 1), unlocks: ["stall-guide", "defense-shop", "employee-shop", "strong-cattle", "tower-upgrade", "automation", "repair", "final-alert"], loop: null },
    stats: { pastureVisited: true, cowsKilled: 4, meatCollected: 12, meatDeposited: 12, sales: 6, totalEarned: 900, zombiesKilled: 20, playerKills: 4, towerKills: 16, damageDealt: 80, damageTaken: 0, wavesCleared: wave, campaignWins: 0 },
    displayedMeat: 4, carriedMeat: 2,
    lastSavedAt: 0,
  };
}

const report = { phase, url, startedAt: new Date().toISOString(), viewports: {} };
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--use-angle=d3d11", "--mute-audio", "--autoplay-policy=no-user-gesture-required"] });

async function newPage(viewport, save) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    hasTouch: viewport.touch,
    isMobile: viewport.touch,
    locale: "zh-TW",
  });
  if (save) await context.addInitScript(([key, value]) => { if (!sessionStorage.getItem("r23-seeded")) { localStorage.setItem(key, value); sessionStorage.setItem("r23-seeded", "1"); } }, [saveKey, JSON.stringify(save)]);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction(() => {
    const button = document.querySelector("#start-button");
    return button && !button.disabled && document.querySelector("#intro")?.classList.contains("is-ready");
  }, undefined, { timeout: 180_000 });
  return { context, page, errors };
}

async function tap(page, selector, touch) {
  const locator = page.locator(selector).first();
  if (touch) await locator.tap({ timeout: 10_000 });
  else await locator.click({ timeout: 10_000 });
}

async function startGame(page, touch) {
  await tap(page, "#start-button", touch);
  await page.waitForFunction(() => document.querySelector("#intro")?.hidden || !document.querySelector("#intro")?.isConnected || getComputedStyle(document.querySelector("#intro")).display === "none" || getComputedStyle(document.querySelector("#intro")).opacity === "0", undefined, { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(900);
}

const debug = (page) => page.evaluate(() => window.__stormDebug ?? null);
const save = (page, key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), key);

async function steerTo(page, target, maxMs = 9000, radius = 1.1) {
  const started = Date.now();
  const held = new Set();
  const setKeys = async (wanted) => {
    for (const key of [...held]) if (!wanted.has(key)) { await page.keyboard.up(key); held.delete(key); }
    for (const key of wanted) if (!held.has(key)) { await page.keyboard.down(key); held.add(key); }
  };
  try {
    while (Date.now() - started < maxMs) {
      const state = await debug(page);
      const position = state?.playerPosition;
      if (!position) { await page.waitForTimeout(120); continue; }
      const dx = target.x - position.x;
      const dz = target.z - position.z;
      if (Math.hypot(dx, dz) <= radius) break;
      const wanted = new Set();
      if (dx > 0.35) wanted.add("KeyD"); else if (dx < -0.35) wanted.add("KeyA");
      if (dz > 0.35) wanted.add("KeyW"); else if (dz < -0.35) wanted.add("KeyS");
      await setKeys(wanted);
      await page.waitForTimeout(90);
    }
  } finally {
    await setKeys(new Set());
  }
}

async function hudSnapshot(page) {
  return page.evaluate(() => {
    const toasts = [...document.querySelectorAll("#toast-host .toast")].map((toast) => toast.textContent?.trim());
    const toastFont = (() => { const span = document.querySelector("#toast-host .toast span"); return span ? getComputedStyle(span).fontSize : null; })();
    const floaters = document.querySelectorAll(".combat-floater").length;
    const waveReport = document.querySelector("#wave-report:not([hidden])")?.textContent?.trim() ?? null;
    const combo = document.querySelector("#combo-badge:not([hidden])")?.textContent?.trim() ?? null;
    return { toasts, toastCount: toasts.length, toastFont, floaters, waveReport, combo, feedback: window.__stormDebug?.feedback ?? null, music: window.__stormAudio?.music ?? null, debug: window.__stormDebug ?? null, wave: document.querySelector("#hud-wave")?.textContent, money: document.querySelector("#hud-money")?.textContent };
  });
}

for (const viewport of viewports) {
  const entry = { first60: {}, wave: {} };
  report.viewports[viewport.id] = entry;
  // ---- 新玩家開局 ----
  {
    const { context, page, errors } = await newPage(viewport, null);
    await page.screenshot({ path: resolve(outDir, `${phase}-${viewport.id}-01-select.png`) });
    const t0 = Date.now();
    await startGame(page, viewport.touch);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: resolve(outDir, `${phase}-${viewport.id}-02-first-frame.png`) });
    entry.first60.firstFrameHud = await hudSnapshot(page);
    if (!viewport.touch) {
      // 走向牧場，攻擊牛直到倒下，撿肉，回攤位。
      const timeline = [];
      const mark = (name) => timeline.push({ name, seconds: Number(((Date.now() - t0) / 1000).toFixed(1)) });
      await steerTo(page, { x: 6.6, z: 3.0 }, 12_000, 1.2);
      mark("reachedPasture");
      let killed = false;
      for (let swing = 0; swing < 14 && !killed; swing += 1) {
        await page.keyboard.press("Space");
        await page.waitForTimeout(300);
        if (swing === 0) {
          await page.waitForTimeout(120);
          await page.screenshot({ path: resolve(outDir, `${phase}-${viewport.id}-03-first-hit.png`) });
          entry.first60.firstHitHud = await hudSnapshot(page);
        }
        await page.waitForTimeout(800);
        const s = await save(page, saveKey);
        if ((s?.stats?.cowsKilled ?? 0) > 0) killed = true;
        else {
          // 牛會遊走：追一下最近距離
          await steerTo(page, { x: 8.5, z: 3.2 }, 1200, 1.5);
        }
      }
      if (killed) mark("firstCowKill");
      await page.screenshot({ path: resolve(outDir, `${phase}-${viewport.id}-04-cow-kill.png`) });
      entry.first60.killHud = await hudSnapshot(page);
      // 撿肉：在牧場附近繞圈
      const position = (await debug(page))?.playerPosition ?? { x: 7, z: 3 };
      for (const [ox, oz] of [[0.9, 0], [0, 0.9], [-0.9, 0], [0, -0.9], [1.2, 1.2], [-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2]]) {
        await steerTo(page, { x: position.x + ox, z: position.z + oz }, 1300, 0.4);
      }
      mark("meatPickup");
      await steerTo(page, { x: -8, z: -5.6 }, 14_000, 1.2);
      mark("reachedStall");
      await page.waitForTimeout(6500);
      const afterSale = await save(page, saveKey);
      mark("afterWaitingForSale");
      entry.first60.timeline = timeline;
      entry.first60.salesAfter = afterSale?.stats?.sales ?? null;
      entry.first60.meatDeposited = afterSale?.stats?.meatDeposited ?? null;
      entry.first60.money = afterSale?.money ?? null;
      entry.first60.chapter = afterSale?.quest?.chapter ?? null;
      await page.screenshot({ path: resolve(outDir, `${phase}-${viewport.id}-05-stall.png`) });
      entry.first60.stallHud = await hudSnapshot(page);
    } else {
      await tap(page, "#attack-button", true);
      await page.waitForTimeout(500);
      await page.screenshot({ path: resolve(outDir, `${phase}-${viewport.id}-03-touch-attack.png`) });
      entry.first60.attackHud = await hudSnapshot(page);
    }
    entry.first60.errors = errors.slice(0, 10);
    await context.close();
  }
  // ---- 第 6 波實戰（存檔橋段：只預置波次與建設，戰鬥全由真實輸入進行） ----
  {
    const { context, page, errors } = await newPage(viewport, waveFixture(5));
    await startGame(page, viewport.touch);
    await page.waitForTimeout(800);
    await tap(page, "#wave-button", viewport.touch);
    await page.waitForTimeout(5200);
    // 走到路線前端迎擊
    if (!viewport.touch) {
      await steerTo(page, { x: -5.5, z: 5.5 }, 6000, 1.2);
      if (phase === "after") {
        await page.keyboard.press("KeyQ");
        await page.waitForTimeout(1400);
        await page.screenshot({ path: resolve(outDir, `${phase}-${viewport.id}-05b-bait.png`) });
        entry.wave.baitHud = await hudSnapshot(page);
      }
      await page.keyboard.down("Space");
      await page.waitForTimeout(2600);
      await page.screenshot({ path: resolve(outDir, `${phase}-${viewport.id}-06-wave-combat.png`) });
      entry.wave.combatHud = await hudSnapshot(page);
      await page.waitForTimeout(5000);
      await page.keyboard.up("Space");
    } else {
      if (phase === "after") {
        await page.waitForSelector("#bait-button:not([hidden])", { timeout: 8000 }).catch(() => {});
        await tap(page, "#bait-button", true).catch(() => {});
        await page.waitForTimeout(1400);
        await page.screenshot({ path: resolve(outDir, `${phase}-${viewport.id}-05b-bait.png`) });
        entry.wave.baitHud = await hudSnapshot(page);
      }
      for (let index = 0; index < 6; index += 1) { await tap(page, "#attack-button", true); await page.waitForTimeout(450); }
      await page.screenshot({ path: resolve(outDir, `${phase}-${viewport.id}-06-wave-combat.png`) });
      entry.wave.combatHud = await hudSnapshot(page);
      await page.waitForTimeout(5000);
    }
    await page.screenshot({ path: resolve(outDir, `${phase}-${viewport.id}-07-wave-late.png`) });
    entry.wave.lateHud = await hudSnapshot(page);
    // 等待波次結束（最長 50 秒）
    const waveStart = Date.now();
    await page.waitForFunction(() => window.__stormDebug && window.__stormDebug.enemies === 0, undefined, { timeout: 50_000 }).catch(() => {});
    entry.wave.endSeconds = Number(((Date.now() - waveStart) / 1000).toFixed(1));
    await page.waitForTimeout(1300);
    await page.screenshot({ path: resolve(outDir, `${phase}-${viewport.id}-08-wave-clear.png`) });
    entry.wave.clearHud = await hudSnapshot(page);
    entry.wave.errors = errors.slice(0, 10);
    await context.close();
  }
  console.log(`done ${viewport.id}`);
}

await browser.close();
report.finishedAt = new Date().toISOString();
await writeFile(resolve(outDir, `${phase}-report.json`), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, (key, value) => (key === "debug" ? undefined : value), 1).slice(0, 6000));
