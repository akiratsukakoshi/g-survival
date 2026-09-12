import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

export type GejiPose={x:number;y:number;z:number;heading:number;active?:boolean};
type Joint={bone:THREE.Bone;position:THREE.Vector3;rotation:THREE.Quaternion;worldRotation:THREE.Quaternion;head:THREE.Vector3;tail:THREE.Vector3};
type Foot={name:string;upper:Joint;lower:Joint;tarsus:Joint;a:THREE.Vector3;b:THREE.Vector3;c:THREE.Vector3;d:THREE.Vector3;l1:number;l2:number;anchor:THREE.Vector3;from:THREE.Vector3;to:THREE.Vector3;stance:boolean;swing:number;duration:number;cycle:number;offset:number;lift:number;error:number;steps:number;curl:number};
type Rig={model:THREE.Object3D;joints:Joint[];feet:Foot[];antennae:Joint[];scale:number;previous:THREE.Vector3;last:number|null;travel:number;speed:number;heading:number;active:boolean;resets:number};
export type GejiSurface=(x:number,y:number)=>number|null;
const Z=new THREE.Vector3(0,0,1),Y=new THREE.Vector3(0,1,0),NOSE=2.72,CONTACT=.022,clamp=THREE.MathUtils.clamp;
const rigs=new WeakMap<THREE.Group,Rig>();let asset:GLTF|undefined,pending:Promise<void>|undefined;
export function loadGeji(){return pending??=new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/geji.glb`).then(g=>{let skin=false;g.scene.traverse(o=>{if(o instanceof THREE.SkinnedMesh)skin=true;});if(!skin||!g.scene.getObjectByName('leg_14_R_03'))throw new Error('Geji skin or leg joints missing');asset=g;}).catch(e=>{pending=undefined;throw e;});}
export function createGeji(scale=.48){
 if(!asset)throw new Error('Call loadGeji before createGeji');
 const g=new THREE.Group(),offset=new THREE.Group(),adapter=new THREE.Group(),model=clone(asset.scene);g.name='Geji';g.scale.setScalar(scale);offset.position.set(-NOSE,0,-CONTACT);adapter.rotation.x=Math.PI/2;adapter.add(model);offset.add(adapter);g.add(offset);g.updateMatrixWorld(true);
 const joints:Joint[]=[];model.traverse(o=>{if(o instanceof THREE.SkinnedMesh){o.frustumCulled=false;o.castShadow=o.receiveShadow=true;o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();}if(o instanceof THREE.Bone&&o.userData.restHead){joints.push({bone:o,position:o.position.clone(),rotation:o.quaternion.clone(),worldRotation:o.getWorldQuaternion(new THREE.Quaternion()),head:new THREE.Vector3().fromArray(o.userData.restHead),tail:new THREE.Vector3().fromArray(o.userData.restTail)});}});
 const feet:Foot[]=[];for(let i=0;i<15;i++)for(const side of ['L','R']){const name=`leg_${String(i).padStart(2,'0')}_${side}`,upper=joints.find(j=>j.bone.name===name+'_01')!,lower=joints.find(j=>j.bone.name===name+'_02')!,tarsus=joints.find(j=>j.bone.name===name+'_03')!;if(!upper||!lower||!tarsus)throw new Error('Incomplete geji skeleton');feet.push({name,upper,lower,tarsus,a:upper.head.clone(),b:lower.head.clone(),c:tarsus.head.clone(),d:tarsus.tail.clone(),l1:upper.head.distanceTo(lower.head)*scale,l2:lower.head.distanceTo(tarsus.head)*scale,anchor:new THREE.Vector3(),from:new THREE.Vector3(),to:new THREE.Vector3(),stance:true,swing:0,duration:.1,cycle:0,offset:(i*.173+(side==='R'?.5:0))%1,lift:0,error:0,steps:0,curl:0});}
 rigs.set(g,{model,joints,feet,antennae:joints.filter(j=>j.bone.name.startsWith('feeler_')),scale,previous:new THREE.Vector3(),last:null,travel:0,speed:0,heading:0,active:false,resets:0});return g;
}
function setWorld(j:Joint,p:THREE.Vector3,q:THREE.Quaternion){const parent=j.bone.parent!;parent.updateWorldMatrix(true,false);j.bone.position.copy(parent.worldToLocal(p.clone()));j.bone.quaternion.copy(parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));j.bone.updateWorldMatrix(false,false);}
function aim(j:Joint,a:THREE.Vector3,b:THREE.Vector3){setWorld(j,a,new THREE.Quaternion().setFromUnitVectors(j.tail.clone().sub(j.head).normalize(),b.clone().sub(a).normalize()).multiply(j.worldRotation));}
function neutral(r:Rig,f:Foot,origin:THREE.Vector3,lead:number,surface?:GejiSurface){
 const p=f.d.clone().sub(new THREE.Vector3(NOSE,0,CONTACT)).multiplyScalar(r.scale).applyAxisAngle(Z,r.heading).add(origin);p.x+=Math.cos(r.heading)*lead;p.y+=Math.sin(r.heading)*lead;
 // Keep toes on the board inside narrow lanes, rather than planting them inside timber.
 if(surface){const hip=f.upper.bone.getWorldPosition(new THREE.Vector3()),dest=p.clone();let h=surface(p.x,p.y);for(let k=1;h===null&&k<=12;k++){p.x=THREE.MathUtils.lerp(dest.x,hip.x,k/12);p.y=THREE.MathUtils.lerp(dest.y,hip.y,k/12);h=surface(p.x,p.y);}if(h!==null)p.z=h+(f.d.z-CONTACT)*r.scale;}
 return p;
}
function reachable(r:Rig,f:Foot,p:THREE.Vector3){
 const hip=f.upper.bone.getWorldPosition(new THREE.Vector3()),toe=f.d.clone().sub(f.c).multiplyScalar(r.scale).applyAxisAngle(Z,r.heading),ankle=p.clone().sub(toe),reach=Math.sqrt(Math.max(0,((f.l1+f.l2)*.98)**2-(ankle.z-hip.z)**2)),dx=ankle.x-hip.x,dy=ankle.y-hip.y,d=Math.hypot(dx,dy);
 if(d>reach){p.x=hip.x+dx/d*reach+toe.x;p.y=hip.y+dy/d*reach+toe.y;}return p;
}
function solve(r:Rig,f:Foot,foot:THREE.Vector3){
 const yaw=new THREE.Quaternion().setFromAxisAngle(Z,r.heading),pitch=new THREE.Quaternion().setFromAxisAngle(Y,-f.curl),toe=f.d.clone().sub(f.c).multiplyScalar(r.scale).applyQuaternion(pitch).applyQuaternion(yaw),ankle=foot.clone().sub(toe),hip=f.upper.bone.getWorldPosition(new THREE.Vector3()),delta=ankle.clone().sub(hip),raw=delta.length(),d=clamp(raw,Math.abs(f.l1-f.l2)+1e-5,(f.l1+f.l2)*.99999),direction=delta.normalize();
 const pole=f.b.clone().sub(f.a).applyQuaternion(yaw);pole.addScaledVector(direction,-pole.dot(direction));if(pole.lengthSq()<1e-10)pole.copy(Z);pole.normalize();
 const along=(f.l1*f.l1-f.l2*f.l2+d*d)/(2*d),height=Math.sqrt(Math.max(0,f.l1*f.l1-along*along)),knee=hip.clone().addScaledVector(direction,along).addScaledVector(pole,height),end=hip.clone().addScaledVector(direction,d);
 aim(f.upper,hip,knee);aim(f.lower,knee,end);setWorld(f.tarsus,end,yaw.multiply(pitch).multiply(f.tarsus.worldRotation));f.error=end.distanceTo(ankle);
}
/** Metachronal contact gait: displacement schedules steps; world anchors prevent skating. */
export function animateGeji(g:THREE.Group,time:number,s:GejiPose,surface?:GejiSurface){
 const r=rigs.get(g);if(!r)return;const origin=new THREE.Vector3(s.x,s.y,s.z),active=s.active!==false;let dt=r.last===null?0:clamp(time-r.last,0,.05),moved=origin.distanceTo(r.previous);
 const reset=r.last===null||time<r.last||time-r.last>1||moved>2||active!==r.active;const turned=Math.abs(Math.atan2(Math.sin(s.heading-r.heading),Math.cos(s.heading-r.heading)));r.heading=s.heading;
 g.position.copy(origin);g.rotation.set(0,0,r.heading);g.scale.setScalar(r.scale);
 for(const j of r.joints){j.bone.position.copy(j.position);j.bone.quaternion.copy(j.rotation);}g.updateMatrixWorld(true);
 if(reset){r.travel=0;r.resets++;dt=0;moved=0;for(const f of r.feet){f.anchor.copy(reachable(r,f,neutral(r,f,origin,0,surface)));f.from.copy(f.anchor);f.to.copy(f.anchor);f.stance=true;f.swing=0;f.lift=f.curl=0;f.cycle=-1;}}
 r.active=active;r.last=time;r.previous.copy(origin);const travel=moved+(reset?0:turned*2*r.scale);r.speed=dt>0&&active?travel/dt:0;const moving=active&&r.speed>1e-5;if(moving)r.travel+=travel;
 const stride=1.25*r.scale;
 for(const f of r.feet){
  if(!active){f.anchor.copy(neutral(r,f,origin,0,surface));f.stance=true;f.lift=f.curl=0;continue;}
  const hip=f.upper.bone.getWorldPosition(new THREE.Vector3()),toe=f.d.clone().sub(f.c).multiplyScalar(r.scale).applyAxisAngle(Z,r.heading),phase=r.travel/stride+f.offset,cycle=Math.floor(phase),fraction=phase-cycle,reach=hip.distanceTo(f.anchor.clone().sub(toe)),due=moving&&fraction>=.64&&f.cycle!==cycle,forced=moving&&(reach>(f.l1+f.l2)*(turned>.001?.82:.96)||reach<Math.abs(f.l1-f.l2)+.03);
  if(f.stance&&(due||forced)){f.stance=false;f.swing=0;f.from.copy(f.anchor);f.to.copy(reachable(r,f,neutral(r,f,origin,stride*.68,surface)));f.duration=clamp(stride*.36/Math.max(r.speed,.01),.028,.3);f.cycle=cycle;f.steps++;}
  const target=f.anchor.clone();if(!f.stance){f.to.copy(reachable(r,f,f.to));f.swing=clamp(f.swing+dt/f.duration,0,1);const t=f.swing,e=t*t*(3-2*t);target.copy(f.from).lerp(f.to,e);f.lift=Math.sin(Math.PI*t)*.22*r.scale;f.curl=Math.sin(Math.PI*t)*.22;target.z+=f.lift;if(t>=1){f.anchor.copy(f.to);f.stance=true;f.lift=f.curl=0;}}
  else f.lift=f.curl=0;solve(r,f,target);
 }
 // Only feelers continue a small searching movement at rest. Legs settle and remain planted.
 for(const j of r.antennae){const bits=j.bone.name.split('_'),index=Number(bits[2]),side=Number(bits[1]),axis=Z.clone().applyQuaternion(j.worldRotation.clone().invert()),bend=Math.sin(time*2.2-index*.38+side)*.018;j.bone.quaternion.copy(j.rotation).multiply(new THREE.Quaternion().setFromAxisAngle(axis,bend));}
 g.updateMatrixWorld(true);
}
export function gejiDebug(g:THREE.Group){const r=rigs.get(g);if(!r)return null;const wp=(j:Joint)=>j.bone.getWorldPosition(new THREE.Vector3()).toArray();return{bones:r.joints.length,scale:r.scale,heading:r.heading,travel:r.travel,speed:r.speed,resets:r.resets,active:r.active,visible:g.visible,origin:g.position.toArray(),feet:r.feet.map(f=>({name:f.name,stance:f.stance,anchor:f.anchor.toArray(),hip:wp(f.upper),knee:wp(f.lower),ankle:wp(f.tarsus),foot:f.d.clone().sub(f.c).applyQuaternion(f.tarsus.worldRotation.clone().invert()).applyMatrix4(f.tarsus.bone.matrixWorld).toArray(),l1:f.l1,l2:f.l2,error:f.error,lift:f.lift,steps:f.steps,curl:f.curl}))};}
export function disposeGeji(g:THREE.Group){const r=rigs.get(g);if(!r)return;r.model.traverse(o=>{if(o instanceof THREE.SkinnedMesh){o.skeleton.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});rigs.delete(g);}
