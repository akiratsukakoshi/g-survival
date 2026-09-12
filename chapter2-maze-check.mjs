// 第2章の迷路を機械検証する(ブラウザー不要)。docs/chapter2-maze-design.md §3 の必須条件。
// 実行: node --experimental-strip-types chapter2-maze-check.mjs
import { parseMaze, reachable, deadEnds, counts, renderAscii, MAP, CELL, at, blockedAt } from './src/chapter2-maze.ts';
const fail=[];
const check=(ok,label)=>{console.log((ok?'  ok   ':'  NG   ')+label);if(!ok)fail.push(label);return ok;};
const maze=parseMaze();
const narrow=reachable(1.02),wide=reachable(1.2),toMolt=reachable(1.02,maze.start,maze.molt),fromMolt=reachable(1.2,maze.molt,maze.goal);

console.log('=== 第2章 迷路 (S→G 最短経路を * で重ねた ASCII / bodySize 1.02) ===');
console.log(renderAscii(narrow.path));
console.log('');
console.log(`格子: ${maze.cols} 列 x ${maze.rows} 行、1セル=${CELL} ユニット、プレイ域 x ${2}〜${2+maze.cols*CELL} / y 0〜${maze.rows*CELL}`);
console.log(`S=(${maze.start.x},${maze.start.y}) G=(${maze.goal.x},${maze.goal.y}) M=(${maze.molt.x},${maze.molt.y}) ヤモリの巣=(${maze.lair.x},${maze.lair.y})`);
console.log(`ムカデ列 x=${maze.centipede.x} y ${maze.centipede.yTop}〜${maze.centipede.yBottom} / ゲジ行 y=${maze.geji.y} x ${maze.geji.xLeft}〜${maze.geji.xRight}`);
console.log('');

console.log('[到達性]');
check(narrow.ok,`1.02:S→G = ${narrow.ok} (最短 ${narrow.length} セル)`);
check(wide.ok,`1.20:S→G(\`1\`不使用) = ${wide.ok} (最短 ${wide.length} セル)`);
check(!wide.path.some(p=>p.ch==='1'),`1.20 の経路に \`1\` 隙間を含まない = ${!wide.path.some(p=>p.ch==='1')}`);
check(toMolt.ok,`1.02:S→M = ${toMolt.ok} (最短 ${toMolt.length} セル)`);
check(fromMolt.ok,`1.20:M→G = ${fromMolt.ok} (最短 ${fromMolt.length} セル)`);

console.log('[迷路らしさ]');
const ends=deadEnds();
check(ends.length>0,`行き止まり数 = ${ends.length} (参考値・大部屋化後も分岐を保持) ${ends.map(e=>`(${e.x},${e.y})`).join(' ')}`);
check(wide.length>narrow.length,`成長で近道を失う: 3齢 ${narrow.length} / 4齢 ${wide.length} セル`);

console.log('[凡例の個数]');
const n=counts();
check(n['S']===1,`S = ${n['S']??0} (=1)`);
check(n['G']===1,`G = ${n['G']??0} (=1)`);
check(n['M']===1,`M = ${n['M']??0} (=1)`);
check((n['c']??0)>=1,`c = ${n['c']??0} (>=1)`);
check((n['g']??0)>=1,`g = ${n['g']??0} (>=1)`);
check((n['y']??0)>=1,`y = ${n['y']??0} (>=1)`);


console.log('[ガクチョ指定の配置・巡回]');
for(const [address,ch] of Object.entries({B07:'1',D18:'M',E18:'2',I18:'~',D27:'1',D28:'1',J27:'2',J28:'2'}))check(at(Number(address.slice(1))-1,address.charCodeAt(0)-65)===ch,address+'='+ch);
check(maze.centipedes.length===3&&maze.gejis.length===2&&maze.lairs.length===2,'敵: ムカデ3 / ゲジ2 / ヤモリ2');
check([...Array(7)].every((_,i)=>at(21,3+i)==='g'),'D22〜J22 ゲジ');
check(MAP.slice(28,40).every(row=>[...row.slice(1,13)].every(ch=>'.~y'.includes(ch))),'B29〜M40 一室、断熱材と巣のみ');
for(const track of maze.centipedes){check(track.path.every((p,i)=>!blockedAt(p.x,p.y,.4,'enemy')&&(!i||Math.abs(p.r-track.path[i-1].r)+Math.abs(p.c-track.path[i-1].c)===1)),track.id+' 巡回全点は敵通行可能、4近傍で連続');}
for(const size of [1.02,1.2])for(const [a,b] of [[maze.start,maze.goal],[maze.start,maze.molt],[maze.molt,maze.goal]])check(reachable(size,a,b).path.every(p=>!blockedAt(p.x,p.y,size/2)),size+' 経路中心は身体半径でも通行可能');

console.log('[格子仕様]');
check(MAP.length===46,`行数 = ${MAP.length} (=46)`);
check(MAP.every(row=>row.length===14),`列数 = ${[...new Set(MAP.map(r=>r.length))].join(',')} (=14)`);
const ring=MAP[0]+MAP[MAP.length-1]+MAP.map(r=>r[0]+r[r.length-1]).join('');
check([...ring].every(ch=>ch==='#'),`外周はすべて # = ${[...ring].every(ch=>ch==='#')}`);
check((n['1']??0)>=1&&(n['2']??0)>=1,`隙間 1 = ${n['1']??0} / 2 = ${n['2']??0} (ともに >=1)`);
check(maze.pockets.length>=2,`ポケット(o/M) = ${maze.pockets.length} (>=2)`);

console.log('');
if(fail.length){console.log('chapter2 maze check NG: '+fail.join(' | '));process.exit(1);}
console.log('chapter2 maze check PASS: 到達性4条件・行き止まり'+ends.length+'・最短'+narrow.length+'セル・凡例の個数');
