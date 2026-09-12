// 第2章「壁の中」の迷路データと幾何判定。three.js に依存せず import.meta も使わないので Node からそのまま読める。
// 迷路は手書きの固定データ。乱数で生成しない(原仕様 §9-2)。凡例は docs/chapter2-maze-design.md §2 と同じ。
// AI暫定値: セル 2.0 / 壁高 1.6 / 山の頂上 1.2 / すそ野 .6 / 隙間幅 1.10・1.40。
export const CELL=2,WALL_H=1.6,MOUND_TOP=1.2,MOUND_RAMP=.6,ORIGIN_X=2;
export const SLIT_W:Record<string,number>={'1':1.1,'2':1.4};
// # 間柱 / . 通路 / ~ 断熱材の山 / 1 細い隙間 / 2 広い隙間 / o 退避ポケット / M 脱皮ポケット
// S 開始 / G 壁の穴(台所) / c ムカデ巡回列 / g ゲジ横断行 / y ヤモリの巣
export const MAP:string[]=[
 '##############',
 '#......S....##',
 '###########.##',
 '#........~~~##',
 '#.############',
 '#....~~~....##',
 '#1#########.##',
 '#..~........##',
 '#######.######',
 '#####c......##',
 '#####c#####.##',
 '###o2c2o#...##',
 '#####c###.#2##',
 '###o2c2o#...##',
 '#####c#####.##',
 '###o2c###...##',
 '#####c###.####',
 '#o222c#.~...##',
 '###########.##',
 '#...........##',
 '#.###v##v#####',
 '#..ggggggg..##',
 '#########.####',
 '###.......####',
 '###.##v#######',
 '###ggggggg.o##',
 '###1#####2####',
 '#..1.....2####',
 '#............#',
 '#............#',
 '#............#',
 '#............#',
 '#.........y..#',
 '#............#',
 '#............#',
 '#..y.........#',
 '#............#',
 '#............#',
 '#............#',
 '#............#',
 '#########.####',
 '#...........##',
 '###########.##',
 '#######.....##',
 '###########G##',
 '##############',
];
export const ROWS=MAP.length,COLS=MAP[0].length;
export type Pt={x:number;y:number};
export type Ref={r:number;c:number;ch:string;x:number;y:number};
export type Slit=Ref&{width:number;axis:'v'|'h'};
export type Rect={x:number;y:number;w:number;h:number};
export const at=(r:number,c:number)=>r<0||c<0||r>=ROWS||c>=COLS?'#':MAP[r][c];
export const centerOf=(r:number,c:number):Pt=>({x:ORIGIN_X+c*CELL+CELL/2,y:r*CELL+CELL/2+(at(r,c)==='v'?.375:0)});
export const cellOf=(x:number,y:number)=>({r:Math.floor(y/CELL),c:Math.floor((x-ORIGIN_X)/CELL)});
export const chAt=(x:number,y:number)=>{const k=cellOf(x,y);return at(k.r,k.c);};
// 隙間のスリットは通路側の隣接に合わせる。上下が通路なら縦のスリット(柱は左右)。
export const axisOf=(r:number,c:number):'v'|'h'=>at(r-1,c)!=='#'&&at(r+1,c)!=='#'?'v':'h';
export const walkable=(ch:string,bodySize:number)=>ch!=='#'&&(SLIT_W[ch]===undefined||bodySize<=SLIT_W[ch]);
const near=(x:number,y:number,r:number,x0:number,y0:number,x1:number,y1:number)=>{const dx=Math.max(x0-x,0,x-x1),dy=Math.max(y0-y,0,y-y1);return dx*dx+dy*dy<r*r;};
function rects(pred:(ch:string)=>boolean){const used=Array.from({length:ROWS},()=>new Array<boolean>(COLS).fill(false)),out:Rect[]=[];
 for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){if(used[r][c]||!pred(at(r,c)))continue;let w=1;while(c+w<COLS&&!used[r][c+w]&&pred(at(r,c+w)))w++;let h=1;
  grow:while(r+h<ROWS){for(let k=0;k<w;k++)if(used[r+h][c+k]||!pred(at(r+h,c+k)))break grow;h++;}
  for(let i=0;i<h;i++)for(let k=0;k<w;k++)used[r+i][c+k]=true;out.push({x:ORIGIN_X+c*CELL,y:r*CELL,w:w*CELL,h:h*CELL});}
 return out;}
