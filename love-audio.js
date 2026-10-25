const LoveAudio = (() => {
  const status = document.getElementById('audioStatus');
  const voices = new Set();
  const chords = [[261.63, 329.63, 392, 440], [174.61, 261.63, 349.23, 440], [220, 293.66, 349.23, 440], [196, 293.66, 392, 493.88]];
  const melodies = [[523.25, 659.25, 783.99, 659.25, 587.33, 659.25, 523.25, null], [659.25, 698.46, 880, 783.99, 659.25, 587.33, 523.25, null], [587.33, 698.46, 880, 698.46, 659.25, 587.33, 523.25, null], [493.88, 587.33, 783.99, 659.25, 587.33, 493.88, 523.25, null]];
  let context;
  let output;
  let ambience;
  let backgroundTimer;
  let chordIndex = 0;
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
    ambience.gain.value = memoryOpen ? .25 : .55;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 4200;
    ambience.connect(filter);
    filter.connect(output);
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
    oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(start);
    oscillator.stop(start + duration + .05);
  }
  function musicBox(frequency, start, level) {
    tone(frequency, start, 1.45, level, ambience, .009);
    tone(frequency * 2, start, .55, level * .12, ambience, .006);
    tone(frequency * 3, start, .2, level * .018, ambience, .004);
  }
  function playPhrase() {
    if (!inUniverse || document.hidden || context.state !== 'running') return;
    const start = context.currentTime + .01;
    const index = chordIndex++ % chords.length;
    const chord = chords[index];
    chord.forEach((frequency, step) => {
      tone(frequency, start + step * .025, 4.2, .008, ambience, .06);
      musicBox(frequency * 2, start + step * .5, .014);
    });
    melodies[index].forEach((frequency, step) => {
      if (frequency) musicBox(frequency, start + step * .5, step === 0 ? .08 : .065);
    });
  }
  function startBackground() {
    if (backgroundTimer || !inUniverse || document.hidden || context?.state !== 'running') return;
    playPhrase();
    backgroundTimer = setInterval(playPhrase, 4000);
  }
  function stopBackground() {
    clearInterval(backgroundTimer);
    backgroundTimer = null;
    for (const oscillator of voices) { try { oscillator.stop(); } catch {} }
  }
  async function unlock() {
    if (failed || document.hidden) return false;
    try {
      createContext();
      if (context.state !== 'running') await context.resume();
      if (document.hidden) { await context.suspend(); return false; }
      startBackground();
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
  function enterUniverse() { inUniverse = true; startBackground(); }
  function setMemoryOpen(value) {
    memoryOpen = value;
    if (context) ambience.gain.setTargetAtTime(value ? .25 : .55, context.currentTime, .5);
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
