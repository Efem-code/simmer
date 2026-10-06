/* Simmer — healthy recipes for humans and dogs. Everything lives on the phone
   (localStorage); there is no account and nothing leaves the device. */

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- storage ---------- */
const Store = {
  get(k, d) { try { const v = localStorage.getItem('simmer.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('simmer.' + k, JSON.stringify(v)); } catch {} },
};

const S = {
  kind: Store.get('kind', 'human'),
  tab: 'recipes',
  course: 'All',
  cui: '', lvl: '', tag: '',
  group: Store.get('view', 'rated'),     // 'rated' | 'course' | 'cuisine' | 'level'
  q: '',
  saved: new Set(Store.get('saved', [])),
  made: Store.get('made', {}),
  shop: Store.get('shop', []),
  mine: Store.get('mine', []),
  dog: Store.get('dog', { kg: '', stage: 'pup12' }),
  foodQ: '',
  wish: Store.get('wish', []),            // "recipes to add" requests
  spin: { human: 'Main', dog: 'Treat', easy: false, res: null },
};
const save = () => {
  Store.set('saved', [...S.saved]); Store.set('made', S.made); Store.set('shop', S.shop);
  Store.set('mine', S.mine); Store.set('kind', S.kind); Store.set('dog', S.dog);
  Store.set('view', S.group); Store.set('wish', S.wish);
};

const all = () => [...RECIPES, ...S.mine];
const byId = id => all().find(r => r.id === id);

/* ---------- quantities ---------- */
const FRAC = [[1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [1 / 2, '½'], [2 / 3, '⅔'], [3 / 4, '¾']];
function fmtQty(n) {
  if (n == null) return '';
  const whole = Math.floor(n + 1e-6), rest = n - whole;
  if (rest < 0.06) return String(whole || (n > 0 ? '⅛' : 0));
  if (rest > 0.94) return String(whole + 1);
  let best = FRAC[0];
  for (const f of FRAC) if (Math.abs(f[0] - rest) < Math.abs(best[0] - rest)) best = f;
  if (Math.abs(best[0] - rest) > 0.07 && n >= 3) return String(Math.round(n * 10) / 10);
  return (whole ? whole : '') + best[1];
}
const PLURAL = { cup: 'cups', can: 'cans', clove: 'cloves', slice: 'slices', stalk: 'stalks', head: 'heads', block: 'blocks', bunch: 'bunches' };
const SINGULAR = Object.fromEntries(Object.entries(PLURAL).map(([a, b]) => [b, a]));
function fmtUnit(u, n) {
  if (!u) return '';
  if (n != null && n > 1 && PLURAL[u]) return PLURAL[u];
  if (n != null && n <= 1 && SINGULAR[u]) return SINGULAR[u];
  return u;
}
function ingLine(row, f) {
  const [q, u, item] = row;
  if (q == null) return { q: '', text: item };
  const n = q * f;
  return { q: (fmtQty(n) + ' ' + fmtUnit(u, n)).trim(), text: item };
}

/* Free-text ingredient lines from the Add form: "2 1/2 cups flour", "½ lemon". */
const UNI = { '½': .5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': .25, '¾': .75, '⅛': .125 };
function parseIng(line) {
  const m = line.trim().match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.?\d+\s*[½⅓⅔¼¾⅛]?|[½⅓⅔¼¾⅛])\s+(.*)$/);
  if (!m) return [null, '', line.trim()];
  let s = m[1].trim(), n = 0;
  if (/\d+\s+\d+\/\d+/.test(s)) { const [w, fr] = s.split(/\s+/); const [a, b] = fr.split('/'); n = +w + a / b; }
  else if (s.includes('/')) { const [a, b] = s.split('/'); n = a / b; }
  else { const u = s.slice(-1); if (UNI[u]) { n = UNI[u] + (parseFloat(s) || 0); } else n = parseFloat(s); }
  return [n, '', m[2]];
}

/* ---------- toast ---------- */
let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2200);
}

/* ---------- shell ---------- */
function setKind(k) {
  S.kind = k; S.course = 'All'; S.cui = ''; S.lvl = ''; S.tag = ''; save();
  document.body.classList.toggle('dog', k === 'dog');
  document.querySelectorAll('#kind-seg button').forEach(b => b.classList.toggle('on', b.dataset.kind === k));
  render();
}
function setTab(t) {
  S.tab = t;
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  render(); window.scrollTo(0, 0);
}
document.querySelectorAll('#kind-seg button').forEach(b => b.onclick = () => setKind(b.dataset.kind));
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => setTab(b.dataset.tab));

function render() {
  const v = $('#view');
  document.querySelector('.fab')?.remove();
  if (S.tab === 'recipes') v.innerHTML = viewRecipes();
  else if (S.tab === 'spin') { v.innerHTML = viewSpin(); bindSpin(); return; }
  else if (S.tab === 'saved') v.innerHTML = viewSaved();
  else if (S.tab === 'shop') v.innerHTML = viewShop();
  else v.innerHTML = S.kind === 'dog' ? viewDogGuide() : viewHumanGuide();
  bind(v);
  if (S.tab === 'recipes') {
    const fab = document.createElement('button');
    fab.className = 'fab'; fab.textContent = '＋'; fab.setAttribute('aria-label', 'Add your own recipe');
    fab.onclick = () => openForm();
    document.body.appendChild(fab);
  }
}

/* ---------- recipes list ---------- */
const cuisineOf = r => CUISINE_INFO.find(c => c.id === r.cuisine);
/* Rank by a weighted rating, so 4.9★ from 12 people doesn't outrank 4.8★
   from 2,000: every recipe starts as if 50 people had rated it 4.0. */
