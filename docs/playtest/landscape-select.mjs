import { chromium } from 'playwright';
import { resolve } from 'node:path';

const url = 'http://127.0.0.1:4178/storm-apocalypse/';
const shots = resolve('docs/playtest/shots');

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 844, height: 390 },
  screen: { width: 844, height: 390 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 1,
  locale: 'zh-TW',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (message) => message.type() === 'error' && errors.push(`console: ${message.text()}`));
page.on('requestfailed', (request) => errors.push(`requestfailed: ${request.url()} ${request.failure()?.errorText || ''}`));

await page.goto(url, { waitUntil: 'commit', timeout: 30_000 });
await page.waitForFunction(() => performance.getEntriesByName('storm-first-interactive', 'mark').length > 0, null, { timeout: 45_000 });
await page.waitForTimeout(600);

const navStart = await page.evaluate(() => performance.timeOrigin);
const initial = await page.locator('button').allTextContents();
await page.screenshot({ path: resolve(shots, 'phone-landscape-03-before-drag.png') });

await page.mouse.move(690, 235);
await page.mouse.down();
await page.mouse.move(520, 235, { steps: 5 });
await page.mouse.move(340, 235, { steps: 5 });
await page.mouse.move(150, 235, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(350);
await page.screenshot({ path: resolve(shots, 'phone-landscape-04-after-drag.png') });

const mechanic = page.locator('button').filter({ hasText: '機械師少年' }).first();
await mechanic.tap({ timeout: 10_000 });
const firstActualInteractionMs = Date.now() - navStart;
await page.waitForTimeout(250);
await page.screenshot({ path: resolve(shots, 'phone-landscape-05-mechanic-selected.png') });

const confirm = page.getByRole('button', { name: /確認機械師少年/ });
const confirmBox = await confirm.boundingBox();
await confirm.tap({ timeout: 10_000 });
await page.waitForTimeout(1_200);
await page.screenshot({ path: resolve(shots, 'phone-landscape-06-loadout.png') });

const state = await page.evaluate(() => {
  const visible = (element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
  };
  return {
    bodyText: document.body.innerText.trim().replace(/\n{3,}/g, '\n\n').slice(0, 8000),
    controls: [...document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])')]
      .filter((element) => visible(element))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          text: (element.innerText || element.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 180),
          disabled: Boolean(element.disabled) || element.getAttribute('aria-disabled') === 'true',
          rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
          inViewport: rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth,
        };
      }),
  };
});

console.log(JSON.stringify({ initial, firstActualInteractionMs, confirmBox, state, errors }, null, 2));
await context.close();
await browser.close();
