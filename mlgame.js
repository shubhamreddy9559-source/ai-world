// mlgame.js — "Teach the Bot": a small game where YOU are the teacher.
// You label creatures as Friendly or Grumpy. A real k-nearest-neighbours classifier (k = 3) learns only from your labels,
// then tries new creatures. Few or bad examples = a bad bot. Everything is computed live in the browser.

export const LEVELS = [
  { name: 'Level 1 · Spiky or smooth', rule: 'Friendly 😊 = smooth. Grumpy 😠 = spiky.', truth: (s, k) => (k < 0.5 ? 1 : 0) },
  { name: 'Level 2 · Small & smooth', rule: 'Friendly 😊 = small AND smooth (size + spikes is low). Big or spiky ones are Grumpy 😠.', truth: (s, k) => (s + k < 1 ? 1 : 0) },
  { name: 'Level 3 · The middle one', rule: 'Friendly 😊 = medium size AND medium spikes. Both extremes are Grumpy 😠.', truth: (s, k) => ((s - 0.5) ** 2 + (k - 0.5) ** 2 < 0.075 ? 1 : 0) },
];

export function knn(train, s, k, K = 3) {
  if (!train.length) return { label: 0, conf: 0.5 };
  const near = train.map((p) => ({ c: p.c, d: (p.s - s) ** 2 + (p.k - k) ** 2 })).sort((a, b) => a.d - b.d).slice(0, K);
  const f = near.filter((n) => n.c === 1).length;
  return { label: f * 2 > near.length ? 1 : 0, conf: Math.max(f, near.length - f) / near.length };
}
const TOP = [0.9, 0.85, 0.8];
export function stars(acc, n, lvl = 0) { return acc >= TOP[lvl] && n <= 18 ? 3 : acc >= TOP[lvl] - 0.1 ? 2 : acc >= 0.6 ? 1 : 0; }

function creature(g, cx, cy, s, k, hue) {
  const R = 14 + s * 30, n = 14, len = k * 20;
  g.save(); g.translate(cx, cy);
  g.fillStyle = `hsl(${hue},70%,62%)`; g.strokeStyle = `hsl(${hue},70%,45%)`; g.lineWidth = 2;
  if (len > 1) for (let i = 0; i < n; i++) { const a = (i / n) * 6.283; g.beginPath(); g.moveTo(Math.cos(a - 0.14) * R, Math.sin(a - 0.14) * R); g.lineTo(Math.cos(a) * (R + len), Math.sin(a) * (R + len)); g.lineTo(Math.cos(a + 0.14) * R, Math.sin(a + 0.14) * R); g.closePath(); g.fill(); g.stroke(); }
  g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill(); g.stroke();
  g.fillStyle = '#fff'; const e = R * 0.28; [-1, 1].forEach((q) => { g.beginPath(); g.arc(q * e, -R * 0.15, R * 0.2, 0, 7); g.fill(); });
  g.fillStyle = '#2b1d63'; [-1, 1].forEach((q) => { g.beginPath(); g.arc(q * e, -R * 0.15, R * 0.09, 0, 7); g.fill(); });
  g.strokeStyle = '#2b1d63'; g.lineWidth = 2; g.beginPath(); g.moveTo(-R * 0.25, R * 0.35); g.lineTo(R * 0.25, R * 0.35); g.stroke();
  g.restore();
}

