import * as THREE from 'three';
// フェーズ2(docs/isometric-refactor-brief.md): 遊技面を「X-Y の壁の断面」→「X-Z の床面」に組み直した。
// simulation.ts の 2D 座標 {x,y} は、指示書 §1 の言う「接触面上の2Dパラメータ空間」としてそのまま温存する。
//   sim.x → world.x  通路に沿う方向(0..100)
//   sim.y → world.z の符号反転(1..8)。奥ほど z が小さい
//   world.y = 高さ。床の上面が 0
// simulation.ts 側の変数名は `y` のままにしてある(改名すると全行が差分になり、
// 難易度確定済みの挙動を壊すリスクが上がるため)。フェーズ3で面ベースに拡張する際に改める。
export const PLANE_H=.12;                                     // 生物が乗る高さ。暗闇の投影平面もここ
export const toWorld=(x:number,y:number,h=PLANE_H)=>new THREE.Vector3(x,h,-y);
export const place=(o:THREE.Object3D,x:number,y:number,h=PLANE_H)=>o.position.set(x,h,-y);
// createAnimal のモデルは「+X が前方 / +Y が左右 / +Z が背中側」。床に寝かせる台座で包むと、
// animateAnimal が触る rotation.z(進行方向)がそのまま world Y 軸まわりの回頭になる。
// → animals.ts を編集せずに済む。指示書の Quaternion 版に差し替わってもこの台座は残せる。
export function grounded(g:THREE.Group){const w=new THREE.Group();w.rotation.x=-Math.PI/2;w.add(g);w.userData.inner=g;return w;}
// フェーズ3: 接触面の法線から姿勢を決める(指示書 §2「ゴキブリの上下は常に接触面の法線」)。
// (nx,ny) は sim 平面での外向き法線。(0,0) なら床/天面。台座の基底を組み替えるだけなので、
// animateAnimal が触る rotation.z は「面に沿う向き→上向き」の回頭のまま使える。
const poseM=new THREE.Matrix4(),poseUp=new THREE.Vector3(),poseFwd=new THREE.Vector3(),poseSide=new THREE.Vector3();
export function pose(pin:THREE.Group,x:number,y:number,z:number,nx:number,ny:number){
 const onFace=nx!==0||ny!==0;
 if(onFace){poseUp.set(nx,0,-ny);poseFwd.set(-ny,0,-nx);}else{poseUp.set(0,1,0);poseFwd.set(1,0,0);}
 poseSide.crossVectors(poseUp,poseFwd);
 poseM.makeBasis(poseFwd,poseSide,poseUp);pin.quaternion.setFromRotationMatrix(poseM);
 pin.position.set(x+nx*PLANE_H,z+(onFace?.05:PLANE_H),-(y+ny*PLANE_H));
}
