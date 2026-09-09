import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Game, OBSTACLES, WORLD, WALL_TOP } from './simulation';
import { completeChapterOne, mountChapterTwo } from './chapter2';
import { AudioEngine } from './audio';
import './style.css';
import { MoltVisual } from './molt';
import { createAnimal, animateAnimal, loadAnimals } from './animals';
import { PLANE_H, toWorld, place, grounded, pose } from './space';

if (new URLSearchParams(location.search).get('chapter') === '2') void mountChapterTwo();
else {
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `<canvas id="world"></canvas><canvas id="veil"></canvas><div class="vignette"></div><header><span class="mark">G-survival <small>— 隙間の生 —</small></span><span class="chapter">CHAPTER 01 / 屋根裏</span></header><div id="entry"><div class="eyebrow">A LIFE BENEATH OUR FEET</div><h1>G-survival</h1><h2>— 隙間の生 —</h2><p class="story">あなたは、孵化したばかりのクロゴキブリの幼虫。<br>まだ飛べない。闇の中を、触角と気流を頼りに生きる。</p><p class="goal"><b>第1章：最初の脱皮</b><br>餌と水を探し、安全な隙間へ。<br>満たされた体で Space を3秒押し、20秒間の脱皮を生き延びる。<br>死ねば、どこかで生きている仲間へ。群れの命も、残りわずか。</p><button id="begin">卵から孵る <span>↗</span></button><small>音のある環境で体験してください</small></div><div id="ending" hidden><div class="eyebrow">CHAPTER 01</div><h2></h2><p></p><button id="again">もう一度、孵る ↗</button></div><aside id="hud"><div id="population" aria-live="polite"></div><div id="survival"><label>体力 <meter id="health" min="0" max="1"></meter></label><label>栄養 <meter id="hunger" min="0" max="1"></meter></label><label>水分 <meter id="water" min="0" max="1"></meter></label></div><div id="objective"></div><div id="molt-req"></div><div class="sound-controls"><button id="sound">音を有効にする</button><button id="test-sound">音を確認</button></div><label class="volume">音量 <input id="volume" aria-label="音量" type="range" min="0" max="1" step="0.05" value="0.8"></label><div id="sound-status" role="status"></div></aside><div id="controls">WASD / 矢印：壁を這う　·　Shift：走る　·　Space：静止　·　左長押し：探る</div><div id="warning" role="status"></div><footer><span>PERIPLANETA FULIGINOSA</span><span>01 — FIRST INSTAR</span></footer>`;
const begin=document.querySelector<HTMLButtonElement>('#begin')!;begin.disabled=true;begin.textContent='孵化の準備中…';
async function boot(){
await loadAnimals();
const renderer = new THREE.WebGLRenderer({canvas:document.querySelector('#world')!,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.4;
const scene=new THREE.Scene(); scene.background=new THREE.Color('#111317'); scene.fog=new THREE.FogExp2('#111317',.018);
// 斜俯瞰カメラ。docs/isometric-refactor-brief.md フェーズ1(カメラのみ変更)。数値はすべて **AI暫定値** — ガクチョ未指定。`?cam=fov,yaw,pitch,dist` で一時的に上書きして比較できる。
const camQ=(new URLSearchParams(location.search).get('cam')||'').split(',').map(Number),camN=(i:number,d:number)=>Number.isFinite(camQ[i])&&camQ[i]!==0?camQ[i]:d;
const CAM_FOV=camN(0,45),CAM_YAW=THREE.MathUtils.degToRad(camN(1,30)),CAM_PITCH=THREE.MathUtils.degToRad(camN(2,38)),CAM_DIST=camN(3,12),CAM_HEIGHT=.3,CAM_LEAD=2.6,CAM_LERP=3,CAM_CATCHUP=9;
const camera=new THREE.PerspectiveCamera(CAM_FOV,innerWidth/innerHeight,.1,200);
// -X 側(進行方向の後ろ)に引く。+X 側に置くと来た道を見ることになる。
const camTarget=new THREE.Vector3(4,CAM_HEIGHT,-1),camOffset=new THREE.Vector3(-Math.sin(CAM_YAW)*Math.cos(CAM_PITCH),Math.sin(CAM_PITCH),Math.cos(CAM_YAW)*Math.cos(CAM_PITCH)).multiplyScalar(CAM_DIST);
function placeCamera(){camera.position.copy(camTarget).add(camOffset);camera.lookAt(camTarget);}placeCamera();
const lead={x:0,y:0};let travelling=false;
const aimPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-PLANE_H),aimN=new THREE.Vector3(),aimRay=new THREE.Raycaster(),aimNdc=new THREE.Vector2(),aimHit=new THREE.Vector3();
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
// 屋根裏は正方形。遊技域は simulation.ts の WORLD(1..34)、床はその外側に半 unit ずつ余らせる。
const F0=WORLD.lo-.5,F1=WORLD.hi+.5,FC=(F0+F1)/2,FS=F1-F0;
box(FC,-.42,-FC,FS+2,.5,FS+2,wood);                           // 根太の下地(板の隙間を塞ぐ)
for(let i=0;i<26;i++)box(FC,-.09,-(F0+(i+.5)*FS/26),FS+2,.2,FS/26-.05,wood); // 床板
// 外周。カメラは回さない(指示書 §2)ので手前になる面は決まっている。
// 南(手前)と西は低い根太に留めて俯瞰を塞がず、北と東を登れる壁にする。
box(FC,.25,-(F0-.25),FS+1.2,.5,.5,wood); box(F0-.25,.25,-FC,.5,.5,FS+1.2,wood);
box(FC,WALL_TOP/2,-(F1+.3),FS+1.2,WALL_TOP,.6,wood); box(F1+.3,WALL_TOP/2,-FC,.6,WALL_TOP,FS+1.2,wood);
for(let i=0;i<7;i++){                                         // 断熱材を北と東の壁の足元に詰める
 box(F0+2.5+i*4.8,.42,-(F1-.35),4.4,.85,.55,pink); box(F1-.35,.42,-(F0+2.5+i*4.8),.55,.85,4.4,pink);
}
// 梁。頭上を渡して床に影の縞を落とす。間隔を詰めると画面が横棒で埋まるので疎に置く。
for(let i=0;i<5;i++)box(FC,2.95,-(F0+(i+.5)*FS/5),FS+1,.4,.4,wood);
{const run=new THREE.CatmullRomCurve3(Array.from({length:12},(_,i)=>toWorld(F0+.5+i*(FS/11),F1-.75+Math.sin(i*1.7)*.2,.09)));
 scene.add(new THREE.Mesh(new THREE.TubeGeometry(run,120,.055,6,false),wireMat));}
for(const x of [6,15,24,31]){                                 // 配線が北の壁を登る
 const curve=new THREE.CatmullRomCurve3([toWorld(x,F1-.7,.09),toWorld(x+.12,F1-.4,1),toWorld(x-.06,F1-.48,2),toWorld(x+.16,F1-.35,3)]);
 scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve,24,.075,6,false),wireMat));
}
// OBSTACLES は床の footprint、o.top が高さ。仕切り壁も塊も同じ形で立てる。
const solids=OBSTACLES.map(o=>box(o.x+o.w/2,o.top/2,-(o.y+o.h/2),o.w,o.top,o.h,wood));
const eggMaterial=new THREE.MeshStandardMaterial({color:'#65432b',roughness:.68});
function eggHalf(side:number){const g=new THREE.Group();const m=new THREE.Mesh(new THREE.SphereGeometry(1,24,16,side<0?Math.PI:0,Math.PI),eggMaterial);m.scale.set(.68,.33,.3);g.add(m);for(let j=0;j<9;j++){const seam=new THREE.Mesh(new THREE.TorusGeometry(.25,.013,5,12,Math.PI),eggMaterial);seam.position.x=-.48+j*.12;seam.rotation.y=Math.PI/2;g.add(seam);}g.position.set(4,.22,-4);scene.add(g);return g;}
const eggLeft=eggHalf(-1),eggRight=eggHalf(1);
let seed=37;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
for(let i=0;i<340;i++){const m=box(F0+rand()*FS,.02,-(F0+rand()*FS),.02+rand()*.15,.035,.02+rand()*.06,wood);m.rotation.y=rand()*3;}
const dustPositions=new Float32Array(450*3);for(let i=0;i<450;i++){dustPositions[i*3]=F0+rand()*FS;dustPositions[i*3+1]=rand()*3.4;dustPositions[i*3+2]=-(F0+rand()*FS);}
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
function project(x:number,y:number,h=PLANE_H){const v=toWorld(x,y,h).project(camera);return{x:(v.x*.5+.5)*innerWidth,y:(-.5*v.y+.5)*innerHeight};}
let aim={u:5,v:1};const remembered=new Set<number>();
// 高さ z から見た遮蔽。自分より低い塊は見下ろせる(乗っている塊に視界を切られない)。
function reach(x:number,y:number,dx:number,dy:number,max:number,z=0){for(let t=.12;t<max;t+=.12){const px=x+dx*t,py=y+dy*t;if(OBSTACLES.some(o=>o.top>z+.02&&px>o.x&&px<o.x+o.w&&py>o.y&&py<o.y+o.h))return t;}return max;}
// 接触面のパラメータ空間 (u,v) ↔ ワールド。床/天面は (x,y)、壁は (面に沿う座標, 高さ)。
const projV=new THREE.Vector3();
function projectV(w:THREE.Vector3){const v=projV.copy(w).project(camera);return{x:(v.x*.5+.5)*innerWidth,y:(-.5*v.y+.5)*innerHeight};}
function surfWorld(u:number,v:number){const p=game.player;
 if(!p.nx&&!p.ny)return toWorld(u,v,PLANE_H+p.z);
 if(p.nx)return new THREE.Vector3(p.x+p.nx*PLANE_H,v+.05,-(u*p.nx));
 return new THREE.Vector3(u*-p.ny,v+.05,-(p.y+p.ny*PLANE_H));}
