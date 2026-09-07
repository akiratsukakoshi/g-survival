import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const URL = 'http://127.0.0.1:5173/?test=1';
const browser = await chromium.launch({ headless: true });
const pageErrors = [];

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function freshScene() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.locator('#begin').click();
  await page.waitForFunction(() => window.gameTest !== undefined);
  await page.evaluate(() => window.gameTest.start());
  return page;
}

async function prepareMolt(page) {
  await page.evaluate(() => {
    const game = window.gameTest.state;
    game.player.x = 14;
    game.player.y = 1;
    game.hunger = 1;
    game.water = 1;
  });
  await page.waitForFunction(() => window.gameTest.state.moltReady);
  expect(
    (await page.locator('#objective').textContent())?.includes('Space を3秒長押し'),
    'ready status is missing',
  );
  await page.keyboard.down('Space');
  await page.waitForFunction(() => window.gameTest.snapshot().molting, null, { timeout: 15000 });
  await page.keyboard.up('Space');
}

try {
  await mkdir('artifacts', { recursive: true });

  const moltPage = await freshScene();
  await prepareMolt(moltPage);
  const immobilizedStart = await moltPage.evaluate(() => window.gameTest.snapshot());
  await moltPage.keyboard.down('KeyD');
  await moltPage.waitForTimeout(350);
  await moltPage.keyboard.up('KeyD');
  const immobilizedEnd = await moltPage.evaluate(() => window.gameTest.snapshot());
  expect(
    immobilizedStart.x === immobilizedEnd.x && immobilizedStart.y === immobilizedEnd.y,
    `molt moved player in snapshots: (${immobilizedStart.x}, ${immobilizedStart.y}) -> (${immobilizedEnd.x}, ${immobilizedEnd.y})`,
  );
  await moltPage.evaluate(() => { window.gameTest.state.moltProgress = 0.46; });
  await moltPage.waitForTimeout(180);
  await moltPage.screenshot({ path: 'artifacts/molt-middle.png' });
  expect((await moltPage.locator('#objective').textContent())?.includes('脱皮中'), 'molt status is missing');

  // A fresh page resets Game's private attack timer. This injects coordinates
  // into existing ant objects; it never replaces the ants array or its entries.
  await moltPage.close();
  const antPage = await freshScene();
  await prepareMolt(antPage);
  const groupBefore = await antPage.evaluate(() => window.gameTest.snapshot().group);
  const swarmStarted = await antPage.evaluate(() => {
    const game = window.gameTest.state;
    for (const ant of game.ants) {
      ant.x = game.player.x;
      ant.y = game.player.y;
    }
    return performance.now();
  });
  await antPage.waitForFunction(() => window.gameTest.snapshot().ants > 0.5, null, { polling: 50, timeout: 10000 });
  await antPage.waitForFunction(before => window.gameTest.snapshot().group < before, groupBefore, { polling: 50, timeout: 100000 });
  const swarmElapsed = await antPage.evaluate(start => performance.now() - start, swarmStarted);
  const groupAfter = await antPage.evaluate(() => window.gameTest.snapshot().group);
  expect(swarmElapsed >= 2800, `ants caught player too early: ${swarmElapsed.toFixed(0)}ms`);
  expect(groupAfter === groupBefore - 1, `group did not fall by one: ${groupBefore} -> ${groupAfter}`);
  expect((await antPage.locator('#population').textContent())?.includes(`${groupAfter} /`), 'population HUD does not match group count');
  await antPage.screenshot({ path: 'artifacts/ants-after-molt-catch.png' });

  await antPage.close();
  const eventPage = await freshScene();
  await eventPage.evaluate(() => {
    const game = window.gameTest.state;
    game.player.x = 40;
    game.player.y = 1;
  });
  await eventPage.waitForFunction(() => window.gameTest.state.humanEvent > 0.8, null, { timeout: 6000 });
  const eventPeak = await eventPage.evaluate(() => window.gameTest.state.humanEvent);
  await eventPage.evaluate(() => { window.gameTest.state.player.x = 38; });
  await eventPage.waitForTimeout(700);
  const eventAfter = await eventPage.evaluate(() => window.gameTest.state.humanEvent);
  expect(eventAfter >= 0 && eventAfter < eventPeak, `human event did not decay: ${eventPeak} -> ${eventAfter}`);

  await eventPage.close();
  const soundPage = await freshScene();
  await soundPage.locator('#test-sound').click();
  await soundPage.waitForTimeout(150);
  expect((await soundPage.locator('#sound').textContent())?.includes('音 ON'), 'audio context is not running');

  await soundPage.close();
  if (pageErrors.length) throw new Error(`page errors:\n${pageErrors.join('\n')}`);
  console.log('PASS: Space molt, snapshot-proven immobilization, staged screenshot, in-place ant swarm catch during molt after 3s, population HUD, human-event decay, sound context, and no page errors.');
} finally {
  await browser.close();
}
