import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
await context.addInitScript(() => localStorage.setItem("storm-apocalypse-save-v1", JSON.stringify({
  version:5,money:100,wave:5,baseHealth:100,stallLevel:1,towerBuilt:true,bestWave:5,weapon:"machete",weapons:{machete:true,axe:false,smg:false},protagonistId:"vet_sniper",employees:{hunter:0,cashier:0,dog:0},customerAffinity:{lao_zhou:0,nurse_lin:0,kid_bao:0,scout_he:0},customerRewardsClaimed:[],customerAffinityWave:5,customerAffinityGained:{lao_zhou:0,nurse_lin:0,kid_bao:0,scout_he:0},pasture2Unlocked:false,towers:{ballista:1,frost:0,cannon:0},quest:{chapter:10,completed:[1,2,3,4,5,6,7,8,9],unlocks:[],loop:null},stats:{pastureVisited:true,cowsKilled:1,meatCollected:3,meatDeposited:3,sales:1,totalEarned:65,zombiesKilled:1,playerKills:0,towerKills:1,damageDealt:1,damageTaken:0,wavesCleared:5,campaignWins:0},lastSavedAt:0
})));
const page = await context.newPage();
await page.goto("http://127.0.0.1:4178/storm-apocalypse/", { waitUntil: "domcontentloaded", timeout: 180000 });
await page.locator("#start-button").waitFor({ state: "visible", timeout:180000 });
const cdp = await context.newCDPSession(page);
await cdp.send("DOM.enable");
await cdp.send("Runtime.enable");
const inspected = await cdp.send("Runtime.evaluate", { expression: "getEventListeners(document.querySelector('#wave-button'))", includeCommandLineAPI: true });
const listenerMap = await props(inspected.result.objectId);
const listenerArrays = [];
for (const entry of listenerMap.result ?? []) {
  if (!entry.value?.objectId || !["pointerdown", "click"].includes(entry.name)) continue;
  const array = await props(entry.value.objectId);
  for (const item of array.result ?? []) {
    if (!item.value?.objectId || !/^\d+$/u.test(item.name)) continue;
    const fields = await props(item.value.objectId);
    const listener = fields.result?.find((field) => field.name === "listener")?.value;
    if (listener?.objectId) listenerArrays.push({ type: entry.name, handler: listener });
  }
}
const listeners = { listeners: listenerArrays };

async function props(objectId) {
  return cdp.send("Runtime.getProperties", { objectId, ownProperties: false, accessorPropertiesOnly: false, generatePreview: true });
}

async function scopeSummary(functionObjectId) {
  const fn = await props(functionObjectId);
  const scopes = fn.internalProperties?.find((entry) => entry.name === "[[Scopes]]")?.value?.objectId;
  if (!scopes) return { fn, scopes: [] };
  const scopeList = await props(scopes);
  const output = [];
  for (const entry of scopeList.result ?? []) {
    if (!entry.value?.objectId) continue;
    const values = await props(entry.value.objectId);
    output.push({ scope: entry.name, values: (values.result ?? []).map((value) => ({ name: value.name, type: value.value?.type, description: value.value?.description, objectId: value.value?.objectId })) });
  }
  return output;
}

const output = [];
for (const listener of listeners.listeners) {
  if (!listener.handler?.objectId) continue;
  output.push({ type: listener.type, handler: listener.handler.description, scopes: await scopeSummary(listener.handler.objectId) });
}
console.log(JSON.stringify(output, null, 2));
await browser.close();
