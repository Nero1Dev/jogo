// MENU LATERAL — hambúrguer abre um drawer com cards de navegação
// (ideia inspirada em reactbits.dev/components/card-nav, sem React/GSAP)
// Compartilhado entre todas as páginas do site.
(function(){
  const hamburger = document.getElementById('hamburgerMenu');
  const drawer = document.getElementById('drawer');
  const backdrop = document.getElementById('drawerBackdrop');
  let isOpen = false;

  function openDrawer(){
    drawer.classList.add('open');
    backdrop.classList.add('open');
    hamburger.classList.add('open');
    hamburger.setAttribute('aria-expanded', 'true');
    drawer.setAttribute('aria-hidden', 'false');
    isOpen = true;
  }

  function closeDrawer(){
    drawer.classList.remove('open');
    backdrop.classList.remove('open');
    hamburger.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
    drawer.setAttribute('aria-hidden', 'true');
    isOpen = false;
  }

  function toggleDrawer(){
    isOpen ? closeDrawer() : openDrawer();
  }

  hamburger.addEventListener('click', toggleDrawer);
  backdrop.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isOpen) closeDrawer();
  });
})();

// SOM DE CLIQUE — sintetizado via Web Audio API (sem arquivo de áudio
// externo), compartilhado por todos os jogos. Cada jogo chama
// window.playClick() no momento principal de interação (jogar uma
// peça, revelar uma casa, apertar o botão etc.), opcionalmente com
// uma frequência diferente pra distinguir ações (ex.: bandeira vs
// revelar no campo minado).
(function(){
  let audioCtx = null;
  window.playClick = function(freq){
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq || 700, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.08);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.08);
    } catch (e){}
  };
})();
