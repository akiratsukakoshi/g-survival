import { chromium } from '@playwright/test';
const browser=await chromium.launch({headless:true});
const assert=(v,m)=>{if(!v)throw Error(m);};
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/?chapter=2&test=1');await page.locator('#begin').click();
 const snapshot=()=>page.evaluate(()=>window.chapter2Test.snapshot());
 async function walk(x,y){const result=await page.evaluate(({x,y})=>{const api=window.chapter2Test,codes=['KeyW','KeyA','KeyS','KeyD','ShiftLeft'];for(let i=0;i<6000;i++){const s=api.snapshot();if(Math.hypot(s.x-x,s.y-y)<.1){for(const code of codes)dispatchEvent(new KeyboardEvent('keyup',{code}));return s;}for(const code of codes)dispatchEvent(new KeyboardEvent('keyup',{code}));dispatchEvent(new KeyboardEvent('keydown',{code:'ShiftLeft'}));if(Math.abs(x-s.x)>.05)dispatchEvent(new KeyboardEvent('keydown',{code:x>s.x?'KeyD':'KeyA'}));if(Math.abs(y-s.y)>.05)dispatchEvent(new KeyboardEvent('keydown',{code:y>s.y?'KeyS':'KeyW'}));api.step(.02);}return api.snapshot();},{x,y});assert(Math.hypot(result.x-x,result.y-y)<.16,'route stuck '+JSON.stringify(result)+' target '+x+','+y);}
 // Input uses the production movement and hazards at 20ms simulation steps; no position/enemy overrides.
 for(const [x,y] of [[25,3],[25,27],[25,45.5],[10,45.5],[10,50],[4,55],[3,55],[7,55],[7,63],[25,63],[25,70],[25,79],[10,79],[10,86],[26,86],[26,89.1]]){await walk(x,y);if(y===44||y===70||y===79)await page.screenshot({path:`artifacts/chapter2-route-${y}.png`});}
 await page.evaluate(()=>{for(let j=0;j<200;j++)window.chapter2Test.step(.02);});const end=await snapshot();assert(end.survivors===8,'route lost survivors '+JSON.stringify(end));assert(end.humanTimer>=3.2,'right-bottom exit did not finish');await page.screenshot({path:'artifacts/chapter2-route-ending.png'});assert(errors.length===0,errors.join('\n'));await page.reload();await page.locator('#begin').click();
 await page.evaluate(()=>{window.chapter2Test.setPosition(7,17);window.chapter2Test.setEnemy('warning',20,0,7);});await walk(3,17);assert((await snapshot()).sheltered&&(await snapshot()).survivors===8,'cannot run into shelter before centipede');
 await page.evaluate(()=>{const t=window.chapter2Test;t.setPosition(7,26);t.setEnemy('chase',22,0,7);for(let i=0;i<200;i++)t.step(.02);});assert((await snapshot()).enemy.y<24,'centipede crossed solid baffle');
 await page.evaluate(()=>{window.chapter2Test.setPosition(11.5,16.5);});assert((await snapshot()).height>1,'climbable debris has no height');
 await page.evaluate(()=>{const t=window.chapter2Test;t.setPosition(16,59);t.setEnemy('recover',34);for(let i=0;i<550;i++)t.step(.02);});assert((await snapshot()).survivors===8,'geji killed across the old full hazard band');
 console.log('chapter2 route PASS: production input/movement/hazards, no teleport, 8 survivors, right-bottom ending. Simulated seconds:',end.elapsed);
}finally{await browser.close();}
