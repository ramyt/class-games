/* ============================================================
   Team Race  (+ Tug of War mode for 2 teams)
   Teams answer questions to move their character to the finish.
   ============================================================ */
(function () {
  'use strict';
  const ICG = window.ICG, h = ICG.h, S = ICG.sound;

  const T = ICG.T;
  const CHARACTERS = T.CHARACTERS, TEAM_COLORS = T.COLORS, TEAM_LIGHT = T.LIGHT, OWN = T.OWN;
  const charOf = T.charOf, charImg = T.charImg;

  const DEFAULTS = { mode: 'race', nTeams: 2, length: 8, level: 'both', packs: null, timer: 0 };
  function loadSettings() {
    const s = Object.assign({}, DEFAULTS, ICG.store.get('race.settings', {}));
    s.teams = T.loadTeams();
    s.packs = T.cleanPacks(s.packs);
    return s;
  }

  let root = null, keyHandler = null, clockId = null;
  const stopClock = () => { if (clockId) cancelAnimationFrame(clockId); clockId = null; };

  ICG.register('race', {
    title: 'Team Race', ready: true,
    mount(stage) { root = stage; showSetup(); },
    unmount() { if (keyHandler) document.removeEventListener('keydown', keyHandler); keyHandler = null; stopClock(); }
  });

  /* ======================= SETUP SCREEN ======================= */
  function showSetup() {
    stopClock();
    if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null; }
    const s = loadSettings();
    root.innerHTML = ''; root.className = 'race-setup';
    const body = h('div', { class: 'setup-card card' });
    const save = () => { const c = Object.assign({}, s); delete c.teams; ICG.store.set('race.settings', c); };

    function seg(options, value, onPick) {
      return h('div', { class: 'seg' }, options.map(([v, label]) =>
        h('button', { class: v === value ? 'on' : '', onclick: () => { onPick(v); save(); render(); } }, label)));
    }
    function render() {
      body.innerHTML = '';
      if (s.mode === 'tug') s.nTeams = 2;
      // Row: game type
      body.append(h('div', { class: 'srow' }, h('div', { class: 'slabel' }, 'Game'),
        seg([['race', 'Race'], ['tug', 'Tug of War']], s.mode, v => { s.mode = v; }),
        h('div', { class: 'slabel', style: { width: 'auto', marginLeft: '40px' } }, 'How many teams?'),
        s.mode === 'tug' ? h('div', { class: 'small-note' }, '2 teams') : seg([[2, '2'], [3, '3'], [4, '4']], s.nTeams, v => { s.nTeams = v; })));
      // Row: teams
      const teamBox = T.teamChips(s.teams, s.nTeams, () => { save(); render(); });
      body.append(T.classRow(s.nTeams, s.teams, () => { save(); render(); }));
      body.append(h('div', { class: 'srow' }, h('div', { class: 'slabel' }, 'Teams'), teamBox));
      body.append(T.teamHint());
      // Row: questions
      const chips = T.packChips(s, () => { save(); render(); });
      body.append(h('div', { class: 'srow top' }, h('div', { class: 'slabel' }, 'Questions'), chips));
      // Row: level + length
      body.append(h('div', { class: 'srow' },
        h('div', { class: 'slabel' }, 'Level'),
        seg([['easy', 'Easy'], ['harder', 'Harder'], ['both', 'Both']], s.level, v => { s.level = v; }),
        h('div', { class: 'slabel', style: { width: 'auto', marginLeft: '40px' } }, 'Length'),
        seg([[5, 'Short'], [8, 'Medium'], [12, 'Long']], s.length, v => { s.length = v; })));
      // Row: answer timer
      body.append(h('div', { class: 'srow' },
        h('div', { class: 'slabel' }, 'Timer'),
        seg([[0, 'Off'], [10, '10s'], [15, '15s'], [20, '20s']], s.timer, v => { s.timer = v; }),
        h('div', { class: 'small-note', style: { marginLeft: '16px', textAlign: 'left' } },
          s.timer ? 'Time runs out = no point, next team' : 'No time limit')));
      const n = buildDeck(s).length;
      body.append(h('div', { class: 'srow end' },
        h('div', { class: 'small-note', style: { flex: 1, textAlign: 'left' } },
          s.packs.includes(OWN) ? 'You will ask the questions yourself.' : n + ' questions ready'),
        h('button', { class: 'btn big green', onclick: () => startGame(s) }, "Let's go!")));
    }
    root.append(ICG.topbar('Team Race - Setup'), body);
    render();
  }

  const buildDeck = T.buildDeck;

  /* ======================= THE GAME ======================= */
  function startGame(s) {
    stopClock();
    const teams = T.makeTeams(s.teams, s.nTeams);
    const own = s.packs.includes(OWN);
    // tug of war needs fewer pulls than a race
    const L = s.mode === 'tug' ? ({ 5: 3, 8: 5, 12: 7 }[s.length] || 5) : s.length;
    const st = {
      pos: teams.map(() => 0), rope: 0, turn: Math.floor(Math.random() * teams.length),
      deck: buildDeck(s), qi: -1, result: null, over: false, history: [], moves: 0
    };
    if (!own && !st.deck.length) { ICG.toast('No questions found for that level. Try "Both".'); return; }

    root.innerHTML = ''; root.className = 'race-game';
    const undoBtn = h('button', { class: 'iconbtn', title: 'Undo', html: ICG.icon('undo'), onclick: undo });
    const setupBtn = h('button', { class: 'iconbtn', title: 'Settings', html: ICG.icon('settings'),
      onclick: () => (st.moves && !st.over) ? ICG.confirm('Change settings?', 'This game will end.', 'Yes', showSetup) : showSetup() });
    const track = h('div', { class: 'track-area' });
    const card = h('div', { class: 'q-card card' });
    root.append(
      ICG.topbar(s.mode === 'tug' ? 'Tug of War' : 'Team Race', {
        extra: [undoBtn, setupBtn], leaveCheck: () => st.moves && !st.over,
        wheel: T.wheelOpts(teams, () => st.turn)
      }),
      track, card);

    /* ---------- track drawing ---------- */
    let lanes = [], tug = null;
    function buildTrack() {
      track.innerHTML = '';
      if (s.mode === 'tug') return buildTug();
      const n = teams.length, gap = 16, H = 770, laneH = (H - gap * (n - 1)) / n;
      const size = Math.min(laneH * 0.72, 170);
      lanes = teams.map((t, i) => {
        const runner = h('div', { class: 'runner' }, charImg(t.char, 'right'));
        runner.style.width = runner.style.height = size + 'px';
        const score = h('span', { class: 'lane-score' }, '0 / ' + L);
        const dots = h('div', { class: 'lane-dots' });
        const lane = h('div', { class: 'lane', style: { height: laneH + 'px', background: t.light, borderColor: t.color } },
          h('button', { class: 'lane-tag', style: { background: t.color }, onclick: () => ICG.classes.showMembers(t) }, t.name, ' ', score),
          dots, h('div', { class: 'finish' }), runner);
        track.append(lane);
        return { lane, runner, score, dots, size };
      });
      requestAnimationFrame(() => lanes.forEach((ln, i) => {
        const w = ln.lane.clientWidth, startX = 16, endX = w - 70 - ln.size;
        ln.startX = startX; ln.endX = endX;
        ln.dots.innerHTML = '';
        for (let k = 1; k <= L; k++) {
          const x = startX + (endX - startX) * k / L + ln.size / 2;
          ln.dots.append(h('div', { class: 'dot', style: { left: x + 'px' } }));
        }
        placeRunner(i, false);
      }));
    }
    function placeRunner(i, animate) {
      const ln = lanes[i]; if (!ln || ln.startX == null) return;
      const x = ln.startX + (ln.endX - ln.startX) * st.pos[i] / L;
      ln.runner.style.transition = animate ? 'left .7s cubic-bezier(.3,1.4,.5,1)' : 'none';
      ln.runner.style.left = x + 'px';
      ln.score.textContent = st.pos[i] + ' / ' + L;
      [...ln.dots.children].forEach((d, k) => d.classList.toggle('done', k < st.pos[i]));
      if (animate) { ln.runner.classList.remove('hop'); void ln.runner.offsetWidth; ln.runner.classList.add('hop'); }
    }
    function buildTug() {
      const step = 200 / L;
      const group = h('div', { class: 'tug-group' },
        h('div', { class: 'rope' }), h('div', { class: 'ribbon' }),
        h('div', { class: 'tug-char left' }, charImg(teams[0].char, 'right')),
        h('div', { class: 'tug-char right' }, charImg(teams[1].char, 'left')));
      const field = h('div', { class: 'tug-field' },
        h('div', { class: 'tug-zone left', style: { background: teams[0].light, borderColor: teams[0].color } }),
        h('div', { class: 'tug-zone right', style: { background: teams[1].light, borderColor: teams[1].color } }),
        h('div', { class: 'tug-line center' }),
        h('div', { class: 'tug-line win', style: { left: 'calc(50% - 200px)', background: teams[0].color } }),
        h('div', { class: 'tug-line win', style: { left: 'calc(50% + 200px)', background: teams[1].color } }),
        group);
      const tagL = h('div', { class: 'tug-tag left', style: { background: teams[0].color } }, teams[0].name);
      const tagR = h('div', { class: 'tug-tag right', style: { background: teams[1].color } }, teams[1].name);
      track.append(tagL, tagR, field);
      tug = { group, step };
      placeTug(false);
    }
    function placeTug(animate) {
      if (!tug) return;
      tug.group.style.transition = animate ? 'transform .7s cubic-bezier(.3,1.5,.5,1)' : 'none';
      tug.group.style.transform = 'translateX(' + (st.rope * tug.step) + 'px)';
      if (animate) { tug.group.classList.remove('pull'); void tug.group.offsetWidth; tug.group.classList.add('pull'); }
    }

    /* ---------- answer timer ---------- */
    const clockFill = h('div', { class: 'rt-fill' });
    const clockNum = h('div', { class: 'rt-num' });
    const clockBox = h('div', { class: 'rt-timer' }, h('div', { class: 'rt-bar' }, clockFill), clockNum);
    let clockLeft = 0, clockLast = 0, clockSec = -1;
    function startClock() {
      stopClock();
      if (!s.timer || st.over) { clockBox.style.display = 'none'; return; }
      clockBox.style.display = ''; clockBox.classList.remove('stopped', 'hurry');
      clockLeft = s.timer * 1000; clockLast = performance.now(); clockSec = -1;
      clockId = requestAnimationFrame(tickClock);
    }
    function tickClock(now) {
      // pause while a pop-up (e.g. the Pick wheel) is open
      if (!document.querySelector('.modal-back')) clockLeft -= now - clockLast;
      clockLast = now;
      const sec = Math.max(0, Math.ceil(clockLeft / 1000));
      clockFill.style.width = Math.max(0, clockLeft / (s.timer * 1000) * 100) + '%';
      if (sec !== clockSec) { clockSec = sec; clockNum.textContent = sec; if (sec <= 3 && sec > 0) { S.tick(); clockBox.classList.add('hurry'); } }
      if (clockLeft <= 0) { clockId = null; return timeUp(); }
      clockId = requestAnimationFrame(tickClock);
    }
    function freezeClock() { stopClock(); clockBox.classList.add('stopped'); }
    function timeUp() {
      if (st.over || st.result) return;
      S.tone(180, .5, { type: 'sawtooth', vol: .18 });
      snapshot();
      st.result = 'time';
      renderCard();
    }

    /* ---------- question card ---------- */
    function current() { return own ? null : st.deck[st.qi % st.deck.length]; }
    function nextQuestion() {
      st.qi++; st.result = null;
      if (!own && st.qi > 0 && st.qi % st.deck.length === 0) st.deck = ICG.shuffle(st.deck);
      const nx = own ? null : st.deck[(st.qi + 1) % st.deck.length];
      if (nx && nx.pic) ICG.preload(nx.pic);
      renderCard();
      startClock();
    }
    const nextTeam = () => teams[(st.turn + 1) % teams.length];
    function renderCard() {
      card.innerHTML = '';
      const t = teams[st.turn];
      card.append(h('div', { class: 'turn-pill', style: { background: t.color } },
        charImg(t.char, 'right', 'mini'), h('span', null, ICG.possessive(t.name) + ' turn')));
      card.append(clockBox);
      if (st.result) {
        const txt = st.result === 'right' ? 'Right! ' + t.name + ' +1' : st.result === 'time' ? "Time's up! " + t.name + ' - no point' : 'Not quite! ' + t.name + ' - no point';
        card.append(h('div', { class: 'rt-banner ' + (st.result === 'right' ? 'good' : '') }, txt));
      }
      const q = current();
      const qbox = h('div', { class: 'q-main' });
      if (!q) {
        qbox.append(ICG.picture('megaphone', 'images/app', 'q-pic'), h('div', { class: 'q-text', style: { fontSize: '52px' } }, "Teacher's question!"));
      } else {
        if (q.pic) qbox.append(ICG.picture(q.pic, 'images', 'q-pic'));
        const len = q.q.length;
        const fs = len > 90 ? 32 : len > 60 ? 38 : len > 35 ? 46 : 54;
        qbox.append(h('div', { class: 'q-text', style: { fontSize: fs + 'px' } }, q.q));
      }
      card.append(qbox);
      if (st.result) {
        if (q && q.a) card.append(h('div', { class: 'answer' }, q.a));
        const nt = nextTeam();
        card.append(h('button', { class: 'btn big rt-next', style: { background: nt.color }, onclick: goNext },
          h('span', { class: 'rt-next-top' }, 'Next question'),
          h('span', { class: 'rt-next-sub' }, charImg(nt.char, 'right', 'mini'), nt.name + ', get ready!')));
        return;
      }
      card.append(h('div', { class: 'row rt-judge' },
        h('button', { class: 'btn green', onclick: () => judge(true) }, '✓ Right'),
        h('button', { class: 'btn red', onclick: () => judge(false) }, '✗ Wrong')));
    }

    /* ---------- actions ---------- */
    function snapshot() { st.history.push({ pos: st.pos.slice(), rope: st.rope, turn: st.turn, qi: st.qi }); if (st.history.length > 50) st.history.shift(); }
    function judge(right) {
      if (st.over || st.result) return;
      freezeClock();
      snapshot(); st.moves++;
      const i = st.turn;
      if (right) {
        S.correct(); setTimeout(S.hop, 120);
        if (s.mode === 'tug') { st.rope += i === 0 ? -1 : 1; placeTug(true); }
        else { st.pos[i] = Math.min(L, st.pos[i] + 1); placeRunner(i, true); }
        const winner = s.mode === 'tug' ? (st.rope <= -L ? 0 : st.rope >= L ? 1 : -1) : (st.pos[i] >= L ? i : -1);
        if (winner >= 0) { st.over = true; st.result = 'right'; renderCard(); setTimeout(() => celebrate(winner), 1200); return; }
      } else S.nobody();
      st.result = right ? 'right' : 'wrong';
      renderCard();
    }
    function goNext() {
      if (!st.result || st.over) return;
      st.turn = (st.turn + 1) % teams.length;
      nextQuestion();
    }
    function undo() {
      if (st.over || !st.history.length) { ICG.toast('Nothing to undo'); return; }
      const p = st.history.pop();
      st.pos = p.pos; st.rope = p.rope; st.turn = p.turn; st.qi = p.qi; st.result = null;
      st.moves = Math.max(0, st.moves - 1);
      if (s.mode === 'tug') placeTug(true); else teams.forEach((_, i) => placeRunner(i, false));
      renderCard(); startClock(); ICG.toast('Undone');
    }
    function celebrate(w) {
      S.win(); ICG.confetti(4000);
      const t = teams[w];
      let ranking = null;
      if (s.mode !== 'tug' && teams.length > 2) {
        const order = teams.map((tm, i) => ({ tm, p: st.pos[i] })).sort((a, b) => b.p - a.p);
        ranking = h('div', { class: 'ranking' }, order.map((o, k) =>
          h('div', { class: 'rank-row' }, h('b', null, (k + 1) + '.'), charImg(o.tm.char, 'right', 'mini'), h('span', null, o.tm.name), h('span', { class: 'rp' }, o.p + ' / ' + L))));
      }
      const m = ICG.modal([
        h('div', { class: 'win-top' }, ICG.picture('trophy', 'images/app', 'win-trophy'), charImg(t.char, 'right', 'win-char')),
        h('h2', { style: { fontSize: '84px', margin: '6px 0 10px', color: t.color } }, t.name + ' win!'),
        ranking,
        h('div', { class: 'row', style: { marginTop: '26px' } },
          h('button', { class: 'btn big green', onclick: () => { m.close(); startGame(s); } }, 'Play again'),
          h('button', { class: 'btn big white', onclick: () => { m.close(); showSetup(); } }, 'Settings'),
          h('button', { class: 'btn big grey', onclick: () => { m.close(); location.hash = ''; } }, 'Home'))
      ], { sticky: true });
      m.box.style.textAlign = 'center'; m.box.style.minWidth = '1000px';
    }

    // laptop keys: Y or 1 = right, N or 0 = wrong, Enter/Space = next question, U = undo
    if (keyHandler) document.removeEventListener('keydown', keyHandler);
    keyHandler = e => {
      if (document.querySelector('.modal-back') || e.target.matches('input, textarea')) return;
      const k = e.key.toLowerCase();
      if (k === 'u') return undo();
      if (st.result) { if (k === 'enter' || k === ' ') { e.preventDefault(); goNext(); } return; }
      if (k === 'y' || k === '1') judge(true);
      else if (k === 'n' || k === '0') judge(false);
    };
    document.addEventListener('keydown', keyHandler);

    buildTrack();
    nextQuestion();
  }
})();
