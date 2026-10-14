// =====================================================================
//  ui.js — HUD, navigation menu, station panels, recruiter mode,
//  joystick and minimap. Works even if the 3D world fails to load.
// =====================================================================
import { SITE, STATIONS, ABOUT, SKILLS, PROJECTS, ACHIEVEMENTS, LINKS, RESUME_URL, ML_STEPS, CHAT } from './data.js?v=10';
import { ask } from './chat.js?v=10';
import { wireLiveLab } from './lab.js?v=10';
import { TASKS } from './tasks.js?v=10';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (u) => (/^(https?:\/\/|mailto:|assets\/)/i.test(u) ? u : '');
const todo = (t) => `<p class="todo">// TODO: ${esc(t)}</p>`;
const tags = (arr) => `<div class="tags">${arr.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>`;

// ---------- section renderers (return HTML) ----------
function educationHTML() {
  const e = SITE.education;
  return `<h3>EDUCATION</h3><p><strong>${esc(e.degree)}</strong><br>${esc(e.school)}<br><span class="muted">${esc(e.years)}</span></p>`;
}

function linksHTML() {
  const items = [];
  if (LINKS.email) items.push(['Email', `mailto:${LINKS.email}`]);
  if (LINKS.github) items.push(['GitHub', LINKS.github]);
  if (LINKS.linkedin) items.push(['LinkedIn', LINKS.linkedin]);
  (LINKS.other || []).forEach((o) => items.push([o.label, o.url]));
  const ok = items.filter(([, u]) => safeUrl(u));
  if (!ok.length) return todo('add your email, GitHub and LinkedIn in data.js (LINKS)');
  return `<div class="links">${ok.map(([l, u]) => `<a href="${esc(safeUrl(u))}" target="_blank" rel="noopener noreferrer">${esc(l)}</a>`).join('')}</div>`;
}

function resumeButtonHTML() {
  return RESUME_URL && safeUrl(RESUME_URL)
    ? `<div class="links"><a href="${esc(RESUME_URL)}" target="_blank" rel="noopener">Open resume</a><a href="${esc(RESUME_URL)}" download>Download resume</a></div>`
    : `<p><button class="btn" disabled>Download resume</button></p>${todo('put your PDF at assets/resume.pdf and set RESUME_URL in data.js')}`;
}

function projectCard(p) {
  const row = (k, v) => (v ? `<dt>${k}</dt><dd>${v}</dd>` : '');
  const links = [];
  if (p.demo && safeUrl(p.demo)) links.push(`<a href="${esc(p.demo)}" target="_blank" rel="noopener noreferrer">Live demo</a>`);
  if (p.github && safeUrl(p.github)) links.push(`<a href="${esc(p.github)}" target="_blank" rel="noopener noreferrer">GitHub</a>`);
  const img = p.image && safeUrl(p.image) ? `<img src="${esc(p.image)}" alt="Screenshot of ${esc(p.title)}" style="max-width:100%;border-radius:8px;margin-top:8px" loading="lazy">` : '';
  return `<article class="card"><h4>${esc(p.title)}<span class="status">${esc(p.status || 'status not set')}</span></h4>
    <p>${esc(p.summary)}</p>${img}
    <dl>${row('PROBLEM', esc(p.problem))}${row('TECHNOLOGIES', p.tech && p.tech.length ? esc(p.tech.join(', ')) : '')}${row('MY CONTRIBUTION', esc(p.contribution))}</dl>
    ${!p.problem || !p.contribution ? todo(`fill in details for "${p.title}" in data.js`) : ''}
    ${links.length ? `<div class="links">${links.join('')}</div>` : ''}</article>`;
}

function achievementsHTML() {
  if (!ACHIEVEMENTS.length) return todo('add only verified certificates, hackathons, results and awards to ACHIEVEMENTS in data.js') + '<p class="muted">Nothing is listed yet. Entries will appear here once added.</p>';
  return ACHIEVEMENTS.map(
    (a) => `<article class="card"><h4>${esc(a.title)}<span class="status">${esc(a.type || '')}</span></h4><p class="muted">${esc([a.issuer, a.date].filter(Boolean).join(' · '))}</p>${a.url && safeUrl(a.url) ? `<div class="links"><a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">View</a></div>` : ''}</article>`
  ).join('');
}

