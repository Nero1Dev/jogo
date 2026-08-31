(function(){
  // ============================================================
  // 2048 — motor clássico: linhas deslizam e peças iguais se
  // fundem uma vez por jogada. Cada peça tem um id estável pra
  // animar deslize/fusão/nascimento sem redesenhar tudo do zero.
  // ============================================================
  try {

  const SIZE = 4;
  const WIN_VALUE = 2048;
  const TILE_STEP = 25.75; // % — passo entre peças (peça + gap)
  const SLIDE_MS = 130;

  const boardEl = document.getElementById('g2048Board');
  const scoreValueEl = document.getElementById('scoreValue');
  const bestValueEl = document.getElementById('bestValue');
  const resetBtn = document.getElementById('resetBtn');
  const helpEl = document.getElementById('g2048Help');
  const DEFAULT_HELP = helpEl.textContent;

  const KEY_MAP = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    a: 'left', d: 'right', w: 'up', s: 'down',
    A: 'left', D: 'right', W: 'up', S: 'down'
  };

  let tiles = [];
  let tileEls = new Map();
  let nextId = 1;
  let score = 0;
  let best = 0;
  let gameOver = false;
  let won = false;
  let animating = false;

  function tileAt(row, col){
    return tiles.find(t => t.row === row && t.col === col) || null;
  }

  function emptyCells(){
    const occupied = new Set(tiles.map(t => t.row + ',' + t.col));
    const empties = [];
    for (let r = 0; r < SIZE; r++){
      for (let c = 0; c < SIZE; c++){
        if (!occupied.has(r + ',' + c)) empties.push({ row: r, col: c });
      }
    }
    return empties;
  }

  function spawnRandomTile(){
    const empties = emptyCells();
    if (!empties.length) return null;
    const cell = empties[Math.floor(Math.random() * empties.length)];
    const value = Math.random() < 0.9 ? 2 : 4;
    const tile = { id: nextId++, value, row: cell.row, col: cell.col, justMerged: false };
    tiles.push(tile);
    return tile;
  }

  function buildSlots(){
    for (let r = 0; r < SIZE; r++){
      for (let c = 0; c < SIZE; c++){
        const slot = document.createElement('div');
        slot.className = 'g2048-slot';
        slot.style.left = (c * TILE_STEP) + '%';
        slot.style.top = (r * TILE_STEP) + '%';
        boardEl.appendChild(slot);
      }
    }
  }

  function getLines(dir){
    const lines = [];
    if (dir === 'left'){
      for (let r = 0; r < SIZE; r++){
        const line = [];
        for (let c = 0; c < SIZE; c++) line.push({ row: r, col: c });
        lines.push(line);
      }
    } else if (dir === 'right'){
      for (let r = 0; r < SIZE; r++){
        const line = [];
        for (let c = SIZE - 1; c >= 0; c--) line.push({ row: r, col: c });
        lines.push(line);
      }
    } else if (dir === 'up'){
      for (let c = 0; c < SIZE; c++){
        const line = [];
        for (let r = 0; r < SIZE; r++) line.push({ row: r, col: c });
        lines.push(line);
      }
    } else if (dir === 'down'){
      for (let c = 0; c < SIZE; c++){
        const line = [];
        for (let r = SIZE - 1; r >= 0; r--) line.push({ row: r, col: c });
        lines.push(line);
      }
    }
    return lines;
  }

  function doMove(dir){
    const lines = getLines(dir);
    let scoreGained = 0;
    let moved = false;
    let merged = false;
    const toRemove = [];

    for (const cellsInOrder of lines){
      const lineTiles = cellsInOrder.map(cell => tileAt(cell.row, cell.col)).filter(Boolean);
      const placed = [];
      let i = 0;
      while (i < lineTiles.length){
        const cur = lineTiles[i];
        const next = lineTiles[i + 1];
        if (next && next.value === cur.value){
          placed.push({ survivor: cur, away: next, value: cur.value * 2 });
          i += 2;
        } else {
          placed.push({ survivor: cur, away: null, value: cur.value });
          i += 1;
        }
      }
      placed.forEach((entry, idx) => {
        const target = cellsInOrder[idx];
        if (entry.survivor.row !== target.row || entry.survivor.col !== target.col) moved = true;
        entry.survivor.row = target.row;
        entry.survivor.col = target.col;
        if (entry.away){
          entry.survivor.value = entry.value;
          entry.survivor.justMerged = true;
          scoreGained += entry.value;
          moved = true;
          merged = true;
          entry.away.row = target.row;
          entry.away.col = target.col;
          toRemove.push(entry.away);
        }
      });
    }

    return { moved, scoreGained, merged, toRemove };
  }

  function canMove(){
    if (emptyCells().length) return true;
    for (let r = 0; r < SIZE; r++){
      for (let c = 0; c < SIZE; c++){
        const v = tileAt(r, c).value;
        if (c < SIZE - 1 && tileAt(r, c + 1).value === v) return true;
        if (r < SIZE - 1 && tileAt(r + 1, c).value === v) return true;
      }
    }
    return false;
  }

  function render(){
    const seen = new Set();
    tiles.forEach(t => {
      seen.add(t.id);
      let el = tileEls.get(t.id);
      if (!el){
        el = document.createElement('div');
        el.className = 'g2048-tile spawn';
        boardEl.appendChild(el);
        tileEls.set(t.id, el);
      }
      el.style.left = (t.col * TILE_STEP) + '%';
      el.style.top = (t.row * TILE_STEP) + '%';
      el.textContent = t.value;
      el.dataset.value = String(t.value);
      el.classList.toggle('hero', t.value >= WIN_VALUE);
      el.classList.remove('d3', 'd4', 'd5');
      const len = String(t.value).length;
      if (len === 3) el.classList.add('d3');
      else if (len === 4) el.classList.add('d4');
      else if (len >= 5) el.classList.add('d5');

      if (t.justMerged){
        el.classList.remove('merge-pop');
        void el.offsetWidth;
        el.classList.add('merge-pop');
        t.justMerged = false;
      }
    });

    for (const [id, el] of tileEls){
      if (!seen.has(id)){
        el.remove();
        tileEls.delete(id);
      }
    }
  }

  function updateHud(){
    scoreValueEl.textContent = String(score);
    bestValueEl.textContent = String(best);
  }

  // mesmo confete (canvas puro) do easter egg de nairondalmaso.com.br
  function burstConfetti(){
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:1000;';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const COLORS = ['#C99A44', '#A8462B', '#7C3220', '#EDE6D6', '#EAB308', '#E8C87A'];
    const particles = Array.from({ length: 220 }, () => ({
      x: canvas.width / 2 + (Math.random() - 0.5) * 220,
      y: canvas.height / 2 + (Math.random() - 0.5) * 120,
      vx: (Math.random() - 0.5) * 5,
      vy: -Math.random() * 7 - 3,
      size: Math.random() * 10 + 10,
      shape: Math.random() < 0.65 ? 'rect' : 'circle',
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.04 + Math.random() * 0.05,
      life: 1
    }));

    const GRAVITY = 0.09;
    let start = null;

    function frame(t){
      if (!start) start = t;
      const elapsed = t - start;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let alive = false;
      particles.forEach(p => {
        if (p.life <= 0) return;
        p.vy += GRAVITY;
        p.wobble += p.wobbleSpeed;
        p.x += p.vx + Math.sin(p.wobble) * 2.2;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.life -= 0.0035;
        if (p.life > 0){
          alive = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation * Math.PI / 180);
          ctx.globalAlpha = Math.max(p.life, 0);
          ctx.fillStyle = p.color;
          if (p.shape === 'circle'){
            ctx.beginPath();
            ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillRect(-p.size / 2, -p.size * 0.35, p.size, p.size * 0.7);
          }
          ctx.restore();
        }
      });

      if (alive && elapsed < 6000){
        requestAnimationFrame(frame);
      } else {
        canvas.remove();
      }
    }
    requestAnimationFrame(frame);
  }

  function checkGameState(){
    if (!won){
      const maxTile = tiles.reduce((m, t) => Math.max(m, t.value), 0);
      if (maxTile >= WIN_VALUE){
        won = true;
        helpEl.textContent = 'Você chegou ao 2048! Continue jogando pra ir mais longe.';
        helpEl.classList.add('result-win');
        burstConfetti();
        return;
      }
    }
    if (!canMove()){
      gameOver = true;
      helpEl.textContent = 'Fim de jogo — pontuação final: ' + score + '. Clique em REINICIAR pra jogar de novo.';
      helpEl.classList.remove('result-win');
      helpEl.classList.add('result-lose');
    }
  }

  function handleMove(dir){
    if (gameOver || animating) return;
    const result = doMove(dir);
    if (!result.moved) return;

    animating = true;
    if (window.playClick) window.playClick(result.merged ? 760 : 560);
    score += result.scoreGained;
    if (score > best) best = score;
    updateHud();
    render();

    setTimeout(() => {
      tiles = tiles.filter(t => !result.toRemove.includes(t));
      spawnRandomTile();
      render();
      checkGameState();
      animating = false;
    }, SLIDE_MS);
  }

  document.addEventListener('keydown', e => {
    const dir = KEY_MAP[e.key];
    if (!dir) return;
    e.preventDefault();
    handleMove(dir);
  });

  let touchStartX = 0, touchStartY = 0, touchActive = false;
  const SWIPE_THRESHOLD = 24;

  boardEl.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    touchActive = true;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  boardEl.addEventListener('touchend', e => {
    if (!touchActive) return;
    touchActive = false;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return;
    if (Math.abs(dx) > Math.abs(dy)) handleMove(dx > 0 ? 'right' : 'left');
    else handleMove(dy > 0 ? 'down' : 'up');
  });

  function newGame(){
    tiles = [];
    tileEls.forEach(el => el.remove());
    tileEls.clear();
    nextId = 1;
    score = 0;
    gameOver = false;
    won = false;
    animating = false;
    helpEl.textContent = DEFAULT_HELP;
    helpEl.classList.remove('result-win', 'result-lose');
    spawnRandomTile();
    spawnRandomTile();
    render();
    updateHud();
  }

  resetBtn.addEventListener('click', newGame);

  buildSlots();
  newGame();

  } catch (err){
    console.error(err);
    const boardEl = document.getElementById('g2048Board');
    if (boardEl){
      boardEl.style.cssText = 'display:block;width:100%;padding:16px;border:1px solid rgba(168,70,43,0.5);border-radius:8px;';
      boardEl.textContent = 'Erro ao carregar o 2048: ' + err.message;
    }
  }
})();