// 面の上では扇形は面の縁で切れる(壁の端・天面・床)。床では従来どおり塊で遮られる。
function surfReach(u:number,v:number,du:number,dv:number,max:number){const p=game.player,f=game.face;
 if(!f)return reach(u,v,du,dv,max,p.z);
 const k=p.nx||-p.ny,a=f.lo*k,b=f.hi*k,uLo=Math.min(a,b),uHi=Math.max(a,b);let t=max;
 if(du>1e-6)t=Math.min(t,(uHi-u)/du);else if(du<-1e-6)t=Math.min(t,(uLo-u)/du);
 if(dv>1e-6)t=Math.min(t,(f.top-v)/dv);else if(dv<-1e-6)t=Math.min(t,-v/dv);
 return Math.max(0,Math.min(t,max));}
function sense(){return .4+.6*Math.min(game.hunger,game.water);}
function visible(x:number,y:number){const pl=game.player,dx=x-pl.x,dy=y-pl.y,dist=Math.hypot(dx,dy);if(dist<.65*sense())return true;
 // 壁に貼り付いている間は床を扇形で走査できない。手が届く範囲だけが分かる(高所の安全と引き換え)。
 if(pl.nx||pl.ny)return dist<1.15*sense();
 const a=Math.atan2(dy,dx),target=Math.atan2(aim.v-pl.y,aim.u-pl.x);const delta=Math.atan2(Math.sin(a-target),Math.cos(a-target));
 return Math.abs(delta)<(probe?.87:.52)&&dist<(probe?4:2.4)*sense()&&reach(pl.x,pl.y,Math.cos(a),Math.sin(a),dist,pl.z)>=dist-.15;}
