import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const url = "http://127.0.0.1:4178/storm-apocalypse/";
const saveKey = "storm-apocalypse-save-v1";
const shotDir = new URL("./shots/", import.meta.url);
const resultPath = new URL("./victory-ui-bridge.json", import.meta.url);
await mkdir(shotDir, { recursive: true });

const victorySave = {
  version:5,money:10250,wave:30,baseHealth:18,stallLevel:4,towerBuilt:true,bestWave:30,weapon:"axe",
  weapons:{machete:true,axe:true,smg:true},protagonistId:"vet_sniper",employees:{hunter:2,cashier:2,dog:2},
  customerAffinity:{lao_zhou:10,nurse_lin:10,kid_bao:10,scout_he:10},customerRewardsClaimed:["all"],customerAffinityWave:30,
  customerAffinityGained:{lao_zhou:0,nurse_lin:0,kid_bao:0,scout_he:0},pasture2Unlocked:true,towers:{ballista:3,frost:3,cannon:3},
  quest:{chapter:15,completed:Array.from({length:15},(_,i)=>i+1),unlocks:["final-alert"],loop:null},
  stats:{pastureVisited:true,cowsKilled:27,meatCollected:75,meatDeposited:70,sales:60,totalEarned:10167,zombiesKilled:543,playerKills:130,towerKills:413,damageDealt:6200,damageTaken:82,wavesCleared:30,campaignWins:1},lastSavedAt:Date.now(),
};

const browser = await chromium.launch({ headless:false, args:["--use-angle=d3d11"] });
const context = await browser.newContext({ viewport:{width:1366,height:768}, deviceScaleFactor:1 });
await context.addInitScript(({key,value}) => {
  if (sessionStorage.getItem("playtest-victory-ui-bridge") !== "injected") {
    localStorage.setItem(key, JSON.stringify(value));
    sessionStorage.setItem("playtest-victory-ui-bridge", "injected");
  }
}, {key:saveKey,value:victorySave});
const page = await context.newPage();
const diagnostics=[];
page.on("pageerror",e=>diagnostics.push(e.message));
page.on("console",m=>{if(m.type()==="error")diagnostics.push(m.text());});
await page.goto(url,{waitUntil:"domcontentloaded",timeout:180000});
await page.locator("#start-button").waitFor({state:"visible",timeout:180000});
await page.waitForFunction(()=>!document.querySelector("#start-button")?.hasAttribute("disabled"),undefined,{timeout:180000});
await page.locator("#start-button").click();
await page.locator("#intro").waitFor({state:"hidden",timeout:30000});

// 協議允許的明示注入橋段：只把已存在的結果 modal 填入勝利資料並切到可見；按鈕仍走產品自己的真實 click listener。
await page.evaluate(() => {
  const result=document.querySelector("#result");
  const gameUi=document.querySelector("#game-ui");
  const title=document.querySelector("#result-title");
  const copy=document.querySelector("#result-copy");
  const stats=document.querySelector("#result-stats");
  if (!(result instanceof HTMLElement)||!(gameUi instanceof HTMLElement)||!(title instanceof HTMLElement)||!(copy instanceof HTMLElement)||!(stats instanceof HTMLElement)) throw new Error("result modal missing");
  title.textContent="黎明仍在";
  copy.textContent="第三十次鐘聲穿過風牆，北境肉舖仍在營業。你成為「北境守望者」。 三十聲，一聲不差。槍管涼下來的時候，雪也停了。";
  const values=[["守過波次","30 / 30"],["累計擊殺","543"],["獵物","27"],["累計總收入","✦ 10167"],["剩餘資金","✦ 10250"],["本輪時間","18 分"]];
  stats.replaceChildren(...values.map(([label,value])=>{const item=document.createElement("div");const small=document.createElement("small");const strong=document.createElement("b");small.textContent=label;strong.textContent=value;item.append(small,strong);return item;}));
  result.hidden=false;
  result.classList.add("is-visible");
  gameUi.classList.add("is-modal-hidden");
  gameUi.setAttribute("inert","");
  gameUi.setAttribute("aria-hidden","true");
});
await page.screenshot({path:fileURLToPath(new URL("desktop-64-victory-ui-injection-bridge.png",shotDir)),animations:"disabled",timeout:120000});
const text=await page.locator("#result").innerText();
await page.locator("#result-button").click();
await page.locator("#start-button").waitFor({state:"visible",timeout:180000});
const retained=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)??"null"),saveKey);
await page.screenshot({path:fileURLToPath(new URL("desktop-65-victory-retained-reload-bridge.png",shotDir)),animations:"disabled",timeout:120000});
await writeFile(fileURLToPath(resultPath),JSON.stringify({bridge:"DOM-only victory modal bridge; not a gameplay win",text,retainedWave:retained?.wave,campaignWins:retained?.stats?.campaignWins,diagnostics},null,2),"utf8");
await Promise.race([browser.close(),new Promise(resolve=>setTimeout(resolve,4000))]);
process.exit(0);
