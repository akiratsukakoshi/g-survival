import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';

let asset:GLTF|undefined,pending:Promise<void>|undefined;
type Segment={node:THREE.Group;base:THREE.Vector3;index:number};
type Leg={node:THREE.Group;index:number;side:number};
type Rig={segments:Segment[];legs:Leg[];last:number|null;phase:number};
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
 model.traverse(node=>{if(node instanceof THREE.Mesh){node.castShadow=true;node.receiveShadow=true;node.frustumCulled=false;}});
 rigs.set(g,{segments,legs,last:null,phase:0});return g;
}
export function animateCentipede(g:THREE.Group,time:number,speed:number){
 const r=rigs.get(g);if(!r)return;const dt=r.last===null?0:Math.min(.1,Math.max(0,time-r.last));r.last=time;const moving=THREE.MathUtils.clamp(speed/3.9,0,1);r.phase+=dt*moving*8;
 for(const p of r.segments){const wave=r.phase*.5-p.index*.42,amp=.16*moving*(p.index/16);p.node.position.copy(p.base);p.node.position.x+=Math.sin(wave)*amp;p.node.rotation.y=-Math.cos(wave)*amp*1.6;}
 // Each three-piece leg swings at its hip as a unit; joints remain connected.
 for(const p of r.legs){const wave=r.phase-p.index*.72+(p.side<0?0:Math.PI);p.node.rotation.y=Math.sin(wave)*.38*moving;p.node.rotation.z=p.side*Math.max(0,Math.cos(wave))*.16*moving;}
}