// ---- Digit reader: a small neural network trained offline (model/digits.json), run here in plain JS ----
export function canvasToDigitVec(cv) {
  const W = cv.width, H = cv.height;
  const d = cv.getContext('2d').getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  const side = Math.max(x1 - x0, y1 - y0) + 1;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const mid = document.createElement('canvas'); mid.width = mid.height = 32;
  const mg = mid.getContext('2d'); mg.imageSmoothingEnabled = true; mg.fillStyle = '#000'; mg.fillRect(0, 0, 32, 32);
  const sc = 26 / side; // digit fills ~6 of 8 cells, like the training images
  mg.drawImage(cv, cx - side / 2, cy - side / 2, side, side, 32 / 2 - (side * sc) / 2, 32 / 2 - (side * sc) / 2, side * sc, side * sc);
  const sm = document.createElement('canvas'); sm.width = sm.height = 8;
  const sg = sm.getContext('2d'); sg.imageSmoothingEnabled = true; sg.imageSmoothingQuality = 'high';
  sg.drawImage(mid, 0, 0, 8, 8);
  const p = sg.getImageData(0, 0, 8, 8).data, v = [];
  let mx = 1; for (let i = 0; i < 64; i++) mx = Math.max(mx, p[i * 4]);
  for (let i = 0; i < 64; i++) v.push(Math.min(1, p[i * 4] / mx));
  return v;
}
export function predictDigit(m, v) {
  const h = m.b1.map((b, j) => { let a = b; for (let i = 0; i < 64; i++) a += v[i] * m.W1[i][j]; return Math.max(0, a); });
  const z = m.b2.map((b, k) => { let a = b; for (let j = 0; j < h.length; j++) a += h[j] * m.W2[j][k]; return a; });
  const mz = Math.max(...z), e = z.map((q) => Math.exp(q - mz)), sum = e.reduce((p, q) => p + q, 0);
  return e.map((q) => q / sum);
}

function labHTML() {
  return `<p class="note"><strong>Real experiments, live in your browser.</strong> Everything here is computed on your phone. No fake predictions: each tab says exactly what it is.</p>
  <div class="lab-tabs" id="lab-tabs" role="tablist">
    <button type="button" role="tab" data-t="nn" aria-selected="true">🧠 Watch it learn</button>
    <button type="button" role="tab" data-t="rl" aria-selected="false">🤖 Robot learns</button>
    <button type="button" role="tab" data-t="dg" aria-selected="false">✏️ Digits</button>
    <button type="button" role="tab" data-t="knn" aria-selected="false">🎯 Teach it</button>
    <button type="button" role="tab" data-t="wf" aria-selected="false">📘 How ML works</button>
  </div>

  <section class="lab-pane" data-p="nn">
    <p class="card">A small neural network starts out knowing nothing. Pick a pattern, press <strong>Train</strong>, and watch it reshape the colours until it separates orange from teal. It fits these example points; it is not tested on new ones.</p>
    <div class="lab-tools" id="nn-sets">
      <button type="button" data-k="circles" aria-pressed="true">Circles</button>
      <button type="button" data-k="xor" aria-pressed="false">XOR</button>
      <button type="button" data-k="blobs" aria-pressed="false">Blobs</button>
      <button type="button" data-k="spiral" aria-pressed="false">Spiral</button>
    </div>
    <div class="lab-tools"><button type="button" id="nn-run">▶ Train</button><button type="button" id="nn-reset">Reset</button></div>
    <canvas id="nn-board" width="300" height="300" class="viewer lab-sq" aria-label="Neural network learning a pattern"></canvas>
    <canvas id="nn-loss" width="300" height="50" class="viewer" aria-label="Loss going down over time"></canvas>
    <p id="nn-info" class="card" aria-live="polite"></p>
  </section>

  <section class="lab-pane" data-p="rl" hidden>
    <p class="card">The robot knows nothing about this maze. By trying moves and getting rewards (⭐ good, 🔥 bad, small penalty per step), it learns a route. This is Q-learning, the same idea used in robotics. <strong>Tap a tile to add or remove a wall</strong> and watch it re-learn.</p>
    <div class="lab-tools"><button type="button" id="rl-run">▶ Learn</button><button type="button" id="rl-watch">👀 Watch it go</button><button type="button" id="rl-reset">Reset</button></div>
    <canvas id="rl-board" width="320" height="240" class="viewer lab-sq2" aria-label="Maze where a robot learns by trial and error"></canvas>
    <p id="rl-info" class="card" aria-live="polite"></p>
  </section>

  <section class="lab-pane" data-p="dg" hidden>
    <p id="dg-info" class="card">Loading model…</p>
    <canvas id="dg-board" width="200" height="200" class="viewer" aria-label="Draw a digit from 0 to 9 here"></canvas>
    <div class="lab-tools"><button type="button" id="dg-clear">Clear</button></div>
    <div id="dg-out" class="card" aria-live="polite">Draw a digit (0–9) with your finger. The network guesses as you lift.</div>
  </section>

  <section class="lab-pane" data-p="knn" hidden>
    <p class="card">Tap the board to add Orange or Teal points, switch to <strong>Test</strong> and tap anywhere: a k-nearest-neighbours classifier (k = 3) votes using <em>your</em> points. A teaching toy.</p>
    <div class="lab-tools" id="lab-tools">
      <button type="button" data-m="A" aria-pressed="true">● Orange</button>
      <button type="button" data-m="B" aria-pressed="false">● Teal</button>
      <button type="button" data-m="T" aria-pressed="false">? Test</button>
      <button type="button" data-m="S">Sample</button>
      <button type="button" data-m="C">Clear</button>
    </div>
    <canvas id="lab-board" width="300" height="240" class="viewer" aria-label="Classifier playground board"></canvas>
    <p id="lab-out" class="card" aria-live="polite">Add at least one point of each colour, then tap Test.</p>
  </section>

  <section class="lab-pane" data-p="wf" hidden>
    <h3>MACHINE LEARNING WORKFLOW EXPLORER</h3>
    <div class="steps" id="ml-steps">${ML_STEPS.map(([t], i) => `<button type="button" data-i="${i}" aria-pressed="false">${i + 1}. ${esc(t)}</button>`).join('')}</div>
    <p id="ml-desc" class="card" style="margin-top:10px" aria-live="polite">Select a step to read what happens there.</p>
  </section>`;
}

