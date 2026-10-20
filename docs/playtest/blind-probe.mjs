import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const baseUrl = 'http://127.0.0.1:4178/storm-apocalypse/';
const shotsDir = resolve('docs/playtest/shots');
const devices = [
  { id: 'phone-portrait', width: 390, height: 844, touch: true, mobile: true },
  { id: 'phone-landscape', width: 844, height: 390, touch: true, mobile: true },
  { id: 'laptop-short', width: 1366, height: 600, touch: false, mobile: false },
  { id: 'desktop', width: 1366, height: 768, touch: false, mobile: false },
  { id: 'tablet', width: 768, height: 1024, touch: true, mobile: true },
];

const browser = await chromium.launch({ headless: true });
const results = [];

for (const device of devices) {
  const context = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    screen: { width: device.width, height: device.height },
    hasTouch: device.touch,
    isMobile: device.mobile,
    deviceScaleFactor: 1,
    locale: 'zh-TW',
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('requestfailed', (request) => {
    errors.push(`requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`);
  });

  await page.addInitScript(() => {
    globalThis.__playtestR1 = {
      scriptStartMs: performance.now(),
      loaderVisibleMs: null,
      loaderGoneMs: null,
      firstInteractiveMs: null,
      firstInteractive: null,
    };
    const visible = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
    };
    let loaderWasSeen = false;
    const sample = () => {
      const state = globalThis.__playtestR1;
      const loader = document.querySelector('#boot-loader');
      if (loader && visible(loader)) {
        loaderWasSeen = true;
        state.loaderVisibleMs ??= performance.now();
      } else if (loaderWasSeen) {
        state.loaderGoneMs ??= performance.now();
      }
      if (state.firstInteractiveMs === null) {
        const candidates = [...document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])')];
        const first = candidates.find((element) => visible(element) && !element.disabled && element.getAttribute('aria-disabled') !== 'true');
        if (first) {
          const rect = first.getBoundingClientRect();
          state.firstInteractiveMs = performance.now();
          state.firstInteractive = {
            tag: first.tagName.toLowerCase(),
            text: (first.innerText || first.getAttribute('aria-label') || first.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 120),
            rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
          };
        }
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });

  const wallStart = Date.now();
  await page.goto(baseUrl, { waitUntil: 'commit', timeout: 30_000 });
  await page.locator('#boot-loader').waitFor({ state: 'visible', timeout: 10_000 });
  const loaderCapturedMs = Date.now() - wallStart;
  await page.screenshot({ path: resolve(shotsDir, `${device.id}-01-boot.png`) });

  await page.waitForFunction(() => globalThis.__playtestR1?.firstInteractiveMs !== null, null, { timeout: 45_000 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: resolve(shotsDir, `${device.id}-02-ready.png`) });

  const data = await page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
    };
    const controls = [...document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])')]
      .filter((element) => visible(element))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          text: (element.innerText || element.getAttribute('aria-label') || element.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 160),
          disabled: Boolean(element.disabled) || element.getAttribute('aria-disabled') === 'true',
          rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
          inViewport: rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth,
        };
      });
    const paints = performance.getEntriesByType('paint').map((entry) => ({ name: entry.name, startTime: Math.round(entry.startTime) }));
    const marks = performance.getEntriesByType('mark').map((entry) => ({ name: entry.name, startTime: Math.round(entry.startTime) }));
    return {
      timings: globalThis.__playtestR1,
      paints,
      marks,
      controls,
      title: document.title,
      bodyText: document.body.innerText.trim().replace(/\n{3,}/g, '\n\n').slice(0, 5000),
      crossOriginIsolated,
      viewport: { width: innerWidth, height: innerHeight },
    };
  });

  results.push({
    device: device.id,
    viewport: `${device.width}x${device.height}`,
    loaderCapturedMs,
    ...data,
    errors,
  });
  console.log(JSON.stringify(results.at(-1), null, 2));
  await context.close();
}

await browser.close();
await writeFile(resolve('docs/playtest/blind-probe.json'), `${JSON.stringify(results, null, 2)}\n`, 'utf8');
