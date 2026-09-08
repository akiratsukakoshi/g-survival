import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true});const errors=[];
const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>errors.push(e.message));
const expect=(v,m)=>{if(!v)throw new Error(m);};
try{
 await page.goto('http://127.0.0.1:5173/?test=1',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.gameTest);await page.locator('#begin').click();await page.evaluate(()=>window.gameTest.start());
 const result=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/.vite/deps/three.js');const {createAnimal,animateAnimal}=await import('/src/animals.ts');const {grounded,pose}=await import('/src/space.ts');
  const a=createAnimal('roach'),b=createAnimal('roach');const meshes=g=>{const out=[];g.traverse(o=>{if(o.isSkinnedMesh)out.push(o);});return out;};const am=meshes(a)[0],bm=meshes(b)[0];
  const before=bm.skeleton.bones.map(b=>b.quaternion.toArray());animateAnimal(a,1,1,0);animateAnimal(a,1.2,1,0);const moved=am.skeleton.bones.some((b,i)=>b.name.startsWith('leg')&&b.quaternion.toArray().some((v,j)=>Math.abs(v-before[i][j])>1e-4));
  const independent=bm.skeleton!==am.skeleton&&bm.skeleton.bones.every((b,i)=>b.quaternion.toArray().every((v,j)=>v===before[i][j]));
  animateAnimal(a,1.3,0,0);const stopped=am.skeleton.bones.every((b,i)=>!b.name.startsWith('leg')||b.quaternion.toArray().every((v,j)=>Math.abs(v-before[i][j])<1e-5));
  const pin=grounded(a),orientations=[];
  for(const [nx,ny] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]){pose(pin,5,5,1,nx,ny);animateAnimal(a,2,0,Math.PI/2);pin.updateMatrixWorld(true);const adapter=a.children[0],up=new THREE.Vector3(0,1,0).transformDirection(adapter.matrixWorld);const front=new THREE.Vector3(0,0,-1).transformDirection(adapter.matrixWorld);const expected=nx||ny?new THREE.Vector3(nx,0,-ny):new THREE.Vector3(0,1,0);orientations.push({nx,ny,upError:up.distanceTo(expected),front:front.toArray()});}
  const live=window.gameTest.models;return {instances:[live.hero,...live.kin].filter(g=>g.userData.nymph).length,triangles:am.geometry.index.count/3,materials:Array.isArray(am.material)?am.material.length:1,bones:am.skeleton.bones.length,independent,moved,stopped,orientations};
 });
 expect(result.instances===24,'all 24 nymphs were not replaced');expect(result.independent&&result.moved&&result.stopped,'independent walk/stop failed');expect(result.orientations.every(o=>o.upError<1e-6&&Math.abs(o.front[o.nx||o.ny?1:2]-(o.nx||o.ny?1:-1))<1e-6),'model forward/up does not match surface');
 await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/nymph-game-floor.png'});
 await page.goto('http://127.0.0.1:5173/?test=1&cam=45,30,55,4',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.gameTest);await page.evaluate(()=>{window.gameTest.start();Object.assign(window.gameTest.state.player,{x:5.8,y:6.5});});await page.waitForTimeout(2000);await page.screenshot({path:'artifacts/nymph-game-close.png'});
 const colorBefore=await page.evaluate(()=>{const g=window.gameTest.models;let hero,kin;g.hero.traverse(o=>{if(o.isSkinnedMesh)hero=o;});g.kin[0].traverse(o=>{if(o.isSkinnedMesh)kin=o;});window.nymphCheck={hero,kin,kinColors:Array.from(kin.geometry.getAttribute('color').array)};return Array.from(hero.geometry.getAttribute('color').array);});
 await page.evaluate(()=>{const g=window.gameTest.state;g.molting=true;g.moltProgress=.46;g.hunger=g.water=1;});await page.waitForTimeout(250);
 const white=await page.evaluate(()=>{const {hero,kin,kinColors}=window.nymphCheck;return {hero:Array.from(hero.geometry.getAttribute('color').array),kinUnchanged:kin.geometry.getAttribute('color').array.every((v,i)=>v===kinColors[i])};});expect(white.kinUnchanged,'hero whitening changed sibling');expect(white.hero.some((v,i)=>v>colorBefore[i]+.4),'vertex colors did not whiten');await page.screenshot({path:'artifacts/nymph-game-molt.png'});
 await page.evaluate(()=>{const g=window.gameTest.state;g.molting=false;g.moltProgress=0;});await page.waitForTimeout(200);const restored=await page.evaluate(before=>window.nymphCheck.hero.geometry.getAttribute('color').array.every((v,i)=>Math.abs(v-before[i])<1e-6),colorBefore);expect(restored,'vertex colors did not restore');
 await page.evaluate(()=>{const g=window.gameTest.state;Object.assign(g.player,{x:6.84,y:4,z:.5,nx:-1,ny:0});g.climb={top:.9,lo:2.5,hi:5.5};});await page.waitForTimeout(300);await page.screenshot({path:'artifacts/nymph-game-wall.png'});
 const wall=await page.evaluate(()=>{const {heroPin}=window.gameTest.models;return {normal:[window.gameTest.state.player.nx,window.gameTest.state.player.ny],quaternion:heroPin.quaternion.toArray()};});expect(wall.normal[0]===-1,'wall pose was not retained');
 // Molt extraction and shed retain the wall normal, then restarting removes the shed and restores colour.
 await page.evaluate(()=>{const g=window.gameTest.state;g.molting=true;g.moltProgress=.5;});await page.waitForTimeout(250);
 const wallMolt=await page.evaluate(()=>{const {heroPin,scene}=window.gameTest.models;const shed=scene.children.find(o=>o.userData.inner?.userData.nymph&&o!==heroPin&&!window.gameTest.models.kinPins.includes(o)&&Math.abs(o.position.x-6.72)<.1);return !!shed&&Math.abs(shed.quaternion.dot(heroPin.quaternion))>.99999;});expect(wallMolt,'wall shed lost its surface orientation');await page.screenshot({path:'artifacts/nymph-game-wall-molt.png'});
 await page.evaluate(()=>{window.gameTest.state.state='lost';});await page.locator('#again').click();await page.waitForTimeout(250);
 const restart=await page.evaluate(()=>{const {hero,scene}=window.gameTest.models;return !window.gameTest.state.molting&&hero.scale.x===.75&&scene.children.filter(o=>o.userData.inner?.userData.nymph).length===24;});expect(restart,'restart retained a shed or growth');
 // Failure is visible and recoverable; no playable scene before the model arrives.
 const fail=await browser.newPage();await fail.route('**/models/roach-nymph.glb',r=>r.abort());await fail.goto('http://127.0.0.1:5173/?test=1');await fail.getByRole('button',{name:'読み込みを再試行'}).waitFor();expect(await fail.evaluate(()=>!window.gameTest),'scene started with missing asset');await fail.unroute('**/models/roach-nymph.glb');await fail.getByRole('button',{name:'読み込みを再試行'}).click();await fail.waitForFunction(()=>window.gameTest);await fail.close();
 expect(errors.length===0,errors.join('\n'));await writeFile('artifacts/nymph-integration.json',JSON.stringify({...result,whitening:true,restored,wall,wallMolt,restart,loadRetry:true,pageErrors:errors},null,2));console.log('PASS nymph integration',JSON.stringify(result));
}finally{await browser.close();}
