// KaiserKards: flashcards and quizzes generated from the CSV files in decks/.
// Pages (hash routes):  #/  ·  #/cards/<deck>  ·  #/quiz/<deck>

const app = document.getElementById('app');
const deckBySlug = new Map();
let decks = [];
let keyHandler = null;

document.addEventListener('keydown', (e) => {
  if (!keyHandler || e.ctrlKey || e.metaKey || e.altKey) return;
  keyHandler(e);
});
window.addEventListener('hashchange', route);
init();

async function init() {
  try {
    const res = await fetch('decks.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    decks = (await res.json()).decks || [];
  } catch (err) {
    mount(h('div', { class: 'panel notice' },
      h('h2', {}, 'Could not load your decks'),
      h('p', {}, `decks.json failed to load (${err.message}). When running locally, run "npm run build" and open the dist folder through a web server.`)));
    return;
  }
  for (const d of decks) deckBySlug.set(d.slug, d);
  route();
}

function route() {
  keyHandler = null;
  let path = '';
  try { path = decodeURIComponent(location.hash.replace(/^#\/?/, '')); } catch { /* bad URL, go home */ }
  const slash = path.indexOf('/');
  const mode = slash === -1 ? path : path.slice(0, slash);
  const deck = slash === -1 ? null : deckBySlug.get(path.slice(slash + 1));

  if (deck && !deck.cards.length && (mode === 'cards' || mode === 'quiz')) renderEmptyDeck(deck, mode);
  else if (deck && mode === 'cards') renderFlashcards(deck);
  else if (deck && mode === 'quiz') renderQuiz(deck);
  else renderHome();
  window.scrollTo(0, 0);
}

/* ------------------------------------------------------------------ helpers */

function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

function mount(...children) {
  app.replaceChildren(h('main', { class: 'container' }, ...children));
}

const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(`kk:${key}`);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(`kk:${key}`, JSON.stringify(value)); } catch { /* storage unavailable */ }
  },
};

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function progressBar(fraction, label) {
  const pct = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
  return h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct), 'aria-label': label || 'Progress' },
    h('div', { class: 'progress-fill', style: `width:${pct}%` }));
}

function stat(value, label, tone) {
  return h('div', { class: `stat ${tone || ''}` }, h('strong', {}, String(value)), h('span', {}, label));
}

// Long text gets a smaller, left-aligned style so it stays readable.
const textClass = (text) => `card-text${text.length > 140 ? ' long' : text.length > 60 ? ' medium' : ''}`;

function topbar(deck, mode) {
  return h('header', { class: 'topbar' },
    h('a', { class: 'brand', href: '#/' }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }), 'KaiserKards'),
    deck ? h('nav', { class: 'mode-switch', 'aria-label': 'Study mode' },
      h('a', { href: `#/cards/${deck.slug}`, 'aria-current': mode === 'cards' ? 'page' : null }, 'Flashcards'),
      h('a', { href: `#/quiz/${deck.slug}`, 'aria-current': mode === 'quiz' ? 'page' : null }, 'Quiz')) : null);
}

function deckTitle(deck) {
  return h('div', { class: 'deck-title' },
    h('a', { class: 'back-link', href: '#/' }, '← All decks'),
    h('h1', {}, deck.name),
    h('p', { class: 'muted' }, [deck.group, plural(deck.cards.length, 'card')].filter(Boolean).join(' · ')));
}

const knownMap = (deck) => store.get(`cards:${deck.slug}`, {});
const countKnown = (deck, known) => deck.cards.filter((c) => known[c.id]).length;

/* --------------------------------------------------------------------- home */

