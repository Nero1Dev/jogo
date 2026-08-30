(function(){
  const WIN_LINES = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];

  const boardEl = document.getElementById('board');
  const cells = Array.from(boardEl.querySelectorAll('.cell'));
  const turnValueEl = document.getElementById('turnValue');
  const turnLabelEl = document.getElementById('turnLabel');
  const resetBtn = document.getElementById('resetBtn');
  const modeBtns = Array.from(document.querySelectorAll('.mode-btn'));
  const scoreXEl = document.getElementById('scoreX');
  const scoreOEl = document.getElementById('scoreO');
  const scoreDrawEl = document.getElementById('scoreDraw');
  const scoreXLabelEl = document.getElementById('scoreXLabel');
  const scoreOLabelEl = document.getElementById('scoreOLabel');
  const confirmOverlay = document.getElementById('confirmOverlay');
  const cancelResetBtn = document.getElementById('cancelResetBtn');
  const confirmResetBtn = document.getElementById('confirmResetBtn');

  let board = Array(9).fill(null);
  let current = 'X';
  let active = true;
  let mode = 'pvp'; // 'pvp' ou 'cpu' — no modo cpu, humano é sempre X e robô é sempre O
  // quem começa a próxima partida: sempre X na primeira; depois, quem perdeu;
  // em caso de empate, intercala em relação a quem começou a partida empatada
  let gameStarter = 'X';
  const score = { X: 0, O: 0, draw: 0 };

  function winnerOf(bd){
    for (const [a,b,c] of WIN_LINES){
      if (bd[a] && bd[a] === bd[b] && bd[a] === bd[c]) return bd[a];
    }
    return null;
  }

  function render(){
    cells.forEach((cell, i) => {
      const v = board[i];
      const isRobotTurn = mode === 'cpu' && current === 'O';
      cell.textContent = v || '';
      cell.classList.toggle('x', v === 'X');
      cell.classList.toggle('o', v === 'O');
      cell.disabled = !!v || !active || isRobotTurn;
      cell.dataset.preview = active && !isRobotTurn ? current : '';
    });
    turnValueEl.textContent = mode === 'cpu' ? (current === 'X' ? 'VOCÊ' : 'ROBÔ') : current;
    turnValueEl.classList.toggle('is-o', current === 'O');
  }

  function updateLabels(){
    if (mode === 'cpu'){
      scoreXLabelEl.textContent = 'VITÓRIAS VOCÊ';
      scoreOLabelEl.textContent = 'VITÓRIAS ROBÔ';
    } else {
      scoreXLabelEl.textContent = 'VITÓRIAS X';
      scoreOLabelEl.textContent = 'VITÓRIAS O';
    }
  }

  function checkEnd(){
    const w = winnerOf(board);
    if (w) return { winner: w, line: WIN_LINES.find(([a,b,c]) => board[a] === w && board[b] === w && board[c] === w) };
    if (board.every(v => v)) return { winner: 'draw', line: [] };
    return null;
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
    turnLabelEl.textContent = 'RESULTADO';
    if (winner === 'draw'){
      turnValueEl.textContent = 'EMPATE';
      score.draw++;
      scoreDrawEl.textContent = score.draw;
    } else {
      turnValueEl.textContent = mode === 'cpu'
        ? (winner === 'X' ? 'VOCÊ VENCEU' : 'ROBÔ VENCEU')
        : winner + ' VENCEU';
      score[winner]++;
      (winner === 'X' ? scoreXEl : scoreOEl).textContent = score[winner];

      // confete só quando tem um humano vencendo de verdade (não quando o robô ganha)
      const isHumanWin = mode !== 'cpu' || winner === 'X';
      if (isHumanWin) burstConfetti();
    }
  }

  function playMove(i){
    board[i] = current;
    if (window.playClick) window.playClick();
    const result = checkEnd();

    if (result){
      active = false;
      if (result.line.length){
        result.line.forEach(idx => cells[idx].classList.add('win'));
      }
      gameStarter = result.winner === 'draw'
        ? (gameStarter === 'X' ? 'O' : 'X') // empate: intercala quem começou
        : (result.winner === 'X' ? 'O' : 'X'); // vitória: quem perdeu começa a próxima
      render();
      setTimeout(() => showResult(result.winner), 450);
      return;
    }

    current = current === 'X' ? 'O' : 'X';
    render();

    if (active && mode === 'cpu' && current === 'O'){
      setTimeout(robotMove, 500);
    }
  }

  // Minimax: joga perfeitamente como 'O' (nunca perde)
  function minimax(bd, player){
    const w = winnerOf(bd);
    if (w === 'O') return { score: 10 };
    if (w === 'X') return { score: -10 };
    if (bd.every(v => v)) return { score: 0 };

    const results = [];
    bd.forEach((v, i) => {
      if (v) return;
      const next = bd.slice();
      next[i] = player;
      const outcome = minimax(next, player === 'O' ? 'X' : 'O');
      results.push({ index: i, score: outcome.score });
    });

    return player === 'O'
      ? results.reduce((best, r) => r.score > best.score ? r : best)
      : results.reduce((best, r) => r.score < best.score ? r : best);
  }

  function robotMove(){
    if (!active) return;
    const best = minimax(board.slice(), 'O');
    playMove(best.index);
  }

  function handleClick(e){
    if (!active) return;
    if (mode === 'cpu' && current === 'O') return;
    const i = Number(e.currentTarget.dataset.i);
    if (board[i]) return;
    playMove(i);
  }

  function newGame(){
    board = Array(9).fill(null);
    current = gameStarter;
    active = true;
    cells.forEach(c => c.classList.remove('win'));
    turnLabelEl.textContent = 'VEZ DE';
    render();

    if (active && mode === 'cpu' && current === 'O'){
      setTimeout(robotMove, 500);
    }
  }

  function zeroScore(){
    score.X = 0; score.O = 0; score.draw = 0;
    scoreXEl.textContent = '0';
    scoreOEl.textContent = '0';
    scoreDrawEl.textContent = '0';
    gameStarter = 'X';
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
    const boardIsEmpty = board.every(v => !v);
    const hasScore = score.X || score.O || score.draw;
    if (boardIsEmpty && hasScore){
      confirmOverlay.classList.add('active');
      return;
    }
    newGame();
  }

  cells.forEach(cell => cell.addEventListener('click', handleClick));
  resetBtn.addEventListener('click', onResetClick);
  modeBtns.forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)));
  cancelResetBtn.addEventListener('click', () => confirmOverlay.classList.remove('active'));
  confirmResetBtn.addEventListener('click', () => {
    zeroScore();
    confirmOverlay.classList.remove('active');
    newGame();
  });

  render();
})();
