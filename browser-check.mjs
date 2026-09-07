import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });

try {
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle', timeout: 15000 });
  await page.locator('#begin').click();
  await page.waitForFunction(() => document.querySelector('#warning')?.textContent === '', {timeout:30000});
  const before = await page.screenshot();
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(750);
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(120);
  await mkdir('artifacts', { recursive: true });
  const after = await page.screenshot({ path: 'artifacts/game-after.png' });
  if (Buffer.compare(before, after) === 0) throw new Error('visual frame did not change after W input');

  await page.locator('#sound').click();
  await page.waitForTimeout(120);
  const soundText = await page.locator('#sound').textContent();
  await page.locator('#test-sound').click();
  await page.waitForTimeout(360);
  if (!(await page.locator('#sound').textContent())?.includes('音 ON')) throw new Error('sound control did not render a status label');
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`PASS: browser rendered after hatch and keyboard input; sound control=${soundText}`);
} finally {
  await browser.close();
}
