import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
const assert=(v,m)=>{if(!v)throw Error(m);};
// 迷路の BFS 経路(chapter2Test.route())をキー入力だけで走破する。座標の書き換えはしない。
const drive=([route,from,to])=>{
 const api=window.chapter2Test,codes=['KeyW','KeyA','KeyS','KeyD','ShiftLeft'];
 const clear=()=>{for(const code of codes)dispatchEvent(new KeyboardEvent('keyup',{code}));};
 const nearest=s=>{let best=0;for(let k=0;k<route.length;k++)if(Math.hypot(route[k].x-s.x,route[k].y-s.y)<Math.hypot(route[best].x-s.x,route[best].y-s.y))best=k;return best;};
 let i=from,guard=0;
 while(i<to){
  if(api.snapshot().humanTimer>=0){clear();return {ok:true,i,s:api.snapshot()};}
  const t=route[i],start=api.snapshot().survivors;let done=false,lost=false,s=api.snapshot();
  for(let n=0;n<4000;n++){s=api.snapshot();
   if(s.survivors!==start){lost=true;break;}
   if(Math.hypot(s.x-t.x,s.y-t.y)<.16||s.humanTimer>=0){done=true;break;}
   // Wait inside a real shelter for a nearby centipede to pass before leaving.
   if((s.sheltered||s.height>=.3)&&s.enemies.some(e=>Math.hypot(e.x-s.x,e.y-s.y)<3.4||route.slice(i,Math.min(to,i+5)).some(p=>Math.hypot(e.x-p.x,e.y-p.y)<3.2))){clear();api.step(.02);continue;}
   clear();dispatchEvent(new KeyboardEvent('keydown',{code:'ShiftLeft'}));
   if(Math.abs(t.x-s.x)>.05)dispatchEvent(new KeyboardEvent('keydown',{code:t.x>s.x?'KeyD':'KeyA'}));
   if(Math.abs(t.y-s.y)>.05)dispatchEvent(new KeyboardEvent('keydown',{code:t.y>s.y?'KeyS':'KeyW'}));
   api.step(.02);}
  clear();
  if(lost){if(++guard>7||api.snapshot().survivors<=0)return {ok:false,i,s,why:'too many losses'};i=nearest(api.snapshot());continue;}
  if(!done)return {ok:false,i,s,why:'stuck'};
  i++;}
 return {ok:true,i,s:api.snapshot()};};
try{
 await mkdir('artifacts',{recursive:true});
 const reports=[];
 for(const molt of [false,true]){
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/?chapter=2&test=1',{waitUntil:'networkidle'});await page.waitForFunction(()=>!document.querySelector('#begin').disabled);
 // Manual steps advance real simulation; all movement and molt use normal input events, never setPosition/startMolt.
 await page.evaluate(()=>{document.querySelector('#entry').hidden=true;});
 const snapshot=()=>page.evaluate(()=>window.chapter2Test.snapshot());
 let walked=0;
 const walk=async route=>{assert(route.length>0,'BFS route is missing');walked+=route.length;const leg=await page.evaluate(drive,[route,0,route.length]);assert(leg.ok,'route failed '+leg.why+' at '+leg.i+' position '+leg.s.x+','+leg.s.y+' survivors '+leg.s.survivors);};
 if(molt){
  // Descend the centipede shaft using its existing escape slits, instead of running into the head.
  for(const address of ['E12','E14','E16','E18','D18'])await walk(await page.evaluate(a=>window.chapter2Test.route({r:Number(a.slice(1))-1,c:a.charCodeAt(0)-65}),address));
  await page.evaluate(()=>{dispatchEvent(new KeyboardEvent('keydown',{code:'Space'}));for(let j=0;j<330;j++)window.chapter2Test.step(.02);dispatchEvent(new KeyboardEvent('keyup',{code:'Space'}));});
  assert((await snapshot()).molted,'normal Space input did not complete molt');await page.screenshot({path:'artifacts/chapter2-route-molted.png'});
  for(const address of ['E16','E14','E12'])await walk(await page.evaluate(a=>window.chapter2Test.route({r:Number(a.slice(1))-1,c:a.charCodeAt(0)-65}),address));
 }
 else await page.screenshot({path:'artifacts/chapter2-maze-start.png'});
 await walk(await page.evaluate(()=>window.chapter2Test.route()));
 await page.evaluate(()=>{for(let j=0;j<220;j++)window.chapter2Test.step(.02);});
 const end=await snapshot();
 assert(end.humanTimer>=3.2,'wall hole did not finish the chapter');
 await page.waitForFunction(()=>!document.querySelector('#ending').hidden,null,{timeout:5000});
 await page.screenshot({path:molt?'artifacts/chapter2-route-molted-ending.png':'artifacts/chapter2-maze-ending.png'});
 // User requested higher difficulty; the old >=7/8 target is retired. Record losses, require a living completion for both body sizes.
 assert(end.survivors>0,'normal input route cannot finish alive');assert(errors.length===0,errors.join('\n'));
 reports.push({molt,cells:walked,survivors:end.survivors,seconds:Number(end.elapsed.toFixed(1))});console.log('completed',JSON.stringify(reports.at(-1)));await page.close();
 }
 console.log('chapter2 route PASS: normal keys only, no position/health/enemy injection',JSON.stringify(reports));
}finally{await browser.close();}
