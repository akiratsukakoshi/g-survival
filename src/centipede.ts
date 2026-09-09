import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';

let asset:GLTF|undefined,pending:Promise<void>|undefined;
type Piece={node:THREE.Object3D;position:THREE.Vector3;quaternion:THREE.Quaternion;index:number;side:number};
type Rig={tergites:Piece[];legs:Piece[];feelers:Piece[];claws:Piece[];last:number|null;phase:number};
const rigs=new WeakMap<THREE.Group,Rig>(),turn=new THREE.Quaternion();
// Native glTF -Z forward / +Y up -> Chapter 2 wall plane +X forward / +Z out.
const basis=new THREE.Matrix4().makeBasis(new THREE.Vector3(0,-1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(-1,0,0));

export function loadCentipede(){return pending??=new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/centipede.glb`).then(g=>{if(!g.scene.getObjectByName('head'))throw new Error('Centipede head missing');asset=g;}).catch(error=>{pending=undefined;throw error;});}
function collect(model:THREE.Object3D,prefix:string){const pieces:Piece[]=[];model.traverse(node=>{if(!node.name.startsWith(prefix))return;const match=node.name.match(/_(\d+)(?:_|$)/),side=/_L(?:_|$)/.test(node.name)?-1:/_R(?:_|$)/.test(node.name)?1:0;pieces.push({node,position:node.position.clone(),quaternion:node.quaternion.clone(),index:match?Number(match[1]):0,side});});return pieces.sort((a,b)=>a.index-b.index||a.side-b.side);}
export function createCentipede(){
 if(!asset)throw new Error('Call loadCentipede before creating a centipede');
 const g=new THREE.Group(),adapter=new THREE.Group(),model=asset.scene.clone(true);adapter.quaternion.setFromRotationMatrix(basis);adapter.add(model);g.add(adapter);g.scale.setScalar(.82);g.updateMatrixWorld(true);
 model.traverse(node=>{if(node instanceof THREE.Mesh){node.castShadow=true;node.receiveShadow=true;node.frustumCulled=false;}});
 rigs.set(g,{tergites:collect(model,'tergite_').filter(p=>!p.node.name.endsWith('_rear')),legs:collect(model,'leg_'),feelers:[...collect(model,'antenna_'),...collect(model,'terminal_leg_')],claws:collect(model,'forcipule_'),last:null,phase:0});
 return g;
}
export function animateCentipede(g:THREE.Group,time:number,speed:number){
 const r=rigs.get(g);if(!r)return;const dt=r.last===null?0:Math.min(.1,Math.max(0,time-r.last));r.last=time;const moving=THREE.MathUtils.clamp(speed/3.9,0,1);r.phase+=dt*(.75+moving*4.4);
 for(const p of r.tergites){const wave=Math.sin(r.phase-p.index*.62);p.node.position.copy(p.position);p.node.position.x+=wave*.035*moving;p.node.position.y+=Math.cos(r.phase-p.index*.62)*.012*moving;}
 for(const p of r.legs){const wave=Math.sin(r.phase*1.8-p.index*.72+(p.side<0?0:Math.PI));p.node.quaternion.copy(p.quaternion).multiply(turn.setFromAxisAngle(new THREE.Vector3(0,1,0),wave*(.16+.28*moving)));}
 for(const p of r.feelers){const wave=Math.sin(time*3.2+(p.side<0?0:Math.PI));p.node.quaternion.copy(p.quaternion).multiply(turn.setFromAxisAngle(new THREE.Vector3(0,0,1),wave*(.08+.12*moving)));}
 for(const p of r.claws){const wave=Math.sin(time*5+(p.side<0?0:Math.PI));p.node.quaternion.copy(p.quaternion).multiply(turn.setFromAxisAngle(new THREE.Vector3(0,1,0),p.side*(.08+wave*.055)));}
}
