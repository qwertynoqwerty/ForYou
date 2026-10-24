const LoveContent = {
  accessPassword: '142326',
  title: 'Я люблю тебя',
  dedication: 'Среди миллиардов звёзд\nя всё равно выберу тебя.',
  phrases: ['Ты - моя вселенная', 'Ты делаешь меня лучше', 'Мне хорошо с тобой', 'Мой единственный любимый человек', 'Вкусность', 'Ты - моя нежность', 'Сладость', 'Моя жемчужина', 'Моя прекрасная', 'Ты раскрываешь меня', 'С тобой я становлюсь открытее', 'Ты мне очень дорога'],
  mobilePhrases: ['Ты - моя вселенная', 'Счастье быть рядом', 'Люблю тебя'],
  memories: [
  {
    "title": "Рядом с тобой",
    "caption": "Мы вдвоём",
    "label": "Рядом с тобой",
    "art": "embrace",
    "text": "Наш единственный совместный кадр. Наверное, он так цепляет именно потому, что здесь мы рядом.",
    "album": false,
    "transparent": false,
    "media": [
      {
        "src": "assets/memories/couple.webp",
        "alt": "Мы вместе"
      }
    ]
  },
  {
    "title": "Любоваться тобой",
    "caption": "Моя прекрасная",
    "label": "Любоваться тобой",
    "art": "photo",
    "text": "Одно из моих любимых занятий - любоваться тобой. Ты такая разная, и в каждой фотографии я нахожу что-то особенно красивое.",
    "album": true,
    "transparent": false,
    "media": [
      {
        "src": "assets/memories/portrait-hood.webp",
        "alt": "Портрет в чёрном капюшоне"
      },
      {
        "src": "assets/memories/portrait-grey.webp",
        "alt": "Портрет в серой одежде"
      },
      {
        "src": "assets/memories/portrait-orange.webp",
        "alt": "Портрет с рыжими волосами"
      },
      {
        "src": "assets/memories/portrait-purple.webp",
        "alt": "Портрет с фиолетовыми волосами"
      },
      {
        "src": "assets/memories/portrait-winter.webp",
        "alt": "Зимний портрет с синими волосами"
      },
      {
        "src": "assets/memories/portrait-evening.webp",
        "alt": "Вечерний портрет с красными волосами"
      }
    ]
  },
  {
    "title": "Наш музыкальный вкус",
    "caption": "То, что мы слушаем",
    "label": "Наш музыкальный вкус",
    "art": "heart",
    "text": "У каждого из нас есть любимая песня. Здесь они вместе.",
    "album": false,
    "transparent": true,
    "media": [
      {
        "src": "assets/memories/music-together.webp",
        "alt": "ohana - rizza и Пина Колада - CMH: наши любимые треки"
      }
    ]
  },
  {
    "title": "Наши маленькие сокровища",
    "caption": "Подарки друг другу",
    "label": "Наши маленькие сокровища",
    "art": "flowers",
    "text": "Смешные, нежные, подаренные с заботой. Каждый подарок - ещё один способ сказать, как мы дороги друг другу.",
    "album": false,
    "transparent": false,
    "media": [
      {
        "src": "assets/memories/gifts-together.webp?v=2",
        "alt": "Наши подарки в одной композиции"
      }
    ]
  }
]};
function memoryIllustration(kind) {
  return `<img src="assets/${kind}.webp" alt="" width="640" height="640" draggable="false">`;
}