const RENDER = {
  about: () => ({
    html: `<p>${esc(ABOUT.intro)}</p>${educationHTML()}
      <h3>INTERESTS</h3>${tags(ABOUT.interests)}
      <h3>LEARNING JOURNEY</h3>${ABOUT.journey.length ? ABOUT.journey.map((j) => `<p><strong>${esc(j.when)}</strong> ${esc(j.what)}</p>`).join('') : todo('add your learning journey (ABOUT.journey)')}
      <h3>APPROACH TO PROBLEMS</h3>${ABOUT.approach ? `<p>${esc(ABOUT.approach)}</p>` : todo('add a sentence or two (ABOUT.approach)')}
      <h3>CURRENT LEARNING GOALS</h3>${ABOUT.goals.length ? tags(ABOUT.goals) : todo('add your goals (ABOUT.goals)')}`,
  }),
  lab: () => ({ html: labHTML(), after: wireLab }),
  projects: () => ({
    html: `<h3>3D MODEL · ESP32 LINE FOLLOWER</h3>
      <canvas id="lf-canvas" class="viewer" aria-label="Rotatable 3D model of the ESP32 line-follower robot"></canvas>
      <p class="muted" id="lf-note">Drag to rotate. The robot follows a full circle track. A hand-built 3D look-alike of my real robot (ESP32, ultrasonic sensor on a servo, 3 IR sensors, 2 Li-ion cells), so small details differ.</p>
      ${PROJECTS.map(projectCard).join('')}`,
    after: wireViewer,
  }),
  achievements: () => ({ html: achievementsHTML() }),
  resume: () => ({
    html: `<div class="terminal"><p>&gt; access resume</p><p>&gt; ${esc(SITE.name)}</p><p>&gt; ${esc(SITE.role)}</p></div>
      ${educationHTML()}<h3>SKILLS</h3>${SKILLS.length ? tags(SKILLS) : todo('add verified skills (SKILLS)')}
      <h3>PROJECTS</h3>${tags(PROJECTS.map((p) => p.title))}
      <h3>ACHIEVEMENTS</h3>${ACHIEVEMENTS.length ? tags(ACHIEVEMENTS.map((a) => a.title)) : '<p class="muted">None listed yet.</p>'}
      <h3>RESUME FILE</h3>${resumeButtonHTML()}<h3>LINKS</h3>${linksHTML()}`,
  }),
  contact: () => ({
    html: `<p>Reach out directly using the links below.</p>${linksHTML()}
      <p class="muted" style="margin-top:12px">There is no message form on this site; it would need a configured email service or backend.</p>`,
  }),
  recruiter: () => ({
    title: 'RECRUITER MODE',
    html: `<p><strong>${esc(SITE.name)}</strong><br>${esc(SITE.role)}</p><p>${esc(SITE.summary)}</p>${educationHTML()}
      <h3>VERIFIED SKILLS</h3>${SKILLS.length ? tags(SKILLS) : todo('add verified skills (SKILLS)')}
      <h3>PROJECTS</h3>${PROJECTS.map(projectCard).join('')}
      <h3>ACHIEVEMENTS</h3>${achievementsHTML()}
      <h3>RESUME</h3>${resumeButtonHTML()}<h3>CONTACT</h3>${linksHTML()}`,
  }),
};

