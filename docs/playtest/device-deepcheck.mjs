import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const rootUrl = "http://127.0.0.1:4178/storm-apocalypse/";
const shotDir = new URL("./shots/", import.meta.url);
const resultsPath = new URL("./device-deepcheck.json", import.meta.url);
const saveKey = "storm-apocalypse-save-v1";
const results = [];

await mkdir(shotDir, { recursive: true });

async function persist() {
  await writeFile(fileURLToPath(resultsPath), JSON.stringify(results, null, 2), "utf8");
}

async function closeContext(context) {
  await Promise.race([context.close(), new Promise((resolve) => setTimeout(resolve, 4000))]);
}

const browser = await chromium.launch({
  headless: false,
  args: ["--use-angle=d3d11", "--disable-background-timer-throttling"],
});

function savedFixture() {
  return {
    version: 5,
    money: 330,
    wave: 5,
    baseHealth: 100,
    stallLevel: 2,
    towerBuilt: true,
    bestWave: 5,
    weapon: "axe",
    weapons: { machete: true, axe: true, smg: false },
    protagonistId: "vet_sniper",
    employees: { hunter: 1, cashier: 0, dog: 0 },
    customerAffinity: { lao_zhou: 0, nurse_lin: 2, kid_bao: 1, scout_he: 0 },
    customerRewardsClaimed: [],
    customerAffinityWave: 5,
    customerAffinityGained: { lao_zhou: 0, nurse_lin: 0, kid_bao: 0, scout_he: 0 },
    pasture2Unlocked: true,
    towers: { ballista: 1, frost: 1, cannon: 0 },
    quest: { chapter: 10, completed: [1,2,3,4,5,6,7,8,9], unlocks: ["stall-guide","defense-shop","employee-shop","strong-cattle"], loop: null },
    stats: { pastureVisited: true, cowsKilled: 8, meatCollected: 12, meatDeposited: 12, sales: 8, totalEarned: 295, zombiesKilled: 31, playerKills: 3, towerKills: 28, damageDealt: 438, damageTaken: 0, wavesCleared: 5, campaignWins: 0 },
    lastSavedAt: Date.now(),
  };
}

async function screenshot(page, name) {
  await page.screenshot({ path: fileURLToPath(new URL(name, shotDir)), animations: "disabled", timeout: 120_000 });
}

async function pageFacts(page) {
  return page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    body: document.body.innerText.slice(0, 1200),
    introHidden: document.querySelector("#intro")?.classList.contains("is-out") ?? false,
    fps: document.querySelector("#game-canvas")?.dataset.fps ?? null,
    paused: document.querySelector("#game-canvas")?.dataset.paused ?? null,
    attackCount: Number(document.querySelector("#game-canvas")?.dataset.attackCount ?? 0),
    settingsVisible: !document.querySelector("#system-menu")?.hasAttribute("hidden"),
    shopOpen: document.querySelector("#command-panel")?.classList.contains("is-open") ?? false,
    questOpen: document.querySelector("#quest-panel")?.classList.contains("is-open") ?? false,
    consoleMark: performance.getEntriesByName("storm-first-interactive", "mark")[0]?.startTime ?? null,
  }));
}

async function waitReady(page) {
  await page.locator("#start-button").waitFor({ state: "visible", timeout: 180_000 });
  await page.waitForFunction(() => !document.querySelector("#start-button")?.hasAttribute("disabled"), undefined, { timeout: 180_000 });
}