function build(){
 const refs=(pred:(ch:string)=>boolean)=>{const out:Ref[]=[];for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const ch=at(r,c);if(pred(ch))out.push({r,c,ch,...centerOf(r,c)});}return out;};
 const one=(ch:string)=>refs(k=>k===ch)[0],cs=refs(k=>k==='c'),gs=refs(k=>k==='g');
 const track=(id:string,addresses:string[])=>{const path:Ref[]=[];for(const address of addresses){const c=address.charCodeAt(0)-65,r=Number(address.slice(1))-1;
  if(!path.length)path.push({r,c,ch:at(r,c),...centerOf(r,c)});else{let prev=path[path.length-1];if(prev.r!==r&&prev.c!==c)throw Error('Diagonal patrol waypoint: '+address);
   while(prev.r!==r||prev.c!==c){const rr=prev.r+Math.sign(r-prev.r),cc=prev.c+Math.sign(c-prev.c);prev={r:rr,c:cc,ch:at(rr,cc),...centerOf(rr,cc)};path.push(prev);}}}
  if(path.some(p=>blockedAt(p.x,p.y,.4,'enemy')))throw Error('Blocked patrol: '+id);return {id,path};};
 const centipedes=[track('shaft',['F10','F18']),track('upper',['E08','L08','L06','I06']),track('east',['K18','J18','J16','L16','L14','J14','J12'])];
 const gejis=[...new Set(gs.map(p=>p.r))].sort((a,b)=>b-a).map(r=>{const row=gs.filter(p=>p.r===r);return {y:row[0].y,xLeft:Math.min(...row.map(p=>p.x)),xRight:Math.max(...row.map(p=>p.x))};});
 return {rows:ROWS,cols:COLS,cell:CELL,start:one('S'),goal:one('G'),molt:{r:17,c:1,ch:'o',...centerOf(17,1)},lair:one('y'),
  centipedes,gejis,lairs:refs(k=>k==='y'),
  pockets:refs(k=>k==='o'||k==='M'||k==='v'),
  slits:refs(k=>SLIT_W[k]!==undefined).map(s=>({...s,width:SLIT_W[s.ch],axis:axisOf(s.r,s.c)}) as Slit),
  centipede:{x:cs[0].x,yTop:Math.min(...cs.map(k=>k.y)),yBottom:Math.max(...cs.map(k=>k.y))},
  geji:gejis[0],
  walls:[...rects(ch=>ch==='#'),...refs(k=>k==='v').map(p=>({x:ORIGIN_X+p.c*CELL,y:p.r*CELL,w:CELL,h:.75}))],mounds:rects(ch=>ch==='~')};
}
let cached:ReturnType<typeof build>|undefined;
export const parseMaze=()=>cached??=build();
// 円と矩形の重なりで判定する。隙間セルは2本の柱(ジャム)の矩形なので、通行可否は柱の実寸から幾何的に決まる。
// bodySize は reachable() と揃えるための記録用で、判定には使わない(半径 r が身体幅の実体)。
export function blockedAt(x:number,y:number,r=.35,who:'player'|'enemy'='player',_bodySize=1.02){
 const c0=Math.floor((x-ORIGIN_X-r)/CELL),c1=Math.floor((x-ORIGIN_X+r)/CELL),r0=Math.floor((y-r)/CELL),r1=Math.floor((y+r)/CELL);
 for(let rr=r0;rr<=r1;rr++)for(let cc=c0;cc<=c1;cc++){const ch=at(rr,cc),x0=ORIGIN_X+cc*CELL,y0=rr*CELL,x1=x0+CELL,y1=y0+CELL;
  if(ch==='#'||(who==='enemy'&&ch==='~')){if(near(x,y,r,x0,y0,x1,y1))return true;continue;}
  if(ch==='v'){if(near(x,y,r,x0,y0,x1,who==='enemy'?y1:y0+.75))return true;continue;}
  if(ch==='o'||ch==='M'){if(who==='enemy'&&near(x,y,r,x0,y0,x1,y1))return true;continue;}
  const w=SLIT_W[ch];if(w===undefined)continue;
  if(who==='enemy'){if(near(x,y,r,x0,y0,x1,y1))return true;continue;}
  const cx=(x0+x1)/2,cy=(y0+y1)/2;
  if(axisOf(rr,cc)==='v'){if(near(x,y,r,x0,y0,cx-w/2,y1)||near(x,y,r,cx+w/2,y0,x1,y1))return true;}
  else if(near(x,y,r,x0,y0,x1,cy-w/2)||near(x,y,r,x0,cy+w/2,x1,y1))return true;}
 return false;}
