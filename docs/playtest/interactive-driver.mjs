import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const driverPort = 4180;
const baseUrl = 'http://127.0.0.1:4178/storm-apocalypse/';
const shotsDir = resolve('docs/playtest/shots');
const storagePath = resolve('docs/playtest/session-main.json');

const browser = await chromium.launch({ headless: process.env.PLAYTEST_HEADED !== '1' });
const context = await browser.newContext({
  viewport: { width: 1366, height: 768 },
  screen: { width: 1366, height: 768 },
  locale: 'zh-TW',
  reducedMotion: 'no-preference',
  ...(existsSync(storagePath) ? { storageState: storagePath } : {}),
});
const page = await context.newPage();
const diagnostics = [];
page.on('pageerror', (error) => diagnostics.push({ type: 'pageerror', text: error.message, at: Date.now() }));
page.on('console', (message) => {
  if (['error', 'warning'].includes(message.type())) diagnostics.push({ type: `console-${message.type()}`, text: message.text(), at: Date.now() });
});
page.on('requestfailed', (request) => diagnostics.push({ type: 'requestfailed', text: `${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`, at: Date.now() }));

async function snapshot() {
  return page.evaluate((diag) => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
    };
    const controls = [...document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])')]
      .filter((element) => visible(element))
      .map((element, index) => {
        const rect = element.getBoundingClientRect();
        const text = (element.innerText || element.getAttribute('aria-label') || element.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 220);
        return {
          index,
          tag: element.tagName.toLowerCase(),
          text,
          disabled: Boolean(element.disabled) || element.getAttribute('aria-disabled') === 'true',
          rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
          inViewport: rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth,
        };
      });
    return {
      url: location.href,
      title: document.title,
      viewport: { width: innerWidth, height: innerHeight },
      bodyText: document.body.innerText.trim().replace(/\n{3,}/g, '\n\n').slice(0, 12000),
      controls,
      canvasDataset: { ...(document.querySelector('canvas')?.dataset || {}) },
      marks: performance.getEntriesByType('mark').map((entry) => ({ name: entry.name, startTime: Math.round(entry.startTime) })),
      diagnostics: diag,
    };
  }, diagnostics.slice(-100));
}

function parseBody(request) {
  return new Promise((resolveBody, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) reject(new Error('request body too large'));
    });
    request.on('end', () => {
      if (!body) return resolveBody({});
      try { resolveBody(JSON.parse(body)); } catch (error) { reject(error); }
    });
    request.on('error', reject);
  });
}

function button(name, exact = false) {
  return page.getByRole('button', { name, exact }).filter({ visible: true }).first();
}