// 明るさ調整。VEIL_ALPHA を下げる / 他を上げると全体が明るくなる。ガクチョの体感で詰める値。
const VEIL_ALPHA=.88,NEAR_SPAN=1.25,NEAR_MID=.97,FAN_CORE=.97,FAN_MID=.8;
function darkness(){
 ctx.clearRect(0,0,veil.width,veil.height);ctx.fillStyle=`rgba(3,5,7,${VEIL_ALPHA})`;ctx.fillRect(0,0,veil.width,veil.height);
 const u0=game.faceU(),v0=game.faceV();
 const p=projectV(surfWorld(u0,v0)),pu=projectV(surfWorld(u0+1,v0)),scale=Math.hypot(pu.x-p.x,pu.y-p.y),radius=scale*.9*NEAR_SPAN*sense();
 ctx.globalCompositeOperation='destination-out';const near=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,radius);near.addColorStop(0,'rgba(0,0,0,1)');near.addColorStop(.55,`rgba(0,0,0,${NEAR_MID})`);near.addColorStop(1,'transparent');ctx.fillStyle=near;ctx.fillRect(p.x-radius,p.y-radius,2*radius,2*radius);
 const angle=Math.atan2(aim.v-v0,aim.u-u0),range=(probe?4:2.4)*sense(),spread=probe?.87:.52;
 const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,range*scale);g.addColorStop(0,`rgba(0,0,0,${FAN_CORE})`);g.addColorStop(.7,`rgba(0,0,0,${FAN_MID})`);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(p.x,p.y);for(let i=0;i<=50;i++){const a=angle-spread+spread*2*i/50;const r=surfReach(u0,v0,Math.cos(a),Math.sin(a),range);const q=projectV(surfWorld(u0+Math.cos(a)*r,v0+Math.sin(a)*r));ctx.lineTo(q.x,q.y);}ctx.closePath();ctx.fill();ctx.globalCompositeOperation='source-over';
 OBSTACLES.forEach((o,i)=>{if([[o.x-.1,o.y],[o.x+o.w+.1,o.y],[o.x,o.y+o.h+.1],[o.x+o.w/2,o.y-.1]].some(([x,y])=>visible(x,y)))remembered.add(i);if(remembered.has(i)){const q=[[o.x,o.y],[o.x+o.w,o.y],[o.x+o.w,o.y+o.h],[o.x,o.y+o.h]].map(([x,y])=>project(x,y,o.top));ctx.strokeStyle='rgba(157,164,149,.23)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(q[0].x,q[0].y);for(let k=1;k<4;k++)ctx.lineTo(q[k].x,q[k].y);ctx.closePath();ctx.stroke();}});
 checkpointModels.forEach((m,i)=>{const c=game.checkpoints[i];if(visible(c.x,c.y)){const q=project(c.x,c.y);ctx.strokeStyle='rgba(195,181,123,.5)';ctx.beginPath();ctx.arc(q.x,q.y,14,0,Math.PI*2);ctx.stroke();}});
 const d=game.danger.strength;if(d>0){const t=project(game.danger.x,game.danger.y);const a=Math.atan2(t.y-p.y,t.x-p.x);const k=Math.min(innerWidth/2/Math.max(.01,Math.abs(Math.cos(a))),innerHeight/2/Math.max(.01,Math.abs(Math.sin(a))));const x=innerWidth/2+Math.cos(a)*k,y=innerHeight/2+Math.sin(a)*k;const glow=ctx.createRadialGradient(x,y,0,x,y,170);glow.addColorStop(0,`rgba(184,201,209,${Math.min(.6,d*.6)})`);glow.addColorStop(1,'transparent');ctx.fillStyle=glow;ctx.fillRect(0,0,innerWidth,innerHeight);}
 if(game.humanEvent>0){const humanGlow=ctx.createLinearGradient(0,0,0,innerHeight*.4);humanGlow.addColorStop(0,`rgba(207,215,218,${Math.min(.7,game.humanEvent*.6)})`);humanGlow.addColorStop(1,'transparent');ctx.fillStyle=humanGlow;ctx.fillRect(0,0,innerWidth,innerHeight*.4);}
 if(game.antAttack>0){ctx.strokeStyle=`rgba(187,91,63,${.2+game.antAttack/5})`;ctx.lineWidth=8;ctx.strokeRect(4,4,innerWidth-8,innerHeight-8);}
}document.querySelector('#begin')!.addEventListener('click',()=>{started=true;hatchTime=0;hatchStarted=performance.now();document.querySelector('#entry')!.classList.add('gone');void audio.start();probe=false;});
document.querySelector('#again')!.addEventListener('click',()=>{moltVisual.reset();game=new Game();hatchTime=0;hatchStarted=performance.now();remembered.clear();rebuildPickups();ended=false;document.querySelector<HTMLElement>('#ending')!.hidden=true;keys.clear();lastPopulation=game.siblings.length+1;lossNotice=0;lastX=game.player.x;lastY=game.player.y;lastZ=0;});
const population=document.querySelector<HTMLElement>('#population')!,soundButton=document.querySelector<HTMLButtonElement>('#sound')!,soundStatus=document.querySelector<HTMLElement>('#sound-status')!,warningLabel=document.querySelector<HTMLElement>('#warning')!;
document.querySelector('#test-sound')!.addEventListener('click',e=>{void audio.test();(e.currentTarget as HTMLButtonElement).blur();});soundButton.addEventListener('click',()=>{void audio.toggle();soundButton.blur();});
document.querySelector<HTMLInputElement>('#volume')!.addEventListener('input',e=>audio.setVolume(Number((e.target as HTMLInputElement).value)));
let lastX=game.player.x,lastY=game.player.y,lastZ=0,bodyHeading=0,lastPopulation=game.siblings.length+1;
let lossNotice=0,lossCount=0;
const objective=document.querySelector<HTMLElement>('#objective')!;
const moltReq=document.querySelector<HTMLElement>('#molt-req')!;let lastReqHtml='';
const MOLT_NEED=.85; // simulation.ts の moltReady と同じしきい値
const marks=(v:number)=>{const f=Math.floor(Math.min(1,v/MOLT_NEED)*5);return '●'.repeat(f)+'○'.repeat(5-f);};
let previous=performance.now(),accumulator=0;function frame(now:number){requestAnimationFrame(frame);const dt=Math.min((now-previous)/1000,.25);previous=now;
 const p=game.player;const damp=Math.min(1,dt*CAM_LERP);
 // 蛇行するので先読みは +X 固定ではなく、実際に進んでいる向きへ。ゆっくり効かせないと酔う。
 lead.x+=((travelling?Math.cos(bodyHeading)*CAM_LEAD:0)-lead.x)*Math.min(1,dt*.9);lead.y+=((travelling?Math.sin(bodyHeading)*CAM_LEAD:0)-lead.y)*Math.min(1,dt*.9);
 camTarget.x+=((started?p.x+lead.x:4)-camTarget.x)*damp;camTarget.z+=(-(started?p.y+lead.y:4)-camTarget.z)*damp;camTarget.y+=(CAM_HEIGHT+p.z*.55-camTarget.y)*damp;camTarget.y+=Math.sin(now*.055)*game.humanEvent*.08;placeCamera();camera.updateMatrixWorld();
 aimNdc.set(mouse.x/innerWidth*2-1,1-mouse.y/innerHeight*2);aimRay.setFromCamera(aimNdc,camera);
 if(!p.nx&&!p.ny)aimPlane.set(aimN.set(0,1,0),-(PLANE_H+p.z));
 else if(p.nx)aimPlane.set(aimN.set(p.nx,0,0),-p.nx*(p.x+p.nx*PLANE_H));
 else aimPlane.set(aimN.set(0,0,-p.ny),p.ny*-(p.y+p.ny*PLANE_H));
 if(aimRay.ray.intersectPlane(aimPlane,aimHit))aim=(!p.nx&&!p.ny)?{u:aimHit.x,v:-aimHit.z}:p.nx?{u:-aimHit.z*p.nx,v:aimHit.y-.05}:{u:aimHit.x*-p.ny,v:aimHit.y-.05};
 const input={x:Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')),y:Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown')),sprint:keys.has('ShiftLeft')||keys.has('ShiftRight'),freeze:keys.has('Space'),probe,aimX:aim.u,aimY:aim.v};
 if(started&&!ended&&hatchTime>=4&&Math.hypot(camTarget.x-p.x,camTarget.z+p.y)<CAM_CATCHUP){accumulator+=dt;while(accumulator>=1/60){game.update(1/60,input);accumulator-=1/60;}}
 const dxs=p.x-lastX,dys=p.y-lastY,dzs=p.z-lastZ;
 // 面に貼り付いている間は (面に沿う水平方向, 高さ) が進行方向。張り付き/離脱の座標跳びは travel から除く。
 const onFace=p.nx!==0||p.ny!==0;
 const ax=onFace?dxs*-p.ny+dys*p.nx:dxs,ay=onFace?dzs:dys;
 let travel=Math.hypot(ax,ay);if(travel>.001&&travel<.6)bodyHeading=Math.atan2(ay,ax);travel=Math.min(travel,.6);
 travelling=travel>.004;lastX=p.x;lastY=p.y;lastZ=p.z;
 const oldHatch=hatchTime;if(started)hatchTime=Math.min(4,(now-hatchStarted)/1000);if(oldHatch<4&&hatchTime>=4){game.siblings.forEach((s,i)=>{s.x=4+Math.cos(i*2.4)*2.2;s.y=4+Math.sin(i*2.4)*2.2;});}eggLeft.position.x=4-Math.min(1,hatchTime/3)*.4;eggRight.position.x=4+Math.min(1,hatchTime/3)*.4;eggLeft.rotation.y=-hatchTime*.08;eggRight.rotation.y=hatchTime*.08;heroPin.visible=started;pose(heroPin,p.x,p.y,p.z,p.nx,p.ny);animateAnimal(hero,now/1000,travel/Math.max(dt,.001),bodyHeading,game.moltProgress);
 moltVisual.update(game.moltProgress,game.moltReady,game.molting||game.state==='won',p.x,p.y,p.z,bodyHeading,now/1000);
 if(!game.molting){const look=Math.atan2(aim.v-game.faceV(),aim.u-game.faceU())-bodyHeading;(hero.userData.feelers as THREE.Group[]).forEach((f,i)=>f.rotation.z=THREE.MathUtils.clamp(Math.atan2(Math.sin(look),Math.cos(look)),-1.2,1.2)+Math.sin(now*.003+i)*.06);}
 population.textContent=`群れ ${game.siblings.filter(s=>s.alive).length+(game.state==='lost'?0:1)} / ${game.siblings.length+1} 匹（操作中を含む）`;
 soundButton.textContent=audio.muted?'音 OFF → ON':audio.status==='running'?'音 ON → OFF':'音を有効にする';soundStatus.textContent=audio.status==='unavailable'?'音声を開始できません。別ブラウザーでもお試しください。':audio.status==='suspended'?'音が停止中です。「音を有効にする」を押してください。':'';
 const populationNow=game.siblings.filter(s=>s.alive).length+(game.state==='lost'?0:1);if(populationNow<lastPopulation){lossNotice=3;lossCount=lastPopulation-populationNow;}lastPopulation=populationNow;lossNotice=Math.max(0,lossNotice-dt);
 warningLabel.textContent=started&&hatchTime<4?'卵鞘の裂け目から、小さな命が這い出す。':game.antAttack>0?`アリが群がっている — 離れないと捕食される ${Math.max(0,3-game.antAttack).toFixed(1)}秒`:game.water<.12?'水が尽きかけている — 水滴を探す':game.hunger<.12?'体が弱っている — 餌を探す':lossNotice>0?`Gが${lossCount}体、減りました`:'';
 for(const key of ['health','hunger','water'] as const)(document.querySelector('#'+key) as HTMLMeterElement).value=game[key];
 const zone=p.y<9?'孵化の隅':p.y<17?'梁の下':p.y<25?'配線の森':'奥の餌場';
 objective.textContent=game.state==='won'?'第1章 完了 — 最初の脱皮':game.molting?`脱皮中 · ${Math.ceil((1-game.moltProgress)*20)}秒 — ${game.moltProgress<.2?'背中が裂ける':game.moltProgress<.6?'白い体を引き出す':game.moltProgress<.9?'脚と触角を抜く':'新しい体を伸ばす'}`:game.moltReady?'安全な隙間で Space を3秒長押し':`${zone} · 餌と水を探す`;
 const reqHtml=game.state==='won'?'<div class="req-title">脱皮 完了</div>':game.molting?'<div class="req-title">脱皮中 — 動けない</div>':`<div class="req-title">脱皮に必要な蓄え</div><div class="req-row"><span>餌</span><b>${marks(game.hunger)}</b></div><div class="req-row"><span>水</span><b>${marks(game.water)}</b></div><div class="req-hint">${game.moltReady?'準備ができました — 安全な場所で Space を長押し（3秒）':game.hunger>=MOLT_NEED&&game.water>=MOLT_NEED?'体力が足りない — 糞の山で休む':'餌と水を集めて、印を全部埋める'}</div>`;
 if(reqHtml!==lastReqHtml){moltReq.innerHTML=reqHtml;lastReqHtml=reqHtml;}moltReq.classList.toggle('ready',game.moltReady);
 solids.forEach((m,i)=>{m.rotation.y=Math.sin(now*.04+i)*game.humanEvent*.002;});
 kinPins.forEach((m,i)=>{const s=game.siblings[i];m.visible=!!s&&s.alive&&visible(s.x,s.y);if(s){const kdx=s.x-m.position.x,kdy=s.y+m.position.z;const kh=Math.hypot(kdx,kdy)>.001?Math.atan2(kdy,kdx):kin[i].rotation.z;place(m,s.x,s.y);if(hatchTime<4){place(m,4+Math.cos(i*2.4)*hatchTime*.55,4+Math.sin(i*2.4)*hatchTime*.55);m.visible=started&&hatchTime>i*.18;}animateAnimal(kin[i],now/1000+i*.3,Math.hypot(kdx,kdy)/Math.max(dt,.001),kh);}});
 predatorPins.forEach((m,i)=>{const s=game.spiders[i];m.visible=!!s&&visible(s.x,s.y);if(s){animateAnimal(predators[i],now/1000,s.state==="warning"?0:1,s.angle);predators[i].scale.z=predators[i].userData.baseScale*(s.state==="warning"?.72:1);place(m,s.x,s.y,PLANE_H+(s.state==="attack"?.3:0));}});
 antPins.forEach((m,i)=>{const a=game.ants[i];m.visible=!!a&&visible(a.x,a.y);if(a){place(m,a.x,a.y);animateAnimal(ants[i],now/1000+i,1,a.angle);}});pickups.forEach((m,i)=>m.visible=game.resources[i].amount>0);
  crumbs.forEach((m,i)=>{const a=game.ants[i];m.visible=!!a&&a.carrying&&a.target===null&&visible(a.x,a.y);if(a)place(m,a.x+Math.cos(a.angle)*.13,a.y+Math.sin(a.angle)*.13,.16);});
 checkpointModels.forEach((m,i)=>{const c=game.checkpoints[i];m.visible=visible(c.x,c.y);});
 const positions=dustGeometry.getAttribute('position') as THREE.BufferAttribute;for(let i=0;i<positions.count;i++){positions.setY(i,(positions.getY(i)-dt*(.015+game.humanEvent*.5)+3.4)%3.4);}positions.needsUpdate=true;
 warm.position.set(p.x,1.5+p.z,-p.y);warm.intensity=game.moltProgress>0?32:12;
 moon.position.set(p.x+10,14,-p.y+7);moon.target.position.set(p.x,0,-p.y);moon.target.updateMatrixWorld();
 audio.update(dt,{speed:started&&!ended?travel/Math.max(dt,.001):0,danger:game.danger.strength,pan:Math.sign(game.danger.x-p.x),molting:game.molting,stamina:game.stamina,human:game.humanEvent,ants:game.antAttack,vertical:(game.danger.y-p.y),loss:lossNotice>2.9});
 renderer.render(scene,camera);darkness();
 if(started&&!ended&&game.state!=='playing'){ended=true;const end=document.querySelector<HTMLElement>('#ending')!;end.hidden=false;end.querySelector('h2')!.textContent=game.state==='won'?'まだ、生きている。':'闇が、静かになった。';end.querySelector('p')!.textContent=game.state==='won'?'はじめての脱皮を終えた。':'Gの群れは、全滅した。';if(game.state==='won'){completeChapterOne(game.siblings.filter(s=>s.alive).length+1);const again=document.querySelector<HTMLButtonElement>('#again')!;again.dataset.next='chapter2';again.textContent='壁の中へ進む ↓';again.onclick=()=>{const url=new URL(location.href);url.searchParams.set('chapter','2');url.searchParams.set('from','chapter1');location.assign(url);};}}
}requestAnimationFrame(frame);begin.disabled=false;begin.innerHTML='卵から孵る <span>↗</span>';







// Dev-only scene inspection for browser regression tests; absent from production builds.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('test')) {
 Object.assign(window,{gameTest:{get state(){return game;},models:{hero,kin,heroPin,kinPins,scene,camera},start(){started=true;hatchStarted=performance.now()-5000;hatchTime=4;document.querySelector('#entry')!.classList.add('gone');},snapshot(){return{state:game.state,x:game.player.x,y:game.player.y,molting:game.molting,progress:game.moltProgress,ants:game.antAttack,group:game.siblings.filter(s=>s.alive).length+(game.state==='lost'?0:1)};}}});
}

}
void boot().catch(error=>{console.error(error);begin.disabled=false;begin.textContent='読み込みを再試行';begin.onclick=()=>location.reload();});

}