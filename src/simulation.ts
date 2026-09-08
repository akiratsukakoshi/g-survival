export type Input = { x:number; y:number; sprint:boolean; freeze:boolean; probe:boolean; aimX:number; aimY:number };
type Point = { x:number; y:number };
type Cockroach = Point & { alive:boolean };
export type Spider = Point & { angle:number; state:'patrol'|'warning'|'attack'|'recover'; targetX?:number; targetY?:number; warningProgress:number };
export type Ant = Point & { angle:number; carrying:boolean; target:number|null; route:number; waypoint:number };
// 屋根裏は 1..34 の正方形。{x,y,w,h} は床の footprint、`top` は高さ(フェーズ3で登る)。
// 経路長は仕切り壁3枚の蛇行で、旧 100x7 の一本道(118)に対し 125.5 に収めてある。
export const WORLD = {lo:1, hi:34};
export const WALL_TOP = 3.2;                                  // 外周壁の高さ。AI暫定値
export const OBSTACLES = [
  // 仕切り壁。切れ目を互い違いに置いて蛇行させる。越えれば近道、迂回すれば安全。
  {x:1,y:9,w:25,h:1.3,top:1.5}, {x:8,y:17,w:26,h:1.3,top:1.5}, {x:1,y:25,w:23,h:1.3,top:1.5},
  // 家財・落とし物。高さはプレイヤーが隠れない範囲(AI暫定値)。
  {x:7,y:2.5,w:4,h:3,top:.9}, {x:15,y:1.5,w:3.5,h:4,top:1.15}, {x:22,y:5,w:5,h:3,top:.75},
  {x:12,y:11,w:5.5,h:3,top:1.3}, {x:22,y:13,w:4.5,h:3.5,top:1}, {x:2,y:13.5,w:4,h:2.5,top:.85},
  {x:10,y:19,w:5,h:3.5,top:1.2}, {x:19,y:21,w:5.5,h:3,top:.9}, {x:28,y:19,w:4,h:4,top:1.15},
  {x:5,y:28,w:4.5,h:3,top:.75}, {x:13,y:28,w:5,h:3,top:1.3}, {x:24,y:32,w:5,h:1.6,top:1},
];
const clamp = (v:number,lo=0,hi=1) => Math.max(lo,Math.min(hi,v));
// フェーズ3 壁登り。すべて AI暫定値(ガクチョ未指定)。
const CLIMB_GRAB=.35;   // 面を押し続けて張り付くまでの秒数。予告なく貼り付かないための間
const OFF=.16;          // 面から体を離しておく距離
// アリ離脱の調整値はAI暫定値（2026-09-08、ガクチョの逃げづらさ報告への対応）。
const ANT_BREAK_DISTANCE=1.2, ANT_BREAK_TIME=.45, ANT_REJOIN_DELAY=1;
const ANT_REACH=.3;     // アリが届く高さ
const SPIDER_REACH=1.35;// クモが届く高さ。仕切り壁の上(top 1.5)には届かない
const distance = (a:Point,b:Point) => Math.hypot(a.x-b.x,a.y-b.y);
const ANT_ROUTES:Point[][] = [
  [{x:8,y:15},{x:20,y:15},{x:20,y:16.2},{x:19,y:16.2},{x:19,y:15.4},{x:8,y:15.4}],
  [{x:10,y:27},{x:27,y:27},{x:31,y:27},{x:31,y:27.6},{x:10,y:27.6}],
];
const SPIDER_ROUTES:Point[][] = [ [{x:8,y:13.2},{x:11,y:13.2}], [{x:22,y:30},{x:27,y:30}] ];