async function handle(action) {
  switch (action.type) {
    case 'goto':
      await page.goto(action.url || baseUrl, { waitUntil: action.waitUntil || 'commit', timeout: action.timeout || 45_000 });
      return snapshot();
    case 'wait':
      await page.waitForTimeout(action.ms || 500);
      return snapshot();
    case 'waitText':
      await page.getByText(action.text, { exact: Boolean(action.exact) }).first().waitFor({ state: 'visible', timeout: action.timeout || 30_000 });
      return snapshot();
    case 'click':
      await button(action.name, Boolean(action.exact)).click({ timeout: action.timeout || 15_000 });
      await context.storageState({ path: storagePath });
      return snapshot();
    case 'tap':
      await button(action.name, Boolean(action.exact)).tap({ timeout: action.timeout || 15_000 });
      await context.storageState({ path: storagePath });
      return snapshot();
    case 'tapxy':
      await page.touchscreen.tap(action.x, action.y);
      await context.storageState({ path: storagePath });
      return snapshot();
    case 'press':
      await page.keyboard.press(action.key, { delay: action.delay || 0 });
      await context.storageState({ path: storagePath });
      return snapshot();
    case 'key':
      if (action.down) await page.keyboard.down(action.key);
      else await page.keyboard.up(action.key);
      return snapshot();
    case 'moveFor':
      await page.keyboard.down(action.key);
      await page.waitForTimeout(action.ms || 500);
      await page.keyboard.up(action.key);
      return snapshot();
    case 'wheel':
      await page.mouse.wheel(action.dx || 0, action.dy || 0);
      await page.waitForTimeout(action.wait || 250);
      return snapshot();
    case 'drag':
      await page.mouse.move(action.from.x, action.from.y);
      await page.mouse.down();
      await page.mouse.move(action.to.x, action.to.y, { steps: action.steps || 12 });
      await page.mouse.up();
      await page.waitForTimeout(action.wait || 250);
      return snapshot();
    case 'slider': {
      const input = page.locator(action.selector).first();
      const box = await input.boundingBox();
      if (!box) throw new Error(`slider not visible: ${action.selector}`);
      const min = Number(await input.getAttribute('min') || 0);
      const max = Number(await input.getAttribute('max') || 100);
      const value = Math.max(min, Math.min(max, Number(action.value)));
      const ratio = (value - min) / Math.max(1, max - min);
      await page.mouse.move(box.x + box.width * ratio, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * ratio, box.y + box.height / 2, { steps: 4 });
      await page.mouse.up();
      await page.waitForTimeout(250);
      return snapshot();
    }
    case 'screenshot': {
      const safeName = String(action.name || `shot-${Date.now()}.png`).replace(/[^a-zA-Z0-9_.-]/g, '_');
      await page.screenshot({ path: resolve(shotsDir, safeName), fullPage: Boolean(action.fullPage) });
      return { path: `docs/playtest/shots/${safeName}`, ...(await snapshot()) };
    }
    case 'viewport':
      await page.setViewportSize({ width: action.width, height: action.height });
      await page.waitForTimeout(400);
      return snapshot();
    case 'reload':
      await page.reload({ waitUntil: action.waitUntil || 'commit', timeout: action.timeout || 45_000 });
      return snapshot();
    case 'offline':
      await context.setOffline(Boolean(action.enabled));
      return { offline: Boolean(action.enabled), ...(await snapshot()) };
    case 'victoryBridge':
      await page.evaluate(() => {
        const saveKey = 'storm-apocalypse-save-v1';
        const saved = JSON.parse(localStorage.getItem(saveKey) || '{}');
        saved.wave = 30;
        saved.bestWave = 30;
        saved.baseHealth = 18;
        saved.stats = { ...(saved.stats || {}), wavesCleared: 30, campaignWins: 1 };
        saved.lastSavedAt = Date.now();
        localStorage.setItem(saveKey, JSON.stringify(saved));
        const result = document.querySelector('#result');
        const gameUi = document.querySelector('#game-ui');
        const title = document.querySelector('#result-title');
        const copy = document.querySelector('#result-copy');
        const stats = document.querySelector('#result-stats');
        if (!(result instanceof HTMLElement) || !(gameUi instanceof HTMLElement) || !(title instanceof HTMLElement) || !(copy instanceof HTMLElement) || !(stats instanceof HTMLElement)) throw new Error('result modal missing');
        title.textContent = '黎明仍在';
        copy.textContent = '第三十次鐘聲穿過風牆，北境肉舖仍在營業。你成為「北境守望者」。 三十聲，一聲不差。槍管涼下來的時候，雪也停了。';
        const values = [['守過波次','30 / 30'],['累計擊殺','543'],['獵物','27'],['累計總收入','✦ 10167'],['剩餘資金','✦ 10250'],['本輪時間','18 分']];
        stats.replaceChildren(...values.map(([label, value]) => {
          const item = document.createElement('div');
          const small = document.createElement('small');
          const strong = document.createElement('b');
          small.textContent = label;
          strong.textContent = value;
          item.append(small, strong);
          return item;
        }));
        result.hidden = false;
        result.classList.add('is-visible');
        gameUi.classList.add('is-modal-hidden');
        gameUi.setAttribute('inert', '');
        gameUi.setAttribute('aria-hidden', 'true');
      });
      await context.storageState({ path: storagePath });
      return snapshot();
    case 'frames': {
      const sample = await page.evaluate((duration) => new Promise((resolveSample) => {
        const deltas = [];
        let previous = performance.now();
        const end = previous + duration;
        const frame = (now) => {
          deltas.push(now - previous);
          previous = now;
          if (now >= end) return resolveSample(deltas);
          requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }), action.ms || 5_000);
      const sorted = [...sample].sort((a, b) => a - b);
      const percentile = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] || 0;
      return {
        frames: sample.length,
        durationMs: Math.round(sample.reduce((sum, value) => sum + value, 0)),
        avgFrameMs: Number((sample.reduce((sum, value) => sum + value, 0) / sample.length).toFixed(2)),
        p95FrameMs: Number(percentile(0.95).toFixed(2)),
        p99FrameMs: Number(percentile(0.99).toFixed(2)),
        longFramesOver50ms: sample.filter((value) => value > 50).length,
      };
    }
    case 'snapshot':
      return snapshot();
    case 'close':
      setTimeout(async () => {
        await context.close();
        await browser.close();
        process.exit(0);
      }, 100);
      return { closing: true };
    default:
      throw new Error(`unknown action: ${action.type}`);
  }
}

const server = createServer(async (request, response) => {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    if (request.method !== 'POST') throw new Error('POST required');
    const action = await parseBody(request);
    const result = await handle(action);
    response.statusCode = 200;
    response.end(JSON.stringify({ ok: true, result }));
  } catch (error) {
    response.statusCode = 500;
    response.end(JSON.stringify({ ok: false, error: error.stack || error.message || String(error) }));
  }
});

server.listen(driverPort, '127.0.0.1', () => {
  console.log(`PLAYTEST_DRIVER http://127.0.0.1:${driverPort}`);
});
