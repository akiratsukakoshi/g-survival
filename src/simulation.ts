export type Input = { x:number; y:number; sprint:boolean; freeze:boolean; probe:boolean; aimX:number; aimY:number };
type Point = { x:number; y:number };
type Cockroach = Point & { alive:boolean };
export type Spider = Point & { angle:number; state:'patrol'|'warning'|'attack'|'recover'; targetX?:number; targetY?:number; warningProgress:number };
export type Ant = Point & { angle:number; carrying:boolean; target:number|null; route:number; waypoint:number };
export const OBSTACLES = [
  {x:9,y:2,w:7,h:6}, {x:22,y:1,w:6,h:4.8}, {x:35,y:3.2,w:4,h:4.8},
  {x:46,y:1,w:5,h:4.3}, {x:67,y:3.5,w:7,h:4.5}, {x:82,y:1,w:6,h:5.2}, {x:93,y:3.2,w:3,h:4.8},
];
const clamp = (v:number,lo=0,hi=1) => Math.max(lo,Math.min(hi,v));
const distance = (a:Point,b:Point) => Math.hypot(a.x-b.x,a.y-b.y);
const ANT_ROUTES:Point[][] = [
  [{x:20,y:6.3},{x:30,y:6.3},{x:30,y:2.6},{x:29,y:2.6},{x:29,y:6.7},{x:20,y:6.7}],
  [{x:64,y:2.8},{x:76,y:2.8},{x:80,y:2.8},{x:80,y:3.2},{x:64,y:3.2}],
];
const SPIDER_ROUTES:Point[][] = [ [{x:29,y:2.5},{x:33,y:2.5}], [{x:75,y:2.8},{x:81,y:2.8}] ];

export class Game {
  player = {x:4,y:1,angle:0};
  siblings:Cockroach[] = [];
  spiders:Spider[] = [];
  ants:Ant[] = [];
  resources:{x:number;y:number;type:'food'|'water';amount:number}[] = [];
  checkpoints = [{x:14,y:1},{x:54,y:6},{x:91,y:6}];
  state:'playing'|'won'|'lost' = 'playing';
  health=1; hunger=.55; water=.5; stamina=1; antAttack=0;
  moltReady=false; molting=false; moltStage='idle'; moltProgress=0;
  humanEvent=0; humanEventsTriggered=0; time=0;
  danger={x:0,y:0,strength:0};
  explored=new Set<string>();
  private timers=[0,0];
  private patrolTarget=[1,0];
  private swarmTimers:number[]=[];
  private antLost:number[]=[];
  private paths:Point[][]=[];
  private nextWander:number[]=[];
  private hold=0; private immune=0; private rng=1234567;

  constructor() {
    for(let n=0;n<11;n++) {
      this.siblings.push({x:4+Math.cos(n*2.6)*.5,y:1,alive:true});
      this.swarmTimers.push(0); this.paths.push([]); this.nextWander.push(n*.4);
    }
    this.spiders=[{x:31,y:2.5,angle:Math.PI,state:'patrol',warningProgress:0},{x:78,y:2.8,angle:0,state:'patrol',warningProgress:0}];
    this.resources=[
      {x:17,y:1,type:'food',amount:.12},{x:19,y:1,type:'water',amount:.16},
      {x:30,y:2.6,type:'food',amount:.18},{x:42,y:6,type:'water',amount:.2},
      {x:57,y:6,type:'food',amount:.16},{x:61,y:6,type:'food',amount:.18},
      {x:63,y:6,type:'water',amount:.08},{x:76,y:2.8,type:'food',amount:4},{x:78,y:6,type:'water',amount:4},
    ];
    for(let n=0;n<28;n++) {
      const route=n<16?0:1, k=n<16?n:n-16;
      this.ants.push({x:(route?64:20)+k*.43,y:route?2.8:6.3,angle:0,carrying:n%4===0,target:null,route,waypoint:1});
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
      this.move(dt,input); this.pickup(dt); this.rest(dt); this.reveal(input);
      this.moltReady=this.hunger>=.85&&this.water>=.85&&this.health>.25;
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
    [40,75].forEach((x,n)=>{
      const bit=1<<n;
      if(this.player.x>=x&&!(this.humanEventsTriggered&bit)) {
        this.humanEventsTriggered|=bit;this.humanEvent=1.2;
      }
    });
  }

  private move(dt:number,i:Input) {
    if(Number.isFinite(i.aimX)&&Number.isFinite(i.aimY))this.player.angle=Math.atan2(i.aimY-this.player.y,i.aimX-this.player.x);
    const length=Math.hypot(i.x||0,i.y||0);
    if(i.freeze||length<.001){this.stamina=clamp(this.stamina+dt*.35);return;}
    let speed=2.2*(.45+.55*Math.min(this.hunger,this.water))*(this.wall(this.player)?1.3:1)*(i.probe?.5:1);
    if(i.sprint&&this.stamina>0){speed*=2.1;this.stamina=clamp(this.stamina-dt*.28);}
    else this.stamina=clamp(this.stamina+dt*.12);
    this.go(this.player,i.x/length*speed*dt,i.y/length*speed*dt);
  }

  private go(p:Point,dx:number,dy:number) {
    // Substeps prevent tunnelling when tests or low frame rates supply larger dt.
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/.1));
    for(let n=0;n<steps;n++) {
      const x=clamp(p.x+dx/steps,0,100),y=clamp(p.y+dy/steps,1,8);
      if(this.clear(x,p.y))p.x=x;
      if(this.clear(p.x,y))p.y=y;
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
          goal={x:clamp(this.player.x+(n-5)*3+Math.sin(this.time*.15+n)*4,2,98),y:1+((n*1.7+this.time*.09)%7)};
          if(!this.clear(goal.x,goal.y)) {
            const candidates=[1.3,2.7,6.5,7.7].filter(y=>this.clear(goal.x,y));
            goal.y=candidates[n%candidates.length]??1;
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
    const nx=201,ny=15,cell=(p:Point)=>Math.round((p.y-1)*2)*nx+Math.round(p.x*2);
    const start=cell(from),end=cell(to),queue=[start],previous=new Map<number,number>([[start,-1]]);
    for(let head=0;head<queue.length;head++) {
      const k=queue[head];if(k===end)break;
      const x=k%nx,y=Math.floor(k/nx);
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const xx=x+dx,yy=y+dy,key=yy*nx+xx;
        if(xx<0||xx>=nx||yy<0||yy>=ny||previous.has(key)||!this.clear(xx/2,1+yy/2))continue;
        previous.set(key,k);queue.push(key);
      }
    }
    if(!previous.has(end))return [];
    const points:Point[]=[];
    for(let k=end;k!==start;k=previous.get(k)!)points.push({x:(k%nx)/2,y:1+Math.floor(k/nx)/2});
    return points.reverse();
  }