export class Game {
  // z = 床からの高さ。(nx,ny) = 貼り付いている面の外向き法線。(0,0) なら水平面(床か塊の天面)。
  player = {x:4,y:4,z:0,angle:0,nx:0,ny:0};
  siblings:Cockroach[] = [];
  spiders:Spider[] = [];
  ants:Ant[] = [];
  resources:{x:number;y:number;type:'food'|'water';amount:number}[] = [];
  checkpoints = [{x:13,y:7},{x:7,y:14},{x:32,y:32}];
  state:'playing'|'won'|'lost' = 'playing';
  health=1; hunger=.55; water=.5; stamina=1; antAttack=0;
  moltReady=false; molting=false; moltStage='idle'; moltProgress=0;
  humanEvent=0; humanEventsTriggered=0; time=0;
  danger={x:0,y:0,strength:0};
  explored=new Set<string>();
  private timers=[0,0];
  private patrolTarget=[1,0];
  private swarmTimers:number[]=[];
  private antLost:number[]=[]; private antRejoin:number[]=[];
  private paths:Point[][]=[];
  private nextWander:number[]=[];
  private hold=0; private immune=0; private rng=1234567;
  private climb:{top:number;lo:number;hi:number}|null=null; private grab=0;

  constructor() {
    for(let n=0;n<11;n++) {
      this.siblings.push({x:4+Math.cos(n*2.6)*.5,y:4,alive:true});
      this.swarmTimers.push(0); this.paths.push([]); this.nextWander.push(n*.4);
    }
    this.spiders=[{x:9.5,y:13.2,angle:Math.PI,state:'patrol',warningProgress:0},{x:25,y:30,angle:0,state:'patrol',warningProgress:0}];
    // 順番は蛇行の経路順。量と役割は旧レイアウトと同一(序盤7個は維持用、末尾2個が脱皮の蓄え)。
    this.resources=[
      {x:12,y:7,type:'food',amount:.12},{x:20,y:3,type:'water',amount:.16},
      {x:29,y:7,type:'food',amount:.18},{x:19,y:12,type:'food',amount:.16},
      {x:8,y:15.5,type:'water',amount:.2},{x:6,y:20,type:'food',amount:.18},
      {x:26,y:24,type:'water',amount:.08},{x:24,y:30,type:'food',amount:4},{x:31,y:31,type:'water',amount:4},
    ];
    for(let n=0;n<28;n++) {
      const route=n<16?0:1, k=n<16?n:n-16;
      this.ants.push({x:(route?10:8)+k*.43,y:route?27:15,angle:0,carrying:n%4===0,target:null,route,waypoint:1});
      this.antLost.push(0);
    }
  }

  update(dt:number,input:Input) {
    if(this.state!=='playing')return;
    dt=clamp(Number.isFinite(dt)?dt:0,0,.1);
    if(!dt)return;
    this.time+=dt; this.immune=Math.max(0,this.immune-dt);
    this.hunger=clamp(this.hunger-dt*.0022); this.water=clamp(this.water-dt*.0038);
    if(this.hunger===0||this.water===0) {
      this.health=clamp(this.health-dt*((this.hunger===0?.035:0)+(this.water===0?.09:0)));
      if(this.health===0){this.handoff();if(this.state!=='playing')return;}
    }
    this.events(dt);
    this.follow(dt);
    if(!this.molting) {
      this.move(dt,input); this.pickup(dt); this.rest(dt); if(!this.climb)this.reveal(input);
      this.moltReady=this.hunger>=.85&&this.water>=.85&&this.health>.25&&!this.climb;
      this.hold=this.moltReady&&input.freeze?this.hold+dt:0;
      if(this.hold>=3){this.molting=true;this.moltProgress=0;this.hold=0;}
    }
    this.spidersUpdate(dt,input);
    if(this.state!=='playing')return;
    this.antsUpdate(dt);
    if(this.state!=='playing')return;
    if(this.molting) {
      this.moltProgress=clamp(this.moltProgress+dt/20);
      this.moltStage=this.moltProgress<.2?'split':this.moltProgress<.6?'emerge':this.moltProgress<.9?'unfold':'harden';
      if(this.moltProgress>=1){this.state='won';this.moltStage='complete';}
    }
    this.dangerUpdate();
  }

