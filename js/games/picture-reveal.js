/* ============================================================
   Picture Reveal
   A picture is hidden under numbered tiles. Open tiles one by
   one - the sooner a team guesses the picture, the more points.
   ============================================================ */
(function () {
  'use strict';
  const ICG = window.ICG, h = ICG.h, S = ICG.sound, T = ICG.T;

  const TILE_COLS = ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
  const NO_Q = '__none__';

  // points for a right guess, by how much of the picture is still hidden
  function worth(hiddenPart) { return hiddenPart >= 0.75 ? 5 : hiddenPart >= 0.5 ? 3 : hiddenPart > 0 ? 2 : 1; }

  const DEFAULTS = { nTeams: 2, grid: 4, rounds: 6, level: 'both', packs: [NO_Q], sets: null };
  function loadSettings() {
    const s = Object.assign({}, DEFAULTS, ICG.store.get('reveal.settings', {}));
    s.teams = T.loadTeams();
    if (!(s.packs && s.packs[0] === NO_Q)) s.packs = T.cleanPacks(s.packs);
    const ids = ICG.pictureSets.map(p => p.id);
    s.sets = (s.sets || ids.slice(0, 1)).filter(id => ids.includes(id));
    if (!s.sets.length && ids.length) s.sets = [ids[0]];
    return s;
  }

  let root = null, keyHandler = null;
  const cleanup = () => { if (keyHandler) document.removeEventListener('keydown', keyHandler); keyHandler = null; };

  ICG.register('reveal', {
    title: 'Picture Reveal', ready: true,
    mount(stage) { root = stage; showSetup(); },
    unmount: cleanup
  });

  /* ======================= SETUP ======================= */
  function showSetup() {
    cleanup();
    const s = loadSettings();
    root.innerHTML = ''; root.className = 'setup';
    const body = h('div', { class: 'setup-card card' });
    const save = () => { const c = Object.assign({}, s); delete c.teams; ICG.store.set('reveal.settings', c); };
    const set = k => v => { s[k] = v; save(); render(); };
    function render() {
      body.innerHTML = '';
      body.append(h('div', { class: 'srow' }, h('div', { class: 'slabel' }, T.studentMode() ? 'Players' : 'Teams'),
        T.teamSeg(s.nTeams, set('nTeams')),
        h('div', { class: 'slabel', style: { width: 'auto', marginLeft: '30px' } }, 'Tiles'),
        T.seg([[3, '9'], [4, '16'], [5, '25']], s.grid, set('grid')),
        h('div', { class: 'slabel', style: { width: 'auto', marginLeft: '30px' } }, 'Pictures'),
        T.seg([[4, '4'], [6, '6'], [10, '10']], s.rounds, set('rounds'))));
      body.append(h('div', { class: 'srow' }, h('div', { class: 'slabel' }, ''), T.teamChips(s.teams, s.nTeams, () => { save(); render(); })));
      body.append(T.classRow(s.nTeams, s.teams, () => { save(); render(); }));
      // picture sets
      const sets = h('div', { class: 'pack-chips' }, ICG.pictureSets.map(p => {
        const on = s.sets.includes(p.id);
        return h('button', { class: 'chip' + (on ? ' on' : ''), onclick: () => {
          if (on && s.sets.length > 1) s.sets = s.sets.filter(x => x !== p.id); else if (!on) s.sets.push(p.id);
          save(); render();
        } }, ICG.picture(p.picture), p.title + ' (' + p.words.length + ')');
      }));
      body.append(h('div', { class: 'srow top' }, h('div', { class: 'slabel' }, 'Hidden pictures'), sets));
      // questions: none, packs, or own
      const noQ = s.packs[0] === NO_Q;
      const qrow = h('div', { class: 'pack-chips' },
        h('button', { class: 'chip own' + (noQ ? ' on' : ''), onclick: () => { s.packs = [NO_Q]; save(); render(); } }, 'No questions - just open tiles'));
      if (noQ) qrow.append(h('button', { class: 'chip', onclick: () => { s.packs = T.cleanPacks(null); save(); render(); } }, 'Use questions...'));
      else [...T.packChips(s, () => { save(); render(); }).children].forEach(c => qrow.append(c));
      body.append(h('div', { class: 'srow top' }, h('div', { class: 'slabel' }, 'Questions'), qrow));
      body.append(h('div', { class: 'srow end' },
        h('div', { class: 'small-note', style: { flex: 1, textAlign: 'left' } },
          noQ ? 'You open the tiles. A team taps "guess" when ready - the game checks the answer.' : 'Answer right to open a tile, then guess or pass.'),
        h('button', { class: 'btn big green', onclick: () => startGame(s) }, "Let's go!")));
    }
    root.append(ICG.topbar('Picture Reveal - Setup'), body);
    render();
  }

  /* ======================= GAME ======================= */
  function startGame(s) {
    if (!T.studentsOk()) return;
    cleanup();
    const teams = T.makeTeams(s.teams, s.nTeams);
    const useQ = s.packs[0] !== NO_Q;
    const deck = useQ ? T.deck(s) : null;
    let pool = [];
    ICG.pictureSets.filter(p => s.sets.includes(p.id)).forEach(p => { pool = pool.concat(p.words); });
    pool = ICG.shuffle(pool);
    if (!pool.length) { ICG.toast('Choose some pictures first'); return; }
    const rounds = Math.min(s.rounds, pool.length);
    const N = s.grid * s.grid;
    const st = { scores: teams.map(() => 0), turn: Math.floor(Math.random() * teams.length), round: 0, open: [], phase: 'question', q: null, over: false, done: false };

    root.innerHTML = ''; root.className = 'reveal-game';
    const board = h('div', { class: 'rv-board' });
    const panel = h('div', { class: 'rv-panel card' });
    const sb = T.scoreboard(teams);
    const info = h('div', { class: 'rv-info' });
    const endBtn = h('button', { class: 'iconbtn wide', onclick: () => ICG.confirm('End the game now?', 'The team with the most points wins.', 'End game', finish) }, 'End');
    const setupBtn = h('button', { class: 'iconbtn', title: 'Settings', html: ICG.icon('settings'),
      onclick: () => (st.round > 0 || st.open.length) && !st.over ? ICG.confirm('Change settings?', 'This game will end.', 'Yes', showSetup) : showSetup() });
    root.append(
      ICG.topbar('Picture Reveal', { extra: [setupBtn, endBtn], leaveCheck: () => (st.round > 0 || st.open.length) && !st.over,
        wheel: T.wheelOpts(teams, () => st.turn) }),
      h('div', { class: 'rv-left' }, info, board),
      h('div', { class: 'rv-right' }, sb.el, panel));

    let tiles = [], img = null;
    function newRound() {
      st.open = []; st.done = false; st.phase = 'question'; st.locked = {};
      const word = pool[st.round];
      board.innerHTML = '';
      board.style.setProperty('--n', s.grid);
      img = ICG.picture(word.pic, 'images', 'rv-pic');
      board.append(img);
      const tileBox = h('div', { class: 'rv-tiles' });
      tiles = Array.from({ length: N }, (_, i) => {
        const tl = h('button', { class: 'rv-tile', style: { background: TILE_COLS[(i + Math.floor(i / s.grid)) % TILE_COLS.length] }, onclick: () => tapTile(i) }, String(i + 1));
        tileBox.append(tl); return tl;
      });
      board.append(tileBox);
      if (useQ) st.q = deck.next();
      render();
      // preload next picture
      if (pool[st.round + 1]) ICG.preload(pool[st.round + 1].pic);
    }
    const hiddenPart = () => (N - st.open.length) / N;
    function tapTile(i) {
      if (st.done || st.open.includes(i)) return;
      if (useQ && st.phase !== 'pick') { ICG.toast(st.phase === 'decide' ? 'Guess now, or pass?' : 'Answer the question first - then open a tile!'); return; }
      st.open.push(i); S.pop();
      tiles[i].classList.add('gone');
      if (useQ) st.phase = 'decide';
      if (st.open.length === N) { revealAll(-1); return; }
      render();
    }
    // a team guesses: the game checks the word (the answer is never shown)
    function guess(team) {
      const word = pool[st.round];
      T.guessCheck(word, teams[team].name, right => {
        if (right) return revealAll(team);
        if (useQ) nextTurn();
        else { st.locked[team] = st.open.length; render(); }
      });
    }
    function openRandom() {
      const closed = tiles.map((_, i) => i).filter(i => !st.open.includes(i));
      if (closed.length) tapTile(closed[Math.floor(Math.random() * closed.length)]);
    }
    function revealAll(winner) {
      st.done = true;
      tiles.forEach((tl, i) => setTimeout(() => tl.classList.add('gone'), i * 25));
      const word = pool[st.round];
      if (winner >= 0) { const p = worth(hiddenPart()); st.scores[winner] += p; st.lastWin = { team: winner, p }; S.win(); ICG.confetti(2500); }
      else { st.lastWin = null; S.nobody(); }
      st.revealWord = word.name;
      render();
    }
    function nextTurn() { st.turn = (st.turn + 1) % teams.length; if (useQ) { st.q = deck.next(); st.phase = 'question'; } render(); }
    function nextRound() {
      st.round++;
      if (st.round >= rounds) return finish();
      st.turn = (st.turn + 1) % teams.length;
      newRound();
    }
    function finish() {
      if (st.over) return;
      st.over = true; cleanup();
      T.celebrate(teams, st.scores, { again: () => startGame(s), settings: showSetup });
    }

    function render() {
      sb.update(st.scores, useQ ? st.turn : -1);
      const p = worth(hiddenPart());
      info.innerHTML = '';
      info.append(h('span', { class: 'rv-round' }, 'Picture ' + (st.round + 1) + ' of ' + rounds));
      if (!st.done) info.append(h('span', { class: 'rv-worth' }, 'Worth ', h('b', null, p), p > 1 ? ' points' : ' point'));
      panel.innerHTML = '';
      const t = teams[st.turn];
      const turnPill = () => h('div', { class: 'turn-pill', style: { background: t.color } }, T.charImg(t.char, 'right', 'mini'), h('span', null, ICG.possessive(t.name) + ' turn'));

      if (st.done) {
        const w = st.lastWin;
        panel.append(
          h('div', { class: 'rv-reveal' }, "It's..."),
          h('div', { class: 'rv-word' }, st.revealWord),
          w ? h('div', { class: 'rv-points', style: { color: teams[w.team].color } }, teams[w.team].name + ' +' + w.p) : h('div', { class: 'rv-points' }, 'Nobody got it this time'),
          h('button', { class: 'btn big green', style: { marginTop: 'auto' }, onclick: nextRound }, st.round + 1 >= rounds ? 'See the winner!' : 'Next picture'));
        return;
      }
      if (!useQ) {
        // teacher opens tiles; a team that guessed wrong waits for the next tile
        panel.append(
          h('div', { class: 'rv-help' }, 'Tap a tile to open it. Who is ready to guess?'),
          h('button', { class: 'btn white', onclick: openRandom }, 'Open a random tile'),
          h('div', { class: 'award-box' },
            h('div', { class: 'award-grid n' + teams.length + (teams.length > 4 ? ' many' : '') }, teams.map((tm, i) => {
              const wait = st.locked[i] === st.open.length;
              return h('button', { class: 'award' + (wait ? ' waiting' : ''), style: { background: tm.color }, onclick: () => wait ? ICG.toast(tm.name + ' can guess again after the next tile') : guess(i) },
                T.charImg(tm.char, 'right', 'mini'), h('span', null, wait ? 'Wait...' : tm.name + ' guess'));
            }))),
          h('button', { class: 'btn grey nobody', style: { marginTop: 'auto' }, onclick: () => revealAll(-1) }, 'Show the picture (no points)'));
        return;
      }
      panel.append(turnPill());
      if (st.phase === 'question') {
        const qb = T.questionBlock(st.q, { big: 46 });
        panel.append(qb, h('div', { class: 'row rv-2' },
          h('button', { class: 'btn green', onclick: () => { S.correct(); st.phase = 'pick'; render(); } }, 'Right!'),
          h('button', { class: 'btn red', onclick: () => { S.nobody(); nextTurn(); } }, 'Wrong')));
        panel.showAnswer = qb.showAnswer;
      } else if (st.phase === 'pick') {
        panel.append(h('div', { class: 'rv-help big' }, t.name + ', choose a tile!'), h('div', { class: 'small-note' }, 'Say a number, then tap it.'),
          h('button', { class: 'btn white', onclick: openRandom }, 'Open a random tile'));
      } else if (st.phase === 'decide') {
        panel.append(h('div', { class: 'rv-help big' }, t.name + ', do you want to guess?'),
          h('div', { class: 'small-note' }, 'Right = ' + p + (p > 1 ? ' points' : ' point') + '. Wrong = next team.'),
          h('div', { class: 'row rv-2' },
            h('button', { class: 'btn green', onclick: () => guess(st.turn) }, 'Guess now!'),
            h('button', { class: 'btn white', onclick: () => { S.pop(); nextTurn(); } }, 'Pass')));
      }
      panel.append(h('button', { class: 'btn grey nobody', style: { marginTop: 'auto' }, onclick: () => ICG.confirm('Show the picture?', 'Nobody gets points for this picture.', 'Show it', () => revealAll(-1)) }, 'Show the picture (no points)'));
    }

    // laptop keys: R random tile, A/Space show answer, Y right, N wrong, G guess, P pass, 1-4 team guess (no-question mode)
    keyHandler = e => {
      if (document.querySelector('.modal-back') || e.target.matches('input, textarea')) return;
      const k = e.key.toLowerCase();
      if (st.done) { if (k === 'enter' || k === ' ') { e.preventDefault(); nextRound(); } return; }
      if (k === 'r') openRandom();
      if (!useQ && /^[1-4]$/.test(k) && +k <= teams.length && st.locked[+k - 1] !== st.open.length) guess(+k - 1);
      if (!useQ) return;
      if (st.phase === 'question') {
        if (k === 'a' || k === ' ') { e.preventDefault(); panel.showAnswer && panel.showAnswer(); }
        if (k === 'y') { S.correct(); st.phase = 'pick'; render(); }
        if (k === 'n') { S.nobody(); nextTurn(); }
      } else if (st.phase === 'decide') {
        if (k === 'g') guess(st.turn);
        if (k === 'p') { S.pop(); nextTurn(); }
      }
    };
    document.addEventListener('keydown', keyHandler);

    newRound();
  }
})();
