import {Game} from './src/simulation.ts';
const idle={x:0,y:0,sprint:false,freeze:false,probe:false,aimX:34,aimY:7};
for(const water of [.5,.2])for(const mode of ['walk','sprint','sprint-probe']){
 const g=new Game();g.spiders=[];g.siblings.forEach(s=>s.alive=false);Object.assign(g.player,{x:12,y:7});g.resources=[];g.hunger=g.water=water;g.ants.forEach(a=>{a.x=12;a.y=7;});
 for(let i=0;i<36;i++)g.update(1/60,idle);
 let clear=null,lost=null;
 for(let i=0;i<180;i++){g.update(1/60,{...idle,x:1,sprint:mode!=='walk',probe:mode==='sprint-probe'});if(g.state!=='playing')break;if(clear===null&&g.antAttack===0)clear=(i+1)/60;if(lost===null&&!g.ants.some(a=>a.target===-1))lost=(i+1)/60;}
 console.log(JSON.stringify({water,mode,attackCleared:clear,pursuitEnded:lost,state:g.state,stamina:g.stamina}));
}
