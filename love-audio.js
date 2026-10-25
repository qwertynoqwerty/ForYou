const LoveAudio = (() => {
  const preferenceKey = 'for-you:sound-enabled';
  const buttons = [...document.querySelectorAll('[data-sound-toggle]')];
  const status = document.getElementById('audioStatus');
  const voices = new Set();
  const chords = [[130.81, 164.81, 196, 246.94], [110, 130.81, 164.81, 196], [87.31, 130.81, 174.61, 220], [98, 146.83, 196, 246.94]];
  let enabled = true;
  let context;
  let output;
  let ambience;
  let backgroundTimer;
  let chordIndex = 0;
  let inUniverse = false;
  let memoryOpen = false;
  let failed = false;
  try { enabled = localStorage.getItem(preferenceKey) !== '0'; }
  catch { console.warn('Не удалось прочитать настройку звука.'); }
  function updateButtons() {
    for (const button of buttons) {
      button.disabled = failed;
      button.setAttribute('aria-pressed', String(enabled && !failed));
      button.setAttribute('aria-label', failed ? 'Звук недоступен в этом браузере' : enabled ? 'Выключить звук' : 'Включить звук');
      button.title = button.getAttribute('aria-label');
      button.dataset.enabled = String(enabled && !failed);
    }
  }
  function fail(error) {
    failed = true;
    stopBackground();
    status.textContent = 'Звук недоступен. Попробуй обновить страницу.';
    console.warn('Не удалось запустить звук.', error);
    updateButtons();
  }
  function createContext() {
    if (context) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) throw new Error('Web Audio недоступен');
    context = new Audio();
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
  function tone(frequency, start, duration, level, destination, attack = .015) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
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
    if (!enabled || document.hidden || context.state !== 'running' || !inUniverse) return;
    const start = context.currentTime + .05;
    const chord = chords[chordIndex++ % chords.length];
    chord.forEach((frequency, index) => {
      tone(frequency, start + index * .12, 11, .018, ambience, 2.4);
      tone(frequency * 1.002, start + index * .12, 11, .006, ambience, 2.4);
    });
    tone(chord[2] * 4, start + 3.5, 2.2, .018, ambience, .02);
    tone(chord[1] * 4, start + 5.8, 2.4, .012, ambience, .02);
  }
  function startBackground() {
    if (backgroundTimer || !inUniverse || !enabled || document.hidden || context?.state !== 'running') return;
    playChord();
    backgroundTimer = setInterval(playChord, 8000);
  }
  function stopBackground() {
    clearInterval(backgroundTimer);
    backgroundTimer = null;
    for (const oscillator of voices) { try { oscillator.stop(); } catch {} }
  }
  async function unlock() {
    if (!enabled || failed || document.hidden) return false;
    try {
      createContext();
      await context.resume();
      if (!enabled || document.hidden) { await context.suspend(); return false; }
      startBackground();
      return context.state === 'running';
    } catch (error) { fail(error); return false; }
  }
  async function play(kind) {
    if (!await unlock()) return;
    const now = context.currentTime + .015;
    if (kind === 'welcome') [523.25, 659.25].forEach((note, index) => bell(note, now + index * .14, .045));
    if (kind === 'success') [523.25, 659.25, 783.99].forEach((note, index) => bell(note, now + index * .22));
    if (kind === 'open') { bell(659.25, now, .04); bell(987.77, now + .1, .014); }
    if (kind === 'close') tone(392, now, .5, .035, output, .025);
  }
  function enterUniverse() { inUniverse = true; startBackground(); }
  function setMemoryOpen(value) {
    memoryOpen = value;
    if (context) ambience.gain.setTargetAtTime(value ? .25 : .55, context.currentTime, .5);
  }
  for (const button of buttons) button.addEventListener('click', async () => {
    enabled = !enabled;
    try { localStorage.setItem(preferenceKey, enabled ? '1' : '0'); }
    catch { status.textContent = 'Браузер не разрешил запомнить настройку звука.'; }
    updateButtons();
    if (enabled) { await unlock(); play('open'); }
    else { stopBackground(); if (context) { try { await context.suspend(); } catch (error) { fail(error); } } }
  });
  document.addEventListener('pointerdown', event => {
    if (!event.target.closest('[data-sound-toggle]')) unlock();
  }, { capture: true, passive: true });
  document.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('[data-sound-toggle]')) unlock();
  }, true);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopBackground();
      if (context) context.suspend().catch(fail);
    } else if (context && enabled) unlock();
  });
  updateButtons();
  return { play, enterUniverse, setMemoryOpen };
})();
