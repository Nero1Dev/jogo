(function(){
  // ============================================================
  // MOTOR DE DAMAS — regras internacionais (FMJD, tabuleiro 10x10):
  // captura obrigatória com maioria (deve escolher a sequência que
  // captura mais peças), peça comum captura pra frente e pra trás,
  // dama se move e captura "voando" qualquer número de casas na
  // diagonal.
  // ============================================================
  try {

  const BOARD_SIZE = 10;
  const DIAGS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const MAN_FORWARD = { w: [[-1, -1], [-1, 1]], b: [[1, -1], [1, 1]] };
  const NO_CAPTURE_LIMIT = 50;
  const MEN_ROWS = 4; // linhas de peças de cada lado na formação inicial

  function inBounds(r, c){ return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE; }
  function darkSquare(r, c){ return (r + c) % 2 === 1; }

  function initialBoard(){
    const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
    for (let r = 0; r < BOARD_SIZE; r++){
      for (let c = 0; c < BOARD_SIZE; c++){
        if (!darkSquare(r, c)) continue;
        if (r < MEN_ROWS) board[r][c] = { color: 'b', king: false };
        else if (r >= BOARD_SIZE - MEN_ROWS) board[r][c] = { color: 'w', king: false };
      }
    }
    return board;
  }

  function cloneBoard(board){
    return board.map(row => row.map(p => p ? { ...p } : null));
  }

  function initialState(){
    return { board: initialBoard(), turn: 'w', noCaptureCount: 0 };
  }

  function alreadyCaptured(captured, r, c){
    return captured.some(p => p.row === r && p.col === c);
  }

  // ---- gera todas as sequências de captura MAXIMAIS a partir de uma peça ----

  function captureSequencesFrom(board, r, c, piece, path, captured){
    const results = [];

    if (piece.king){
      for (const [dr, dc] of DIAGS){
        let nr = r + dr, nc = c + dc;
        while (inBounds(nr, nc) && board[nr][nc] === null){ nr += dr; nc += dc; }
        if (!inBounds(nr, nc) || !board[nr][nc]) continue;
        if (board[nr][nc].color === piece.color || alreadyCaptured(captured, nr, nc)) continue;

        let lr = nr + dr, lc = nc + dc;
        while (inBounds(lr, lc) && board[lr][lc] === null){
          const newBoard = cloneBoard(board);
          newBoard[r][c] = null;
          newBoard[nr][nc] = null;
          newBoard[lr][lc] = piece;
          const newCaptured = [...captured, { row: nr, col: nc }];
          const newPath = [...path, { row: lr, col: lc }];
          const subs = captureSequencesFrom(newBoard, lr, lc, piece, newPath, newCaptured);
          if (subs.length) results.push(...subs);
          else results.push({ from: path[0], to: { row: lr, col: lc }, path: newPath, captured: newCaptured });
          lr += dr; lc += dc;
        }
      }
    } else {
      for (const [dr, dc] of DIAGS){
        const mr = r + dr, mc = c + dc;
        const lr = r + 2 * dr, lc = c + 2 * dc;
        if (!inBounds(lr, lc) || board[lr][lc] !== null) continue;
        const mid = board[mr] ? board[mr][mc] : null;
        if (!mid || mid.color === piece.color || alreadyCaptured(captured, mr, mc)) continue;

        const newBoard = cloneBoard(board);
        newBoard[r][c] = null;
        newBoard[mr][mc] = null;
        newBoard[lr][lc] = piece;
        const newCaptured = [...captured, { row: mr, col: mc }];
        const newPath = [...path, { row: lr, col: lc }];
        const subs = captureSequencesFrom(newBoard, lr, lc, piece, newPath, newCaptured);
        if (subs.length) results.push(...subs);
        else results.push({ from: path[0], to: { row: lr, col: lc }, path: newPath, captured: newCaptured });
      }
    }

    return results;
  }

  function simpleMovesFrom(board, r, c, piece){
    const moves = [];
    if (piece.king){
      for (const [dr, dc] of DIAGS){
        let nr = r + dr, nc = c + dc;
        while (inBounds(nr, nc) && board[nr][nc] === null){
          moves.push({ from: { row: r, col: c }, to: { row: nr, col: nc }, captured: [] });
          nr += dr; nc += dc;
        }
      }
    } else {
      for (const [dr, dc] of MAN_FORWARD[piece.color]){
        const nr = r + dr, nc = c + dc;
        if (inBounds(nr, nc) && board[nr][nc] === null){
          moves.push({ from: { row: r, col: c }, to: { row: nr, col: nc }, captured: [] });
        }
      }
    }
    return moves;
  }

  function allLegalMoves(state, color){
    const board = state.board;
    const captureMoves = [];
    const simpleMoves = [];

    for (let r = 0; r < BOARD_SIZE; r++){
      for (let c = 0; c < BOARD_SIZE; c++){
        const piece = board[r][c];
        if (!piece || piece.color !== color) continue;
        captureMoves.push(...captureSequencesFrom(board, r, c, piece, [{ row: r, col: c }], []));
        simpleMoves.push(...simpleMovesFrom(board, r, c, piece));
      }
    }

    if (captureMoves.length){
      const maxCap = Math.max(...captureMoves.map(m => m.captured.length));
      return captureMoves.filter(m => m.captured.length === maxCap);
    }
    return simpleMoves;
  }

  function applyMove(state, move){
    const board = cloneBoard(state.board);
    const piece = board[move.from.row][move.from.col];
    board[move.from.row][move.from.col] = null;
    for (const cap of move.captured) board[cap.row][cap.col] = null;

    let king = piece.king;
    const lastRow = piece.color === 'w' ? 0 : BOARD_SIZE - 1;
    if (!king && move.to.row === lastRow) king = true;
    board[move.to.row][move.to.col] = { color: piece.color, king };

    return {
      board,
      turn: state.turn === 'w' ? 'b' : 'w',
      noCaptureCount: move.captured.length ? 0 : state.noCaptureCount + 1
    };
  }

  function getStatus(state){
    const moves = allLegalMoves(state, state.turn);
    if (moves.length === 0){
      return { type: 'nomoves', winner: state.turn === 'w' ? 'b' : 'w' };
    }
    if (state.noCaptureCount >= NO_CAPTURE_LIMIT) return { type: 'draw-nocapture' };
    return { type: 'ongoing' };
  }

  // ============================================================
  // ROBÔ — negamax com poda alfa-beta. Avaliação por material
  // (dama vale mais que peça comum) + avanço + controle do centro.
  // Busca rasa pra não travar o navegador: nível iniciante/intermediário.
  // ============================================================

  const MATE_SCORE = 100000;
  const SEARCH_DEPTH = 6;
  const MAN_VALUE = 100;
  const KING_VALUE = 175;
  const CENTER_LO = Math.floor(BOARD_SIZE / 2) - 2;
  const CENTER_HI = Math.floor(BOARD_SIZE / 2) + 1;

  function evaluate(state){
    const board = state.board;
    let score = 0;
    for (let r = 0; r < BOARD_SIZE; r++){
      for (let c = 0; c < BOARD_SIZE; c++){
        const piece = board[r][c];
        if (!piece) continue;
        let value = piece.king ? KING_VALUE : MAN_VALUE;
        if (!piece.king){
          const advance = piece.color === 'w' ? (BOARD_SIZE - 1 - r) : r;
          value += advance * 4;
        }
        if (c >= CENTER_LO && c <= CENTER_HI) value += 4;
        score += piece.color === 'w' ? value : -value;
      }
    }
    return state.turn === 'w' ? score : -score;
  }

  function orderMoves(moves){
    return moves.slice().sort((a, b) => b.captured.length - a.captured.length);
  }

  function negamax(state, depth, alpha, beta){
    const moves = allLegalMoves(state, state.turn);
    if (moves.length === 0) return -MATE_SCORE - depth;
    if (depth === 0) return evaluate(state);

    let best = -Infinity;
    for (const move of orderMoves(moves)){
      const next = applyMove(state, move);
      const score = -negamax(next, depth - 1, -beta, -alpha);
      if (score > best) best = score;
      alpha = Math.max(alpha, score);
      if (alpha >= beta) break;
    }
    return best;
  }

  function findBestMove(state){
    const moves = orderMoves(allLegalMoves(state, state.turn));
    let bestMove = moves[0];
    let bestScore = -Infinity;
    let alpha = -Infinity;
    const beta = Infinity;
    for (const move of moves){
      const next = applyMove(state, move);
      const score = -negamax(next, SEARCH_DEPTH - 1, -beta, -alpha);
      if (score > bestScore){ bestScore = score; bestMove = move; }
      alpha = Math.max(alpha, score);
    }
    return bestMove;
  }

  // ============================================================
  // INTERFACE
  // ============================================================

  const boardEl = document.getElementById('damasBoard');
  const turnValueEl = document.getElementById('turnValue');
  const turnDotEl = document.getElementById('turnDot');
  const resetBtn = document.getElementById('resetBtn');
  const modeBtns = Array.from(document.querySelectorAll('.mode-btn'));
  const scoreWEl = document.getElementById('scoreW');
  const scoreBEl = document.getElementById('scoreB');
  const scoreDrawEl = document.getElementById('scoreDraw');
  const scoreWLabelEl = document.getElementById('scoreWLabel');
  const scoreBLabelEl = document.getElementById('scoreBLabel');
  const confirmOverlay = document.getElementById('confirmOverlay');
  const cancelResetBtn = document.getElementById('cancelResetBtn');
  const confirmResetBtn = document.getElementById('confirmResetBtn');

  const squareEls = [];
  let state = initialState();
  let selected = null;
  let legalTargets = []; // lances legais (possivelmente com captura em cadeia) da peça selecionada
  let lastMove = null;
  let moveCount = 0;
  let mode = 'pvp';
  let gameOver = false;
  const score = { w: 0, b: 0, draw: 0 };

  function isRobotTurn(){
    return mode === 'cpu' && state.turn === 'b';
  }

  function buildBoard(){
    boardEl.innerHTML = '';
    squareEls.length = 0;
    for (let r = 0; r < BOARD_SIZE; r++){
      const rowEl = document.createElement('div');
      rowEl.className = 'chess-row';
      const rowEls = [];
      for (let c = 0; c < BOARD_SIZE; c++){
        const sq = document.createElement('button');
        sq.className = 'chess-sq' + ((r + c) % 2 ? ' dark' : '');
        sq.dataset.row = r;
        sq.dataset.col = c;
        if (!darkSquare(r, c)) sq.disabled = true;
        sq.addEventListener('click', () => handleSquareClick(r, c));
        rowEl.appendChild(sq);
        rowEls.push(sq);
      }
      boardEl.appendChild(rowEl);
      squareEls.push(rowEls);
    }
  }

  function render(){
    for (let r = 0; r < BOARD_SIZE; r++){
      for (let c = 0; c < BOARD_SIZE; c++){
        const sq = squareEls[r][c];
        const piece = state.board[r][c];
        sq.innerHTML = '';
        sq.classList.toggle('selected', !!selected && selected.row === r && selected.col === c);
        sq.classList.toggle('last-move', !!lastMove && (
          (lastMove.from.row === r && lastMove.from.col === c) ||
          (lastMove.to.row === r && lastMove.to.col === c)
        ));

        if (piece){
          const span = document.createElement('span');
          span.className = 'dama-piece ' + piece.color + (piece.king ? ' king' : '');
          sq.appendChild(span);
        }

        const target = legalTargets.find(m => m.to.row === r && m.to.col === c);
        if (target){
          const marker = document.createElement('span');
          marker.className = target.captured.length ? 'legal-capture' : 'legal-dot';
          sq.appendChild(marker);
        }
      }
    }

    turnValueEl.textContent = mode === 'cpu'
      ? (state.turn === 'w' ? 'VOCÊ' : 'ROBÔ')
      : (state.turn === 'w' ? 'BRANCAS' : 'PRETAS');
    turnDotEl.classList.toggle('b', state.turn === 'b');
  }

  function updateLabels(){
    if (mode === 'cpu'){
      scoreWLabelEl.textContent = 'VOCÊ';
      scoreBLabelEl.textContent = 'ROBÔ';
    } else {
      scoreWLabelEl.textContent = 'BRANCAS';
      scoreBLabelEl.textContent = 'PRETAS';
    }
  }

  function clearSelection(){
    selected = null;
    legalTargets = [];
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

  function statusLabels(status){
    switch (status.type){
      case 'nomoves': return {
        text: mode === 'cpu'
          ? (status.winner === 'w' ? 'VOCÊ VENCEU' : 'ROBÔ VENCEU')
          : (status.winner === 'w' ? 'BRANCAS' : 'PRETAS') + ' VENCERAM'
      };
      case 'draw-nocapture': return { text: 'EMPATE — 40 LANCES SEM CAPTURA' };
      default: return null;
    }
  }

  function finishTurn(status){
    render();
    const labels = statusLabels(status);
    if (!labels) return;

    gameOver = true;
    turnValueEl.textContent = labels.text;

    if (status.type === 'nomoves'){
      score[status.winner]++;
      (status.winner === 'w' ? scoreWEl : scoreBEl).textContent = score[status.winner];
      // confete só quando tem um humano vencendo de verdade (não quando o robô ganha)
      const isHumanWin = mode !== 'cpu' || status.winner === 'w';
      if (isHumanWin) burstConfetti();
    } else {
      score.draw++;
      scoreDrawEl.textContent = score.draw;
    }
  }

  function completeMove(move){
    if (window.playClick) window.playClick();
    state = applyMove(state, move);
    lastMove = move;
    moveCount++;
    clearSelection();
    const status = getStatus(state);
    finishTurn(status);

    if (status.type === 'ongoing' && isRobotTurn()){
      setTimeout(robotMove, 350);
    }
  }

  function robotMove(){
    if (!isRobotTurn() || gameOver) return;
    const move = findBestMove(state);
    completeMove(move);
  }

  function handleSquareClick(row, col){
    if (gameOver) return;
    if (isRobotTurn()) return;

    const piece = state.board[row][col];

    if (selected){
      const move = legalTargets.find(m => m.to.row === row && m.to.col === col);
      if (move){
        completeMove(move);
        return;
      }
    }

    if (piece && piece.color === state.turn){
      const allMoves = allLegalMoves(state, state.turn);
      const pieceMoves = allMoves.filter(m => m.from.row === row && m.from.col === col);
      if (pieceMoves.length){
        selected = { row, col };
        legalTargets = pieceMoves;
        render();
        return;
      }
    }

    clearSelection();
    render();
  }

  function newGame(){
    state = initialState();
    clearSelection();
    lastMove = null;
    moveCount = 0;
    gameOver = false;
    buildBoard();
    render();
  }

  function zeroScore(){
    score.w = 0; score.b = 0; score.draw = 0;
    scoreWEl.textContent = '0';
    scoreBEl.textContent = '0';
    scoreDrawEl.textContent = '0';
  }

  function onResetClick(){
    const gameIsFresh = moveCount === 0;
    const hasScore = score.w || score.b || score.draw;
    if (gameIsFresh && hasScore){
      confirmOverlay.classList.add('active');
      return;
    }
    newGame();
  }

  function setMode(newMode){
    if (newMode === mode) return;
    mode = newMode;
    modeBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
    zeroScore();
    updateLabels();
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

  buildBoard();
  render();

  } catch (err){
    console.error(err);
    const boardEl = document.getElementById('damasBoard');
    if (boardEl){
      boardEl.style.cssText = 'display:block;width:100%;padding:16px;border:1px solid rgba(168,70,43,0.5);border-radius:8px;';
      boardEl.textContent = 'Erro ao carregar as damas: ' + err.message;
    }
  }
})();
