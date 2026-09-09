type ChapterSave = {
  version: 1;
  unlockedChapter: number;
  currentChapter: number;
  survivors: number;
  instar: number;
  bodySize: number;
  injuries: string[];
};

const SAVE_KEY = 'g-survival-progress-v1';
const clamp = (value: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, value));

export function readProgress(): ChapterSave {
  try {
    const value = JSON.parse(localStorage.getItem(SAVE_KEY) ?? '');
    if (value?.version === 1 && Number.isInteger(value.survivors)) return value;
  } catch { /* First visit or an obsolete save. */ }
  return { version: 1, unlockedChapter: 1, currentChapter: 1, survivors: 24, instar: 1, bodySize: .75, injuries: [] };
}

export function completeChapterOne(survivors: number) {
  const save: ChapterSave = {
    ...readProgress(), unlockedChapter: 2, currentChapter: 2,
    survivors: Math.max(1, survivors), instar: 3, bodySize: 1.02,
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

const gaps = [
  { x: 8, y: 15, width: 1.15 }, { x: 3, y: 28, width: .82 },
  { x: 12, y: 41, width: 1.06 }, { x: 5, y: 55, width: .7 },
  { x: 10, y: 68, width: 1.12 }, { x: 2, y: 82, width: .76 },
];

export function mountChapterTwo() {
  const save = readProgress();
  if (!location.search.includes('from=chapter1') && save.unlockedChapter < 2) {
    save.survivors = 8; save.instar = 3; save.bodySize = 1.02;
  }
  document.title = 'G-survival — 第2章 壁の中';
  document.querySelector('#app')!.innerHTML = `<canvas id="shaft"></canvas>
    <header><span class="mark">G-survival <small>— 隙間の生 —</small></span><span class="chapter">CHAPTER 02 / 壁の中</span></header>
    <div id="entry"><div class="eyebrow">LATE SUMMER / THIRD INSTAR</div><h1>壁の中</h1>
    <p class="story">白い帯は、いつの間にか薄くなった。<br>身体は大きくなり、昨日までの隙間に、胸が触れる。</p>
    <p class="goal"><b>下へ。</b><br>壁の中を、一階分だけ降りる。<br>狭い隙間は、立ち止まって触角で測る。</p>
    <button id="begin">壁の中へ入る <span>↓</span></button><small>この壁へ入った群れ: ${save.survivors}匹</small></div>
    <aside id="hud"><div id="population">${save.survivors} 匹</div><div id="objective">断熱材の層</div></aside>
    <div id="warning"></div><div id="controls">WASD / 矢印：這う　·　Shift：走る　·　左長押し：隙間を測る</div>
    <div id="ending" hidden><div class="eyebrow">CHAPTER 02 / FOUNDATION</div><h2>床下の冷たさ</h2><p>キッチンの床板が、遠くで鳴った。</p><button id="again">もう一度、壁の中へ ↗</button></div>
    <footer><span>PERIPLANETA FULIGINOSA</span><span>02 — IN THE WALL</span></footer>`;

  const canvas = document.querySelector<HTMLCanvasElement>('#shaft')!;
  const ctx = canvas.getContext('2d')!;
  const keys = new Set<string>();
  let started = false, ended = false, probe = false, last = performance.now();
  const player = { x: 7, y: 3 };
  const resize = () => { canvas.width = innerWidth; canvas.height = innerHeight; };
  addEventListener('resize', resize); resize();
  addEventListener('keydown', event => { if (/^(Key[WASD]|Arrow|Shift)/.test(event.code)) event.preventDefault(); keys.add(event.code); });
  addEventListener('keyup', event => keys.delete(event.code));
  addEventListener('pointerdown', event => { if (event.button === 0) probe = true; });
  addEventListener('pointerup', () => { probe = false; });
  document.querySelector<HTMLButtonElement>('#begin')!.onclick = () => { started = true; document.querySelector('#entry')!.classList.add('gone'); };
  document.querySelector<HTMLButtonElement>('#again')!.onclick = () => location.reload();
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('test')) Object.assign(window, { chapter2Test: { setPosition(x: number, y: number) { player.x = x; player.y = y; } } });

  function draw(now: number) {
    const scale = Math.min(canvas.width / 15, canvas.height / 18);
    const ox = canvas.width / 2 - player.x * scale, oy = canvas.height * .25 - player.y * scale;
    ctx.fillStyle = '#111317'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#3d322d'; ctx.fillRect(ox, oy, 15 * scale, 98 * scale);
    ctx.fillStyle = '#77645a'; for (let y = 8; y < 96; y += 9) ctx.fillRect(ox, oy + y * scale, 15 * scale, .22 * scale);
    ctx.strokeStyle = '#252a29'; ctx.lineWidth = Math.max(2, scale * .12); ctx.beginPath(); ctx.moveTo(ox + 3 * scale, oy); ctx.bezierCurveTo(ox + 11 * scale, oy + 25 * scale, ox + 2 * scale, oy + 55 * scale, ox + 10 * scale, oy + 98 * scale); ctx.stroke();
    gaps.forEach(gap => { ctx.fillStyle = gap.width < save.bodySize ? '#231d1a' : '#17251f'; ctx.fillRect(ox + (gap.x - 1) * scale, oy + (gap.y - .45) * scale, 2 * scale, .9 * scale); });
    const centipedeY = 34 + (now / 1000 * 2.1 % 22); ctx.fillStyle = '#9b6f4e';
    for (let n = 0; n < 12; n++) ctx.fillRect(ox + (7 + Math.sin(n * .7) * .5) * scale, oy + (centipedeY + n * .34) * scale, .42 * scale, .24 * scale);
    ctx.fillStyle = '#d1c3a3'; ctx.beginPath(); ctx.ellipse(ox + player.x * scale, oy + player.y * scale, .38 * scale, .62 * scale, 0, 0, Math.PI * 2); ctx.fill();
  }

  function frame(now: number) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (started && !ended) {
      const dx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      const dy = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
      const speed = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 6 : 3) * dt;
      player.x = clamp(player.x + dx * speed, .4, 13.6); player.y = clamp(player.y + dy * speed, 1, 92);
      const gap = gaps.find(item => Math.abs(player.y - item.y) < .65 && Math.abs(player.x - item.x) < 1.1);
      const tooNarrow = !!gap && gap.width < save.bodySize;
      if (tooNarrow && dy > 0) player.y = gap!.y - .66;
      const centipedeY = 34 + (now / 1000 * 2.1 % 22), danger = Math.abs(centipedeY - player.y) < 4 && player.x > 5;
      document.querySelector('#warning')!.textContent = tooNarrow ? '胸が擦れる。ここはもう通れない。' : danger ? '脚の影が、壁を横切る。' : probe && gap ? (gap.width >= save.bodySize ? '触角の先に、抜け道がある。' : '触角が、奥で戻ってきた。') : '';
      document.querySelector('#objective')!.textContent = player.y < 28 ? '配線と間柱のシャフト' : player.y < 58 ? '湿った配管の分岐' : player.y < 82 ? '巾木の裏' : 'キッチンの床下';
      if (player.y >= 91) { ended = true; document.querySelector('#ending')!.removeAttribute('hidden'); }
    }
    draw(now); requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
