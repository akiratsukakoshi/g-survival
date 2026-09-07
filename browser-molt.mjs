import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1280,height:800}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:5173/?test=1',{waitUntil:'networkidle'});
 await page.locator('#begin').click();await page.waitForFunction(()=>window.gameTest!==undefined);
 await page.evaluate(()=>{window.gameTest.start();const g=window.gameTest.state;g.player.x=4;g.player.y=4;g.hunger=1;g.water=1;});
 await page.keyboard.down('Space');await page.waitForFunction(()=>window.gameTest.snapshot().molting,null,{timeout:30000});await page.keyboard.up('Space');
 const first=await page.evaluate(()=>window.gameTest.snapshot());await page.keyboard.down('KeyD');await page.waitForTimeout(400);await page.keyboard.up('KeyD');const still=await page.evaluate(()=>window.gameTest.snapshot());if(still.x!==first.x||still.y!==first.y)throw new Error('molt allows movement');
 await page.evaluate(()=>{window.gameTest.state.moltProgress=.46;});await page.waitForTimeout(250);await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/molt-middle.png'});
 const label=await page.locator('#objective').textContent();if(!label.includes('脱皮中'))throw new Error('molt status missing');
 await page.evaluate(()=>{window.gameTest.state.moltProgress=.94;});await page.waitForTimeout(250);await page.screenshot({path:'artifacts/molt-late.png'});
 await page.locator('#test-sound').click();await page.waitForTimeout(150);if(!(await page.locator('#sound').textContent()).includes('音 ON'))throw new Error('audio not running');
 if(errors.length)throw new Error(errors.join('\n'));console.log('PASS: actual Space starts molt, movement blocked, staged render screenshots saved, audio context running, no JS errors');
}finally{await browser.close();}
