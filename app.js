const canvas = document.getElementById('universe');
const glyphRenderer = innerWidth < 600 ? new GlyphRenderer(canvas) : null;
const context = glyphRenderer ? glyphRenderer.context : canvas.getContext('2d');
const scene = document.getElementById('scene');
const welcome = document.getElementById('welcome');
const heading = document.querySelector('.scene-heading');
document.getElementById('sceneTitle').textContent = LoveContent.title;
const dialog = document.getElementById('memoryDialog');
const accessDialog = document.getElementById('accessDialog');
const accessForm = document.getElementById('accessForm');
const passwordInput = document.getElementById('passwordInput');
const accessError = document.getElementById('accessError');
const accessStorageKey = 'for-you:access-granted';
const { clamp, smooth, layout, project, stages } = SceneMath;
let renderer;
let heartRenderer;
let view;
let targetView;
let pixelRatio = 1;
let quality = 1;
let started = false;
let animated = true;
let paused = false;
const tint = 1;
let orbitTime = 0;
let introTime = 0;
let yaw = 0;
let orbitYaw = 0;
let targetYaw = 0;
let dragPointer = null;
let dragX = 0;
let frameId = 0;
let lastTime = 0;
let lastMetrics = 0;
let samples = [];
let frameIntervals = [];
let lastTrigger = null;
let textures;
let frameDelta = 0;
let lastPhraseFrame = 0;
let phraseElapsed = 0;
let mediaPreloadStarted = false;
const phraseOpacity = [];
let accessTransition = false;
const waitForFade = element => new Promise(resolve => {
  const animation = element.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 700, easing: 'ease-in-out', fill: 'forwards' });
  animation.finished.then(resolve, resolve);
});
document.getElementById('dedication').textContent = LoveContent.dedication;
accessForm.noValidate = true;
const cards = LoveContent.memories.map((memory, index) => {
  const button = document.createElement('button');
  button.className = 'memory-card';
  button.type = 'button';
  button.setAttribute('aria-label', memory.label);
  button.setAttribute('aria-haspopup', 'dialog');
  button.innerHTML = `<span class="sticker">${memoryIllustration(memory.art)}</span>`;
  button.addEventListener('click', () => openMemory(index, button));
  document.getElementById('memories').append(button);
  return button;
});
const cardMotion = cards.map(() => ({ x: null, y: null }));
function makeTextures() {
  const glyphs = new Map();
  const makeGlyph = letter => {
    if (glyphs.has(letter)) return glyphs.get(letter);
    const image = document.createElement('canvas');
    const painter = image.getContext('2d');
    painter.font = 'italic 32px Georgia';
    const advance = painter.measureText(letter).width + 1.2;
    image.width = Math.ceil(advance + 10);
    image.height = 44;
    painter.font = 'italic 32px Georgia';
    painter.textBaseline = 'middle';
    painter.fillStyle = '#ffc3b9';
    painter.fillText(letter, 5, 22);
    const glyph = { image, advance };
    glyphs.set(letter, glyph);
    return glyph;
  };
  const makeText = text => {
    const letters = Array.from(text, makeGlyph);
    return { letters, width: letters.reduce((sum, glyph) => sum + glyph.advance, 0) };
  };
  return { texts: LoveContent.phrases.map(makeText), mobileTexts: LoveContent.mobilePhrases.map(makeText) };
}
function showRenderError() {
  const message = document.createElement('p');
  message.setAttribute('role', 'alert');
  message.textContent = 'Не удалось открыть объёмную сцену. Обнови браузер и включи аппаратное ускорение.';
  welcome.querySelector('.invitation').append(message);
  document.getElementById('openButton').disabled = true;
}
try {
  renderer = new GalaxyRenderer(document.getElementById('galaxy'));
  heartRenderer = new GalaxyRenderer(document.getElementById('heartLayer'), true);
}
catch (error) { console.error(error); showRenderError(); }
function resize() {
  targetView = layout(innerWidth, innerHeight);
  if (!view) view = { ...targetView };
  pixelRatio = Math.min(devicePixelRatio || 1, innerWidth < 600 || quality < .7 ? 1 : 1.5);
  canvas.width = Math.round(innerWidth * pixelRatio);
  canvas.height = Math.round(innerHeight * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  const particleRatio = innerWidth < 600 && quality < .7 ? .85 : pixelRatio;
  if (renderer) renderer.resize(innerWidth, innerHeight, particleRatio);
  if (heartRenderer) heartRenderer.resize(innerWidth, innerHeight, particleRatio);
  document.body.style.setProperty('--card-size', targetView.cardSize + 'px');

  requestRender();
}
function requestRender() {
  if (!frameId && !document.hidden) frameId = requestAnimationFrame(render);
}
function restartClock() {
  lastTime = 0;
  requestRender();
}
function isMoving() {
  return started && !paused && !document.hidden;
}
function render(now) {
  frameId = 0;
  if (innerWidth < 600 && lastTime && now - lastTime < (dialog.open || accessDialog.open ? 30 : 15)) { requestRender(); return; }
  const begin = performance.now();
  const interval = lastTime ? now - lastTime : 0;
  const delta = Math.min(interval / 1000, .04);
  frameDelta = delta;
  lastTime = now;
  if (isMoving()) {
    if (interval > 0) frameIntervals.push(interval);
    orbitTime += delta;
    introTime += delta;
    yaw += (targetYaw - yaw) * (1 - Math.exp(-delta * 9));
    orbitYaw += (yaw - orbitYaw) * (1 - Math.exp(-delta * 14));
  }
  if (view && targetView) {
    const blend = 1 - Math.exp(-Math.max(delta, .001) * 6);
    for (const key of ['scale', 'cx', 'cy', 'pitch', 'heartLift', 'headingY', 'cardSize']) view[key] += (targetView[key] - view[key]) * blend;
    for (const key of ['width', 'height', 'portrait', 'landscape', 'compact', 'top', 'bottom', 'left', 'right']) view[key] = targetView[key];
    if (Math.abs(targetView.cardSize - view.cardSize) > .01) document.body.style.setProperty('--card-size', view.cardSize + 'px');
  }
  phraseElapsed += delta;
  const stage = stages(introTime, animated);
  if (renderer) renderer.draw(view, orbitTime, started ? stage.progress : -1, orbitYaw, tint);
  if (heartRenderer) heartRenderer.draw(view, orbitTime, started ? stage.progress : -1, orbitYaw, tint);
  if (started) drawScene(stage);
  if (now - lastMetrics > 450) {
    lastMetrics = now;
    canvas.dataset.progress = stage.progress.toFixed(3);
    canvas.dataset.time = orbitTime.toFixed(3);
    canvas.dataset.renderMs = (performance.now() - begin).toFixed(2);
    canvas.dataset.particles = String((renderer ? renderer.count : 0) + (heartRenderer ? heartRenderer.count : 0));
  }
  if (isMoving()) {
    samples.push(performance.now() - begin);
    if (samples.length === 90) {
      const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
      const sorted = frameIntervals.slice().sort((a, b) => a - b);
      canvas.dataset.frameP95 = sorted.length ? sorted[Math.floor((sorted.length - 1) * .95)].toFixed(2) : '0';
      canvas.dataset.averageRenderMs = average.toFixed(2);
      samples = [];
      frameIntervals = [];
      const frameP95 = sorted.length ? sorted[Math.floor((sorted.length - 1) * .95)] : 0;
      if ((average > 14 || frameP95 > 26) && quality > .6) { quality = .6; resize(); }
    }
    requestRender();
  }
}
function drawScene(stage) {
  const camera = view;
  const headingTop = (view.landscape ? 8 : 20) + 'px';
  if (heading.style.top !== headingTop) heading.style.top = headingTop;
  if (stage.title < 1 || heading.style.opacity !== '1') heading.style.opacity = String(stage.title);
  if (stage.details > 0) {
    context.clearRect(0, 0, innerWidth, innerHeight);
    const previousDelta = frameDelta;
    frameDelta = phraseElapsed;
    drawPhrases(stage.details, camera);
    if (glyphRenderer) glyphRenderer.flush();
    frameDelta = previousDelta;
    phraseElapsed = 0;
    lastPhraseFrame = orbitTime;
  }
  context.globalAlpha = 1;
  const positions = SceneMath.arrangeCards(view, orbitTime, orbitYaw, cards.length);
  cards.forEach((button, index) => {
    const position = positions[index];
    const fly = 1 - Math.pow(1 - stage.details, 3);
    const x = view.cx + (position.x - view.cx) * fly;
    const y = view.cy + (position.y - view.cy) * fly;
    const current = cardMotion[index];
    current.x = x;
    current.y = y;
    const size = clamp(position.depth, .92, 1.08) * (.2 + stage.details * .8);
    button.style.transform = `translate3d(${current.x - view.cardSize / 2}px,${current.y - view.cardSize / 2}px,0)`;
    button.style.setProperty('--sticker-scale', size.toFixed(3));
    const zIndex = String(Math.round(position.depth * 100));
    if (button.style.zIndex !== zIndex) button.style.zIndex = zIndex;
    const cardOpacity = stage.details * (position.visibility ?? 1);
    if (stage.details < 1 || button.style.opacity !== String(cardOpacity)) {
      button.style.opacity = String(cardOpacity);
      button.style.visibility = 'visible';
      button.inert = cardOpacity < .5;
    }
  });
  const ready = stage.progress >= 1;
  if (ready && !mediaPreloadStarted) { mediaPreloadStarted = true; MemoryMedia.preload(); }
  const phase = ready ? 'ready' : 'revealing';
  if (scene.dataset.phase !== phase) scene.dataset.phase = phase;
  if (stage.progress >= .17 && !welcome.hidden) welcome.hidden = true;
}
function drawPhrases(opacity, camera) {
  const mobile = view.width < 600;
  const yawCos = Math.cos(orbitYaw);
  const yawSin = Math.sin(orbitYaw);
  const pitchCos = Math.cos(camera.pitch);
  const pitchSin = Math.sin(camera.pitch);
  const phraseProject = mobile ? (x, y, z) => {
    const rx = x * yawCos - z * yawSin;
    const rz = x * yawSin + z * yawCos;
    const depth = camera.distance / Math.max(900, camera.distance - rz * pitchCos + y * pitchSin);
    return { x: camera.cx + rx * camera.scale * depth, y: camera.cy + (rz * pitchSin - y * pitchCos) * camera.scale * depth, depth };
  } : project;
  const texts = textures.texts.slice(0, 12);
  const count = texts.length;
  const perRing = 4;
  for (let index = 0; index < count; index++) {
    const ring = Math.floor(index / perRing);
    const available = Math.max(40, view.height - 38 - view.cy);
    const edgeRadius = available * view.distance / (view.scale * view.distance * Math.sin(view.pitch) + available * Math.cos(view.pitch));
    const radius = ring === 2 ? Math.min(mobile ? 540 : 570, edgeRadius * .94) : (mobile ? 170 : 190) + ring * 125;
    const angle = index % perRing * Math.PI * 2 / perRing + ring * .44 + orbitTime * .07;
    const phrase = texts[index];
    if (Math.sin(angle + orbitYaw) < -.65 && (phraseOpacity[index] || 0) < .005) continue;
    const worldScale = (mobile ? 15 : 17) / 32;
    const center = phraseProject(Math.cos(angle) * radius, 14, Math.sin(angle) * radius, camera, orbitYaw);
    const tangent = phraseProject(Math.cos(angle + .008) * radius, 14, Math.sin(angle + .008) * radius, camera, orbitYaw);
    const direction = tangent.x >= center.x ? 1 : -1;
    const prepared = [];
    let legibility = 1;
    let front = 1;
    let pen = -phrase.width / 2;
    const phraseReveal = smooth(.04 + ring * .06, .62 + ring * .06, opacity);
    for (const glyph of phrase.letters) {
      const a = angle + direction * (pen + glyph.advance / 2) * worldScale / radius;
      front = Math.min(front, smooth(-.08, .72, Math.sin(a + orbitYaw)));
      const p = phraseProject(Math.cos(a) * radius, 14, Math.sin(a) * radius, camera, orbitYaw);
      const next = phraseProject(Math.cos(a + direction * .008) * radius, 14, Math.sin(a + direction * .008) * radius, camera, orbitYaw);
      const scale = worldScale * view.scale * Math.min(p.depth, 1.4);
      const rotation = Math.atan2(next.y - p.y, next.x - p.x);
      legibility = Math.min(legibility, Math.cos(rotation));
      prepared.push({ glyph, p, scale, rotation });
      pen += glyph.advance;
    }
    const desiredOpacity = phraseReveal * front * smooth(.0, .45, legibility) * .78;
    const response = 1 - Math.exp(-frameDelta * 4);
    phraseOpacity[index] = (phraseOpacity[index] || 0) + (desiredOpacity - (phraseOpacity[index] || 0)) * response;
    for (const { glyph, p, scale, rotation } of prepared) {
      if (mobile || glyphRenderer) {
        const cosine = Math.cos(rotation) * pixelRatio;
        const sine = Math.sin(rotation) * pixelRatio;
        context.setTransform(cosine, sine, -sine, cosine, p.x * pixelRatio, p.y * pixelRatio);
        context.globalAlpha = phraseOpacity[index];
        context.drawImage(glyph.image, -glyph.image.width * scale / 2, -glyph.image.height * scale / 2, glyph.image.width * scale, glyph.image.height * scale);
        continue;
      }
      context.save();
      context.translate(p.x, p.y);
      context.rotate(rotation);
      context.globalAlpha = phraseOpacity[index];
      context.drawImage(glyph.image, -glyph.image.width * scale / 2, -glyph.image.height * scale / 2, glyph.image.width * scale, glyph.image.height * scale);
      context.restore();
    }
  }
  if (mobile || glyphRenderer) context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}
let memoryClosing = false;
let memoryEntrance = null;
function closeMemory() {
  if (memoryClosing || !dialog.open) return Promise.resolve();
  memoryClosing = true;
  dialog.classList.add('is-closing');
  memoryEntrance?.commitStyles?.();
  memoryEntrance?.cancel?.();
  const animation = dialog.animate([{ opacity: 0, transform: 'translateY(6px) scale(.99)' }], { duration: 220, easing: 'ease-in', fill: 'forwards' });
  return animation.finished.catch(() => {}).then(() => {
    dialog.close();
    animation.cancel?.();
    dialog.style.opacity = '';
    dialog.style.transform = '';
    dialog.classList.remove('is-closing');
    memoryClosing = false;
  });
}
function openMemory(index, trigger) {
  if (memoryClosing) return;
  lastTrigger = trigger;
  const memory = LoveContent.memories[index];
  dialog.classList.add('gentle');
  dialog.classList.toggle('has-album', !!memory.album);
  document.getElementById('memoryTitle').textContent = memory.title;
  document.getElementById('memoryCaption').textContent = memory.caption;
  document.getElementById('memoryText').textContent = memory.text;
  MemoryMedia.open(memory);
  dialog.showModal();
  memoryEntrance = dialog.animate([{ opacity: 0, transform: 'translateY(6px) scale(.99)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], { duration: 240, easing: 'ease-out', fill: 'forwards' });
  restartClock();
}
function start() {
  if (started) return;
  started = true;
  animated = true;
  paused = false;
  orbitTime = 0;
  introTime = 0;
  yaw = 0;
  orbitYaw = 0;
  targetYaw = 0;
  scene.hidden = false;
  scene.dataset.phase = 'revealing';
  welcome.classList.add('leaving');
  welcome.inert = true;
  scene.focus({ preventScroll: true });
  restartClock();
}
async function openAccess() {
  if (accessTransition || started) return;
  accessTransition = true;
  welcome.inert = true;
  await waitForFade(welcome);
  welcome.hidden = true;
  accessForm.reset();
  accessError.textContent = '';
  passwordInput.type = 'password';
  passwordInput.removeAttribute('aria-invalid');
  document.getElementById('showPasswordButton').setAttribute('aria-label', 'Показать пароль');
  document.getElementById('showPasswordButton').setAttribute('aria-pressed', 'false');
  accessDialog.showModal();
  const arrival = accessDialog.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 1550, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' });
  await arrival.finished.catch(() => {});
  passwordInput.focus();
  accessTransition = false;
}
function releasePointer(event) {
  if (dragPointer !== event.pointerId) return;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  dragPointer = null;
  canvas.classList.remove('dragging');
}
canvas.addEventListener('pointerdown', event => {
  if (!started || dialog.open || accessDialog.open || event.button !== 0) return;
  dragPointer = event.pointerId;
  if (cards.includes(document.activeElement)) document.activeElement.blur();
  dragX = event.clientX;
  targetYaw = yaw;
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add('dragging');
});
canvas.addEventListener('pointermove', event => {
  if (dragPointer !== event.pointerId) return;
  targetYaw += (event.clientX - dragX) * .004;
  dragX = event.clientX;
  if (!isMoving()) { yaw = targetYaw; orbitYaw = targetYaw; }
  requestRender();
});
canvas.addEventListener('pointerup', releasePointer);
canvas.addEventListener('pointercancel', releasePointer);
canvas.addEventListener('lostpointercapture', () => { dragPointer = null; canvas.classList.remove('dragging'); });
document.getElementById('openButton').addEventListener('click', openAccess);
accessForm.addEventListener('submit', async event => {
  if (accessTransition) { event.preventDefault(); return; }
  event.preventDefault();
  const value = passwordInput.value.trim();
  if (value !== LoveContent.accessPassword) {
    accessError.textContent = value ? 'Кажется, это не наш секрет. Попробуй ещё раз.' : 'Введи наш маленький секрет.';
    passwordInput.setAttribute('aria-invalid', 'true');
    passwordInput.focus();
    passwordInput.select();
    return;
  }
  accessTransition = true;
  document.getElementById('accessSubmit').disabled = true;
  try {
    localStorage.setItem(accessStorageKey, '1');
  } catch {
    console.warn('Браузер не разрешил запомнить вход на этом устройстве.');
  }
  await waitForFade(accessDialog);
  accessDialog.close();
  start();
  accessTransition = false;
});
passwordInput.addEventListener('input', () => { accessError.textContent = ''; passwordInput.removeAttribute('aria-invalid'); });
document.getElementById('showPasswordButton').addEventListener('click', () => {
  const show = passwordInput.type === 'password';
  passwordInput.type = show ? 'text' : 'password';
  document.getElementById('showPasswordButton').setAttribute('aria-label', show ? 'Скрыть пароль' : 'Показать пароль');
  document.getElementById('showPasswordButton').setAttribute('aria-pressed', String(show));
  passwordInput.focus();
});
accessDialog.addEventListener('cancel', event => event.preventDefault());
dialog.addEventListener('cancel', event => event.preventDefault());
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => closeMemory()));
for (const modal of [dialog, accessDialog]) {
  modal.addEventListener('click', event => {
    if (modal === accessDialog || event.target !== modal) return;
    const rect = modal.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return closeMemory();
  });
  modal.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const elements = Array.from(modal.querySelectorAll('button:not([disabled]), input:not([disabled])')).filter(element => !element.closest('[hidden]'));
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (!first) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    else if (!elements.includes(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
  });
}
dialog.addEventListener('close', () => { if (lastTrigger && started) lastTrigger.focus({ preventScroll: true }); restartClock(); });
addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { cancelAnimationFrame(frameId); frameId = 0; lastTime = 0; }
  else { restartClock(); }
});
for (const id of ['galaxy', 'heartLayer']) document.getElementById(id).addEventListener('webglcontextlost', event => { event.preventDefault(); paused = true; document.getElementById('audioStatus').textContent = 'Графическая сцена приостановлена. Обнови страницу, чтобы восстановить её.'; });
textures = makeTextures();
resize();
try {
  if (renderer && heartRenderer && localStorage.getItem(accessStorageKey) === '1') {
    welcome.hidden = true;
    start();
  } else {
    welcome.hidden = false;
  }
} catch {
  welcome.hidden = false;
  console.warn('Браузер не разрешил прочитать сохранённый вход.');
}