function renderHome() {
  document.title = 'KaiserKards';
  const list = h('div', { class: 'deck-list' });
  const search = h('input', { type: 'search', class: 'search', placeholder: 'Search decks…', 'aria-label': 'Search decks' });

  const draw = () => {
    const q = search.value.trim().toLowerCase();
    const shown = decks.filter((d) => !q || `${d.name} ${d.group}`.toLowerCase().includes(q));
    list.replaceChildren();
    if (!shown.length) {
      list.append(h('div', { class: 'panel empty' }, q
        ? h('p', {}, 'No decks match your search.')
        : [h('h2', {}, 'No decks yet'),
           h('p', {}, 'Add a .csv file to the decks/ folder in your GitHub repo. It will appear here once Vercel finishes redeploying (usually under a minute).')]));
      return;
    }
    const groups = new Map();
    for (const d of shown) {
      if (!groups.has(d.group)) groups.set(d.group, []);
      groups.get(d.group).push(d);
    }
    for (const [group, items] of groups) {
      list.append(h('section', { class: 'group' },
        group ? h('h2', { class: 'group-title' }, group) : null,
        h('div', { class: 'grid' }, items.map(deckTile))));
    }
  };
  search.addEventListener('input', draw);

  const totalCards = decks.reduce((n, d) => n + d.cards.length, 0);
  mount(
    topbar(),
    h('div', { class: 'home-intro' },
      h('h1', {}, 'Your decks'),
      h('p', { class: 'muted' }, `${plural(decks.length, 'deck')} · ${plural(totalCards, 'card')}`)),
    decks.length > 3 ? search : null,
    list);
  draw();
}

function deckTile(deck) {
  const total = deck.cards.length;
  const known = countKnown(deck, knownMap(deck));
  const quiz = store.get(`quiz:${deck.slug}`, null);
  return h('article', { class: 'tile' },
    h('h3', { class: 'tile-title' }, h('a', { href: `#/cards/${deck.slug}` }, deck.name)),
    h('p', { class: 'tile-meta' },
      plural(total, 'card'),
      quiz && quiz.taken ? ` · Best quiz ${quiz.best}%` : ''),
    h('div', { class: 'tile-progress' },
      progressBar(total ? known / total : 0, 'Cards known'),
      h('span', {}, `${known}/${total} known`)),
    h('div', { class: 'tile-actions' },
      h('a', { class: 'btn primary', href: `#/cards/${deck.slug}` }, 'Flashcards'),
      h('a', { class: 'btn', href: `#/quiz/${deck.slug}` }, 'Quiz')));
}

function renderEmptyDeck(deck, mode) {
  document.title = `${deck.name} · KaiserKards`;
  mount(topbar(deck, mode), deckTitle(deck),
    h('div', { class: 'panel notice' },
      h('h2', {}, 'This deck has no cards'),
      h('p', {}, `Check ${deck.file}: each row needs a front and a back, separated by a comma.`)));
}

/* --------------------------------------------------------------- flashcards */