  private events(dt:number) {
    this.humanEvent=Math.max(0,this.humanEvent-dt);
    [12,27].forEach((y,n)=>{                                  // 旧レイアウトの x=40/75 に相当する進み具合
      const bit=1<<n;
      if(this.player.y>=y&&!(this.humanEventsTriggered&bit)) {
        this.humanEventsTriggered|=bit;this.humanEvent=1.2;
      }
    });
  }

  private move(dt:number,i:Input) {
    if(Number.isFinite(i.aimX)&&Number.isFinite(i.aimY))this.player.angle=Math.atan2(i.aimY-this.faceV(),i.aimX-this.faceU());
    const length=Math.hypot(i.x||0,i.y||0);
    if(i.freeze||length<.001){this.stamina=clamp(this.stamina+dt*.35);this.grab=0;return;}
    let speed=2.2*(.45+.55*Math.min(this.hunger,this.water))*(this.wall(this.player)?1.3:1)*(i.probe?.5:1);
    if(i.sprint&&this.stamina>0){speed*=2.1;this.stamina=clamp(this.stamina-dt*.28);}
    else this.stamina=clamp(this.stamina+dt*.12);
    const ux=i.x/length,uy=i.y/length;
    if(this.climb)this.onFace(dt,ux,uy,speed);else this.onGround(dt,ux,uy,speed);
  }

  // 水平面(床・塊の天面)の移動。進もうとした向きで止められ続けたら面に張り付く。
  private onGround(dt:number,ux:number,uy:number,speed:number) {
    const p=this.player,step=speed*dt,fromX=p.x,fromY=p.y;
    this.go(p,ux*step,uy*step,p.z);
    const under=this.support(p.x,p.y);
    if(under<p.z) {
      // 天面から踏み外した。着地点が塊の判定帯(.18)に重なるので、進行方向へ少しだけ送り出す。
      const ox=clamp(p.x+ux*.22,WORLD.lo,WORLD.hi),oy=clamp(p.y+uy*.22,WORLD.lo,WORLD.hi);
      if(this.clear(ox,oy,under)){p.x=ox;p.y=oy;p.z=this.support(ox,oy);}
      else{p.x=fromX;p.y=fromY;}
    } else p.z=under;
    if(Math.hypot(p.x-fromX,p.y-fromY)<step*.4){if((this.grab+=dt)>=CLIMB_GRAB)this.grip(ux,uy);}
    else this.grab=0;
  }

  // 面の上は (面に沿う水平方向, 高さ) の2Dパラメータ空間。面へ押す入力が「登る」になる。
  private onFace(dt:number,ux:number,uy:number,speed:number) {
    const p=this.player,f=this.climb!,step=speed*dt;
    const tx=-p.ny,ty=p.nx;                                 // 面に沿う水平方向(単位ベクトル)
    const along=ux*tx+uy*ty, up=-(ux*p.nx+uy*p.ny);
    p.z=clamp(p.z+up*step,0,f.top);
    if(p.nx)p.y=clamp(p.y+along*ty*step,f.lo,f.hi);else p.x=clamp(p.x+along*tx*step,f.lo,f.hi);
    if(p.z<=0&&up<0)this.release();
    else if(p.z>=f.top-1e-6&&f.top<WALL_TOP)this.mount();
  }

