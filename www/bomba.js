(function(){
  const stage = document.getElementById('bombStage');
  const button = document.getElementById('bombButton');
  const cta = document.getElementById('bombCta');
  const shockwave = document.getElementById('bombShockwave');
  const riskFillEl = document.getElementById('riskFill');
  const riskValueEl = document.getElementById('riskValue');
  const resetBtn = document.getElementById('resetBtn');
  const bombHelpEl = document.getElementById('bombHelp');
  const DEFAULT_HELP = bombHelpEl.textContent;

  const BASE_CHANCE = 0.02;
  const CHANCE_STEP = 0.01;
  const MAX_CHANCE = 0.97;

  let clicks = 0;
  let active = true;

  function currentRisk(){
    return Math.min(MAX_CHANCE, BASE_CHANCE + clicks * CHANCE_STEP);
  }

  function renderRisk(){
    const pct = Math.round(currentRisk() * 100);
    riskFillEl.style.width = pct + '%';
    riskValueEl.textContent = pct + '%';
  }

  function explode(){
    active = false;
    button.disabled = true;
    cta.textContent = 'BOOM!';

    stage.classList.remove('shake');
    void stage.offsetWidth;
    stage.classList.add('shake');

    shockwave.classList.remove('active');
    void shockwave.offsetWidth;
    shockwave.classList.add('active');

    if (navigator.vibrate) navigator.vibrate([120, 60, 120, 60, 250]);

    bombHelpEl.textContent = 'Explodiu! Quem apertou por último perdeu essa rodada — clique em REINICIAR pra jogar de novo.';
    bombHelpEl.classList.add('result-lose');
  }

  function handlePress(){
    if (!active) return;

    if (window.playClick) window.playClick();

    const risk = currentRisk();
    clicks++;

    if (Math.random() < risk){
      explode();
      return;
    }

    renderRisk();
  }

  function newRound(){
    active = true;
    clicks = 0;
    button.disabled = false;
    cta.textContent = 'APERTE';
    bombHelpEl.textContent = DEFAULT_HELP;
    bombHelpEl.classList.remove('result-lose');
    renderRisk();
  }

  button.addEventListener('click', handlePress);
  resetBtn.addEventListener('click', newRound);

  newRound();
})();
