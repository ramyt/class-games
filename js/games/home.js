/* ============================================================
   Landing page - choose the game of the day
   ============================================================ */
(function () {
  'use strict';
  const ICG = window.ICG, h = ICG.h;

  // The cards on the landing page, in this order.
  // Games that are not built yet show as "Coming soon".
  const CATALOG = [
    { id: 'race', title: 'Team Race', picture: 'racing-car', desc: 'Answer to move your team to the finish!' },
    { id: 'boxes', title: 'Mystery Boxes', picture: 'gift', desc: 'Open a box. What surprise is inside?' },
    { id: 'reveal', title: 'Picture Reveal', picture: 'puzzle', desc: 'Guess the hidden picture' },
    { id: 'hotseat', title: 'Hot Seat', picture: 'chair', desc: 'Give clues. Can they guess the word?' },
    { id: 'missing', title: "What's Missing?", picture: 'magnifier', desc: 'Look, remember, find what is gone' },
    { id: 'snowman', title: 'Save the Snowman', picture: 'snowman', desc: 'Guess the letters before he melts' },
    { id: 'board', title: 'Dice Board Game', picture: 'dice', desc: 'Roll the dice and race around the board' },
    { id: 'oddone', title: 'Odd One Out', picture: 'target', desc: "Which one doesn't belong? Why?" }
  ];
  ICG.catalog = CATALOG;
  const isReady = id => ICG.games[id] && ICG.games[id].ready;

  ICG.register('home', {
    mount(stage) {
      const cards = {};
      const grid = h('div', { class: 'home-grid' },
        CATALOG.map(g => {
          const ready = isReady(g.id);
          const card = h('button', {
            class: 'game-card' + (ready ? '' : ' soon'),
            onclick: () => { if (ready) location.hash = g.id; else ICG.toast(g.title + ' is coming soon!'); }
          },
            ICG.picture(g.picture, 'images/app'),
            h('div', null, h('div', { class: 'gname' }, g.title), h('div', { class: 'gdesc' }, g.desc)),
            ready ? null : h('div', { class: 'badge' }, 'Coming soon'));
          cards[g.id] = card;
          return card;
        }));

      const spinToday = () => {
        // Spin the Wheel is a tool, not a game of the day
        const list = CATALOG.filter(g => isReady(g.id) && g.id !== 'wheel');
        ICG.openWheel({
          title: "Today's game",
          entries: list.map(g => g.title),
          onPick: (entry, close) => {
            const g = list.find(x => x.title === entry.label);
            Object.values(cards).forEach(c => c.classList.remove('today'));
            cards[g.id].classList.add('today');
            ICG.sound.win();
            return h('button', { class: 'btn big green', onclick: () => { close(); location.hash = g.id; } }, "Let's play!");
          }
        });
      };

      const soundBtn = h('button', { class: 'iconbtn', html: ICG.icon(ICG.sound.muted ? 'mute' : 'sound') });
      soundBtn.onclick = () => { const S = ICG.sound; S.muted = !S.muted; ICG.store.set('muted', S.muted); soundBtn.innerHTML = ICG.icon(S.muted ? 'mute' : 'sound'); if (!S.muted) S.pop(); };

      stage.append(
        h('div', { class: 'home-head' },
          h('h1', null, 'Class Games'),
          h('button', { class: 'iconbtn wide', title: 'Pick a student', html: ICG.icon('wheel') + '<span>Pick</span>', onclick: () => ICG.openWheel({}) }),
          soundBtn,
          h('button', { class: 'btn ghost', style: { minHeight: '76px', fontSize: '30px' }, onclick: ICG.toggleFull, html: ICG.icon('full') + '<span>Full screen</span>' })
        ),
        grid,
        h('div', { class: 'home-foot' },
          h('button', { class: 'btn yellow', onclick: spinToday, html: ICG.icon('wheel') + "<span>Spin for today's game</span>" }),
          h('button', { class: 'btn ghost', onclick: () => { location.hash = 'classes'; } }, 'Classes & teams'),
          h('div', { class: 'credit' }, 'Pictures: Noto Emoji by Google (Apache 2.0)')
        )
      );
    }
  });
})();
