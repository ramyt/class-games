/* ============================================================
   Mystery Boxes
   A team picks a box, answers a question, and opens the box
   to find a (kind!) surprise inside.
   ============================================================ */
(function () {
  'use strict';
  const ICG = window.ICG, h = ICG.h, S = ICG.sound, T = ICG.T;

  /* ----- What can be inside the boxes -----
     kind   : points | double | everyone | give (team may give points to another team, or say no thanks) | fun
     n      : points for that surprise
     count  : how many of these in a game of 20 boxes (fewer boxes = fewer of each)
     picture: file name in the images folder
     text   : what the screen says */
  const SURPRISES = [
    { kind: 'points', n: 1, count: 4, picture: 'star', text: '+1 point' },
    { kind: 'points', n: 2, count: 5, picture: 'balloon', text: '+2 points' },
    { kind: 'points', n: 3, count: 3, picture: 'cake', text: '+3 points' },
    { kind: 'points', n: 5, count: 2, picture: 'crown', text: '+5 points!' },
    { kind: 'double', n: 0, count: 1, picture: 'rocket', text: 'Double points!' },
    { kind: 'everyone', n: 1, count: 2, picture: 'party', text: 'Everyone gets +1!' },
    { kind: 'give', n: 2, count: 2, picture: 'rose', text: 'Kind choice!' },
    { kind: 'fun', n: 0, count: 1, picture: 'guitar', text: 'Dance time! Everyone stand up and dance!' }
  ];
  const BOX_HUES = [0, 40, 90, 150, 200, 260, 310];

  const DEFAULTS = { nTeams: 2, boxes: 16, level: 'both', packs: null };
  function loadSettings() {
    const s = Object.assign({}, DEFAULTS, ICG.store.get('boxes.settings', {}));
    s.teams = T.loadTeams(); s.packs = T.cleanPacks(s.packs);
    return s;
  }
  function fillBoxes(n) {
    let pool = [];
    SURPRISES.forEach(x => { for (let i = 0; i < x.count; i++) pool.push(x); });
    pool = ICG.shuffle(pool);
    // keep the mix fair when there are fewer than 20 boxes
    const pick = ICG.shuffle(pool).slice(0, n);
    if (!pick.some(x => x.n >= 5)) pick[0] = SURPRISES.find(x => x.n === 5);
    return ICG.shuffle(pick);
  }

  let root = null, keyHandler = null;
  const cleanup = () => { if (keyHandler) document.removeEventListener('keydown', keyHandler); keyHandler = null; };

  ICG.register('boxes', {
    title: 'Mystery Boxes', ready: true,
    mount(stage) { root = stage; showSetup(); },
    unmount: cleanup
  });

  /* ======================= SETUP ======================= */
  function showSetup() {
    cleanup();
    const s = loadSettings();
    root.innerHTML = ''; root.className = 'setup';
    const body = h('div', { class: 'setup-card card' });
    const save = () => { const c = Object.assign({}, s); delete c.teams; ICG.store.set('boxes.settings', c); };
    const set = (k) => v => { s[k] = v; save(); render(); };
    function render() {
      body.innerHTML = '';
      body.append(h('div', { class: 'srow' }, h('div', { class: 'slabel' }, 'Teams'),
        T.teamSeg(s.nTeams, set('nTeams')),
        h('div', { class: 'slabel', style: { width: 'auto', marginLeft: '40px' } }, 'Boxes'),
        T.seg([[12, '12'], [16, '16'], [20, '20']], s.boxes, set('boxes'))));
      body.append(h('div', { class: 'srow' }, h('div', { class: 'slabel' }, ''), T.teamChips(s.teams, s.nTeams, () => { save(); render(); })));
      body.append(T.teamHint());
      body.append(T.classRow(s.nTeams, s.teams, () => { save(); render(); }));
      body.append(h('div', { class: 'srow top' }, h('div', { class: 'slabel' }, 'Questions'), T.packChips(s, () => { save(); render(); })));
      body.append(h('div', { class: 'srow' }, h('div', { class: 'slabel' }, 'Level'),
        T.seg([['easy', 'Easy'], ['harder', 'Harder'], ['both', 'Both']], s.level, set('level'))));
      const n = T.buildDeck(s).length;
      body.append(h('div', { class: 'srow end' },
        h('div', { class: 'small-note', style: { flex: 1, textAlign: 'left' } }, s.packs.includes(T.OWN) ? 'You will ask the questions yourself.' : n + ' questions ready'),
        h('button', { class: 'btn big green', onclick: () => startGame(s) }, "Let's go!")));
    }
    root.append(ICG.topbar('Mystery Boxes - Setup'), body);
    render();
  }

  /* ======================= GAME ======================= */
  function startGame(s) {
    if (!T.studentsOk()) return;
    cleanup();
    const teams = T.makeTeams(s.teams, s.nTeams);
    const deck = T.deck(s);
    if (!deck.own && !T.buildDeck(s).length) { ICG.toast('No questions found for that level. Try "Both".'); return; }
    const st = { scores: teams.map(() => 0), turn: Math.floor(Math.random() * teams.length), opened: {}, contents: fillBoxes(s.boxes), history: [], over: false };

    root.innerHTML = ''; root.className = 'boxes-game';
    const grid = h('div', { class: 'box-grid c' + (s.boxes === 20 ? 5 : 4) });
    const sb = T.scoreboard(teams);
    const turnLbl = h('div', { class: 'turn-pill' });
    const endBtn = h('button', { class: 'iconbtn wide', onclick: () => ICG.confirm('End the game now?', 'The team with the most points wins.', 'End game', finish) }, 'End');
    const undoBtn = h('button', { class: 'iconbtn', title: 'Undo', html: ICG.icon('undo'), onclick: undo });
    const setupBtn = h('button', { class: 'iconbtn', title: 'Settings', html: ICG.icon('settings'),
      onclick: () => (Object.keys(st.opened).length && !st.over) ? ICG.confirm('Change settings?', 'This game will end.', 'Yes', showSetup) : showSetup() });
    root.append(
      ICG.topbar('Mystery Boxes', { extra: [undoBtn, setupBtn, endBtn], leaveCheck: () => Object.keys(st.opened).length && !st.over,
        wheel: T.wheelOpts(teams, () => st.turn) }),
      grid,
      h('div', { class: 'side-panel card' }, turnLbl, sb.el, h('div', { class: 'small-note side-hint' }, 'Say a box number, then answer the question to open it!')));

    function renderGrid() {
      grid.innerHTML = '';
      st.contents.forEach((x, i) => {
        const o = st.opened[i];
        if (o) {
          const t = teams[o.team];
          grid.append(h('div', { class: 'mbox open', style: { borderColor: t.color, background: t.light } },
            ICG.picture(x.picture, 'images', 'mbox-prize'), h('div', { class: 'mbox-num small' }, i + 1)));
        } else {
          const img = ICG.picture('gift', 'images/app', 'mbox-img');
          img.style.filter = 'hue-rotate(' + BOX_HUES[i % BOX_HUES.length] + 'deg)';
          grid.append(h('button', { class: 'mbox', onclick: () => openBox(i) }, img, h('div', { class: 'mbox-num' }, i + 1)));
        }
      });
    }
    function renderSide() {
      const t = teams[st.turn];
      turnLbl.style.background = t.color;
      turnLbl.innerHTML = '';
      turnLbl.append(T.charImg(t.char, 'right', 'mini'), h('span', null, ICG.possessive(t.name) + ' turn'));
      sb.update(st.scores, st.turn);
    }
    function snapshot() { st.history.push({ scores: st.scores.slice(), turn: st.turn, opened: Object.assign({}, st.opened) }); if (st.history.length > 50) st.history.shift(); }
    function undo() {
      if (st.over || !st.history.length) { ICG.toast('Nothing to undo'); return; }
      const p = st.history.pop(); st.scores = p.scores; st.turn = p.turn; st.opened = p.opened;
      renderGrid(); renderSide(); ICG.toast('Undone');
    }
    function nextTurn() { st.turn = (st.turn + 1) % teams.length; renderSide(); }

    function openBox(i) {
      if (st.over || st.opened[i]) return;
      S.pop();
      const q = deck.next();
      const content = h('div', { class: 'box-modal' });
      const m = ICG.modal(content, { sticky: true });
      m.box.style.width = '1300px';
      const qb = T.questionBlock(q, { big: 64 });
      const nobody = () => { keyHandlerFor(null); m.close(); S.nobody(); snapshot(); nextTurn(); };
      content.append(
        h('div', { class: 'bm-head' }, ICG.picture('gift', 'images/app', 'bm-gift'), h('span', null, 'Box ' + (i + 1))),
        qb,
        T.awardButtons(teams, team => reveal(i, team, content, m), nobody, { label: 'Who got it right?', plus: 'Open!', nobody: 'Nobody - close the box' }));
      keyHandlerFor({ award: k => reveal(i, k, content, m), nobody, answer: () => qb.showAnswer && qb.showAnswer() });
    }

    function reveal(i, team, content, m) {
      keyHandlerFor(null);
      snapshot();
      const x = st.contents[i];
      const t = teams[team];
      content.innerHTML = '';
      const gift = ICG.picture('gift', 'images/app', 'bm-shake');
      gift.style.filter = 'hue-rotate(' + BOX_HUES[i % BOX_HUES.length] + 'deg)';
      content.append(h('div', { class: 'bm-open' }, gift, h('div', { class: 'bm-who', style: { color: t.color } }, t.name + ' open the box...')));
      S.drum();
      setTimeout(() => {
        S.win(); ICG.confetti(2200);
        st.opened[i] = { team };
        const done = h('button', { class: 'btn big green', onclick: () => { m.close(); renderGrid(); nextTurn(); if (Object.keys(st.opened).length === st.contents.length) setTimeout(finish, 400); } }, 'OK');
        const msg = h('div', { class: 'bm-result' });
        content.innerHTML = '';
        content.append(h('div', { class: 'bm-open' }, ICG.picture(x.picture, 'images', 'bm-prize'), h('div', { class: 'bm-text' }, x.text), msg));
        if (x.kind === 'points') { st.scores[team] += x.n; msg.textContent = t.name + ' get ' + x.n + (x.n > 1 ? ' points!' : ' point!'); }
        else if (x.kind === 'double') { const g = Math.max(2, st.scores[team]); st.scores[team] += g; msg.textContent = t.name + ' get ' + g + ' more points!'; }
        else if (x.kind === 'everyone') { st.scores = st.scores.map(v => v + x.n); msg.textContent = 'Every team gets ' + x.n + ' point!'; }
        else if (x.kind === 'fun') { msg.textContent = 'No points - just fun!'; }
        else if (x.kind === 'give') {
          msg.textContent = t.name + ', do you want to give ' + x.n + ' points to another team? You choose!';
          const others = teams.map((tm, k) => ({ tm, k })).filter(o => o.k !== team);
          content.append(h('div', { class: 'row' }, others.map(o => h('button', { class: 'award big-award', style: { background: o.tm.color }, onclick: () => {
            st.scores[o.k] += x.n; S.correct(); renderSide();
            msg.textContent = o.tm.name + ' get ' + x.n + ' points. Thank you, ' + t.name + '!';
            content.querySelector('.row').replaceWith(h('div', { class: 'row' }, done));
          } }, T.charImg(o.tm.char, 'right', 'mini'), h('span', null, 'Give to ' + o.tm.name))),
            h('button', { class: 'btn big grey', onclick: () => {
              msg.textContent = "That's OK! Maybe next time.";
              content.querySelector('.row').replaceWith(h('div', { class: 'row' }, done));
            } }, 'No thanks')));
          renderSide();
          return;
        }
        renderSide();
        content.append(h('div', { class: 'row' }, done));
      }, 1300);
    }

    function finish() {
      if (st.over) return;
      st.over = true;
      T.celebrate(teams, st.scores, { again: () => startGame(s), settings: showSetup });
    }

    // laptop keys inside the box: 1-4 team got it, 0/N nobody, A/Space answer
    function keyHandlerFor(map) {
      cleanup();
      if (!map) return;
      keyHandler = e => {
        const k = e.key.toLowerCase();
        if (/^[1-4]$/.test(k) && +k <= teams.length) map.award(+k - 1);
        else if (k === '0' || k === 'n') map.nobody();
        else if (k === 'a' || k === ' ') { e.preventDefault(); map.answer(); }
      };
      document.addEventListener('keydown', keyHandler);
    }

    renderGrid(); renderSide();
  }
})();