const score = r => r.rating ? (r.rating * r.ratings + 4.0 * 50) / (r.ratings + 50) : 0;
const fmtCount = n => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(n);
const stars = r => r.rating ? `<span class="rate">★ ${r.rating.toFixed(1)}</span> <span class="rc">(${fmtCount(r.ratings)})</span>` : (r.mine ? '' : '<span class="rc">Simmer original</span>');
/* Recipes added before courses existed carried a meal (Lunch/Dinner). */
const courseOf = r => r.course || ({ Lunch: 'Main', Dinner: 'Main' }[r.meal] || r.meal || 'Main');
const coursesFor = kind => kind === 'human' ? COURSES : DOG_COURSES;
const courseLabel = c => COURSE_LABEL[c] || c;
function matches(r) {
  if (r.kind !== S.kind) return false;
  if (S.course !== 'All' && courseOf(r) !== S.course) return false;
  if (S.cui && r.cuisine !== S.cui) return false;
  if (S.lvl && (r.level || 'Easy') !== S.lvl) return false;
  if (S.tag && !(r.tags || []).includes(S.tag)) return false;
  if (S.q) {
    const hay = [r.title, r.blurb, cuisineOf(r)?.name, courseOf(r), ...(r.tags || []), ...r.ingredients.map(i => i[2])].join(' ').toLowerCase();
    return S.q.toLowerCase().split(/\s+/).every(w => hay.includes(w));
  }
  return true;
}
function card(r) {
  const n = S.made[r.id] || 0, c = cuisineOf(r), lv = r.level || 'Easy';
  return `<button class="card rcard" data-open="${esc(r.id)}">
    <div class="emo">${esc(r.emoji || '🍽️')}</div>
    <div class="body">
      <div class="t">${esc(r.title)} ${S.saved.has(r.id) ? '<span class="star">★</span>' : ''}</div>
      <div class="b">${esc(r.blurb || '')}</div>
      <div class="meta">${stars(r) ? `<span>${stars(r)}</span>` : ''}<span>${LEVEL_ICON[lv]} ${lv}</span><span>⏱ ${r.time} min${r.wait ? ' +' : ''}</span>${c ? `<span>${c.emoji} ${esc(c.name)}</span>` : ''}${n ? `<span>✓ made ${n}×</span>` : ''}</div>
    </div></button>`;
}
/* Split a list into titled sections for the chosen "group by". Within a
   section: easiest first, then quickest. */
function grouped(list) {
  const byLevel = (a, b) => score(b) - score(a) || LEVELS.indexOf(a.level || 'Easy') - LEVELS.indexOf(b.level || 'Easy') || a.time - b.time;
  let keys, keyOf, title;
  if (S.group === 'rated') {
    const ranked = [...list].sort((a, b) => score(b) - score(a));
    return `<h2 class="group">⭐ Best reviewed first <span class="count">${ranked.length}</span></h2>
      <p class="sub" style="margin-top:-4px">Ranked by star rating, weighted by how many people rated it.</p><div class="grid">${ranked.map(card).join('')}</div>`;
  }
  if (S.group === 'level') { keys = LEVELS; keyOf = r => r.level || 'Easy'; title = k => `${LEVEL_ICON[k]} ${k}`; }
  else if (S.group === 'cuisine' && S.kind === 'human') {
    keys = [...CUISINE_INFO.map(c => c.id), '']; keyOf = r => cuisineOf(r) ? r.cuisine : '';
    title = k => { const c = CUISINE_INFO.find(x => x.id === k); return c ? `${c.emoji} ${c.name} <small>${esc(c.region)}</small>` : '🍽️ Other'; };
  } else { const cs = coursesFor(S.kind); keys = [...cs, ...new Set(list.map(courseOf).filter(c => !cs.includes(c)))]; keyOf = courseOf; title = courseLabel; }
  return keys.map(k => [k, list.filter(r => keyOf(r) === k).sort(byLevel)]).filter(([, l]) => l.length)
    .map(([k, l]) => `<h2 class="group">${title(k)} <span class="count">${l.length}</span></h2><div class="grid">${l.map(card).join('')}</div>`).join('');
}
function viewRecipes() {
  const pool = all().filter(r => r.kind === S.kind);
  const tags = [...new Set(pool.flatMap(r => r.tags || []))].sort();
  const list = pool.filter(matches);
  const human = S.kind === 'human';
  const title = human ? 'Healthy recipes' : 'Dog kitchen';
  const sub = human
    ? 'The best-reviewed version of each dish, with step-by-step cook mode. Every recipe is pork-free.'
    : 'Treats, toppers and tummy-friendly meals. All dog-safe: no onion, garlic, salt or xylitol.';
  const opt = (v, cur, label) => `<option value="${esc(v)}" ${cur === v ? 'selected' : ''}>${esc(label)}</option>`;
  const filtered = S.course !== 'All' || S.cui || S.lvl || S.tag || S.q;
  return `<h1>${title}</h1><p class="sub">${sub}</p>
    <div class="search"><input id="q" type="search" placeholder="Search recipes or ingredients…" value="${esc(S.q)}" autocomplete="off"></div>
    <div class="chips">${['All', ...coursesFor(S.kind)].map(m => `<button class="chip ${S.course === m ? 'on' : ''}" data-course="${esc(m)}">${esc(m === 'All' ? 'All' : courseLabel(m))}</button>`).join('')}</div>
    <div class="filters">
      ${human ? `<select id="f-cui" aria-label="Cuisine">${opt('', S.cui, '🌍 Any cuisine')}${CUISINE_INFO.filter(c => pool.some(r => r.cuisine === c.id)).map(c => opt(c.id, S.cui, `${c.emoji} ${c.name}`)).join('')}</select>` : ''}
      <select id="f-lvl" aria-label="Difficulty">${opt('', S.lvl, '📶 Any level')}${LEVELS.map(l => opt(l, S.lvl, `${LEVEL_ICON[l]} ${l}`)).join('')}</select>
      <select id="f-tag" aria-label="Diet and tags">${opt('', S.tag, '🏷️ Any diet')}${tags.map(t => opt(t, S.tag, '#' + t)).join('')}</select>
    </div>
    <div class="groupby"><span>Show</span><div class="seg2">${[['rated', '⭐ Top'], ['course', 'Course'], ...(human ? [['cuisine', 'Cuisine']] : []), ['level', 'Difficulty']].map(([k, t]) =>
      `<button data-group="${k}" class="${S.group === k || (k === 'course' && S.group === 'cuisine' && !human) ? 'on' : ''}">${t}</button>`).join('')}</div>
      ${filtered ? `<button class="btn ghost small" data-act="clear-filters">Clear</button>` : ''}</div>
    ${list.length ? grouped(list)
      : `<div class="empty"><div class="big">🔍</div>Nothing matches. Try another word or clear the filters.</div>`}`;
}
function viewSaved() {
  const list = all().filter(r => r.kind === S.kind && S.saved.has(r.id));
  const mine = S.mine.filter(r => r.kind === S.kind && !S.saved.has(r.id));
  return `<h1>Saved</h1><p class="sub">Your favourites${S.kind === 'dog' ? ' for the dog' : ''}, plus recipes you added.</p>
    ${list.length ? `<div class="grid">${list.map(card).join('')}</div>`
      : `<div class="empty" style="padding:24px 16px"><div class="big">☆</div>Tap ☆ Save on a recipe to keep it here.</div>`}
    ${mine.length ? `<h2>Added by you</h2><div class="grid">${mine.map(card).join('')}</div>` : ''}
    ${viewWish()}`;
}

