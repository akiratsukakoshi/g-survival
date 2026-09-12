import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true}),p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[],failed=[];
p.on('pageerror',e=>errors.push(e.message));p.on('requestfailed',r=>failed.push(r.url()));
await p.goto('http://127.0.0.1:5173/?chapter=2&test=1');await p.waitForFunction(()=>window.chapter2Test&&!document.querySelector('#begin').disabled);
await p.clock.install({time:new Date('2026-09-12T12:00:00Z')});await p.clock.pauseAt(new Date('2026-09-12T12:00:01Z'));await p.evaluate(()=>document.querySelector('#begin').click());
const initial=await p.evaluate(()=>window.chapter2Test.snapshot()),samples=[];let maxSkate=0,walked=0;
for(const [index,elapsed] of [[0,2.1],[1,7.1]]){
 await p.evaluate(({index,elapsed})=>{const t=window.chapter2Test,l=t.maze.gejis[index];t.step(elapsed-t.snapshot().elapsed);t.setPosition((l.xLeft+l.xRight)/2,l.y+1.4);},{index,elapsed});
 await p.clock.runFor(34);let d=await p.evaluate(()=>window.chapter2Test.snapshot()),previous=d.gejiVisuals[index];const start=d.crossings[index].x;
 for(let n=0;n<12;n++){await p.clock.runFor(17);d=await p.evaluate(()=>window.chapter2Test.snapshot());const current=d.gejiVisuals[index];for(let k=0;k<30;k++){const a=current.feet[k],b=previous.feet[k];if(a.stance&&b.stance)maxSkate=Math.max(maxSkate,Math.hypot(...a.foot.map((v,j)=>v-b.foot[j])));}previous=current;}
 walked+=d.crossings[index].x-start;samples.push({index,lane:d.crossings[index],visual:d.gejiVisuals[index]});await p.screenshot({path:`artifacts/geji-chapter-${index}.png`});
}
const report={loaded:initial.gejiVisuals.length===2&&initial.gejiVisuals.every(v=>v.bones===134&&v.feet.length===30),aligned:samples.every(s=>Math.abs(s.visual.origin[0]-s.lane.x)<1e-8&&Math.abs(s.visual.origin[1]+s.lane.y)<1e-8&&s.visual.heading===0),onBoard:samples.every(s=>s.visual.feet.filter(f=>f.stance).every(f=>Math.abs(f.foot[2]-(-.095+(f.name.includes('_14_')?.038:.023)*.48))<.02)),visible:samples.every(s=>s.visual.visible&&s.visual.active),maxSkate,walked,samples,errors,failed};
await fs.writeFile('assets/geji-source/game/chapter_audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,samples:samples.map(s=>({index:s.index,lane:s.lane,feet:s.visual.feet.length,visible:s.visual.visible}))},null,2));await browser.close();
if(!report.loaded||!report.aligned||!report.onBoard||!report.visible||maxSkate>.02||walked<1||errors.length||failed.length)process.exitCode=1;
