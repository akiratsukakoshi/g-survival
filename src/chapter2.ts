import * as THREE from 'three';
import { animateAnimal, createAnimal, loadAnimals } from './animals';
import { animateCentipede, createCentipede, loadCentipede } from './centipede';
import { animateGecko, createGecko, geckoDebug, loadGecko } from './gecko';
import { animateGeji, createGeji, gejiDebug, loadGeji } from './geji';
import { AudioEngine } from './audio';
import { CELL, ORIGIN_X, SLIT_W, WALL_H, at, axisOf, blockedAt, cellOf, centerOf, chAt, heightAt, parseMaze, reachable } from './chapter2-maze';

type ChapterSave = { version:1; unlockedChapter:number; currentChapter:number; survivors:number; instar:number; bodySize:number; injuries:string[] };
type CentipedeState = 'patrol'|'warning'|'chase'|'recover';
const SAVE_KEY='g-survival-progress-v1';
const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));
// AI暫定値: ヤモリ模型 1.2（従来の3倍）・検知半径 12・突進 1.25 秒、脱皮後速度倍率 1.12、視線切れ 1.0 秒、ランプ距離 14、霧 .03。ガクチョ指定ではない。
const GECKO_SCALE=1.2,GECKO_RANGE=12,SIGHT_GRACE=1,SEE_RANGE=7.5,MOLT_SPEED=1.12;
const clearLine=(ax:number,ay:number,bx:number,by:number)=>{const n=Math.ceil(Math.hypot(bx-ax,by-ay)*4);for(let i=0;i<=n;i++)if(blockedAt(ax+(bx-ax)*i/Math.max(n,1),ay+(by-ay)*i/Math.max(n,1),.2,'enemy'))return false;return true;};

export function readProgress():ChapterSave{try{const v=JSON.parse(localStorage.getItem(SAVE_KEY)??'');if(v?.version===1&&Number.isInteger(v.survivors))return v;}catch{}return{version:1,unlockedChapter:1,currentChapter:1,survivors:24,instar:1,bodySize:.75,injuries:[]};}
export function completeChapterOne(survivors:number){const s:ChapterSave={...readProgress(),unlockedChapter:2,currentChapter:2,survivors:Math.max(1,survivors),instar:3,bodySize:1.02};localStorage.setItem(SAVE_KEY,JSON.stringify(s));}

