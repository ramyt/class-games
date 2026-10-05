/* ============================================================
   What's Missing?
   Look at the pictures, close your eyes... which one is gone?
   ============================================================ */
(function () {
  'use strict';
  const ICG = window.ICG, h = ICG.h, S = ICG.sound, T = ICG.T;

  const DEFAULTS = { nTeams: 2, sets: null, count: 6, missing: 1, look: 10, words: true, mix: false, rounds: 8 };
  function loadSettings() {
    const s = Object.assign({}, DEFAULTS, ICG.store.get('missing.settings', {}));
    s.teams = T.loadTeams();
    const ids = ICG.pictureSets.map(p => p.id);
    s.sets = (s.sets || ids.slice(0, 1)).filter(id => ids.includes(id));
    if (!s.sets.length && ids.length) s.sets = [ids[0]];
    return s;
  }

  let root = null, keyHandler = null, timers = [];
  const later = (f, ms) => { const t = setTimeout(f, ms); timers.push(t); return t; };
  const cleanup = () => {
    if (keyHandler) document.removeEventListener('keydown', keyHandler); keyHandler = null;
    timers.forEach(clearTimeout); timers = [];
  };

  ICG.register('missing', {
    title: "What's Missing?", ready: true,
    mount(stage) { root = stage; showSetup(); },
    unmount: cleanup
  });

  /* ======================= SETUP ======================= */
  function showSetup() {
    cleanup();
    const s = loadSettings();
    root.innerHTML = ''; root.className = 'setup';
    const body = h('div', { class: 'setup-card card' });
    const save = () => { const c = Object.assign({}, s); delete c.teams; ICG.store.set('missing.settings', c); };
    const set = k => v => { s[k] = v; save(); render(); };
    const lab = (t, ml) => h('div', { class: 'slabel', style: { width: 'auto', marginLeft: (ml || 30) + 'px' } }, t);
    function render() {
      body.innerHTML = '';
      body.append(h('div', { class: 'srow' }, h('div', { class: 'slabel' }, 'Teams'),
        T.teamSeg(s.nTeams, set('nTeams')),
        lab('Rounds'), T.seg([[5, '5'], [8, '8'], [10, '10']], s.rounds, set('rounds'))));
      body.append(h('div', { class: 'srow' }, h('div', { class: 'slabel' }, ''), T.teamChips(s.teams, s.nTeams, () => { save(); render(); })));
      body.append(T.classRow(s.nTeams, s.teams, () => { save(); render(); }));
      body.append(h('div', { class: 'srow top' }, h('div', { class: 'slabel' }, 'Pictures'),
        h('div', { class: 'pack-chips' }, ICG.pictureSets.map(p => {
          const on = s.sets.includes(p.id);
          return h('button', { class: 'chip' + (on ? ' on' : ''), onclick: () => {
            if (on && s.sets.length > 1) s.sets = s.sets.filter(x => x !== p.id); else if (!on) s.sets.push(p.id);
            save(); render();
          } }, ICG.picture(p.picture), p.title);
        }))));
      body.append(h('div', { class: 'srow' }, h('div', { class: 'slabel' }, 'How many'),
        T.seg([[5, '5'], [6, '6'], [8, '8']], s.count, set('count')),
        lab('Missing'), T.seg([[1, '1'], [2, '2']], s.missing, set('missing')),
        lab('Look time'), T.seg([[5, '5s'], [10, '10s'], [15, '15s']], s.look, set('look'))));
      body.append(h('div', { class: 'srow' }, h('div', { class: 'slabel' }, 'Options'),
        h('button', { class: 'toggle light' + (s.words ? ' on' : ''), onclick: () => set('words')(!s.words) }, h('span', { class: 'sw' }), h('span', null, 'Show the words')),
        h('button', { class: 'toggle light' + (s.mix ? ' on' : ''), onclick: () => set('mix')(!s.mix) }, h('span', { class: 'sw' }), h('span', null, 'Mix them up (harder)'))));
      body.append(h('div', { class: 'srow end' },
        h('div', { class: 'small-note', style: { flex: 1, textAlign: 'left' } }, 'Look carefully, close your eyes... what is missing?'),
        h('button', { class: 'btn big green', onclick: () => startGame(s) }, "Let's go!")));
    }
    root.append(ICG.topbar("What's Missing? - Setup"), body);
    render();
  }

  /* ======================= GAME ======================= */
  function startGame(s) {
    if (!T.studentsOk()) return;
    cleanup();
    const teams = T.makeTeams(s.teams, s.nTeams);
    let pool = [];
    ICG.pictureSets.filter(p => s.sets.includes(p.id)).forEach(p => { pool = pool.concat(p.words); });
    // no duplicates of the same picture
    const seen = new Set(); pool = pool.filter(w => !seen.has(w.pic) && seen.add(w.pic));
    if (pool.length < s.count + 1) { ICG.toast('Choose more pictures (at least ' + (s.count + 1) + ')'); return; }
    const st = { scores: teams.map(() => 0), turn: Math.floor(Math.random() * teams.length), round: 0, over: false, lastAward: [] };

    root.innerHTML = ''; root.className = 'missing-game';
    const board = h('div', { class: 'wm-board card' });
    const panel = h('div', { class: 'wm-panel card' });
    const sb = T.scoreboard(teams);
    const endBtn = h('button', { class: 'iconbtn wide', onclick: () => ICG.confirm('End the game now?', 'The team with the most points wins.', 'End game', finish) }, 'End');
    const setupBtn = h('button', { class: 'iconbtn', title: 'Settings', html: ICG.icon('settings'),
      onclick: () => (st.round > 0 && !st.over) ? ICG.confirm('Change settings?', 'This game will end.', 'Yes', showSetup) : showSetup() });
    root.append(
      ICG.topbar("What's Missing?", { extra: [setupBtn, endBtn], leaveCheck: () => st.round > 0 && !st.over, wheel: T.wheelOpts(teams, () => st.turn) }),
      board, h('div', { class: 'wm-side' }, sb.el, panel));

    let items = [], gone = [], order = [], slots = [];
    const cols = s.count <= 6 ? 3 : 4;

    function setKeys(map) {
      if (keyHandler) document.removeEventListener('keydown', keyHandler);
      keyHandler = e => {
        if (document.querySelector('.modal-back')) return;
        const k = e.key === ' ' ? 'space' : e.key.toLowerCase();
        if (map[k]) { e.preventDefault(); map[k](); }
        else if (map.team && /^[1-4]$/.test(k) && +k <= teams.length) map.team(+k - 1);
      };
      document.addEventListener('keydown', keyHandler);
    }
    function card(w, extra) {
      return h('div', { class: 'wm-item ' + (extra || '') }, ICG.picture(w.pic, 'images', 'wm-pic'), s.words ? h('div', { class: 'wm-name' }, w.name) : null);
    }
    function drawBoard(list, cls) {
      board.innerHTML = '';
      const grid = h('div', { class: 'wm-grid c' + cols });
      slots = list.map(x => { const el = x ? card(x, cls) : h('div', { class: 'wm-item empty' }, h('div', { class: 'wm-q' }, '?')); grid.append(el); return el; });
      board.append(grid);
    }
    const turnPill = () => { const t = teams[st.turn]; return h('div', { class: 'turn-pill', style: { background: t.color } }, T.charImg(t.char, 'right', 'mini'), h('span', null, ICG.possessive(t.name) + ' turn')); };
    const roundLbl = () => h('div', { class: 'wm-round' }, 'Round ' + (st.round + 1) + ' of ' + s.rounds);

    /* ----- 1. look ----- */
    function look() {
      sb.update(st.scores, st.turn);
      items = ICG.shuffle(pool).slice(0, s.count);
      gone = ICG.shuffle(items.map((_, i) => i)).slice(0, s.missing);
      drawBoard(items);
      board.classList.remove('dark');
      const bar = h('div', { class: 'wm-bar-fill' });
      panel.innerHTML = '';
      panel.append(roundLbl(), turnPill(), h('div', { class: 'wm-say' }, 'Look carefully!'), h('div', { class: 'wm-bar' }, bar),
        h('button', { class: 'btn big white', style: { marginTop: 'auto' }, onclick: hide }, 'Ready - hide them!'));
      requestAnimationFrame(() => { bar.style.transition = 'width ' + s.look + 's linear'; bar.style.width = '0%'; });
      later(hide, s.look * 1000);
      setKeys({ space: hide });
    }
    /* ----- 2. close your eyes ----- */
    let hidden = false;
    function hide() {
      if (hidden) return; hidden = true;
      timers.forEach(clearTimeout); timers = [];
      setKeys({});
      board.innerHTML = '';
      board.classList.add('dark');
      board.append(h('div', { class: 'wm-eyes' }, ICG.picture('sleepy', 'images', 'wm-sleep'), h('div', null, 'Close your eyes!')));
      panel.innerHTML = '';
      panel.append(roundLbl(), turnPill(), h('div', { class: 'wm-say' }, 'Shhh...'));
      S.drum(); later(S.drum, 900); later(S.drum, 1800);
      later(back, 3000);
    }
    /* ----- 3. what's missing? ----- */
    function back() {
      hidden = false;
      board.classList.remove('dark');
      S.pop();
      const left = items.filter((_, i) => !gone.includes(i));
      if (s.mix) { order = ICG.shuffle(left); drawBoard(order); }
      else { order = items.map((w, i) => (gone.includes(i) ? null : w)); drawBoard(order); }
      panel.innerHTML = '';
      panel.append(roundLbl(), turnPill(),
        h('div', { class: 'wm-say' }, s.missing > 1 ? 'What are the 2 missing things?' : "What's missing?"),
        h('div', { class: 'small-note' }, ICG.possessive(teams[st.turn].name) + ' turn first. Then the others can try.'),
        h('button', { class: 'btn big yellow', style: { marginTop: 'auto' }, onclick: showAnswer }, 'Show answer'));
      setKeys({ a: showAnswer, space: showAnswer });
    }
    /* ----- 4. show the answer + give points ----- */
    function showAnswer() {
      setKeys({});
      const missingItems = gone.map(i => items[i]);
      if (s.mix) {
        const grid = board.querySelector('.wm-grid');
        missingItems.forEach(w => grid.append(card(w, 'found')));
      } else {
        gone.forEach(i => { const el = card(items[i], 'found'); slots[i].replaceWith(el); slots[i] = el; });
      }
      S.win();
      st.lastAward = [];
      const awarded = h('div', { class: 'wm-awarded' });
      panel.innerHTML = '';
      panel.append(roundLbl(),
        h('div', { class: 'wm-answer' }, missingItems.map(w => w.name).join(' + ')),
        T.awardButtons(teams, give, null, { label: 'Who got it? (tap +1)' }),
        awarded,
        h('div', { class: 'row wm-next' },
          h('button', { class: 'btn white', onclick: undoAward }, 'Undo'),
          h('button', { class: 'btn big green', onclick: next }, st.round + 1 >= s.rounds ? 'See the winner!' : 'Next round')));
      function give(i) { st.scores[i]++; st.lastAward.push(i); S.correct(); sb.update(st.scores, st.turn); awarded.textContent = st.lastAward.map(k => teams[k].name + ' +1').join(',  '); }
      function undoAward() { const i = st.lastAward.pop(); if (i == null) return; st.scores[i]--; sb.update(st.scores, st.turn); awarded.textContent = st.lastAward.map(k => teams[k].name + ' +1').join(',  '); }
      setKeys({ team: give, space: next, enter: next, u: undoAward });
    }
    function next() {
      st.round++;
      if (st.round >= s.rounds) return finish();
      st.turn = (st.turn + 1) % teams.length;
      look();
    }
    function finish() {
      if (st.over) return;
      st.over = true; cleanup();
      T.celebrate(teams, st.scores, { again: () => startGame(s), settings: showSetup });
    }

    look();
  }
})();
