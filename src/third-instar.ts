import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
let template:THREE.Group|undefined,pending:Promise<void>|undefined;
// 承認造形を材質・可動部単位で結合。模型座標 +X前方/+Z背中、胴長を既存幼体と同じ約1.3へ正規化。
export function loadThirdInstar(){return pending??=new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/roach-third-instar.glb`).then(asset=>{
 const root=new THREE.Group(),adapter=new THREE.Group();adapter.rotation.x=Math.PI/2;adapter.add(asset.scene);adapter.updateMatrixWorld(true);
 const buckets=new Map<string,{pivot:THREE.Vector3;meshes:Map<THREE.Material,THREE.BufferGeometry[]>}>();
 asset.scene.traverse(o=>{if(!(o instanceof THREE.Mesh)||Array.isArray(o.material))return;const name=o.name.replaceAll('_',' '),leg=/leg (\d) (-?1)/.exec(name),antenna=name.startsWith('antenna');let key='body',pivot=new THREE.Vector3();
  if(leg){const k=Number(leg[1]),s=Number(leg[2]);key=`leg${k}:${s}`;pivot.set([1.05,.5,-.1][k],s*.48,.4);}
  else if(antenna){const side=o.getWorldPosition(new THREE.Vector3()).y<0?-1:1;key=`antenna:${side}`;pivot.set(1.82,side*.24,.49);}
  let bucket=buckets.get(key);if(!bucket){bucket={pivot,meshes:new Map()};buckets.set(key,bucket);}const geometries=bucket.meshes.get(o.material)??[];
  const geo=o.geometry.clone().applyMatrix4(o.matrixWorld).translate(-pivot.x,-pivot.y,-pivot.z);geo.deleteAttribute('uv');geometries.push(geo);bucket.meshes.set(o.material,geometries);
 });
 for(const [name,bucket] of buckets){const group=new THREE.Group();group.name=name;group.position.copy(bucket.pivot);for(const [mat,geos] of bucket.meshes){const geometry=mergeGeometries(geos);if(!geometry)throw Error('Cannot merge third instar '+name);const mesh=new THREE.Mesh(geometry,mat);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);geos.forEach(g=>g.dispose());}root.add(group);}
 root.scale.setScalar(.32);root.position.z=-.009;template=root;
 }).catch(e=>{pending=undefined;throw e;});}
export function createThirdInstar(){if(!template)throw Error('Third instar not loaded');const g=template.clone(true);g.userData.phase=0;g.userData.last=null;return g;}
export function animateThirdInstar(g:THREE.Group,time:number,speed:number){const dt=g.userData.last===null?0:Math.max(0,Math.min(.1,time-g.userData.last));g.userData.last=time;g.userData.phase+=dt*Math.max(0,speed)*9;
 for(const joint of g.children){if(joint.name.startsWith('leg')){const [k,s]=joint.name.slice(3).split(':').map(Number),phase=g.userData.phase+(k+(s>0?1:0))*Math.PI;const moving=Math.min(1,speed);joint.rotation.z=Math.sin(phase)*.24*moving;joint.rotation.x=Math.max(0,Math.cos(phase))*.14*s*moving;}
 else if(joint.name.startsWith('antenna'))joint.rotation.z=(g.userData.sensing?(joint.name.endsWith('-1')?-.22:.22):0)+Math.sin(time*2.8+(joint.name.endsWith('-1')?0:2))*.09;}
}
