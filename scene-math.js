const SceneMath = (() => {
  const isMobileRendering = () => innerWidth < 600 || (matchMedia('(pointer: coarse)').matches && Math.min(innerWidth, innerHeight) < 600);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const smooth = (start, end, value) => {
    const t = clamp((value - start) / (end - start), 0, 1);
    return t * t * (3 - 2 * t);
  };
  function layout(width, height) {
    const w = Math.max(240, width);
    const h = Math.max(240, height);
    const portrait = w < h * .85;
    const landscape = w > h * 1.5 && h < 600;
    const compact = h < 300;
    const cardSize = compact ? (w < 600 ? 44 : 64) : landscape ? 72 : w < 600 ? clamp(w * .15, 46, 64) : 136;
    const scale = Math.max(.18, Math.min(portrait ? w / 520 : w / 1100, h / (landscape ? 690 : 690), 2.4));
    const cy = h * (landscape ? .54 : portrait ? .48 : .56);
    const heartLift = landscape ? Math.max(40, (cy - 115) / (scale * .9) - 110) : portrait ? 200 : 135;
    const headingY = landscape ? 10 : portrait ? clamp(h * .07, 24, 64) : 24;
    return { width: w, height: h, scale, cx: w / 2, cy, pitch: portrait ? .48 : .43, distance: 2200, heartLift, headingY, cardSize, top: Math.min(h - 145, portrait ? Math.max(140, h * .17) : 120), bottom: h - 38, left: cardSize / 2 + 12, right: w - cardSize / 2 - 12, landscape, portrait, compact };
  }
  function project(x, y, z, view, yaw = 0) {
    const cosine = Math.cos(yaw);
    const sine = Math.sin(yaw);
    const rx = x * cosine - z * sine;
    const rz = x * sine + z * cosine;
    const depth = view.distance / Math.max(900, view.distance - rz * Math.cos(view.pitch) + y * Math.sin(view.pitch));
    return { x: view.cx + rx * view.scale * depth, y: view.cy + (rz * Math.sin(view.pitch) - y * Math.cos(view.pitch)) * view.scale * depth, depth };
  }
  function stages(seconds, animated) {
    const t = animated ? clamp(seconds / 5.2, 0, 1) : 1;
    return { progress: t, disc: smooth(.04, .78, t), heart: smooth(.3, .82, t), details: smooth(.5, 1, t), title: smooth(.28, .65, t) };
  }
  function arrangeCards(view, time, yaw, count) {
    const half = view.cardSize / 2;
    if (view.width < 600 && view.portrait && !view.compact) {
      const available = Math.max(40, view.height - 38 - view.cy);
      const edgeRadius = available * view.distance / (view.scale * view.distance * Math.sin(view.pitch) + available * Math.cos(view.pitch));
      const radius = (295 + Math.min(540, edgeRadius * .94)) / 2;
      return Array.from({ length: count }, (_, index) => {
        const angle = index / count * Math.PI * 2 + time * .105 - Math.PI / 2;
        const point = project(Math.cos(angle) * radius, 14, Math.sin(angle) * radius, view, yaw);
        return { x: point.x, y: point.y, depth: point.depth };
      });
    }
    if (view.compact) {
      const columns = Math.max(1, Math.min(count, Math.floor((view.width - 12) / (view.cardSize + 8))));
      const rows = Math.ceil(count / columns);
      const gap = view.cardSize + 8;
      const centerY = Math.min(view.height * .55, view.height - 74 - half - (rows - 1) * gap / 2);
      return Array.from({ length: count }, (_, index) => {
        const row = Math.floor(index / columns);
        const amount = Math.min(columns, count - row * columns);
        return { x: view.cx + (index % columns - (amount - 1) / 2) * gap, y: centerY + (row - (rows - 1) / 2) * gap, depth: 1 };
      });
    }
    const upper = Math.max(half + 3, view.top + half);
    const lower = Math.max(upper, view.bottom - half);
    const cards = Array.from({ length: count }, (_, index) => {
      const angle = index / count * Math.PI * 2 + time * .105 - Math.PI / 2;
      const radiusX = Math.max(30, (view.width - view.cardSize) * .38 - 12);
      const radiusY = Math.max(20, (view.bottom - view.top - view.cardSize) * .39);
      const turn = angle + yaw;
      return { x: clamp(view.cx + Math.cos(turn) * radiusX, view.left, view.right), y: clamp((upper + lower) / 2 + Math.sin(turn) * radiusY, upper, lower), depth: 1 + Math.sin(turn) * .055 };
    });
    const gap = view.cardSize + 8;
    for (let pass = 0; pass < 20; pass++) {
      for (let a = 0; a < cards.length; a++) {
        for (let b = a + 1; b < cards.length; b++) {
          const dx = cards[b].x - cards[a].x;
          const dy = cards[b].y - cards[a].y;
          const distance = Math.hypot(dx, dy);
          if (distance >= gap) continue;
          const nx = distance > .01 ? dx / distance : 1;
          const ny = distance > .01 ? dy / distance : .5;
          const move = (gap - distance) * .53;
          cards[a].x = clamp(cards[a].x - nx * move, view.left, view.right);
          cards[a].y = clamp(cards[a].y - ny * move, upper, lower);
          cards[b].x = clamp(cards[b].x + nx * move, view.left, view.right);
          cards[b].y = clamp(cards[b].y + ny * move, upper, lower);
        }
      }
    }
    return cards;
  }
  function random(seed) {
    let state = seed >>> 0;
    return () => {
      state = Math.imul(1664525, state) + 1013904223 | 0;
      return (state >>> 0) / 4294967296;
    };
  }
  return { clamp, smooth, layout, project, stages, arrangeCards, random, isMobileRendering };
})();
if (typeof module !== 'undefined') module.exports = SceneMath;
