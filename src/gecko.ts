import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

export type GeckoPose={x:number;y:number;z:number;heading:number;mode:'idle'|'warning'|'strike'|'return';warning?:number};
type Joint={bone:THREE.Bone;position:THREE.Vector3;rotation:THREE.Quaternion;worldRotation:THREE.Quaternion;head:THREE.Vector3;tail:THREE.Vector3;distance:number;pathYaw:number};
type Foot={name:string;upper:Joint;lower:Joint;palm:Joint;parent:Joint;digits:Joint[];a:THREE.Vector3;b:THREE.Vector3;c:THREE.Vector3;l1:number;l2:number;anchor:THREE.Vector3;from:THREE.Vector3;to:THREE.Vector3;heading:number;targetHeading:number;swing:number;duration:number;cycle:number;offset:number;stance:boolean;lift:number;contactError:number;curl:number};
type Rig={model:THREE.Object3D;joints:Map<string,Joint>;core:Joint[];feet:Foot[];path:THREE.Vector3[];seed:THREE.Vector3[];last:number|null;previous:THREE.Vector3;heading:number;aim:number;travel:number;speed:number;alert:number;scale:number;length:number;mode:GeckoPose['mode'];backing:boolean;resets:number};
const rigs=new WeakMap<THREE.Group,Rig>(),Z=new THREE.Vector3(0,0,1),Y=new THREE.Vector3(0,1,0),NOSE=3.12,CONTACT=.0012583263451233506;
const clamp=THREE.MathUtils.clamp,angle=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
let asset:GLTF|undefined,pending:Promise<void>|undefined;
export function loadGecko(){return pending??=new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/gecko.glb`).then(g=>{let skin=false;g.scene.traverse(o=>{if(o instanceof THREE.SkinnedMesh)skin=true;});if(!skin||!g.scene.getObjectByName('fore_L_digit3_02'))throw new Error('Gecko rig is missing skin or digit bones');asset=g;}).catch(e=>{pending=undefined;throw e;});}

export function createGecko(scale=.4){
 if(!asset)throw new Error('Call loadGecko before createGecko');
 const g=new THREE.Group(),offset=new THREE.Group(),adapter=new THREE.Group(),model=clone(asset.scene);g.name='Gecko';g.scale.setScalar(scale);offset.position.set(-NOSE,0,-CONTACT);adapter.rotation.x=Math.PI/2;adapter.add(model);offset.add(adapter);g.add(offset);g.updateMatrixWorld(true);
 const joints=new Map<string,Joint>();model.traverse(o=>{if(o instanceof THREE.SkinnedMesh){o.frustumCulled=false;o.castShadow=o.receiveShadow=true;const mats=Array.isArray(o.material)?o.material:[o.material];const own=mats.map(m=>m.clone());o.material=Array.isArray(o.material)?own:own[0];}if(o instanceof THREE.Bone){const h=o.userData.restHead,t=o.userData.restTail;if(!h||!t)return;joints.set(o.name,{bone:o,position:o.position.clone(),rotation:o.quaternion.clone(),worldRotation:o.getWorldQuaternion(new THREE.Quaternion()),head:new THREE.Vector3().fromArray(h),tail:new THREE.Vector3().fromArray(t),distance:0,pathYaw:0});}});
 const names=['head','neck','spine_front','spine_rear','pelvis',...Array.from({length:9},(_,i)=>`tail_${String(i).padStart(2,'0')}`)],core=names.map(n=>joints.get(n)!);if(core.some(j=>!j))throw new Error('Incomplete gecko axial skeleton');
 const seed=[new THREE.Vector3(NOSE,0,0),...core.map(j=>new THREE.Vector3(j.head.x,j.head.y,0)),new THREE.Vector3(core.at(-1)!.tail.x,core.at(-1)!.tail.y,0)];let length=0;
 for(let i=1;i<seed.length;i++){length+=seed[i].distanceTo(seed[i-1])*scale;if(i<=core.length){core[i-1].distance=length;const j=core[i-1];j.pathYaw=j.bone.name.startsWith('tail_')?Math.atan2(j.head.y-j.tail.y,j.head.x-j.tail.x):0;}}
 const feet:Foot[]=[];for(const fore of [true,false])for(const side of ['L','R']){const name=`${fore?'fore':'hind'}_${side}`,upper=joints.get(name+'_upper')!,lower=joints.get(name+'_lower')!,palm=joints.get(name+'_palm')!,parent=joints.get(fore?'spine_front':'pelvis')!;feet.push({name,upper,lower,palm,parent,digits:[...joints.values()].filter(j=>j.bone.name.startsWith(name+'_digit')),a:upper.head.clone(),b:lower.head.clone(),c:palm.head.clone(),l1:upper.head.distanceTo(lower.head)*scale,l2:lower.head.distanceTo(palm.head)*scale,anchor:new THREE.Vector3(),from:new THREE.Vector3(),to:new THREE.Vector3(),heading:0,targetHeading:0,swing:0,duration:.15,cycle:-1,offset:(fore===(side==='L'))?0:.5,stance:true,lift:0,contactError:0,curl:0});}
 rigs.set(g,{model,joints,core,feet,path:[],seed,last:null,previous:new THREE.Vector3(),heading:0,aim:0,travel:0,speed:0,alert:0,scale,length,mode:'idle',backing:false,resets:0});g.userData.gecko=true;g.userData.baseScale=scale;return g;
}

function setWorld(j:Joint,position:THREE.Vector3,quaternion:THREE.Quaternion){const p=j.bone.parent!;p.updateWorldMatrix(true,false);j.bone.position.copy(p.worldToLocal(position.clone()));j.bone.quaternion.copy(p.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(quaternion));j.bone.updateWorldMatrix(false,true);}
function restWorld(r:Rig,v:THREE.Vector3,yaw:number,origin:THREE.Vector3){return v.clone().sub(new THREE.Vector3(NOSE,0,CONTACT)).multiplyScalar(r.scale).applyAxisAngle(Z,yaw).add(origin);}
function initialize(g:THREE.Group,r:Rig,s:GeckoPose){
 r.heading=Number.isFinite(s.heading)?s.heading:0;r.aim=r.heading;r.backing=false;r.travel=0;r.speed=0;r.alert=0;r.previous.set(s.x,s.y,s.z);r.path=r.seed.map(v=>restWorld(r,new THREE.Vector3(v.x,v.y,CONTACT),r.heading,r.previous));r.resets++;
 for(const j of r.joints.values()){j.bone.position.copy(j.position);j.bone.quaternion.copy(j.rotation);j.bone.scale.setScalar(1);}g.position.copy(r.previous);g.rotation.z=r.heading;g.updateMatrixWorld(true);
 for(const f of r.feet){f.anchor.copy(f.palm.bone.getWorldPosition(new THREE.Vector3()));f.from.copy(f.anchor);f.to.copy(f.anchor);f.heading=r.heading;f.targetHeading=r.heading;f.swing=0;f.stance=true;f.cycle=-1;f.lift=0;f.curl=0;}
 // Posed bone world transforms own the turn, so the outer group must not rotate a second time.
 g.rotation.z=0;g.updateMatrixWorld(true);
}
function pathPoint(r:Rig,d:number){let remaining=Math.max(0,d);for(let i=1;i<r.path.length;i++){const a=r.path[i-1],b=r.path[i],len=a.distanceTo(b);if(remaining<=len&&len>1e-8)return a.clone().lerp(b,remaining/len);remaining-=len;}return r.path.at(-1)!.clone();}
function pathYaw(r:Rig,d:number){const a=pathPoint(r,Math.max(0,d-.04)),b=pathPoint(r,d+.04);return Math.hypot(a.x-b.x,a.y-b.y)>1e-6?Math.atan2(a.y-b.y,a.x-b.x):r.heading;}
function neutralFoot(r:Rig,f:Foot,originZ:number,lead:number){
 const q=f.parent.bone.getWorldQuaternion(new THREE.Quaternion()).multiply(f.parent.worldRotation.clone().invert()),hip=f.upper.bone.getWorldPosition(new THREE.Vector3()),target=f.c.clone().sub(f.a).multiplyScalar(r.scale).applyQuaternion(q).add(hip);
 target.x+=Math.cos(r.heading)*lead;target.y+=Math.sin(r.heading)*lead;target.z=originZ+(f.c.z-CONTACT)*r.scale;return target;
}
function aimBone(j:Joint,a:THREE.Vector3,b:THREE.Vector3){const rest=j.tail.clone().sub(j.head).normalize(),direction=b.clone().sub(a).normalize();setWorld(j,a,new THREE.Quaternion().setFromUnitVectors(rest,direction).multiply(j.worldRotation));}
function solveFoot(r:Rig,f:Foot,ankle:THREE.Vector3){
 const hip=f.upper.bone.getWorldPosition(new THREE.Vector3()),delta=ankle.clone().sub(hip),raw=delta.length(),d=clamp(raw,Math.abs(f.l1-f.l2)+.001,(f.l1+f.l2)*.999),direction=delta.normalize(),q=f.parent.bone.getWorldQuaternion(new THREE.Quaternion()).multiply(f.parent.worldRotation.clone().invert());
 const pole=f.b.clone().sub(f.a).multiplyScalar(r.scale).applyQuaternion(q);pole.z=Math.abs(pole.z)+.12*r.scale;pole.addScaledVector(direction,-pole.dot(direction));if(pole.lengthSq()<1e-8)pole.set(0,0,1);pole.normalize();
 const along=(f.l1*f.l1-f.l2*f.l2+d*d)/(2*d),height=Math.sqrt(Math.max(0,f.l1*f.l1-along*along)),knee=hip.clone().addScaledVector(direction,along).addScaledVector(pole,height),end=hip.clone().addScaledVector(direction,d);
 aimBone(f.upper,hip,knee);aimBone(f.lower,knee,end);setWorld(f.palm,end,new THREE.Quaternion().setFromAxisAngle(Z,f.heading).multiply(f.palm.worldRotation));f.contactError=end.distanceTo(ankle);
 for(const j of f.digits){const dir=j.tail.clone().sub(j.head).normalize(),axis=dir.cross(Z).normalize().applyQuaternion(j.worldRotation.clone().invert());j.bone.quaternion.copy(j.rotation).multiply(new THREE.Quaternion().setFromAxisAngle(axis,f.curl*(j.bone.name.endsWith('_02')?1:.45)));}
}

/** Actual displacement drives steps; state only changes posture. This never changes collision/AI. */
export function animateGecko(g:THREE.Group,time:number,s:GeckoPose){
 const r=rigs.get(g);if(!r)return;let dt=r.last===null?0:clamp(time-r.last,0,.05);const origin=new THREE.Vector3(s.x,s.y,s.z),displacement=origin.distanceTo(r.previous),teleport=r.last!==null&&(time<r.last||time-r.last>1||displacement>2.5);
 if(r.last===null||teleport){initialize(g,r,s);dt=0;}r.last=time;r.mode=s.mode;g.position.copy(origin);g.rotation.set(0,0,0);g.scale.setScalar(r.scale);
 const dx=origin.x-r.previous.x,dy=origin.y-r.previous.y,moved=Math.hypot(dx,dy),moving=moved>1e-6&&dt>0;r.speed=moving?moved/dt:0;
 if(moving){
  const velocityYaw=Math.atan2(dy,dx);r.backing=s.mode==='return'&&(r.backing||Math.abs(angle(velocityYaw-r.heading))>2);
  r.travel+=moved;
  if(r.backing){for(const p of r.path){p.x+=dx;p.y+=dy;}r.path[0].copy(origin);}
  else{r.heading+=clamp(angle(velocityYaw-r.heading),-dt*9,dt*9);r.path.unshift(origin.clone());let total=0;for(let i=1;i<r.path.length;i++){total+=r.path[i].distanceTo(r.path[i-1]);if(total>r.length+1){r.path.length=i+1;break;}}if(r.path.length>400)r.path.splice(1,1);}
 }else{
  r.path[0].copy(origin);
  if(s.mode==='warning'&&Number.isFinite(s.heading)){const turn=clamp(angle(s.heading-r.heading),-dt*4,dt*4);r.heading+=turn;for(let i=1;i<r.path.length;i++){const p=r.path[i],d=p.distanceTo(origin),q=p.clone().sub(origin).applyAxisAngle(Z,turn*(1-.30*Math.min(1,d/r.length)));p.copy(origin).add(q);}}
  if(s.mode!=='return')r.backing=false;
 }
 const aimTarget=s.mode==='warning'&&Number.isFinite(s.heading)?s.heading:r.heading;r.aim+=clamp(angle(aimTarget-r.aim),-dt*4,dt*4);
 r.previous.copy(origin);r.alert+=(Number(s.mode==='warning')-r.alert)*(1-Math.exp(-dt*9));
 for(const j of r.joints.values()){j.bone.position.copy(j.position);j.bone.quaternion.copy(j.rotation);j.bone.scale.setScalar(1);}g.updateMatrixWorld(true);
 const breath=Math.sin(time*Math.PI*1.3)*r.scale*(s.mode==='warning'?.013:.006),head=r.joints.get('head')!,neck=r.joints.get('neck')!;
 // Pelvis -> head order is necessary: placing a parent later would move already-placed descendants.
 for(const j of [r.joints.get('pelvis')!,r.joints.get('spine_rear')!,r.joints.get('spine_front')!,neck,head]){
  let yaw=pathYaw(r,j.distance),p=pathPoint(r,j.distance);p.z=s.z+(j.head.z-CONTACT)*r.scale+breath-r.alert*.055*r.scale;
  if(j===head||j===neck){const target=r.aim;yaw+=clamp(angle(target-yaw),-.8,.8)*(j===head?1:.4);}
  if(j===head)p.set(s.x-Math.cos(yaw)*(NOSE-j.head.x)*r.scale,s.y-Math.sin(yaw)*(NOSE-j.head.x)*r.scale,s.z+(j.head.z-CONTACT)*r.scale);
  setWorld(j,p,new THREE.Quaternion().setFromAxisAngle(Z,yaw).multiply(j.worldRotation));
 }
 // Rebuild tail root-to-tip after pelvis, rather than rotating the whole animal as a rigid plank.
 for(const j of r.core.filter(j=>j.bone.name.startsWith('tail_'))){const i=Number(j.bone.name.slice(-2)),yaw=pathYaw(r,j.distance),p=pathPoint(r,j.distance),sway=(moving?.045*Math.sin(r.travel/r.scale*2.6-i*.5):.007*Math.sin(time*.9-i*.3))*r.scale*i/8;p.x-=Math.sin(yaw)*sway;p.y+=Math.cos(yaw)*sway;p.z=s.z+(j.head.z-CONTACT)*r.scale;setWorld(j,p,new THREE.Quaternion().setFromAxisAngle(Z,yaw-j.pathYaw).multiply(j.worldRotation));}
 const stride=2.1*r.scale;
 for(const f of r.feet){const hip=f.upper.bone.getWorldPosition(new THREE.Vector3()),phase=r.travel/stride+f.offset,cycle=Math.floor(phase),fraction=phase-cycle,normal=neutralFoot(r,f,s.z,0),due=moving&&((fraction>.60&&cycle!==f.cycle)||cycle>f.cycle+1),overreach=hip.distanceTo(f.anchor)>(f.l1+f.l2)*.93;
  if(f.stance&&((due&&normal.distanceTo(f.anchor)>.12*r.scale)||overreach)){f.stance=false;f.swing=0;f.from.copy(f.anchor);f.to.copy(neutralFoot(r,f,s.z,moving?stride*.30*(r.backing?-1:1):0));f.duration=moving?clamp(stride*.38/Math.max(r.speed,.6),.022,.24):.12;f.targetHeading=r.heading;f.cycle=cycle;}
  let ankle=f.anchor.clone();if(!f.stance){f.swing=clamp(f.swing+dt/f.duration,0,1);const t=f.swing,e=t*t*(3-2*t);ankle.copy(f.from).lerp(f.to,e);f.lift=Math.sin(Math.PI*t)*.22*r.scale;ankle.z+=f.lift;f.curl=Math.sin(Math.PI*Math.min(1,t/ .83))*.65;f.heading+=angle(f.targetHeading-f.heading)*Math.min(1,dt*16);if(t>=1){f.anchor.copy(f.to);f.stance=true;f.lift=0;f.curl=0;f.cycle=cycle;}}
  else{f.lift=0;f.curl=0;}solveFoot(r,f,ankle);
 }
 g.updateMatrixWorld(true);
}

export function geckoDebug(g:THREE.Group){const r=rigs.get(g);if(!r)return null;const wp=(name:string)=>r.joints.get(name)!.bone.getWorldPosition(new THREE.Vector3()).toArray();return{mode:r.mode,scale:r.scale,travel:r.travel,speed:r.speed,heading:r.heading,backing:r.backing,resets:r.resets,bones:r.joints.size,pathPoints:r.path.length,head:wp('head'),tail:wp('tail_07'),feet:r.feet.map(f=>({name:f.name,stance:f.stance,anchor:f.anchor.toArray(),ankle:f.palm.bone.getWorldPosition(new THREE.Vector3()).toArray(),error:f.contactError,lift:f.lift,curl:f.curl}))};}
export function disposeGecko(g:THREE.Group){const r=rigs.get(g);if(!r)return;const skeletons=new Set<THREE.Skeleton>();r.model.traverse(o=>{if(o instanceof THREE.SkinnedMesh){skeletons.add(o.skeleton);for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});for(const sk of skeletons)sk.dispose();rigs.delete(g);}
