(function(){
  const LEVELS = {
    easy: { cols: 8, rows: 8, mines: 10 },
    medium: { cols: 10, rows: 10, mines: 18 },
    hard: { cols: 12, rows: 12, mines: 30 }
  };

  const boardEl = document.getElementById('mineBoard');
  const levelBtns = Array.from(document.querySelectorAll('.mode-btn'));
  const mineCountEl = document.getElementById('mineCount');
  const mineTimerEl = document.getElementById('mineTimer');
  const resetBtn = document.getElementById('resetBtn');
  const scoreWinEl = document.getElementById('scoreWin');
  const scoreLoseEl = document.getElementById('scoreLose');
  const scorePlayedEl = document.getElementById('scorePlayed');
  const mineHelpEl = document.getElementById('mineHelp');
  const DEFAULT_HELP = mineHelpEl.textContent;

  const FLAG_ICON = '<svg class="mine-flag-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="3" x2="5" y2="21"/><path d="M5 4h13l-4 4 4 4H5"/></svg>';
  const MINE_ICON = '<svg class="mine-bomb-icon" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="5" y1="5" x2="7" y2="7"/><line x1="17" y1="17" x2="19" y2="19"/><line x1="19" y1="5" x2="17" y2="7"/><line x1="5" y1="19" x2="7" y2="17"/></g></svg>';

  let level = 'easy';
  let cols, rows, mineCount;
  let board = [];
  let cellEls = [];
  let firstClickDone = false;
  let gameOver = false;
  let revealedCount = 0;
  let flagsPlaced = 0;
  let elapsedSeconds = 0;
  let timerInterval = null;
  const score = { win: 0, lose: 0, played: 0 };

  function attachCellEvents(el, r, c){
    let pressTimer = null;
    let longPressTriggered = false;

    el.addEventListener('click', () => {
      if (longPressTriggered){ longPressTriggered = false; return; }
      handleReveal(r, c);
    });

    el.addEventListener('contextmenu', e => {
      e.preventDefault();
      handleFlagToggle(r, c);
    });

    const cancelPress = () => {
      if (pressTimer){ clearTimeout(pressTimer); pressTimer = null; }
    };

    el.addEventListener('touchstart', () => {
      longPressTriggered = false;
      pressTimer = setTimeout(() => {
        longPressTriggered = true;
        handleFlagToggle(r, c);
        if (navigator.vibrate) navigator.vibrate(15);
      }, 450);
    }, { passive: true });

    el.addEventListener('touchmove', cancelPress, { passive: true });
    el.addEventListener('touchend', e => {
      cancelPress();
      if (longPressTriggered) e.preventDefault();
    });
    el.addEventListener('touchcancel', cancelPress);
  }

  function buildBoard(){
    const preset = LEVELS[level];
    cols = preset.cols; rows = preset.rows; mineCount = preset.mines;

    board = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ mine: false, revealed: false, flagged: false, adjacent: 0, exploded: false }))
    );
    cellEls = Array.from({ length: rows }, () => Array(cols).fill(null));

    boardEl.innerHTML = '';
    boardEl.style.setProperty('--cols', cols);

    for (let r = 0; r < rows; r++){
      const rowEl = document.createElement('div');
      rowEl.className = 'mine-row';
      for (let c = 0; c < cols; c++){
        const cellEl = document.createElement('button');
        cellEl.className = 'mine-cell';
        cellEl.setAttribute('aria-label', 'Casa linha ' + (r + 1) + ' coluna ' + (c + 1));
        attachCellEvents(cellEl, r, c);
        rowEl.appendChild(cellEl);
        cellEls[r][c] = cellEl;
      }
      boardEl.appendChild(rowEl);
    }
  }

  function placeMines(excludeR, excludeC){
    const forbidden = new Set();
    for (let dr = -1; dr <= 1; dr++){
      for (let dc = -1; dc <= 1; dc++){
        const r = excludeR + dr, c = excludeC + dc;
        if (r >= 0 && r < rows && c >= 0 && c < cols) forbidden.add(r + ',' + c);
      }
    }

    let placed = 0;
    while (placed < mineCount){
      const r = Math.floor(Math.random() * rows);
      const c = Math.floor(Math.random() * cols);
      if (forbidden.has(r + ',' + c) || board[r][c].mine) continue;
      board[r][c].mine = true;
      placed++;
    }

    for (let r = 0; r < rows; r++){
      for (let c = 0; c < cols; c++){
        if (board[r][c].mine) continue;
        let count = 0;
        for (let dr = -1; dr <= 1; dr++){
          for (let dc = -1; dc <= 1; dc++){
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc].mine) count++;
          }
        }
        board[r][c].adjacent = count;
      }
    }
  }

  function floodReveal(startR, startC){
    const stack = [[startR, startC]];
    while (stack.length){
      const [r, c] = stack.pop();
      const cell = board[r][c];
      if (cell.revealed || cell.flagged) continue;
      cell.revealed = true;
      revealedCount++;
      renderCell(r, c);
      if (cell.adjacent === 0){
        for (let dr = -1; dr <= 1; dr++){
          for (let dc = -1; dc <= 1; dc++){
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !board[nr][nc].revealed && !board[nr][nc].mine){
              stack.push([nr, nc]);
            }
          }
        }
      }
    }
  }

  function renderCell(r, c){
    const el = cellEls[r][c];
    const cell = board[r][c];
    el.className = 'mine-cell';
    el.innerHTML = '';

    if (cell.revealed){
      el.classList.add('revealed');
      if (cell.mine){
        el.classList.add('mine');
        if (cell.exploded) el.classList.add('exploded');
        el.innerHTML = MINE_ICON;
      } else if (cell.adjacent > 0){
        el.classList.add('n' + cell.adjacent);
        el.textContent = cell.adjacent;
      }
    } else if (cell.flagged){
      el.classList.add('flag');
      el.innerHTML = FLAG_ICON;
    }
  }

  function renderAll(){
    for (let r = 0; r < rows; r++){
      for (let c = 0; c < cols; c++) renderCell(r, c);
    }
  }

  function updateMineCounter(){
    mineCountEl.textContent = String(mineCount - flagsPlaced);
  }

  function updateTimerDisplay(){
    mineTimerEl.textContent = String(Math.min(elapsedSeconds, 999)).padStart(3, '0');
  }

  function startTimer(){
    elapsedSeconds = 0;
    updateTimerDisplay();
    timerInterval = setInterval(() => {
      elapsedSeconds++;
      updateTimerDisplay();
      if (elapsedSeconds >= 999) stopTimer();
    }, 1000);
  }

  function stopTimer(){
    if (timerInterval){ clearInterval(timerInterval); timerInterval = null; }
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

  function loseGame(r, c){
    gameOver = true;
    stopTimer();
    board[r][c].exploded = true;
    for (let rr = 0; rr < rows; rr++){
      for (let cc = 0; cc < cols; cc++){
        if (board[rr][cc].mine) board[rr][cc].revealed = true;
      }
    }
    renderAll();

    score.lose++; score.played++;
    scoreLoseEl.textContent = score.lose;
    scorePlayedEl.textContent = score.played;

    boardEl.classList.add('lost');
    mineHelpEl.textContent = 'Você perdeu — clique em REINICIAR pra jogar de novo.';
    mineHelpEl.classList.add('result-lose');
  }

  function winGame(){
    gameOver = true;
    stopTimer();
    for (let r = 0; r < rows; r++){
      for (let c = 0; c < cols; c++){
        if (board[r][c].mine) board[r][c].flagged = true;
      }
    }
    flagsPlaced = mineCount;
    renderAll();
    updateMineCounter();

    score.win++; score.played++;
    scoreWinEl.textContent = score.win;
    scorePlayedEl.textContent = score.played;

    boardEl.classList.add('won');
    mineHelpEl.textContent = 'Campo limpo em ' + String(elapsedSeconds).padStart(3, '0') + 's! Clique em REINICIAR pra jogar de novo.';
    mineHelpEl.classList.add('result-win');
    burstConfetti();
  }

  function checkWin(){
    if (revealedCount >= rows * cols - mineCount) winGame();
  }

  function handleReveal(r, c){
    if (gameOver) return;
    const cell = board[r][c];
    if (cell.flagged || cell.revealed) return;

    if (!firstClickDone){
      placeMines(r, c);
      firstClickDone = true;
      startTimer();
    }

    if (window.playClick) window.playClick(700);

    if (cell.mine){
      loseGame(r, c);
      return;
    }

    floodReveal(r, c);
    checkWin();
  }

  function handleFlagToggle(r, c){
    if (gameOver) return;
    const cell = board[r][c];
    if (cell.revealed) return;
    cell.flagged = !cell.flagged;
    flagsPlaced += cell.flagged ? 1 : -1;
    renderCell(r, c);
    updateMineCounter();
    if (window.playClick) window.playClick(cell.flagged ? 420 : 500);
  }

  function newGame(){
    stopTimer();
    gameOver = false;
    firstClickDone = false;
    elapsedSeconds = 0;
    flagsPlaced = 0;
    revealedCount = 0;
    buildBoard();
    updateTimerDisplay();
    updateMineCounter();
    boardEl.classList.remove('won', 'lost');
    mineHelpEl.classList.remove('result-win', 'result-lose');
    mineHelpEl.textContent = DEFAULT_HELP;
  }

  function zeroScore(){
    score.win = 0; score.lose = 0; score.played = 0;
    scoreWinEl.textContent = '0';
    scoreLoseEl.textContent = '0';
    scorePlayedEl.textContent = '0';
  }

  function setLevel(newLevel){
    if (newLevel === level) return;
    level = newLevel;
    levelBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.level === level));
    zeroScore();
    newGame();
  }

  resetBtn.addEventListener('click', newGame);
  levelBtns.forEach(btn => btn.addEventListener('click', () => setLevel(btn.dataset.level)));

  newGame();
})();
