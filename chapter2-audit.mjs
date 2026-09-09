import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch({ headless: true });
const errors = [];
const expect = (condition, message) => { if (!condition) throw new Error(message); };
try {
  await mkdir('artifacts', { recursive: true });
  const direct = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  direct.on('pageerror', error => errors.push(error.message));
  await direct.goto('http://127.0.0.1:5173/?chapter=2', { waitUntil: 'networkidle' });
  expect((await direct.locator('.chapter').textContent())?.includes('CHAPTER 02'), 'chapter router did not mount chapter two');
  expect((await direct.locator('#population').textContent())?.trim() === '8 匹', 'direct entry fallback is not 8 survivors');
  await direct.locator('#begin').click();
  await direct.goto('http://127.0.0.1:5173/?chapter=2&test=1', { waitUntil: 'networkidle' });
  await direct.locator('#begin').click();
  await direct.evaluate(() => window.chapter2Test.setPosition(8, 15));
  await direct.mouse.down(); await direct.waitForTimeout(100);
  expect((await direct.locator('#warning').textContent())?.includes('触角'), 'gap probing feedback is missing');
  await direct.screenshot({ path: 'artifacts/chapter2-shaft.png' });
  await direct.close();

  const carried = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  carried.on('pageerror', error => errors.push(error.message));
  await carried.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
  await carried.evaluate(() => localStorage.setItem('g-survival-progress-v1', JSON.stringify({ version: 1, unlockedChapter: 2, currentChapter: 2, survivors: 13, instar: 3, bodySize: 1.02, injuries: [] })));
  await carried.goto('http://127.0.0.1:5173/?chapter=2&from=chapter1', { waitUntil: 'networkidle' });
  expect((await carried.locator('#population').textContent())?.trim() === '13 匹', 'chapter one survivor count was not carried');
  expect(errors.length === 0, 'page errors: ' + errors.join(' | '));
  console.log('chapter2 audit PASS: router, direct fallback, probe feedback, survivor carry-over, page errors=0');
} finally { await browser.close(); }
