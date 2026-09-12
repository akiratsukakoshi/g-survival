import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true}),errors=[],page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>errors.push(e.message));
const check=(v,m)=>{if(!v)throw Error(m);};
const open=async()=>{await page.goto('http://127.0.0.1:5173/?chapter=2&test=1',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.chapter2Test&&!document.querySelector('#begin').disabled);};
try{
 await open();
 const report=await page.evaluate(async()=>{
  const t=window.chapter2Test,m=await import('/src/chapter2-maze.ts'),key=(code,type)=>dispatchEvent(new KeyboardEvent(type,{code})),step=n=>{for(let k=0;k<n;k++)t.step(.02);};
  const initial=t.snapshot(),visits=t.maze.centipedes.map(()=>new Set());let blocked=false,jump=false,last=t.snapshot().crossings;
  t.setPosition(t.maze.molt.x,t.maze.molt.y);
  for(let i=0;i<5000;i++){t.step(.02);const s=t.snapshot();s.enemies.forEach((e,k)=>{blocked||=m.blockedAt(e.x,e.y,.4,'enemy');visits[k].add(m.cellOf(e.x,e.y).r+','+m.cellOf(e.x,e.y).c);});s.crossings.forEach((l,k)=>{jump||=Math.abs(l.x-last[k].x)>.055||l.x<l.xLeft||l.x>l.xRight;});last=s.crossings;}
  const holes=['F21','I21','G25'].map(a=>{const p=m.centerOf(Number(a.slice(1))-1,a.charCodeAt(0)-65);t.setPosition(p.x,p.y);return {a,player:!m.blockedAt(p.x,p.y,.6),enemy:m.blockedAt(p.x,p.y,.1,'enemy'),shelter:t.snapshot().sheltered,route:m.reachable(1.2,t.maze.start,m.cellOf(p.x,p.y)).ok};});
  t.setResources(.55,.5);t.setPosition(t.maze.molt.x,t.maze.molt.y);const b18WithoutFood=t.snapshot().moltReady;
  const resources=initial.resources;const pickups=[];
  for(const r of resources){t.setResources(.5,.5);t.setPosition(r.x,r.y);step(20);pickups.push({address:r.address,gain:t.snapshot()[r.type==='food'?'hunger':'water']-.5});}
  const site=t.snapshot().restSites[0];t.setResources(.6,.7,.4);t.setPosition(site.x,site.y);step(50);const healing=t.snapshot().health;
  const measure=(hp,drink)=>{t.setResources(1,drink,hp);t.setPosition(17,75);key('KeyD','keydown');step(20);key('KeyD','keyup');return t.snapshot().x-17;};const fast=measure(1,1),slow=measure(.2,.2);
  t.setResources(1,1);t.setPosition(site.x,site.y);key('Space','keydown');key('KeyD','keydown');step(160);const during=t.snapshot();key('KeyD','keyup');step(180);key('Space','keyup');const grown=t.snapshot();
  return {initial:{body:initial.bodySize,model:initial.instarModel,ready:initial.moltReady},patrol:{blocked,visited:visits.map(v=>v.size),expected:t.maze.centipedes.map(p=>p.path.length)},gejiContinuous:!jump,holes,b18WithoutFood,pickups,healing,fast,slow,during:{molting:during.molting,x:during.x,expected:site.x,range:during.senseRange},grown:{size:grown.bodySize,molted:grown.molted,model:grown.instarModel}};
 });
 check(report.initial.body===1.02&&report.initial.model===3&&!report.initial.ready,'initial state');check(!report.patrol.blocked&&report.patrol.visited.every((n,i)=>n===report.patrol.expected[i]),'patrol '+JSON.stringify(report.patrol));
 check(report.gejiContinuous,'geji jumped or left patrol');check(report.holes.every(h=>h.player&&h.enemy&&h.shelter&&h.route),'holes '+JSON.stringify(report.holes));check(!report.b18WithoutFood,'B18 still grants molt');check(report.pickups.every(r=>r.gain>0),'resource collection');check(report.healing>.49,'droppings do not heal');check(report.slow<report.fast*.7,'depletion does not slow movement');check(report.during.molting>0&&report.during.x===report.during.expected&&report.during.range===22,'Space freeze/sense/molt');check(report.grown.molted&&report.grown.size===1.2&&report.grown.model===3,'growth model');
 await page.evaluate(()=>{document.querySelector('#entry').hidden=true;});await page.waitForTimeout(200);await page.screenshot({path:'artifacts/chapter2-adjusted-third.png'});
 await open();report.restart=await page.evaluate(()=>{const s=window.chapter2Test.snapshot();return {size:s.bodySize,molted:s.molted,ready:s.moltReady};});check(report.restart.size===1.02&&!report.restart.molted&&!report.restart.ready,'restart');
 report.attacks=[];
 for(let index=0;index<2;index++){await open();report.attacks.push(await page.evaluate(index=>{const t=window.chapter2Test,l=t.maze.lairs[index],x=l.x<16?l.x+6:l.x-6;t.setPosition(x,l.y);const start=t.snapshot().survivors;let firstLoss=null,max=0,warning=false;
  for(let i=0;i<230;i++){t.step(.02);const s=t.snapshot(),e=s.lizards[index];warning||=e.warning>0;max=Math.max(max,Math.hypot(e.x-l.x,e.y-l.y));if(s.survivors<start&&firstLoss===null)firstLoss=(i+1)*.02;if(firstLoss!==null)t.setPosition(5,35);}
  return {index,warning,firstLoss,max};},index));}
 check(report.attacks.every(a=>a.warning&&a.firstLoss>=.4),'gecko warning/contact '+JSON.stringify(report.attacks));
 // Dodge after the aim is fixed: the strike must carry past the old target and farther than the former 10.8 unit cap.
 await open();report.reach=await page.evaluate(()=>{const t=window.chapter2Test,l=t.maze.lairs.find(l=>l.x<16),index=t.maze.lairs.indexOf(l);t.setPosition(l.x+6,l.y);for(let i=0;i<65;i++)t.step(.02);t.setPosition(l.x+6,l.y+3);let max=0;for(let i=0;i<120;i++){t.step(.02);const e=t.snapshot().lizards[index];max=Math.max(max,Math.hypot(e.x-l.x,e.y-l.y));}return max;});check(report.reach>10.8,'strike reach '+report.reach);
 await page.evaluate(()=>{document.querySelector('#entry').hidden=true;window.chapter2Test.setPosition(17,69);});await page.waitForTimeout(200);await page.screenshot({path:'artifacts/chapter2-adjusted-geckos.png'});
 check(errors.length===0,errors.join('\n'));report.pageErrors=errors;await writeFile('artifacts/chapter2-adjustment-audit.json',JSON.stringify(report,null,2));console.log('PASS',JSON.stringify(report));
}finally{await browser.close();}
