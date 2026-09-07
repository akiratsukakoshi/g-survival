import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Game, OBSTACLES } from './simulation';
import { AudioEngine } from './audio';
import './style.css';
import { MoltVisual } from './molt';
import { createAnimal, animateAnimal } from './animals';
import { PLANE_H, toWorld, place, grounded } from './space';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `<canvas id="world"></canvas><canvas id="veil"></canvas><div class="vignette"></div><header><span class="mark">G-survival <small>— 隙間の生 —</small></span><span class="chapter">CHAPTER 01 / 屋根裏</span></header><div id="entry"><div class="eyebrow">A LIFE BENEATH OUR FEET</div><h1>G-survival</h1><h2>— 隙間の生 —</h2><p class="story">あなたは、孵化したばかりのクロゴキブリの幼虫。<br>まだ飛べない。闇の中を、触角と気流を頼りに生きる。</p><p class="goal"><b>第1章：最初の脱皮</b><br>餌と水を探し、安全な隙間へ。<br>満たされた体で Space を3秒押し、20秒間の脱皮を生き延びる。<br>死ねば、どこかで生きている仲間へ。群れの命も、残りわずか。</p><button id="begin">卵から孵る <span>↗</span></button><small>音のある環境で体験してください</small></div><div id="ending" hidden><div class="eyebrow">CHAPTER 01</div><h2></h2><p></p><button id="again">もう一度、孵る ↗</button></div><aside id="hud"><div id="population" aria-live="polite"></div><div id="survival"><label>体力 <meter id="health" min="0" max="1"></meter></label><label>栄養 <meter id="hunger" min="0" max="1"></meter></label><label>水分 <meter id="water" min="0" max="1"></meter></label></div><div id="objective"></div><div id="molt-req"></div><div class="sound-controls"><button id="sound">音を有効にする</button><button id="test-sound">音を確認</button></div><label class="volume">音量 <input id="volume" aria-label="音量" type="range" min="0" max="1" step="0.05" value="0.8"></label><div id="sound-status" role="status"></div></aside><div id="controls">WASD / 矢印：壁を這う　·　Shift：走る　·　Space：静止　·　左長押し：探る</div><div id="warning" role="status"></div><footer><span>PERIPLANETA FULIGINOSA</span><span>01 — FIRST INSTAR</span></footer>`;
const renderer = new THREE.WebGLRenderer({canvas:document.querySelector('#world')!,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.4;
const scene=new THREE.Scene(); scene.background=new THREE.Color('#111317'); scene.fog=new THREE.FogExp2('#111317',.018);
// 斜俯瞰カメラ。docs/isometric-refactor-brief.md フェーズ1(カメラのみ変更)。数値はすべて **AI暫定値** — ガクチョ未指定。`?cam=fov,yaw,pitch,dist` で一時的に上書きして比較できる。
const camQ=(new URLSearchParams(location.search).get('cam')||'').split(',').map(Number),camN=(i:number,d:number)=>Number.isFinite(camQ[i])&&camQ[i]!==0?camQ[i]:d;
const CAM_FOV=camN(0,45),CAM_YAW=THREE.MathUtils.degToRad(camN(1,30)),CAM_PITCH=THREE.MathUtils.degToRad(camN(2,38)),CAM_DIST=camN(3,12),CAM_HEIGHT=.3,CAM_LEAD=3.5,CAM_LERP=3,CAM_CATCHUP=9;
const camera=new THREE.PerspectiveCamera(CAM_FOV,innerWidth/innerHeight,.1,200);
// -X 側(進行方向の後ろ)に引く。+X 側に置くと来た道を見ることになる。
const camTarget=new THREE.Vector3(4,CAM_HEIGHT,-1),camOffset=new THREE.Vector3(-Math.sin(CAM_YAW)*Math.cos(CAM_PITCH),Math.sin(CAM_PITCH),Math.cos(CAM_YAW)*Math.cos(CAM_PITCH)).multiplyScalar(CAM_DIST);
function placeCamera(){camera.position.copy(camTarget).add(camOffset);camera.lookAt(camTarget);}placeCamera();
const aimPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-PLANE_H),aimRay=new THREE.Raycaster(),aimNdc=new THREE.Vector2(),aimHit=new THREE.Vector3();
scene.add(new THREE.HemisphereLight('#b1becb','#302322',2.4));
const moon=new THREE.DirectionalLight('#c0cee0',3);moon.position.set(14,14,6);moon.castShadow=true;moon.shadow.mapSize.set(2048,2048);moon.shadow.camera.left=-18;moon.shadow.camera.right=18;moon.shadow.camera.top=18;moon.shadow.camera.bottom=-18;moon.shadow.camera.near=.5;moon.shadow.camera.far=48;moon.shadow.bias=-.0012;scene.add(moon,moon.target);
const warm=new THREE.PointLight('#cc9c78',20,16);warm.position.set(5,1.6,-1);scene.add(warm);
function texture(kind:'wood'|'pink'){
 const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d')!;ctx.fillStyle=kind==='wood'?'#625044':'#80676d';ctx.fillRect(0,0,256,256);
 let seed=43;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<2200;i++){const x=rand()*256,y=rand()*256;ctx.strokeStyle=`rgba(${kind==='wood'?'24,17,12':'203,158,156'},${rand()*.3})`;ctx.lineWidth=rand()*1.4;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(kind==='wood'?rand()*150:rand()*15),y+rand()*4);ctx.stroke();}
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(3,1);t.colorSpace=THREE.SRGBColorSpace;return t;
}
const woodTex=texture('wood'),pinkTex=texture('pink');
const wood=new THREE.MeshStandardMaterial({map:woodTex,bumpMap:woodTex,bumpScale:.12,roughness:.94});
const pink=new THREE.MeshStandardMaterial({map:pinkTex,bumpMap:pinkTex,bumpScale:.3,roughness:1});
const wireMat=new THREE.MeshStandardMaterial({color:'#252a29',roughness:.55,metalness:.1});
function box(x:number,y:number,z:number,w:number,h:number,d:number,material:THREE.Material){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.receiveShadow=true;m.castShadow=true;scene.add(m);return m;}
// 屋根裏の床。遊技域は simulation.ts の clamp で sim y 1..8、sim x 0..100。手前/奥に少し余白を取る。
const FLOOR_NEAR=.5,FLOOR_FAR=8.5,WALL_H=3.2;                 // WALL_H = 奥の壁。フェーズ3で登る面。AI暫定値
box(50,-.42,-(FLOOR_NEAR+FLOOR_FAR)/2,114,.5,FLOOR_FAR-FLOOR_NEAR+2,wood);   // 根太の下地(板の隙間を塞ぐ)
for(let i=0;i<6;i++)box(50,-.09,-(FLOOR_NEAR+(i+.5)*(FLOOR_FAR-FLOOR_NEAR)/6),114,.2,(FLOOR_FAR-FLOOR_NEAR)/6-.05,wood); // 床板
box(50,.11,-(FLOOR_NEAR-.2),114,.42,.4,wood);                 // 手前の根太。俯瞰を塞がないよう低く留める
box(50,WALL_H/2,-(FLOOR_FAR+.3),114,WALL_H,.6,wood);          // 奥の壁
box(-1.3,WALL_H/2,-(FLOOR_NEAR+FLOOR_FAR)/2,.6,WALL_H,FLOOR_FAR-FLOOR_NEAR+1.4,wood);  // 通路の両端
box(101.3,WALL_H/2,-(FLOOR_NEAR+FLOOR_FAR)/2,.6,WALL_H,FLOOR_FAR-FLOOR_NEAR+1.4,wood);
for(let i=0;i<23;i++){
 box(i*5,.42,-(FLOOR_FAR-.05),4.6,.85,.55,pink);              // 断熱材。奥の壁の足元に詰める
}
// 梁。頭上を渡して床に影の縞を落とす。間隔を詰めると画面が横棒で埋まるので疎に置く。
for(let i=0;i<9;i++)box(i*12+6,2.95,-(FLOOR_NEAR+FLOOR_FAR)/2,.38,.38,FLOOR_FAR-FLOOR_NEAR+1.2,wood);
{const run=new THREE.CatmullRomCurve3(Array.from({length:14},(_,i)=>toWorld(i*7.85-.5,FLOOR_FAR-.55+Math.sin(i*1.7)*.2,.09)));
 scene.add(new THREE.Mesh(new THREE.TubeGeometry(run,140,.055,6,false),wireMat));}
