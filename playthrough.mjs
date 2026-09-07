import { Game, OBSTACLES } from './src/simulation.ts';
const h=.25,nx=401,ny=29;
const free=(x,y)=>x>=0&&x<=100&&y>=1&&y<=8&&!OBSTACLES.some(o=>x>o.x-.23&&x<o.x+o.w+.23&&y>o.y-.23&&y<o.y+o.h+.23);
function route(a,b){const cell=p=>[Math.round(p.x/h),Math.round((p.y-1)/h)];let [ax,ay]=cell(a),[bx,by]=cell(b);const key=(x,y)=>y*nx+x;const start=key(ax,ay),end=key(bx,by),queue=[start],prev=new Map([[start,-1]]);for(let head=0;head<queue.length;head++){const k=queue[head];if(k===end)break;const x=k%nx,y=Math.floor(k/nx);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,kk=key(xx,yy);if(xx<0||xx>=nx||yy<0||yy>=ny||prev.has(kk)||!free(xx*h,1+yy*h))continue;prev.set(kk,k);queue.push(kk);}}if(!prev.has(end))throw new Error(`No traversable route ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);const points=[];for(let k=end;k!==start;k=prev.get(k))points.push({x:(k%nx)*h,y:1+Math.floor(k/nx)*h});return points.reverse();}
const game=new Game();const controls={x:0,y:0,sprint:false,freeze:false,probe:process.argv.includes('--probe'),aimX:100,aimY:4};
const report={mode:controls.probe?'probing':'known-route',waypoints:[],deaths:0,elapsed:0,state:'',siblings:0};
function tick(i=controls){game.update(1/60,i);}
function travel(goal){let points=route(game.player,goal),index=0,previous=game.siblings.filter(s=>s.alive).length;for(let frame=0;frame<24000&&index<points.length&&game.state==='playing';frame++){const target=points[index],dx=target.x-game.player.x,dy=target.y-game.player.y;if(Math.hypot(dx,dy)<.12){index++;continue;}const playerBefore={...game.player};let action={...controls,x:dx,y:dy,aimX:target.x,aimY:target.y};
if(controls.probe){
 const antsNear=game.ants.some(a=>Math.hypot(a.x-game.player.x,a.y-game.player.y)<1.1);
 if(antsNear||game.antAttack>0){action.probe=false;action.sprint=true;}
 const threat=game.spiders.find(s=>{
  if(s.state!=='warning'&&s.state!=='attack')return false;
  const sx=game.player.x-s.x,sy=game.player.y-s.y;
  const along=sx*Math.cos(s.angle)+sy*Math.sin(s.angle),across=Math.abs(-sx*Math.sin(s.angle)+sy*Math.cos(s.angle));
  return along>-.8&&along<6.5&&across<1.2;
 });
 if(threat){
  const perp={x:-Math.sin(threat.angle),y:Math.cos(threat.angle)};
  const options=[1,-1].map(sign=>({x:perp.x*sign,y:perp.y*sign})).filter(v=>free(game.player.x+v.x*.7,game.player.y+v.y*.7));
  options.sort((a,b)=>Math.hypot(game.player.x+a.x-threat.x,game.player.y+a.y-threat.y)-Math.hypot(game.player.x+b.x-threat.x,game.player.y+b.y-threat.y));
  const avoid=options.at(-1);if(avoid){action={...action,...avoid,probe:false,sprint:true};}
 }
}
tick(action);const living=game.siblings.filter(s=>s.alive).length;
 // Replan after a handoff rather than teleporting the player to a convenient path.
 if(Math.hypot(game.player.x-playerBefore.x,game.player.y-playerBefore.y)>1){report.deaths++;points=route(game.player,goal);index=0;}previous=living;}
 if(game.state==='playing'&&Math.hypot(goal.x-game.player.x,goal.y-game.player.y)>.6)throw new Error(`Travel stuck at ${JSON.stringify(game.player)} to ${JSON.stringify(goal)}`);
 report.waypoints.push({goal,time:+game.time.toFixed(1),group:game.siblings.filter(s=>s.alive).length+1});}
// Geometry proof covers all six chapter sections with the same solid bounds as gameplay.
for(const point of [{x:14,y:1},{x:31,y:2.5},{x:54,y:6},{x:76,y:2.75},{x:78,y:6},{x:91,y:6},{x:98,y:1.5}])route({x:4,y:1},point);
for(const r of game.resources.filter(r=>r.amount>0)){travel(r);for(let n=0;n<180&&game.state==='playing';n++)tick();if(game.state!=='playing')break;}
if(game.state==='playing'){travel({x:98,y:1.5});for(let n=0;n<1500&&game.state==='playing';n++)tick({...controls,freeze:true});}
report.elapsed=+game.time.toFixed(1);report.state=game.state;report.siblings=game.siblings.filter(s=>s.alive).length;report.hunger=game.hunger;report.water=game.water;
console.log(JSON.stringify(report,null,2));
if(game.state!=='won')process.exitCode=2;