// ~ セルの台形。連続する ~ の外縁から MOUND_RAMP で立ち上がり、頂上は MOUND_TOP。
export function heightAt(x:number,y:number){const k=cellOf(x,y);if(at(k.r,k.c)!=='~')return 0;
 let a=k.c;while(at(k.r,a-1)==='~')a--;let b=k.c;while(at(k.r,b+1)==='~')b++;let u=k.r;while(at(u-1,k.c)==='~')u--;let v=k.r;while(at(v+1,k.c)==='~')v++;
 const d=Math.min(x-(ORIGIN_X+a*CELL),ORIGIN_X+(b+1)*CELL-x,y-u*CELL,(v+1)*CELL-y);
 return MOUND_TOP*Math.max(0,Math.min(1,d/MOUND_RAMP));}
// 4近傍 BFS。1 は bodySize<=1.10、2 は <=1.40 のときだけ通る。
export function reachable(bodySize:number,from?:{r:number;c:number},to?:{r:number;c:number},who:'player'|'enemy'='player'){
 const m=parseMaze(),s=from??m.start,t=to??m.goal,key=(r:number,c:number)=>r*COLS+c;
 const prev=new Map<number,number>([[key(s.r,s.c),-1]]),queue=[key(s.r,s.c)],end=key(t.r,t.c);
 for(let head=0;head<queue.length;head++){const k=queue[head];if(k===end)break;const r=Math.floor(k/COLS),c=k%COLS;
  for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){const rr=r+dr,cc=c+dc,kk=key(rr,cc);if((SLIT_W[at(rr,cc)]!==undefined&&(axisOf(rr,cc)==='v'?dc!==0:dr!==0))||(SLIT_W[at(r,c)]!==undefined&&(axisOf(r,c)==='v'?dc!==0:dr!==0)))continue;if((at(rr,cc)==='v'&&dr!==-1)||(at(r,c)==='v'&&dr!==1))continue;if(prev.has(kk)||!walkable(at(rr,cc),bodySize)||(who==='enemy'&&'12oMv~'.includes(at(rr,cc))))continue;prev.set(kk,k);queue.push(kk);}}
 if(!prev.has(end))return {ok:false,path:[] as Ref[],length:0};
 const path:Ref[]=[];for(let k=end;k!==-1;k=prev.get(k)!){const r=Math.floor(k/COLS),c=k%COLS;path.push({r,c,ch:at(r,c),...centerOf(r,c)});}
 path.reverse();return {ok:true,path,length:path.length};}
// 通路セルで通路隣接が1つのもの。S/G/o/M は行き止まりとして数えない。
export function deadEnds(){const out:Ref[]=[];for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const ch=at(r,c);if(ch==='#'||'SGoMv'.includes(ch))continue;
 let n=0;for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]])if(at(r+dr,c+dc)!=='#')n++;if(n===1)out.push({r,c,ch,...centerOf(r,c)});}return out;}
export function counts(){const m:Record<string,number>={};for(const row of MAP)for(const ch of row)m[ch]=(m[ch]??0)+1;return m;}
export function renderAscii(path?:{r:number;c:number}[]){const g=MAP.map(row=>row.split(''));for(const p of path??[])if(g[p.r][p.c]==='.')g[p.r][p.c]='*';return g.map(row=>row.join('')).join('\n');}
