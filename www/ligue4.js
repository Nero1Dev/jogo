(function(){
  const COLS = 7;
  const ROWS = 6;

  const boardEl = document.getElementById('c4Board');
  const turnValueEl = document.getElementById('turnValue');
  const turnDotEl = document.getElementById('turnDot');
  const resetBtn = document.getElementById('resetBtn');
  const modeBtns = Array.from(document.querySelectorAll('.mode-btn'));
  const scoreP1El = document.getElementById('scoreP1');
  const scoreP2El = document.getElementById('scoreP2');
  const scoreDrawEl = document.getElementById('scoreDraw');
  const scoreP1LabelEl = document.getElementById('scoreP1Label');
  const scoreP2LabelEl = document.getElementById('scoreP2Label');
  const confirmOverlay = document.getElementById('confirmOverlay');
  const cancelResetBtn = document.getElementById('cancelResetBtn');
  const confirmResetBtn = document.getElementById('confirmResetBtn');

  // board[col][row] — row 0 é o topo, row 5 é o fundo (mesma ordem visual do DOM)
  let board = [];
  let current = 'p1';
  let active = true;
  let mode = 'pvp'; // 'pvp' ou 'cpu' — no modo cpu, humano é sempre p1 e robô é sempre p2
  const score = { p1: 0, p2: 0, draw: 0 };
  const columnEls = [];
  const CENTER_ORDER = [3, 2, 4, 1, 5, 0, 6];
  const AI_DEPTH = 6;

  function buildBoard(){
    boardEl.innerHTML = '';
    columnEls.length = 0;
    board = Array.from({ length: COLS }, () => Array(ROWS).fill(null));

    for (let c = 0; c < COLS; c++){
      const col = document.createElement('button');
      col.className = 'c4-col';
      col.dataset.col = c;
      col.setAttribute('aria-label', 'Jogar na coluna ' + (c + 1));

      const preview = document.createElement('div');
      preview.className = 'c4-preview p1';
      col.appendChild(preview);

      for (let r = 0; r < ROWS; r++){
        const hole = document.createElement('div');
        hole.className = 'c4-hole';
        col.appendChild(hole);
      }

      col.addEventListener('click', () => handleColumnClick(c));
      boardEl.appendChild(col);
      columnEls.push(col);
    }
  }

  function updatePreviews(){
    columnEls.forEach(col => {
      const preview = col.querySelector('.c4-preview');
      preview.classList.toggle('p1', current === 'p1');
      preview.classList.toggle('p2', current === 'p2');
    });
  }

  function isRobotTurn(){
    return mode === 'cpu' && current === 'p2';
  }

  function updateColumnsInteractivity(){
    const robotTurn = isRobotTurn();
    columnEls.forEach(c => c.disabled = !active || robotTurn);
  }

  function renderTurn(){
    if (mode === 'cpu'){
      turnValueEl.textContent = current === 'p1' ? 'VOCÊ' : 'ROBÔ';
    } else {
      turnValueEl.textContent = current === 'p1' ? 'JOGADOR 1' : 'JOGADOR 2';
    }
    turnDotEl.classList.toggle('p2', current === 'p2');
    updatePreviews();
    updateColumnsInteractivity();
  }

  function updateLabels(){
    if (mode === 'cpu'){
      scoreP1LabelEl.textContent = 'VOCÊ';
      scoreP2LabelEl.textContent = 'ROBÔ';
    } else {
      scoreP1LabelEl.textContent = 'JOGADOR 1';
      scoreP2LabelEl.textContent = 'JOGADOR 2';
    }
  }

  function lowestEmptyRow(col){
    for (let r = ROWS - 1; r >= 0; r--){
      if (!board[col][r]) return r;
    }
    return -1;
  }

  function countDir(col, row, dc, dr, player){
    const cells = [];
    let c = col + dc, r = row + dr;
    while (c >= 0 && c < COLS && r >= 0 && r < ROWS && board[c][r] === player){
      cells.push([c, r]);
      c += dc;
      r += dr;
    }
    return cells;
  }

  function checkWinAt(col, row, player){
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (const [dc, dr] of dirs){
      const forward = countDir(col, row, dc, dr, player);
      const backward = countDir(col, row, -dc, -dr, player);
      const line = [[col, row], ...forward, ...backward];
      if (line.length >= 4) return line;
    }
    return null;
  }

  function isBoardFull(){
    return board.every(colArr => colArr.every(v => v));
  }

  // ===== IA do robô: minimax com poda alfa-beta e busca limitada em profundidade
  // (Ligue 4 é grande demais pra resolver por força bruta como o jogo da velha) =====

  function getWinnerOf(bd){
    for (let r = 0; r < ROWS; r++){
      for (let c = 0; c < COLS - 3; c++){
        const a = bd[c][r];
        if (a && a === bd[c + 1][r] && a === bd[c + 2][r] && a === bd[c + 3][r]) return a;
      }
    }
    for (let c = 0; c < COLS; c++){
      for (let r = 0; r < ROWS - 3; r++){
        const a = bd[c][r];
        if (a && a === bd[c][r + 1] && a === bd[c][r + 2] && a === bd[c][r + 3]) return a;
      }
    }
    for (let c = 0; c < COLS - 3; c++){
      for (let r = 0; r < ROWS - 3; r++){
        const a = bd[c][r];
        if (a && a === bd[c + 1][r + 1] && a === bd[c + 2][r + 2] && a === bd[c + 3][r + 3]) return a;
      }
    }
    for (let c = 0; c < COLS - 3; c++){
      for (let r = 3; r < ROWS; r++){
        const a = bd[c][r];
        if (a && a === bd[c + 1][r - 1] && a === bd[c + 2][r - 2] && a === bd[c + 3][r - 3]) return a;
      }
    }
    return null;
  }

  function orderedValidCols(bd){
    return CENTER_ORDER.filter(c => !bd[c][0]);
  }

  function dropSim(bd, col, player){
    const next = bd.map(colArr => colArr.slice());
    for (let r = ROWS - 1; r >= 0; r--){
      if (!next[col][r]){ next[col][r] = player; break; }
    }
    return next;
  }

  function evaluateWindow(window, player, opponent){
    const countP = window.filter(v => v === player).length;
    const countO = window.filter(v => v === opponent).length;
    const countE = window.filter(v => !v).length;
    if (countO === 0){
      if (countP === 3 && countE === 1) return 6;
      if (countP === 2 && countE === 2) return 2;
    }
    if (countP === 0 && countO === 3 && countE === 1) return -8;
    return 0;
  }

  function scoreBoard(bd, player){
    const opponent = player === 'p1' ? 'p2' : 'p1';
    let score = bd[3].filter(v => v === player).length * 3;

    for (let r = 0; r < ROWS; r++){
      for (let c = 0; c < COLS - 3; c++){
        score += evaluateWindow([bd[c][r], bd[c + 1][r], bd[c + 2][r], bd[c + 3][r]], player, opponent);
      }
    }
    for (let c = 0; c < COLS; c++){
      for (let r = 0; r < ROWS - 3; r++){
        score += evaluateWindow([bd[c][r], bd[c][r + 1], bd[c][r + 2], bd[c][r + 3]], player, opponent);
      }
    }
    for (let c = 0; c < COLS - 3; c++){
      for (let r = 0; r < ROWS - 3; r++){
        score += evaluateWindow([bd[c][r], bd[c + 1][r + 1], bd[c + 2][r + 2], bd[c + 3][r + 3]], player, opponent);
      }
    }
    for (let c = 0; c < COLS - 3; c++){
      for (let r = 3; r < ROWS; r++){
        score += evaluateWindow([bd[c][r], bd[c + 1][r - 1], bd[c + 2][r - 2], bd[c + 3][r - 3]], player, opponent);
      }
    }
    return score;
  }

  function minimax(bd, depth, alpha, beta, maximizing, aiPlayer){
    const opponent = aiPlayer === 'p1' ? 'p2' : 'p1';
    const winner = getWinnerOf(bd);
    const valid = orderedValidCols(bd);

    if (winner === aiPlayer) return { score: 10000000 + depth };
    if (winner === opponent) return { score: -10000000 - depth };
    if (valid.length === 0) return { score: 0 };
    if (depth === 0) return { score: scoreBoard(bd, aiPlayer) };

    let bestCol = valid[0];

    if (maximizing){
      let value = -Infinity;
      for (const col of valid){
        const { score } = minimax(dropSim(bd, col, aiPlayer), depth - 1, alpha, beta, false, aiPlayer);
        if (score > value){ value = score; bestCol = col; }
        alpha = Math.max(alpha, value);
        if (alpha >= beta) break;
      }
      return { score: value, col: bestCol };
    }

    let value = Infinity;
    for (const col of valid){
      const { score } = minimax(dropSim(bd, col, opponent), depth - 1, alpha, beta, true, aiPlayer);
      if (score < value){ value = score; bestCol = col; }
      beta = Math.min(beta, value);
      if (alpha >= beta) break;
    }
    return { score: value, col: bestCol };
  }

  function robotMove(){
    if (!active) return;
    const { col } = minimax(board, AI_DEPTH, -Infinity, Infinity, true, 'p2');
    dropAt(col);
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

  function showResult(winner){
    if (winner === 'draw'){
      turnValueEl.textContent = 'EMPATE';
      score.draw++;
      scoreDrawEl.textContent = score.draw;
    } else {
      turnValueEl.textContent = mode === 'cpu'
        ? (winner === 'p1' ? 'VOCÊ VENCEU' : 'ROBÔ VENCEU')
        : (winner === 'p1' ? 'JOGADOR 1' : 'JOGADOR 2') + ' VENCEU';
      score[winner]++;
      (winner === 'p1' ? scoreP1El : scoreP2El).textContent = score[winner];

      // confete só quando tem um humano vencendo de verdade (não quando o robô ganha)
      const isHumanWin = mode !== 'cpu' || winner === 'p1';
      if (isHumanWin) burstConfetti();
    }
  }

  function dropAt(col){
    if (!active) return;
    const row = lowestEmptyRow(col);
    if (row === -1) return;

    board[col][row] = current;
    dropPiece(col, row, current);
    if (window.playClick) window.playClick();

    const winLine = checkWinAt(col, row, current);
    if (winLine){
      active = false;
      columnEls.forEach(c => c.disabled = true);
      const winner = current;
      setTimeout(() => {
        winLine.forEach(([c, r]) => {
          const piece = columnEls[c].querySelector(`.c4-piece[data-row="${r}"]`);
          if (piece) piece.classList.add('win');
        });
        showResult(winner);
      }, 550);
      return;
    }

    if (isBoardFull()){
      active = false;
      columnEls.forEach(c => c.disabled = true);
      setTimeout(() => showResult('draw'), 550);
      return;
    }

    current = current === 'p1' ? 'p2' : 'p1';
    renderTurn();

    if (active && isRobotTurn()){
      setTimeout(robotMove, 450);
    }
  }

  function handleColumnClick(col){
    if (!active || isRobotTurn()) return;
    dropAt(col);
  }

  function dropPiece(col, row, player){
    const colEl = columnEls[col];
    const holes = colEl.querySelectorAll('.c4-hole');
    const piece = document.createElement('div');
    piece.className = 'c4-piece ' + player;
    piece.dataset.row = row;
    piece.style.transition = 'none';
    piece.style.top = (holes[0].offsetTop - holes[0].offsetHeight - 4) + 'px';
    colEl.appendChild(piece);

    void piece.offsetHeight; // força reflow pra animação de queda rodar
    piece.style.transition = '';
    piece.style.top = holes[row].offsetTop + 'px';
  }

  function newGame(){
    active = true;
    current = 'p1';
    buildBoard();
    renderTurn();
  }

  function zeroScore(){
    score.p1 = 0; score.p2 = 0; score.draw = 0;
    scoreP1El.textContent = '0';
    scoreP2El.textContent = '0';
    scoreDrawEl.textContent = '0';
  }

  function setMode(newMode){
    if (newMode === mode) return;
    mode = newMode;
    modeBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
    zeroScore();
    updateLabels();
    newGame();
  }

  function onResetClick(){
    const boardIsEmpty = board.every(colArr => colArr.every(v => !v));
    const hasScore = score.p1 || score.p2 || score.draw;
    if (boardIsEmpty && hasScore){
      confirmOverlay.classList.add('active');
      return;
    }
    newGame();
  }

  resetBtn.addEventListener('click', onResetClick);
  modeBtns.forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)));
  cancelResetBtn.addEventListener('click', () => confirmOverlay.classList.remove('active'));
  confirmResetBtn.addEventListener('click', () => {
    zeroScore();
    confirmOverlay.classList.remove('active');
    newGame();
  });

  newGame();
})();
