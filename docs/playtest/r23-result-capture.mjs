// R23 結算頁實錄：存檔橋段只預置「第 29 波、壁壘 1%、一座弩塔」，之後真實點擊啟動第 30 波且不防守，
// 由殭屍實際打空壁壘進入敗北結算，擷取戰報拆解與「下一局建議」。headless。
// 用法：node docs/playtest/r23-result-capture.mjs <輸出資料夾> [before|after]
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const outDir = resolve(process.argv[2] ?? "docs/evidence/r23/playtest");
const phase = process.argv[3] ?? "after";
const url = process.env.PLAYTEST_URL ?? "http://127.0.0.1:5101/storm-apocalypse/";
const save = {
  version: 5, money: 120, wave: 29, baseHealth: 1, stallLevel: 1, towerBuilt: true, bestWave: 29,
  weapon: "machete", protagonistId: "vet_sniper", requiresProtagonistSelection: false,
  weapons: { machete: true, axe: false, smg: false }, employees: { hunter: 0, cashier: 0, dog: 0 }, pasture2Unlocked: false,
  towers: { ballista: 1, frost: 0, cannon: 0 },
  quest: { chapter: 15, completed: Array.from({ length: 14 }, (_, index) => index + 1), unlocks: ["stall-guide", "defense-shop"], loop: null },
  stats: { pastureVisited: true, cowsKilled: 30, meatCollected: 90, meatDeposited: 90, sales: 40, totalEarned: 4000, zombiesKilled: 400, playerKills: 30, towerKills: 370, damageDealt: 3000, damageTaken: 900, wavesCleared: 29, campaignWins: 0 },
  lastSavedAt: 0,
};
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--use-angle=d3d11", "--mute-audio"] });
const report = {};
for (const viewport of [{ id: "desktop-1366x768", width: 1366, height: 768, touch: false }, { id: "phone-portrait-390x844", width: 390, height: 844, touch: true }]) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, hasTouch: viewport.touch, isMobile: viewport.touch, locale: "zh-TW" });
  await context.addInitScript(([value]) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("storm-apocalypse-save-v1", value); sessionStorage.setItem("seeded", "1"); } }, [JSON.stringify(save)]);
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction(() => !document.querySelector("#start-button")?.disabled && document.querySelector("#intro")?.classList.contains("is-ready"), undefined, { timeout: 180_000 });
  if (viewport.touch) await page.locator("#start-button").tap(); else await page.locator("#start-button").click();
  await page.waitForTimeout(1200);
  if (viewport.touch) await page.locator("#wave-button").tap(); else await page.locator("#wave-button").click();
  await page.waitForSelector("#result:not([hidden])", { timeout: 90_000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: resolve(outDir, `${phase}-${viewport.id}-09-result.png`) });
  report[viewport.id] = await page.evaluate(() => ({
    title: document.querySelector("#result-title")?.textContent,
    stats: [...document.querySelectorAll("#result-stats div")].map((item) => item.textContent),
    advice: document.querySelector(".result-advice")?.textContent ?? null,
  }));
  await context.close();
}
await browser.close();
await writeFile(resolve(outDir, `${phase}-result-report.json`), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 1));
