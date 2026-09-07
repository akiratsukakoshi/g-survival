import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const ball=new THREE.SphereGeometry(1,20,12);
const rod=new THREE.CylinderGeometry(1,1,1,6);
const shell=new THREE.MeshPhysicalMaterial({color:'#38251e',roughness:.3,metalness:.05,clearcoat:.65,clearcoatRoughness:.25});
const ridge=new THREE.MeshStandardMaterial({color:'#170e0a',roughness:.55});
const band=new THREE.MeshStandardMaterial({color:'#d8c7aa',roughness:.55});
const legMat=new THREE.MeshStandardMaterial({color:'#715039',roughness:.48});
const eye=new THREE.MeshPhysicalMaterial({color:'#080706',roughness:.1,clearcoat:1});
const spiderMat=new THREE.MeshStandardMaterial({color:'#30231f',roughness:.82});
function oval(g:THREE.Group,x:number,y:number,z:number,sx:number,sy:number,sz:number,m:THREE.Material){const a=new THREE.Mesh(ball,m);a.position.set(x,y,z);a.scale.set(sx,sy,sz);a.castShadow=true;g.add(a);return a;}
function link(g:THREE.Group,a:THREE.Vector3,b:THREE.Vector3,r:number,m:THREE.Material){const mesh=new THREE.Mesh(rod,m);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.scale.set(r,a.distanceTo(b),r*.75);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());g.add(mesh);}
function compact(group:THREE.Group){const byMaterial=new Map<THREE.Material,THREE.Mesh[]>();for(const child of group.children)if(child instanceof THREE.Mesh&&!Array.isArray(child.material)){const list=byMaterial.get(child.material)||[];list.push(child);byMaterial.set(child.material,list);}for(const [material,meshes] of byMaterial){if(meshes.length<2)continue;const geometries=meshes.map(m=>{m.updateMatrix();return m.geometry.clone().applyMatrix4(m.matrix);});const geo=mergeGeometries(geometries);if(geo){meshes.forEach(m=>group.remove(m));const m=new THREE.Mesh(geo,material);m.castShadow=true;group.add(m);}geometries.forEach(g=>g.dispose());}}
export function createAnimal(kind:'roach'|'spider'|'ant',scale=1){
 const g=new THREE.Group(),legs:THREE.Group[]=[],feelers:THREE.Group[]=[];
 const roach=kind==='roach',spider=kind==='spider';const mat=spider?spiderMat:shell;
 if(roach){
 oval(g,-.18,0,.07,.4,.235,.115,shell);
 for(let n=0;n<7;n++){const x=-.48+n*.088,w=.14+Math.sin((n+1)/8*Math.PI)*.09;oval(g,x,0,.093,.061,w,.09,n===4?band:shell);}
 oval(g,.18,0,.105,.215,.218,.13,shell);oval(g,.31,0,.08,.105,.13,.083,ridge);
 for(const s of [-1,1]){oval(g,.345,s*.093,.12,.034,.029,.03,eye);link(g,new THREE.Vector3(-.52,s*.12,.07),new THREE.Vector3(-.73,s*.2,.04),.012,legMat);}
 }else if(spider){oval(g,-.23,0,.1,.27,.22,.16,mat);oval(g,.17,0,.12,.22,.23,.17,mat);for(const s of [-1,1]){oval(g,.335,s*.08,.22,.08,.074,.075,eye);oval(g,.28,s*.18,.19,.038,.034,.04,eye);oval(g,.38,s*.09,.07,.085,.055,.065,spiderMat);link(g,new THREE.Vector3(.43,s*.1,.06),new THREE.Vector3(.57,s*.055,.015),.022,ridge);for(let j=0;j<9;j++){const x=-.4+j*.08;link(g,new THREE.Vector3(x,s*.18,.15),new THREE.Vector3(x-.055,s*.26,.22),.004,legMat);}}}
 else{oval(g,-.33,0,.08,.2,.135,.12,shell);oval(g,-.07,0,.06,.055,.055,.055,ridge);oval(g,.09,0,.08,.12,.09,.1,shell);oval(g,.29,0,.1,.12,.115,.11,shell);}
 const pairs=spider?4:3;
 for(let n=0;n<pairs;n++)for(const s of [-1,1]){const l=new THREE.Group();l.position.set(.19-n*(spider?.13:.17),s*.13,.055);const spread=(n-(pairs-1)/2)*-.2;const a=new THREE.Vector3(0,0,0),b=new THREE.Vector3(spread,s*.16,.065),c=new THREE.Vector3(spread-.09,s*(spider?.47:.34),-.005),d=new THREE.Vector3(spread-.14,s*(spider?.6:.43),-.045);link(l,a,b,.024,mat);link(l,b,c,.016,legMat);link(l,c,d,.009,legMat);if(roach&&scale>=1){for(let q=0;q<3;q++){const v=b.clone().lerp(c,(q+1)/4);link(l,v,v.clone().add(new THREE.Vector3(-.045,s*.025,0)),.004,ridge);}}g.add(l);legs.push(l);}
 if(!spider)for(const s of [-1,1]){const f=new THREE.Group();f.position.set(.36,s*.05,.13);const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(),new THREE.Vector3(.25,s*.08,.05),new THREE.Vector3(.6,s*.14,.025),new THREE.Vector3(roach?.95:.45,s*.32,-.02)]);f.add(new THREE.Mesh(new THREE.TubeGeometry(curve,20,.007,5,false),legMat));g.add(f);feelers.push(f);}
 legs.forEach(compact);compact(g);g.scale.setScalar(scale);g.userData={legs,feelers,baseScale:scale};return g;
}
export function animateAnimal(g:THREE.Group,time:number,speed:number,heading:number,molt=0){
 g.rotation.z=heading;const moving=Math.min(1,speed);(g.userData.legs as THREE.Group[]).forEach((l,i)=>{l.rotation.z=Math.sin(time*18+(i%2)*Math.PI+Math.floor(i/2)*Math.PI)*.28*moving;});
 (g.userData.feelers as THREE.Group[]).forEach((f,i)=>{f.rotation.z=Math.sin(time*2.8+i*2)*.12;});g.scale.setScalar(g.userData.baseScale*(1+molt*.3));
}
