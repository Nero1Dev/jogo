(function(){
  // ============================================================
  // TRUCO PAULISTA — 1 contra 1. Baralho de 40 cartas (sem 8,9,10),
  // manilha definida pela vira, mãos de 3 rodadas, e o sistema de
  // aposta truco/seis/nove/doze com aceitar/correr/aumentar.
  //
  // O robô usa heurística (não busca completa): informação
  // escondida + blefe não se prestam a minimax como no xadrez/damas
  // — força de mão + rodadas já vencidas decidem a chance de pedir
  // ou aceitar, com uma margem de blefe aleatório pra não ser 100%
  // previsível.
  // ============================================================
  try {

  const SUITS = ['ouros', 'espadas', 'copas', 'paus'];
  const SUIT_SYMBOL = { ouros: '♦', espadas: '♠', copas: '♥', paus: '♣' };
  const SUIT_VALUE = { ouros: 0, espadas: 1, copas: 2, paus: 3 }; // ordem da manilha: paus > copas > espadas > ouros
  const RANKS = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];
  const LEVEL_NAMES = { 3: 'TRUCO', 6: 'SEIS', 9: 'NOVE', 12: 'DOZE' };
  const NEXT_LEVEL = { 1: 3, 3: 6, 6: 9, 9: 12 };
  const MATCH_TARGET = 12;
  const IRON_HAND_SCORE = 11; // truco mineiro: quem chega a 11 joga a "mão de ferro" (sem pedir truco, vale 1)

  function buildDeck(){
    const deck = [];
    SUITS.forEach(suit => RANKS.forEach(rank => deck.push({ rank, suit })));
    return deck;
  }

  function shuffle(arr){
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function manilhaRankFor(viraRank){
    const idx = RANKS.indexOf(viraRank);
    return RANKS[(idx + 1) % RANKS.length];
  }

  function cardStrength(card, manilhaRank){
    if (card.rank === manilhaRank) return 100 + SUIT_VALUE[card.suit];
    return RANKS.indexOf(card.rank);
  }

  function other(p){ return p === 1 ? 2 : 1; }
  function availableCallLevel(stake){ return NEXT_LEVEL[stake] || null; }
  function ironHandActive(){ return state.scores[1] >= IRON_HAND_SCORE || state.scores[2] >= IRON_HAND_SCORE; }

  // ---- resultado da mão a partir das rodadas já jogadas ----

  function evaluateHandOutcome(tricks){
    if (tricks.length < 2) return null;
    const t1 = tricks[0], t2 = tricks[1];

    if (t1.winner !== 'tie' && t2.winner !== 'tie'){
      if (t1.winner === t2.winner) return t1.winner; // 2-0
      // 1-1: precisa da terceira
    } else if (t1.winner === 'tie' && t2.winner !== 'tie'){
      return t2.winner; // empate na 1ª -> quem leva a 2ª fica com a mão
    } else if (t1.winner !== 'tie' && t2.winner === 'tie'){
      return t1.winner; // quem levou a 1ª fica com a mão mesmo com empate na 2ª
    }

    if (tricks.length === 3){
      const t3 = tricks[2];
      if (t1.winner === 'tie' && t2.winner === 'tie'){
        return t3.winner !== 'tie' ? t3.winner : null;
      }
      // 1-1 dividido, decide a terceira (empate nela -> quem levou a 1ª)
      return t3.winner !== 'tie' ? t3.winner : t1.winner;
    }
    return null;
  }

  // ============================================================
  // ESTADO
  // ============================================================

  const tableEl = document.getElementById('trucoTable');
  const statusEl = document.getElementById('trucoStatus');
  const modeBtns = Array.from(document.querySelectorAll('.mode-btn'));
  const resetBtn = document.getElementById('resetBtn');
  const p1LabelEl = document.getElementById('p1Label');
  const p1ScoreEl = document.getElementById('p1Score');
  const p2LabelEl = document.getElementById('p2Label');
  const p2ScoreEl = document.getElementById('p2Score');
  const confirmOverlay = document.getElementById('confirmOverlay');
  const cancelResetBtn = document.getElementById('cancelResetBtn');
  const confirmResetBtn = document.getElementById('confirmResetBtn');
  const handoffOverlay = document.getElementById('handoffOverlay');
  const handoffTitleEl = document.getElementById('handoffTitle');
  const handoffRevealBtn = document.getElementById('handoffRevealBtn');

  let mode = 'duo';
  let viewingPlayer = null; // só usado no modo duo (pass-the-device)
  let handoffPending = false;
  let anyCardPlayedInMatch = false;
  const state = { scores: { 1: 0, 2: 0 }, dealer: 1, hand: null, matchOver: false, matchWinner: null };

  function playerLabel(p){
    if (mode === 'cpu') return p === 1 ? 'VOCÊ' : 'ROBÔ';
    return 'JOGADOR ' + p;
  }

  function currentViewer(){
    return mode === 'cpu' ? 1 : viewingPlayer;
  }

  function canCurrentViewerAct(){
    if (!state.hand || state.hand.handOver || state.matchOver) return false;
    if (mode === 'cpu') return state.hand.turnPlayer === 1;
    return state.hand.turnPlayer === viewingPlayer && !handoffPending;
  }

  // ============================================================
  // FLUXO DA MÃO
  // ============================================================

  function dealHand(){
    const deck = shuffle(buildDeck());
    const hands = { 1: [deck.pop(), deck.pop(), deck.pop()], 2: [deck.pop(), deck.pop(), deck.pop()] };
    const vira = deck.pop();
    const manilhaRank = manilhaRankFor(vira.rank);
    const leader = other(state.dealer);

    state.hand = {
      hands, vira, manilhaRank,
      tricks: [],
      currentTrickPlays: {},
      currentTrickLeader: leader,
      turnPlayer: leader,
      stake: ironHandActive() ? 3 : 1,
      pendingCall: null,
      handOver: false,
      winner: null,
      lastPoints: 0
    };
    afterStateChange();
  }

  function nextHand(){
    if (state.matchOver) return;
    state.dealer = other(state.dealer);
    dealHand();
  }

  function newMatch(){
    state.scores = { 1: 0, 2: 0 };
    state.dealer = 1;
    state.matchOver = false;
    state.matchWinner = null;
    viewingPlayer = null;
    anyCardPlayedInMatch = false;
    hideHandoff();
    dealHand();
  }

  function endHand(winner, points){
    const hand = state.hand;
    hand.handOver = true;
    hand.winner = winner;
    hand.lastPoints = points;
    state.scores[winner] += points;
    if (state.scores[winner] >= MATCH_TARGET){
      state.matchOver = true;
      state.matchWinner = winner;
    }
    afterStateChange();
  }

  function resolveTrick(){
    const hand = state.hand;
    const leader = hand.currentTrickLeader;
    const follower = other(leader);
    const plays = hand.currentTrickPlays;
    const s1 = cardStrength(plays[leader], hand.manilhaRank);
    const s2 = cardStrength(plays[follower], hand.manilhaRank);
    const winner = s1 > s2 ? leader : (s2 > s1 ? follower : 'tie');

    hand.tricks.push({ leader, plays: { ...plays }, winner });
    hand.currentTrickPlays = {};

    const outcome = evaluateHandOutcome(hand.tricks);
    if (outcome){
      endHand(outcome, hand.stake);
      return;
    }
    if (hand.tricks.length >= 3){
      // empate triplo — caso raríssimo: prioridade pra quem abriu a 1ª rodada
      endHand(hand.tricks[0].leader, hand.stake);
      return;
    }

    const nextLeader = winner === 'tie' ? leader : winner;
    hand.currentTrickLeader = nextLeader;
    hand.turnPlayer = nextLeader;
    afterStateChange();
  }

  function playCard(playerNum, cardIndex){
    const hand = state.hand;
    if (!hand || hand.handOver || state.matchOver || hand.pendingCall) return;
    if (hand.turnPlayer !== playerNum) return;
    const cards = hand.hands[playerNum];
    if (cardIndex < 0 || cardIndex >= cards.length) return;

    anyCardPlayedInMatch = true;
    const card = cards.splice(cardIndex, 1)[0];
    hand.currentTrickPlays[playerNum] = card;
    if (window.playClick) window.playClick(600);

    const leader = hand.currentTrickLeader;
    const follower = other(leader);
    if (hand.currentTrickPlays[leader] && hand.currentTrickPlays[follower]){
      resolveTrick();
    } else {
      hand.turnPlayer = other(playerNum);
      afterStateChange();
    }
  }

  function callTruco(playerNum){
    const hand = state.hand;
    if (!hand || hand.handOver || state.matchOver || hand.pendingCall) return;
    if (hand.turnPlayer !== playerNum) return;
    if (ironHandActive()) return;
    const level = availableCallLevel(hand.stake);
    if (!level) return;

    hand.pendingCall = { level, caller: playerNum };
    hand.turnPlayer = other(playerNum);
    if (window.playClick) window.playClick(850);
    afterStateChange();
  }

  function respondCall(playerNum, action){
    const hand = state.hand;
    if (!hand || !hand.pendingCall || hand.handOver || state.matchOver) return;
    if (hand.turnPlayer !== playerNum) return;
    const call = hand.pendingCall;

    if (action === 'correr'){
      hand.pendingCall = null;
      if (window.playClick) window.playClick(350);
      endHand(call.caller, hand.stake);
      return;
    }
    if (action === 'aceitar'){
      hand.stake = call.level;
      hand.pendingCall = null;
      hand.turnPlayer = call.caller;
      if (window.playClick) window.playClick(700);
      afterStateChange();
      return;
    }
    if (action === 'aumentar'){
      const next = availableCallLevel(call.level);
      if (!next) return;
      hand.pendingCall = { level: next, caller: playerNum };
      hand.turnPlayer = call.caller;
      if (window.playClick) window.playClick(950);
      afterStateChange();
      return;
    }
  }

  // ============================================================
  // ROBÔ
  // ============================================================

  function handStrengthInfo(cards, manilhaRank){
    let strongCount = 0;
    cards.forEach(c => {
      const s = cardStrength(c, manilhaRank);
      if (s >= 100) strongCount += 2;
      else if (s >= RANKS.indexOf('A')) strongCount += 1;
    });
    return { strongCount };
  }

  function callProbability(info, hand, playerNum){
    let base;
    if (info.strongCount >= 3) base = 0.85;
    else if (info.strongCount === 2) base = 0.5;
    else if (info.strongCount === 1) base = 0.22;
    else base = 0.08;

    const wins = hand.tricks.filter(t => t.winner === playerNum).length;
    const losses = hand.tricks.filter(t => t.winner === other(playerNum)).length;
    if (wins > losses) base += 0.15;
    if (losses > wins) base -= 0.1;

    return Math.max(0, Math.min(0.95, base));
  }

  function weakestIndex(cards, manilhaRank){
    let idx = 0, val = Infinity;
    cards.forEach((c, i) => {
      const s = cardStrength(c, manilhaRank);
      if (s < val){ val = s; idx = i; }
    });
    return idx;
  }

  function robotPlayCard(){
    const hand = state.hand;
    const myCards = hand.hands[2];
    const leading = Object.keys(hand.currentTrickPlays).length === 0;

    let chosenIndex;
    if (leading){
      chosenIndex = weakestIndex(myCards, hand.manilhaRank);
    } else {
      const oppCard = hand.currentTrickPlays[other(2)];
      const oppStrength = cardStrength(oppCard, hand.manilhaRank);
      let bestWinIndex = -1, bestWinStrength = Infinity;
      myCards.forEach((c, i) => {
        const s = cardStrength(c, hand.manilhaRank);
        if (s > oppStrength && s < bestWinStrength){ bestWinStrength = s; bestWinIndex = i; }
      });
      chosenIndex = bestWinIndex !== -1 ? bestWinIndex : weakestIndex(myCards, hand.manilhaRank);
    }
    playCard(2, chosenIndex);
  }

  function robotChooseAction(){
    const hand = state.hand;
    const info = handStrengthInfo(hand.hands[2], hand.manilhaRank);
    const level = availableCallLevel(hand.stake);
    if (level && !ironHandActive() && Math.random() < callProbability(info, hand, 2)){
      callTruco(2);
      return;
    }
    robotPlayCard();
  }

  function robotRespondToCall(){
    const hand = state.hand;
    const call = hand.pendingCall;
    const info = handStrengthInfo(hand.hands[2], hand.manilhaRank);
    const wins = hand.tricks.filter(t => t.winner === 2).length;
    const losses = hand.tricks.filter(t => t.winner === 1).length;

    let confidence = info.strongCount;
    if (wins > losses) confidence += 1.5;
    if (losses > wins) confidence -= 1;

    const level = call.level;
    let action;
    if (level === 3){
      if (confidence >= 3) action = Math.random() < 0.35 ? 'aumentar' : 'aceitar';
      else if (confidence >= 1.5) action = Math.random() < 0.75 ? 'aceitar' : 'correr';
      else action = Math.random() < 0.2 ? 'aceitar' : 'correr';
    } else if (level === 6){
      if (confidence >= 4) action = Math.random() < 0.3 ? 'aumentar' : 'aceitar';
      else if (confidence >= 2.5) action = Math.random() < 0.55 ? 'aceitar' : 'correr';
      else action = Math.random() < 0.12 ? 'aceitar' : 'correr';
    } else {
      if (confidence >= 5) action = (level < 12 && Math.random() < 0.2) ? 'aumentar' : 'aceitar';
      else if (confidence >= 3.5) action = Math.random() < 0.4 ? 'aceitar' : 'correr';
      else action = Math.random() < 0.08 ? 'aceitar' : 'correr';
    }
    if (action === 'aumentar' && !availableCallLevel(level)) action = 'aceitar';
    respondCall(2, action);
  }

  function robotAct(){
    const hand = state.hand;
    if (!hand || hand.handOver || state.matchOver) return;
    if (hand.pendingCall){
      if (hand.turnPlayer === 2) robotRespondToCall();
      return;
    }
    if (hand.turnPlayer !== 2) return;
    robotChooseAction();
  }

  function maybeRobotAct(){
    if (mode !== 'cpu' || state.matchOver) return;
    const hand = state.hand;
    if (!hand || hand.handOver) return;
    if (hand.turnPlayer !== 2) return;
    setTimeout(() => {
      if (mode !== 'cpu' || !state.hand || state.hand.handOver || state.matchOver) return;
      robotAct();
    }, 500 + Math.random() * 700);
  }

  // ============================================================
  // TROCA DE CELULAR (modo 2 jogadores)
  // ============================================================

  function showHandoff(forPlayer){
    handoffTitleEl.textContent = playerLabel(forPlayer);
    handoffOverlay.classList.add('active');
    handoffPending = true;
  }

  function hideHandoff(){
    handoffOverlay.classList.remove('active');
    handoffPending = false;
  }

  function syncViewer(){
    const hand = state.hand;
    if (!hand) return;
    if (viewingPlayer !== hand.turnPlayer) showHandoff(hand.turnPlayer);
    else hideHandoff();
  }

  handoffRevealBtn.addEventListener('click', () => {
    if (!state.hand) return;
    viewingPlayer = state.hand.turnPlayer;
    hideHandoff();
    render();
  });

  function afterStateChange(){
    render();
    if (mode === 'duo') syncViewer();
    maybeRobotAct();
  }

  // ============================================================
  // RENDER
  // ============================================================

  function buildCardEl(card, opts){
    opts = opts || {};
    const el = document.createElement('div');
    el.className = 'truco-card' + (opts.small ? ' small' : '');
    if (!card || opts.faceDown){
      el.classList.add('face-down');
      return el;
    }
    const isRed = card.suit === 'ouros' || card.suit === 'copas';
    el.classList.add(isRed ? 'red' : 'black');
    if (opts.highlight) el.classList.add('manilha');
    el.innerHTML =
      '<span class="truco-card-rank">' + card.rank + '</span>' +
      '<span class="truco-card-suit">' + SUIT_SYMBOL[card.suit] + '</span>';
    return el;
  }

  function render(){
    p1LabelEl.textContent = playerLabel(1);
    p2LabelEl.textContent = playerLabel(2);
    p1ScoreEl.textContent = String(state.scores[1]);
    p2ScoreEl.textContent = String(state.scores[2]);

    const hand = state.hand;
    tableEl.innerHTML = '';
    if (!hand) return;

    const viewer = currentViewer();
    const opponent = viewer ? other(viewer) : null;

    const stakeEl = document.createElement('div');
    stakeEl.className = 'mono truco-stake';
    stakeEl.textContent = 'VALENDO ' + hand.stake;
    if (ironHandActive()) stakeEl.textContent += ' · MÃO DE FERRO';
    tableEl.appendChild(stakeEl);

    const oppRow = document.createElement('div');
    oppRow.className = 'truco-opponent-row';
    const oppHandEl = document.createElement('div');
    oppHandEl.className = 'truco-hand';
    const oppCount = opponent ? hand.hands[opponent].length : 0;
    for (let i = 0; i < oppCount; i++) oppHandEl.appendChild(buildCardEl(null, { faceDown: true }));
    oppRow.appendChild(oppHandEl);
    tableEl.appendChild(oppRow);

    const midRow = document.createElement('div');
    midRow.className = 'truco-mid-row';

    const viraBox = document.createElement('div');
    viraBox.className = 'truco-vira-box';
    viraBox.appendChild(buildCardEl(hand.vira, { small: true }));
    const manilhaLabel = document.createElement('span');
    manilhaLabel.className = 'mono truco-manilha-label';
    manilhaLabel.textContent = 'MANILHA ' + hand.manilhaRank;
    viraBox.appendChild(manilhaLabel);
    midRow.appendChild(viraBox);

    const playArea = document.createElement('div');
    playArea.className = 'truco-play-area';
    [1, 2].forEach(p => {
      const slot = document.createElement('div');
      slot.className = 'truco-play-slot';
      if (hand.currentTrickPlays[p]) slot.appendChild(buildCardEl(hand.currentTrickPlays[p]));
      playArea.appendChild(slot);
    });
    midRow.appendChild(playArea);

    const historyRow = document.createElement('div');
    historyRow.className = 'truco-trick-history';
    hand.tricks.forEach(t => {
      const dot = document.createElement('span');
      const mine = viewer && t.winner === viewer;
      dot.className = 'truco-trick-dot ' + (t.winner === 'tie' ? 'tie' : (mine ? 'me' : 'opp'));
      historyRow.appendChild(dot);
    });
    midRow.appendChild(historyRow);

    tableEl.appendChild(midRow);

    const playerRow = document.createElement('div');
    playerRow.className = 'truco-player-row';
    const playerHandEl = document.createElement('div');
    playerHandEl.className = 'truco-hand';
    const canPlay = canCurrentViewerAct() && !hand.pendingCall;
    if (viewer){
      hand.hands[viewer].forEach((card, i) => {
        const el = buildCardEl(card, { highlight: card.rank === hand.manilhaRank });
        if (canPlay){
          el.classList.add('playable');
          el.addEventListener('click', () => playCard(viewer, i));
        }
        playerHandEl.appendChild(el);
      });
    }
    playerRow.appendChild(playerHandEl);
    tableEl.appendChild(playerRow);

    const actions = document.createElement('div');
    actions.className = 'truco-actions';

    if (state.matchOver){
      statusEl.textContent = playerLabel(state.matchWinner) + ' VENCEU A PARTIDA — ' + state.scores[1] + ' A ' + state.scores[2];
    } else if (hand.handOver){
      statusEl.textContent = playerLabel(hand.winner) + ' VENCEU A MÃO (+' + hand.lastPoints + ')';
      const btn = document.createElement('button');
      btn.className = 'btn btn-solid mono';
      btn.textContent = 'PRÓXIMA MÃO';
      btn.addEventListener('click', nextHand);
      actions.appendChild(btn);
    } else if (hand.pendingCall){
      const levelName = LEVEL_NAMES[hand.pendingCall.level];
      if (canCurrentViewerAct()){
        statusEl.textContent = levelName + '! O que você faz?';
        const acceptBtn = document.createElement('button');
        acceptBtn.className = 'btn btn-solid mono';
        acceptBtn.textContent = 'ACEITAR';
        acceptBtn.addEventListener('click', () => respondCall(viewer, 'aceitar'));
        actions.appendChild(acceptBtn);

        const runBtn = document.createElement('button');
        runBtn.className = 'btn btn-ghost mono';
        runBtn.textContent = 'CORRER';
        runBtn.addEventListener('click', () => respondCall(viewer, 'correr'));
        actions.appendChild(runBtn);

        const nextLevel = availableCallLevel(hand.pendingCall.level);
        if (nextLevel){
          const raiseBtn = document.createElement('button');
          raiseBtn.className = 'btn btn-ghost mono';
          raiseBtn.textContent = 'PEDIR ' + LEVEL_NAMES[nextLevel];
          raiseBtn.addEventListener('click', () => respondCall(viewer, 'aumentar'));
          actions.appendChild(raiseBtn);
        }
      } else {
        const waitingLabel = mode === 'cpu' && hand.turnPlayer === 2 ? 'o robô' : playerLabel(hand.turnPlayer);
        statusEl.textContent = playerLabel(hand.pendingCall.caller) + ' pediu ' + levelName + '! Aguardando ' + waitingLabel + '...';
      }
    } else if (canCurrentViewerAct()){
      const level = ironHandActive() ? null : availableCallLevel(hand.stake);
      statusEl.textContent = ironHandActive() ? 'Mão de ferro — sem truco, jogue uma carta' : 'Sua vez — jogue uma carta ou peça truco';
      if (level){
        const callBtn = document.createElement('button');
        callBtn.className = 'btn btn-ghost mono';
        callBtn.textContent = 'PEDIR ' + LEVEL_NAMES[level];
        callBtn.addEventListener('click', () => callTruco(viewer));
        actions.appendChild(callBtn);
      }
    } else {
      statusEl.textContent = mode === 'cpu' ? 'Robô está pensando...' : (playerLabel(hand.turnPlayer) + ', é sua vez.');
    }

    tableEl.appendChild(actions);
  }

  // ============================================================
  // CONTROLES
  // ============================================================

  function onResetClick(){
    const handIsFresh = !anyCardPlayedInMatch;
    const hasScore = state.scores[1] > 0 || state.scores[2] > 0;
    if (handIsFresh && hasScore){
      confirmOverlay.classList.add('active');
      return;
    }
    newMatch();
  }

  function setMode(newMode){
    if (newMode === mode) return;
    mode = newMode;
    modeBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
    viewingPlayer = null;
    newMatch();
  }

  resetBtn.addEventListener('click', onResetClick);
  modeBtns.forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)));
  cancelResetBtn.addEventListener('click', () => confirmOverlay.classList.remove('active'));
  confirmResetBtn.addEventListener('click', () => {
    confirmOverlay.classList.remove('active');
    newMatch();
  });

  newMatch();

  } catch (err){
    console.error(err);
    const tableEl = document.getElementById('trucoTable');
    if (tableEl){
      tableEl.style.cssText = 'display:block;width:100%;padding:16px;border:1px solid rgba(168,70,43,0.5);border-radius:8px;';
      tableEl.textContent = 'Erro ao carregar o truco: ' + err.message;
    }
  }
})();
