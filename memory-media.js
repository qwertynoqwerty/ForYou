const MemoryMedia = (() => {
  const dialog = document.getElementById('memoryDialog');
  const art = document.getElementById('memoryArt');
  const status = document.getElementById('memoryMediaStatus');
  const cache = new Map();
  const queue = [...new Set(LoveContent.memories.flatMap(memory => memory.media.map(item => item.src)))];
  function preload() {
    const src = queue.shift();
    if (!src) return;
    const photo = document.createElement('img');
    cache.set(src, photo);
    const next = () => setTimeout(preload, 80);
    photo.addEventListener('load', next, { once: true });
    photo.addEventListener('error', next, { once: true });
    photo.src = src;
  }
  function open(memory) {
    status.textContent = '';
    art.replaceChildren();
    art.className = `memory-media${memory.album ? ' media-album' : ''}`;
    memory.media.forEach((item, index) => {
      const figure = document.createElement('figure');
      figure.className = 'media-photo';
      const photo = document.createElement('img');
      photo.alt = item.alt;
      photo.loading = 'eager';
      photo.decoding = 'async';
      photo.draggable = false;
      photo.addEventListener('load', () => figure.classList.add('loaded'));
      photo.addEventListener('error', () => {
        figure.classList.add('media-failed');
        status.textContent = 'Не удалось загрузить фото. Попробуй открыть историю ещё раз.';
      });
      photo.src = item.src;
      if (photo.complete && photo.naturalWidth) figure.classList.add('loaded');
      figure.append(photo);
      art.append(figure);
    });
    dialog.scrollTop = 0;
  }
  return { open, preload };
})();
