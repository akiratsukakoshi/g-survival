import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true}),errors=[];
const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>errors.push(e.message));
const check=(v,m)=>{if(!v)throw Error(m);};
const open=async()=>{await page.goto('http://127.0.0.1:5173/?chapter=2&test=1',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.chapter2Test&&!document.querySelector('#begin').disabled);};
try{
 await open();
 const patrol=await page.evaluate(async()=>{
  const t=window.chapter2Test,m=await import('/src/chapter2-maze.ts'),visited=t.maze.centipedes.map(()=>new Set()),start=t.snapshot();let blocked=false;
  for(let i=0;i<5000;i++){t.step(.02);const s=t.snapshot();s.enemies.forEach((e,k)=>{blocked||=m.blockedAt(e.x,e.y,.4,'enemy');visited[k].add(m.cellOf(e.x,e.y).r+','+m.cellOf(e.x,e.y).c);});}
  return {count:start.enemies.length,gejis:start.crossings.length,geckos:start.lizards.length,blocked,visited:visited.map(v=>v.size),expected:t.maze.centipedes.map(c=>c.path.length),survivors:t.snapshot().survivors};
 });
 check(patrol.count===3&&patrol.gejis===2&&patrol.geckos===2,'enemy counts');check(!patrol.blocked&&patrol.visited.every((n,i)=>n===patrol.expected[i]),'patrol did not traverse every bend: '+JSON.stringify(patrol));
 const recovery=await page.evaluate(async()=>{const t=window.chapter2Test,m=await import('/src/chapter2-maze.ts');t.setPosition(t.maze.molt.x,t.maze.molt.y);
  [[15,19],[17,17],[23,23]].forEach(([x,y],i)=>t.setEnemy('recover',y,0,x,i));let blocked=false;
  for(let i=0;i<1200;i++){t.step(.02);blocked||=t.snapshot().enemies.some(e=>m.blockedAt(e.x,e.y,.4,'enemy'));}
  return {blocked,states:t.snapshot().enemies.map(e=>e.state)};});
 check(!recovery.blocked&&recovery.states.every(s=>s==='patrol'),'centipedes did not rejoin patrol '+JSON.stringify(recovery));
 // Real Space hold must finish even while still held; readiness is visual, local to M.
 await page.evaluate(()=>{const t=window.chapter2Test;t.setPosition(t.maze.molt.x,t.maze.molt.y);document.querySelector('#entry').hidden=true;});
 await page.waitForTimeout(100);
 const ready=await page.evaluate(()=>({ready:window.chapter2Test.snapshot().moltReady,glow:window.chapter2Test.snapshot().glow}));
 check(ready.ready&&ready.glow>0,'M does not glow');await page.screenshot({path:'artifacts/chapter2-molt-ready.png'});
 const growth=await page.evaluate(()=>{
  const t=window.chapter2Test,key=(code,type)=>dispatchEvent(new KeyboardEvent(type,{code}));
  const measure=()=>{t.setPosition(5,57);key('KeyD','keydown');for(let i=0;i<25;i++)t.step(.02);key('KeyD','keyup');return t.snapshot().x-5;};
  const before=measure();t.setPosition(t.maze.molt.x,t.maze.molt.y);key('Space','keydown');for(let i=0;i<160;i++)t.step(.02);const during=t.snapshot();for(let i=0;i<230;i++)t.step(.02);key('Space','keyup');const after=t.snapshot(),speed=measure();return {before,speed,during:during.molting,after:{molted:after.molted,bodySize:after.bodySize},save:JSON.parse(localStorage.getItem('g-survival-progress-v1'))};
 });
 check(growth.during>0&&growth.after.molted&&growth.after.bodySize===1.2,'held Space failed to finish molt');check(Math.abs(growth.speed/growth.before-1.12)<1e-6,'growth speed bonus missing');
 await page.waitForTimeout(100);check(await page.evaluate(()=>window.chapter2Test.snapshot().glow===0),'glow remained outside M');
 await open();const persisted=await page.evaluate(()=>{const s=window.chapter2Test.snapshot();return {bodySize:s.bodySize,visualScale:s.visualScale,speed:s.speedMultiplier};});
 check(persisted.bodySize===1.2&&persisted.visualScale===1.2&&persisted.speed===1.12,'molt reload mismatch '+JSON.stringify(persisted));
 await page.evaluate(()=>{const t=window.chapter2Test;t.setPosition(t.maze.molt.x,t.maze.molt.y);document.querySelector('#entry').hidden=true;});await page.waitForTimeout(100);await page.screenshot({path:'artifacts/chapter2-molt-grown.png'});
 // A clear target warns; crossing behind a mound cancels the aim. Do this for both lizards.
 await page.evaluate(()=>localStorage.clear());await open();
 const cover=await page.evaluate(()=>{
  const t=window.chapter2Test,results=[];
  // D31 -> H29 crosses F30; K35 -> M37 crosses L36.
  for(const [i,visible,hidden] of [[0,{x:9,y:63},{x:17,y:57}],[1,{x:25,y:69},{x:27,y:73}]]){
   t.setPosition(visible.x,visible.y);for(let k=0;k<60;k++)t.step(.02);const warning=t.snapshot().lizards[i].warning;
   t.setPosition(hidden.x,hidden.y);for(let k=0;k<120;k++)t.step(.02);const after=t.snapshot().lizards[i];results.push({warning,after:{warning:after.warning,strike:after.strike,timer:after.timer}});
  }return results;
 });
 check(cover.every(c=>c.warning>0&&c.after.warning===0&&c.after.strike===0&&c.after.timer===0),'mound cover did not cancel sight '+JSON.stringify(cover));
 await page.evaluate(()=>{window.chapter2Test.setPosition(17,67);document.querySelector('#entry').hidden=true;});await page.waitForTimeout(100);await page.screenshot({path:'artifacts/chapter2-gecko-room.png'});
 check(errors.length===0,errors.join('\n'));
 const contacts=[];
 for(const kind of ['centipede','gecko','geji'])for(let index=0;index<(kind==='centipede'?3:2);index++){
  await open();const result=await page.evaluate(([kind,index])=>{const t=window.chapter2Test;
   const p=kind==='centipede'?t.maze.centipedes[index].path[2]:kind==='gecko'?t.maze.lairs[index]:{x:t.maze.gejis[index].xLeft,y:t.maze.gejis[index].y};
   t.setPosition(p.x,p.y);if(kind==='centipede')t.setEnemy('warning',p.y,0,p.x,index);
   const start=t.snapshot().survivors;let firstLoss=null;
   for(let k=0;k<650;k++){t.step(.02);if(t.snapshot().survivors!==start){firstLoss=(k+1)*.02;break;}}
   return {kind,index,firstLoss,lost:start-t.snapshot().survivors};
  },[kind,index]);contacts.push(result);
 }
 check(contacts.every(c=>c.firstLoss>=.4&&c.lost===1),'an enemy lacks warning or contact '+JSON.stringify(contacts));
 check(errors.length===0,errors.join('\n'));
 const report={patrol,recovery,ready,growth,persisted,cover,contacts,pageErrors:errors};await writeFile('artifacts/chapter2-difficulty-audit.json',JSON.stringify(report,null,2));console.log('PASS chapter2 difficulty',JSON.stringify(report));
}finally{await browser.close();}