  // 押している向きにある面を探して張り付く。外周壁が先。
  private grip(ux:number,uy:number) {
    const p=this.player;
    const edge=p.x<=WORLD.lo+.03&&ux<-.3?[1,0]:p.x>=WORLD.hi-.03&&ux>.3?[-1,0]:
               p.y<=WORLD.lo+.03&&uy<-.3?[0,1]:p.y>=WORLD.hi-.03&&uy>.3?[0,-1]:null;
    if(edge){p.nx=edge[0];p.ny=edge[1];this.climb={top:WALL_TOP,lo:WORLD.lo,hi:WORLD.hi};this.grab=0;return;}
    const px=p.x+ux*.3,py=p.y+uy*.3;
    const hit=OBSTACLES.find(o=>o.top>p.z+.02&&px>o.x-.18&&px<o.x+o.w+.18&&py>o.y-.18&&py<o.y+o.h+.18);
    if(!hit)return;
    const dx=p.x-clamp(p.x,hit.x,hit.x+hit.w),dy=p.y-clamp(p.y,hit.y,hit.y+hit.h);
    if(!dx&&!dy)return;
    if(Math.abs(dx)>=Math.abs(dy)){const s=dx>=0?1:-1;p.nx=s;p.ny=0;p.x=(s>0?hit.x+hit.w:hit.x)+s*OFF;this.climb={top:hit.top,lo:hit.y+.12,hi:hit.y+hit.h-.12};}
    else{const s=dy>=0?1:-1;p.nx=0;p.ny=s;p.y=(s>0?hit.y+hit.h:hit.y)+s*OFF;this.climb={top:hit.top,lo:hit.x+.12,hi:hit.x+hit.w-.12};}
    this.grab=0;
  }

  private release() {
    const p=this.player;
    p.x=clamp(p.x+p.nx*.12,WORLD.lo,WORLD.hi);p.y=clamp(p.y+p.ny*.12,WORLD.lo,WORLD.hi);
    p.nx=0;p.ny=0;this.climb=null;this.grab=0;p.z=this.support(p.x,p.y);
  }
  // 登りきったら天面に乗る。落下ダメージ・スタミナ消費は指示書のとおり後回し。
  private mount() {
    const p=this.player,ix=p.x-p.nx*.3,iy=p.y-p.ny*.3;
    p.nx=0;p.ny=0;this.climb=null;this.grab=0;
    p.x=clamp(ix,WORLD.lo,WORLD.hi);p.y=clamp(iy,WORLD.lo,WORLD.hi);p.z=this.support(p.x,p.y);
  }
  // (x,y) を支える面の高さ。天面から踏み外すとその場で下の面まで落ちる。
  private support(x:number,y:number){let h=0;for(const o of OBSTACLES)if(x>o.x&&x<o.x+o.w&&y>o.y&&y<o.y+o.h&&o.top>h)h=o.top;return h;}

  // 接触面の 2D パラメータ空間。床/天面は (x,y)、壁は (面に沿う座標, 高さ)。
  get face(){return this.climb;}
  faceU(){const p=this.player;return this.climb?(p.nx?p.y*p.nx:p.x*-p.ny):p.x;}
  faceV(){const p=this.player;return this.climb?p.z:p.y;}

