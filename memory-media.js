const MemoryMedia = (() => {
  const dialog = document.getElementById('memoryDialog');
  const art = document.getElementById('memoryArt');
  const status = document.getElementById('memoryMediaStatus');
  const cache = new Map();
  const queue = [...new Set(LoveContent.memories.flatMap(memory => memory.media.map(item => item.src)))];
  let preloading;
  let generation = 0;
  function load(src) {
    if (cache.has(src)) return cache.get(src);
    const photo = document.createElement('img');
    photo.decoding = 'async';
    photo.fetchPriority = 'low';
    const ready = new Promise(resolve => {
      photo.addEventListener('load', async () => {
        if (typeof photo.decode === 'function') {
          try { await photo.decode(); } catch { resolve(false); cache.delete(src); return; }
        }
        resolve(true);
      }, { once: true });
      photo.addEventListener('error', () => { cache.delete(src); resolve(false); }, { once: true });
    });
    const record = { photo, ready };
    cache.set(src, record);
    photo.src = src;
    return record;
  }
  function preload() {
    if (preloading) return preloading;
    const worker = async () => {
      while (queue.length) await load(queue.shift()).ready;
    };
    preloading = Promise.all([worker(), worker()]);
    return preloading;
  }
  function open(memory) {
    const current = ++generation;
    status.textContent = '';
    art.replaceChildren();
    art.className = `memory-media${memory.album ? ' media-album' : ''}`;
    memory.media.forEach((item, index) => {
      const figure = document.createElement('figure');
      figure.className = 'media-photo';
      const { photo, ready } = load(item.src);
      photo.alt = item.alt;
      photo.loading = 'eager';
      photo.decoding = 'async';
      photo.fetchPriority = 'high';
      photo.draggable = false;
      ready.then(loaded => {
        if (current !== generation) return;
        if (loaded) figure.classList.add('loaded');
        else {
          figure.classList.add('media-failed');
          status.textContent = 'Не удалось загрузить фото. Попробуй открыть историю ещё раз.';
        }
      });
      if (photo.complete && photo.naturalWidth) figure.classList.add('loaded');
      figure.append(photo);
      art.append(figure);
    });
    dialog.scrollTop = 0;
  }
  return { open, preload };
})();