for(const x of [18,42,68,88]){                                // 配線が奥の壁を登る
 const curve=new THREE.CatmullRomCurve3([toWorld(x,FLOOR_FAR-.5,.09),toWorld(x+.12,FLOOR_FAR-.2,1),toWorld(x-.06,FLOOR_FAR-.28,2),toWorld(x+.16,FLOOR_FAR-.15,3)]);
 scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve,24,.075,6,false),wireMat));
}
// OBSTACLES は sim の X-Y 矩形 = 床の footprint。高さを与えて「またげない塊」として立てる。
// 高さは AI暫定値。高くするとプレイヤーが隠れるため 1.3 以下に留めている。
const OBST_H=[.9,1.15,.75,1.3,1,.85,1.2];
const solids=OBSTACLES.map((o,i)=>box(o.x+o.w/2,OBST_H[i%OBST_H.length]/2,-(o.y+o.h/2),o.w,OBST_H[i%OBST_H.length],o.h,wood)); // 材質は従来どおり木材(旧 `o.h>2?wood:pink` は現行 OBSTACLES では常に wood だった)
const eggMaterial=new THREE.MeshStandardMaterial({color:'#65432b',roughness:.68});
function eggHalf(side:number){const g=new THREE.Group();const m=new THREE.Mesh(new THREE.SphereGeometry(1,24,16,side<0?Math.PI:0,Math.PI),eggMaterial);m.scale.set(.68,.33,.3);g.add(m);for(let j=0;j<9;j++){const seam=new THREE.Mesh(new THREE.TorusGeometry(.25,.013,5,12,Math.PI),eggMaterial);seam.position.x=-.48+j*.12;seam.rotation.y=Math.PI/2;g.add(seam);}g.position.set(4,.22,-1);scene.add(g);return g;}
const eggLeft=eggHalf(-1),eggRight=eggHalf(1);
let seed=37;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
for(let i=0;i<190;i++){const m=box(rand()*102,.02,-(FLOOR_NEAR+rand()*(FLOOR_FAR-FLOOR_NEAR)),.02+rand()*.15,.035,.02+rand()*.06,wood);m.rotation.y=rand()*3;}
const dustPositions=new Float32Array(450*3);for(let i=0;i<450;i++){dustPositions[i*3]=rand()*108-3;dustPositions[i*3+1]=rand()*3.4;dustPositions[i*3+2]=-rand()*9.5;}
const dustGeometry=new THREE.BufferGeometry();dustGeometry.setAttribute('position',new THREE.BufferAttribute(dustPositions,3));scene.add(new THREE.Points(dustGeometry,new THREE.PointsMaterial({color:'#c8b7ab',size:.024,transparent:true,opacity:.3})));
// Merge only immutable scenery. Moving obstacles and creatures keep their own transforms.
for(const material of [wood,pink,wireMat]){const meshes=scene.children.filter((o):o is THREE.Mesh=>o instanceof THREE.Mesh&&o.material===material&&!solids.includes(o));if(meshes.length<2)continue;const geometries=meshes.map(m=>{m.updateMatrix();return m.geometry.clone().applyMatrix4(m.matrix);});const geometry=mergeGeometries(geometries);if(geometry){const merged=new THREE.Mesh(geometry,material);merged.castShadow=true;merged.receiveShadow=true;scene.add(merged);meshes.forEach(m=>{scene.remove(m);m.geometry.dispose();});}geometries.forEach(g=>g.dispose());}
let game=new Game();const audio=new AudioEngine();let started=false;let ended=false;let hatchTime=0;let hatchStarted=0;
const hero=createAnimal('roach',.75);const kin=Array.from({length:game.siblings.length},()=>createAnimal('roach',.75));const predators=Array.from({length:2},()=>createAnimal('spider',2.3));const ants=Array.from({length:game.ants.length},()=>createAnimal('ant',.48));
const heroPin=grounded(hero),kinPins=kin.map(grounded),predatorPins=predators.map(grounded),antPins=ants.map(grounded);scene.add(heroPin,...kinPins,...predatorPins,...antPins);
const moltVisual=new MoltVisual(scene,heroPin,hero);
const foodMat=new THREE.MeshStandardMaterial({color:'#d0a57c',roughness:.75});const waterMat=new THREE.MeshPhysicalMaterial({color:'#a9ced8',roughness:.08,metalness:.1,transparent:true,opacity:.85,clearcoat:1});
const pickups:THREE.Mesh[]=[];
function rebuildPickups(){pickups.forEach(m=>{scene.remove(m);m.geometry.dispose();});pickups.length=0;game.resources.forEach(r=>{const m=new THREE.Mesh(new THREE.SphereGeometry(.18,12,8),r.type==='water'?waterMat:foodMat);place(m,r.x,r.y,.1);m.scale.y=.65;scene.add(m);pickups.push(m);});}
rebuildPickups();
const checkpointModels=game.checkpoints.map((c,i)=>{const g=new THREE.Group();const mat=new THREE.MeshStandardMaterial({color:'#47321d',roughness:1});for(let j=0;j<9;j++){const m=new THREE.Mesh(new THREE.SphereGeometry(.09,7,5),mat);m.scale.set(1.5,.7,1);m.position.set(Math.cos(j*2.4)*.3,Math.sin(j*2.4)*.16,0);g.add(m);}g.rotation.x=-Math.PI/2;place(g,c.x,c.y,.05);scene.add(g);return g;});
const crumbs=ants.map(()=>{const m=new THREE.Mesh(new THREE.SphereGeometry(.05,5,4),foodMat);scene.add(m);return m;});const veil=document.querySelector<HTMLCanvasElement>('#veil')!,ctx=veil.getContext('2d')!;
const keys=new Set<string>();let mouse={x:innerWidth*.65,y:innerHeight*.5},probe=false;
addEventListener('keydown',e=>{if(['Space','KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'].includes(e.code))e.preventDefault();keys.add(e.code);});addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('blur',()=>{keys.clear();probe=false;});addEventListener('pointermove',e=>{mouse={x:e.clientX,y:e.clientY};});addEventListener('pointerdown',e=>{if(e.button===0&&!(e.target as HTMLElement).closest('button,input'))probe=true;});addEventListener('pointerup',()=>probe=false);
function resize(){renderer.setSize(innerWidth,innerHeight);veil.width=innerWidth;veil.height=innerHeight;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}addEventListener('resize',resize);resize();
function project(x:number,y:number){const v=toWorld(x,y).project(camera);return{x:(v.x*.5+.5)*innerWidth,y:(-.5*v.y+.5)*innerHeight};}
let aim={x:5,y:1};const remembered=new Set<number>();
function reach(x:number,y:number,dx:number,dy:number,max:number){for(let t=.12;t<max;t+=.12){const px=x+dx*t,py=y+dy*t;if(OBSTACLES.some(o=>px>o.x&&px<o.x+o.w&&py>o.y&&py<o.y+o.h))return t;}return max;}
function sense(){return .4+.6*Math.min(game.hunger,game.water);}
function visible(x:number,y:number){const dx=x-game.player.x,dy=y-game.player.y,dist=Math.hypot(dx,dy);if(dist<.65*sense())return true;const a=Math.atan2(dy,dx),target=Math.atan2(aim.y-game.player.y,aim.x-game.player.x);const delta=Math.atan2(Math.sin(a-target),Math.cos(a-target));return Math.abs(delta)<(probe?.87:.52)&&dist<(probe?4:2.4)*sense()&&reach(game.player.x,game.player.y,Math.cos(a),Math.sin(a),dist)>=dist-.15;}
// 明るさ調整。VEIL_ALPHA を下げる / 他を上げると全体が明るくなる。ガクチョの体感で詰める値。
const VEIL_ALPHA=.88,NEAR_SPAN=1.25,NEAR_MID=.97,FAN_CORE=.97,FAN_MID=.8;
function darkness(){
 ctx.clearRect(0,0,veil.width,veil.height);ctx.fillStyle=`rgba(3,5,7,${VEIL_ALPHA})`;ctx.fillRect(0,0,veil.width,veil.height);
 const p=project(game.player.x,game.player.y),pu=project(game.player.x+1,game.player.y),scale=Math.hypot(pu.x-p.x,pu.y-p.y),radius=scale*.9*NEAR_SPAN*sense();
 ctx.globalCompositeOperation='destination-out';const near=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,radius);near.addColorStop(0,'rgba(0,0,0,1)');near.addColorStop(.55,`rgba(0,0,0,${NEAR_MID})`);near.addColorStop(1,'transparent');ctx.fillStyle=near;ctx.fillRect(p.x-radius,p.y-radius,2*radius,2*radius);
 const angle=Math.atan2(aim.y-game.player.y,aim.x-game.player.x),range=(probe?4:2.4)*sense(),spread=probe?.87:.52;
 const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,range*scale);g.addColorStop(0,`rgba(0,0,0,${FAN_CORE})`);g.addColorStop(.7,`rgba(0,0,0,${FAN_MID})`);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(p.x,p.y);for(let i=0;i<=50;i++){const a=angle-spread+spread*2*i/50;const r=reach(game.player.x,game.player.y,Math.cos(a),Math.sin(a),range);const q=project(game.player.x+Math.cos(a)*r,game.player.y+Math.sin(a)*r);ctx.lineTo(q.x,q.y);}ctx.closePath();ctx.fill();ctx.globalCompositeOperation='source-over';
 OBSTACLES.forEach((o,i)=>{if([[o.x-.1,o.y],[o.x+o.w+.1,o.y],[o.x,o.y+o.h+.1],[o.x+o.w/2,o.y-.1]].some(([x,y])=>visible(x,y)))remembered.add(i);if(remembered.has(i)){const q=[[o.x,o.y],[o.x+o.w,o.y],[o.x+o.w,o.y+o.h],[o.x,o.y+o.h]].map(([x,y])=>project(x,y));ctx.strokeStyle='rgba(157,164,149,.23)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(q[0].x,q[0].y);for(let k=1;k<4;k++)ctx.lineTo(q[k].x,q[k].y);ctx.closePath();ctx.stroke();}});
 checkpointModels.forEach((m,i)=>{const c=game.checkpoints[i];if(visible(c.x,c.y)){const q=project(c.x,c.y);ctx.strokeStyle='rgba(195,181,123,.5)';ctx.beginPath();ctx.arc(q.x,q.y,14,0,Math.PI*2);ctx.stroke();}});
 const d=game.danger.strength;if(d>0){const t=project(game.danger.x,game.danger.y);const a=Math.atan2(t.y-p.y,t.x-p.x);const k=Math.min(innerWidth/2/Math.max(.01,Math.abs(Math.cos(a))),innerHeight/2/Math.max(.01,Math.abs(Math.sin(a))));const x=innerWidth/2+Math.cos(a)*k,y=innerHeight/2+Math.sin(a)*k;const glow=ctx.createRadialGradient(x,y,0,x,y,170);glow.addColorStop(0,`rgba(184,201,209,${Math.min(.6,d*.6)})`);glow.addColorStop(1,'transparent');ctx.fillStyle=glow;ctx.fillRect(0,0,innerWidth,innerHeight);}
 if(game.humanEvent>0){const humanGlow=ctx.createLinearGradient(0,0,0,innerHeight*.4);humanGlow.addColorStop(0,`rgba(207,215,218,${Math.min(.7,game.humanEvent*.6)})`);humanGlow.addColorStop(1,'transparent');ctx.fillStyle=humanGlow;ctx.fillRect(0,0,innerWidth,innerHeight*.4);}
 if(game.antAttack>0){ctx.strokeStyle=`rgba(187,91,63,${.2+game.antAttack/5})`;ctx.lineWidth=8;ctx.strokeRect(4,4,innerWidth-8,innerHeight-8);}
}document.querySelector('#begin')!.addEventListener('click',()=>{started=true;hatchTime=0;hatchStarted=performance.now();document.querySelector('#entry')!.classList.add('gone');void audio.start();probe=false;});
document.querySelector('#again')!.addEventListener('click',()=>{moltVisual.reset();game=new Game();hatchTime=0;hatchStarted=performance.now();remembered.clear();rebuildPickups();ended=false;document.querySelector<HTMLElement>('#ending')!.hidden=true;keys.clear();lastPopulation=game.siblings.length+1;lossNotice=0;lastX=game.player.x;lastY=game.player.y;});
const population=document.querySelector<HTMLElement>('#population')!,soundButton=document.querySelector<HTMLButtonElement>('#sound')!,soundStatus=document.querySelector<HTMLElement>('#sound-status')!,warningLabel=document.querySelector<HTMLElement>('#warning')!;
document.querySelector('#test-sound')!.addEventListener('click',e=>{void audio.test();(e.currentTarget as HTMLButtonElement).blur();});soundButton.addEventListener('click',()=>{void audio.toggle();soundButton.blur();});
document.querySelector<HTMLInputElement>('#volume')!.addEventListener('input',e=>audio.setVolume(Number((e.target as HTMLInputElement).value)));
let lastX=game.player.x,lastY=game.player.y,bodyHeading=0,lastPopulation=game.siblings.length+1;
let lossNotice=0,lossCount=0;
const objective=document.querySelector<HTMLElement>('#objective')!;
const moltReq=document.querySelector<HTMLElement>('#molt-req')!;let lastReqHtml='';
const MOLT_NEED=.85; // simulation.ts の moltReady と同じしきい値
const marks=(v:number)=>{const f=Math.floor(Math.min(1,v/MOLT_NEED)*5);return '●'.repeat(f)+'○'.repeat(5-f);};
let previous=performance.now(),accumulator=0;function frame(now:number){requestAnimationFrame(frame);const dt=Math.min((now-previous)/1000,.25);previous=now;
 const p=game.player;const damp=Math.min(1,dt*CAM_LERP);camTarget.x+=((started?p.x+CAM_LEAD:4)-camTarget.x)*damp;camTarget.z+=(-(started?p.y:1)-camTarget.z)*damp;camTarget.y=CAM_HEIGHT+Math.sin(now*.055)*game.humanEvent*.08;placeCamera();camera.updateMatrixWorld();
 aimNdc.set(mouse.x/innerWidth*2-1,1-mouse.y/innerHeight*2);aimRay.setFromCamera(aimNdc,camera);if(aimRay.ray.intersectPlane(aimPlane,aimHit))aim={x:aimHit.x,y:-aimHit.z};
 const input={x:Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')),y:Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown')),sprint:keys.has('ShiftLeft')||keys.has('ShiftRight'),freeze:keys.has('Space'),probe,aimX:aim.x,aimY:aim.y};
 if(started&&!ended&&hatchTime>=4&&Math.abs(camTarget.x-p.x)<CAM_CATCHUP){accumulator+=dt;while(accumulator>=1/60){game.update(1/60,input);accumulator-=1/60;}}
 const travel=Math.hypot(p.x-lastX,p.y-lastY);if(travel>.001)bodyHeading=Math.atan2(p.y-lastY,p.x-lastX);lastX=p.x;lastY=p.y;
 const oldHatch=hatchTime;if(started)hatchTime=Math.min(4,(now-hatchStarted)/1000);if(oldHatch<4&&hatchTime>=4){game.siblings.forEach((s,i)=>{s.x=4+Math.cos(i*2.4)*2.4;s.y=1+Math.abs(Math.sin(i*2.4))*2;});}eggLeft.position.x=4-Math.min(1,hatchTime/3)*.4;eggRight.position.x=4+Math.min(1,hatchTime/3)*.4;eggLeft.rotation.y=-hatchTime*.08;eggRight.rotation.y=hatchTime*.08;heroPin.visible=started;place(heroPin,p.x,p.y);animateAnimal(hero,now/1000,travel/Math.max(dt,.001),bodyHeading,game.moltProgress);
 moltVisual.update(game.moltProgress,game.moltReady,game.molting||game.state==='won',p.x,p.y,bodyHeading,now/1000);
 if(!game.molting){const look=Math.atan2(aim.y-p.y,aim.x-p.x)-bodyHeading;(hero.userData.feelers as THREE.Group[]).forEach((f,i)=>f.rotation.z=THREE.MathUtils.clamp(Math.atan2(Math.sin(look),Math.cos(look)),-1.2,1.2)+Math.sin(now*.003+i)*.06);}
 population.textContent=`群れ ${game.siblings.filter(s=>s.alive).length+(game.state==='lost'?0:1)} / ${game.siblings.length+1} 匹（操作中を含む）`;
 soundButton.textContent=audio.muted?'音 OFF → ON':audio.status==='running'?'音 ON → OFF':'音を有効にする';soundStatus.textContent=audio.status==='unavailable'?'音声を開始できません。別ブラウザーでもお試しください。':audio.status==='suspended'?'音が停止中です。「音を有効にする」を押してください。':'';
 const populationNow=game.siblings.filter(s=>s.alive).length+(game.state==='lost'?0:1);if(populationNow<lastPopulation){lossNotice=3;lossCount=lastPopulation-populationNow;}lastPopulation=populationNow;lossNotice=Math.max(0,lossNotice-dt);
 warningLabel.textContent=started&&hatchTime<4?'卵鞘の裂け目から、小さな命が這い出す。':game.antAttack>0?`アリが群がっている — 離れないと捕食される ${Math.max(0,3-game.antAttack).toFixed(1)}秒`:game.water<.12?'水が尽きかけている — 水滴を探す':game.hunger<.12?'体が弱っている — 餌を探す':lossNotice>0?`Gが${lossCount}体、減りました`:'';
 for(const key of ['health','hunger','water'] as const)(document.querySelector('#'+key) as HTMLMeterElement).value=game[key];
 const zone=p.x<12?'孵化地点':p.x<27?'梁の回廊':p.x<42?'開けた床板':p.x<57?'配線の森':p.x<82?'餌場':'奥の隙間';
 objective.textContent=game.state==='won'?'第1章 完了 — 最初の脱皮':game.molting?`脱皮中 · ${Math.ceil((1-game.moltProgress)*20)}秒 — ${game.moltProgress<.2?'背中が裂ける':game.moltProgress<.6?'白い体を引き出す':game.moltProgress<.9?'脚と触角を抜く':'新しい体を伸ばす'}`:game.moltReady?'安全な隙間で Space を3秒長押し':`${zone} · 餌と水を探す`;
 const reqHtml=game.state==='won'?'<div class="req-title">脱皮 完了</div>':game.molting?'<div class="req-title">脱皮中 — 動けない</div>':`<div class="req-title">脱皮に必要な蓄え</div><div class="req-row"><span>餌</span><b>${marks(game.hunger)}</b></div><div class="req-row"><span>水</span><b>${marks(game.water)}</b></div><div class="req-hint">${game.moltReady?'準備ができました — 安全な場所で Space を長押し（3秒）':game.hunger>=MOLT_NEED&&game.water>=MOLT_NEED?'体力が足りない — 糞の山で休む':'餌と水を集めて、印を全部埋める'}</div>`;
 if(reqHtml!==lastReqHtml){moltReq.innerHTML=reqHtml;lastReqHtml=reqHtml;}moltReq.classList.toggle('ready',game.moltReady);
 solids.forEach((m,i)=>{m.rotation.y=Math.sin(now*.04+i)*game.humanEvent*.002;});
 kinPins.forEach((m,i)=>{const s=game.siblings[i];m.visible=!!s&&s.alive&&visible(s.x,s.y);if(s){const kdx=s.x-m.position.x,kdy=s.y+m.position.z;const kh=Math.hypot(kdx,kdy)>.001?Math.atan2(kdy,kdx):kin[i].rotation.z;place(m,s.x,s.y);if(hatchTime<4){place(m,4+Math.cos(i*2.4)*hatchTime*.6,1+Math.abs(Math.sin(i*2.4))*hatchTime*.5);m.visible=started&&hatchTime>i*.18;}animateAnimal(kin[i],now/1000+i*.3,Math.hypot(kdx,kdy)/Math.max(dt,.001),kh);}});
 predatorPins.forEach((m,i)=>{const s=game.spiders[i];m.visible=!!s&&visible(s.x,s.y);if(s){animateAnimal(predators[i],now/1000,s.state==="warning"?0:1,s.angle);predators[i].scale.z=predators[i].userData.baseScale*(s.state==="warning"?.72:1);place(m,s.x,s.y,PLANE_H+(s.state==="attack"?.3:0));}});
 antPins.forEach((m,i)=>{const a=game.ants[i];m.visible=!!a&&visible(a.x,a.y);if(a){place(m,a.x,a.y);animateAnimal(ants[i],now/1000+i,1,a.angle);}});pickups.forEach((m,i)=>m.visible=game.resources[i].amount>0);
  crumbs.forEach((m,i)=>{const a=game.ants[i];m.visible=!!a&&a.carrying&&a.target===null&&visible(a.x,a.y);if(a)place(m,a.x+Math.cos(a.angle)*.13,a.y+Math.sin(a.angle)*.13,.16);});
 checkpointModels.forEach((m,i)=>{const c=game.checkpoints[i];m.visible=visible(c.x,c.y);});
 const positions=dustGeometry.getAttribute('position') as THREE.BufferAttribute;for(let i=0;i<positions.count;i++){positions.setY(i,(positions.getY(i)-dt*(.015+game.humanEvent*.5)+3.4)%3.4);}positions.needsUpdate=true;
 warm.position.set(p.x,1.5,-p.y);warm.intensity=game.moltProgress>0?32:12;
 moon.position.set(p.x+12,14,6);moon.target.position.set(p.x,0,-4.5);moon.target.updateMatrixWorld();
 audio.update(dt,{speed:started&&!ended?travel/Math.max(dt,.001):0,danger:game.danger.strength,pan:Math.sign(game.danger.x-p.x),molting:game.molting,stamina:game.stamina,human:game.humanEvent,ants:game.antAttack,vertical:(game.danger.y-p.y),loss:lossNotice>2.9});
 renderer.render(scene,camera);darkness();
 if(started&&!ended&&game.state!=='playing'){ended=true;const end=document.querySelector<HTMLElement>('#ending')!;end.hidden=false;end.querySelector('h2')!.textContent=game.state==='won'?'まだ、生きている。':'闇が、静かになった。';end.querySelector('p')!.textContent=game.state==='won'?'はじめての脱皮を終えた。':'Gの群れは、全滅した。';}
}requestAnimationFrame(frame);







// Dev-only scene inspection for browser regression tests; absent from production builds.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('test')) {
 Object.assign(window,{gameTest:{get state(){return game;},start(){started=true;hatchStarted=performance.now()-5000;hatchTime=4;document.querySelector('#entry')!.classList.add('gone');},snapshot(){return{state:game.state,x:game.player.x,y:game.player.y,molting:game.molting,progress:game.moltProgress,ants:game.antAttack,group:game.siblings.filter(s=>s.alive).length+(game.state==='lost'?0:1)};}}});
}
