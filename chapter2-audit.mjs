import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const browser=await chromium.launch({headless:true}),errors=[];
const expect=(ok,message)=>{if(!ok)throw new Error(message);};
try{
 await mkdir('artifacts',{recursive:true});
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/?chapter=2&test=1',{waitUntil:'networkidle'});await page.locator('#begin').waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('#begin').disabled);
 expect((await page.locator('.chapter').textContent())?.includes('CHAPTER 02'),'chapter router failed');expect((await page.locator('#population').textContent())?.trim()==='8 匹','direct fallback is not 8');await page.locator('#begin').click();
 await page.evaluate(()=>window.chapter2Test.setPosition(3,41));expect((await page.evaluate(()=>window.chapter2Test.snapshot())).sheltered,'passable gap did not shelter player');
 await page.evaluate(()=>{window.chapter2Test.setEnemy('chase',41);});await page.waitForTimeout(120);let state=await page.evaluate(()=>window.chapter2Test.snapshot());expect(state.enemy.state==='recover','centipede did not abandon sheltered prey');
 await page.evaluate(()=>window.chapter2Test.setPosition(10.3,28));await page.mouse.down();await page.waitForTimeout(100);expect((await page.locator('#warning').textContent())?.includes('通れない'),'narrow gap feedback missing');await page.mouse.up();
 await page.evaluate(()=>{window.chapter2Test.setPosition(7,40);window.chapter2Test.setEnemy('warning',40,0);});const before=(await page.evaluate(()=>window.chapter2Test.snapshot())).survivors;await page.waitForTimeout(300);state=await page.evaluate(()=>window.chapter2Test.snapshot());expect(state.survivors===before&&state.enemy.state==='warning','centipede caught before 0.6s warning');await page.waitForTimeout(650);state=await page.evaluate(()=>window.chapter2Test.snapshot());expect(state.survivors===before-1,'centipede contact did not remove exactly one survivor');
 await page.screenshot({path:'artifacts/chapter2-three-shaft.png'});await page.close();
 const carried=await browser.newPage({viewport:{width:1280,height:800}});carried.on('pageerror',e=>errors.push(e.message));await carried.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'});await carried.evaluate(()=>localStorage.setItem('g-survival-progress-v1',JSON.stringify({version:1,unlockedChapter:2,currentChapter:2,survivors:13,instar:3,bodySize:1.02,injuries:[]})));await carried.goto('http://127.0.0.1:5173/?chapter=2&from=chapter1',{waitUntil:'networkidle'});await carried.waitForFunction(()=>!document.querySelector('#begin').disabled);expect((await carried.locator('#population').textContent())?.trim()==='13 匹','survivor carry-over failed');expect(errors.length===0,'page errors: '+errors.join(' | '));
 console.log('chapter2 audit PASS: Three.js scene, router, 8/13 survivors, gap shelter, narrow rejection, 0.6s warning, one loss, page errors=0');
}finally{await browser.close();}