/* ---------- spin the wheel ----------
   Can't decide what to cook? One wheel of recipes for the chosen course.
   Tap the wheel, tap Spin, or shake the phone. */
let wheel = null, spinning = false;
/* Wheel slices are narrow: drop filler words so the dish name fits. */
function shortName(t) {
  let s = t.replace(/^(Super Easy|Super Simple|Easy|Perfect|Terrific|Curry Stand|Sean's|Double|Homemade|No-Bake|Groovy|Quick)\s+/i, '')
    .replace(/\s+(with|from)\s.*$/i, '').replace(/\s*\(.*\)$/, '')
    .replace(/\s+Dog (Treats|Biscuits)$/i, '').replace(/^Peanut Butter\b/, 'PB');
  return s || t;
}
function spinPool(course) {
  const k = S.kind;
  return all().filter(r => r.kind === k && (course === 'All' || courseOf(r) === course) && (!S.spin.easy || (r.level || 'Easy') === 'Easy'));
}
function viewSpin() {
  const k = S.kind, course = S.spin[k];
  const courses = coursesFor(k).filter(c => all().filter(r => r.kind === k && courseOf(r) === c).length >= 2);
  let pool = spinPool(course);
  /* "Any" with 40+ dishes would be unreadable; use the 20 best reviewed. */
  if (pool.length > 20) pool = [...pool].sort((a, b) => score(b) - score(a)).slice(0, 20);
  S.spinPool = pool;
  const r = S.spin.res && byId(S.spin.res);
  return `<h1>${k === 'dog' ? 'Spin a dog treat' : 'Spin for a recipe'}</h1>
    <p class="sub">Can’t decide what to make? Tap the wheel or shake your phone.</p>
    <div class="chips">${['All', ...courses].map(c => `<button class="chip ${course === c ? 'on' : ''}" data-spin-course="${esc(c)}">${esc(c === 'All' ? 'Any' : courseLabel(c))}</button>`).join('')}
      <button class="chip ${S.spin.easy ? 'on' : ''}" data-spin-easy>🟢 Easy only</button></div>
    <div class="spin-wrap">
      ${pool.length >= 2 ? `<div class="wheel-box"><div class="pointer"></div><canvas id="wheel" aria-label="Recipe wheel"></canvas></div>
        <button class="btn spin-btn" id="spin-go">🎰 Spin</button>
        <p class="hint" id="shake-hint">${shakeHint()}</p>`
      : `<div class="empty">Not enough recipes here to spin — pick another course or turn off “Easy only”.</div>`}
      <div id="spin-result">${r ? spinCard(r) : ''}</div>
    </div>`;
}
function shakeHint() {
  if (Spin.needPerm && !Spin.gotMotion) return `<button class="btn ghost small" id="enable-shake">📳 Turn on shake-to-spin</button>`;
  return Spin.gotMotion ? '📳 Shake your phone to spin' : 'Tip: on a phone, shake to spin 📳';
}
function spinCard(r) {
  const c = cuisineOf(r), lv = r.level || 'Easy';
  return `<div class="card spin-card">
    <div class="big">${esc(r.emoji || '🍽️')}</div>
    <div class="what">${esc(r.title)}</div>
    <div class="meta" style="justify-content:center">${stars(r) ? `<span>${stars(r)}</span>` : ''}<span>⏱ ${r.time} min${r.wait ? ' +' : ''}</span><span>${LEVEL_ICON[lv]} ${lv}</span>${c ? `<span>${c.emoji} ${esc(c.name)}</span>` : ''}</div>
    <p style="margin:8px 0 0">${esc(r.blurb || '')}</p>
    <div class="actions"><button class="btn" data-spin-act="open">📖 Open recipe</button><button class="btn ghost" data-spin-act="cook">▶ Cook it</button></div>
  </div>`;
}
function bindSpin() {
  document.querySelectorAll('[data-spin-course]').forEach(b => b.onclick = () => { S.spin[S.kind] = b.dataset.spinCourse; S.spin.res = null; render(); });
  const easy = document.querySelector('[data-spin-easy]');
  if (easy) easy.onclick = () => { S.spin.easy = !S.spin.easy; S.spin.res = null; render(); };
  const cv = $('#wheel');
  if (cv) {
    wheel = new Wheel(cv, { ticks: true });
    wheel.setItems(S.spinPool.map(r => ({ id: r.id, label: shortName(r.title), emoji: r.emoji })));
    const i = S.spinPool.findIndex(r => r.id === S.spin.res); if (i >= 0) wheel.show(i);
    cv.onclick = spinRecipe; $('#spin-go').onclick = spinRecipe;
  } else wheel = null;
  $('#enable-shake')?.addEventListener('click', async () => { if (await Spin.askPermission()) toast('Shake away! 📳'); $('#shake-hint').innerHTML = shakeHint(); });
  bindSpinCard();
}
function bindSpinCard() {
  document.querySelectorAll('[data-spin-act]').forEach(b => b.onclick = () => {
    openRecipe(S.spin.res);
    if (b.dataset.spinAct === 'cook') startCook();
  });
}
async function spinRecipe() {
  if (spinning || !wheel || S.tab !== 'spin') return;
  spinning = true; Spin.audio();
  const go = $('#spin-go'); go.disabled = true; go.textContent = '🎰 Spinning…';
  $('#spin-result').innerHTML = '';
  /* Don't land on the same dish twice in a row. */
  let i = Math.floor(Math.random() * S.spinPool.length);
  if (S.spinPool.length > 1 && S.spinPool[i].id === S.spin.res) i = (i + 1 + Math.floor(Math.random() * (S.spinPool.length - 1))) % S.spinPool.length;
  await wheel.spinTo(i, 4300, 6);
  spinning = false; Spin.ding();
  S.spin.res = S.spinPool[i].id;
  if (S.tab !== 'spin' || !$('#spin-result')) return;
  go.disabled = false; go.textContent = '🎰 Spin again';
  $('#spin-result').innerHTML = spinCard(S.spinPool[i]); bindSpinCard();
  $('#spin-result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
Spin.onShake = () => { if ($('#sheet').hidden && !cook) spinRecipe(); };
Spin.onFirstMotion = () => { const h = $('#shake-hint'); if (h) h.innerHTML = shakeHint(); };
addEventListener('resize', () => { if (wheel && wheel.c.isConnected) wheel.draw(); });

/* ---------- recipes to add (wishlist) ----------
   Ideas for recipes to build into the app later. Share sends the list as
   plain text so it can be pasted to whoever updates the app. */
function viewWish() {
  const row = w => `<li><span style="font-size:20px">${w.kind === 'dog' ? '🐶' : '🧑'}</span>
    <div class="txt"><strong>${esc(w.name)}</strong>${w.note ? `<div class="from">${esc(w.note)}</div>` : ''}</div>
    <button class="x" data-wdel="${w.id}" aria-label="Remove">✕</button></li>`;
  return `<h2 id="wish">📝 Recipes to add</h2>
    <p class="sub">Jot down dishes you’d like in Simmer — a name, plus a link or note if you have one. Tap Share to send the list.</p>
    <form class="card form" id="wish-form" style="padding:12px 14px">
      <input name="name" placeholder="Dish name, e.g. Butter chicken" required autocomplete="off">
      <input name="note" placeholder="Link or note (optional)" autocomplete="off" style="margin-top:8px">
      <div style="display:flex;gap:8px;margin-top:8px;align-items:center">
        <select name="kind" style="flex:1">${['human', 'dog'].map(k => `<option value="${k}" ${S.kind === k ? 'selected' : ''}>${k === 'dog' ? '🐶 For the dog' : '🧑 For us'}</option>`).join('')}</select>
        <button class="btn">Add</button></div>
    </form>
    ${S.wish.length ? `<div class="card" style="margin-top:10px"><ul class="list">${S.wish.map(row).join('')}</ul></div>
      <div class="actions"><button class="btn" data-act="share-wish">📤 Share list (${S.wish.length})</button><button class="btn ghost" data-act="copy-wish">Copy</button></div>` : ''}`;
}
function wishText() {
  const part = (k, h) => { const l = S.wish.filter(w => w.kind === k); return l.length ? `${h}\n` + l.map(w => `- ${w.name}${w.note ? ' — ' + w.note : ''}`).join('\n') : ''; };
  return ['Simmer — recipes to add', part('human', 'For us:'), part('dog', 'For the dog:')].filter(Boolean).join('\n\n');
}

/* ---------- shopping list ---------- */
function viewShop() {
  if (!S.shop.length) return `<h1>Shopping list</h1><div class="empty"><div class="big">🛒</div>Open a recipe and tap “Add to list”.<br>Items from human and dog recipes share one list.</div>${addItemRow()}`;
  const open = S.shop.filter(i => !i.done), done = S.shop.filter(i => i.done);
  const row = i => `<li class="${i.done ? 'done' : ''}"><button class="check" data-tick="${i.id}">${i.done ? '✓' : ''}</button>
    <div class="txt">${esc(i.text)}${i.from ? `<div class="from">${esc(i.from)}</div>` : ''}</div><button class="x" data-del="${i.id}" aria-label="Remove">✕</button></li>`;
  return `<h1>Shopping list</h1><p class="sub">${open.length} to get${done.length ? ` · ${done.length} in the basket` : ''}</p>
    ${addItemRow()}
    <div class="card"><ul class="list">${open.map(row).join('')}${done.map(row).join('')}</ul></div>
    <div class="actions"><button class="btn ghost" data-act="share-list">Share list</button>
    ${done.length ? '<button class="btn ghost" data-act="clear-done">Clear ticked</button>' : ''}
    <button class="btn bad" data-act="clear-all">Clear all</button></div>`;
}
const addItemRow = () => `<form class="search" id="add-item"><input name="t" placeholder="Add an item…" autocomplete="off"><button class="btn">Add</button></form>`;
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ---------- guides ---------- */
function gcard(g) {
  return `<div class="card gcard"><h3>${esc(g.title)}</h3>${g.body ? `<p>${esc(g.body)}</p>` : ''}
    ${g.list ? `<ul>${g.list.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div>`;
}
function viewHumanGuide() {
  return `<h1>Eating well</h1><p class="sub">Simple rules of thumb, no diet dogma.</p>${HUMAN_GUIDE.map(gcard).join('')}`;
}
function calcOut() {
  const kg = parseFloat(S.dog.kg), unit = S.dog.unit || 'kg';
  const kgVal = unit === 'lb' ? kg / 2.2046 : kg;
  const stage = DOG_LIFE_STAGES.find(s => s.id === S.dog.stage) || DOG_LIFE_STAGES[1];
  let out = '<p class="sub" style="margin:6px 0 0">Enter your dog’s weight to see a daily calorie estimate and treat budget.</p>';
  if (kgVal > 0) {
    const rer = 70 * Math.pow(kgVal, 0.75), day = Math.round(rer * stage.factor / 10) * 10, treat = Math.round(day * 0.1);
    out = `<div class="out"><div><b>${day}</b><small>kcal / day (approx.)</small></div><div><b>${treat}</b><small>kcal treat budget</small></div>
      <div><b>${Math.max(1, Math.floor(treat / 2))}</b><small>liver treats (2 kcal)</small></div></div>
      <p class="nutri" style="margin:8px 0 0">An estimate (RER × ${stage.factor}). Your dog’s food bag and your vet know best — adjust if your dog gains or loses weight.</p>`;
  }
  return out;
}
function dogCalc() {
  const unit = S.dog.unit || 'kg';
  const stage = DOG_LIFE_STAGES.find(s => s.id === S.dog.stage) || DOG_LIFE_STAGES[1];
  return `<div class="card calc"><h3 style="margin:0 0 8px">🧮 Treat budget</h3>
    <div class="row"><input id="dog-kg" type="number" inputmode="decimal" min="0" step="0.1" placeholder="Weight" value="${esc(S.dog.kg)}">
      <select id="dog-unit"><option value="kg" ${unit === 'kg' ? 'selected' : ''}>kg</option><option value="lb" ${unit === 'lb' ? 'selected' : ''}>lb</option></select></div>
    <select id="dog-stage">${DOG_LIFE_STAGES.map(s => `<option value="${s.id}" ${s.id === stage.id ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</select>
    <div id="calc-out">${calcOut()}</div></div>`;
}
function foodRows() {
  const q = S.foodQ.toLowerCase();
  const rows = DOG_FOODS.filter(f => !q || (f.food + ' ' + f.note).toLowerCase().includes(q));
  if (!rows.length) return `<div class="food"><div class="n">Not on the list. When in doubt, don’t feed it and ask your vet.</div></div>`;
  return rows.map(f => `<div class="food"><span class="lvl ${f.level}">${f.level === 'toxic' ? 'No' : f.level === 'caution' ? 'Careful' : 'Yes'}</span>
    <div><div class="f">${esc(f.food)}</div><div class="n">${esc(f.note)}</div></div></div>`).join('');
}
function viewDogGuide() {
  return `<h1>Dog food guide</h1><p class="sub">What’s safe, how much, and when to call the vet.</p>
    ${dogCalc()}
    <h2>Can my dog eat…?</h2>
    <div class="search"><input id="food-q" type="search" placeholder="e.g. grapes, cheese, apple" value="${esc(S.foodQ)}" autocomplete="off"></div>
    <div class="card" id="food-list">${foodRows()}</div>
    <h2>Ground rules</h2>${DOG_RULES.map(gcard).join('')}`;
}

/* ---------- events ---------- */
function bind(v) {
  v.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openRecipe(b.dataset.open));
  v.querySelectorAll('[data-course]').forEach(b => b.onclick = () => { S.course = b.dataset.course; render(); });
  v.querySelectorAll('[data-group]').forEach(b => b.onclick = () => { S.group = b.dataset.group; save(); render(); });
  [['#f-cui', 'cui'], ['#f-lvl', 'lvl'], ['#f-tag', 'tag']].forEach(([sel, k]) => { const e = v.querySelector(sel); if (e) e.onchange = () => { S[k] = e.value; render(); }; });
  const wf = v.querySelector('#wish-form');
  if (wf) wf.onsubmit = e => {
    e.preventDefault(); const name = wf.name.value.trim(); if (!name) return;
    S.wish.push({ id: newId(), name, note: wf.note.value.trim(), kind: wf.kind.value, at: new Date().toISOString() });
    save(); render(); toast('Added to “Recipes to add”'); $('#wish')?.scrollIntoView({ block: 'start' });
  };
  v.querySelectorAll('[data-wdel]').forEach(b => b.onclick = () => { S.wish = S.wish.filter(w => w.id !== b.dataset.wdel); save(); render(); });
  const q = v.querySelector('#q');
  if (q) q.oninput = () => {
    S.q = q.value; const pos = q.selectionStart; render();
    const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos);
  };
  v.querySelectorAll('[data-tick]').forEach(b => b.onclick = () => { const i = S.shop.find(x => x.id === b.dataset.tick); i.done = !i.done; save(); render(); });
  v.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { S.shop = S.shop.filter(x => x.id !== b.dataset.del); save(); render(); });
  const f = v.querySelector('#add-item');
  if (f) f.onsubmit = e => {
    e.preventDefault(); const t = f.t.value.trim(); if (!t) return;
    S.shop.unshift({ id: newId(), text: t, done: false }); save(); render(); $('#add-item input').focus();
  };
  v.querySelectorAll('[data-act]').forEach(b => b.onclick = () => act(b.dataset.act));
  const kg = v.querySelector('#dog-kg'), unit = v.querySelector('#dog-unit'), st = v.querySelector('#dog-stage');
  const recalc = () => { S.dog = { kg: kg.value, unit: unit.value, stage: st.value }; save(); $('#calc-out').innerHTML = calcOut(); };
  if (kg) { kg.oninput = recalc; unit.onchange = recalc; st.onchange = recalc; }
  const fq = v.querySelector('#food-q');
  if (fq) fq.oninput = () => { S.foodQ = fq.value; $('#food-list').innerHTML = foodRows(); };
}
function act(a) {
  if (a === 'clear-filters') { S.course = 'All'; S.cui = ''; S.lvl = ''; S.tag = ''; S.q = ''; render(); return; }
  if (a === 'share-wish' || a === 'copy-wish') {
    const text = wishText();
    if (a === 'share-wish' && navigator.share) navigator.share({ title: 'Simmer — recipes to add', text }).catch(() => {});
    else navigator.clipboard?.writeText(text).then(() => toast('Copied — paste it anywhere'), () => toast('Could not copy'));
    return;
  }
  if (a === 'clear-done') S.shop = S.shop.filter(i => !i.done);
  if (a === 'clear-all' && confirm('Clear the whole shopping list?')) S.shop = [];
  if (a === 'share-list') {
    const text = 'Shopping list\n' + S.shop.filter(i => !i.done).map(i => '• ' + i.text).join('\n');
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else navigator.clipboard?.writeText(text).then(() => toast('Copied to clipboard'));
    return;
  }
  save(); render();
}

/* ---------- recipe sheet ---------- */
let cur = null;
function openSheet(html) { $('#sheet-body').innerHTML = html; $('#sheet').hidden = false; $('.sheet-card').scrollTop = 0; document.body.style.overflow = 'hidden'; }
function closeSheet() { $('#sheet').hidden = true; document.body.style.overflow = ''; cur = null; }
$('#sheet-close').onclick = closeSheet;
$('#sheet').onclick = e => { if (e.target.id === 'sheet') closeSheet(); };

const BATCH = [0.5, 1, 1.5, 2, 3, 4];
function factor() { return cur.r.servesUnit ? cur.mult : cur.serves / cur.r.serves; }
function openRecipe(id) {
  const r = byId(id); if (!r) return;
  cur = { r, serves: r.serves, mult: 1, got: new Set() };
  drawRecipe();
}
function drawRecipe() {
  const { r } = cur, f = factor();
  const amount = r.servesUnit
    ? `<span>Makes ${fmtQty(r.serves * f)} ${esc(r.servesUnit)}</span>`
    : `<span>${cur.serves} serving${cur.serves > 1 ? 's' : ''}</span>`;
  const kcal = r.kcal ? (r.kind === 'dog'
      ? `≈ ${r.kcal} kcal per ${esc(r.kcalUnit || 'serving')}`
      : `≈ ${r.kcal} kcal${r.protein ? ` · ${r.protein} g protein` : ''} per ${esc(r.kcalUnit || 'serving')}`) : '';
  const tips = (r.tips || []).map(t => `<div class="tip ${/never|toxic|deadly|call your vet|not for the dog/i.test(t) ? 'warn' : ''}">💡 ${esc(t)}</div>`).join('');
  openSheet(`
    <div class="hero"><div class="emo">${esc(r.emoji || '🍽️')}</div><div><h1>${esc(r.title)}</h1>
      <div class="meta"><span>⏱ ${r.time} min${r.wait ? ' + ' + esc(r.wait) : ''}</span><span>${esc(courseLabel(courseOf(r)))}</span><span>${LEVEL_ICON[r.level || 'Easy']} ${r.level || 'Easy'}</span>${cuisineOf(r) ? `<span>${cuisineOf(r).emoji} ${esc(cuisineOf(r).name)}</span>` : ''}</div></div></div>
    <p style="margin:0">${esc(r.blurb || '')}</p>
    ${r.rating ? `<div class="srcline"><span class="rate">${'★'.repeat(Math.round(r.rating))}</span> <strong>${r.rating.toFixed(1)}</strong> from ${r.ratings.toLocaleString()} ratings on ${esc(r.source.site)}
      · <a href="${esc(r.source.url)}" target="_blank" rel="noopener">original recipe ↗</a></div>` : ''}
    <div class="pills">${(r.tags || []).map(t => `<span class="pill">#${esc(t)}</span>`).join('')}</div>
    ${kcal ? `<div class="nutri">${kcal} (approx.)</div>` : ''}
    <div class="actions">
      <button class="btn wide" data-r="cook">▶ Start cooking</button>
    </div>
    <div class="actions">
      <button class="btn ghost" data-r="save">${S.saved.has(r.id) ? '★ Saved' : '☆ Save'}</button>
      <button class="btn ghost" data-r="list">🛒 Add to list</button>
      <button class="btn ghost" data-r="made">✓ Made it${S.made[r.id] ? ` (${S.made[r.id]})` : ''}</button>
    </div>
    <div class="serve-row"><h2 style="margin:8px 0">Ingredients</h2>
      <div class="stepper"><button data-r="minus" aria-label="Fewer">−</button>${amount}<button data-r="plus" aria-label="More">＋</button></div></div>
    <p class="nutri" style="margin:0 0 4px">Tap an ingredient to tick it off as you gather it.</p>
    <ul class="ing">${r.ingredients.map((row, i) => { const l = ingLine(row, f);
      return `<li data-ing="${i}" class="${cur.got.has(i) ? 'got' : ''}"><span class="q">${esc(l.q)}</span><span>${esc(l.text)}</span></li>`; }).join('')}</ul>
    <h2>Method</h2><ol class="steps">${r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    ${tips ? `<h2>Good to know</h2>${tips}` : ''}
    ${r.mine ? `<div class="actions"><button class="btn ghost" data-r="edit">✏️ Edit</button><button class="btn bad" data-r="delete">Delete recipe</button></div>` : ''}
  `);
  const body = $('#sheet-body');
  body.querySelectorAll('[data-ing]').forEach(li => li.onclick = () => {
    const i = +li.dataset.ing; cur.got.has(i) ? cur.got.delete(i) : cur.got.add(i); li.classList.toggle('got');
  });
  body.querySelectorAll('[data-r]').forEach(b => b.onclick = () => recipeAct(b.dataset.r));
}
function recipeAct(a) {
  const { r } = cur;
  if (a === 'plus' || a === 'minus') {
    const d = a === 'plus' ? 1 : -1;
    if (r.servesUnit) { const i = BATCH.indexOf(cur.mult); cur.mult = BATCH[Math.max(0, Math.min(BATCH.length - 1, i + d))]; }
    else cur.serves = Math.max(1, Math.min(24, cur.serves + d));
    const top = $('.sheet-card').scrollTop; drawRecipe(); $('.sheet-card').scrollTop = top; return;
  }
  if (a === 'save') { S.saved.has(r.id) ? S.saved.delete(r.id) : S.saved.add(r.id); toast(S.saved.has(r.id) ? 'Saved ★' : 'Removed from saved'); }
  if (a === 'made') { S.made[r.id] = (S.made[r.id] || 0) + 1; toast('Nice! Logged as made.'); }
  if (a === 'list') {
    const f = factor(); let n = 0;
    r.ingredients.forEach((row, i) => {
      if (cur.got.has(i) || row[0] == null && /to taste|salt and pepper|nothing else|^no /i.test(row[2])) return;
      const l = ingLine(row, f); S.shop.push({ id: newId(), text: (l.q ? l.q + ' ' : '') + l.text, from: r.title, done: false }); n++;
    });
    toast(`Added ${n} item${n === 1 ? '' : 's'} to the list` + (cur.got.size ? ' (skipped ticked ones)' : ''));
  }
  if (a === 'cook') { startCook(); return; }
  if (a === 'edit') { const id = r.id; closeSheet(); openForm(id); return; }
  if (a === 'delete') {
    if (!confirm(`Delete “${r.title}”?`)) return;
    S.mine = S.mine.filter(x => x.id !== r.id); S.saved.delete(r.id); save(); closeSheet(); render(); return;
  }
  save(); const top = $('.sheet-card').scrollTop; drawRecipe(); $('.sheet-card').scrollTop = top; render();
}

/* ---------- cook mode ---------- */
let cook = null, wake = null;
const timers = [];
async function lockScreen() { try { wake = await navigator.wakeLock?.request('screen'); } catch {} }
document.addEventListener('visibilitychange', () => { if (cook && document.visibilityState === 'visible') lockScreen(); });

function startCook() {
  cook = { r: cur.r, f: factor(), i: 0 };
  $('#cook').hidden = false; document.body.style.overflow = 'hidden';
  lockScreen(); drawCook();
}
/* Minutes mentioned in a step become one-tap timers: "20 minutes", "2–3
   minutes" (uses the upper bound), "2½–3 hours", "30 seconds". */
function timersIn(text) {
  const out = [];
  const re = /(\d+(?:½)?)(?:\s*[–-]\s*(\d+(?:½)?))?\s*(hours?|minutes?|mins?|seconds?)/gi;
  let m;
  const num = s => parseFloat(s) + (s.includes('½') ? 0.5 : 0);
  while ((m = re.exec(text))) {
    const n = num(m[2] || m[1]), u = m[3].toLowerCase();
    const secs = u.startsWith('h') ? n * 3600 : u.startsWith('s') ? n : n * 60;
    out.push({ label: m[0], secs });
  }
  return out;
}
const mmss = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };

function drawCook() {
  const { r, i, f } = cook, n = r.steps.length, step = r.steps[i];
  const found = timersIn(step);
  const ingHint = i === 0 ? `<div class="cook-ing">You’ll need: ${r.ingredients.map(row => { const l = ingLine(row, f); return esc((l.q ? l.q + ' ' : '') + l.text); }).join(' · ')}</div>` : '';
  $('#cook').innerHTML = `
    <div class="bar"><strong style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.emoji || '')} ${esc(r.title)}</strong>
      <button class="btn ghost small" id="cook-x">Done</button></div>
    <div class="prog"><i style="width:${(i + 1) / n * 100}%"></i></div>
    <div class="num">Step ${i + 1} of ${n}</div>
    <div class="text">${esc(step)}${ingHint ? '<br><br>' + ingHint : ''}</div>
    <div class="timers" id="timer-row">${found.map((t, k) => `<button class="btn ghost small" data-t="${k}">⏲ ${esc(t.label)}</button>`).join('')}${timerPills()}</div>
    <div class="nav"><button class="btn ghost" id="prev" ${i ? '' : 'disabled style="opacity:.4"'}>← Back</button>
      <button class="btn" id="next">${i === n - 1 ? 'Finish ✓' : 'Next →'}</button></div>`;
  $('#cook-x').onclick = endCook;
  $('#prev').onclick = () => { if (cook.i) { cook.i--; drawCook(); } };
  $('#next').onclick = () => {
    if (cook.i < n - 1) { cook.i++; drawCook(); return; }
    S.made[r.id] = (S.made[r.id] || 0) + 1; save(); endCook(); toast('Enjoy! Logged as made.');
  };
  document.querySelectorAll('#cook [data-t]').forEach(b => b.onclick = () => {
    const t = found[+b.dataset.t]; timers.push({ id: newId(), label: t.label, end: Date.now() + t.secs * 1000 });
    window.Notification?.permission === 'default' && Notification.requestPermission();
    drawCook();
  });
  bindPills();
}
function timerPills() {
  return timers.map(t => { const left = (t.end - Date.now()) / 1000;
    return `<button class="timer-pill ${left <= 0 ? 'ring' : ''}" data-tid="${t.id}">${left <= 0 ? '⏰ Done! tap to stop' : '⏲ ' + mmss(left)}</button>`; }).join('');
}
function bindPills() {
  document.querySelectorAll('[data-tid]').forEach(b => b.onclick = () => {
    const k = timers.findIndex(t => t.id === b.dataset.tid);
    if (k >= 0 && (timers[k].end <= Date.now() || confirm('Cancel this timer?'))) timers.splice(k, 1);
    cook ? drawCook() : null;
  });
}
function endCook() { cook = null; $('#cook').hidden = true; document.body.style.overflow = $('#sheet').hidden ? '' : 'hidden'; wake?.release?.(); wake = null; }

/* One ticker for every timer; beeps and vibrates when one finishes, even if
   you've left cook mode (the next step's timer can outlive the step). */
let audio;
function beep() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    [0, .35, .7].forEach(d => { const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = 880; g.gain.setValueAtTime(.25, audio.currentTime + d); g.gain.exponentialRampToValueAtTime(.001, audio.currentTime + d + .3);
      o.connect(g).connect(audio.destination); o.start(audio.currentTime + d); o.stop(audio.currentTime + d + .3); });
  } catch {}
  navigator.vibrate?.([300, 150, 300, 150, 300]);
}
setInterval(() => {
  if (!timers.length) return;
  timers.forEach(t => {
    if (!t.rang && t.end <= Date.now()) {
      t.rang = true; beep(); toast(`⏰ Timer done: ${t.label}`);
      if (document.visibilityState !== 'visible' && window.Notification?.permission === 'granted')
        navigator.serviceWorker?.ready.then(reg => reg.showNotification('Simmer timer done', { body: t.label, tag: t.id, vibrate: [300, 150, 300] }));
    }
  });
  const row = $('#timer-row');
  if (cook && row) { row.querySelectorAll('[data-tid]').forEach(e => e.remove()); row.insertAdjacentHTML('beforeend', timerPills()); bindPills(); }
}, 1000);

/* ---------- add / edit your own recipe ---------- */
function openForm(editId) {
  const r = editId ? S.mine.find(x => x.id === editId) : null;
  const kind = r ? r.kind : S.kind;
  const courses = coursesFor(kind), curCourse = r ? courseOf(r) : courses[0];
  const ingText = r ? r.ingredients.map(([q, u, t]) => (q != null ? fmtQty(q) + ' ' : '') + (u ? u + ' ' : '') + t).join('\n') : '';
  openSheet(`<h1 style="margin-right:44px">${r ? 'Edit recipe' : 'Add your own recipe'}</h1>
    <p class="sub">Saved on this phone only.</p>
    <form class="form" id="rform">
      <label>Name</label><input name="title" required value="${esc(r?.title || '')}" placeholder="e.g. Mum’s lentil soup">
      <div class="two"><div><label>For</label><select name="kind"><option value="human" ${kind === 'human' ? 'selected' : ''}>🧑 Human</option><option value="dog" ${kind === 'dog' ? 'selected' : ''}>🐶 Dog</option></select></div>
        <div><label>Course</label><select name="course">${[...COURSES, ...DOG_COURSES].map(m => `<option value="${esc(m)}" ${curCourse === m ? 'selected' : ''}>${esc(courseLabel(m))}</option>`).join('')}</select></div></div>
      <div class="two"><div><label>Cuisine</label><select name="cuisine"><option value="">—</option>${CUISINE_INFO.map(c => `<option value="${c.id}" ${r?.cuisine === c.id ? 'selected' : ''}>${c.emoji} ${esc(c.name)}</option>`).join('')}</select></div>
        <div><label>Difficulty</label><select name="level">${LEVELS.map(l => `<option ${(r?.level || 'Easy') === l ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
      <div class="two"><div><label>Minutes</label><input name="time" type="number" inputmode="numeric" min="1" value="${r?.time || 20}"></div>
        <div><label>Serves</label><input name="serves" type="number" inputmode="numeric" min="1" value="${r?.serves || 2}"></div></div>
      <div class="two"><div><label>Emoji</label><input name="emoji" maxlength="4" value="${esc(r?.emoji || (kind === 'dog' ? '🦴' : '🍽️'))}"></div>
        <div><label>Tags (comma separated)</label><input name="tags" value="${esc((r?.tags || []).join(', '))}" placeholder="quick, vegan"></div></div>
      <label>Short description</label><input name="blurb" value="${esc(r?.blurb || '')}">
      <label>Ingredients — one per line (start with an amount to make it scalable)</label>
      <textarea name="ing" required placeholder="2 cups rolled oats&#10;1/2 tsp cinnamon&#10;salt to taste">${esc(ingText)}</textarea>
      <label>Steps — one per line</label><textarea name="steps" required placeholder="Heat the oven to 350°F.&#10;Mix everything…&#10;Bake 20 minutes.">${esc(r ? r.steps.join('\n') : '')}</textarea>
      <label>Tips (optional, one per line)</label><textarea name="tips" style="min-height:60px">${esc(r ? (r.tips || []).join('\n') : '')}</textarea>
      <div class="actions"><button class="btn wide">${r ? 'Save changes' : 'Add recipe'}</button></div>
    </form>`);
  $('#rform').onsubmit = e => {
    e.preventDefault(); const f = e.target, lines = s => s.split('\n').map(x => x.trim()).filter(Boolean);
    const rec = {
      id: r?.id || 'mine-' + newId(), mine: true, kind: f.kind.value, course: f.course.value, cuisine: f.cuisine.value || undefined, level: f.level.value, emoji: f.emoji.value.trim() || '🍽️',
      title: f.title.value.trim(), blurb: f.blurb.value.trim(), time: +f.time.value || 0, serves: Math.max(1, +f.serves.value || 1),
      tags: f.tags.value.split(',').map(t => t.trim().toLowerCase()).filter(Boolean),
      ingredients: lines(f.ing.value).map(parseIng), steps: lines(f.steps.value), tips: lines(f.tips.value),
    };
    if (r) S.mine[S.mine.findIndex(x => x.id === r.id)] = rec; else S.mine.push(rec);
    save(); closeSheet();
    if (rec.kind !== S.kind) setKind(rec.kind); else render();
    openRecipe(rec.id); toast(r ? 'Saved' : 'Recipe added');
  };
}

/* ---------- boot ---------- */
document.body.classList.toggle('dog', S.kind === 'dog');
document.querySelectorAll('#kind-seg button').forEach(b => b.classList.toggle('on', b.dataset.kind === S.kind));
setTab('recipes');
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (cook) endCook(); else if (!$('#sheet').hidden) closeSheet();
});

/* Install as a real app. Chrome fires beforeinstallprompt only when the app
   qualifies for a proper install (own icon, no browser badge); prompting from
   here opens Chrome's real install dialog instead of a home-screen shortcut. */
let installEvt = null;
addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); installEvt = e;
  if (matchMedia('(display-mode: standalone)').matches) return;
  try { if (localStorage.getItem('simmer.noInstall') === String(new Date().toDateString())) return; } catch {}
  if (document.querySelector('.install-bar')) return;
  const bar = document.createElement('div'); bar.className = 'install-bar';
  bar.innerHTML = '<img src="icon-192.png" alt=""><div class="txt"><strong>Install Simmer</strong><br>Opens like its own app, works offline.</div><button class="go">Install</button><button class="no" aria-label="Not now">✕</button>';
  bar.querySelector('.go').onclick = async () => { bar.remove(); installEvt.prompt(); try { await installEvt.userChoice; } catch {} installEvt = null; };
  bar.querySelector('.no').onclick = () => { bar.remove(); try { localStorage.setItem('simmer.noInstall', new Date().toDateString()); } catch {} };
  document.body.appendChild(bar);
});
addEventListener('appinstalled', () => { document.querySelector('.install-bar')?.remove(); toast('Installed — open Simmer from your home screen'); });

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  /* Reload onto a new build only when one replaces an older one. On the very
     first visit the worker claims the page too, and that must not reload. */
  const hadWorker = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw?.addEventListener('statechange', () => { if (nw.state === 'activated' && hadWorker) location.reload(); });
    });
  }).catch(() => {});
}