async function phonePortrait() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    screen: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
    userAgent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/125 Mobile Safari/537.36",
  });
  await context.addInitScript(() => {
    localStorage.clear();
    globalThis.__playtestStart = performance.now();
    globalThis.__loaderSeen = null;
    new MutationObserver(() => {
      if (globalThis.__loaderSeen === null && document.querySelector("#boot-loader")) globalThis.__loaderSeen = performance.now();
    }).observe(document, { childList: true, subtree: true });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  const wallStart = performance.now();
  await page.goto(rootUrl, { waitUntil: "domcontentloaded", timeout: 180_000 });
  const wallDom = performance.now() - wallStart;
  await screenshot(page, "phone-portrait-03-clean-boot.png");
  await waitReady(page);
  const boot = await page.evaluate(() => ({
    scriptStart: globalThis.__playtestStart,
    loaderSeen: globalThis.__loaderSeen,
    interactive: performance.getEntriesByName("storm-first-interactive", "mark")[0]?.startTime ?? null,
  }));
  await page.locator('[data-protagonist="butcher_matron"]').tap();
  await screenshot(page, "phone-portrait-04-touch-selected.png");
  await page.locator("#start-button").tap();
  await page.locator("#intro").waitFor({ state: "hidden", timeout: 30_000 });
  await page.waitForTimeout(800);
  await page.locator("#attack-button").tap();
  await page.waitForTimeout(500);
  const afterAttack = await pageFacts(page);
  await screenshot(page, "phone-portrait-05-touch-gameplay.png");
  await page.locator("#settings-button").tap();
  await page.locator("#system-menu").waitFor({ state: "visible" });
  await screenshot(page, "phone-portrait-06-settings.png");
  await page.locator('[data-system-tab="audio"]').tap();
  await page.locator('[data-system-panel="audio"]').waitFor({ state: "visible" });
  await page.locator("#system-menu-close").tap();
  await page.locator("#shop-toggle").tap();
  const shopOpen = await pageFacts(page);
  await screenshot(page, "phone-portrait-07-prep-open.png");
  await page.locator("#shop-close").tap();
  await page.locator("#quest-toggle").tap();
  const questOpen = await pageFacts(page);
  await screenshot(page, "phone-portrait-08-manual-open.png");
  await page.locator("#quest-close").tap();
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(500);
  const rotated = await pageFacts(page);
  await screenshot(page, "phone-portrait-09-rotated-landscape.png");
  await context.setOffline(true);
  await page.waitForTimeout(1200);
  const offline = await pageFacts(page);
  await context.setOffline(false);
  await page.waitForTimeout(500);
  results.push({ scenario: "phone-portrait", wallDom, boot, afterAttack, shopOpen: shopOpen.shopOpen, questOpen: questOpen.questOpen, rotated, offline, errors });
  await persist();
  await closeContext(context);
}

async function swipe(page, x, fromY, toY) {
  const client = await page.context().newCDPSession(page);
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: fromY }], modifiers: 0 });
  for (let step = 1; step <= 10; step += 1) {
    const y = fromY + (toY - fromY) * step / 10;
    await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }], modifiers: 0 });
    await page.waitForTimeout(18);
  }
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [], modifiers: 0 });
}

async function phoneLandscape() {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 }, screen: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1,
    userAgent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/125 Mobile Safari/537.36",
  });
  await context.addInitScript(() => localStorage.clear());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(rootUrl, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await waitReady(page);
  const before = await page.locator(".character-grid").evaluate((grid) => ({ scrollTop: grid.scrollTop, scrollHeight: grid.scrollHeight, clientHeight: grid.clientHeight }));
  await screenshot(page, "phone-landscape-07-real-swipe-before.png");
  await swipe(page, 580, 300, 105);
  await page.waitForTimeout(550);
  const after = await page.locator(".character-grid").evaluate((grid) => ({ scrollTop: grid.scrollTop, scrollHeight: grid.scrollHeight, clientHeight: grid.clientHeight }));
  const mechanicRect = await page.locator('[data-protagonist="mech_youth"]').boundingBox();
  await screenshot(page, "phone-landscape-08-real-swipe-after.png");
  await page.locator('[data-protagonist="mech_youth"]').tap();
  await page.locator("#start-button").tap();
  await page.locator("#intro").waitFor({ state: "hidden", timeout: 30_000 });
  await screenshot(page, "phone-landscape-09-real-touch-gameplay.png");
  results.push({ scenario: "phone-landscape", before, after, mechanicRect, swipeMoved: after.scrollTop > before.scrollTop + 20, facts: await pageFacts(page), errors });
  await persist();
  await closeContext(context);
}

async function spot(label, viewport, touch) {
  const context = await browser.newContext({ viewport, screen: viewport, isMobile: touch, hasTouch: touch, deviceScaleFactor: 1,
    userAgent: touch ? "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/125 Mobile Safari/537.36" : undefined });
  await context.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: saveKey, value: savedFixture() });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(rootUrl, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await waitReady(page);
  if (touch) await page.locator("#start-button").tap(); else await page.locator("#start-button").click();
  await page.locator("#intro").waitFor({ state: "hidden", timeout: 30_000 });
  if (touch) await page.locator("#settings-button").tap(); else await page.locator("#settings-button").click();
  await page.locator("#system-menu").waitFor({ state: "visible" });
  if (touch) await page.locator('[data-system-tab="system"]').tap(); else await page.locator('[data-system-tab="system"]').click();
  await screenshot(page, `${label}-03-settings-system-spot.png`);
  const metrics = await page.locator(".system-menu__card").evaluate((card) => ({
    rect: card.getBoundingClientRect().toJSON(), scrollHeight: card.scrollHeight, clientHeight: card.clientHeight,
    confirmVisible: !document.querySelector("#reset-save-open")?.hasAttribute("disabled"),
  }));
  if (touch) await page.locator("#system-menu-close").tap(); else await page.keyboard.press("Escape");
  results.push({ scenario: label, metrics, closed: await page.locator("#system-menu").isHidden(), facts: await pageFacts(page), errors });
  await persist();
  await closeContext(context);
}

try {
  await phonePortrait();
  await phoneLandscape();
  await spot("laptop-short", { width: 1366, height: 600 }, false);
  await spot("tablet", { width: 768, height: 1024 }, true);
} finally {
  await persist();
  await Promise.race([browser.close(), new Promise((resolve) => setTimeout(resolve, 4000))]);
}

console.log(JSON.stringify(results, null, 2));
