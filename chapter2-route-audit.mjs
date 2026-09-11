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
   clear();dispatchEvent(new KeyboardEvent('keydown',{code:'ShiftLeft'}));
   if(Math.abs(t.x-s.x)>.05)dispatchEvent(new KeyboardEvent('keydown',{code:t.x>s.x?'KeyD':'KeyA'}));
   if(Math.abs(t.y-s.y)>.05)dispatchEvent(new KeyboardEvent('keydown',{code:t.y>s.y?'KeyS':'KeyW'}));
   api.step(.02);}
  clear();
  if(lost){if(++guard>4)return {ok:false,i,s,why:'too many losses'};i=nearest(api.snapshot());continue;}
  if(!done)return {ok:false,i,s,why:'stuck'};
  i++;}
 return {ok:true,i,s:api.snapshot()};};
try{
 await mkdir('artifacts',{recursive:true});
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/?chapter=2&test=1',{waitUntil:'networkidle'});await page.waitForFunction(()=>!document.querySelector('#begin').disabled);await page.locator('#begin').click();
 const snapshot=()=>page.evaluate(()=>window.chapter2Test.snapshot());
 const route=await page.evaluate(()=>window.chapter2Test.route());
 assert(route.length>=110,'BFS route too short: '+route.length);
 await page.waitForTimeout(900);await page.screenshot({path:'artifacts/chapter2-maze-start.png'});
 const half=Math.floor(route.length/2);
 let leg=await page.evaluate(drive,[route,0,half]);assert(leg.ok,'route failed ('+leg.why+') at '+leg.i+' '+JSON.stringify(leg.s));
 await page.screenshot({path:'artifacts/chapter2-maze-mid.png'});
 leg=await page.evaluate(drive,[route,leg.i,route.length]);assert(leg.ok,'route failed ('+leg.why+') at '+leg.i+' '+JSON.stringify(leg.s));
 await page.evaluate(()=>{for(let j=0;j<220;j++)window.chapter2Test.step(.02);});
 const end=await snapshot();
 assert(end.humanTimer>=3.2,'wall hole did not finish the chapter: '+JSON.stringify(end));
 await page.waitForFunction(()=>!document.querySelector('#ending').hidden,null,{timeout:5000});
 await page.screenshot({path:'artifacts/chapter2-maze-ending.png'});
 assert(end.survivors>=7,'route lost more than one survivor '+JSON.stringify(end));
 assert(errors.length===0,errors.join('\n'));
 console.log('chapter2 route PASS: BFS route '+route.length+' cells walked by key input only, survivors '+end.survivors+'/8, wall-hole ending. Simulated seconds:',end.elapsed.toFixed(1));
}finally{await browser.close();}