function renderFlashcards(deck) {
  document.title = `${deck.name} · Flashcards · KaiserKards`;
  const progressKey = `cards:${deck.slug}`;
  const known = knownMap(deck);
  const opts = { shuffle: false, reverse: false, onlyLearning: false, ...store.get('flashOpts', {}) };
  const view = h('div', { class: 'study' });
  mount(topbar(deck, 'cards'), deckTitle(deck), view);

  let queue = [];
  let pos = 0;
  let marks = {};
  let flipped = false;
  let cardEl = null;

  const saveKnown = () => store.set(progressKey, known);

  function start(cards) {
    queue = opts.shuffle ? shuffle(cards) : [...cards];
    pos = 0;
    marks = {};
    render();
  }
  const startDefault = () => start(opts.onlyLearning ? deck.cards.filter((c) => !known[c.id]) : deck.cards);

  function setOpt(key, value, restart = true) {
    opts[key] = value;
    store.set('flashOpts', opts);
    if (restart) startDefault(); else render();
  }

  function resetProgress() {
    if (!confirm(`Reset flashcard progress for "${deck.name}"? All cards go back to "still learning".`)) return;
    for (const id of Object.keys(known)) delete known[id];
    saveKnown();
    startDefault();
  }

  function toggle(label, checked, onChange) {
    return h('label', { class: 'chip' },
      h('input', { type: 'checkbox', checked, onChange: (e) => onChange(e.target.checked) }),
      h('span', {}, label));
  }

  function toolbar() {
    const learning = deck.cards.length - countKnown(deck, known);
    return h('div', { class: 'toolbar' },
      toggle('Shuffle', opts.shuffle, (v) => setOpt('shuffle', v)),
      toggle('Back side first', opts.reverse, (v) => setOpt('reverse', v, false)),
      toggle(`Only still learning (${learning})`, opts.onlyLearning, (v) => setOpt('onlyLearning', v)),
      h('button', { class: 'btn ghost small', type: 'button', onClick: resetProgress }, 'Reset progress'));
  }

  function flip() {
    if (!cardEl) return;
    flipped = !flipped;
    cardEl.classList.toggle('flipped', flipped);
  }

  function go(delta) {
    pos = Math.max(0, pos + delta);
    render();
  }

  function mark(kind) {
    const card = queue[pos];
    if (!card) return;
    marks[card.id] = kind;
    if (kind === 'got') known[card.id] = true;
    else delete known[card.id];
    saveKnown();
    go(1);
  }

  function render() {
    flipped = false;
    cardEl = null;
    if (!queue.length) return renderAllKnown();
    if (pos >= queue.length) return renderSummary();

    const card = queue[pos];
    const [shown, hidden] = opts.reverse ? [card.back, card.front] : [card.front, card.back];
    const [shownLabel, hiddenLabel] = opts.reverse ? ['Back', 'Front'] : ['Front', 'Back'];

    const hint = card.hint
      ? h('button', {
          class: 'hint-btn', type: 'button',
          onClick: (e) => { e.stopPropagation(); hint.replaceWith(h('p', { class: 'hint' }, card.hint)); },
        }, 'Show hint')
      : null;

    cardEl = h('div', { class: 'flashcard', role: 'button', tabindex: '0', 'aria-label': 'Flashcard, press to flip', onClick: flip },
      h('div', { class: 'flashcard-inner' },
        h('div', { class: 'face front' },
          h('span', { class: 'face-label' }, shownLabel),
          known[card.id] ? h('span', { class: 'badge' }, '✓ Known') : null,
          h('div', { class: textClass(shown) }, shown),
          hint),
        h('div', { class: 'face back' },
          h('span', { class: 'face-label' }, hiddenLabel),
          h('div', { class: textClass(hidden) }, hidden))));

    view.replaceChildren(
      toolbar(),
      h('div', { class: 'study-meta' },
        h('span', {}, `Card ${pos + 1} of ${queue.length}`),
        h('span', {}, `${countKnown(deck, known)} / ${deck.cards.length} known`)),
      progressBar(pos / queue.length, 'Position in this round'),
      cardEl,
      h('div', { class: 'nav-row' },
        h('button', { class: 'btn icon', type: 'button', disabled: pos === 0, onClick: () => go(-1), 'aria-label': 'Previous card' }, '←'),
        h('button', { class: 'btn', type: 'button', onClick: flip }, 'Flip', h('kbd', {}, 'Space')),
        h('button', { class: 'btn icon', type: 'button', onClick: () => go(1), 'aria-label': 'Next card' }, '→')),
      h('div', { class: 'mark-row' },
        h('button', { class: 'btn mark learning', type: 'button', onClick: () => mark('learning') }, 'Still learning', h('kbd', {}, '1')),
        h('button', { class: 'btn mark got', type: 'button', onClick: () => mark('got') }, 'Got it', h('kbd', {}, '2'))),
      h('p', { class: 'shortcuts' }, 'Keyboard: Space flips · ← → move · 1 still learning · 2 got it'));
  }

  function renderSummary() {
    const got = queue.filter((c) => marks[c.id] === 'got').length;
    const learning = queue.filter((c) => marks[c.id] === 'learning').length;
    const skipped = queue.length - got - learning;
    const review = queue.filter((c) => marks[c.id] !== 'got');
    const knownNow = countKnown(deck, known);

    view.replaceChildren(h('div', { class: 'panel summary' },
      h('h2', {}, 'Round complete'),
      h('div', { class: 'stat-row' },
        stat(got, 'Got it', 'good'),
        stat(learning, 'Still learning', 'warn'),
        skipped ? stat(skipped, 'Skipped') : null),
      progressBar(knownNow / deck.cards.length, 'Cards known'),
      h('p', { class: 'muted' }, `${knownNow} of ${deck.cards.length} cards in this deck are marked as known.`),
      h('div', { class: 'actions' },
        review.length
          ? h('button', { class: 'btn primary', type: 'button', onClick: () => start(review) }, `Review the ${plural(review.length, 'card')} I missed`)
          : null,
        h('button', { class: review.length ? 'btn' : 'btn primary', type: 'button', onClick: startDefault }, 'Start over'),
        h('a', { class: 'btn', href: `#/quiz/${deck.slug}` }, 'Take a quiz'))));
  }

  function renderAllKnown() {
    view.replaceChildren(toolbar(), h('div', { class: 'panel summary' },
      h('h2', {}, 'You know every card in this deck'),
      h('p', { class: 'muted' }, '"Only still learning" is on, and no cards are left to learn.'),
      h('div', { class: 'actions' },
        h('button', { class: 'btn primary', type: 'button', onClick: () => setOpt('onlyLearning', false) }, 'Study all cards'),
        h('a', { class: 'btn', href: `#/quiz/${deck.slug}` }, 'Take a quiz'))));
  }

  keyHandler = (e) => {
    if (e.target.closest('input, textarea, select')) return;
    if (!queue.length || pos >= queue.length) return;
    const onControl = e.target.closest('button, a');
    if (e.key === ' ' || e.key === 'Enter') {
      if (onControl) return; // let the focused button do its own thing
      e.preventDefault();
      flip();
    } else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    else if (e.key === '1') mark('learning');
    else if (e.key === '2') mark('got');
  };

  startDefault();
}

