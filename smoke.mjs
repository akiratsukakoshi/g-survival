import assert from 'node:assert/strict';
import { Game, OBSTACLES } from './src/simulation.ts';
const idle={x:0,y:0,sprint:false,freeze:false,probe:false,aimX:34,aimY:34};
const step=(g,seconds,input=idle)=>{for(let n=0;n<Math.round(seconds*60);n++)g.update(1/60,input);};
const isolated=()=>{const g=new Game();g.spiders=[];g.ants=[];g.siblings.forEach(s=>s.alive=false);return g;};
let checks=0;
function test(name,fn){fn();checks++;console.log('PASS '+name);}
test('eight directions, probe half speed, wall 30% bonus, solids',()=>{
 const a=isolated(),b=isolated();a.player={x:4,y:3,angle:0};b.player={x:4,y:3,angle:0};
 step(a,.3,{...idle,x:1,y:1});step(b,.3,{...idle,x:1,y:1,probe:true});
 assert(a.player.x>4&&a.player.y>3);assert(Math.abs((a.player.x-4)/(b.player.x-4)-2)<.01);
 const c=isolated(),d=isolated();c.player={x:4,y:1,angle:0};d.player={x:4,y:3,angle:0};
 step(c,.3,{...idle,x:1});step(d,.3,{...idle,x:1});assert(Math.abs((c.player.x-4)/(d.player.x-4)-1.3)<.01);
 c.player={x:5.5,y:4,angle:0};step(c,2,{...idle,x:1});assert(c.player.x<7);
});
test('3 second hold, full 20 second immobile molt, reset on death',()=>{
 const g=isolated();g.hunger=g.water=1;step(g,2.9,{...idle,freeze:true});assert(!g.molting);
 step(g,.2,{...idle,freeze:true});assert(g.molting);const p={...g.player};
 step(g,19,{...idle,x:1});assert.equal(g.state,'playing');assert.equal(g.player.x,p.x);assert.equal(g.player.y,p.y);
 step(g,1.1);assert.equal(g.state,'won');assert.equal(g.moltStage,'complete');
});
test('ants contact, swarm, exact 3 seconds including molt, random handoff',()=>{
 const g=new Game();g.spiders=[];g.player={x:4,y:8,angle:0};g.hunger=g.water=1;g.molting=true;
 g.siblings.forEach((s,n)=>{s.x=4+n*.1;s.y=4;});g.ants.forEach(a=>{a.x=4;a.y=8;});
 step(g,2.8);assert(g.molting);assert(g.antAttack>2.7);assert.equal(g.siblings.filter(s=>s.alive).length,11);
 step(g,.3);assert.equal(g.siblings.filter(s=>s.alive).length,10);assert(!g.molting);assert.equal(g.moltProgress,0);assert(g.player.x<10);
});
test('NPC ant swarm requires continuous contact and kills after 3 seconds',()=>{
 const g=new Game();g.player={x:4,y:1,angle:0};g.siblings.forEach(s=>s.alive=false);
 const s=g.siblings[0];Object.assign(s,{x:20,y:3,alive:true});g.ants.forEach(a=>{a.x=s.x;a.y=s.y;});
 for(let n=0;n<168;n++)g.antsUpdate(1/60);assert(s.alive);
 for(let n=0;n<13;n++)g.antsUpdate(1/60);assert(!s.alive);
});
test('sprinting breaks ant contact before capture',()=>{
 const g=new Game();g.spiders=[];g.siblings.forEach(s=>s.alive=false);g.player={x:4,y:8,angle:0};g.hunger=g.water=1;
 g.ants.forEach(a=>{a.x=4;a.y=8;});step(g,.6);assert(g.antAttack>.5);
 step(g,1.5,{...idle,x:1,sprint:true});assert.equal(g.state,'playing');assert.equal(g.antAttack,0);
});
test('spider locks warning for .8 seconds, one capture per lunge',()=>{
 const g=new Game();g.ants=[];g.siblings.forEach(s=>s.alive=false);g.player={x:11.5,y:13.2,angle:0};
 g.spidersUpdate(1/60,{...idle,x:1});const s=g.spiders[0];assert.equal(s.state,'warning');const lock=s.targetY;
 g.player.y=13.5;for(let n=0;n<40;n++)g.spidersUpdate(1/60,idle);assert.equal(s.state,'warning');assert.equal(s.targetY,lock);
 const h=new Game();h.player={x:4,y:4,angle:0};h.spiders[0].state='attack';h.spiders[0].angle=0;h.spiders[0].x=9.5;h.spiders[0].y=13.2;
 h.siblings.forEach(q=>{q.x=9.8;q.y=13.2;q.alive=true;});h.spidersUpdate(1/60,idle);
 assert.equal(h.siblings.filter(q=>q.alive).length,10);assert.equal(h.spiders[0].state,'recover');
});
test('freeze hides, dash vibration beyond visual cone, occlusion',()=>{
 const g=new Game();g.siblings.forEach(s=>s.alive=false);const s=g.spiders[0];s.x=9.5;s.y=13.2;s.angle=0;
 g.player={x:11.5,y:13.2,angle:0};assert.equal(g.prey(s,{...idle,freeze:true}),undefined);
 assert.equal(g.prey(s,{...idle,x:1,sprint:true}),g.player);
 g.player={x:20,y:20,angle:0};assert.equal(g.prey(s,{...idle,x:1,sprint:true}),undefined);
});
test('depletion is lethal, early resources cannot unlock molt, human events once',()=>{
 const g=isolated();g.hunger=g.water=0;step(g,9);assert.equal(g.state,'lost');
 const h=isolated();for(const r of h.resources.filter(r=>r.amount<1)){h.player.x=r.x;h.player.y=r.y;step(h,4);}
 assert(!h.moltReady);assert(h.water<.85);
 h.humanEventsTriggered=0;h.player.y=12;step(h,.1);assert(h.humanEvent>0);step(h,2);assert.equal(h.humanEvent,0);
 h.player.y=11;step(h,.1);h.player.y=12;step(h,.1);assert.equal(h.humanEvent,0);
 h.player.y=27;step(h,.1);assert(h.humanEvent>0);assert.equal(h.humanEventsTriggered,3);
});
test('three checkpoints heal and gather, ants remain outside solids',()=>{
 const g=new Game();g.player={x:13,y:7,angle:0};g.health=.5;g.hunger=.5;step(g,1);assert(g.health>.59);assert(g.hunger>.5);assert.equal(g.checkpoints.length,3);
 const h=new Game();h.player={x:4,y:4,angle:0};h.siblings.forEach(s=>s.alive=false);
 for(let n=0;n<3600;n++){h.antsUpdate(1/60);for(const a of h.ants)assert(!OBSTACLES.some(o=>a.x>o.x&&a.x<o.x+o.w&&a.y>o.y&&a.y<o.y+o.h));}
});
console.log(`${checks} regression groups passed`);
