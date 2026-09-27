/* ============================================================
   Dice Board Game
   Answer a question to earn a roll. Race your team around the
   board - watch out for rockets, stars and snails!
   ============================================================ */
(function () {
  'use strict';
  const ICG = window.ICG, h = ICG.h, S = ICG.sound, T = ICG.T;

  /* ----- special squares -----
     picture: file in the images folder, move: squares to move, again: roll again */
  const SPECIAL = {
    rocket: { picture: 'rocket', move: 3, text: 'Rocket! Zoom 3 ahead!' },
    star: { picture: 'star', again: true, text: 'Star! Roll again!' },
    snail: { picture: 'snail', move: -2, text: 'Slow snail... back 2' },
    ask: { picture: 'question-mark', text: 'Bonus question! Right = 2 ahead' }
  };

  const DEFAULTS = { nTeams: 2, mode: 'answer', length: 30, level: 'both', packs: null };
  function loadSettings() {
    const s = Object.assign({}, DEFAULTS, ICG.store.get('board.settings', {}));
    s.teams = T.loadTeams(); s.packs = T.cleanPacks(s.packs);
    return s;
  }

  let root = null, keyHandler = null;
  const cleanup = () => { if (keyHandler) document.removeEventListener('keydown', keyHandler); keyHandler = null; };

  ICG.register('board', {
    title: 'Dice Board Game', ready: true,
    mount(stage) { root = stage; showSetup(); },
    unmount: cleanup
  });

  /* ======================= SETUP ======================= */
  function showSetup() {
    cleanup();
    const s = loadSettings();
    root.innerHTML = ''; root.className = 'setup';
    const body = h('div', { class: 'setup-card card' });
    const save = () => { const c = Object.assign({}, s); delete c.teams; ICG.store.set('board.settings', c); };
    const set = k => v => { s[k] = v; save(); render(); };
    function render() {
      body.innerHTML = '';
      body.append(h('div', { class: 'srow' }, h('div', { class: 'slabel' }, 'Teams'),
        T.seg([[2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6'], [7, '7'], [8, '8']], s.nTeams, set('nTeams')),
        h('div', { class: 'slabel', style: { width: 'auto', marginLeft: '30px' } }, 'Board'),
        T.seg([[20, 'Short'], [30, 'Medium'], [40, 'Long']], s.length, set('length'))));
      body.append(h('div', { class: 'srow' }, h('div', { class: 'slabel' }, ''), T.teamChips(s.teams, s.nTeams, () => { save(); render(); })));
      body.append(T.classRow(s.nTeams, s.teams, () => { save(); render(); }));
      body.append(h('div', { class: 'srow' }, h('div', { class: 'slabel' }, 'Mode'),
        T.seg([['answer', 'Answer to roll'], ['roll', 'Just roll']], s.mode, set('mode')),
        h('div', { class: 'small-note', style: { marginLeft: '16px', textAlign: 'left' } },
          s.mode === 'answer' ? 'Right answer = roll the dice' : 'Questions only on ? squares')));
      body.append(h('div', { class: 'srow top' }, h('div', { class: 'slabel' }, 'Questions'), T.packChips(s, () => { save(); render(); })));
      body.append(h('div', { class: 'srow' }, h('div', { class: 'slabel' }, 'Level'),
        T.seg([['easy', 'Easy'], ['harder', 'Harder'], ['both', 'Both']], s.level, set('level'))));
      body.append(h('div', { class: 'srow end' },
        h('div', { class: 'small-note', style: { flex: 1, textAlign: 'left' } }, 'First team to the finish flag wins!'),
        h('button', { class: 'btn big green', onclick: () => startGame(s) }, "Let's go!")));
    }
    root.append(ICG.topbar('Dice Board Game - Setup'), body);
    render();
  }

  /* ---------- make the board ---------- */
  function makeBoard(n, mode) {
    // squares 0 (start) .. n (finish)
    const sq = Array.from({ length: n + 1 }, () => null);
    const free = [];
    for (let i = 3; i < n - 1; i++) free.push(i);
    const pick = ICG.shuffle(free);
    const k = Math.round(n / 10);
    const take = (type, count, ok) => { for (let c = 0; c < count; c++) { const j = pick.findIndex(i => ok(i) && !sq[i] && !sq[i - 1] && !sq[i + 1]); if (j >= 0) { sq[pick[j]] = type; pick.splice(j, 1); } } };
    if (mode === 'roll') take('ask', k + 2, () => true); // bonus questions first
    take('rocket', k + 1, i => i < n - 4);
    take('star', k, () => true);
    take('snail', k, i => i > 5);
    return sq;
  }
  // serpentine layout: returns {col,row} for each square
  function layout(n) {
    const cols = n <= 20 ? 6 : n <= 30 ? 7 : 9;
    const rows = Math.ceil((n + 1) / cols);
    return { cols, rows, pos: i => { const r = Math.floor(i / cols); let c = i % cols; if (r % 2) c = cols - 1 - c; return { c, r: rows - 1 - r }; } };
  }

  /* ======================= GAME ======================= */
  function startGame(s) {
    cleanup();
    const teams = T.makeTeams(s.teams, s.nTeams);
    const deck = T.deck(s);
    if (!deck.own && !T.buildDeck(s).length) { ICG.toast('No questions found for that level. Try "Both".'); return; }
    const N = s.length;
    const squares = makeBoard(N, s.mode);
    const L = layout(N);
    const st = { pos: teams.map(() => 0), turn: Math.floor(Math.random() * teams.length), phase: 'start', q: null, over: false, moves: 0, history: [], busy: false };

    root.innerHTML = ''; root.className = 'board-game';
    const board = h('div', { class: 'db-board' });
    const panel = h('div', { class: 'db-panel card' });
    const sb = T.scoreboard(teams);
    const undoBtn = h('button', { class: 'iconbtn', title: 'Undo', html: ICG.icon('undo'), onclick: undo });
    const setupBtn = h('button', { class: 'iconbtn', title: 'Settings', html: ICG.icon('settings'),
      onclick: () => (st.moves && !st.over) ? ICG.confirm('Change settings?', 'This game will end.', 'Yes', showSetup) : showSetup() });
    root.append(
      ICG.topbar('Dice Board Game', { extra: [undoBtn, setupBtn], leaveCheck: () => st.moves && !st.over, wheel: T.wheelOpts(teams, () => st.turn) }),
      board, h('div', { class: 'db-side' + (teams.length > 4 ? ' many' : '') }, sb.el, panel));

    /* ----- draw the board ----- */
    const W = 1100, H = 780, gap = 10;
    const cw = (W - gap * (L.cols - 1)) / L.cols, ch = (H - gap * (L.rows - 1)) / L.rows;
    const cell = i => { const p = L.pos(i); return { x: p.c * (cw + gap), y: p.r * (ch + gap) }; };
    // path line behind the squares
    const pts = []; for (let i = 0; i <= N; i++) { const c = cell(i); pts.push((c.x + cw / 2) + ',' + (c.y + ch / 2)); }
    board.insertAdjacentHTML('beforeend', `<svg class="db-path" viewBox="0 0 ${W} ${H}"><polyline points="${pts.join(' ')}" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="26" stroke-linejoin="round" stroke-linecap="round"/></svg>`);
    const COLS = ['#fef3c7', '#dbeafe', '#dcfce7', '#fce7f3', '#ede9fe'];
    for (let i = 0; i <= N; i++) {
      const c = cell(i), type = squares[i];
      const el = h('div', { class: 'db-sq' + (i === 0 ? ' start' : i === N ? ' finish' : '') + (type ? ' sp ' + type : ''),
        style: { left: c.x + 'px', top: c.y + 'px', width: cw + 'px', height: ch + 'px', background: i && i < N && !type ? COLS[i % COLS.length] : '' } },
        h('span', { class: 'db-num' }, i === 0 ? 'START' : i === N ? '' : i));
      if (i === N) el.append(ICG.picture('finish-flag', 'images/app', 'db-icon'));
      else if (type) el.append(ICG.picture(SPECIAL[type].picture, 'images', 'db-icon'));
      board.append(el);
    }
    const tokens = teams.map((t, i) => { const tk = h('div', { class: 'db-token', style: { borderColor: t.color } }, T.charImg(t.char, 'right')); board.append(tk); return tk; });
    const TS = Math.min(cw, ch) * 0.52;
    function placeTokens(animate) {
      const groups = {};
      teams.forEach((_, i) => { (groups[st.pos[i]] = groups[st.pos[i]] || []).push(i); });
      Object.keys(groups).forEach(sqi => {
        const g = groups[sqi], c = cell(+sqi);
        g.forEach((ti, k) => {
          // up to 8 pieces share a square: 1 / 2 side by side / 2x2 / 3x3 grid
          const n = g.length, cols = n === 1 ? 1 : n <= 4 ? 2 : 3, rows = Math.ceil(n / cols);
          const o = [(k % cols + .5) / cols, .22 + .72 * (Math.floor(k / cols) + .5) / rows];
          const tk = tokens[ti], size = n === 1 ? TS : TS * (cols === 2 ? .72 : .5);
          tk.style.transition = animate ? 'left .22s, top .22s, width .2s, height .2s' : 'none';
          tk.style.width = tk.style.height = size + 'px';
          tk.style.left = (c.x + cw * o[0] - size / 2) + 'px';
          tk.style.top = (c.y + ch * o[1] - size / 2) + 'px';
          tk.style.zIndex = ti === st.turn ? 5 : 3;
        });
      });
    }

    /* ----- side panel ----- */
    const dice = h('div', { class: 'db-dice' });
    function drawDice(n) {
      const spots = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] }[n];
      dice.innerHTML = '';
      for (let k = 1; k <= 9; k++) dice.append(h('span', { class: spots.includes(k) ? 'on' : '' }));
    }
    drawDice(6);
    const t = () => teams[st.turn];
    function render(message) {
      sb.update(st.pos.map(p => (p >= N ? '🏁' : p)), st.turn);
      panel.innerHTML = '';
      panel.append(h('div', { class: 'turn-pill', style: { background: t().color } }, T.charImg(t().char, 'right', 'mini'), h('span', null, ICG.possessive(t().name) + ' turn')));
      if (message) panel.append(h('div', { class: 'db-msg' }, message));
      if (st.phase === 'question' || st.phase === 'bonus') {
        const qb = T.questionBlock(st.q, { big: 40 });
        panel.showAnswer = qb.showAnswer;
        panel.append(qb, h('div', { class: 'row rv-2' },
          h('button', { class: 'btn green', onclick: right }, st.phase === 'bonus' ? 'Right! +2' : 'Right!'),
          h('button', { class: 'btn red', onclick: wrong }, 'Wrong')));
      } else if (st.phase === 'roll') {
        panel.append(dice, h('button', { class: 'btn big yellow db-roll', onclick: roll }, 'Roll!'));
      } else {
        panel.append(dice);
      }
    }
    function snapshot() { st.history.push({ pos: st.pos.slice(), turn: st.turn }); if (st.history.length > 40) st.history.shift(); }
    function undo() {
      if (st.busy || st.over || !st.history.length) { ICG.toast('Nothing to undo'); return; }
      const p = st.history.pop(); st.pos = p.pos; st.turn = p.turn; st.moves = Math.max(0, st.moves - 1);
      placeTokens(true); begin(); ICG.toast('Undone');
    }
    function begin() {
      if (s.mode === 'answer') { st.phase = 'question'; st.q = deck.next(); }
      else st.phase = 'roll';
      render();
    }
    function nextTeam() { st.turn = (st.turn + 1) % teams.length; placeTokens(true); begin(); }
    function right() {
      S.correct();
      if (st.phase === 'bonus') { st.phase = 'moving'; render('Great! 2 squares ahead!'); setTimeout(() => move(2, () => afterLand((st.chain || 0) + 1)), 500); }
      else { st.phase = 'roll'; render('Well done! Roll the dice!'); }
    }
    function wrong() {
      S.nobody();
      st.phase = 'moving';
      render('Not this time...');
      setTimeout(nextTeam, 900);
    }
    function roll() {
      if (st.busy) return;
      st.busy = true; snapshot(); st.moves++;
      st.phase = 'rolling'; render();
      dice.classList.add('rolling');
      const n = 1 + Math.floor(Math.random() * 6);
      let k = 0;
      const iv = setInterval(() => {
        drawDice(1 + Math.floor(Math.random() * 6)); S.tick();
        if (++k >= 12) {
          clearInterval(iv); drawDice(n); dice.classList.remove('rolling'); S.pop();
          panel.insertBefore(h('div', { class: 'db-msg big' }, 'You rolled ' + n + '!'), dice);
          setTimeout(() => move(n, () => afterLand(false)), 600);
        }
      }, 80);
    }
    // move one square at a time (steps can be negative)
    function move(steps, done) {
      st.busy = true;
      const dir = steps > 0 ? 1 : -1;
      let left = Math.abs(steps);
      (function hop() {
        if (!left || st.pos[st.turn] >= N) { st.busy = false; return done(); }
        st.pos[st.turn] = Math.max(0, Math.min(N, st.pos[st.turn] + dir));
        left--; S.hop(); placeTokens(true);
        tokens[st.turn].classList.remove('hop'); void tokens[st.turn].offsetWidth; tokens[st.turn].classList.add('hop');
        sb.update(st.pos.map(p => (p >= N ? '🏁' : p)), st.turn);
        setTimeout(hop, 330);
      })();
    }
    // after landing: do the square's action, and keep going while the team
    // lands on more action squares (stops on an empty square)
    function afterLand(chain) {
      chain = chain || 0;
      const p = st.pos[st.turn];
      if (p >= N) return win();
      const type = squares[p];
      if (!type || chain > 12) return setTimeout(nextTeam, 700);
      const sp = SPECIAL[type];
      const pre = chain ? 'And another one! ' : '';
      st.chain = chain;
      if (type === 'ask') { st.phase = 'bonus'; st.q = deck.next(); render(pre + sp.text); return; }
      st.phase = 'moving'; render(pre + sp.text);
      if (sp.again) { S.win(); setTimeout(() => { st.phase = 'roll'; render(pre + 'Star! Roll again!'); }, 1200); return; }
      if (sp.move > 0) S.win(); else S.nobody();
      setTimeout(() => move(sp.move, () => afterLand(chain + 1)), 1000);
    }
    function win() {
      if (st.over) return;
      st.over = true; cleanup();
      setTimeout(() => T.celebrate(teams, st.pos.map(p => Math.min(p, N)), { unit: ' squares', again: () => startGame(s), settings: showSetup }), 600);
    }

    // laptop: Space/Enter = roll, Y = right, N = wrong, A = show answer, U = undo
    keyHandler = e => {
      if (document.querySelector('.modal-back')) return;
      const k = e.key.toLowerCase();
      if ((k === ' ' || k === 'enter') && st.phase === 'roll') { e.preventDefault(); roll(); }
      else if (st.phase === 'question' || st.phase === 'bonus') {
        if (k === 'y') right(); else if (k === 'n') wrong(); else if (k === 'a' || k === ' ') { e.preventDefault(); panel.showAnswer && panel.showAnswer(); }
      } else if (k === 'u') undo();
    };
    document.addEventListener('keydown', keyHandler);

    ICG._board = { st, squares }; // for testing
    placeTokens(false);
    begin();
  }
})();