export async function mountChapterTwo(){
 // 位置の途中再開は未実装。章頭からの新しい挑戦は必ず3齢、引継ぎ匹数だけ保持する。
 const save=readProgress();if(!location.search.includes('from=chapter1')&&save.unlockedChapter<2)save.survivors=8;save.instar=3;save.bodySize=1.02;
 document.title='G-survival — 第2章 壁の中';document.querySelector('#app')!.innerHTML=`<canvas id="shaft"></canvas><div class="vignette"></div><header><span class="mark">G-survival <small>— 隙間の生 —</small></span><span class="chapter">CHAPTER 02 / 壁の中</span></header><div id="entry"><div class="eyebrow">LATE SUMMER / THIRD INSTAR</div><h1>壁の中</h1><p class="story">白い帯は、いつの間にか薄くなった。<br>身体は大きくなり、昨日までの隙間に、胸が触れる。</p><p class="goal"><b>下へ。</b><br>壁の中を、一階分だけ降りる。<br>兄弟の気配は遠ざかり、脚の多い影が近づく。</p><button id="begin" disabled>壁の中を読み込み中…</button><small>この壁へ入った群れ: ${save.survivors}匹</small></div><aside id="hud"><div id="population">${save.survivors} 匹</div><div id="survival"><label>体力 <meter id="health" min="0" max="1"></meter></label><label>栄養 <meter id="hunger" min="0" max="1"></meter></label><label>水分 <meter id="water" min="0" max="1"></meter></label></div><div id="objective">断熱材の層</div><div id="molt-req"></div></aside><div id="warning"></div><div id="controls">WASD / 矢印：這う　·　Shift：走る　·　Space：静止・触角で探る</div><div id="ending" hidden><div class="eyebrow">CHAPTER 02 / FOUNDATION</div><h2></h2><p></p><button id="again">もう一度、壁の中へ ↗</button></div><footer><span>PERIPLANETA FULIGINOSA</span><span>02 — IN THE WALL</span></footer>`;
 await Promise.all([loadAnimals(),loadCentipede(),loadGecko(),loadGeji()]);
 const grid=parseMaze(),BOARD_W=ORIGIN_X*2+grid.cols*CELL,BOARD_H=grid.rows*CELL+2;
 const canvas=document.querySelector<HTMLCanvasElement>('#shaft')!,renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#0b0e10');scene.fog=new THREE.FogExp2('#0b0e10',.03);scene.add(new THREE.HemisphereLight('#9aa8ae','#261d1a',2.1));
 const lamp=new THREE.PointLight('#d1aa82',35,14);scene.add(lamp);const camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.1,180);
 const wallMat=new THREE.MeshStandardMaterial({color:'#2c3738',roughness:.94}),timber=new THREE.MeshStandardMaterial({color:'#55463b',roughness:.88}),voidMat=new THREE.MeshStandardMaterial({color:'#071012',roughness:1}),insulation=new THREE.MeshStandardMaterial({color:'#71654d',roughness:1}),tile=new THREE.MeshStandardMaterial({color:'#d9c8a4',roughness:.68,side:THREE.DoubleSide});
 function box(x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,-y,z);m.castShadow=m.receiveShadow=true;scene.add(m);return m;}
 // 壁板。G のセルだけ穴を抜き、その奥に台所の床と暖色の光を置く(設計書 §1-C)。
 const board=new THREE.Shape();board.moveTo(0,2);board.lineTo(BOARD_W,2);board.lineTo(BOARD_W,2-BOARD_H);board.lineTo(0,2-BOARD_H);board.closePath();
 const hole=new THREE.Path(),hw=CELL*.48;hole.moveTo(grid.goal.x-hw,-grid.goal.y-hw);hole.lineTo(grid.goal.x+hw,-grid.goal.y-hw);hole.lineTo(grid.goal.x+hw,-grid.goal.y+hw);hole.lineTo(grid.goal.x-hw,-grid.goal.y+hw);hole.closePath();board.holes.push(hole);
 const plate=new THREE.Mesh(new THREE.ExtrudeGeometry(board,{depth:.5,bevelEnabled:false,curveSegments:1}),wallMat);plate.position.z=-.6;plate.receiveShadow=true;scene.add(plate);
 const kitchenWall=new THREE.Mesh(new THREE.PlaneGeometry(16,11),tile);kitchenWall.position.set(grid.goal.x,-grid.goal.y+1.6,-4.2);scene.add(kitchenWall);
 const kitchenFloor=new THREE.Mesh(new THREE.PlaneGeometry(16,5),tile);kitchenFloor.rotation.x=-Math.PI/2;kitchenFloor.position.set(grid.goal.x,-grid.goal.y-1.1,-2.2);scene.add(kitchenFloor);
 const kitchenLight=new THREE.PointLight('#ffe1aa',42,10);kitchenLight.position.set(grid.goal.x,-grid.goal.y,.7);scene.add(kitchenLight);
 const kitchenBack=new THREE.PointLight('#ffd9a0',90,14);kitchenBack.position.set(grid.goal.x,-grid.goal.y-.4,-2.2);scene.add(kitchenBack);
 // 見た目＝当たり判定。壁は材木ボックス、隙間は2本の柱、ポケットは窪み、山は台形メッシュ。
 for(const w of grid.walls)box(w.x+w.w/2,w.y+w.h/2,WALL_H/2,w.w,w.h,WALL_H,timber);
 for(const s of grid.slits){const jamb=(CELL-s.width)/2;if(s.axis==='v'){box(s.x-s.width/2-jamb/2,s.y,WALL_H/2,jamb,CELL,WALL_H,timber);box(s.x+s.width/2+jamb/2,s.y,WALL_H/2,jamb,CELL,WALL_H,timber);}else{box(s.x,s.y-s.width/2-jamb/2,WALL_H/2,CELL,jamb,WALL_H,timber);box(s.x,s.y+s.width/2+jamb/2,WALL_H/2,CELL,jamb,WALL_H,timber);}}
 for(const p of grid.pockets)box(p.x,p.y,-.345,CELL-.12,p.ch==='v'?1.13:CELL-.12,.5,voidMat);
 for(const m of grid.mounds){const geometry=new THREE.PlaneGeometry(m.w,m.h,24,24),positions=geometry.attributes.position;for(let i=0;i<positions.count;i++){const x=positions.getX(i)+m.x+m.w/2,y=-positions.getY(i)+m.y+m.h/2;positions.setXYZ(i,x,-y,heightAt(x,y));}geometry.computeVertexNormals();const mound=new THREE.Mesh(geometry,insulation);mound.castShadow=mound.receiveShadow=true;scene.add(mound);}
 const slipper=box(grid.goal.x,grid.goal.y,-3.4,5,1.4,.3,voidMat);slipper.visible=false;
 const hero=createAnimal('roach',save.bodySize),heroSurface=new THREE.Group();hero.userData.instar=3;heroSurface.add(hero);scene.add(heroSurface);
 const heroMaterials:THREE.MeshStandardMaterial[]=[],heroColors:THREE.Color[]=[];hero.traverse(o=>{if(o instanceof THREE.Mesh&&!Array.isArray(o.material)&&o.material instanceof THREE.MeshStandardMaterial){o.material=o.material.clone();heroMaterials.push(o.material);heroColors.push(o.material.color.clone());}});
 const centipedes=grid.centipedes.map(()=>{const model=createCentipede();scene.add(model);return model;});
 const gejiModels=grid.gejis.map(()=>{const model=createGeji(.48);scene.add(model);return model;});
 const geckos=grid.lairs.map(()=>{const model=createGecko(GECKO_SCALE);scene.add(model);return model;});
 const audio=new AudioEngine();const keys=new Set<string>();let started=false,ended=false,last=performance.now(),survivors=save.survivors,invulnerable=0,lossNotice=0,moltHold=0,molting=0,molted=save.bodySize>1.02,humanTimer=-1,elapsed=0;
 let bodySize=save.bodySize;const player={x:grid.start.x,y:grid.start.y,angle:Math.PI/2},checkpoint={x:grid.start.x,y:grid.start.y};
 const enemies=grid.centipedes.map(track=>{const index=Math.floor(track.path.length/2),p=track.path[index];return {x:p.x,y:p.y,state:'patrol' as CentipedeState,timer:0,lost:0,index:index+1,direction:1,speed:0,rejoin:[] as {x:number;y:number}[]};});
 const crossings=grid.gejis.map((lane,i)=>({...lane,offset:i*5,exposure:0,phase:0,x:lane.xLeft+(lane.xRight-lane.xLeft)/2,direction:i?1:-1,heading:i?0:Math.PI,turn:0}));
 const lizards=grid.lairs.map((lair,i)=>({x:lair.x,y:lair.y,tx:lair.x,ty:lair.y,heading:lair.y>68?-Math.PI/2:Math.PI/2,strike:0,timer:0,warning:0}));
 addEventListener('keydown',e=>{if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','Space'].includes(e.code))e.preventDefault();keys.add(e.code);});addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>keys.clear());
 const resize=()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();};addEventListener('resize',resize);resize();
 const begin=document.querySelector<HTMLButtonElement>('#begin')!;begin.disabled=false;begin.innerHTML='壁の中へ入る <span>↓</span>';begin.onclick=()=>{started=true;document.querySelector('#entry')!.classList.add('gone');void audio.start();};document.querySelector<HTMLButtonElement>('#again')!.onclick=()=>location.reload();
 const nearGap=()=>grid.slits.reduce<typeof grid.slits[number]|undefined>((best,s)=>Math.hypot(player.x-s.x,player.y-s.y)<2.2&&(!best||Math.hypot(player.x-s.x,player.y-s.y)<Math.hypot(player.x-best.x,player.y-best.y))?s:best,undefined);
 const sheltered=()=>{const ch=chAt(player.x,player.y);return ch==='o'||ch==='M'||ch==='v'||(SLIT_W[ch]!==undefined&&SLIT_W[ch]>=bodySize);};
 function move(dt:number){if(molting>0||humanTimer>=0||keys.has('Space'))return 0;const dx=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),dy=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0),len=Math.hypot(dx,dy);if(!len)return 0;const speed=(keys.has('ShiftLeft')||keys.has('ShiftRight')?4.62:2.2)*(molted?MOLT_SPEED:1)*(.45+.55*Math.min(hunger,water,health)),step=speed*dt,nx=dx/len,ny=dy/len,r=bodySize/2;
  for(const k of [cellOf(player.x,player.y),cellOf(player.x+nx*1.2,player.y+ny*1.2)]){const ch=at(k.r,k.c);if(SLIT_W[ch]===undefined||SLIT_W[ch]<bodySize)continue;const ctr=centerOf(k.r,k.c);
   if(axisOf(k.r,k.c)==='v'){const d=clamp(ctr.x-player.x,-step,step);if(!blockedAt(player.x+d,player.y,r))player.x+=d;}else{const d=clamp(ctr.y-player.y,-step,step);if(!blockedAt(player.x,player.y+d,r))player.y+=d;}break;}
  const nextX=clamp(player.x+nx*step,ORIGIN_X,ORIGIN_X+grid.cols*CELL),nextY=clamp(player.y+ny*step,.5,grid.rows*CELL-.5);
  if(!blockedAt(nextX,player.y,r))player.x=nextX;if(!blockedAt(player.x,nextY,r))player.y=nextY;player.angle=Math.atan2(-ny,nx);return speed;}
 let hunger=.55,water=.5,health=1;
 const resources=[...['B18','I18','J28'].map(address=>({address,type:'water' as const})),...['D16','H14','B8','L14'].map(address=>({address,type:'food' as const}))].map(r=>{const p=centerOf(Number(r.address.slice(1))-1,r.address.charCodeAt(0)-65),mat=new THREE.MeshStandardMaterial({color:r.type==='water'?'#7399aa':'#a77b40',roughness:r.type==='water'?.18:.9});const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),mat);mesh.scale.set(.3,.24,r.type==='water'?.045:.13);mesh.position.set(p.x,-p.y,heightAt(p.x,p.y)+(r.type==='water'?-.05:.04));scene.add(mesh);return {...r,...p,amount:4,mesh};});
 const restSites=grid.pockets.map(p=>({x:p.x,y:p.y}));
 for(const p of restSites)for(let k=0;k<5;k++){const mesh=new THREE.Mesh(new THREE.SphereGeometry(.07,6,5),new THREE.MeshStandardMaterial({color:'#67472c',roughness:1}));mesh.position.set(p.x+Math.cos(k*2.4)*.22,-p.y+Math.sin(k*2.4)*.18,-.025);scene.add(mesh);}
 function updateResources(dt:number){if(humanTimer>=0)return;hunger=clamp(hunger-dt*.0022,0,1);water=clamp(water-dt*.0038,0,1);
  if(hunger===0||water===0)health=clamp(health-dt*((hunger===0?.035:0)+(water===0?.09:0)),0,1);
  if(!molting){for(const r of resources)if(Math.hypot(player.x-r.x,player.y-r.y)<.7){const amount=Math.min(.18*dt,r.amount,1-(r.type==='food'?hunger:water));r.amount-=amount;if(r.type==='food')hunger+=amount;else water+=amount;r.mesh.visible=r.amount>0;}
   if(restSites.some(p=>Math.hypot(player.x-p.x,player.y-p.y)<.65)){health=clamp(health+dt*.1,0,1);hunger=clamp(hunger+dt*.006,0,1);}}
  if(health<=0){lose();health=1;hunger=.55;water=.5;}
  for(const [id,v] of [['health',health],['hunger',hunger],['water',water]] as const)(document.getElementById(id) as HTMLMeterElement).value=v;
  document.querySelector('#molt-req')!.textContent=molted?'脱皮 完了':moltReady()?'準備ができました — 安全な場所で Space を長押し（3秒）':'脱皮に必要な蓄え：餌 '+Math.min(5,Math.floor(hunger/.85*5))+'/5 · 水 '+Math.min(5,Math.floor(water/.85*5))+'/5';
 }
 const moltReady=()=>!molted&&molting<=0&&hunger>=.85&&water>=.85&&health>.25;
 function moveEnemy(enemy:{x:number;y:number},target:{x:number;y:number},speed:number,dt:number,r=.4){const dx=target.x-enemy.x,dy=target.y-enemy.y,d=Math.hypot(dx,dy)||1,step=Math.min(d,speed*dt);
  if(!blockedAt(enemy.x+dx/d*step,enemy.y,r,'enemy'))enemy.x+=dx/d*step;if(!blockedAt(enemy.x,enemy.y+dy/d*step,r,'enemy'))enemy.y+=dy/d*step;}
 function updateEnemy(dt:number){for(const [i,enemy] of enemies.entries()){const ox=enemy.x,oy=enemy.y;enemy.timer+=dt;
  if(enemy.state==='patrol'){const track=grid.centipedes[i].path,target=track[enemy.index];moveEnemy(enemy,target,.84,dt);
   if(Math.hypot(enemy.x-target.x,enemy.y-target.y)<.025){if(enemy.index===0||enemy.index===track.length-1)enemy.direction=enemy.index===0?1:-1;enemy.index+=enemy.direction;}
   if(Math.hypot(enemy.x-player.x,enemy.y-player.y)<SEE_RANGE&&!sheltered()&&clearLine(enemy.x,enemy.y,player.x,player.y)){enemy.state='warning';enemy.timer=0;enemy.lost=0;}}
  else if(enemy.state==='warning'){if(sheltered()){enemy.state='recover';enemy.timer=0;enemy.rejoin=[];}else if(enemy.timer>=.6){enemy.state='chase';enemy.timer=0;}}
  else if(enemy.state==='chase'){
   enemy.lost=clearLine(enemy.x,enemy.y,player.x,player.y)?0:enemy.lost+dt;
   if(sheltered()||enemy.lost>=SIGHT_GRACE){enemy.state='recover';enemy.timer=0;enemy.lost=0;enemy.rejoin=[];}
   else{moveEnemy(enemy,player,3.9,dt);if(Math.hypot(enemy.x-player.x,enemy.y-player.y)<.58&&heightAt(player.x,player.y)<.3&&invulnerable<=0)lose();}}
  else if(enemy.timer>=1.6){
   if(!enemy.rejoin.length){const track=grid.centipedes[i].path;let nearest=0;for(let k=1;k<track.length;k++)if(Math.hypot(track[k].x-enemy.x,track[k].y-enemy.y)<Math.hypot(track[nearest].x-enemy.x,track[nearest].y-enemy.y))nearest=k;
    enemy.index=nearest;enemy.direction=nearest===track.length-1?-1:1;enemy.rejoin=reachable(.8,cellOf(enemy.x,enemy.y),track[nearest],'enemy').path;}
   const target=enemy.rejoin[0];if(target){moveEnemy(enemy,target,1.2,dt);if(Math.hypot(enemy.x-target.x,enemy.y-target.y)<.025)enemy.rejoin.shift();}
   if(!enemy.rejoin.length){enemy.state='patrol';enemy.timer=0;}}
  enemy.speed=Math.hypot(enemy.x-ox,enemy.y-oy)/Math.max(dt,.001);
 }}
 function lose(){if(invulnerable>0)return;survivors--;molting=0;moltHold=0;lossNotice=2.5;invulnerable=1.2;player.x=checkpoint.x;player.y=checkpoint.y;for(const enemy of enemies){enemy.state='recover';enemy.timer=0;enemy.lost=0;enemy.rejoin=[];}for(const lizard of lizards){lizard.warning=lizard.strike=lizard.timer=0;}if(survivors<=0)finish(false);}
 // 吻先から後方1.5までの頭部だけが捕食域。プレイヤー半径を加え、遮蔽物越しの接触は無効。
 function geckoContact(lizard:typeof lizards[number]){const dx=player.x-lizard.x,dy=player.y-lizard.y,bx=-Math.cos(lizard.heading),by=Math.sin(lizard.heading),along=clamp(dx*bx+dy*by,0,1.5),distance=Math.hypot(dx-bx*along,dy-by*along);return distance<.45+bodySize/2&&clearLine(lizard.x,lizard.y,player.x,player.y);}
 function moveLizard(lizard:typeof lizards[number],target:{x:number;y:number},speed:number,dt:number){const dx=target.x-lizard.x,dy=target.y-lizard.y,f=Math.max(0,Math.min(1,dx>0?(25.2-lizard.x)/dx:dx<0?(6.8-lizard.x)/dx:1,dy>0?(77-lizard.y)/dy:dy<0?(59-lizard.y)/dy:1));moveEnemy(lizard,{x:lizard.x+dx*f,y:lizard.y+dy*f},speed,dt,.45);}
 function updateHazards(dt:number,now:number){
  for(const lane of crossings){lane.phase=(now+lane.offset)%10;lane.exposure=Math.abs(player.y-lane.y)<5?lane.exposure+dt:0;
   if(lane.turn>0){lane.turn=Math.max(0,lane.turn-dt);lane.heading+=(lane.direction>0?-1:1)*Math.PI*dt/.9;}
   else{lane.heading=lane.direction>0?0:Math.PI;lane.x+=lane.direction*2.7*dt;if(lane.x>=lane.xRight||lane.x<=lane.xLeft){lane.x=clamp(lane.x,lane.xLeft,lane.xRight);lane.direction*=-1;lane.turn=.9;}}
   const rear=lane.x-Math.cos(lane.heading)*2.4;
   if(lane.exposure>=.9&&lane.turn<=0&&!sheltered()&&Math.abs(player.y-lane.y)<.9&&player.x<=Math.max(lane.x,rear)+.25&&player.x>=Math.min(lane.x,rear)-.25&&heightAt(player.x,player.y)<.3)lose();}
  for(const [i,lizard] of lizards.entries()){const lair=grid.lairs[i],home=Math.hypot(lizard.x-lair.x,lizard.y-lair.y)<.05;
   const visible=!sheltered()&&Math.hypot(player.x-lair.x,player.y-lair.y)<GECKO_RANGE&&clearLine(lizard.x,lizard.y,player.x,player.y);
   if(lizard.warning>0){if(!visible){lizard.warning=0;lizard.timer=0;}else{lizard.warning=Math.max(0,lizard.warning-dt);if(lizard.warning===0)lizard.strike=1.25;}}
   else if(lizard.strike<=0&&home){lizard.timer=visible?lizard.timer+dt:0;if(lizard.timer>=1.1){lizard.warning=.9;lizard.timer=0;const dx=player.x-lizard.x,dy=player.y-lizard.y,d=Math.hypot(dx,dy)||1;lizard.tx=lizard.x+dx/d*15;lizard.ty=lizard.y+dy/d*15;lizard.heading=Math.atan2(-(lizard.ty-lizard.y),lizard.tx-lizard.x);}}
   if(lizard.strike>0){lizard.strike=Math.max(0,lizard.strike-dt);moveLizard(lizard,{x:lizard.tx,y:lizard.ty},12,dt);if(!sheltered()&&heightAt(player.x,player.y)<.3&&geckoContact(lizard))lose();}
   else if(lizard.warning<=0&&!home)moveLizard(lizard,lair,3,dt);
  }
  if(moltReady()&&keys.has('Space'))moltHold+=dt;else moltHold=0;
  if(moltReady()&&moltHold>=3){molting=3.2;moltHold=0;}
  if(molting>0){molting=Math.max(0,molting-dt);if(molting===0){molted=true;bodySize=1.2;hero.userData.baseScale=bodySize;save.bodySize=bodySize;save.instar=4;save.unlockedChapter=Math.max(2,save.unlockedChapter);save.currentChapter=2;localStorage.setItem(SAVE_KEY,JSON.stringify(save));}}
  if(humanTimer<0&&Math.abs(player.x-grid.goal.x)<CELL/2&&Math.abs(player.y-grid.goal.y)<CELL/2)humanTimer=0;
  if(humanTimer>=0){humanTimer+=dt;if(humanTimer>=3.2)finish(true);}
 }
 function finish(won:boolean){if(ended)return;ended=true;const end=document.querySelector<HTMLElement>('#ending')!;end.hidden=false;end.querySelector('h2')!.textContent=won?'床下の冷たさ':'脚音だけが残った';end.querySelector('p')!.textContent=won?'床板が震え、スリッパの影が隙間を横切った。次の闇が、台所に続いている。':'Gの群れは、壁の途中で途絶えた。';}
 function render(now:number,speed:number){const sink=humanTimer>=0?clamp(humanTimer/1.2,0,1)*-1.52:0;heroSurface.position.set(player.x,-player.y,-.095+heightAt(player.x,player.y)+sink);const slopeX=(heightAt(player.x+.05,player.y)-heightAt(player.x-.05,player.y))/.1,slopeY=(heightAt(player.x,player.y+.05)-heightAt(player.x,player.y-.05))/.1;heroSurface.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(-slopeX,slopeY,1).normalize());
  hero.userData.sensing=keys.has('Space');animateAnimal(hero,now/1000,speed,player.angle);hero.scale.setScalar(molting>0?bodySize+(1.2-bodySize)*(1-molting/3.2):bodySize);
  for(const [i,mat] of heroMaterials.entries()){const p=1-molting/3.2,white=molting>0?Math.sin(p*Math.PI):0;mat.color.copy(heroColors[i]).lerp(new THREE.Color('#fff3dc'),white);mat.emissive.set('#d5c8a2');mat.emissiveIntensity=molting>0?.22:moltReady()?.1+.08*Math.sin(now/1000*3):0;}
  for(const [i,model] of centipedes.entries()){const enemy=enemies[i];model.position.set(enemy.x,-enemy.y,.02);animateCentipede(model,now/1000,enemy.speed);}
  for(const [i,model] of gejiModels.entries()){const lane=crossings[i];model.visible=true;animateGeji(model,now/1000,{x:lane.x,y:-lane.y,z:-.095,heading:lane.heading,active:true},(x,y)=>blockedAt(x,-y,.025,'enemy')?null:-.095+heightAt(x,-y));}
  for(const [i,model] of geckos.entries()){const lizard=lizards[i],lair=grid.lairs[i];model.visible=Math.hypot(player.x-lizard.x,player.y-lizard.y)<16+9.1*GECKO_SCALE;animateGecko(model,now/1000,{x:lizard.x,y:-lizard.y,z:-.095,heading:lizard.heading,mode:lizard.warning>0?'warning':lizard.strike>0?'strike':Math.hypot(lizard.x-lair.x,lizard.y-lair.y)>.05?'return':'idle',warning:lizard.warning});}
  slipper.visible=humanTimer>=1.2;slipper.position.x=grid.goal.x+(humanTimer-2.2)*4;const near=humanTimer>=0?clamp(humanTimer/1.4,0,1):0;camera.position.set(player.x+7-2*near,-player.y+5-near,22-5*near);camera.lookAt(player.x-8*near,-player.y-2+near,.3);lamp.distance=keys.has('Space')?22:14;lamp.intensity=keys.has('Space')?52:35;lamp.position.set(player.x,-player.y+1,4);renderer.render(scene,camera);
 }
 function frame(now:number){requestAnimationFrame(frame);const dt=Math.min(.05,(now-last)/1000);last=now;let speed=0;if(started&&!ended){invulnerable=Math.max(0,invulnerable-dt);lossNotice=Math.max(0,lossNotice-dt);elapsed+=dt;updateResources(dt);speed=move(dt);if(sheltered()){checkpoint.x=player.x;checkpoint.y=player.y;}updateEnemy(dt);updateHazards(dt,elapsed);const enemy=enemies.reduce((best,e)=>Math.hypot(e.x-player.x,e.y-player.y)<Math.hypot(best.x-player.x,best.y-player.y)?e:best),geckoWarning=lizards.some(l=>l.warning>0)?1:0;const gap=nearGap(),tooNarrow=!!gap&&gap.width<bodySize,danger=enemies.some(e=>e.state==='warning'||e.state==='chase'),gejiWarning=crossings.some(l=>Math.abs(player.y-l.y)<7&&(l.exposure<.9||l.turn>0));const warning=lossNotice>0?'Gが1体、減りました':humanTimer>=0?(humanTimer<1.2?'床板が、上で軋み始めた。':'重い影が、隙間を横切る。'):molting>0?'背中が裂け、白い脚が壁に貼りつく。':!molted&&moltHold>0?'殻の内側が、ゆっくり膨らむ。':tooNarrow?'胸が擦れる。ここはもう通れない。':danger?(enemy.state==='warning'?'粉塵が、下から浮いた。':'ムカデの頭が、こちらへ向いた。'):geckoWarning>0?'巾木の影が、呼吸のように膨らむ。':gejiWarning?'配管の上で、細い脚音が増えていく。':keys.has('Space')&&gap?(gap.width>=bodySize?'触角の先に、身体を隠せる奥行きがある。':'触角が、奥で戻ってきた。'):'';document.querySelector('#warning')!.textContent=warning;document.querySelector('#population')!.textContent=survivors+' 匹';document.querySelector('#objective')!.textContent=player.y<16?'断熱材の層':player.y<40?'配線と間柱のシャフト':player.y<62?'湿った配管の分岐':player.y<82?'巾木の裏':'キッチンの床下';audio.update(dt,{speed:speed/3.6,danger:danger?1:gejiWarning||geckoWarning>0? .8:humanTimer>=0?.9:0,pan:Math.sign(enemy.x-player.x),molting:molting>0,stamina:health,human:humanTimer>=0?1:0,vertical:enemy.y-player.y,loss:lossNotice>2});}render(now,speed);}
 if(import.meta.env.DEV&&new URLSearchParams(location.search).has('test'))Object.assign(window,{chapter2Test:{models:{hero,geckos,gejiModels},step(dt:number){if(ended)return;elapsed+=dt;invulnerable=Math.max(0,invulnerable-dt);lossNotice=Math.max(0,lossNotice-dt);updateResources(dt);move(dt);if(sheltered()){checkpoint.x=player.x;checkpoint.y=player.y;}updateEnemy(dt);updateHazards(dt,elapsed);},setPosition(x:number,y:number){player.x=x;player.y=y;},snapshot(){return{health,hunger,water,resources:resources.map(r=>({address:r.address,type:r.type,amount:r.amount,x:r.x,y:r.y})),restSites,instarModel:hero.userData.instar,senseRange:keys.has('Space')?22:14,gejiVisuals:gejiModels.map(gejiDebug),geckoVisual:geckoDebug(geckos[0]),geckoVisuals:geckos.map(geckoDebug),...player,survivors,enemy:{...enemies[0]},enemies:enemies.map(e=>({...e})),crossings:crossings.map(l=>({...l})),lizards:lizards.map(l=>({...l})),elapsed,height:heightAt(player.x,player.y),geckoAttack:{...lizards[0]},sheltered:sheltered(),molted,bodySize,visualScale:hero.scale.x,moltReady:moltReady(),glow:heroMaterials[0]?.emissiveIntensity,speedMultiplier:molted?MOLT_SPEED:1,humanTimer,geckoTimer:lizards[0].timer,geckoWarning:lizards[0].warning,moltHold,molting};},setResources(food:number,drink:number,hp=1){hunger=food;water=drink;health=hp;},setEnemy(state:CentipedeState,y:number,timer=0,x=grid.centipede.x,index=0){const enemy=enemies[index];enemy.state=state;enemy.x=x;enemy.y=y;enemy.timer=timer;enemy.lost=0;enemy.rejoin=[];},startMolt(){if(moltReady())molting=3.2;},route(to=grid.goal){return reachable(bodySize,cellOf(player.x,player.y),to).path.map(p=>({x:p.x,y:p.y}));},maze:{cell:CELL,cols:grid.cols,rows:grid.rows,start:grid.start,goal:grid.goal,molt:grid.molt,lair:grid.lair,lairs:grid.lairs,pockets:grid.pockets,slits:grid.slits,centipede:grid.centipede,centipedes:grid.centipedes,geji:grid.geji,gejis:grid.gejis}}});requestAnimationFrame(frame);
}
