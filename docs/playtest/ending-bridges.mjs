import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const url = "http://127.0.0.1:4178/storm-apocalypse/";
const saveKey = "storm-apocalypse-save-v1";
const shotDir = new URL("./shots/", import.meta.url);
const resultPath = new URL("./ending-bridges.json", import.meta.url);
const results = [];
await mkdir(shotDir, { recursive: true });

function fixture(kind) {
  const victory = kind === "victory";
  return {
    version: 5,
    money: 9999,
    wave: 29,
    baseHealth: victory ? 100 : 1,
    stallLevel: 4,
    towerBuilt: true,
    bestWave: 29,
    weapon: victory ? "axe" : "machete",
    weapons: { machete: true, axe: true, smg: victory },
    protagonistId: "vet_sniper",
    employees: { hunter: 2, cashier: 2, dog: 2 },
    customerAffinity: { lao_zhou: 10, nurse_lin: 10, kid_bao: 10, scout_he: 10 },
    customerRewardsClaimed: ["all"],
    customerAffinityWave: 29,
    customerAffinityGained: { lao_zhou: 0, nurse_lin: 0, kid_bao: 0, scout_he: 0 },
    pasture2Unlocked: true,
    towers: victory ? { ballista: 3, frost: 3, cannon: 3 } : { ballista: 1, frost: 0, cannon: 0 },
    quest: { chapter: 15, completed: Array.from({ length: 15 }, (_, index) => index + 1), unlocks: ["stall-guide","defense-shop","employee-shop","strong-cattle","tower-upgrade","automation","repair","final-alert"], loop: null },
    stats: { pastureVisited: true, cowsKilled: 25, meatCollected: 75, meatDeposited: 70, sales: 60, totalEarned: 9964, zombiesKilled: 500, playerKills: 125, towerKills: 375, damageDealt: 5000, damageTaken: victory ? 30 : 99, wavesCleared: 29, campaignWins: 0 },
    lastSavedAt: Date.now(),
  };
}

async function persist() {
  await writeFile(fileURLToPath(resultPath), JSON.stringify(results, null, 2), "utf8");
}

async function capture(page, name) {
  await page.screenshot({ path: fileURLToPath(new URL(name, shotDir)), animations: "disabled", timeout: 120_000 });
}

async function openScenario(browser, kind) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
  await context.addInitScript(({ key, value }) => {
    if (sessionStorage.getItem("playtest-ending-bridge") !== "injected") {
      localStorage.setItem(key, JSON.stringify(value));
      sessionStorage.setItem("playtest-ending-bridge", "injected");
    }
  }, { key: saveKey, value: fixture(kind) });
  const page = await context.newPage();
  const diagnostics = [];
  page.on("pageerror", (error) => diagnostics.push({ type: "pageerror", text: error.message }));
  page.on("console", (message) => { if (message.type() === "error") diagnostics.push({ type: "console-error", text: message.text() }); });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await page.locator("#start-button").waitFor({ state: "visible", timeout: 180_000 });
  await page.waitForFunction(() => !document.querySelector("#start-button")?.hasAttribute("disabled"), undefined, { timeout: 180_000 });
  await page.locator("#start-button").click();
  await page.locator("#intro").waitFor({ state: "hidden", timeout: 30_000 });
  await page.waitForTimeout(700);
  return { context, page, diagnostics };
}

async function victory(browser) {
  const { context, page, diagnostics } = await openScenario(browser, "victory");
  await page.keyboard.down("KeyA");
  await page.waitForTimeout(1800);
  await page.keyboard.up("KeyA");
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(600);
  await page.keyboard.up("KeyW");
  await page.locator("#wave-button").click();
  await page.keyboard.down("Space");
  await page.waitForTimeout(2500);
  await capture(page, "desktop-57-wave30-axe-choke-active.png");
  const startedAt = Date.now();
  await page.locator("#result").waitFor({ state: "visible", timeout: 150_000 });
  await page.keyboard.up("Space");
  const elapsedMs = Date.now() - startedAt;
  await capture(page, "desktop-58-wave30-result-bridge.png");
  const result = await page.locator("#result").innerText();
  const won = result.includes("黎明仍在");
  const save = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), saveKey);
  await page.locator("#result-button").click();
  await page.locator("#start-button").waitFor({ state: "visible", timeout: 180_000 });
  await page.waitForFunction(() => !document.querySelector("#start-button")?.hasAttribute("disabled"), undefined, { timeout: 180_000 });
  const retained = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), saveKey);
  await capture(page, "desktop-59-wave30-progress-retained-reload.png");
  results.push({ scenario: "victory-bridge", interaction: "real start-wave, move to shop choke, held axe attack; injected wave 29 fixture", elapsedMs, won, result, saveWave: save?.wave, campaignWins: save?.stats?.campaignWins, retainedWave: retained?.wave, diagnostics });
  await persist();
  await Promise.race([context.close(), new Promise((resolve) => setTimeout(resolve, 4000))]);
}

async function defeatAndClear(browser) {
  const { context, page, diagnostics } = await openScenario(browser, "defeat");
  await page.locator("#wave-button").click();
  await page.waitForTimeout(2500);
  await capture(page, "desktop-60-wave30-defeat-bridge-active.png");
  const startedAt = Date.now();
  await page.locator("#result").waitFor({ state: "visible", timeout: 120_000 });
  const elapsedMs = Date.now() - startedAt;
  await capture(page, "desktop-61-defeat-result-bridge.png");
  const result = await page.locator("#result").innerText();
  const saveBefore = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), saveKey);
  await page.locator("#reset-button").click();
  await page.locator("#result-reset-confirm").waitFor({ state: "visible" });
  await capture(page, "desktop-62-result-clear-stage2.png");
  await page.locator("#result-reset-cancel").click();
  const preservedAfterCancel = await page.evaluate((key) => localStorage.getItem(key) !== null, saveKey);
  await page.locator("#reset-button").click();
  await page.locator("#result-reset-confirm-btn").click();
  await page.locator("#character-select").waitFor({ state: "visible", timeout: 180_000 });
  const cleared = await page.evaluate((key) => localStorage.getItem(key) === null, saveKey);
  await capture(page, "desktop-63-clear-confirmed-character-select.png");
  results.push({ scenario: "defeat-and-clear-bridge", interaction: "real start-wave, no-defense wait, result reset/cancel/reopen/confirm; injected wave 29 low-wall fixture", elapsedMs, result, saveBeforeWave: saveBefore?.wave, savedBaseHealth: saveBefore?.baseHealth, preservedAfterCancel, cleared, diagnostics });
  await persist();
  await Promise.race([context.close(), new Promise((resolve) => setTimeout(resolve, 4000))]);
}

const browser = await chromium.launch({ headless: false, args: ["--use-angle=d3d11", "--disable-background-timer-throttling"] });
try {
  await victory(browser);
  await defeatAndClear(browser);
} finally {
  await persist();
  await Promise.race([browser.close(), new Promise((resolve) => setTimeout(resolve, 4000))]);
}

console.log(JSON.stringify(results, null, 2));
process.exit(0);
