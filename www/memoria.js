(function(){
  // ============================================================
  // JOGO DA MEMÓRIA — tabuleiro 4x4 (8 pares). Modo 1 jogador
  // (cronômetro + contagem de movimentos) ou 2 jogadores (turnos
  // alternados, quem acerta um par joga de novo).
  // ============================================================
  try {

  const ICONS = [
    '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 14.9 8.9 22.5 9.5 16.8 14.4 18.5 21.8 12 17.8 5.5 21.8 7.2 14.4 1.5 9.5 9.1 8.9"/></svg>',
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 22 12 12 22 2 12Z"/></svg>',
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3 22 20H2Z"/></svg>',
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>',
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 21 7v10l-9 5-9-5V7Z"/></svg>',
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="9"/></svg>'
  ];
  const TOTAL_PAIRS = ICONS.length;

  const boardEl = document.getElementById('memoryBoard');
  const modeBtns = Array.from(document.querySelectorAll('.mode-btn'));
  const turnIndicatorEl = document.getElementById('turnIndicator');
  const turnDotEl = document.getElementById('turnDot');
  const turnValueEl = document.getElementById('turnValue');
  const resetBtn = document.getElementById('resetBtn');
  const helpEl = document.getElementById('memoryHelp');
  const DEFAULT_HELP = helpEl.textContent;
  const statLeftEl = document.getElementById('statLeft');
  const statLeftLabelEl = document.getElementById('statLeftLabel');
  const statMidEl = document.getElementById('statMid');
  const statMidLabelEl = document.getElementById('statMidLabel');
  const statRightEl = document.getElementById('statRight');
  const statRightLabelEl = document.getElementById('statRightLabel');

  let mode = 'solo';
  let deck = [];
  let cardEls = [];
  let firstPick = null;
  let busy = false;
  let matchedCount = 0;
  let moveCount = 0;
  let elapsedSeconds = 0;
  let timerInterval = null;
  let firstFlipDone = false;
  let currentPlayer = 1;
  let pairs = { 1: 0, 2: 0 };
  let gameOver = false;

  function shuffledDeck(){
    const values = [];
    for (let i = 0; i < ICONS.length; i++) values.push(i, i);
    for (let i = values.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    return values.map(icon => ({ icon, matched: false }));
  }

  function formatTime(s){
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m + ':' + String(sec).padStart(2, '0');
  }

  function refreshStats(){
    if (mode === 'solo'){
      statLeftLabelEl.textContent = 'MOVIMENTOS';
      statMidLabelEl.textContent = 'TEMPO';
      statRightLabelEl.textContent = 'PARES';
      statLeftEl.textContent = String(moveCount);
      statMidEl.textContent = formatTime(elapsedSeconds);
      statRightEl.textContent = matchedCount + '/' + TOTAL_PAIRS;
    } else {
      statLeftLabelEl.textContent = 'JOGADOR 1';
      statMidLabelEl.textContent = 'PARES';
      statRightLabelEl.textContent = 'JOGADOR 2';
      statLeftEl.textContent = String(pairs[1]);
      statMidEl.textContent = matchedCount + '/' + TOTAL_PAIRS;
      statRightEl.textContent = String(pairs[2]);
    }
  }

  function startTimer(){
    elapsedSeconds = 0;
    timerInterval = setInterval(() => {
      elapsedSeconds++;
      refreshStats();
    }, 1000);
  }

  function stopTimer(){
    if (timerInterval){ clearInterval(timerInterval); timerInterval = null; }
  }

  function updateTurnDisplay(){
    turnValueEl.textContent = 'JOGADOR ' + currentPlayer;
    turnDotEl.classList.toggle('p2', currentPlayer === 2);
  }

  function switchTurn(){
    currentPlayer = currentPlayer === 1 ? 2 : 1;
    updateTurnDisplay();
  }

  function revealCard(i){
    cardEls[i].classList.add('revealed');
    cardEls[i].disabled = true;
  }

  function hideCard(i){
    cardEls[i].classList.remove('revealed');
    cardEls[i].disabled = false;
  }

  function markMatched(i){
    cardEls[i].classList.add('matched');
    cardEls[i].disabled = true;
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

  function checkWin(){
    if (matchedCount < TOTAL_PAIRS) return;
    gameOver = true;

    if (mode === 'solo'){
      stopTimer();
      helpEl.textContent = 'Você encontrou todos os pares em ' + moveCount + ' movimentos e ' + formatTime(elapsedSeconds) + '!';
      helpEl.classList.add('result-win');
      burstConfetti();
    } else {
      if (pairs[1] === pairs[2]){
        turnValueEl.textContent = 'EMPATE — ' + pairs[1] + ' A ' + pairs[2];
      } else {
        const winner = pairs[1] > pairs[2] ? 1 : 2;
        const loser = winner === 1 ? 2 : 1;
        turnValueEl.textContent = 'JOGADOR ' + winner + ' VENCEU — ' + pairs[winner] + ' A ' + pairs[loser];
      }
      helpEl.textContent = 'Fim de jogo! Clique em REINICIAR pra jogar de novo.';
      burstConfetti();
    }
  }

  function handleCardClick(i){
    if (gameOver || busy) return;
    const el = cardEls[i];
    if (el.classList.contains('revealed') || el.classList.contains('matched')) return;
    if (firstPick === i) return;

    if (mode === 'solo' && !firstFlipDone){
      firstFlipDone = true;
      startTimer();
    }

    if (window.playClick) window.playClick(650);
    revealCard(i);

    if (firstPick === null){
      firstPick = i;
      return;
    }

    const a = firstPick, b = i;
    firstPick = null;

    if (mode === 'solo'){
      moveCount++;
    }

    if (deck[a].icon === deck[b].icon){
      deck[a].matched = true;
      deck[b].matched = true;
      matchedCount++;
      markMatched(a);
      markMatched(b);
      if (window.playClick) window.playClick(1000);
      if (mode === 'duo') pairs[currentPlayer]++;
      refreshStats();
      checkWin();
    } else {
      busy = true;
      refreshStats();
      cardEls[a].classList.add('mismatch');
      cardEls[b].classList.add('mismatch');
      setTimeout(() => {
        cardEls[a].classList.remove('mismatch');
        cardEls[b].classList.remove('mismatch');
        hideCard(a);
        hideCard(b);
        busy = false;
        if (window.playClick) window.playClick(280);
        if (mode === 'duo' && !gameOver) switchTurn();
      }, 900);
    }
  }

  function buildBoard(){
    boardEl.innerHTML = '';
    cardEls = [];
    deck = shuffledDeck();
    deck.forEach((card, i) => {
      const btn = document.createElement('button');
      btn.className = 'memory-card';
      btn.setAttribute('aria-label', 'Carta ' + (i + 1));
      btn.innerHTML =
        '<div class="memory-card-inner">' +
          '<div class="memory-card-face memory-card-back"></div>' +
          '<div class="memory-card-face memory-card-front">' + ICONS[card.icon] + '</div>' +
        '</div>';
      btn.addEventListener('click', () => handleCardClick(i));
      boardEl.appendChild(btn);
      cardEls.push(btn);
    });
  }

  function newGame(){
    stopTimer();
    gameOver = false;
    busy = false;
    firstPick = null;
    firstFlipDone = false;
    matchedCount = 0;
    moveCount = 0;
    elapsedSeconds = 0;
    currentPlayer = 1;
    pairs = { 1: 0, 2: 0 };

    buildBoard();
    helpEl.textContent = DEFAULT_HELP;
    helpEl.classList.remove('result-win');
    refreshStats();
    if (mode === 'duo') updateTurnDisplay();
  }

  function setMode(newMode){
    if (newMode === mode) return;
    mode = newMode;
    modeBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
    turnIndicatorEl.hidden = mode !== 'duo';
    newGame();
  }

  resetBtn.addEventListener('click', newGame);
  modeBtns.forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)));

  turnIndicatorEl.hidden = mode !== 'duo';
  newGame();

  } catch (err){
    console.error(err);
    const boardEl = document.getElementById('memoryBoard');
    if (boardEl){
      boardEl.style.cssText = 'display:block;width:100%;padding:16px;border:1px solid rgba(168,70,43,0.5);border-radius:8px;';
      boardEl.textContent = 'Erro ao carregar o jogo da memória: ' + err.message;
    }
  }
})();
