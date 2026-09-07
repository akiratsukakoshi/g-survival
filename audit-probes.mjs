import {Game} from './src/simulation.ts';
const idle={x:0,y:0,sprint:false,freeze:true,probe:false,aimX:10,aimY:1};
const run=(g,s)=>{for(let n=0;n<Math.ceil(s*60);n++)g.update(1/60,idle);};
const g=new Game();run(g,300);console.log(JSON.stringify({case:'freeze_spawn_300_seconds',state:g.state,hunger:g.hunger,water:g.water,livingSiblings:g.siblings.filter(s=>s.alive).length}));
const m=new Game();m.hunger=1;m.water=1;run(m,3.2);for(let n=0;n<240;n++){m.ants=[{x:m.player.x-1.15/60,y:m.player.y}];m.update(1/60,idle);}console.log(JSON.stringify({case:'four_seconds_ant_contact_during_molt',state:m.state,moltProgress:m.moltProgress,livingSiblings:m.siblings.filter(s=>s.alive).length}));
const c=new Game();for(let n=0;n<240;n++){c.ants=[{x:c.player.x-1.15/60,y:c.player.y}];c.update(1/60,idle);}console.log(JSON.stringify({case:'four_seconds_ant_contact_without_molt',state:c.state,livingSiblings:c.siblings.filter(s=>s.alive).length}));
