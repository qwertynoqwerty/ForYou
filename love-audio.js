const LoveAudio = (() => {
  const status = document.getElementById('audioStatus');
  const voices = new Set();
  const menuVoices = new Set();
  const menuMelodies = [[523.25, 659.25, 392, 587.33, 523.25], [659.25, 587.33, 523.25, 392, 523.25]];
  const music = document.getElementById('backgroundMusic');
  let context;
  let output;
  let ambience;
  let menuGain;
  let menuTimer;
  let menuPhrase = 0;
  let memoryOpen = false;
  let inUniverse = false;
  let failed = false;
  function fail(error) {
    failed = true;
    stopBackground();
    status.textContent = 'Звук недоступен. Попробуй обновить страницу.';
    console.warn('Не удалось запустить звук.', error);
  }
  function createContext() {
    if (context) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) throw new Error('Web Audio недоступен');
    context = new Audio({ latencyHint: 'interactive' });
    output = context.createGain();
    output.gain.value = .65;
    output.connect(context.destination);
    ambience = context.createGain();
    ambience.gain.value = 0;
    context.createMediaElementSource(music).connect(ambience);
    ambience.connect(context.destination);
    menuGain = context.createGain();
    menuGain.gain.value = 0;
    menuGain.connect(context.destination);
  }

  function tone(frequency, start, duration, level, destination, attack = .015, endFrequency = frequency) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(level, start + attack);
    gain.gain.exponentialRampToValueAtTime(.00001, start + duration);
    gain.gain.setValueAtTime(0, start + duration + .03);
    oscillator.connect(gain);
    gain.connect(destination);
    voices.add(oscillator);
    oscillator.onended = () => { voices.delete(oscillator); menuVoices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(start);
    oscillator.stop(start + duration + .05);
    return oscillator;
  }
  function playMenuPhrase() {
    if (inUniverse || document.hidden || context.state !== 'running') return;
    const start = context.currentTime + .01;
    const times = [0, 1.2, 2.4, 4.8, 6];
    menuMelodies[menuPhrase++ % menuMelodies.length].forEach((frequency, index) => {
      menuVoices.add(tone(frequency, start + times[index], 1.3, .075, menuGain, .025));
      menuVoices.add(tone(frequency * 2, start + times[index], .35, .005, menuGain, .02));
    });
  }
  function startMenu() {
    if (menuTimer || inUniverse || document.hidden || context?.state !== 'running') return;
    menuGain.gain.cancelScheduledValues(context.currentTime);
    menuGain.gain.setTargetAtTime(.11, context.currentTime, .08);
    playMenuPhrase();
    menuTimer = setInterval(playMenuPhrase, 8000);
  }
  function stopMenu() {
    clearInterval(menuTimer);
    menuTimer = null;
    if (!context) return;
    menuGain.gain.cancelScheduledValues(context.currentTime);
    menuGain.gain.setTargetAtTime(0, context.currentTime, .04);
    for (const oscillator of menuVoices) { try { oscillator.stop(context.currentTime + .18); } catch {} }
  }
  async function startBackground() {
    if (!inUniverse || document.hidden || context?.state !== 'running' || !music.paused) return;
    try {
      await music.play();
      if (document.hidden) { music.pause(); return; }
      const now = context.currentTime;
      ambience.gain.cancelScheduledValues(now);
      ambience.gain.setValueAtTime(0, now);
      ambience.gain.linearRampToValueAtTime(memoryOpen ? .035 : .065, now + .18);
    } catch (error) {
      if (error.name === 'NotAllowedError' || error.name === 'AbortError') return;
      status.textContent = 'Не удалось загрузить музыку. Попробуй обновить страницу.';
      console.warn('Не удалось включить фоновую музыку.', error);
    }
  }
  function stopBackground() {
    stopMenu();
    music.pause();
    for (const oscillator of voices) { try { oscillator.stop(); } catch {} }
  }
  async function unlock() {
    if (failed || document.hidden) return false;
    try {
      createContext();
      if (context.state !== 'running') await context.resume();
      if (document.hidden) { await context.suspend(); return false; }
      if (inUniverse) startBackground();
      else startMenu();
      return context.state === 'running';
    } catch (error) {
      if (error.name !== 'NotAllowedError') fail(error);
      return false;
    }
  }
  async function play(kind) {
    if (failed || document.hidden) return;
    if (context?.state !== 'running' && !await unlock()) return;
    const now = context.currentTime + .003;
    if (kind === 'press') {
      tone(420, now, .11, .07, output, .003, 280);
      tone(840, now, .045, .008, output, .002, 560);
    }
  }
  function enterUniverse() { inUniverse = true; stopMenu(); unlock(); }
  function setMemoryOpen(value) {
    memoryOpen = value;
    if (context) ambience.gain.setTargetAtTime(value ? .035 : .065, context.currentTime, .5);
  }
  document.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const button = event.target.closest('button');
    if (button && !button.disabled) play('press');
    else unlock();
  }, { capture: true, passive: true });
  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (event.detail === 0 && button && !button.disabled) play('press');
    else unlock();
  }, true);
  document.addEventListener('touchend', unlock, { capture: true, passive: true });
  document.addEventListener('keydown', event => {
    if (!event.repeat) unlock();
  }, true);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopBackground();
      if (context) context.suspend().catch(fail);
    } else if (context) unlock();
  });
  return { play, enterUniverse, setMemoryOpen };
})();