/* --------------------------------------------------------------------- quiz */

function normalize(s) {
  return s.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ').trim();
}
const stripAccents = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC');
const digitsOf = (s) => s.replace(/\D/g, '');

// Accepted answers: the full answer, the answer without "(notes)", and each
// alternative separated by ";", " / " or a new line.
function answerVariants(answer) {
  const out = new Set();
  for (const base of [answer, answer.replace(/\([^)]*\)/g, ' ')]) {
    out.add(base);
    for (const part of base.split(/;|\n|\s\/\s/)) out.add(part);
  }
  return [...out].map(normalize).filter(Boolean);
}

function levenshtein(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

// 'correct' | 'close' (small typo or missing accents, still counts) | 'wrong'
function checkAnswer(given, answer) {
  const g = normalize(given);
  if (!g) return 'wrong';
  const variants = answerVariants(answer);
  if (variants.includes(g)) return 'correct';
  const gs = stripAccents(g);
  for (const v of variants) {
    const vs = stripAccents(v);
    if (vs === gs) return 'close';
    if (digitsOf(vs) !== digitsOf(gs)) continue; // numbers must match exactly
    const tolerance = vs.length >= 8 ? 2 : vs.length >= 4 ? 1 : 0;
    if (tolerance && Math.abs(vs.length - gs.length) <= tolerance && levenshtein(gs, vs) <= tolerance) return 'close';
  }
  return 'wrong';
}

function renderQuiz(deck) {
  document.title = `${deck.name} · Quiz · KaiserKards`;
  const statsKey = `quiz:${deck.slug}`;
  const opts = { style: 'type', reverse: false, count: '10', ...store.get('quizOpts', {}) };
  const view = h('div', { class: 'study' });
  mount(topbar(deck, 'quiz'), deckTitle(deck), view);

  let questions = [];
  let results = [];
  let qi = 0;
  let practice = false;

  const promptOf = (c) => (opts.reverse ? c.back : c.front);
  const answerOf = (c) => (opts.reverse ? c.front : c.back);
  const distinctAnswers = () => new Set(deck.cards.map((c) => normalize(answerOf(c)))).size;
  const canChoose = () => distinctAnswers() >= 2;
  const effectiveStyle = () => (opts.style === 'choice' && canChoose() ? 'choice' : 'type');
  const total = deck.cards.length;
  const countOptions = () => [
    ...[10, 20, 50].filter((n) => n < total).map((n) => ({ value: String(n), label: String(n) })),
    { value: 'all', label: `All ${total}` },
  ];
  const effectiveCount = () => (countOptions().some((o) => o.value === opts.count) ? opts.count : 'all');

  function setOpt(key, value) {
    opts[key] = value;
    store.set('quizOpts', opts);
    renderSetup();
  }

  function segmented(name, options, value, onChange) {
    return h('div', { class: 'segmented', role: 'radiogroup' }, options.map((o) =>
      h('label', { class: `seg${o.disabled ? ' disabled' : ''}` },
        h('input', { type: 'radio', name, value: o.value, checked: o.value === value, disabled: o.disabled, onChange: () => onChange(o.value) }),
        h('span', {}, o.label))));
  }

  const field = (label, control) => h('div', { class: 'field' }, h('span', { class: 'field-label' }, label), control);

  function renderSetup() {
    const s = store.get(statsKey, null);
    view.replaceChildren(h('div', { class: 'panel setup' },
      h('h2', {}, 'Quiz setup'),
      field('Answer by', segmented('style', [
        { value: 'type', label: 'Typing it' },
        { value: 'choice', label: 'Multiple choice', disabled: !canChoose() },
      ], effectiveStyle(), (v) => setOpt('style', v))),
      field('Show', segmented('direction', [
        { value: 'fwd', label: 'Front → answer with back' },
        { value: 'rev', label: 'Back → answer with front' },
      ], opts.reverse ? 'rev' : 'fwd', (v) => setOpt('reverse', v === 'rev'))),
      field('Questions', segmented('count', countOptions(), effectiveCount(), (v) => setOpt('count', v))),
      s && s.taken
        ? h('p', { class: 'muted' }, `Best ${s.best}% · Last ${s.last}% · ${plural(s.taken, 'quiz', 'quizzes')} taken`)
        : null,
      h('div', { class: 'actions' },
        h('button', { class: 'btn primary big', type: 'button', onClick: () => begin(deck.cards, false) }, 'Start quiz'))));

    keyHandler = (e) => {
      if (e.key === 'Enter' && !e.target.closest('button, a, input:not([type=radio])')) {
        e.preventDefault();
        begin(deck.cards, false);
      }
    };
  }

  function makeChoices(card) {
    const correct = answerOf(card);
    const seen = new Set([normalize(correct)]);
    const others = [];
    for (const c of shuffle(deck.cards)) {
      const a = answerOf(c);
      const key = normalize(a);
      if (seen.has(key)) continue;
      seen.add(key);
      others.push(a);
      if (others.length === 3) break;
    }
    return shuffle([correct, ...others]);
  }

  function begin(cards, isPractice) {
    practice = isPractice;
    const style = effectiveStyle();
    const count = effectiveCount();
    const pool = shuffle(cards);
    const picked = isPractice || count === 'all' ? pool : pool.slice(0, Number(count));
    questions = picked.map((card) => ({
      card,
      prompt: promptOf(card),
      answer: answerOf(card),
      choices: style === 'choice' ? makeChoices(card) : null,
    }));
    results = [];
    qi = 0;
    renderQuestion();
  }

  function advance() {
    qi++;
    if (qi >= questions.length) renderResults();
    else renderQuestion();
  }

  function renderQuestion() {
    const q = questions[qi];
    let answered = false;
    const score = () => results.filter((r) => r.correct).length;

    const scoreEl = h('span', {}, `Score ${score()}`);
    const feedback = h('div', { class: 'feedback', 'aria-live': 'polite' });
    const nextBtn = h('button', { class: 'btn primary', type: 'button', hidden: true, onClick: advance },
      qi + 1 < questions.length ? 'Next question' : 'See results', h('kbd', {}, 'Enter'));

    const hint = q.card.hint
      ? h('button', { class: 'hint-btn', type: 'button', onClick: () => hint.replaceWith(h('p', { class: 'hint' }, q.card.hint)) }, 'Show hint')
      : null;

    function record(correct, given, close) {
      results[qi] = { q, given, correct, close };
      answered = true;
      scoreEl.textContent = `Score ${score()}`;
    }

    function showFeedback(verdict, given, allowOverride, onOverride) {
      const r = results[qi];
      const answerLine = h('p', {}, 'Answer: ', h('strong', {}, q.answer));
      if (verdict === 'correct') {
        feedback.className = 'feedback good';
        feedback.replaceChildren(h('p', { class: 'verdict' }, '✓ Correct!'), q.choices ? null : answerLine);
      } else if (verdict === 'close') {
        feedback.className = 'feedback good';
        feedback.replaceChildren(h('p', { class: 'verdict' }, '✓ Close enough, counted as correct'), h('p', {}, 'Exact answer: ', h('strong', {}, q.answer)));
      } else if (verdict === 'override') {
        feedback.className = 'feedback good';
        feedback.replaceChildren(h('p', { class: 'verdict' }, '✓ Marked as correct'), answerLine);
      } else {
        feedback.className = 'feedback bad';
        feedback.replaceChildren(
          h('p', { class: 'verdict' }, given ? '✗ Not quite' : '✗ Skipped'),
          answerLine,
          given && !q.choices ? h('p', { class: 'muted' }, 'You wrote: ', given) : null,
          allowOverride && given
            ? h('button', { class: 'btn ghost small', type: 'button', onClick: () => {
                r.correct = true;
                r.overridden = true;
                scoreEl.textContent = `Score ${score()}`;
                showFeedback('override');
                onOverride && onOverride();
              } }, 'I was right, count it')
            : null);
      }
    }

    let answerArea;
    if (q.choices) {
      const buttons = q.choices.map((choice, i) =>
        h('button', { class: 'choice', type: 'button', onClick: () => choose(i) }, h('kbd', {}, String(i + 1)), h('span', {}, choice)));
      function choose(i) {
        if (answered) return;
        const correct = q.choices[i] === q.answer;
        buttons.forEach((b, j) => {
          b.disabled = true;
          if (q.choices[j] === q.answer) b.classList.add('correct');
          else if (j === i) b.classList.add('wrong');
        });
        record(correct, q.choices[i], false);
        showFeedback(correct ? 'correct' : 'wrong', q.choices[i], false);
        nextBtn.hidden = false;
        nextBtn.focus();
      }
      answerArea = h('div', { class: 'choices' }, buttons);
      keyHandler = (e) => {
        if (!answered && /^[1-9]$/.test(e.key) && Number(e.key) <= buttons.length) {
          e.preventDefault();
          choose(Number(e.key) - 1);
        } else if (answered && e.key === 'Enter' && !e.target.closest('button, a')) {
          e.preventDefault();
          advance();
        }
      };
    } else {
      const input = h('input', {
        type: 'text', class: 'answer-input', placeholder: 'Type your answer…', 'aria-label': 'Your answer',
        autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false',
      });
      const checkBtn = h('button', { class: 'btn primary', type: 'submit' }, 'Check');
      const skipBtn = h('button', { class: 'btn ghost', type: 'button', onClick: () => submit(true) }, "I don't know");
      function submit(giveUp) {
        if (answered) return;
        const given = input.value.trim();
        if (!giveUp && !given) { input.focus(); return; }
        const verdict = giveUp ? 'wrong' : checkAnswer(given, q.answer);
        record(verdict !== 'wrong', giveUp ? '' : given, verdict === 'close');
        input.readOnly = true;
        checkBtn.hidden = true;
        skipBtn.hidden = true;
        showFeedback(verdict, giveUp ? '' : given, true, () => input.focus());
        nextBtn.hidden = false;
        input.focus();
      }
      // Enter in the box checks the answer (form submit); pressing it again moves on (key handler).
      answerArea = h('form', { class: 'answer-form', onSubmit: (e) => { e.preventDefault(); submit(false); } },
        input, checkBtn, skipBtn);
      keyHandler = (e) => {
        if (answered && e.key === 'Enter' && !e.target.closest('button, a')) {
          e.preventDefault();
          advance();
        }
      };
      queueMicrotask(() => input.focus());
    }

    view.replaceChildren(
      h('div', { class: 'study-meta' },
        h('span', {}, `Question ${qi + 1} of ${questions.length}`, practice ? ' · practice' : ''),
        scoreEl),
      progressBar(qi / questions.length, 'Quiz progress'),
      h('div', { class: 'quiz-card' },
        h('span', { class: 'face-label' }, opts.reverse ? 'Back' : 'Front'),
        h('div', { class: textClass(q.prompt) }, q.prompt),
        hint),
      answerArea,
      feedback,
      h('div', { class: 'actions' }, nextBtn));
  }

  function renderResults() {
    keyHandler = null;
    const correct = results.filter((r) => r.correct).length;
    const pct = Math.round((correct / results.length) * 100);
    const missed = results.filter((r) => !r.correct);

    let isBest = false;
    if (!practice) {
      const s = store.get(statsKey, { best: 0, last: 0, taken: 0 });
      isBest = s.taken > 0 && pct > s.best;
      store.set(statsKey, { best: Math.max(s.best, pct), last: pct, taken: s.taken + 1 });
    }

    const message = pct === 100 ? 'Perfect score!' : pct >= 85 ? 'Excellent!' : pct >= 70 ? 'Nice work!' : pct >= 50 ? 'Getting there.' : 'Keep practicing, you will get it.';

    view.replaceChildren(h('div', { class: 'panel summary' },
      h('h2', {}, message),
      h('div', { class: 'score-big' },
        h('strong', {}, `${pct}%`),
        h('span', {}, `${correct} of ${results.length} correct`),
        isBest ? h('span', { class: 'badge' }, 'New best!') : null),
      practice ? h('p', { class: 'muted' }, 'Practice rounds of missed questions don\'t count toward your best score.') : null,
      missed.length
        ? h('div', { class: 'missed' },
            h('h3', {}, `Missed (${missed.length})`),
            h('ul', {}, missed.map((r) => h('li', {},
              h('div', { class: 'missed-prompt' }, r.q.prompt),
              h('div', {}, '→ ', h('strong', {}, r.q.answer)),
              r.given ? h('div', { class: 'muted' }, `You answered: ${r.given}`) : null))))
        : null,
      h('div', { class: 'actions' },
        missed.length
          ? h('button', { class: 'btn primary', type: 'button', onClick: () => begin(missed.map((r) => r.q.card), true) }, `Retry the ${missed.length} missed`)
          : null,
        h('button', { class: missed.length ? 'btn' : 'btn primary', type: 'button', onClick: renderSetup }, 'New quiz'),
        h('a', { class: 'btn', href: `#/cards/${deck.slug}` }, 'Study with flashcards'))));
  }

  renderSetup();
}
