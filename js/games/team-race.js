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
        h('div', { class: 'slabel', style: { width: 'auto', marginLeft: '30px' } }, 'Teams'),
        s.mode === 'tug' ? h('div', { class: 'small-note' }, '2 teams') : seg([[2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6'], [7, '7'], [8, '8']], s.nTeams, v => { s.nTeams = v; })));
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

  /* ======================= THE GAME =======================
     Played in ROUNDS: every team in play gets one question, the answers
     are marked with a tick or a cross, and at the end of the round all
     pieces move together. So going first is never an advantage.
     Race: if more than one team reaches the finish in the same round,
     those teams go back to the start for a SUDDEN DEATH (up to 5 rounds);
     teams that fall behind are out. */
  const SD_ROUNDS = 5;
  function startGame(s) {
    stopClock();
    const teams = T.makeTeams(s.teams, s.nTeams);
    const own = s.packs.includes(OWN);
    const tugMode = s.mode === 'tug';
    const L = tugMode ? ({ 5: 3, 8: 5, 12: 7 }[s.length] || 5) : s.length;
    const st = {
      pos: teams.map(() => 0), rope: 0,
      active: teams.map((_, i) => i),         // teams still in the game
      first: Math.floor(Math.random() * teams.length), // who starts this round
      order: [], k: 0,                          // this round's order and whose turn in it
      marks: teams.map(() => null),             // true / false / null for this round
      round: 1, sd: 0,                          // sd = sudden-death round number (0 = normal)
      deck: buildDeck(s), qi: -1, result: null, phase: 'q', over: false, history: [], moves: 0
    };
    if (!own && !st.deck.length) { ICG.toast('No questions found for that level. Try "Both".'); return; }
    const turnTeam = () => st.order[st.k];

    root.innerHTML = ''; root.className = 'race-game' + (teams.length > 4 ? ' many' : '');
    const undoBtn = h('button', { class: 'iconbtn', title: 'Undo', html: ICG.icon('undo'), onclick: undo });
    const setupBtn = h('button', { class: 'iconbtn', title: 'Settings', html: ICG.icon('settings'),
      onclick: () => (st.moves && !st.over) ? ICG.confirm('Change settings?', 'This game will end.', 'Yes', showSetup) : showSetup() });
    const track = h('div', { class: 'track-area' });
    const card = h('div', { class: 'q-card card' });
    root.append(
      ICG.topbar(tugMode ? 'Tug of War' : 'Team Race', {
        extra: [undoBtn, setupBtn], leaveCheck: () => st.moves && !st.over,
        wheel: T.wheelOpts(teams, () => (st.phase === 'q' ? turnTeam() : -1))
      }),
      track, card);

    /* ---------- track drawing ---------- */
    let lanes = [], tug = null;
    function buildTrack() {
      track.innerHTML = '';
      if (tugMode) return buildTug();
      const n = teams.length, gap = 16, H = 770, laneH = (H - gap * (n - 1)) / n;
      const size = Math.min(laneH * (n > 4 ? 0.6 : 0.72), 170);
      lanes = teams.map((t, i) => {
        const runner = h('div', { class: 'runner' }, charImg(t.char, 'right'));
        runner.style.width = runner.style.height = size + 'px';
        const score = h('span', { class: 'lane-score' });
        const mark = h('span', { class: 'lane-mark' });
        const dots = h('div', { class: 'lane-dots' });
        const lane = h('div', { class: 'lane', style: { height: laneH + 'px', background: t.light, borderColor: t.color } },
          h('button', { class: 'lane-tag', style: { background: t.color }, onclick: () => ICG.classes.showMembers(t) }, t.name, ' ', score),
          mark, dots, h('div', { class: 'finish' }), runner);
        track.append(lane);
        return { lane, runner, score, dots, size, mark };
      });
      requestAnimationFrame(() => { drawDots(); teams.forEach((_, i) => placeRunner(i, false)); });
    }
    const trackLen = () => (st.sd ? SD_ROUNDS : L);
    function drawDots() {
      lanes.forEach(ln => {
        const w = ln.lane.clientWidth, startX = 16, endX = w - 70 - ln.size;
        ln.startX = startX; ln.endX = endX;
        ln.dots.innerHTML = '';
        for (let k = 1; k <= trackLen(); k++) ln.dots.append(h('div', { class: 'dot', style: { left: (startX + (endX - startX) * k / trackLen() + ln.size / 2) + 'px' } }));
      });
    }
    function placeRunner(i, animate) {
      const ln = lanes[i]; if (!ln || ln.startX == null) return;
      const x = ln.startX + (ln.endX - ln.startX) * Math.min(st.pos[i], trackLen()) / trackLen();
      ln.runner.style.transition = animate ? 'left .7s cubic-bezier(.3,1.4,.5,1)' : 'none';
      ln.runner.style.left = x + 'px';
      ln.score.textContent = st.sd ? 'Sudden death' : st.pos[i] + ' / ' + L;
      [...ln.dots.children].forEach((d, k) => d.classList.toggle('done', k < st.pos[i]));
      ln.lane.classList.toggle('out', !st.active.includes(i));
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
      const markL = h('span', { class: 'lane-mark' }), markR = h('span', { class: 'lane-mark' });
      track.append(h('div', { class: 'tug-tag left', style: { background: teams[0].color } }, teams[0].name, markL),
        h('div', { class: 'tug-tag right', style: { background: teams[1].color } }, teams[1].name, markR), field);
      tug = { group, step, marks: [markL, markR] };
      placeTug(false);
    }
    function placeTug(animate) {
      if (!tug) return;
      tug.group.style.transition = animate ? 'transform .7s cubic-bezier(.3,1.5,.5,1)' : 'none';
      tug.group.style.transform = 'translateX(' + (st.rope * tug.step) + 'px)';
      if (animate) { tug.group.classList.remove('pull'); void tug.group.offsetWidth; tug.group.classList.add('pull'); }
    }
    function drawMarks() {
      const els = tugMode ? (tug ? tug.marks : []) : lanes.map(l => l.mark);
      els.forEach((el, i) => {
        const m = st.marks[i];
        el.textContent = m === true ? '✓' : m === false ? '✗' : '';
        el.className = 'lane-mark' + (m === true ? ' yes' : m === false ? ' no' : '');
      });
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
      if (!document.querySelector('.modal-back')) clockLeft -= now - clockLast; // pause while a pop-up is open
      clockLast = now;
      const sec = Math.max(0, Math.ceil(clockLeft / 1000));
      clockFill.style.width = Math.max(0, clockLeft / (s.timer * 1000) * 100) + '%';
      if (sec !== clockSec) { clockSec = sec; clockNum.textContent = sec; if (sec <= 3 && sec > 0) { S.tick(); clockBox.classList.add('hurry'); } }
      if (clockLeft <= 0) { clockId = null; return judge(false, true); }
      clockId = requestAnimationFrame(tickClock);
    }
    function freezeClock() { stopClock(); clockBox.classList.add('stopped'); }

    /* ---------- rounds ---------- */
    function newRound() {
      // start with a different team each round
      const act = st.active.slice();
      let startAt = act.indexOf(st.first); if (startAt < 0) startAt = 0;
      st.order = act.slice(startAt).concat(act.slice(0, startAt));
      st.first = act[(startAt + 1) % act.length];
      st.k = 0; st.marks = teams.map(() => null);
      drawMarks();
      nextQuestion();
    }
    function current() { return own ? null : st.deck[st.qi % st.deck.length]; }
    function nextQuestion() {
      st.qi++; st.result = null; st.phase = 'q';
      if (!own && st.qi > 0 && st.qi % st.deck.length === 0) st.deck = ICG.shuffle(st.deck);
      const nx = own ? null : st.deck[(st.qi + 1) % st.deck.length];
      if (nx && nx.pic) ICG.preload(nx.pic);
      renderCard();
      startClock();
    }
    const roundLabel = () => st.sd ? 'Sudden death ' + st.sd + ' of ' + SD_ROUNDS : 'Round ' + st.round;
    function renderCard() {
      card.innerHTML = '';
      card.append(h('div', { class: 'round-lbl' + (st.sd ? ' sd' : '') }, roundLabel() + (st.phase === 'q' ? '  ·  question ' + (st.k + 1) + ' of ' + st.order.length : '')));
      if (st.phase === 'move') return renderMove();
      if (st.phase === 'next') return renderNextRound();
      const t = teams[turnTeam()];
      card.append(h('div', { class: 'turn-pill', style: { background: t.color } },
        charImg(t.char, 'right', 'mini'), h('span', null, ICG.possessive(t.name) + ' turn')));
      card.append(clockBox);
      if (st.result) {
        const txt = st.result === 'right' ? 'Right! ✓' : st.result === 'time' ? "Time's up! ✗" : 'Not quite! ✗';
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
        const last = st.k >= st.order.length - 1;
        if (last) {
          card.append(h('button', { class: 'btn big yellow rt-next', onclick: goNext },
            h('span', { class: 'rt-next-top' }, 'Move the teams!'), h('span', { class: 'rt-next-sub' }, 'End of ' + roundLabel().toLowerCase())));
        } else {
          const nt = teams[st.order[st.k + 1]];
          card.append(h('button', { class: 'btn big rt-next', style: { background: nt.color }, onclick: goNext },
            h('span', { class: 'rt-next-top' }, 'Next question'),
            h('span', { class: 'rt-next-sub' }, charImg(nt.char, 'right', 'mini'), nt.name + ', get ready!')));
        }
        return;
      }
      card.append(h('div', { class: 'row rt-judge' },
        h('button', { class: 'btn green', onclick: () => judge(true) }, '✓ Right'),
        h('button', { class: 'btn red', onclick: () => judge(false) }, '✗ Wrong')));
    }
    function renderMove() {
      card.append(h('div', { class: 'move-msg' }, 'Moving...'));
    }
    function renderNextRound() {
      const t = teams[st.order[0]];
      if (st.msg) card.append(h('div', { class: 'move-msg' + (st.msgBig ? ' big' : '') }, st.msg));
      card.append(h('div', { class: 'round-sum' }, st.active.map(i => h('div', { class: 'rs-row', style: { borderColor: teams[i].color } },
        charImg(teams[i].char, 'right', 'mini'), h('span', null, teams[i].name),
        h('b', null, tugMode ? '' : (st.sd ? '' : st.pos[i] + ' / ' + L))))));
      card.append(h('button', { class: 'btn big rt-next', style: { background: t.color }, onclick: () => { st.phase = 'q'; newRoundStarted(); } },
        h('span', { class: 'rt-next-top' }, st.sd ? 'Sudden death ' + st.sd : 'Round ' + st.round),
        h('span', { class: 'rt-next-sub' }, charImg(t.char, 'right', 'mini'), t.name + ', get ready!')));
    }
    let newRoundStarted = () => {};

    /* ---------- actions ---------- */
    function snapshot() {
      st.history.push(JSON.parse(JSON.stringify({ pos: st.pos, rope: st.rope, active: st.active, first: st.first, order: st.order, k: st.k,
        marks: st.marks, round: st.round, sd: st.sd, qi: st.qi, phase: st.phase, result: st.result, msg: st.msg, msgBig: st.msgBig })));
      if (st.history.length > 80) st.history.shift();
    }
    function judge(right, timeUp) {
      if (st.over || st.result || st.phase !== 'q') return;
      freezeClock();
      snapshot(); st.moves++;
      st.marks[turnTeam()] = right; drawMarks();
      if (right) S.correct(); else if (timeUp) S.tone(180, .5, { type: 'sawtooth', vol: .18 }); else S.nobody();
      st.result = right ? 'right' : timeUp ? 'time' : 'wrong';
      renderCard();
    }
    function goNext() {
      if (!st.result || st.over) return;
      if (st.k < st.order.length - 1) { st.k++; return nextQuestion(); }
      endRound();
    }
    // end of round: everybody moves together, then check for a winner
    function endRound() {
      snapshot();
      st.phase = 'move'; st.result = null; renderCard();
      let anyMove = false;
      if (tugMode) {
        const d = (st.marks[0] ? -1 : 0) + (st.marks[1] ? 1 : 0);
        if (d) { st.rope += d; placeTug(true); anyMove = true; }
      } else {
        st.active.forEach(i => { if (st.marks[i]) { st.pos[i]++; placeRunner(i, true); anyMove = true; } });
      }
      if (anyMove) setTimeout(S.hop, 100); else S.nobody();
      setTimeout(afterMove, 1000);
    }
    function afterMove() {
      st.marks = teams.map(() => null); drawMarks();
      if (tugMode) {
        if (Math.abs(st.rope) >= L) return finish([st.rope < 0 ? 0 : 1]);
        return nextRoundScreen(null);
      }
      if (st.sd) {
        // sudden death: the teams behind are out; one leader left = winner
        const best = Math.max(...st.active.map(i => st.pos[i]));
        const leaders = st.active.filter(i => st.pos[i] === best);
        const out = st.active.filter(i => st.pos[i] < best);
        if (leaders.length === 1) return finish(leaders);
        if (st.sd >= SD_ROUNDS) return finish(leaders);
        st.active = leaders; teams.forEach((_, i) => placeRunner(i, false));
        st.sd++;
        return nextRoundScreen(out.length ? out.map(i => teams[i].name).join(' and ') + (out.length > 1 ? ' are' : ' is') + ' out!' : 'Still tied!');
      }
      const done = st.active.filter(i => st.pos[i] >= L);
      if (done.length === 1) return finish(done);
      if (done.length > 1) return startSuddenDeath(done);
      st.round++;
      nextRoundScreen(null);
    }
    function startSuddenDeath(tied) {
      S.drum();
      st.active = tied; st.sd = 1;
      tied.forEach(i => { st.pos[i] = 0; });
      drawDots(); teams.forEach((_, i) => placeRunner(i, false));
      nextRoundScreen("It's a tie! Sudden death: " + tied.map(i => teams[i].name).join(' vs ') + '!', true);
    }
    function nextRoundScreen(msg, big) {
      st.msg = msg; st.msgBig = !!big;
      // who starts the next round
      const act = st.active.slice();
      let startAt = act.indexOf(st.first); if (startAt < 0) startAt = 0;
      st.order = act.slice(startAt).concat(act.slice(0, startAt));
      st.phase = 'next';
      renderCard();
    }
    newRoundStarted = () => newRound();
    function undo() {
      if (st.over || !st.history.length || st.phase === 'move') { ICG.toast('Nothing to undo'); return; }
      stopClock();
      const p = st.history.pop();
      Object.assign(st, p);
      if (!st.result && st.phase === 'q') { /* back to the question */ }
      if (tugMode) placeTug(true); else { drawDots(); teams.forEach((_, i) => placeRunner(i, false)); }
      drawMarks(); renderCard();
      if (st.phase === 'q' && !st.result) startClock(); else clockBox.classList.add('stopped');
      ICG.toast('Undone');
    }
    function finish(winners) {
      if (st.over) return;
      st.over = true; stopClock();
      if (!tugMode && st.sd) { st.active = winners.slice(); teams.forEach((_, i) => placeRunner(i, false)); }
      setTimeout(() => celebrate(winners), 500);
    }
    function celebrate(ws) {
      S.win(); ICG.confetti(4000);
      const tie = ws.length > 1;
      const t = teams[ws[0]];
      let ranking = null;
      if (!tugMode && teams.length > 2 && !tie) {
        const order = teams.map((tm, i) => ({ tm, i, p: st.pos[i] })).sort((a, b) => (ws.includes(b.i) - ws.includes(a.i)) || b.p - a.p);
        ranking = h('div', { class: 'ranking' }, order.map((o, k) =>
          h('div', { class: 'rank-row' }, h('b', null, (k + 1) + '.'), charImg(o.tm.char, 'right', 'mini'), h('span', null, o.tm.name))));
      }
      const m = ICG.modal([
        h('div', { class: 'win-top' }, ICG.picture('trophy', 'images/app', 'win-trophy'), ws.map(i => charImg(teams[i].char, 'right', 'win-char'))),
        h('h2', { style: { fontSize: '84px', margin: '6px 0 10px', color: tie ? 'var(--ink)' : t.color } },
          tie ? "It's a tie! " + ws.map(i => teams[i].name).join(' & ') : t.name + ' win!'),
        ranking,
        h('div', { class: 'row', style: { marginTop: '26px' } },
          h('button', { class: 'btn big green', onclick: () => { m.close(); startGame(s); } }, 'Play again'),
          h('button', { class: 'btn big white', onclick: () => { m.close(); showSetup(); } }, 'Settings'),
          h('button', { class: 'btn big grey', onclick: () => { m.close(); location.hash = ''; } }, 'Home'))
      ], { sticky: true });
      m.box.style.textAlign = 'center'; m.box.style.minWidth = '1000px';
    }

    // laptop keys: Y or 1 = right, N or 0 = wrong, Enter/Space = next, U = undo
    if (keyHandler) document.removeEventListener('keydown', keyHandler);
    keyHandler = e => {
      if (document.querySelector('.modal-back') || e.target.matches('input, textarea')) return;
      const k = e.key.toLowerCase();
      if (k === 'u') return undo();
      const go = k === 'enter' || k === ' ';
      if (st.phase === 'next') { if (go) { e.preventDefault(); st.phase = 'q'; newRound(); } return; }
      if (st.result) { if (go) { e.preventDefault(); goNext(); } return; }
      if (st.phase !== 'q') return;
      if (k === 'y' || k === '1') judge(true);
      else if (k === 'n' || k === '0') judge(false);
    };
    document.addEventListener('keydown', keyHandler);

    ICG._race = { st }; // for testing
    buildTrack();
    newRound();
  }
})();
