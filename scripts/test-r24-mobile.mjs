import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const before = process.argv.includes('--before');
const evidence = 'docs/evidence/r24-mobile';
const key = 'storm-apocalypse-save-v1';
const fixture = (wave = 2) => ({ version: 5, money: 9999, wave, baseHealth: 63, stallLevel: 4,
  bestWave: wave, protagonistId: 'butcher_matron', weapon: 'smg', weapons: { machete: true, axe: true, smg: true },
  towers: { ballista: 0, frost: 3, cannon: 0 }, employees: {},
  quest: { chapter: 15, completed: Array.from({ length: 14 }, (_, i) => i + 1), unlocks: ['defense-shop', 'tower-upgrade'], loop: null },
  stats: {}, lastSavedAt: 0 });
const results = [];
const check = (name, pass, detail) => { results.push({ name, pass, detail }); assert.ok(pass, `${name}: ${JSON.stringify(detail)}`); console.log(`PASS ${name}`); };
const feedback = page => page.evaluate(() => window.__stormDebug?.feedback);
const save = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
async function touch(cdp, type, points = []) {
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(p => ({ ...p, radiusX: 4, radiusY: 4, force: 1 })) });
}
async function center(locator) { const b = await locator.boundingBox(); assert.ok(b); return { x: b.x + b.width / 2, y: b.y + b.height / 2, id: 1 }; }
async function controls(page, selectors) {
  return page.evaluate(selectors => selectors.map(selector => {
    const e = document.querySelector(selector), b = e?.getBoundingClientRect();
    const hit = b && document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    return { selector, width: b?.width, height: b?.height, inside: b && b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight, hit: e && (e === hit || e.contains(hit)) };
  }), selectors);
}
await mkdir(evidence, { recursive: true });
const server = await createServer({ root: before ? '.audit-tmp/r24-before' : process.cwd(), server: { host: '127.0.0.1', port: 5187, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--mute-audio'] });
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1366, height: 600 }]) {
    const label = `${viewport.width}x${viewport.height}`;
    const context = await browser.newContext({ viewport, hasTouch: true, isMobile: viewport.width < 1000, deviceScaleFactor: 1 });
    await context.addInitScript(({ key, save }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(save)); }, { key, save: fixture() });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5187/storm-apocalypse/?smoke=1');
    await page.locator('#start-button').waitFor({ state: 'visible', timeout: 180000 });
    await page.locator('#start-button').click();
    await page.locator('#intro').waitFor({ state: 'detached', timeout: 15000 });
    await page.waitForFunction(() => window.__stormDebug?.playerPosition, undefined, { timeout: 180000 });
    await page.screenshot({ path: `${evidence}/${before ? 'before' : 'after'}-${label}-day.png` });
    if (before) {
      await page.locator('#wave-button').tap();
      await page.locator('#bait-button').waitFor({ state: 'visible' });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${evidence}/before-${label}-wave.png` });
    } else {
      const cdp = await context.newCDPSession(page);
      const initial = await save(page);
      await page.locator('[data-tower-dock="ballista"]').tap();
      await page.waitForFunction(() => window.__stormDebug?.feedback?.towerPreview === 'ballista', undefined, { timeout: 5000 }).catch(async error => {
        await page.screenshot({ path: `${evidence}/failure-${label}-tower.png` });
        console.log(JSON.stringify(await page.evaluate(() => ({ feedback: window.__stormDebug?.feedback, modal: document.querySelector('#app').dataset.modal, hidden: document.querySelector('#world-action-popover').hidden, trace: window.__r24HideTrace }))));
        throw error;
      });
      check(`${label} tower preview does not spend money`, (await save(page)).money === initial.money && (await save(page)).towers.ballista === 0);
      const towerControls = await controls(page, ['#world-action-button', '#world-action-cancel', '#settings-button']);
      check(`${label} tower confirm, cancel and pause are reachable`, towerControls.every(c => c.inside && c.hit && c.width >= 44 && c.height >= 44), towerControls);
      await page.screenshot({ path: `${evidence}/after-${label}-tower-preview.png` });
      await page.locator('#world-action-cancel').tap();
      check(`${label} cancelling tower preserves money`, (await save(page)).money === initial.money);
      await page.locator('[data-tower-dock="ballista"]').tap();
      await page.locator('[data-tower-dock="cannon"]').tap();
      check(`${label} tower preview switches without spending`, await page.locator('#world-action-popover').getAttribute('data-action-id') === 'cannon' && (await save(page)).money === initial.money);
      await page.locator('[data-tower-dock="ballista"]').tap();
      await page.locator('#world-action-button').tap();
      const built = await save(page);
      check(`${label} confirming builds exactly one level`, built.towers.ballista === 1 && built.money < initial.money, { money: built.money, level: built.towers.ballista });
      check(`${label} confirmation closes after purchase`, await page.locator('#world-action-popover').isHidden());
      await page.locator('#settings-button').tap();
      await page.locator('[data-system-tab="supply"]').tap();
      check(`${label} unavailable supplies remain locked`, await page.locator('[data-supply="ration"]').isDisabled() && await page.locator('[data-supply="bounty"]').isDisabled());
      const supplyControls = await controls(page, ['#system-menu-close', '#resume-button', '[data-supply="standard"]']);
      check(`${label} supply menu can always return`, supplyControls.every(c => c.inside && c.hit && c.height >= 44 && c.width >= 44), supplyControls);
      const textFits = await page.locator('#system-panel-supply').evaluate(panel => {
        const b = panel.getBoundingClientRect();
        return [...panel.children].every(e => { const r = e.getBoundingClientRect(); return r.top >= b.top - 1 && r.bottom <= b.bottom + 1; });
      });
      check(`${label} all new supply text fits the panel`, textFits);
      await page.screenshot({ path: `${evidence}/after-${label}-supply-locked.png` });
      await page.locator('#resume-button').tap();
      await page.locator('#wave-button').tap();
      await page.locator('#bait-button').waitFor({ state: 'visible' });
      await page.waitForFunction(() => window.__stormDebug?.feedback?.waveEvent === 'hungry_rush');
      await page.waitForFunction(() => window.__stormDebug?.feedback?.enemyTypes.includes('runner'));
      check(`${label} new wave actually spawns runners`, (await feedback(page)).enemyTypes.includes('runner'), await feedback(page));
      const b = await center(page.locator('#bait-button'));
      const baseline = await feedback(page);
      await page.evaluate(() => {
        window.__r24TouchTrace = [];
        for (const kind of ['pointerdown', 'pointerup', 'pointercancel', 'lostpointercapture']) document.addEventListener(kind, e => window.__r24TouchTrace.push([kind, e.pointerId, e.target.id, document.querySelector('#bait-aim-hint').hidden]), true);
      });
      // Real CDP touch cancellation, with a second finger that must not steal aim.
      await touch(cdp, 'touchStart', [b]);
      await touch(cdp, 'touchMove', [{ ...b, x: b.x - 60, y: b.y - 55 }]);
      await page.waitForFunction(() => window.__stormDebug?.feedback?.baitAim);
      await touch(cdp, 'touchStart', [{ ...b, x: b.x - 60, y: b.y - 55 }, { ...b, id: 2 }]);
      await touch(cdp, 'touchMove', [{ ...b, x: b.x - 60, y: b.y - 55 }]);
      check(`${label} second touch does not end active aim`, await page.locator('#bait-aim-hint').isVisible(), await page.evaluate(() => window.__r24TouchTrace));
      await touch(cdp, 'touchCancel');
      await page.waitForTimeout(600);
      check(`${label} touchcancel spends no bait or cooldown`, (await feedback(page)).baitsThrown === baseline.baitsThrown && (await feedback(page)).baitCooldown === 0);
      await touch(cdp, 'touchStart', [b]);
      const cancel = await center(page.locator('#bait-cancel-zone'));
      await touch(cdp, 'touchMove', [cancel]);
      await touch(cdp, 'touchEnd');
      await page.waitForTimeout(600);
      check(`${label} cancel zone spends no resources`, (await feedback(page)).baitsThrown === baseline.baitsThrown && (await feedback(page)).baitScraps === baseline.baitScraps);
      await touch(cdp, 'touchStart', [b]);
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      await touch(cdp, 'touchCancel');
      check(`${label} focus loss cancels aiming`, await page.locator('#bait-aim-hint').isHidden());
      await touch(cdp, 'touchStart', [b]);
      await page.setViewportSize({ width: viewport.height, height: viewport.width });
      await touch(cdp, 'touchCancel');
      check(`${label} rotation cancels aiming without throwing`, await page.locator('#bait-aim-hint').isHidden() && (await feedback(page)).baitsThrown === 0);
      await page.setViewportSize(viewport);
      await page.waitForTimeout(300);
      await touch(cdp, 'touchStart', [b]);
      await page.keyboard.press('Escape');
      check(`${label} pause cancels captured aiming`, await page.locator('#bait-aim-hint').isHidden());
      await touch(cdp, 'touchCancel');
      await page.locator('#resume-button').tap();
      await touch(cdp, 'touchStart', [b]);
      await touch(cdp, 'touchMove', [{ ...b, x: b.x - 55, y: b.y - 85 }]);
      await page.waitForTimeout(600);
      const aimed = (await feedback(page)).baitAim;
      check(`${label} aiming exposes a bounded landing point`, aimed && Number.isFinite(aimed.x) && Math.abs(aimed.x) <= 24 && Math.abs(aimed.z) <= 20, aimed);
      await page.screenshot({ path: `${evidence}/after-${label}-bait-aim.png` });
      await touch(cdp, 'touchEnd');
      await page.waitForFunction(() => window.__stormDebug?.feedback?.baitsThrown === 1);
      const thrown = await feedback(page);
      check(`${label} release throws at the previewed position exactly once`, thrown.baitsThrown === 1 && thrown.baitCooldown > 0 && Math.hypot(thrown.baitPosition.x - aimed.x, thrown.baitPosition.z - aimed.z) < 0.01, thrown);
      await touch(cdp, 'touchStart', [b]);
      await touch(cdp, 'touchEnd');
      await page.waitForTimeout(600);
      check(`${label} cooldown prevents repeat touch throws`, (await feedback(page)).baitsThrown === 1);
      const combatControls = await controls(page, ['#settings-button', '#bait-button', '#attack-button', '#weapon-button']);
      check(`${label} combat touch controls are reachable`, combatControls.every(c => c.inside && c.hit && c.height >= 44 && c.width >= 44), combatControls);
      await page.screenshot({ path: `${evidence}/after-${label}-wave.png` });
    }
    check(`${label} runtime has no page errors`, errors.length === 0, errors);
    await context.close();
  }
  if (!before) {
    async function scenario(wave, profile) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
      const initial = fixture(wave);
      initial.towers = { ballista: 3, frost: 3, cannon: 3 };
      await context.addInitScript(({ key, initial, profile }) => {
        if (sessionStorage.getItem('r24-seeded')) return;
        sessionStorage.setItem('r24-seeded', '1');
        localStorage.setItem(key, JSON.stringify(initial));
        if (profile) localStorage.setItem('storm-apocalypse-patrol-v1', JSON.stringify(profile));
      }, { key, initial, profile });
      const page = await context.newPage();
      await page.goto('http://127.0.0.1:5187/storm-apocalypse/?smoke=1');
      await page.locator('#start-button').waitFor({ state: 'visible', timeout: 180000 });
      await page.locator('#start-button').click();
      await page.locator('#intro').waitFor({ state: 'detached' });
      return { context, page };
    }
    // Earn the first unlock through a real complete wave, without a progress fixture.
    const natural = await scenario(0);
    const page = natural.page;
    await page.locator('#wave-button').tap();
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).wave === 1, key, { timeout: 60000 });
    const earned = await page.evaluate(() => JSON.parse(localStorage.getItem('storm-apocalypse-patrol-v1')));
    check('natural clear awards first permanent stamp', JSON.stringify(earned?.completedWaves) === '[1]', earned);
    await page.locator('#settings-button').tap();
    await page.locator('[data-system-tab="supply"]').tap();
    check('first stamp unlocks the bait bag in actual UI', await page.locator('[data-supply="ration"]').isEnabled());
    await page.locator('[data-supply="ration"]').tap();
    check('selecting unlocked supply persists immediately', await page.locator('[data-supply="ration"]').getAttribute('aria-pressed') === 'true');
    await page.screenshot({ path: `${evidence}/after-390x844-supply-earned.png` });
    await page.locator('#resume-button').tap();
    await page.reload();
    await page.locator('#start-button').click({ timeout: 180000 });
    await page.locator('#intro').waitFor({ state: 'detached' });
    await page.locator('#wave-button').tap();
    await page.waitForFunction(() => window.__stormDebug?.feedback?.baitScraps === 2);
    check('reloaded bait bag gives two actual free throws', (await feedback(page)).supply === 'ration');
    await page.locator('#bait-button').tap();
    await page.waitForFunction(() => window.__stormDebug?.feedback?.baitsThrown === 1);
    check('quick tap still throws without dragging', (await feedback(page)).baitScraps === 1);
    await page.locator('#settings-button').tap();
    await page.locator('[data-system-tab="supply"]').tap();
    check('supplies cannot change mid-wave', await page.locator('[data-supply="standard"]').isDisabled());
    await page.locator('[data-system-tab="system"]').tap();
    await page.locator('#reset-save-open').tap();
    await page.locator('#reset-save-confirm').tap();
    await page.locator('#character-select').waitFor({ state: 'visible', timeout: 180000 });
    const retained = await page.evaluate(() => JSON.parse(localStorage.getItem('storm-apocalypse-patrol-v1')));
    check('actual campaign reset retains stamps and chosen supply', retained.selected === 'ration' && JSON.stringify(retained.completedWaves) === '[1]', retained);
    await natural.context.close();

    const repair = await scenario(0, { completedWaves: [1, 2, 3], selected: 'repair' });
    await repair.page.locator('#wave-button').tap();
    await repair.page.waitForFunction(() => window.__stormDebug?.feedback?.supply === 'repair');
    check('repair crate adds six actual wall HP at wave start', (await save(repair.page)).baseHealth === 81, await save(repair.page));
    await repair.context.close();

    const bounty = await scenario(0, { completedWaves: [1, 2, 3, 4, 5], selected: 'bounty' });
    await bounty.page.locator('#wave-button').tap();
    await bounty.page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).wave === 1, key, { timeout: 60000 });
    check('bounty certificate adds fifteen to actual clear reward', (await bounty.page.locator('.wave-report dd').last().innerText()) === '✦34');
    check('repeating an already stamped wave gives no duplicate', (await feedback(bounty.page)).patrolStamps === 5);
    await bounty.context.close();

    const haulers = await scenario(6, { completedWaves: [1], selected: 'ration' });
    await haulers.page.locator('#wave-button').tap();
    await haulers.page.waitForFunction(() => window.__stormDebug?.feedback?.enemyTypes.includes('brute'));
    check('hauler encounter actually spawns an animated brute', (await feedback(haulers.page)).waveEvent === 'haulers');
    await haulers.page.screenshot({ path: `${evidence}/after-390x844-wave7-haulers.png` });
    await haulers.context.close();
  }
} finally {
  await writeFile(`${evidence}/${before ? 'before' : 'mobile'}-results.json`, JSON.stringify({ results, passed: results.filter(r => r.pass).length }, null, 2));
  await browser.close();
  await server.close();
}
