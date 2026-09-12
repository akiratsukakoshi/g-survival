import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const browser=await chromium.launch({headless:true}),errors=[];
const expect=(ok,message)=>{if(!ok)throw new Error(message);};
try{
 await mkdir('artifacts',{recursive:true});
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/?chapter=2&test=1',{waitUntil:'networkidle'});await page.locator('#begin').waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('#begin').disabled);
 expect((await page.locator('.chapter').textContent())?.includes('CHAPTER 02'),'chapter router failed');expect((await page.locator('#population').textContent())?.trim()==='8 匹','direct fallback is not 8');await page.locator('#begin').click();
 // State transitions use fixed simulation steps, not headless wall-clock FPS.
 // 座標はすべて迷路データ(chapter2Test.maze)から取る。
 const maze=await page.evaluate(()=>window.chapter2Test.maze);
 const shaft=maze.centipede,wide=maze.slits.find(s=>s.width>=1.2),narrowSlit=maze.slits.find(s=>s.width<1.2);
 expect(wide&&narrowSlit,'maze is missing a wide or a narrow slit');
 const snapshot=()=>page.evaluate(()=>window.chapter2Test.snapshot());
 await page.evaluate(c=>{window.chapter2Test.setPosition(c.x,c.yBottom-4);window.chapter2Test.setEnemy('chase',c.yTop+4,0,c.x);},shaft);
 await page.evaluate(y=>{const t=window.chapter2Test;for(let i=0;i<100&&t.snapshot().enemy.y<=y+.4;i++)t.step(.02);},shaft.yTop+4);
 expect((await snapshot()).enemy.y>shaft.yTop+4.4,'centipede did not follow player down the shaft');
 await page.evaluate(s=>window.chapter2Test.setPosition(s.x,s.y),wide);expect((await snapshot()).sheltered,'passable gap did not shelter player');
 await page.evaluate(a=>window.chapter2Test.setEnemy('chase',a.w.y+2,0,a.c.x),{w:wide,c:shaft});await page.evaluate(()=>window.chapter2Test.step(.12));
 expect((await snapshot()).enemy.state==='recover','centipede did not abandon sheltered prey');
 const lane=maze.geji;
 await page.evaluate(g=>{window.chapter2Test.setPosition(g.xRight-2,g.y);window.chapter2Test.setEnemy('chase',g.y,0,g.xRight-4);},lane);
 const passing=await snapshot();await page.evaluate(()=>window.chapter2Test.step(.07));
 expect((await snapshot()).survivors===passing.survivors,'centipede hit without head contact');
 await page.evaluate(c=>{window.chapter2Test.setPosition(c.x,c.yTop+6);window.chapter2Test.setEnemy('warning',c.yTop+10,0,c.x);},shaft);
 const before=(await snapshot()).survivors;await page.evaluate(()=>{for(let i=0;i<15;i++)window.chapter2Test.step(.02);});let state=await snapshot();
 expect(state.survivors===before&&state.enemy.state==='warning','centipede caught before 0.6s warning');
 await page.evaluate(group=>{const t=window.chapter2Test;for(let i=0;i<500&&t.snapshot().survivors===group;i++)t.step(.02);},before);
 expect((await snapshot()).survivors===before-1,'centipede contact did not remove exactly one survivor');
 await page.evaluate(l=>{window.chapter2Test.setPosition(l.x,l.y);window.chapter2Test.setEnemy('patrol',l.y-30,0,l.x);},maze.lair);
 const geckoBefore=(await snapshot()).survivors;
 await page.evaluate(()=>{const t=window.chapter2Test;for(let i=0;i<200&&t.snapshot().geckoWarning<=0;i++)t.step(.02);});
 expect((await snapshot()).geckoWarning>0,'gecko warning did not precede its strike');
 await page.evaluate(n=>{const t=window.chapter2Test;for(let i=0;i<250&&t.snapshot().survivors===n;i++)t.step(.02);},geckoBefore);
 expect((await snapshot()).survivors===geckoBefore-1,'gecko did not capture after warning');
 await page.evaluate(m=>{window.chapter2Test.setPosition(m.x,m.y);window.chapter2Test.startMolt();},maze.molt);
 await page.evaluate(()=>{const t=window.chapter2Test;for(let i=0;i<200&&!t.snapshot().molted;i++)t.step(.02);});
 const postMolt=await snapshot();expect(postMolt.molted&&postMolt.bodySize===1.2,'chapter molt did not grow and persist the body: '+JSON.stringify(postMolt));
 // 4齢(1.20)が 1.10 の隙間へ押し込むと通れない。
 await page.evaluate(s=>window.chapter2Test.setPosition(s.axis==='v'?s.x:s.x-2,s.axis==='v'?s.y-2:s.y),narrowSlit);
 await page.keyboard.down(narrowSlit.axis==='v'?'ArrowDown':'ArrowRight');
 await page.evaluate(()=>{for(let i=0;i<20;i++)window.chapter2Test.step(.02);});
 await page.waitForFunction(()=>/通れない/.test(document.querySelector('#warning').textContent||''),null,{timeout:4000});
 expect(/通れない/.test((await page.locator('#warning').textContent())||''),'narrow gap feedback missing');
 await page.keyboard.up(narrowSlit.axis==='v'?'ArrowDown':'ArrowRight');
 await page.evaluate(g=>window.chapter2Test.setPosition(g.x,g.y),maze.goal);
 await page.evaluate(()=>{const t=window.chapter2Test;for(let i=0;i<100&&t.snapshot().humanTimer<1.2;i++)t.step(.02);});
 await page.waitForFunction(()=>/床板|重い影/.test(document.querySelector('#warning').textContent||''),null,{timeout:5000});
 expect(/床板|重い影/.test((await page.locator('#warning').textContent())||''),'human warning did not precede ending');
 // Finish the remaining simulated seconds independently of headless GPU frame rate.
 await page.evaluate(()=>{for(let i=0;i<170;i++)window.chapter2Test.step(.02);});
 await page.waitForFunction(()=>!document.querySelector('#ending').hidden,null,{timeout:5000});
 await page.screenshot({path:'artifacts/chapter2-three-shaft.png'});await page.close();
 const carried=await browser.newPage({viewport:{width:1280,height:800}});carried.on('pageerror',e=>errors.push(e.message));await carried.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'});await carried.evaluate(()=>localStorage.setItem('g-survival-progress-v1',JSON.stringify({version:1,unlockedChapter:2,currentChapter:2,survivors:13,instar:3,bodySize:1.02,injuries:[]})));await carried.goto('http://127.0.0.1:5173/?chapter=2&from=chapter1',{waitUntil:'networkidle'});await carried.waitForFunction(()=>!document.querySelector('#begin').disabled);expect((await carried.locator('#population').textContent())?.trim()==='13 匹','survivor carry-over failed');expect(errors.length===0,'page errors: '+errors.join(' | '));
 console.log('chapter2 audit PASS: maze-driven coordinates, router, 8/13 survivors, gap shelter, narrow rejection after molt, centipede warning/chase/head-only contact/recover, gecko warning, molt 1.2, wall-hole ending, page errors=0');
}finally{await browser.close();}
