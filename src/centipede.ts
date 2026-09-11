import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';

let asset:GLTF|undefined,pending:Promise<void>|undefined;
type Segment={node:THREE.Group;base:THREE.Vector3;index:number};
type Leg={node:THREE.Group;index:number;side:number};
type Rig={segments:Segment[];legs:Leg[];last:number|null;phase:number;model:THREE.Group;head:THREE.Group;antennae:THREE.Group[];previous:THREE.Vector3;trail:THREE.Vector3[];heading:number};
const rigs=new WeakMap<THREE.Group,Rig>();
// Native glTF -Z forward / +Y up -> wall +X forward / +Z out.
const basis=new THREE.Matrix4().makeBasis(new THREE.Vector3(0,-1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(-1,0,0));
export function loadCentipede(){return pending??=new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/centipede.glb`).then(g=>{if(!g.scene.getObjectByName('head'))throw new Error('Centipede head missing');asset=g;}).catch(error=>{pending=undefined;throw error;});}
export function createCentipede(){
 if(!asset)throw new Error('Call loadCentipede before creating a centipede');
 const g=new THREE.Group(),adapter=new THREE.Group(),model=asset.scene.clone(true);adapter.quaternion.setFromRotationMatrix(basis);adapter.add(model);g.add(adapter);g.scale.setScalar(.82);
 // Anchor simulation/contact to the actual head, keeping the accepted asset proportions.
 const head=model.getObjectByName('head')!;model.position.copy(head.position).multiplyScalar(-1);model.position.y=0;
 const pieces=[...model.children],segments:Segment[]=[],legs:Leg[]=[];
 for(let index=0;index<17;index++){
  const plate=model.getObjectByName(`tergite_${String(index).padStart(2,'0')}`)!;const node=new THREE.Group();node.position.copy(plate.position);model.add(node);segments.push({node,base:node.position.clone(),index});
  for(const part of pieces){const m=part.name.match(/^(?:tergite|sternite|leg)_(\d+)/);if(m&&Number(m[1])===index){part.position.sub(node.position);node.add(part);}}
  for(const side of [-1,1]){const tag=side<0?'L':'R',parts=node.children.filter(p=>p.name.startsWith(`leg_${String(index).padStart(2,'0')}_${tag}_`));if(!parts.length)continue;
   const upper=parts.find(p=>p.name.endsWith('_upper'))! as THREE.Mesh;upper.geometry.computeBoundingBox();const bounds=upper.geometry.boundingBox!;
   const a=new THREE.Vector3(0,bounds.min.y,0).applyQuaternion(upper.quaternion).add(upper.position),b=new THREE.Vector3(0,bounds.max.y,0).applyQuaternion(upper.quaternion).add(upper.position);
   const pivot=new THREE.Group();pivot.position.copy(Math.abs(a.x)<Math.abs(b.x)?a:b);node.add(pivot);for(const part of parts){part.position.sub(pivot.position);pivot.add(part);}legs.push({node:pivot,index,side});
  }
 }
 const headPivot=new THREE.Group();headPivot.position.copy(head.position);model.add(headPivot);
 for(const part of pieces)if(/^(head|shield_|eye_|mandible_|antenna_|forcipule_)/.test(part.name)){part.position.sub(headPivot.position);headPivot.add(part);}
 const antennae:THREE.Group[]=[];
 for(const side of [-1,1]){const parts=headPivot.children.filter(p=>p.name.startsWith('antenna_')&&p.name.endsWith('_'+side)),base=parts.find(p=>p.name.startsWith('antenna_base')) as THREE.Mesh;base.geometry.computeBoundingBox();const bounds=base.geometry.boundingBox!,a=new THREE.Vector3(0,bounds.min.y,0).applyQuaternion(base.quaternion).add(base.position),b=new THREE.Vector3(0,bounds.max.y,0).applyQuaternion(base.quaternion).add(base.position),pivot=new THREE.Group();pivot.position.copy(a.lengthSq()<b.lengthSq()?a:b);headPivot.add(pivot);for(const part of parts){part.position.sub(pivot.position);pivot.add(part);}antennae.push(pivot);}
 for(const part of pieces)if(part.name.startsWith('terminal_leg_')){part.position.sub(segments[16].node.position);segments[16].node.add(part);}
 // Rounded dorsal shields keep the trunk low, with distinct overlapping segments.
 for(const part of pieces)if(part instanceof THREE.Mesh&&(/^(tergite_|head$|head_shield$)/.test(part.name))){part.geometry.computeBoundingBox();const size=part.geometry.boundingBox!.getSize(new THREE.Vector3());part.geometry=new THREE.SphereGeometry(1,16,10);part.geometry.scale(size.x*.5,size.y*.5,size.z*.5);}
 model.traverse(node=>{if(node instanceof THREE.Mesh){node.castShadow=true;node.receiveShadow=true;node.frustumCulled=false;const material=(node.material as THREE.MeshStandardMaterial).clone();if(material.name==='blue-black dorsal plates'){material.metalness=.08;material.roughness=.36;}if(material.name==='ochre legs')material.color.setRGB(.55,.36,.13);node.material=material;}});
 rigs.set(g,{segments,legs,last:null,phase:0,model,head:headPivot,antennae,previous:new THREE.Vector3(),trail:[],heading:-Math.PI/2});return g;
}
export function animateCentipede(g:THREE.Group,time:number,speed:number){
 const r=rigs.get(g);if(!r)return;const first=r.last===null,dt=first?0:Math.min(.1,Math.max(0,time-r.last!));r.last=time;
 const delta=g.position.clone().sub(r.previous),distance=first?0:delta.length();
 if(distance>.00001&&distance<1){const target=Math.atan2(delta.y,delta.x),turn=Math.atan2(Math.sin(target-r.heading),Math.cos(target-r.heading));r.heading+=THREE.MathUtils.clamp(turn,-dt*4,dt*4);}
 g.rotation.z=r.heading;g.updateMatrixWorld(true);
 if(first||distance>1){r.trail=[];for(let i=0;i<180;i++)r.trail.push(g.position.clone().add(new THREE.Vector3(-Math.cos(r.heading),-Math.sin(r.heading),0).multiplyScalar(i*.04)));}
 else if(distance>.00001){if(g.position.distanceTo(r.trail[1])>=.04)r.trail.unshift(g.position.clone());else r.trail[0].copy(g.position);while(r.trail.length>240)r.trail.pop();}
 r.previous.copy(g.position);if(distance<1)r.phase+=distance*2*Math.PI/.24;
 // Sample the head's travelled path, so a turn reaches each trunk plate in sequence.
 const sample=(length:number)=>{let left=length;for(let i=1;i<r.trail.length;i++){const d=r.trail[i-1].distanceTo(r.trail[i]);if(left<=d)return r.trail[i-1].clone().lerp(r.trail[i],d?left/d:0);left-=d;}return r.trail[r.trail.length-1].clone();};
 const inverse=basis.clone().invert();
 for(const p of r.segments){const length=(p.base.z+r.model.position.z)*g.scale.x,point=sample(Math.max(0,length)),front=sample(Math.max(0,length-.08)),back=sample(length+.08),angle=Math.atan2(front.y-back.y,front.x-back.x);p.node.position.copy(g.worldToLocal(point).applyMatrix4(inverse).sub(r.model.position));p.node.position.y=p.base.y;p.node.rotation.y=angle-r.heading;}
 // Short stance stroke, quick lifted return, staggered along the trunk. Freeze on stop.
 for(const p of r.legs){const cycle=((r.phase/(2*Math.PI)-p.index*.19+(p.side<0?0:.5))%1+1)%1,stance=cycle<.72,progress=stance?cycle/.72:(cycle-.72)/.28;p.node.rotation.y=(stance?.14-.28*progress:-.14+.28*progress);p.node.rotation.z=stance?0:p.side*Math.sin(progress*Math.PI)*.09;}
 const searching=speed<1?1:.45;r.head.rotation.y=Math.sin(time*1.9)*.12*searching;
 r.antennae.forEach((p,i)=>{p.rotation.y=Math.sin(time*3.2+i*1.7)*.28+Math.sin(time*7.1+i)*.05;p.rotation.z=Math.sin(time*2.7+i*2)*.08;});
}
