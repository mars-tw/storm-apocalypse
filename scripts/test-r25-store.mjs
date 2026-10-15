import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const evidence = 'docs/evidence/r25-store';
const shots = 'docs/store/screenshots';
await mkdir(shots, { recursive: true });
await mkdir(evidence, { recursive: true });
const results = [], requests = new Set();
let completed = false;
const check = (name, pass, detail) => { results.push({ name, pass, detail }); assert.ok(pass, `${name}: ${JSON.stringify(detail)}`); console.log(`PASS ${name}`); };
const server = await createServer({ server: { host: '127.0.0.1', port: 5195, strictPort: true, hmr:false, watch:{ignored:['**/.audit-tmp/**','**/docs/**']} }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--mute-audio'] });
const save = page => page.evaluate(() => JSON.parse(localStorage.getItem('storm-apocalypse-save-v1')));
async function boot(page) {
  await page.goto('http://127.0.0.1:5195/storm-apocalypse/?smoke=1');
  await page.locator('#start-button').waitFor({ state: 'visible', timeout: 180000 });
  await page.locator('#start-button').click();
  await page.locator('#intro').waitFor({ state: 'detached', timeout: 180000 });
  await page.waitForFunction(() => window.__stormDebug?.playerPosition, undefined, { timeout: 180000 });
}
async function reachable(page, selectors) {
  return page.evaluate(selectors => selectors.map(s => {
    const el = document.querySelector(s), r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    return { selector:s, width:r.width, height:r.height, inside:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight, hit:el===hit||el.contains(hit) };
  }), selectors);
}
try {
  for (const device of [
    { name:'iphone-se', width:375, height:667, scale:1 },
    { name:'iphone-store', width:430, height:932, scale:3 },
    { name:'ipad-13-store', width:1032, height:1376, scale:2 },
    { name:'ipad-landscape', width:1376, height:1032, scale:1 },
    { name:'ipad-classic', width:768, height:1024, scale:1 },
  ].filter(()=>!process.env.STORE_OFFLINE_ONLY)) {
    const context = await browser.newContext({ viewport:{width:device.width,height:device.height}, deviceScaleFactor:device.scale, hasTouch:true, isMobile:device.width<600 });
    const page = await context.newPage(), errors=[];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => requests.add(r.url()));
    const started = Date.now();
    await boot(page);
    const prefix = `${device.name}`;
    check(`${prefix} cold start has no injected save`, (await save(page)).wave === 0);
    await page.locator('[data-layout="west"]').tap();
    const west = await page.evaluate(() => JSON.parse(localStorage.getItem('storm-apocalypse-layout-v1')));
    check(`${prefix} layout selection saves without spending`, west.id === 'west' && (await save(page)).money === 35);
    await page.locator('[data-layout="center"]').tap();
    const controls = await reachable(page,['[data-layout="west"]','[data-layout="center"]','[data-layout="east"]','#layout-launch','#settings-button']);
    check(`${prefix} route choices and pause reachable`, controls.every(r=>r.width>=44&&r.height>=44&&r.inside&&r.hit), controls);
    check(`${prefix} no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const promptBounds=await page.locator('#context-prompt').boundingBox();
    check(`${prefix} touch hint never stretches into a vertical panel`, promptBounds.height <= 64, promptBounds);
    await page.screenshot({ path:`${evidence}/${prefix}-layout.png` });
    if (device.scale > 1) await page.screenshot({ path:`${shots}/${prefix}-01-layout.png` });
    await page.locator('#layout-launch').tap();
    await page.waitForFunction(() => window.__stormDebug?.feedback?.baitedZombies >= 2, undefined, { timeout:90000 });
    const metrics = await page.evaluate(() => ({ feedback:window.__stormDebug.feedback, audio:window.__stormAudio }));
    check(`${prefix} real enemies attracted by authored layout`, metrics.feedback.baitsThrown === 1 && metrics.feedback.baitedZombies >= 2, metrics);
    check(`${prefix} dedicated layout and commission sounds are triggered`, metrics.audio.counts.baitAim >= 2 && metrics.audio.counts.commission >= 1, metrics.audio.counts);
    check(`${prefix} starter tower and goal persisted`, (await save(page)).towers.ballista === 1 && await page.evaluate(() => JSON.parse(localStorage.getItem('storm-apocalypse-layout-v1')).completed));
    const elapsedMs = Date.now()-started;
    check(`${prefix} signature objective within three minutes`, elapsedMs < 180000, { elapsedMs, limitation:'並發載量測，僅供參考' });
    await page.waitForTimeout(700);
    await page.screenshot({ path:`${evidence}/${prefix}-lured.png` });
    if (device.scale > 1) await page.screenshot({ path:`${shots}/${prefix}-02-lured.png` });
    // Collapse the card so the combat view and existing thumb controls stay clear.
    check(`${prefix} layout collapses to reveal real combat`, !await page.locator('#bait-layout').evaluate(e=>e.open));
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('storm-apocalypse-save-v1'))?.wave >= 1, undefined, { timeout:120000 }).catch(async error=>{
      const detail=await page.evaluate(()=>({hidden:document.hidden,intro:!!document.querySelector('#intro'),paused:document.querySelector('#game-canvas')?.getAttribute('data-paused'),save:localStorage.getItem('storm-apocalypse-save-v1'),debug:window.__stormDebug}));
      await page.screenshot({path:`${evidence}/${prefix}-failure.png`});
      results.push({name:`${prefix} natural wave completion`,pass:false,detail});
      console.log(JSON.stringify(detail));throw error;
    });
    const cleared = await save(page);
    check(`${prefix} first wave naturally completed`, cleared.wave === 1 && cleared.bestWave === 1 && cleared.money > 35, cleared);
    await page.locator('#settings-button').tap();
    check(`${prefix} pause freezes simulation`, await page.locator('#game-canvas').getAttribute('data-paused') === 'true');
    await page.locator('[data-system-tab="supply"]').tap();
    const menuControls = await reachable(page,['#resume-button','#system-menu-close','[data-supply="standard"]']);
    check(`${prefix} menu has working return route`, menuControls.every(r=>r.hit&&r.inside&&r.width>=44&&r.height>=44), menuControls);
    if (device.scale > 1) await page.screenshot({ path:`${shots}/${prefix}-03-supply.png` });
    await page.locator('#resume-button').tap();
    check(`${prefix} resume restores simulation`, await page.locator('#game-canvas').getAttribute('data-paused') === 'false');
    await page.reload();
    await page.locator('#start-button').waitFor({state:'visible',timeout:180000});
    await page.locator('#start-button').click();
    await page.waitForFunction(() => window.__stormDebug?.playerPosition,undefined,{timeout:180000});
    const reloaded = await save(page);
    check(`${prefix} reopen keeps wave, money, tower and tactical goal`, reloaded.wave===cleared.wave&&reloaded.money===cleared.money&&reloaded.towers.ballista===1&&await page.evaluate(()=>JSON.parse(localStorage.getItem('storm-apocalypse-layout-v1')).completed));
    if (device.name === 'iphone-se') {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Page.setWebLifecycleState',{state:'frozen'});
      await new Promise(resolve=>setTimeout(resolve,250));
      await cdp.send('Page.setWebLifecycleState',{state:'active'});
      await page.locator('#settings-button').tap();
      check('browser freeze and restore retain progress and usable pause', (await save(page)).wave===1 && await page.locator('#system-menu').isVisible());
      await page.locator('#resume-button').tap();
    }
    check(`${prefix} no runtime errors`, errors.length===0, errors);
    await context.close();
  }
  // A native WebView resolves bundled files locally. Fulfil the built package
  // from disk with the browser offline; no remote fallback or network server.
  const offline = await browser.newContext({ viewport:{width:430,height:932}, offline:true, hasTouch:true });
  await offline.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://storm.local') return route.abort();
    const path = decodeURIComponent(url.pathname).replace(/^\/storm-apocalypse\//,'');
    if (path.includes('..')) return route.abort();
    const ext=path.split('.').at(-1);
    const mime={html:'text/html',js:'application/javascript',css:'text/css',json:'application/json',glb:'model/gltf-binary',png:'image/png',svg:'image/svg+xml',ogg:'audio/ogg',webp:'image/webp'}[ext];
    try { await route.fulfill({ body:await readFile(`dist/${path||'index.html'}`),contentType:mime }); } catch { await route.abort(); }
  });
  const p=await offline.newPage(), offlineErrors=[];
  p.setDefaultTimeout(180000);
  p.on('pageerror',e=>{offlineErrors.push(e.message);console.log(`OFFLINE error ${e.message}`);});
  p.on('console',m=>{if(m.type()==='error') console.log(`OFFLINE console ${m.text()}`);});
  p.on('requestfailed',r=>console.log(`OFFLINE request failed ${r.url()} ${r.failure()?.errorText}`));
  await p.goto('http://storm.local/storm-apocalypse/');
  await p.locator('#start-button:not(:disabled)').waitFor({state:'visible',timeout:180000});
  await p.locator('#start-button').click();
  await p.locator('#layout-launch').tap();
  await p.waitForFunction(()=>JSON.parse(localStorage.getItem('storm-apocalypse-layout-v1'))?.completed,undefined,{timeout:90000});
  check('built package offline plays signature objective using local files',offlineErrors.length===0,offlineErrors);
  await p.screenshot({path:`${evidence}/offline-built-package.png`});
  await offline.close();
  check('runtime requests stay on local game origin', [...requests].every(url=>url.startsWith('http://127.0.0.1:5195/')||url.startsWith('data:')||url.startsWith('blob:')||url.startsWith('ws://127.0.0.1:5195/')), [...requests].filter(url=>!url.includes('127.0.0.1')));
  completed = true;
} finally {
  await writeFile(`${evidence}/${process.env.STORE_OFFLINE_ONLY ? 'offline-only' : 'reviewer-path'}.json`,JSON.stringify({status:completed&&results.every(x=>x.pass)?'VERIFIED':'BLOCKED',results,requests:[...requests]},null,2));
  await browser.close(); await server.close();
}
