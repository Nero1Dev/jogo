(function(){
  // ============================================================
  // MOTOR DE XADREZ — regras completas (roque, en passant, promoção,
  // xeque/xeque-mate, afogamento, material insuficiente, repetição
  // tripla e regra dos 50 lances). Sem robô: 2 jogadores no mesmo
  // aparelho, seleção por clique.
  // ============================================================
  try {

  const FILES = 'abcdefgh';
  const PIECE_GLYPH = {
    k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟'
  };

  function initialBoard(){
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    const backRank = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
    for (let c = 0; c < 8; c++){
      board[0][c] = { type: backRank[c], color: 'b' };
      board[1][c] = { type: 'p', color: 'b' };
      board[6][c] = { type: 'p', color: 'w' };
      board[7][c] = { type: backRank[c], color: 'w' };
    }
    return board;
  }

  function cloneBoard(board){
    return board.map(row => row.slice());
  }

  function squareName(row, col){
    return FILES[col] + (8 - row);
  }

  function positionKey(state){
    const boardKey = state.board.map(row => row.map(p => p ? p.color + p.type : '.').join('')).join('/');
    return boardKey + '|' + state.turn + '|' +
      (state.castling.wK ? 'K' : '') + (state.castling.wQ ? 'Q' : '') +
      (state.castling.bK ? 'k' : '') + (state.castling.bQ ? 'q' : '') + '|' +
      (state.enPassant ? state.enPassant.row + ',' + state.enPassant.col : '-');
  }

  function initialState(){
    const state = {
      board: initialBoard(),
      turn: 'w',
      castling: { wK: true, wQ: true, bK: true, bQ: true },
      enPassant: null,
      halfmoveClock: 0,
      history: []
    };
    state.history.push(positionKey(state));
    return state;
  }

  // ---- geração de "quadrados atacados" (simples, sem roque — usada só pra detectar xeque) ----

  function attackSquares(board, row, col){
    const piece = board[row][col];
    if (!piece) return [];
    const squares = [];

    if (piece.type === 'p'){
      const dir = piece.color === 'w' ? -1 : 1;
      for (const dc of [-1, 1]){
        const nr = row + dir, nc = col + dc;
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) squares.push({ row: nr, col: nc });
      }
    } else if (piece.type === 'n'){
      const offsets = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
      for (const [dr, dc] of offsets){
        const nr = row + dr, nc = col + dc;
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) squares.push({ row: nr, col: nc });
      }
    } else if (piece.type === 'k'){
      for (let dr = -1; dr <= 1; dr++){
        for (let dc = -1; dc <= 1; dc++){
          if (dr === 0 && dc === 0) continue;
          const nr = row + dr, nc = col + dc;
          if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) squares.push({ row: nr, col: nc });
        }
      }
    } else {
      const dirs = piece.type === 'b'
        ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
        : piece.type === 'r'
        ? [[-1, 0], [1, 0], [0, -1], [0, 1]]
        : [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of dirs){
        let nr = row + dr, nc = col + dc;
        while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8){
          squares.push({ row: nr, col: nc });
          if (board[nr][nc]) break;
          nr += dr; nc += dc;
        }
      }
    }
    return squares;
  }

  function isSquareAttacked(board, row, col, byColor){
    for (let r = 0; r < 8; r++){
      for (let c = 0; c < 8; c++){
        const p = board[r][c];
        if (p && p.color === byColor){
          if (attackSquares(board, r, c).some(s => s.row === row && s.col === col)) return true;
        }
      }
    }
    return false;
  }

  function findKing(board, color){
    for (let r = 0; r < 8; r++){
      for (let c = 0; c < 8; c++){
        const p = board[r][c];
        if (p && p.type === 'k' && p.color === color) return { row: r, col: c };
      }
    }
    return null;
  }

  function isInCheck(board, color){
    const k = findKing(board, color);
    if (!k) return false;
    return isSquareAttacked(board, k.row, k.col, color === 'w' ? 'b' : 'w');
  }

  // ---- geração de lances pseudo-legais (inclui roque e en passant) ----

  function slideMoves(board, row, col, piece, dirs, moves){
    const opp = piece.color === 'w' ? 'b' : 'w';
    for (const [dr, dc] of dirs){
      let nr = row + dr, nc = col + dc;
      while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8){
        const target = board[nr][nc];
        if (!target){
          moves.push({ from: { row, col }, to: { row: nr, col: nc } });
        } else {
          if (target.color === opp) moves.push({ from: { row, col }, to: { row: nr, col: nc } });
          break;
        }
        nr += dr; nc += dc;
      }
    }
  }

  function pushPawnMove(row, col, tr, tc, promoRow, moves){
    const move = { from: { row, col }, to: { row: tr, col: tc } };
    if (tr === promoRow) move.needsPromotion = true;
    moves.push(move);
  }

  function pseudoLegalMoves(state, row, col){
    const board = state.board;
    const piece = board[row][col];
    if (!piece) return [];
    const opp = piece.color === 'w' ? 'b' : 'w';
    const moves = [];

    if (piece.type === 'p'){
      const dir = piece.color === 'w' ? -1 : 1;
      const startRow = piece.color === 'w' ? 6 : 1;
      const promoRow = piece.color === 'w' ? 0 : 7;

      if (row + dir >= 0 && row + dir < 8 && !board[row + dir][col]){
        pushPawnMove(row, col, row + dir, col, promoRow, moves);
        if (row === startRow && !board[row + 2 * dir][col]){
          moves.push({ from: { row, col }, to: { row: row + 2 * dir, col } });
        }
      }
      for (const dc of [-1, 1]){
        const nr = row + dir, nc = col + dc;
        if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) continue;
        const target = board[nr][nc];
        if (target && target.color === opp){
          pushPawnMove(row, col, nr, nc, promoRow, moves);
        } else if (state.enPassant && state.enPassant.row === nr && state.enPassant.col === nc){
          moves.push({ from: { row, col }, to: { row: nr, col: nc }, isEnPassant: true });
        }
      }
    } else if (piece.type === 'n'){
      const offsets = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
      for (const [dr, dc] of offsets){
        const nr = row + dr, nc = col + dc;
        if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) continue;
        const target = board[nr][nc];
        if (!target || target.color === opp) moves.push({ from: { row, col }, to: { row: nr, col: nc } });
      }
    } else if (piece.type === 'b'){
      slideMoves(board, row, col, piece, [[-1, -1], [-1, 1], [1, -1], [1, 1]], moves);
    } else if (piece.type === 'r'){
      slideMoves(board, row, col, piece, [[-1, 0], [1, 0], [0, -1], [0, 1]], moves);
    } else if (piece.type === 'q'){
      slideMoves(board, row, col, piece, [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]], moves);
    } else if (piece.type === 'k'){
      for (let dr = -1; dr <= 1; dr++){
        for (let dc = -1; dc <= 1; dc++){
          if (dr === 0 && dc === 0) continue;
          const nr = row + dr, nc = col + dc;
          if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) continue;
          const target = board[nr][nc];
          if (!target || target.color === opp) moves.push({ from: { row, col }, to: { row: nr, col: nc } });
        }
      }
      const homeRow = piece.color === 'w' ? 7 : 0;
      if (row === homeRow && col === 4 && !isInCheck(board, piece.color)){
        const kRight = piece.color === 'w' ? state.castling.wK : state.castling.bK;
        if (kRight && !board[homeRow][5] && !board[homeRow][6] &&
            !isSquareAttacked(board, homeRow, 5, opp) && !isSquareAttacked(board, homeRow, 6, opp)){
          moves.push({ from: { row, col }, to: { row: homeRow, col: 6 }, isCastle: 'K' });
        }
        const qRight = piece.color === 'w' ? state.castling.wQ : state.castling.bQ;
        if (qRight && !board[homeRow][1] && !board[homeRow][2] && !board[homeRow][3] &&
            !isSquareAttacked(board, homeRow, 2, opp) && !isSquareAttacked(board, homeRow, 3, opp)){
          moves.push({ from: { row, col }, to: { row: homeRow, col: 2 }, isCastle: 'Q' });
        }
      }
    }
    return moves;
  }

  // ---- aplica um lance (assume que já é legal) ----

  function applyMoveRaw(state, move){
    const board = cloneBoard(state.board);
    const piece = board[move.from.row][move.from.col];
    const captured = board[move.to.row][move.to.col];
    let enPassant = null;
    let halfmoveClock = state.halfmoveClock + 1;

    if (move.isEnPassant){
      board[move.from.row][move.to.col] = null;
    }

    board[move.to.row][move.to.col] = move.promotion
      ? { type: move.promotion, color: piece.color }
      : piece;
    board[move.from.row][move.from.col] = null;

    if (move.isCastle === 'K'){
      const r = move.from.row;
      board[r][5] = board[r][7];
      board[r][7] = null;
    } else if (move.isCastle === 'Q'){
      const r = move.from.row;
      board[r][3] = board[r][0];
      board[r][0] = null;
    }

    if (piece.type === 'p' || captured || move.isEnPassant) halfmoveClock = 0;

    if (piece.type === 'p' && Math.abs(move.to.row - move.from.row) === 2){
      enPassant = { row: (move.from.row + move.to.row) / 2, col: move.from.col };
    }

    const castling = { ...state.castling };
    if (piece.type === 'k'){
      if (piece.color === 'w'){ castling.wK = false; castling.wQ = false; }
      else { castling.bK = false; castling.bQ = false; }
    }
    if (move.from.row === 7 && move.from.col === 0) castling.wQ = false;
    if (move.from.row === 7 && move.from.col === 7) castling.wK = false;
    if (move.from.row === 0 && move.from.col === 0) castling.bQ = false;
    if (move.from.row === 0 && move.from.col === 7) castling.bK = false;
    if (move.to.row === 7 && move.to.col === 0) castling.wQ = false;
    if (move.to.row === 7 && move.to.col === 7) castling.wK = false;
    if (move.to.row === 0 && move.to.col === 0) castling.bQ = false;
    if (move.to.row === 0 && move.to.col === 7) castling.bK = false;

    return {
      board,
      turn: state.turn === 'w' ? 'b' : 'w',
      castling,
      enPassant,
      halfmoveClock,
      history: state.history
    };
  }

  function makeMove(state, move){
    const next = applyMoveRaw(state, move);
    next.history = [...state.history, positionKey(next)];
    return next;
  }

  // ---- filtra lances legais (não pode deixar o próprio rei em xeque) ----

  function legalMovesFrom(state, row, col){
    const piece = state.board[row][col];
    if (!piece || piece.color !== state.turn) return [];
    const pseudo = pseudoLegalMoves(state, row, col);
    return pseudo.filter(m => {
      const sim = m.needsPromotion ? { ...m, promotion: 'q' } : m;
      const next = applyMoveRaw(state, sim);
      return !isInCheck(next.board, piece.color);
    });
  }

  function allLegalMoves(state, color){
    const all = [];
    for (let r = 0; r < 8; r++){
      for (let c = 0; c < 8; c++){
        const p = state.board[r][c];
        if (p && p.color === color) all.push(...legalMovesFrom(state, r, c));
      }
    }
    return all;
  }

  function insufficientMaterial(board){
    const pieces = [];
    for (let r = 0; r < 8; r++){
      for (let c = 0; c < 8; c++){
        const p = board[r][c];
        if (p && p.type !== 'k') pieces.push(p);
      }
    }
    if (pieces.length === 0) return true;
    if (pieces.length === 1 && (pieces[0].type === 'b' || pieces[0].type === 'n')) return true;
    return false;
  }

  function isThreefoldRepetition(state){
    const key = state.history[state.history.length - 1];
    return state.history.filter(k => k === key).length >= 3;
  }

  function getStatus(state){
    const color = state.turn;
    const inCheck = isInCheck(state.board, color);
    const moves = allLegalMoves(state, color);
    if (moves.length === 0){
      return inCheck ? { type: 'checkmate', winner: color === 'w' ? 'b' : 'w' } : { type: 'stalemate' };
    }
    if (state.halfmoveClock >= 100) return { type: 'draw-50' };
    if (insufficientMaterial(state.board)) return { type: 'draw-material' };
    if (isThreefoldRepetition(state)) return { type: 'draw-repetition' };
    return inCheck ? { type: 'check' } : { type: 'ongoing' };
  }

  // ============================================================
  // ROBÔ — minimax (negamax) com poda alfa-beta, avaliação por
  // material + tabela de posição por peça. Busca rasa (3 lances)
  // pra não travar o navegador: joga em nível iniciante/intermediário,
  // não é um motor forte.
  // ============================================================

  const MATE_SCORE = 100000;
  const SEARCH_DEPTH = 3;

  const PIECE_VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

  // tabelas dadas da perspectiva das brancas (linha 0 = fileira 8);
  // pra pretas espelha a linha (7 - linha)
  const PST = {
    p: [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [50, 50, 50, 50, 50, 50, 50, 50],
      [10, 10, 20, 30, 30, 20, 10, 10],
      [5, 5, 10, 25, 25, 10, 5, 5],
      [0, 0, 0, 20, 20, 0, 0, 0],
      [5, -5, -10, 0, 0, -10, -5, 5],
      [5, 10, 10, -20, -20, 10, 10, 5],
      [0, 0, 0, 0, 0, 0, 0, 0]
    ],
    n: [
      [-50, -40, -30, -30, -30, -30, -40, -50],
      [-40, -20, 0, 0, 0, 0, -20, -40],
      [-30, 0, 10, 15, 15, 10, 0, -30],
      [-30, 5, 15, 20, 20, 15, 5, -30],
      [-30, 0, 15, 20, 20, 15, 0, -30],
      [-30, 5, 10, 15, 15, 10, 5, -30],
      [-40, -20, 0, 5, 5, 0, -20, -40],
      [-50, -40, -30, -30, -30, -30, -40, -50]
    ],
    b: [
      [-20, -10, -10, -10, -10, -10, -10, -20],
      [-10, 0, 0, 0, 0, 0, 0, -10],
      [-10, 0, 5, 10, 10, 5, 0, -10],
      [-10, 5, 5, 10, 10, 5, 5, -10],
      [-10, 0, 10, 10, 10, 10, 0, -10],
      [-10, 10, 10, 10, 10, 10, 10, -10],
      [-10, 5, 0, 0, 0, 0, 5, -10],
      [-20, -10, -10, -10, -10, -10, -10, -20]
    ],
    r: [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [5, 10, 10, 10, 10, 10, 10, 5],
      [-5, 0, 0, 0, 0, 0, 0, -5],
      [-5, 0, 0, 0, 0, 0, 0, -5],
      [-5, 0, 0, 0, 0, 0, 0, -5],
      [-5, 0, 0, 0, 0, 0, 0, -5],
      [-5, 0, 0, 0, 0, 0, 0, -5],
      [0, 0, 0, 5, 5, 0, 0, 0]
    ],
    q: [
      [-20, -10, -10, -5, -5, -10, -10, -20],
      [-10, 0, 0, 0, 0, 0, 0, -10],
      [-10, 0, 5, 5, 5, 5, 0, -10],
      [-5, 0, 5, 5, 5, 5, 0, -5],
      [0, 0, 5, 5, 5, 5, 0, -5],
      [-10, 5, 5, 5, 5, 5, 0, -10],
      [-10, 0, 5, 0, 0, 0, 0, -10],
      [-20, -10, -10, -5, -5, -10, -10, -20]
    ],
    k: [
      [-30, -40, -40, -50, -50, -40, -40, -30],
      [-30, -40, -40, -50, -50, -40, -40, -30],
      [-30, -40, -40, -50, -50, -40, -40, -30],
      [-30, -40, -40, -50, -50, -40, -40, -30],
      [-20, -30, -30, -40, -40, -30, -30, -20],
      [-10, -20, -20, -20, -20, -20, -20, -10],
      [20, 20, 0, 0, 0, 0, 20, 20],
      [20, 30, 10, 0, 0, 10, 30, 20]
    ]
  };

  function evaluate(state){
    let score = 0;
    for (let r = 0; r < 8; r++){
      for (let c = 0; c < 8; c++){
        const piece = state.board[r][c];
        if (!piece) continue;
        const pstRow = piece.color === 'w' ? r : 7 - r;
        const total = PIECE_VALUE[piece.type] + PST[piece.type][pstRow][c];
        score += piece.color === 'w' ? total : -total;
      }
    }
    return state.turn === 'w' ? score : -score;
  }

  function moveGain(state, move){
    const captured = state.board[move.to.row][move.to.col];
    if (captured) return PIECE_VALUE[captured.type];
    if (move.isEnPassant) return PIECE_VALUE.p;
    return 0;
  }

  function orderMoves(state, moves){
    return moves.slice().sort((a, b) => moveGain(state, b) - moveGain(state, a));
  }

  function autoPromote(move){
    return move.needsPromotion ? { ...move, promotion: 'q' } : move;
  }

  function negamax(state, depth, alpha, beta){
    const moves = allLegalMoves(state, state.turn);
    if (moves.length === 0){
      if (isInCheck(state.board, state.turn)) return -MATE_SCORE - depth;
      return 0;
    }
    if (depth === 0) return evaluate(state);

    let best = -Infinity;
    for (const move of orderMoves(state, moves)){
      const next = applyMoveRaw(state, autoPromote(move));
      const score = -negamax(next, depth - 1, -beta, -alpha);
      if (score > best) best = score;
      alpha = Math.max(alpha, score);
      if (alpha >= beta) break;
    }
    return best;
  }

  function findBestMove(state){
    const moves = orderMoves(state, allLegalMoves(state, state.turn));
    let bestMove = moves[0];
    let bestScore = -Infinity;
    let alpha = -Infinity;
    const beta = Infinity;
    for (const move of moves){
      const next = applyMoveRaw(state, autoPromote(move));
      const score = -negamax(next, SEARCH_DEPTH - 1, -beta, -alpha);
      if (score > bestScore){ bestScore = score; bestMove = move; }
      alpha = Math.max(alpha, score);
    }
    return autoPromote(bestMove);
  }

  // ============================================================
  // INTERFACE
  // ============================================================

  const boardEl = document.getElementById('chessBoard');
  const turnValueEl = document.getElementById('turnValue');
  const turnDotEl = document.getElementById('turnDot');
  const checkTagEl = document.getElementById('checkTag');
  const resetBtn = document.getElementById('resetBtn');
  const modeBtns = Array.from(document.querySelectorAll('.mode-btn'));
  const logEl = document.getElementById('chessLog');
  const scoreWEl = document.getElementById('scoreW');
  const scoreBEl = document.getElementById('scoreB');
  const scoreDrawEl = document.getElementById('scoreDraw');
  const scoreWLabelEl = document.getElementById('scoreWLabel');
  const scoreBLabelEl = document.getElementById('scoreBLabel');
  const confirmOverlay = document.getElementById('confirmOverlay');
  const cancelResetBtn = document.getElementById('cancelResetBtn');
  const confirmResetBtn = document.getElementById('confirmResetBtn');
  const promoOverlay = document.getElementById('promoOverlay');
  const promoOptions = document.getElementById('promoOptions');

  const squareEls = [];
  let state = initialState();
  let selected = null; // {row,col}
  let legalTargets = []; // lances legais da peça selecionada
  let lastMove = null; // {from,to}
  let pendingPromotion = null; // {from,to}
  let moveNumber = 1;
  let mode = 'pvp'; // 'pvp' ou 'cpu' — no modo cpu, humano é sempre brancas e robô é sempre pretas
  let gameOver = false;
  const score = { w: 0, b: 0, draw: 0 };

  function isRobotTurn(){
    return mode === 'cpu' && state.turn === 'b';
  }

  function buildBoard(){
    boardEl.innerHTML = '';
    squareEls.length = 0;
    for (let r = 0; r < 8; r++){
      const rowEl = document.createElement('div');
      rowEl.className = 'chess-row';
      const rowEls = [];
      for (let c = 0; c < 8; c++){
        const sq = document.createElement('button');
        sq.className = 'chess-sq' + ((r + c) % 2 ? ' dark' : '');
        sq.dataset.row = r;
        sq.dataset.col = c;
        sq.setAttribute('aria-label', squareName(r, c));
        sq.addEventListener('click', () => handleSquareClick(r, c));
        rowEl.appendChild(sq);
        rowEls.push(sq);
      }
      boardEl.appendChild(rowEl);
      squareEls.push(rowEls);
    }
  }

  function pieceGlyph(piece){
    return PIECE_GLYPH[piece.type];
  }

  function render(){
    const inCheck = isInCheck(state.board, state.turn);
    const kingPos = inCheck ? findKing(state.board, state.turn) : null;

    for (let r = 0; r < 8; r++){
      for (let c = 0; c < 8; c++){
        const sq = squareEls[r][c];
        const piece = state.board[r][c];
        sq.innerHTML = '';
        sq.classList.toggle('selected', !!selected && selected.row === r && selected.col === c);
        sq.classList.toggle('last-move', !!lastMove && (
          (lastMove.from.row === r && lastMove.from.col === c) ||
          (lastMove.to.row === r && lastMove.to.col === c)
        ));
        sq.classList.toggle('in-check', !!kingPos && kingPos.row === r && kingPos.col === c);

        if (piece){
          const span = document.createElement('span');
          span.className = 'chess-piece ' + piece.color;
          span.textContent = pieceGlyph(piece);
          sq.appendChild(span);
        }

        const target = legalTargets.find(m => m.to.row === r && m.to.col === c);
        if (target){
          const marker = document.createElement('span');
          marker.className = piece ? 'legal-capture' : 'legal-dot';
          sq.appendChild(marker);
        }
      }
    }

    turnValueEl.textContent = mode === 'cpu'
      ? (state.turn === 'w' ? 'VOCÊ' : 'ROBÔ')
      : (state.turn === 'w' ? 'BRANCAS' : 'PRETAS');
    turnDotEl.classList.toggle('b', state.turn === 'b');
    checkTagEl.hidden = !inCheck;
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

  function pieceLetter(type){
    return { p: '', n: 'N', b: 'B', r: 'R', q: 'Q', k: 'K' }[type];
  }

  function notateMove(preState, move){
    if (move.isCastle === 'K') return 'O-O';
    if (move.isCastle === 'Q') return 'O-O-O';
    const piece = preState.board[move.from.row][move.from.col];
    const isCapture = !!preState.board[move.to.row][move.to.col] || move.isEnPassant;
    let s = '';
    if (piece.type === 'p'){
      if (isCapture) s += FILES[move.from.col] + 'x';
      s += squareName(move.to.row, move.to.col);
      if (move.promotion) s += '=' + pieceLetter(move.promotion);
    } else {
      s += pieceLetter(piece.type);
      if (isCapture) s += 'x';
      s += squareName(move.to.row, move.to.col);
    }
    return s;
  }

  function appendLog(color, notation){
    if (color === 'w'){
      const row = document.createElement('div');
      row.className = 'chess-log-row';
      row.innerHTML = `<span class="num">${moveNumber}.</span><span class="mv">${notation}</span><span class="mv"></span>`;
      logEl.appendChild(row);
    } else {
      const rows = logEl.querySelectorAll('.chess-log-row');
      const lastRow = rows[rows.length - 1];
      if (lastRow){
        lastRow.querySelectorAll('.mv')[1].textContent = notation;
      }
      moveNumber++;
    }
    logEl.scrollTop = logEl.scrollHeight;
  }

  function statusLabels(status){
    switch (status.type){
      case 'checkmate': return {
        tag: 'XEQUE-MATE',
        text: mode === 'cpu'
          ? (status.winner === 'w' ? 'VOCÊ VENCEU' : 'ROBÔ VENCEU')
          : (status.winner === 'w' ? 'BRANCAS' : 'PRETAS') + ' VENCERAM'
      };
      case 'stalemate': return { tag: 'EMPATE', text: 'AFOGAMENTO' };
      case 'draw-50': return { tag: 'EMPATE', text: 'REGRA DOS 50 LANCES' };
      case 'draw-material': return { tag: 'EMPATE', text: 'MATERIAL INSUFICIENTE' };
      case 'draw-repetition': return { tag: 'EMPATE', text: 'REPETIÇÃO TRIPLA' };
      default: return null;
    }
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

  function finishTurn(status){
    render();
    const labels = statusLabels(status);
    if (!labels) return;

    gameOver = true;
    checkTagEl.hidden = true;
    turnValueEl.textContent = labels.tag + ' — ' + labels.text;

    if (status.type === 'checkmate'){
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
    const notation = notateMove(state, move);
    const color = state.turn;
    if (window.playClick) window.playClick();
    state = makeMove(state, move);
    const status = getStatus(state);
    const suffix = status.type === 'checkmate' ? '#' : status.type === 'check' ? '+' : '';
    appendLog(color, notation + suffix);
    lastMove = move;
    clearSelection();
    finishTurn(status);

    const stillPlaying = status.type === 'ongoing' || status.type === 'check';
    if (stillPlaying && isRobotTurn()){
      setTimeout(robotMove, 350);
    }
  }

  function robotMove(){
    if (!isRobotTurn() || gameOver) return;
    const move = findBestMove(state);
    completeMove(move);
  }

  function handleSquareClick(row, col){
    if (gameOver || promoOverlay.classList.contains('active')) return;
    if (isRobotTurn()) return;

    const piece = state.board[row][col];

    if (selected){
      const move = legalTargets.find(m => m.to.row === row && m.to.col === col);
      if (move){
        if (move.needsPromotion){
          pendingPromotion = move;
          promoOverlay.classList.add('active');
        } else {
          completeMove(move);
        }
        return;
      }
    }

    if (piece && piece.color === state.turn){
      selected = { row, col };
      legalTargets = legalMovesFrom(state, row, col);
      render();
      return;
    }

    clearSelection();
    render();
  }

  promoOptions.querySelectorAll('.promo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!pendingPromotion) return;
      const move = { ...pendingPromotion, promotion: btn.dataset.piece };
      pendingPromotion = null;
      promoOverlay.classList.remove('active');
      completeMove(move);
    });
  });

  function newGame(){
    state = initialState();
    clearSelection();
    lastMove = null;
    moveNumber = 1;
    gameOver = false;
    logEl.innerHTML = '';
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
    const gameIsFresh = state.history.length <= 1;
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
    const boardEl = document.getElementById('chessBoard');
    if (boardEl){
      boardEl.style.cssText = 'display:block;width:100%;padding:16px;border:1px solid rgba(168,70,43,0.5);border-radius:8px;';
      boardEl.textContent = 'Erro ao carregar o xadrez: ' + err.message;
    }
  }
})();
