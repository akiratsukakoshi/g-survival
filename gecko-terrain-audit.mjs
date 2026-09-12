import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const b=await chromium.launch({headless:true}),p=await b.newPage();
try{await p.goto('http://127.0.0.1:5173/?chapter=2&test=1',{waitUntil:'networkidle'});await p.waitForFunction(()=>window.chapter2Test);
const result=await p.evaluate(async()=>{const t=window.chapter2Test,{animateGecko}=await import('/src/gecko.ts'),{blockedAt}=await import('/src/chapter2-maze.ts');let samples=0,blocked=0,first=null;
 for(let k=0;k<900;k++){const targets=[[17,71],[17,65],[7,69],[25,61],[17,76],[5,35]],target=targets[Math.floor(k/150)];t.setPosition(...target);t.step(.02);const s=t.snapshot();
  for(let i=0;i<2;i++){const e=s.lizards[i],home=t.maze.lairs[i],g=t.models.geckos[i];animateGecko(g,k*.02,{x:e.x,y:-e.y,z:-.095,heading:e.heading,mode:e.warning>0?'warning':e.strike>0?'strike':Math.hypot(e.x-home.x,e.y-home.y)>.05?'return':'idle',warning:e.warning});
   if(k%30)continue;g.updateMatrixWorld(true);g.traverse(o=>{if(!o.isMesh)return;for(let j=0;j<o.geometry.attributes.position.count;j+=17){const v=o.getVertexPosition(j,g.position.clone()).applyMatrix4(o.matrixWorld);samples++;if(v.z<1.6&&blockedAt(v.x,-v.y,.001,'enemy')){blocked++;first??={k,i,x:v.x,y:-v.y,z:v.z};}}});
  }
 }return {samples,blocked,first};});await writeFile('artifacts/gecko-terrain-audit.json',JSON.stringify(result,null,2));if(result.blocked)throw Error(JSON.stringify(result));console.log('PASS gecko terrain sampled posed vertices',JSON.stringify(result));}finally{await b.close();}
