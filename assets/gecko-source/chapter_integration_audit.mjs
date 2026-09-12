import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const base=process.env.GECKO_AUDIT_URL??'http://127.0.0.1:5173';const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[],failed=[];page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push(r.url()));
await page.goto(base+'/?chapter=2&test=1');await page.waitForFunction(()=>window.chapter2Test&& !document.querySelector('#begin').disabled);
const initial=await page.evaluate(()=>{const t=window.chapter2Test,l=t.maze.lair;document.querySelector('#entry').remove();t.setPosition(l.x+4,l.y);return t.snapshot();});
await page.waitForTimeout(150);await page.screenshot({path:'artifacts/gecko-chapter-idle.png'});
const states=[];let minimumWarning=0,warningFrames=0;
for(let i=0;i<155;i++){
 const d=await page.evaluate(()=>{window.chapter2Test.step(1/60);return window.chapter2Test.snapshot();});states.push({warning:d.geckoWarning,strike:d.geckoAttack.strike,x:d.geckoAttack.x,y:d.geckoAttack.y,survivors:d.survivors,visual:d.geckoVisual});
 if(d.geckoWarning>0)warningFrames++;
 if(i===80){await page.waitForTimeout(60);await page.screenshot({path:'artifacts/gecko-chapter-warning.png'});}
 if(i===128){await page.waitForTimeout(60);await page.screenshot({path:'artifacts/gecko-chapter-strike.png'});}
}
const report={initial,loaded:initial.geckoVisual?.bones===68,warningFrames,warningSeconds:warningFrames/60,moved:states.some(d=>Math.abs(d.x-initial.geckoAttack.x)>.5),warningPose:states.some(d=>d.visual?.mode==='warning'),strikePose:states.some(d=>d.visual?.mode==='strike'),errors,failed};
await fs.writeFile('assets/gecko-source/game/chapter_audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();if(!report.loaded||warningFrames<24||!report.moved||!report.warningPose||!report.strikePose||errors.length||failed.length)process.exitCode=1;
