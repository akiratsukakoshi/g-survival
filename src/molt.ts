import * as THREE from 'three';
import { createAnimal } from './animals';
import { PLANE_H, place, grounded } from './space';
const smooth=(a:number,b:number,v:number)=>{const t=THREE.MathUtils.clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
export class MoltVisual {
 private active=false;
 private shells:THREE.Group[]=[];
 private current:THREE.Group|null=null;
 private colors=new Map<THREE.MeshStandardMaterial,THREE.Color>();
 constructor(private scene:THREE.Scene,private pin:THREE.Group,private hero:THREE.Group){
  const copies=new Map<THREE.Material,THREE.Material>();
  hero.traverse(o=>{if(o instanceof THREE.Mesh&&!Array.isArray(o.material)){const original=o.material;let copy=copies.get(original);if(!copy){copy=original.clone();copies.set(original,copy!);}o.material=copy!;if(copy instanceof THREE.MeshStandardMaterial)this.colors.set(copy,copy.color.clone());}});
 }
 reset(){this.active=false;for(const shell of this.shells){this.scene.remove(shell);shell.traverse(o=>{if(o instanceof THREE.Mesh&&!Array.isArray(o.material))o.material.dispose();});}this.shells=[];this.current=null;}
 update(progress:number,ready:boolean,molting:boolean,x:number,y:number,heading:number,time:number){
  if(molting&&!this.active){
   this.current=createAnimal('roach',.75);this.current.rotation.z=heading;const shed=grounded(this.current);place(shed,x,y,PLANE_H-.02);
   this.current.traverse(o=>{if(o instanceof THREE.Mesh&&!Array.isArray(o.material)){const m=o.material.clone() as THREE.MeshStandardMaterial;m.transparent=true;m.opacity=.72;m.color?.set('#805b35');m.emissive?.set('#6d4829');m.emissiveIntensity=.18;m.roughness=.9;o.material=m;}});
   this.scene.add(shed);this.shells.push(shed);
  }
  this.active=molting;
  const whiten=molting?smooth(.03,.3,progress)*(1-smooth(.86,1,progress)):0;
  for(const [mat,color] of this.colors){mat.color.copy(color).lerp(new THREE.Color('#fff3dc'),whiten);mat.emissive.set('#d5c8a2');mat.emissiveIntensity=molting?.22*whiten:ready?.1+.08*Math.sin(time*3):0;mat.roughness=molting?.75:.4;}
  if(!molting)return;
  const extract=smooth(.2,.78,progress);
  place(this.pin,x+Math.cos(heading)*extract*.65,y+Math.sin(heading)*extract*.65,PLANE_H+Math.sin(Math.PI*progress)*.09);
  // モデル局所軸は X=体長 / Y=左右 / Z=背丈。抜け出る間に伸びて、背だけ一度潰れる。
  this.hero.scale.set(.75*(1+.3*extract),.75*(1+.3*extract),.75*(1-.1*Math.sin(progress*Math.PI)));
  const legs=this.hero.userData.legs as THREE.Group[];
  legs.forEach((leg,i)=>{const release=smooth(.38+i*.035,.7+i*.035,progress);leg.rotation.z=(i%2?1:-1)*(.9*(1-release)+Math.sin(time*4+i)*.06*(1-progress));});
  (this.hero.userData.feelers as THREE.Group[]).forEach((f,i)=>f.rotation.z=(i?1:-1)*.65*(1-smooth(.65,.9,progress)));
  if(this.current){this.current.children.forEach((o,i)=>{if(o.userData.originalY===undefined)o.userData.originalY=o.position.y;const side=o.userData.originalY>=0?1:-1;o.position.y=o.userData.originalY+side*smooth(0,.3,progress)*.045;});}
 }
}