let viewer = null;
function disposeViewer() {
  if (viewer) {
    try { viewer.dispose(); } catch (e) { /* ignore */ }
    viewer = null;
  }
}
function wireViewer(root) {
  const c = root.querySelector('#lf-canvas');
  if (!c) return;
  import('./model.js?v=10')
    .then((m) => {
      if (!c.isConnected) return;
      viewer = m.createModelViewer(c);
    })
    .catch(() => {
      c.hidden = true;
      const n = root.querySelector('#lf-note');
      if (n) n.textContent = 'The 3D model could not load on this device (WebGL or the 3D library is unavailable).';
    });
}

function wireLab(root) {
  const tabs = root.querySelectorAll('#lab-tabs button'), panes = root.querySelectorAll('.lab-pane');
  tabs.forEach((t) => t.addEventListener('click', () => {
    root.dispatchEvent(new Event('lab-hide'));
    tabs.forEach((x) => x.setAttribute('aria-selected', String(x === t)));
    panes.forEach((p) => { p.hidden = p.dataset.p !== t.dataset.t; });
  }));
  wireLiveLab(root);
  const desc = root.querySelector('#ml-desc');
  root.querySelectorAll('#ml-steps button').forEach((b) =>
    b.addEventListener('click', () => {
      root.querySelectorAll('#ml-steps button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      const [t, d] = ML_STEPS[+b.dataset.i];
      desc.innerHTML = `<strong>${esc(t)}</strong><br>${esc(d)}`;
    })
  );
  // ---- digit reader ----
  (function digitReader() {
    const bd = root.querySelector('#dg-board'), info = root.querySelector('#dg-info'), dout = root.querySelector('#dg-out');
    if (!bd) return;
    const dg = bd.getContext('2d');
    let model = null, drawing = false, last = null;
    const wipe = () => { dg.fillStyle = '#000'; dg.fillRect(0, 0, 200, 200); };
    wipe();
    fetch('model/digits.json?v=10').then((r) => r.json()).then((m) => {
      model = m;
      info.innerHTML = `<strong>${esc(m.name)}</strong><br>Trained offline on ${esc(m.dataset)}. Held-out accuracy on ${m.testSamples} unseen test images from that dataset: <strong>${(m.heldOutAccuracy * 100).toFixed(1)}%</strong>. When I redrew those test digits on a canvas and ran them through this page's drawing pipeline, it got about 91%, and real finger drawings can differ.`;
    }).catch(() => { info.textContent = 'The model file could not be loaded (model/digits.json missing).'; });
    const pos = (e) => { const r = bd.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 200, ((e.clientY - r.top) / r.height) * 200]; };
    bd.addEventListener('pointerdown', (e) => { drawing = true; last = pos(e); bd.setPointerCapture(e.pointerId); dg.fillStyle = '#fff'; dg.beginPath(); dg.arc(last[0], last[1], 7, 0, 7); dg.fill(); });
    bd.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      const p = pos(e); dg.strokeStyle = '#fff'; dg.lineWidth = 14; dg.lineCap = 'round'; dg.beginPath(); dg.moveTo(last[0], last[1]); dg.lineTo(p[0], p[1]); dg.stroke(); last = p;
    });
    const end = () => {
      if (!drawing) return; drawing = false;
      if (!model) return;
      const v = canvasToDigitVec(bd); if (!v) return;
      const pr = predictDigit(model, v), top = pr.indexOf(Math.max(...pr));
      dout.innerHTML = `<strong>I think it is a ${top}</strong> (${(pr[top] * 100).toFixed(0)}% confident)<div class="bars">${pr.map((q, i) => `<span class="${i === top ? 'top' : ''}"><i style="height:${Math.max(2, q * 100)}%"></i><b>${i}</b></span>`).join('')}</div>`;
    };
    bd.addEventListener('pointerup', end); bd.addEventListener('pointercancel', end);
    root.querySelector('#dg-clear').addEventListener('click', () => { wipe(); dout.textContent = 'Draw a digit (0–9) with your finger. The network guesses as you lift.'; });
  })();
  // ---- k-NN playground (real computation on the user's own points) ----
  const cv = root.querySelector('#lab-board');
  const out = root.querySelector('#lab-out');
  if (!cv) return;
  const g = cv.getContext('2d');
  const W = cv.width, H = cv.height, K = 3;
  const COL = { A: [255, 154, 60], B: [57, 217, 184] };
  let pts = [], mode = 'A', test = null;
  const classify = (x, y) => {
    const near = pts.map((p) => ({ c: p.c, d: (p.x - x) ** 2 + (p.y - y) ** 2 })).sort((m, n) => m.d - n.d).slice(0, K);
    const a = near.filter((n) => n.c === 'A').length;
    return { label: a * 2 > near.length ? 'A' : 'B', a, n: near.length };
  };
  const ready = () => pts.some((p) => p.c === 'A') && pts.some((p) => p.c === 'B');
  function draw() {
    g.fillStyle = '#1d1442';
    g.fillRect(0, 0, W, H);
    if (ready()) {
      const step = 10;
      for (let y = 0; y < H; y += step)
        for (let x = 0; x < W; x += step) {
          const r = classify(x + step / 2, y + step / 2);
          const c = COL[r.label];
          g.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},.22)`;
          g.fillRect(x, y, step, step);
        }
    }
    pts.forEach((p) => {
      const c = COL[p.c];
      g.beginPath();
      g.arc(p.x, p.y, 7, 0, 7);
      g.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      g.fill();
      g.strokeStyle = '#fff';
      g.lineWidth = 1.5;
      g.stroke();
    });
    if (test) {
      g.beginPath();
      g.arc(test.x, test.y, 10, 0, 7);
      g.strokeStyle = '#fff';
      g.lineWidth = 3;
      g.setLineDash([4, 3]);
      g.stroke();
      g.setLineDash([]);
    }
  }
  const name = (l) => (l === 'A' ? 'Orange' : 'Teal');
  cv.addEventListener('pointerdown', (e) => {
    const r = cv.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
    if (mode === 'T') {
      if (!ready()) { out.textContent = 'Add at least one Orange and one Teal point first.'; return; }
      test = { x, y };
      const res = classify(x, y);
      const votes = res.label === 'A' ? res.a : res.n - res.a;
      out.innerHTML = `<strong>Prediction: ${name(res.label)}</strong><br>${votes} of the ${res.n} nearest points are ${name(res.label)}. (k-NN, computed live from your points.)`;
    } else pts.push({ x, y, c: mode });
    draw();
  });
  root.querySelectorAll('#lab-tools button').forEach((b) =>
    b.addEventListener('click', () => {
      const m = b.dataset.m;
      if (m === 'C') { pts = []; test = null; out.textContent = 'Board cleared. Add Orange and Teal points.'; }
      else if (m === 'S') {
        pts = []; test = null;
        for (let i = 0; i < 8; i++) {
          pts.push({ x: 60 + Math.random() * 70, y: 50 + Math.random() * 130, c: 'A' });
          pts.push({ x: 170 + Math.random() * 70, y: 50 + Math.random() * 130, c: 'B' });
        }
        out.textContent = 'Random sample points added (not real data). Switch to Test and tap anywhere.';
      } else {
        mode = m;
        root.querySelectorAll('#lab-tools button[aria-pressed]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        if (m !== 'T') test = null;
      }
      draw();
    })
  );
  draw();
}

// ---------- UI controller ----------
export function initUI() {
  let world = null;
  let lastFocus = null;
  let nearbyId = null;
  const touch = matchMedia('(pointer:coarse)').matches;
  if (touch) document.body.classList.add('touch');

  const panel = $('#panel');
  const backdrop = $('#panel-backdrop');
  const menu = $('#nav-menu');
  const menuBtn = $('#menu-btn');
  const prompt = $('#prompt');
  const chat = $('#chat');
  const intro = $('#intro');

  // The car is locked while the intro, a panel or the chat is open.
  const syncLock = () => {
    if (!world) return;
    const started = document.body.classList.contains('started');
    world.setIntro(!started);
    world.setLocked(!started || !backdrop.hidden || !chat.hidden);
  };

  // ----- navigation menu (works without 3D) -----
  $('#nav-list').innerHTML = STATIONS.map((s) => `<li><button type="button" data-id="${s.id}"><i style="background:${s.css}"></i>${esc(s.label)}</button></li>`).join('');
  $('#nav-list').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-id]');
    if (b) {
      toggleMenu(false);
      openStation(b.dataset.id);
    }
  });
  function toggleMenu(force) {
    const show = force ?? menu.hidden;
    menu.hidden = !show;
    menuBtn.setAttribute('aria-expanded', String(show));
    if (show) menu.querySelector('button').focus();
  }
  menuBtn.addEventListener('click', () => toggleMenu());
  $('#nav-intro').addEventListener('click', () => {
    document.body.classList.remove('started');
    toggleMenu(false);
    syncLock();
  });

  function start() {
    document.body.classList.add('started');
    syncLock();
    const hint = $('#hint');
    if (!touch) {
      hint.hidden = false;
      hint.classList.remove('fade');
      setTimeout(() => hint.classList.add('fade'), 9000);
    }
    $('#world').focus();
  }
  $('#start-btn').addEventListener('click', start);
  $('#intro-recruiter').addEventListener('click', () => openStation('recruiter'));
  $('#recruiter-btn').addEventListener('click', () => openStation('recruiter'));

  // ----- station panels -----
  const unlocked = new Set();
  let taskCleanup = null;
  const clearPanel = () => {
    if (taskCleanup) { try { taskCleanup(); } catch (e) { /* ignore */ } taskCleanup = null; }
    disposeViewer();
  };
  function showInfo(id) {
    const def = STATIONS.find((s) => s.id === id);
    const out = RENDER[id]();
    clearPanel();
    $('#panel-title').textContent = out.title || def.label;
    panel.style.setProperty('--accent', def ? def.css : '#ff6b57');
    $('#panel-body').innerHTML = out.html;
    out.after && out.after($('#panel-body'));
    panel.scrollTop = 0;
  }
  function openStation(id) {
    if (!RENDER[id]) return;
    const def = STATIONS.find((s) => s.id === id);
    if (backdrop.hidden) lastFocus = document.activeElement;
    clearPanel();
    const task = TASKS[id];
    if (id === 'recruiter' || unlocked.has(id) || !task) {
      showInfo(id);
    } else {
      $('#panel-title').textContent = 'TASK · ' + def.label;
      panel.style.setProperty('--accent', def.css);
      const body = $('#panel-body');
      body.innerHTML = `<h3 class="task-title">${esc(task.title)}</h3><p class="muted">${esc(task.hint)}</p>`;
      const box = document.createElement('div');
      box.className = 'task-box';
      body.appendChild(box);
      const skip = document.createElement('button');
      skip.type = 'button';
      skip.className = 'btn ghost';
      skip.textContent = 'Skip task';
      body.appendChild(skip);
      const finish = () => { unlocked.add(id); showInfo(id); };
      taskCleanup = task.run(box, finish);
      skip.addEventListener('click', finish);
    }
    backdrop.hidden = false;
    syncLock();
    panel.focus();
  }
  function closePanel() {
    if (backdrop.hidden) return;
    clearPanel();
    backdrop.hidden = true;
    syncLock();
    lastFocus && lastFocus.focus && lastFocus.focus();
  }
  $('#panel-close').addEventListener('click', closePanel);
  backdrop.addEventListener('pointerdown', (e) => {
    if (e.target === backdrop) closePanel();
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!backdrop.hidden) closePanel();
      else if (!chat.hidden) toggleChat(false);
      else if (!menu.hidden) toggleMenu(false);
    }
    if (e.key === 'Tab' && !backdrop.hidden) {
      const f = [...panel.querySelectorAll('button:not([disabled]),a[href],input:not([disabled])')];
      if (!f.length) return;
      const first = f[0];
      const lastEl = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        lastEl.focus();
        e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        first.focus();
        e.preventDefault();
      }
    }
  });

  // ----- proximity prompt -----
  function setNearby(id) {
    nearbyId = id;
    if (!id) {
      prompt.hidden = true;
      return;
    }
    const def = STATIONS.find((s) => s.id === id);
    prompt.style.setProperty('--accent', def.css);
    prompt.textContent = touch ? `Open ${def.label}` : `Press E · ${def.label}`;
    prompt.hidden = false;
  }

  // ----- chat -----
  const log = $('#chat-log');
  const chips = $('#chat-chips');
  let greeted = false;
  function addMsg(text, who, actions = [], note = '') {
    const d = document.createElement('div');
    d.className = 'msg ' + who;
    d.textContent = text;
    if (actions.length) {
      const a = document.createElement('div');
      a.className = 'acts';
      actions.forEach((x) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = x.label;
        b.addEventListener('click', () => openStation(x.id));
        a.appendChild(b);
      });
      d.appendChild(a);
    }
    if (note) {
      const s = document.createElement('small');
      s.textContent = note;
      d.appendChild(s);
    }
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  }
  chips.innerHTML = '';
  CHAT.suggestions.forEach((q) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = q;
    b.addEventListener('click', () => send(q));
    chips.appendChild(b);
  });
  async function send(text) {
    text = (text || '').trim();
    if (!text) return;
    addMsg(text, 'me');
    $('#chat-input').value = '';
    const r = await ask(text);
    addMsg(r.text, 'bot', r.actions, r.source === 'rules' ? 'Rule-based answer from portfolio data' : '');
  }
  $('#chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    send($('#chat-input').value);
  });
  function toggleChat(force) {
    const show = force ?? chat.hidden;
    chat.hidden = !show;
    $('#chat-btn').setAttribute('aria-expanded', String(show));
    if (show) {
      toggleMenu(false);
      if (!greeted) {
        greeted = true;
        $('#chat-sub').textContent = CHAT.endpoint ? 'AI-assisted via a backend · may make mistakes' : 'Rule-based · answers only from this portfolio';
        addMsg(`Woof! I'm Byte, the robot dog who follows you around ${SITE.name}'s world. I'm a simple rule-based helper, not a large language model, so I answer only from the information on this site. What would you like to know?`, 'bot');
      }
      $('#chat-input').focus();
    }
    syncLock();
  }
  $('#chat-btn').addEventListener('click', () => toggleChat());
  $('#chat-close').addEventListener('click', () => toggleChat(false));

  // ----- touch driving controls -----
  const joy = $('#joystick');
  const stick = $('#stick');
  let joyId = null;
  const setStick = (dx, dy) => (stick.style.transform = `translate(${dx}px,${dy}px)`);
  const joyMove = (e) => {
    const r = joy.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const max = r.width / 2 - 12;
    const l = Math.hypot(dx, dy);
    if (l > max) {
      dx *= max / l;
      dy *= max / l;
    }
    setStick(dx, dy);
    const nx = dx / max;
    const ny = -dy / max;
    const dead = Math.hypot(nx, ny) < 0.14;
    world && world.setJoystick(dead ? 0 : nx, dead ? 0 : ny);
  };
  joy.addEventListener('pointerdown', (e) => {
    joyId = e.pointerId;
    joy.setPointerCapture(joyId);
    joyMove(e);
  });
  joy.addEventListener('pointermove', (e) => e.pointerId === joyId && joyMove(e));
  const joyEnd = (e) => {
    if (e.pointerId !== joyId) return;
    joyId = null;
    setStick(0, 0);
    world && world.setJoystick(0, 0);
  };
  joy.addEventListener('pointerup', joyEnd);
  joy.addEventListener('pointercancel', joyEnd);
  const hold = (sel, fn) => {
    const el = $(sel);
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      fn(true);
    });
    ['pointerup', 'pointercancel'].forEach((ev) => el.addEventListener(ev, () => fn(false)));
  };
  hold('#run-btn', (v) => world && world.setRun(v));
  // pointer-based buttons (work while another finger holds the joystick)
  const flyBtn = $('#fly-btn');
  const downBtn = $('#down-btn');
  const jumpBtn = $('#jump-btn');
  const guard = (el) => {
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('click', (e) => e.preventDefault());
  };
  const holdBtn = (el, fn) => {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      fn(true);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => el.addEventListener(ev, () => fn(false)));
    guard(el);
  };
  const tapBtn = (el, fn) => {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      fn();
    });
    guard(el);
  };
  holdBtn($('#run-btn'), (v) => world && world.setRun(v));
  holdBtn(jumpBtn, (v) => {
    if (!world) return;
    world.setJumpHold(v);
    if (v) world.jump();
  });
  holdBtn(downBtn, (v) => world && world.setDownHold(v));
  tapBtn(flyBtn, () => world && world.toggleFly());
  tapBtn(prompt, () => nearbyId && openStation(nearbyId));
  const setFlying = (v) => {
    flyBtn.setAttribute('aria-pressed', String(v));
    flyBtn.textContent = v ? '🚀 Flying' : '🚀 Fly';
    $('#fly-actions').classList.toggle('on', v);
    jumpBtn.textContent = v ? '⤒' : '⤒';
    jumpBtn.setAttribute('aria-label', v ? 'Fly up' : 'Jump');
    document.body.classList.toggle('flying', v);
  };
  document.querySelectorAll('.round, .prompt, #joystick').forEach((el) => el.addEventListener('contextmenu', (e) => e.preventDefault()));

  // ----- pause / reset / graphics -----
  const pauseOv = $('#pause-overlay');
  const setPaused = (v) => {
    pauseOv.hidden = !v;
    world && world.setFrozen(v);
    $('#pause-btn').textContent = v ? 'Resume' : 'Pause';
    if (v) {
      toggleMenu(false);
      $('#resume-btn').focus();
    }
  };
  $('#pause-btn').addEventListener('click', () => setPaused(pauseOv.hidden));
  $('#resume-btn').addEventListener('click', () => setPaused(false));
  addEventListener('keydown', (e) => {
    if (e.code === 'KeyP' && !/^(INPUT|TEXTAREA)$/.test(e.target.tagName) && world) setPaused(pauseOv.hidden);
  });
  $('#reset-btn').addEventListener('click', () => {
    world && world.reset();
    toggleMenu(false);
  });
  const modes = ['auto', 'high', 'low'];
  let mode = 0;
  function setQualityLabel(actual) {
    const m = modes[mode];
    $('#quality-btn').textContent = `Graphics: ${m === 'auto' ? 'Auto' + (actual ? ` (${actual})` : '') : m === 'high' ? 'High' : 'Low'}`;
  }
  $('#quality-btn').addEventListener('click', () => {
    mode = (mode + 1) % 3;
    world && world.setQuality(modes[mode]);
  });

  // ----- minimap -----
  const mm = $('#minimap');
  const g = mm.getContext('2d');
  function drawMap() {
    if (!world || mm.offsetParent === null) return;
    const s = world.getState();
    const W = mm.width;
    const c = W / 2;
    const k = (c - 12) / s.worldRadius;
    g.clearRect(0, 0, W, W);
    g.fillStyle = '#3a2a82';
    g.beginPath();
    g.arc(c, c, c - 4, 0, 7);
    g.fill();
    g.strokeStyle = '#ffd0f0';
    g.lineWidth = 5;
    g.stroke();
    g.strokeStyle = 'rgba(125,240,255,.7)';
    g.lineWidth = 3;
    (s.bridges || []).forEach(([ax, az, bx, bz]) => {
      g.beginPath();
      g.moveTo(c + ax * k, c + az * k);
      g.lineTo(c + bx * k, c + bz * k);
      g.stroke();
    });
    g.fillStyle = 'rgba(190,170,255,.55)';
    (s.islands || []).forEach((i) => {
      g.beginPath();
      g.arc(c + i.x * k, c + i.z * k, Math.max(5, i.r * k), 0, 7);
      g.fill();
    });
    s.stations.forEach((st) => {
      g.fillStyle = st.css;
      g.beginPath();
      g.arc(c + st.x * k, c + st.z * k, st.id === s.nearby ? 13 : 9, 0, 7);
      g.fill();
      g.strokeStyle = '#fff';
      g.lineWidth = 3;
      g.stroke();
    });
    g.save();
    g.translate(c + s.x * k, c + s.z * k);
    g.rotate(Math.PI - s.heading);
    g.fillStyle = '#ff7ab8';
    g.strokeStyle = '#fff';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, -14);
    g.lineTo(10, 10);
    g.lineTo(-10, 10);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }
  setInterval(drawMap, 100);

  function portalFx(css) {
    const el = document.getElementById("warp-flash");
    if (!el) return;
    el.style.setProperty("--c", css || "#fff");
    el.classList.remove("go");
    void el.offsetWidth;
    el.classList.add("go");
  }

  return {
    portalFx,
    setNearby,
    openStation,
    openChat: () => toggleChat(true),
    setQualityLabel: (actual) => setQualityLabel(actual),
    setFlying,
    attachWorld(w) {
      world = w;
      w.setQuality('auto');
      syncLock();
    },
    hideLoading() {
      $('#loading').classList.add('done');
    },
    showFallback(msg) {
      $('#loading').classList.add('done');
      const f = $('#fallback');
      f.textContent = msg;
      f.hidden = false;
      document.body.classList.add('started');
      toggleMenu(true);
    },
  };
}
