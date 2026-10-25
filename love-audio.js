const LoveAudio = (() => {
  const status = document.getElementById('audioStatus');
  const voices = new Set();
  const chords = [[130.81, 164.81, 196, 246.94], [110, 130.81, 164.81, 196], [87.31, 130.81, 174.61, 220], [98, 146.83, 196, 246.94]];
  let context;
  let output;
  let ambience;
  let backgroundTimer;
  let chordIndex = 0;
  let memoryOpen = false;
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
    filter.frequency.value = 1500;
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
  function bell(frequency, start, level = .055) {
    tone(frequency, start, 1.6, level, output);
    tone(frequency * 2, start, .65, level * .16, output);
    tone(frequency * 3, start, .3, level * .035, output);
  }
  function playChord() {
    if (document.hidden || context.state !== 'running') return;
    const start = context.currentTime + .01;
    const chord = chords[chordIndex++ % chords.length];
    chord.forEach((frequency, index) => {
      tone(frequency, start + index * .12, 11, .018, ambience, .3);
      tone(frequency * 1.002, start + index * .12, 11, .006, ambience, .3);
    });
    tone(chord[2] * 4, start + .15, 2.2, .018, ambience, .02);
    tone(chord[1] * 4, start + 5.8, 2.4, .012, ambience, .02);
  }
  function startBackground() {
    if (backgroundTimer || document.hidden || context?.state !== 'running') return;
    playChord();
    backgroundTimer = setInterval(playChord, 8000);
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
    if (!await unlock()) return;
    const now = context.currentTime + .015;
    if (kind === 'press') {
      tone(420, now, .11, .07, output, .003, 280);
      tone(840, now, .045, .008, output, .002, 560);
    }
    if (kind === 'success') [523.25, 659.25, 783.99].forEach((note, index) => bell(note, now + index * .22));
  }
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
  return { play, setMemoryOpen };
})();
