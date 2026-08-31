(function(){
  const coinStage = document.getElementById('coinStage');
  const coin = document.getElementById('coin');
  const flipBtn = document.getElementById('flipBtn');
  const statusEl = document.getElementById('coinStatus');
  const scoreCaraEl = document.getElementById('scoreCara');
  const scoreCoroaEl = document.getElementById('scoreCoroa');
  const scoreTotalEl = document.getElementById('scoreTotal');
  const resetScoreBtn = document.getElementById('resetScoreBtn');

  let flipping = false;
  let restDeg = 0; // ângulo onde a moeda está parada agora (0 = cara, 180 = coroa)
  let pendingResult = null;
  let pendingFinalDeg = 0;
  const score = { cara: 0, coroa: 0 };

  function flipCoin(){
    if (flipping) return;
    flipping = true;
    if (window.playClick) window.playClick();
    flipBtn.disabled = true;
    statusEl.textContent = 'GIRANDO...';

    const result = Math.random() < 0.5 ? 'cara' : 'coroa';
    const targetMod = result === 'coroa' ? 180 : 0;
    const currentMod = ((restDeg % 360) + 360) % 360;
    const extraTurns = 5 + Math.floor(Math.random() * 3); // 5 a 7 voltas inteiras
    const delta = extraTurns * 360 + ((targetMod - currentMod + 360) % 360);

    pendingResult = result;
    pendingFinalDeg = restDeg + delta;

    coin.style.setProperty('--spin-start', restDeg + 'deg');
    coin.style.setProperty('--spin-end', pendingFinalDeg + 'deg');
    coin.classList.remove('flipping');
    coinStage.classList.remove('flipping');
    coin.style.transform = '';
    void coin.offsetWidth; // força reflow pra reiniciar a animação
    coin.classList.add('flipping');
    coinStage.classList.add('flipping');
  }

  coin.addEventListener('animationend', () => {
    restDeg = pendingFinalDeg;
    coin.classList.remove('flipping');
    coinStage.classList.remove('flipping');
    coin.style.transform = `rotateY(${restDeg}deg)`;

    score[pendingResult]++;
    scoreCaraEl.textContent = score.cara;
    scoreCoroaEl.textContent = score.coroa;
    scoreTotalEl.textContent = score.cara + score.coroa;
    statusEl.textContent = pendingResult === 'cara' ? 'DEU CARA!' : 'DEU COROA!';

    flipping = false;
    flipBtn.disabled = false;
  });

  resetScoreBtn.addEventListener('click', () => {
    score.cara = 0;
    score.coroa = 0;
    scoreCaraEl.textContent = '0';
    scoreCoroaEl.textContent = '0';
    scoreTotalEl.textContent = '0';
    statusEl.textContent = 'TOQUE EM GIRAR';
  });

  flipBtn.addEventListener('click', flipCoin);
})();
