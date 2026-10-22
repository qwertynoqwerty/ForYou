const MemoryMedia = (() => {
  const dialog = document.getElementById('memoryDialog');
  const art = document.getElementById('memoryArt');
  const status = document.getElementById('memoryMediaStatus');
  function open(memory) {
    status.textContent = '';
    art.replaceChildren();
    art.className = `memory-media${memory.album ? ' media-album' : ''}`;
    memory.media.forEach((item, index) => {
      const figure = document.createElement('figure');
      figure.className = 'media-photo';
      const photo = document.createElement('img');
      photo.alt = item.alt;
      photo.loading = index < 2 ? 'eager' : 'lazy';
      photo.decoding = 'async';
      photo.draggable = false;
      photo.addEventListener('load', () => figure.classList.add('loaded'));
      photo.addEventListener('error', () => {
        figure.classList.add('media-failed');
        status.textContent = 'Не удалось загрузить фото. Попробуй открыть историю ещё раз.';
      });
      photo.src = item.src;
      figure.append(photo);
      art.append(figure);
    });
    dialog.scrollTop = 0;
  }
  return { open };
})();