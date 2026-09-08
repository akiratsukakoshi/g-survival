import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
let asset:GLTF|undefined,pending:Promise<void>|undefined;
export function loadAnimals(){return pending??=new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/roach-nymph.glb`).then(g=>{if(!g.animations.find(a=>a.name==='Walk_Draft'))throw new Error('Nymph walk clip missing');asset=g;}).catch(error=>{pending=undefined;throw error;});}
type Joint={bone:THREE.Bone;rest:THREE.Quaternion;axis:THREE.Vector3};
type Rig={mixer:THREE.AnimationMixer;walk:THREE.AnimationAction;joints:Joint[];last:number|null;phase:number};
const rigs=new WeakMap<THREE.Group,Rig>(),turn=new THREE.Quaternion();
// Native glTF -Z forward / +Y up -> established animal +X forward / +Z up.
const basis=new THREE.Matrix4().makeBasis(new THREE.Vector3(0,-1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(-1,0,0));
export function createNymph(scale:number){
 if(!asset)throw new Error('Call loadAnimals before creating a nymph');
 const g=new THREE.Group(),adapter=new THREE.Group(),model=clone(asset.scene);adapter.quaternion.setFromRotationMatrix(basis);adapter.add(model);g.add(adapter);g.updateMatrixWorld(true);
 const joints:Joint[]=[];model.traverse(o=>{if(o instanceof THREE.SkinnedMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}if(o instanceof THREE.Bone)joints.push({bone:o,rest:o.quaternion.clone(),axis:new THREE.Vector3(0,0,1).applyQuaternion(o.getWorldQuaternion(new THREE.Quaternion()).invert())});});
 const mixer=new THREE.AnimationMixer(model),walk=mixer.clipAction(asset.animations.find(a=>a.name==='Walk_Draft')!);walk.play();walk.setEffectiveWeight(0);mixer.update(0);
 rigs.set(g,{mixer,walk,joints,last:null,phase:0});g.scale.setScalar(scale);g.userData={nymph:true,baseScale:scale,legs:[],feelers:[]};return g;
}
export function animateNymph(g:THREE.Group,time:number,speed:number){
 const r=rigs.get(g);if(!r)return;const dt=r.last===null?0:Math.max(0,Math.min(.25,time-r.last));r.last=time;
 const moving=Math.min(1,Math.max(0,speed));r.phase+=dt*Math.min(3,Math.max(0,speed));
 r.walk.setEffectiveWeight(moving);r.mixer.setTime(r.phase);
 for(const j of r.joints)if(j.bone.name.startsWith('antenna_'))j.bone.quaternion.copy(j.rest).multiply(turn.setFromAxisAngle(j.axis,Math.sin(time*2.8+(j.bone.name.endsWith('L')?0:2))*.09));
}
export function moltNymph(g:THREE.Group,progress:number,time:number){
 const r=rigs.get(g);if(!r)return;r.walk.setEffectiveWeight(0);r.mixer.update(0);
 for(const j of r.joints){const name=j.bone.name,s=name.endsWith('L')?-1:1;let angle=0;
  if(/^leg\d_0_/.test(name)){const release=THREE.MathUtils.smoothstep(progress,.38+Number(name[3])*.07,.77+Number(name[3])*.07);angle=s*(.65*(1-release)+Math.sin(time*4)*.035*(1-progress));}
  if(name.startsWith('antenna_'))angle=s*.5*(1-THREE.MathUtils.smoothstep(progress,.65,.9));
  j.bone.quaternion.copy(j.rest).multiply(turn.setFromAxisAngle(j.axis,angle));
 }
}
export function disposeNymph(g:THREE.Group){const r=rigs.get(g);if(!r)return;r.mixer.stopAllAction();g.traverse(o=>{if(o instanceof THREE.SkinnedMesh)o.skeleton.dispose();});rigs.delete(g);}
