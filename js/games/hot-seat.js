/* ============================================================
   Hot Seat
   One student sits with their back to the TV. Their team gives
   clues. Guess as many words as you can before the time runs out!
   ============================================================ */
(function () {
  'use strict';
  const ICG = window.ICG, h = ICG.h, S = ICG.sound, T = ICG.T;

  const DEFAULTS = { nTeams: 2, sets: null, own: false, time: 60, rounds: 1 };
  function loadSettings() {
    const s = Object.assign({}, DEFAULTS, ICG.store.get('hotseat.settings', {}));
    s.teams = T.loadTeams();
    const ids = ICG.pictureSets.map(p => p.id);
    s.sets = (s.sets || ids.slice(0, 1)).filter(id => ids.includes(id));
    if (!s.sets.length && !s.own && ids.length) s.sets = [ids[0]];
    return s;
  }
  const ownWords = () => ICG.store.get('hotseat.words', []);

  let root = null, keyHandler = null, timer = null;
  const cleanup = () => {
    if (keyHandler) document.removeEventListener('keydown', keyHandler); keyHandler = null;
    if (timer) { cancelAnimationFrame(timer); timer = null; }
  };

  ICG.register('hotseat', {
    title: 'Hot Seat', ready: true,
    mount(stage) { root = stage; showSetup(); },
    unmount: cleanup
  });

  /* ======================= SETUP ======================= */
  function showSetup() {
    cleanup();
    const s = loadSettings();
    root.innerHTML = ''; root.className = 'setup';
    const body = h('div', { class: 'setup-card card' });
    const save = () => { const c = Object.assign({}, s); delete c.teams; ICG.store.set('hotseat.settings', c); };
    const set = k => v => { s[k] = v; save(); render(); };
    function editWords() {
      const ta = h('textarea', { placeholder: 'One word on each line (or separated by commas)' });
      ta.value = ownWords().join('\n');
      const m = ICG.modal([
        h('h2', null, 'Our own words'),
        h('p', { style: { marginBottom: '16px' } }, 'For example this week\'s spelling words. They show as words (no picture).'),
        ta, h('div', { style: { height: '22px' } }),
        h('div', { class: 'row' },
          h('button', { class: 'btn grey', onclick: () => m.close() }, 'Cancel'),
          h('button', { class: 'btn green', onclick: () => {
            const list = ta.value.split(/[\n,]/).map(x => x.trim()).filter(Boolean);
            ICG.store.set('hotseat.words', list); s.own = list.length > 0; save(); m.close(); render();
          } }, 'Save'))
      ], { sticky: true });
      m.box.style.width = '1200px';
    }
    function render() {
      body.innerHTML = '';
      body.append(h('div', { class: 'srow' }, h('div', { class: 'slabel' }, 'Teams'),
        T.seg([[2, '2'], [3, '3'], [4, '4']], s.nTeams, set('nTeams')),
        h('div', { class: 'slabel', style: { width: 'auto', marginLeft: '30px' } }, 'Time'),
        T.seg([[30, '30s'], [60, '60s'], [90, '90s']], s.time, set('time')),
        h('div', { class: 'slabel', style: { width: 'auto', marginLeft: '30px' } }, 'Turns'),
        T.seg([[1, '1'], [2, '2'], [3, '3']], s.rounds, set('rounds'))));
      body.append(h('div', { class: 'srow' }, h('div', { class: 'slabel' }, ''), T.teamChips(s.teams, s.nTeams, () => { save(); render(); })));
      body.append(T.classRow(s.nTeams, s.teams, () => { save(); render(); }));
      const words = ownWords();
      const chips = h('div', { class: 'pack-chips' }, ICG.pictureSets.map(p => {
        const on = s.sets.includes(p.id);
        return h('button', { class: 'chip' + (on ? ' on' : ''), onclick: () => {
          if (on) s.sets = s.sets.filter(x => x !== p.id); else s.sets.push(p.id);
          if (!s.sets.length && !s.own) s.sets = [p.id];
          save(); render();
        } }, ICG.picture(p.picture), p.title + ' (' + p.words.length + ')');
      }),
        h('button', { class: 'chip own' + (s.own ? ' on' : ''), onclick: () => {
          if (!words.length) return editWords();
          s.own = !s.own; if (!s.own && !s.sets.length) s.sets = [ICG.pictureSets[0].id]; save(); render();
        } }, ICG.picture('pencil'), 'Our own words' + (words.length ? ' (' + words.length + ')' : '')),
        h('button', { class: 'chip', onclick: editWords }, words.length ? 'Edit our words' : 'Type our words...'));
      body.append(h('div', { class: 'srow top' }, h('div', { class: 'slabel' }, 'Words'), chips));
      const n = buildDeck(s).length;
      body.append(h('div', { class: 'srow end' },
        h('div', { class: 'small-note', style: { flex: 1, textAlign: 'left' } }, n + ' words ready. One player sits with their back to the TV - the team gives clues.'),
        h('button', { class: 'btn big green', onclick: () => startGame(s) }, "Let's go!")));
    }
    root.append(ICG.topbar('Hot Seat - Setup'), body);
    render();
  }

  function buildDeck(s) {
    let list = [];
    ICG.pictureSets.filter(p => s.sets.includes(p.id)).forEach(p => { list = list.concat(p.words.map(w => ({ name: w.name, pic: w.pic }))); });
    if (s.own) list = list.concat(ownWords().map(w => ({ name: w, pic: null })));
    return ICG.shuffle(list);
  }

  /* ======================= GAME ======================= */
  function startGame(s) {
    cleanup();
    const teams = T.makeTeams(s.teams, s.nTeams);
    let deck = buildDeck(s), di = 0;
    if (!deck.length) { ICG.toast('Choose some words first'); return; }
    const nextWord = () => { if (di >= deck.length) { deck = ICG.shuffle(deck); di = 0; } const w = deck[di++]; const nx = deck[di]; if (nx && nx.pic) ICG.preload(nx.pic); return w; };
    const st = { scores: teams.map(() => 0), turn: Math.floor(Math.random() * teams.length), turnNo: 0, total: teams.length * s.rounds, over: false };

    root.innerHTML = ''; root.className = 'hotseat-game';
    const main = h('div', { class: 'hs-main card' });
    const sb = T.scoreboard(teams);
    const endBtn = h('button', { class: 'iconbtn wide', onclick: () => ICG.confirm('End the game now?', 'The team with the most points wins.', 'End game', finish) }, 'End');
    const setupBtn = h('button', { class: 'iconbtn', title: 'Settings', html: ICG.icon('settings'),
      onclick: () => (st.turnNo > 0 && !st.over) ? ICG.confirm('Change settings?', 'This game will end.', 'Yes', showSetup) : showSetup() });
    root.append(
      ICG.topbar('Hot Seat', { extra: [setupBtn, endBtn], leaveCheck: () => st.turnNo > 0 && !st.over, wheel: T.wheelOpts(teams, () => st.turn) }),
      main,
      h('div', { class: 'hs-side' }, sb.el, h('div', { class: 'hs-turns' })));
    const turnsLbl = root.querySelector('.hs-turns');

    function side() {
      sb.update(st.scores, st.turn);
      turnsLbl.textContent = 'Turn ' + Math.min(st.turnNo + 1, st.total) + ' of ' + st.total;
    }
    function setKeys(map) {
      if (keyHandler) document.removeEventListener('keydown', keyHandler);
      keyHandler = e => {
        if (document.querySelector('.modal-back')) return;
        const f = map[e.key.toLowerCase()] || (e.key === ' ' && map.space);
        if (f) { e.preventDefault(); f(); }
      };
      document.addEventListener('keydown', keyHandler);
    }

    /* ----- 1. get ready ----- */
    function ready() {
      side();
      const t = teams[st.turn];
      main.innerHTML = '';
      main.append(
        h('div', { class: 'turn-pill big', style: { background: t.color } }, T.charImg(t.char, 'right', 'mini'), h('span', null, ICG.possessive(t.name) + ' turn')),
        h('div', { class: 'hs-ready' },
          ICG.picture('chair', 'images/app', 'hs-chair'),
          h('div', { class: 'hs-rules' },
            h('div', null, '1. One player sits in the hot seat, with their back to the TV.'),
            h('div', null, '2. The team gives clues. Don\'t say the word!'),
            h('div', null, '3. Guess as many words as you can in ' + s.time + ' seconds.'))),
        h('div', { class: 'row hs-btns' },
          t.members && t.members.length ? h('button', { class: 'btn big white', onclick: () => ICG.openWheel(T.wheelOpts(teams, () => st.turn)) }, 'Pick a player') : null,
          h('button', { class: 'btn big green', onclick: countdown }, 'Start!')));
      setKeys({ space: countdown, enter: countdown });
    }

    /* ----- 2. 3-2-1 ----- */
    function countdown() {
      setKeys({});
      let n = 3;
      const num = h('div', { class: 'hs-count' }, n);
      main.innerHTML = ''; main.append(num);
      S.tone(600, .15, { type: 'triangle', vol: .3 });
      const iv = setInterval(() => {
        if (!num.isConnected) { clearInterval(iv); return; }
        n--;
        if (n > 0) { num.textContent = n; num.classList.remove('pop'); void num.offsetWidth; num.classList.add('pop'); S.tone(600, .15, { type: 'triangle', vol: .3 }); }
        else { clearInterval(iv); S.tone(900, .3, { type: 'triangle', vol: .3 }); play(); }
      }, 800);
    }

    /* ----- 3. play ----- */
    function play() {
      const t = teams[st.turn];
      const got = [], skipped = [];
      let word = nextWord();
      let left = s.time * 1000, last = performance.now(), paused = false, lastSec = s.time;
      const bar = h('div', { class: 'hs-bar-fill', style: { background: t.color } });
      const secs = h('div', { class: 'hs-secs' }, s.time);
      const count = h('div', { class: 'hs-got', style: { color: t.color } }, 'Got: 0');
      const card = h('div', { class: 'hs-card' });
      const pauseBtn = h('button', { class: 'btn white', onclick: togglePause }, 'Pause');
      main.innerHTML = '';
      main.append(
        h('div', { class: 'hs-top' }, h('div', { class: 'hs-bar' }, bar), secs),
        card,
        h('div', { class: 'row hs-btns' },
          h('button', { class: 'btn big green hs-yes', onclick: yes }, 'Got it!'),
          h('button', { class: 'btn big white', onclick: skip }, 'Skip'),
          pauseBtn),
        count);
      function showWord() {
        card.innerHTML = '';
        if (word.pic) card.append(ICG.picture(word.pic, 'images', 'hs-pic'));
        card.append(h('div', { class: 'hs-word' + (word.pic ? '' : ' big') }, word.name));
        card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop');
      }
      function yes() { if (paused) return; got.push(word.name); S.correct(); st.scores[st.turn]++; side(); count.textContent = 'Got: ' + got.length; word = nextWord(); showWord(); }
      function skip() { if (paused) return; skipped.push(word.name); S.pop(); word = nextWord(); showWord(); }
      function togglePause() {
        paused = !paused; last = performance.now();
        pauseBtn.textContent = paused ? 'Go on' : 'Pause';
        card.classList.toggle('paused', paused);
      }
      function tick(now) {
        if (!paused) { left -= now - last; }
        last = now;
        const sec = Math.max(0, Math.ceil(left / 1000));
        bar.style.width = Math.max(0, left / (s.time * 1000) * 100) + '%';
        if (sec !== lastSec) { lastSec = sec; secs.textContent = sec; if (sec <= 5 && sec > 0) { S.tick(); secs.classList.add('hurry'); } }
        if (left <= 0) { timer = null; timeUp(got, skipped); return; }
        timer = requestAnimationFrame(tick);
      }
      showWord();
      side();
      timer = requestAnimationFrame(tick);
      setKeys({ space: yes, y: yes, s: skip, n: skip, p: togglePause });
    }

    /* ----- 4. time's up ----- */
    function timeUp(got, skipped) {
      setKeys({});
      S.tone(180, .6, { type: 'sawtooth', vol: .18 });
      const t = teams[st.turn];
      st.turnNo++;
      const last = st.turnNo >= st.total;
      if (got.length) ICG.confetti(1800);
      main.innerHTML = '';
      main.append(
        h('div', { class: 'hs-up' }, "Time's up!"),
        h('div', { class: 'hs-result', style: { color: t.color } }, t.name + ' got ' + got.length + (got.length === 1 ? ' word!' : ' words!')),
        h('div', { class: 'hs-list' },
          got.map(w => h('span', { class: 'hs-chip yes' }, w)),
          skipped.map(w => h('span', { class: 'hs-chip no' }, w))),
        h('div', { class: 'row hs-btns' },
          h('button', { class: 'btn big green', onclick: () => { if (last) finish(); else { st.turn = (st.turn + 1) % teams.length; ready(); } } }, last ? 'See the winner!' : 'Next team')));
      side();
      setKeys({ enter: () => main.querySelector('.hs-btns .btn').click() });
    }

    function finish() {
      if (st.over) return;
      st.over = true; cleanup();
      T.celebrate(teams, st.scores, { unit: ' words', again: () => startGame(s), settings: showSetup });
    }

    ready();
  }
})();
