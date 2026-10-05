/* ============================================================
   Odd One Out
   Four pictures - which one doesn't belong, and why?
   ============================================================ */
(function () {
  'use strict';
  const ICG = window.ICG, h = ICG.h, S = ICG.sound, T = ICG.T;

  /* ----- "Harder" rounds come from packs/odd-one-out.js ----- */
  const WRITTEN = [];
  window.addOddOneOut = function (text) {
    String(text || '').split(/\r?\n/).forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('//')) return;
      const [items, odd, why] = line.split('|').map(x => (x || '').trim());
      const pics = items.split(',').map(x => x.trim()).filter(Boolean);
      if (pics.length !== 4 || !pics.includes(odd)) return;
      WRITTEN.push({ pics, odd, why: why || '' });
    });
  };

  const LABELS = ['A', 'B', 'C', 'D'];
  const DEFAULTS = { nTeams: 2, level: 'both', rounds: 8, words: true };
  function loadSettings() {
    const s = Object.assign({}, DEFAULTS, ICG.store.get('oddone.settings', {}));
    s.teams = T.loadTeams();
    return s;
  }
  function nameOf(pic) {
    for (const p of ICG.pictureSets) { const w = p.words.find(x => x.pic === pic); if (w) return w.name; }
    return pic.replace(/-/g, ' ');
  }
  // Easy rounds: 3 pictures from one group + 1 from another
  function makeEasy() {
    const groups = ICG.pictureSets.filter(p => p.group && p.words.length >= 3);
    if (!groups.length) return null;
    const g = groups[Math.floor(Math.random() * groups.length)];
    const others = ICG.pictureSets.filter(p => p !== g && p.words.length);
    const o = others[Math.floor(Math.random() * others.length)];
    const three = ICG.shuffle(g.words).slice(0, 3).map(w => w.pic);
    const odd = ICG.shuffle(o.words)[0].pic;
    if (three.includes(odd)) return makeEasy();
    return { pics: ICG.shuffle(three.concat(odd)), odd, why: 'The others are all ' + g.group + '.' };
  }
  function buildRounds(s) {
    const out = [];
    const hard = ICG.shuffle(WRITTEN).map(r => ({ pics: ICG.shuffle(r.pics), odd: r.odd, why: r.why }));
    for (let i = 0; i < s.rounds; i++) {
      const useHard = s.level === 'harder' || (s.level === 'both' && i % 2 === 1);
      const r = useHard && hard.length ? hard.shift() : makeEasy();
      if (r) out.push(r);
    }
    return out;
  }

  let root = null, keyHandler = null;
  const cleanup = () => { if (keyHandler) document.removeEventListener('keydown', keyHandler); keyHandler = null; };

  ICG.register('oddone', {
    title: 'Odd One Out', ready: true,
    mount(stage) { root = stage; showSetup(); },
    unmount: cleanup
  });

  /* ======================= SETUP ======================= */
  function showSetup() {
    cleanup();
    const s = loadSettings();
    root.innerHTML = ''; root.className = 'setup';
    const body = h('div', { class: 'setup-card card' });
    const save = () => { const c = Object.assign({}, s); delete c.teams; ICG.store.set('oddone.settings', c); };
    const set = k => v => { s[k] = v; save(); render(); };
    function render() {
      body.innerHTML = '';
      body.append(h('div', { class: 'srow' }, h('div', { class: 'slabel' }, 'Teams'),
        T.teamSeg(s.nTeams, set('nTeams')),
        h('div', { class: 'slabel', style: { width: 'auto', marginLeft: '30px' } }, 'Rounds'),
        T.seg([[5, '5'], [8, '8'], [10, '10']], s.rounds, set('rounds'))));
      body.append(h('div', { class: 'srow' }, h('div', { class: 'slabel' }, ''), T.teamChips(s.teams, s.nTeams, () => { save(); render(); })));
      body.append(T.classRow(s.nTeams, s.teams, () => { save(); render(); }));
      body.append(h('div', { class: 'srow' }, h('div', { class: 'slabel' }, 'Level'),
        T.seg([['easy', 'Easy'], ['harder', 'Harder'], ['both', 'Both']], s.level, set('level')),
        h('div', { class: 'small-note', style: { marginLeft: '16px', textAlign: 'left' } },
          s.level === 'easy' ? 'e.g. 3 animals + 1 food' : s.level === 'harder' ? 'e.g. "A dog can\'t fly."' : 'Easy and harder rounds mixed')));
      body.append(h('div', { class: 'srow' }, h('div', { class: 'slabel' }, 'Options'),
        h('button', { class: 'toggle light' + (s.words ? ' on' : ''), onclick: () => set('words')(!s.words) }, h('span', { class: 'sw' }), h('span', null, 'Show the words'))));
      body.append(h('div', { class: 'srow end' },
        h('div', { class: 'small-note', style: { flex: 1, textAlign: 'left' } }, 'Which one doesn\'t belong? Say why: "... because ..."'),
        h('button', { class: 'btn big green', onclick: () => startGame(s) }, "Let's go!")));
    }
    root.append(ICG.topbar('Odd One Out - Setup'), body);
    render();
  }

  /* ======================= GAME ======================= */
  function startGame(s) {
    if (!T.studentsOk()) return;
    cleanup();
    const teams = T.makeTeams(s.teams, s.nTeams);
    const rounds = buildRounds(s);
    if (!rounds.length) { ICG.toast('No rounds found'); return; }
    const st = { scores: teams.map(() => 0), turn: Math.floor(Math.random() * teams.length), ri: 0, over: false, shown: false, awards: [] };

    root.innerHTML = ''; root.className = 'oddone-game';
    const stageEl = h('div', { class: 'oo-main' });
    const panel = h('div', { class: 'oo-panel card' });
    const sb = T.scoreboard(teams);
    const endBtn = h('button', { class: 'iconbtn wide', onclick: () => ICG.confirm('End the game now?', 'The team with the most points wins.', 'End game', finish) }, 'End');
    const setupBtn = h('button', { class: 'iconbtn', title: 'Settings', html: ICG.icon('settings'),
      onclick: () => (st.ri > 0 && !st.over) ? ICG.confirm('Change settings?', 'This game will end.', 'Yes', showSetup) : showSetup() });
    root.append(
      ICG.topbar('Odd One Out', { extra: [setupBtn, endBtn], leaveCheck: () => st.ri > 0 && !st.over, wheel: T.wheelOpts(teams, () => st.turn) }),
      stageEl, h('div', { class: 'oo-side' }, sb.el, panel));

    function drawRound() {
      const r = rounds[st.ri];
      stageEl.innerHTML = '';
      const row = h('div', { class: 'oo-cards' }, r.pics.map((pic, i) =>
        h('div', { class: 'oo-card' + (st.shown ? (pic === r.odd ? ' odd' : ' dim') : '') },
          h('div', { class: 'oo-label' }, LABELS[i]),
          ICG.picture(pic, 'images', 'oo-pic'),
          s.words ? h('div', { class: 'oo-name' }, nameOf(pic)) : null)));
      stageEl.append(row);
      if (st.shown) {
        stageEl.append(h('div', { class: 'oo-why' },
          h('div', { class: 'oo-why-head' }, 'Odd one out: ', h('b', null, nameOf(r.odd)), '!'),
          r.why ? h('div', { class: 'oo-why-text' }, r.why) : null));
      } else {
        stageEl.append(h('div', { class: 'oo-starter' }, 'The ', h('span', { class: 'blank' }), ' is the odd one out because ', h('span', { class: 'blank long' }), '.'));
      }
      // preload next round
      const nx = rounds[st.ri + 1]; if (nx) nx.pics.forEach(p => ICG.preload(p));
    }
    function renderPanel() {
      sb.update(st.scores, st.turn);
      const t = teams[st.turn];
      panel.innerHTML = '';
      panel.append(h('div', { class: 'wm-round' }, 'Round ' + (st.ri + 1) + ' of ' + rounds.length));
      if (!st.shown) {
        panel.append(
          h('div', { class: 'turn-pill', style: { background: t.color } }, T.charImg(t.char, 'right', 'mini'), h('span', null, ICG.possessive(t.name) + ' turn')),
          h('div', { class: 'wm-say' }, 'Which one doesn\'t belong?'),
          h('div', { class: 'small-note' }, 'Say the letter and the reason. Then the others can try.'),
          h('button', { class: 'btn big yellow', style: { marginTop: 'auto' }, onclick: show }, 'Show answer'));
        return;
      }
      const awarded = h('div', { class: 'wm-awarded' }, st.awards.map(k => teams[k].name + ' +1').join(',  '));
      panel.append(
        T.awardButtons(teams, give, null, { label: 'Give points (tap +1)' }),
        h('div', { class: 'small-note oo-tip' }, '+1 for the right one. +1 more for a good "because..." sentence. Other good reasons count too!'),
        awarded,
        h('div', { class: 'row wm-next' },
          h('button', { class: 'btn white', onclick: undoAward }, 'Undo'),
          h('button', { class: 'btn big green', onclick: next }, st.ri + 1 >= rounds.length ? 'See the winner!' : 'Next round')));
    }
    function show() { st.shown = true; st.awards = []; S.win(); drawRound(); renderPanel(); }
    function give(i) { st.scores[i]++; st.awards.push(i); S.correct(); renderPanel(); }
    function undoAward() { const i = st.awards.pop(); if (i == null) return; st.scores[i]--; renderPanel(); }
    function next() {
      st.ri++;
      if (st.ri >= rounds.length) return finish();
      st.shown = false; st.turn = (st.turn + 1) % teams.length;
      drawRound(); renderPanel();
    }
    function finish() {
      if (st.over) return;
      st.over = true; cleanup();
      T.celebrate(teams, st.scores, { again: () => startGame(s), settings: showSetup });
    }

    // laptop: Space/A = show answer, 1-4 = team +1, U = undo, Enter = next round
    keyHandler = e => {
      if (document.querySelector('.modal-back')) return;
      const k = e.key.toLowerCase();
      if (!st.shown && (k === ' ' || k === 'a' || k === 'enter')) { e.preventDefault(); show(); }
      else if (st.shown) {
        if (/^[1-4]$/.test(k) && +k <= teams.length) give(+k - 1);
        else if (k === 'u') undoAward();
        else if (k === 'enter' || k === ' ') { e.preventDefault(); next(); }
      }
    };
    document.addEventListener('keydown', keyHandler);

    drawRound(); renderPanel();
  }
})();