  private antsUpdate(dt:number) {
    this.ants.forEach((a,n)=>{
      if(a.target===null) {
        if(this.immune<=0&&distance(a,this.player)<.48)a.target=-1;
        else {const index=this.siblings.findIndex(s=>s.alive&&distance(a,s)<.45);if(index>=0)a.target=index;}
      }
      const target=a.target===-1?this.player:a.target===null?undefined:this.siblings[a.target];
      const alive=a.target===-1||!!(target as Cockroach|undefined)?.alive;
      const old={x:a.x,y:a.y};
      if(target&&alive) {
        this.antLost[n]=distance(a,target)>2.2?this.antLost[n]+dt:0;
        if(this.antLost[n]>1.2){a.target=null;this.antLost[n]=0;}
        else {
          this.toward(a,target,1.85,dt);
          // Nearby ants leave the column and join the same target.
          for(const other of this.ants)if(other.target===null&&distance(other,a)<1.15)other.target=a.target;
        }
      } else a.target=null;
      if(a.target===null) {
        const path=ANT_ROUTES[a.route],goal=path[a.waypoint];
        this.toward(a,goal,1.1,dt);
        if(distance(a,goal)<.08)a.waypoint=(a.waypoint+1)%path.length;
      }
      if(distance(old,a)>.001)a.angle=Math.atan2(a.y-old.y,a.x-old.x);
    });
    const touching=this.immune<=0&&this.ants.some(a=>a.target===-1&&distance(a,this.player)<.6);
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
        if(this.immune<=0&&distance(s,this.player)<.65){this.handoff();caught=true;}
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
    if(this.immune<=0) {
      const moving=!i.freeze&&Math.hypot(i.x,i.y)>.1;
      const exposure=this.wall(this.player)?.5:3;
      const range=2*exposure*(this.molting?5:i.freeze?.12:1);
      const vibration=moving&&i.sprint&&this.stamina>0&&distance(s,this.player)<8&&this.los(s,this.player);
      if(vibration||canSee(this.player,range))candidates.push(this.player);
    }
    return candidates.sort((a,b)=>distance(a,s)-distance(b,s))[0];
  }

  private pickup(dt:number) {
    for(const r of this.resources)if(r.amount>0&&distance(r,this.player)<.7) {
      const missing=1-(r.type==='food'?this.hunger:this.water);
      const amount=Math.min(.18*dt,r.amount,missing);
      r.amount=Math.max(0,r.amount-amount);
      if(r.type==='food')this.hunger=clamp(this.hunger+amount);else this.water=clamp(this.water+amount);
    }
  }
  private rest(dt:number) {
    if(this.checkpoints.some(c=>distance(c,this.player)<.65)) {
      this.hunger=clamp(this.hunger+dt*.006);this.health=clamp(this.health+dt*.1);this.stamina=clamp(this.stamina+dt*.2);
    }
  }
  private reveal(i:Input) {
    const sense=.4+.6*Math.min(this.hunger,this.water),range=(i.probe?4:2.4)*sense,spread=i.probe?.87:.52;
    for(let x=Math.floor(this.player.x-range);x<=Math.ceil(this.player.x+range);x++)for(let y=1;y<=8;y++) {
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
    this.molting=false;this.moltReady=false;this.moltProgress=0;this.moltStage='idle';this.hold=0;this.antAttack=0;
    for(const ant of this.ants)if(ant.target===-1)ant.target=null;
    if(!alive.length){this.state='lost';return;}
    const next=alive[Math.floor(this.random()*alive.length)];
    const index=this.siblings.indexOf(next);next.alive=false;
    for(const ant of this.ants)if(ant.target===index)ant.target=null;
    this.player.x=next.x;this.player.y=next.y;this.health=1;this.immune=1;
  }
  private wall(p:Point) {
    return p.x<.45||p.x>99.55||p.y<1.45||p.y>7.55||OBSTACLES.some(o=>p.x>o.x-.45&&p.x<o.x+o.w+.45&&p.y>o.y-.45&&p.y<o.y+o.h+.45);
  }
  private los(a:Point,b:Point) {
    const steps=Math.max(2,Math.ceil(distance(a,b)/.15));
    for(let k=1;k<steps;k++)if(!this.clear(a.x+(b.x-a.x)*k/steps,a.y+(b.y-a.y)*k/steps))return false;
    return true;
  }
  private clear(x:number,y:number) {
    return !OBSTACLES.some(o=>x>o.x-.18&&x<o.x+o.w+.18&&y>o.y-.18&&y<o.y+o.h+.18);
  }
  private random(){this.rng=this.rng*48271%2147483647;return this.rng/2147483647;}
}
