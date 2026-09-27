/* ============================================================
   Save the Snowman
   Teams call letters to fill in the word. Every wrong letter
   melts a piece of the snowman. Save him before he melts!
   ============================================================ */
(function () {
  'use strict';
  const ICG = window.ICG, h = ICG.h, S = ICG.sound, T = ICG.T;

  // order the pieces melt in (8 wrong guesses = all gone)
  const PARTS = ['hat', 'scarf', 'nose', 'arm-l', 'arm-r', 'buttons', 'head', 'body'];
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  const DEFAULTS = { nTeams: 2, sets: [], own: true, clue: true, first: false, words: 5 };
  const ownWords = () => ICG.store.get('snowman.words', null) || ICG.store.get('hotseat.words', []) || [];
  function loadSettings() {
    const s = Object.assign({}, DEFAULTS, ICG.store.get('snowman.settings', {}));
    s.teams = T.loadTeams();
    const ids = ICG.pictureSets.map(p => p.id);
    s.sets = (s.sets || []).filter(id => ids.includes(id));
    if (!ownWords().length) s.own = false;
    if (!s.own && !s.sets.length && ids.length) s.sets = [ids[0]];
    return s;
  }
  const clean = w => String(w).toUpperCase().replace(/[^A-Z \-]/g, '').replace(/\s+/g, ' ').trim();

  let root = null, keyHandler = null;
  const cleanup = () => { if (keyHandler) document.removeEventListener('keydown', keyHandler); keyHandler = null; };

  ICG.register('snowman', {
    title: 'Save the Snowman', ready: true,
    mount(stage) { root = stage; showSetup(); },
    unmount: cleanup
  });

  /* ======================= SETUP ======================= */
  function showSetup() {
    cleanup();
    const s = loadSettings();
    root.innerHTML = ''; root.className = 'setup';
    const body = h('div', { class: 'setup-card card' });
    const save = () => { const c = Object.assign({}, s); delete c.teams; ICG.store.set('snowman.settings', c); };
    const set = k => v => { s[k] = v; save(); render(); };
    function editWords() {
      const ta = h('textarea', { placeholder: 'One word on each line (or separated by commas)' });
      ta.value = ownWords().join('\n');
      const hs = ICG.store.get('hotseat.words', []);
      const m = ICG.modal([
        h('h2', null, 'Our spelling words'),
        h('p', { style: { marginBottom: '16px' } }, 'One word on each line. Letters only.'),
        ta, h('div', { style: { height: '22px' } }),
        h('div', { class: 'row' },
          hs.length ? h('button', { class: 'btn white', onclick: () => { ta.value = hs.join('\n'); } }, 'Copy from Hot Seat') : null,
          h('button', { class: 'btn grey', onclick: () => m.close() }, 'Cancel'),
          h('button', { class: 'btn green', onclick: () => {
            const list = ta.value.split(/[\n,]/).map(x => x.trim()).filter(x => clean(x).replace(/[ -]/g, '').length);
            const firstTime = !ownWords().length;
            ICG.store.set('snowman.words', list); s.own = list.length > 0;
            if (firstTime && s.own) s.sets = []; // first list typed: play just these words
            if (!s.own && !s.sets.length) s.sets = [ICG.pictureSets[0].id];
            save(); m.close(); render();
          } }, 'Save'))
      ], { sticky: true });
      m.box.style.width = '1200px';
    }
    function render() {
      body.innerHTML = '';
      const words = ownWords();
      body.append(h('div', { class: 'srow' }, h('div', { class: 'slabel' }, 'Teams'),
        T.seg([[2, '2'], [3, '3'], [4, '4']], s.nTeams, set('nTeams')),
        h('div', { class: 'slabel', style: { width: 'auto', marginLeft: '30px' } }, 'Words'),
        T.seg([[3, '3'], [5, '5'], [8, '8']], s.words, set('words'))));
      body.append(h('div', { class: 'srow' }, h('div', { class: 'slabel' }, ''), T.teamChips(s.teams, s.nTeams, () => { save(); render(); })));
      body.append(T.classRow(s.nTeams, s.teams, () => { save(); render(); }));
      body.append(h('div', { class: 'srow top' }, h('div', { class: 'slabel' }, 'Word list'),
        h('div', { class: 'pack-chips' },
          h('button', { class: 'chip own' + (s.own ? ' on' : ''), onclick: () => {
            if (!words.length) return editWords();
            s.own = !s.own; if (!s.own && !s.sets.length) s.sets = [ICG.pictureSets[0].id]; save(); render();
          } }, ICG.picture('pencil'), 'Our spelling words' + (words.length ? ' (' + words.length + ')' : '')),
          h('button', { class: 'chip', onclick: editWords }, words.length ? 'Edit our words' : 'Type our words...'),
          ICG.pictureSets.map(p => {
            const on = s.sets.includes(p.id);
            return h('button', { class: 'chip' + (on ? ' on' : ''), onclick: () => {
              if (on) s.sets = s.sets.filter(x => x !== p.id); else s.sets.push(p.id);
              if (!s.sets.length && !s.own) s.sets = [p.id];
              save(); render();
            } }, ICG.picture(p.picture), p.title);
          }))));
      body.append(h('div', { class: 'srow' }, h('div', { class: 'slabel' }, 'Help'),
        h('button', { class: 'toggle light' + (s.clue ? ' on' : ''), onclick: () => set('clue')(!s.clue) }, h('span', { class: 'sw' }), h('span', null, 'Picture clue')),
        h('button', { class: 'toggle light' + (s.first ? ' on' : ''), onclick: () => set('first')(!s.first) }, h('span', { class: 'sw' }), h('span', null, 'Show the first letter'))));
      body.append(h('div', { class: 'srow end' },
        h('div', { class: 'small-note', style: { flex: 1, textAlign: 'left' } }, buildDeck(s).length + ' words ready. Call a letter - save the snowman!'),
        h('button', { class: 'btn big green', onclick: () => startGame(s) }, "Let's go!")));
    }
    root.append(ICG.topbar('Save the Snowman - Setup'), body);
    render();
  }

  function buildDeck(s) {
    let list = [];
    if (s.own) list = list.concat(ownWords().map(w => ({ word: clean(w), pic: null })));
    ICG.pictureSets.filter(p => s.sets.includes(p.id)).forEach(p => {
      list = list.concat(p.words.map(w => ({ word: clean(w.name), pic: w.pic })));
    });
    list = list.filter(x => x.word.replace(/[ -]/g, '').length >= 2);
    const seen = new Set();
    return ICG.shuffle(list.filter(x => !seen.has(x.word) && seen.add(x.word)));
  }

  /* ---------- the snowman picture (drawn here, no image file) ---------- */
  function snowmanSVG() {
    return `<svg viewBox="0 0 400 520" class="sm-svg">
      <ellipse class="sm-puddle" cx="200" cy="492" rx="60" ry="14" fill="#9fd3ff" opacity=".0"/>
      <ellipse cx="200" cy="492" rx="150" ry="16" fill="#e9f1ff"/>
      <g class="sm-part" data-part="body"><circle cx="200" cy="385" r="105" fill="#fff" stroke="#cfdcf2" stroke-width="6"/></g>
      <g class="sm-part" data-part="buttons"><circle cx="200" cy="345" r="10" fill="#3b3b58"/><circle cx="200" cy="385" r="10" fill="#3b3b58"/><circle cx="200" cy="425" r="10" fill="#3b3b58"/></g>
      <g class="sm-part" data-part="arm-l"><path d="M120 330 L40 270 M70 292 L52 255 M70 292 L32 300" stroke="#7a4a22" stroke-width="10" stroke-linecap="round" fill="none"/></g>
      <g class="sm-part" data-part="arm-r"><path d="M280 330 L360 270 M330 292 L348 255 M330 292 L368 300" stroke="#7a4a22" stroke-width="10" stroke-linecap="round" fill="none"/></g>
      <g class="sm-part" data-part="head">
        <circle cx="200" cy="205" r="75" fill="#fff" stroke="#cfdcf2" stroke-width="6"/>
        <circle cx="175" cy="190" r="9" fill="#3b3b58"/><circle cx="225" cy="190" r="9" fill="#3b3b58"/>
        <path class="sm-mouth" d="M170 238 Q200 258 230 238" stroke="#3b3b58" stroke-width="7" fill="none" stroke-linecap="round"/>
      </g>
      <g class="sm-part" data-part="nose"><path d="M200 205 L262 218 L200 222 Z" fill="#ff8a1f"/></g>
      <g class="sm-part" data-part="scarf"><path d="M130 268 Q200 300 270 268 L272 292 Q200 322 128 292 Z" fill="#e5484d"/><path d="M235 290 L250 360 L222 362 L215 296 Z" fill="#c9363b"/></g>
      <g class="sm-part" data-part="hat"><rect x="140" y="128" width="120" height="16" rx="6" fill="#2a2140"/><rect x="160" y="62" width="80" height="72" rx="8" fill="#2a2140"/><rect x="160" y="112" width="80" height="12" fill="#5b5bd6"/></g>
    </svg>`;
  }

  /* ---------- spell the whole word (teacher taps the letters the student says) ---------- */
  function spellCheck(target, teamName, done) {
    let typed = '';
    const shown = h('div', { class: 'gc-typed' });
    const keys = h('div', { class: 'gc-keys' });
    const m = ICG.modal([
      h('h2', null, teamName + ' - spell the word!'),
      h('div', { class: 'small-note', style: { textAlign: 'left', marginBottom: '10px' } }, 'Tap the letters the student says, then check.'),
      shown, h('div', { style: { height: '14px' } }), keys,
      h('div', { class: 'row', style: { marginTop: '16px' } },
        h('button', { class: 'btn grey', onclick: () => close() }, 'Cancel'),
        h('button', { class: 'btn green', onclick: () => typed && check() }, 'Check'))
    ], { sticky: true });
    m.box.style.width = '1450px';
    const render = () => { shown.textContent = typed || ' '; };
    LETTERS.forEach(ch => keys.append(h('button', { class: 'gc-key', onclick: () => { typed += ch; S.tick(); render(); } }, ch)));
    keys.append(h('button', { class: 'gc-key wide', onclick: () => { typed += ' '; render(); } }, 'space'));
    keys.append(h('button', { class: 'gc-key wide', onclick: () => { typed = typed.slice(0, -1); render(); } }, '⌫'));
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    const onKey = e => {
      e.stopPropagation();
      if (e.key === 'Enter' || e.key === ' ') e.preventDefault(); // don't press the button behind
      if (/^[a-z]$/i.test(e.key)) { typed += e.key.toUpperCase(); render(); }
      else if (e.key === 'Backspace') { typed = typed.slice(0, -1); render(); }
      else if (e.key === ' ') { e.preventDefault(); typed += ' '; render(); }
      else if (e.key === 'Enter' && typed) check();
      else if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey, true);
    function close() { document.removeEventListener('keydown', onKey, true); m.close(); }
    function check() {
      const right = typed.replace(/[^A-Z]/g, '') === target.replace(/[^A-Z]/g, '');
      document.removeEventListener('keydown', onKey, true);
      m.box.innerHTML = '';
      m.box.style.width = '900px';
      m.box.append(h('div', { class: 'gc-result ' + (right ? 'yes' : 'no') },
        h('div', { class: 'gc-mark' }, right ? '✓' : '✗'),
        h('div', { class: 'gc-word' }, typed.split('').join(' ')),
        h('div', { class: 'gc-say' }, right ? 'Right!' : 'Not quite!')));
      right ? S.correct() : S.nobody();
      setTimeout(() => { m.close(); done(right); }, 1700);
    }
    render();
  }

  /* ======================= GAME ======================= */
  function startGame(s) {
    cleanup();
    const teams = T.makeTeams(s.teams, s.nTeams);
    const deck = buildDeck(s);
    if (!deck.length) { ICG.toast('Add some words first'); return; }
    const total = Math.min(s.words, deck.length);
    const st = { scores: teams.map(() => 0), turn: Math.floor(Math.random() * teams.length), wi: 0, over: false };

    root.innerHTML = ''; root.className = 'snowman-game';
    const scene = h('div', { class: 'sm-scene card' });
    const wordBox = h('div', { class: 'sm-word' });
    const clueBox = h('div', { class: 'sm-clue' });
    const msg = h('div', { class: 'sm-msg' });
    const panel = h('div', { class: 'sm-panel card' });
    const sb = T.scoreboard(teams);
    const endBtn = h('button', { class: 'iconbtn wide', onclick: () => ICG.confirm('End the game now?', 'The team with the most points wins.', 'End game', finish) }, 'End');
    const setupBtn = h('button', { class: 'iconbtn', title: 'Settings', html: ICG.icon('settings'),
      onclick: () => (st.wi > 0 && !st.over) ? ICG.confirm('Change settings?', 'This game will end.', 'Yes', showSetup) : showSetup() });
    root.append(
      ICG.topbar('Save the Snowman', { extra: [setupBtn, endBtn], leaveCheck: () => st.wi > 0 && !st.over, wheel: T.wheelOpts(teams, () => st.turn) }),
      scene,
      h('div', { class: 'sm-mid' }, clueBox, wordBox, msg),
      h('div', { class: 'sm-side' }, sb.el, panel));

    let word = '', shown = [], used = {}, wrong = 0, done = false, cur = null;

    function newWord() {
      cur = deck[st.wi];
      word = cur.word;
      used = {}; wrong = 0; done = false;
      shown = word.split('').map(c => !/[A-Z]/.test(c));
      if (s.first) { const f = word.replace(/[^A-Z]/g, '')[0]; reveal(f, true); used[f] = 'yes'; }
      scene.innerHTML = '';
      scene.append(h('div', { class: 'sm-sun' }, ICG.picture('sun', 'images')), h('div', { class: 'sm-snow', html: snowmanSVG() }), h('div', { class: 'sm-count' }));
      clueBox.innerHTML = '';
      if (s.clue && cur.pic) clueBox.append(ICG.picture(cur.pic, 'images', 'sm-clue-pic'));
      msg.textContent = '';
      if (deck[st.wi + 1] && deck[st.wi + 1].pic) ICG.preload(deck[st.wi + 1].pic);
      drawWord(); melt(); render();
    }
    function reveal(letter, quiet) {
      let n = 0;
      word.split('').forEach((c, i) => { if (c === letter && !shown[i]) { shown[i] = true; n++; } });
      return n;
    }
    function drawWord(pop) {
      wordBox.innerHTML = '';
      const len = word.length;
      const size = Math.min(100, Math.floor(640 / (len * 1.08)));
      word.split('').forEach((c, i) => {
        if (c === ' ') return wordBox.append(h('div', { class: 'sm-gap' }));
        if (c === '-') return wordBox.append(h('div', { class: 'sm-letter dash', style: { fontSize: size + 'px' } }, '-'));
        wordBox.append(h('div', { class: 'sm-letter' + (shown[i] ? ' on' : '') + (pop && c === pop ? ' pop' : '') + (done && !shown[i] ? ' missed' : ''), style: { fontSize: size + 'px', width: size * .9 + 'px', margin: '0 ' + size * .07 + 'px' } },
          shown[i] || done ? c : ''));
      });
    }
    function melt() {
      const gone = PARTS.slice(0, wrong);
      scene.querySelectorAll('.sm-part').forEach(p => p.classList.toggle('gone', gone.includes(p.dataset.part)));
      const sun = scene.querySelector('.sm-sun');
      sun.style.transform = 'scale(' + (1 + wrong * 0.12) + ')';
      const pud = scene.querySelector('.sm-puddle');
      pud.setAttribute('rx', 60 + wrong * 14); pud.setAttribute('opacity', wrong ? .8 : 0);
      const mouth = scene.querySelector('.sm-mouth');
      if (mouth) mouth.setAttribute('d', wrong >= 4 ? 'M170 248 Q200 228 230 248' : 'M170 238 Q200 258 230 238');
      scene.querySelector('.sm-count').textContent = (PARTS.length - wrong) + ' pieces left';
    }
    const t = () => teams[st.turn];
    function render() {
      sb.update(st.scores, done ? -1 : st.turn);
      panel.innerHTML = '';
      panel.append(h('div', { class: 'wm-round' }, 'Word ' + (st.wi + 1) + ' of ' + total));
      if (done) {
        panel.append(h('button', { class: 'btn big green', style: { marginTop: 'auto' }, onclick: nextWord }, st.wi + 1 >= total ? 'See the winner!' : 'Next word'));
        return;
      }
      panel.append(h('div', { class: 'turn-pill', style: { background: t().color } }, T.charImg(t().char, 'right', 'mini'), h('span', null, ICG.possessive(t().name) + ' turn')));
      const kb = h('div', { class: 'sm-keys' });
      LETTERS.forEach(L => kb.append(h('button', { class: 'sm-key ' + (used[L] || ''), onclick: () => guess(L) }, L)));
      panel.append(kb, h('button', { class: 'btn yellow sm-solve', onclick: solve }, 'Solve it! (+3)'));
    }
    function guess(L) {
      if (done || used[L]) return;
      const n = reveal(L);
      if (n) {
        used[L] = 'yes'; st.scores[st.turn] += 1; S.correct();
        msg.textContent = t().name + ': ' + L + ' is in the word! +1';
        msg.className = 'sm-msg good';
        drawWord(L);
        if (shown.every(Boolean)) return win(null);
      } else {
        used[L] = 'no'; wrong++; S.nobody(); melt();
        msg.textContent = 'No ' + L + '... the snowman is melting!';
        msg.className = 'sm-msg bad';
        if (wrong >= PARTS.length) return lose();
      }
      st.turn = (st.turn + 1) % teams.length;
      render();
    }
    function solve() {
      if (done) return;
      spellCheck(word, t().name, right => {
        if (right) { st.scores[st.turn] += 3; win(st.turn); }
        else {
          wrong++; melt();
          msg.textContent = 'Not quite... the snowman is melting!'; msg.className = 'sm-msg bad';
          if (wrong >= PARTS.length) return lose();
          st.turn = (st.turn + 1) % teams.length; render();
        }
      });
    }
    function win(solver) {
      done = true;
      shown = shown.map(() => true); drawWord();
      S.win(); ICG.confetti(2500);
      msg.className = 'sm-msg good';
      msg.textContent = 'You saved the snowman!' + (solver != null ? ' ' + teams[solver].name + ' +3' : '');
      scene.classList.add('saved');
      st.turn = (st.turn + 1) % teams.length;
      render();
    }
    function lose() {
      done = true; drawWord();
      msg.className = 'sm-msg bad'; msg.textContent = 'Oh no, he melted! The word was ' + word + '.';
      S.tone(300, .6, { type: 'triangle', to: 120, vol: .25 });
      st.turn = (st.turn + 1) % teams.length;
      render();
    }
    function nextWord() {
      st.wi++; scene.classList.remove('saved');
      if (st.wi >= total) return finish();
      newWord();
    }
    function finish() {
      if (st.over) return;
      st.over = true; cleanup();
      T.celebrate(teams, st.scores, { again: () => startGame(s), settings: showSetup });
    }

    // laptop: type a letter to guess it; Enter = next word
    keyHandler = e => {
      if (document.querySelector('.modal-back')) return;
      if (done && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); return nextWord(); }
      if (/^[a-z]$/i.test(e.key)) guess(e.key.toUpperCase());
    };
    document.addEventListener('keydown', keyHandler);

    newWord();
  }
})();