export function wireMLGame(root) {
  const $ = (q) => root.querySelector(q);
  const cv = $('#mg-card'); if (!cv) return;
  const g = cv.getContext('2d'), map = $('#mg-map'), mg = map.getContext('2d');
  let lvl = 0, phase = 'teach', train = [], cur = null, test = [], tally = { ok: 0, n: 0 }, timer = 0, best = [0, 0, 0];
  try { best = JSON.parse(localStorage.getItem('mg-best') || '[0,0,0]'); } catch (e) { /* no storage */ }
  const MIN = 6, MAX = 24;
  const rnd = () => ({ s: Math.random(), k: Math.random(), hue: Math.floor(Math.random() * 360) });
  const label = (c) => (c ? 'Friendly 😊' : 'Grumpy 😠');
  const L = () => LEVELS[lvl];
  function drawCard(c, msg) {
    g.fillStyle = '#1d1442'; g.fillRect(0, 0, 320, 170);
    if (c) creature(g, 160, 88, c.s, c.k, c.hue);
    if (msg) { g.fillStyle = '#fff'; g.font = '14px sans-serif'; g.textAlign = 'center'; g.fillText(msg, 160, 160); }
  }
  function head() {
    $('#mg-level').textContent = L().name; $('#mg-rule').textContent = 'Rule: ' + L().rule;
    $('#mg-best').textContent = best.map((b, i) => `L${i + 1} ${'⭐'.repeat(b) || '–'}`).join('   ');
    root.querySelectorAll('#mg-lvls button').forEach((b, i) => b.setAttribute('aria-pressed', String(i === lvl)));
  }
  function startTeach() {
    clearInterval(timer); phase = 'teach'; train = []; test = []; cur = rnd(); head();
    $('#mg-teach').hidden = false; $('#mg-result').hidden = true; map.hidden = true;
    $('#mg-status').textContent = `Teach the bot: look at each creature and tap its type. Examples: 0 (need ${MIN}–${MAX})`;
    $('#mg-done').disabled = true; $('#mg-friend').disabled = false; $('#mg-grump').disabled = false;
    drawCard(cur);
  }
  function answer(c) {
    if (phase !== 'teach') return;
    train.push({ s: cur.s, k: cur.k, c }); cur = rnd();
    const n = train.length;
    $('#mg-status').textContent = `Examples: ${n} (need ${MIN}–${MAX}). More examples can make the bot smarter, but fewer earns more stars.`;
    $('#mg-done').disabled = n < MIN;
    if (n >= MAX) return finishTeach();
    drawCard(cur);
  }
  function finishTeach() {
    phase = 'test'; $('#mg-teach').hidden = true;
    test = Array.from({ length: 20 }, rnd); tally = { ok: 0, n: 0 };
    $('#mg-status').textContent = 'The bot is guessing 20 new creatures it has never seen…';
    let i = 0;
    timer = setInterval(() => {
      if (i >= test.length) { clearInterval(timer); return showResult(); }
      const t = test[i++], p = knn(train, t.s, t.k), truth = L().truth(t.s, t.k);
      t.pred = p.label; t.ok = p.label === truth; tally.n++; if (t.ok) tally.ok++;
      drawCard(t, `Bot says: ${label(p.label)}  ${t.ok ? '✔ correct' : '✘ wrong'}  (${tally.ok}/${tally.n})`);
    }, 420);
  }
  function showResult() {
    const acc = tally.ok / tally.n, st = stars(acc, train.length, lvl);
    if (st > best[lvl]) { best[lvl] = st; try { localStorage.setItem('mg-best', JSON.stringify(best)); } catch (e) { /* ignore */ } }
    head();
    const types = new Set(train.map((p) => p.c));
    let tip;
    if (types.size < 2) tip = 'You only showed the bot one kind of creature, so it can only guess that kind. Good data needs both!';
    else if (train.length < 10) tip = 'Very few examples: the bot has little to learn from. Try a few more.';
    else if (acc >= TOP[lvl]) tip = train.length <= 18 ? 'Great teaching: accurate AND efficient.' : 'Very accurate! Try getting there with 18 or fewer examples for 3 stars.';
    else tip = 'Some of your examples near the boundary may have been mislabelled, or the bot needs more examples in the tricky area. Look at the map.';
    $('#mg-result').hidden = false;
    $('#mg-result').innerHTML = `<strong>Bot score: ${tally.ok}/${tally.n} (${Math.round(acc * 100)}%) · ${'⭐'.repeat(st) || 'no stars'}</strong><br>${tip}<br><small>You used ${train.length} examples. Stars: 3 = ${Math.round(TOP[lvl] * 100)}%+ with 18 or fewer examples, 2 = ${Math.round((TOP[lvl] - 0.1) * 100)}%+, 1 = 60%+.</small>`;
    $('#mg-status').textContent = 'The map shows what the bot learned (orange = Grumpy, teal = Friendly). White line = the true rule.';
    map.hidden = false; drawMap();
  }
  function drawMap() {
    const S = 240, cell = 8; mg.fillStyle = '#1d1442'; mg.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += cell) for (let x = 0; x < S; x += cell) {
      const p = knn(train, (x + cell / 2) / S, 1 - (y + cell / 2) / S); // x = size, y = spikes (up = spikier)
      mg.fillStyle = p.label ? 'rgba(57,217,184,.35)' : 'rgba(255,154,60,.35)'; mg.fillRect(x, y, cell, cell);
    }
    mg.fillStyle = 'rgba(255,255,255,.9)';
    for (let y = 0; y < S; y += 3) for (let x = 0; x < S; x += 3) {
      const a = L().truth(x / S, 1 - y / S), b = L().truth((x + 3) / S, 1 - y / S), c = L().truth(x / S, 1 - (y + 3) / S);
      if (a !== b || a !== c) mg.fillRect(x, y, 2, 2);
    }
    train.forEach((p) => { mg.beginPath(); mg.arc(p.s * S, (1 - p.k) * S, 4, 0, 7); mg.fillStyle = p.c ? '#39d9b8' : '#ff9a3c'; mg.fill(); mg.strokeStyle = '#fff'; mg.lineWidth = 1; mg.stroke(); });
    test.forEach((t) => { mg.strokeStyle = t.ok ? '#7dff9a' : '#ff4d6d'; mg.lineWidth = 2.5; mg.strokeRect(t.s * S - 5, (1 - t.k) * S - 5, 10, 10); });
    mg.fillStyle = '#fff'; mg.font = '11px sans-serif'; mg.textAlign = 'left'; mg.fillText('size →', 4, S - 4); mg.save(); mg.translate(12, 40); mg.rotate(-Math.PI / 2); mg.restore(); mg.fillText('↑ spikes', 4, 12);
  }
  $('#mg-friend').addEventListener('click', () => answer(1));
  $('#mg-grump').addEventListener('click', () => answer(0));
  $('#mg-done').addEventListener('click', () => { if (train.length >= MIN) finishTeach(); });
  $('#mg-retry').addEventListener('click', startTeach);
  $('#mg-next').addEventListener('click', () => { lvl = (lvl + 1) % LEVELS.length; startTeach(); });
  root.querySelectorAll('#mg-lvls button').forEach((b, i) => b.addEventListener('click', () => { lvl = i; startTeach(); }));
  const chk = setInterval(() => { if (!root.isConnected) { clearInterval(timer); clearInterval(chk); } }, 800);
  startTeach();
}