  private go(p:Point,dx:number,dy:number,z=0) {
    // Substeps prevent tunnelling when tests or low frame rates supply larger dt.
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/.1));
    for(let n=0;n<steps;n++) {
      const x=clamp(p.x+dx/steps,WORLD.lo,WORLD.hi),y=clamp(p.y+dy/steps,WORLD.lo,WORLD.hi);
      if(this.clear(x,p.y,z))p.x=x;
      if(this.clear(p.x,y,z))p.y=y;
    }
  }

  private toward(p:Point,target:Point,speed:number,dt:number) {
    const dx=target.x-p.x,dy=target.y-p.y,length=Math.hypot(dx,dy);
    if(length>.001)this.go(p,dx/length*Math.min(length,speed*dt),dy/length*Math.min(length,speed*dt));
  }

  private follow(dt:number) {
    const gather=this.checkpoints.find(c=>distance(c,this.player)<1.2);
    this.siblings.forEach((s,n)=>{
      if(!s.alive)return;
      if(this.time>=this.nextWander[n]||!this.paths[n].length) {
        let goal:Point;
        if(gather)goal={x:gather.x+Math.cos(n*2.4)*.35,y:Math.max(1,gather.y+Math.sin(n*2.4)*.3)};
        else {
          const spin=n*2.1+this.time*.13,span=4+(n%4)*2.4;   // 旧レイアウトは通路方向に ±15 で散っていた。密集させるとアリ列に全員で突っ込む
          goal={x:clamp(this.player.x+Math.cos(spin)*span,WORLD.lo+.5,WORLD.hi-.5),y:clamp(this.player.y+Math.sin(spin)*span,WORLD.lo+.5,WORLD.hi-.5)};
          if(!this.clear(goal.x,goal.y)) {
            const ring=Array.from({length:8},(_,k)=>({x:clamp(this.player.x+Math.cos(k*.785)*1.8,WORLD.lo+.5,WORLD.hi-.5),y:clamp(this.player.y+Math.sin(k*.785)*1.8,WORLD.lo+.5,WORLD.hi-.5)})).filter(q=>this.clear(q.x,q.y));
            goal=ring[n%Math.max(1,ring.length)]??{x:this.player.x,y:this.player.y};
          }
        }
        this.paths[n]=this.route(s,goal);
        this.nextWander[n]=this.time+(gather?2:6+n%4);
      }
      const target=this.paths[n][0];
      if(target) {
        this.toward(s,target,(.85+n%4*.2)*(this.swarmTimers[n]>0?.55:1),dt);
        if(distance(s,target)<.12)this.paths[n].shift();
      }
    });
  }

  // Small grid paths let siblings gather around solid beams without teleporting.
  private route(from:Point,to:Point):Point[] {
    const nx=67,ny=67,cell=(p:Point)=>Math.round((p.y-WORLD.lo)*2)*nx+Math.round((p.x-WORLD.lo)*2);
    const start=cell(from),end=cell(to),queue=[start],previous=new Map<number,number>([[start,-1]]);
    for(let head=0;head<queue.length;head++) {
      const k=queue[head];if(k===end)break;
      const x=k%nx,y=Math.floor(k/nx);
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const xx=x+dx,yy=y+dy,key=yy*nx+xx;
        if(xx<0||xx>=nx||yy<0||yy>=ny||previous.has(key)||!this.clear(WORLD.lo+xx/2,WORLD.lo+yy/2))continue;
        previous.set(key,k);queue.push(key);
      }
    }
    if(!previous.has(end))return [];
    const points:Point[]=[];
    for(let k=end;k!==start;k=previous.get(k)!)points.push({x:WORLD.lo+(k%nx)/2,y:WORLD.lo+Math.floor(k/nx)/2});
    return points.reverse();
  }

  private antsUpdate(dt:number) {
    this.ants.forEach((a,n)=>{
      this.antRejoin[n]=Math.max(0,(this.antRejoin[n]||0)-dt);
      if(a.target===null&&this.antRejoin[n]===0) {
        if(this.immune<=0&&this.player.z<=ANT_REACH&&distance(a,this.player)<.48)a.target=-1;
        else {const index=this.siblings.findIndex(s=>s.alive&&distance(a,s)<.45);if(index>=0)a.target=index;}
      }
      const target=a.target===-1?this.player:a.target===null?undefined:this.siblings[a.target];
      const alive=a.target===-1||!!(target as Cockroach|undefined)?.alive;
      const old={x:a.x,y:a.y};
      if(target&&alive) {
        const playerTarget=a.target===-1;this.antLost[n]=distance(a,target)>(playerTarget?ANT_BREAK_DISTANCE:2.2)?this.antLost[n]+dt:0;
        if(this.antLost[n]>(playerTarget?ANT_BREAK_TIME:1.2)){if(playerTarget)this.antRejoin[n]=ANT_REJOIN_DELAY;a.target=null;this.antLost[n]=0;}
        else {
          this.toward(a,target,1.85,dt);
          // Nearby ants leave the column and join the same target.
          this.ants.forEach((other,k)=>{if(other.target===null&&!this.antRejoin[k]&&distance(other,a)<1.15)other.target=a.target;});
        }
      } else a.target=null;
      if(a.target===-1&&this.player.z>ANT_REACH)a.target=null;   // 登られたら見失う
      if(a.target===null) {
        const path=ANT_ROUTES[a.route],goal=path[a.waypoint];
        this.toward(a,goal,1.1,dt);
        if(distance(a,goal)<.08)a.waypoint=(a.waypoint+1)%path.length;
      }
      if(distance(old,a)>.001)a.angle=Math.atan2(a.y-old.y,a.x-old.x);
    });
    const touching=this.immune<=0&&this.player.z<=ANT_REACH&&this.ants.some(a=>a.target===-1&&distance(a,this.player)<.6);
    this.antAttack=clamp(this.antAttack+(touching?dt:-dt*2),0,3);
    if(this.antAttack>=3-1e-6)this.handoff();
    this.siblings.forEach((s,n)=>{
      if(!s.alive)return;
      const contact=this.ants.some(a=>a.target===n&&distance(a,s)<.6);
      this.swarmTimers[n]=clamp(this.swarmTimers[n]+(contact?dt:-dt*2),0,3);
      if(this.swarmTimers[n]>=3-1e-6)s.alive=false;
    });
  }

  private spidersUpdate(dt:number,i:Input) {
    this.spiders.forEach((s,n)=>{
      if(this.state!=='playing')return;
      if(s.state==='patrol') {
        const target=SPIDER_ROUTES[n][this.patrolTarget[n]];
        s.angle=Math.atan2(target.y-s.y,target.x-s.x);
        this.toward(s,target,.85,dt);
        if(distance(s,target)<.08)this.patrolTarget[n]=1-this.patrolTarget[n];
        const prey=this.prey(s,i);
        if(prey) {
          s.targetX=prey.x;s.targetY=prey.y;s.angle=Math.atan2(prey.y-s.y,prey.x-s.x);
          s.state='warning';s.warningProgress=0;this.timers[n]=0;
        }
      } else if(s.state==='warning') {
        this.timers[n]+=dt;s.warningProgress=clamp(this.timers[n]/.8);
        if(this.timers[n]>=.8){s.state='attack';this.timers[n]=0;}
      } else if(s.state==='attack') {
        this.timers[n]+=dt;
        const before={x:s.x,y:s.y};
        this.go(s,Math.cos(s.angle)*12*dt,Math.sin(s.angle)*12*dt);
        const npc=this.siblings.find(q=>q.alive&&distance(q,s)<.55);
        let caught=false;
        if(this.immune<=0&&this.player.z<=SPIDER_REACH&&distance(s,this.player)<.65){this.handoff();caught=true;}
        else if(npc){npc.alive=false;caught=true;}
        if(caught||this.timers[n]>=.45||distance(before,s)<.001) {
          s.state='recover';s.warningProgress=0;this.timers[n]=0;
        }
      } else {
        this.timers[n]+=dt;
        if(this.timers[n]>=1.6){s.state='patrol';this.timers[n]=0;}
      }
    });
  }

  private prey(s:Spider,i:Input):Point|undefined {
    const candidates:Point[]=[];
    const canSee=(p:Point,range:number)=>distance(s,p)<range&&this.los(s,p)&&Math.cos(Math.atan2(p.y-s.y,p.x-s.x)-s.angle)>.35;
    for(const q of this.siblings)if(q.alive&&canSee(q,4.8))candidates.push(q);
    if(this.immune<=0&&this.player.z<=SPIDER_REACH) {
      const moving=!i.freeze&&Math.hypot(i.x,i.y)>.1;
      const exposure=this.wall(this.player)?.5:3;
      const range=2*exposure*(this.molting?5:i.freeze?.12:1);
      const vibration=moving&&i.sprint&&this.stamina>0&&distance(s,this.player)<8&&this.los(s,this.player);
      if(vibration||canSee(this.player,range))candidates.push(this.player);
    }
    return candidates.sort((a,b)=>distance(a,s)-distance(b,s))[0];
  }

  private pickup(dt:number) {
    if(this.player.z>.35)return;
    for(const r of this.resources)if(r.amount>0&&distance(r,this.player)<.7) {
      const missing=1-(r.type==='food'?this.hunger:this.water);
      const amount=Math.min(.18*dt,r.amount,missing);
      r.amount=Math.max(0,r.amount-amount);
      if(r.type==='food')this.hunger=clamp(this.hunger+amount);else this.water=clamp(this.water+amount);
    }
  }
  private rest(dt:number) {
    if(this.player.z>.35)return;
    if(this.checkpoints.some(c=>distance(c,this.player)<.65)) {
      this.hunger=clamp(this.hunger+dt*.006);this.health=clamp(this.health+dt*.1);this.stamina=clamp(this.stamina+dt*.2);
    }
  }
  private reveal(i:Input) {
    const sense=.4+.6*Math.min(this.hunger,this.water),range=(i.probe?4:2.4)*sense,spread=i.probe?.87:.52;
    for(let x=Math.floor(this.player.x-range);x<=Math.ceil(this.player.x+range);x++)for(let y=Math.floor(this.player.y-range);y<=Math.ceil(this.player.y+range);y++) {
      const p={x:x+.5,y},angle=Math.atan2(y-this.player.y,p.x-this.player.x)-this.player.angle;
      if(distance(p,this.player)<range&&Math.abs(Math.atan2(Math.sin(angle),Math.cos(angle)))<spread&&this.los(this.player,p))this.explored.add(x+','+y);
    }
  }
  private dangerUpdate() {
    if(this.antAttack>0) {
      const ant=this.ants.filter(a=>a.target===-1).sort((a,b)=>distance(a,this.player)-distance(b,this.player))[0];
      if(ant){this.danger={x:ant.x,y:ant.y,strength:clamp(.55+this.antAttack/6)};return;}
    }
    const active=this.spiders.filter(s=>s.state==='warning'||s.state==='attack').sort((a,b)=>distance(a,this.player)-distance(b,this.player))[0];
    const nearest=active??this.spiders.slice().sort((a,b)=>distance(a,this.player)-distance(b,this.player))[0];
    this.danger=nearest?{x:nearest.x,y:nearest.y,strength:active?(active.state==='attack'?1:.65+active.warningProgress*.3):clamp(1-distance(nearest,this.player)/10,0,.35)}:{x:this.player.x,y:this.player.y,strength:0};
  }
  private handoff() {
    const alive=this.siblings.filter(s=>s.alive);
    this.molting=false;this.moltReady=false;this.moltProgress=0;this.moltStage='idle';this.hold=0;this.antAttack=0;this.grab=0;
    for(const ant of this.ants)if(ant.target===-1)ant.target=null;
    if(!alive.length){this.state='lost';return;}
    const next=alive[Math.floor(this.random()*alive.length)];
    const index=this.siblings.indexOf(next);next.alive=false;
    for(const ant of this.ants)if(ant.target===index)ant.target=null;
    this.player.x=next.x;this.player.y=next.y;this.player.z=0;this.player.nx=0;this.player.ny=0;this.climb=null;this.grab=0;this.health=1;this.immune=1;
  }
  private wall(p:Point) {
    return p.x<WORLD.lo+.45||p.x>WORLD.hi-.45||p.y<WORLD.lo+.45||p.y>WORLD.hi-.45||OBSTACLES.some(o=>p.x>o.x-.45&&p.x<o.x+o.w+.45&&p.y>o.y-.45&&p.y<o.y+o.h+.45);
  }
  private los(a:Point,b:Point) {
    const steps=Math.max(2,Math.ceil(distance(a,b)/.15));
    for(let k=1;k<steps;k++)if(!this.clear(a.x+(b.x-a.x)*k/steps,a.y+(b.y-a.y)*k/steps))return false;
    return true;
  }
  private clear(x:number,y:number,z=0) {
    return !OBSTACLES.some(o=>o.top>z+.02&&x>o.x-.18&&x<o.x+o.w+.18&&y>o.y-.18&&y<o.y+o.h+.18);
  }
  private random(){this.rng=this.rng*48271%2147483647;return this.rng/2147483647;}
}
