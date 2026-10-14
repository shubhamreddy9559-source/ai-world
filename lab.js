// lab.js — two live, real mini-experiments for the AI/ML Lab. Everything is computed in the browser.
// 1) A small neural network that visibly learns a pattern (backprop + Adam, written from scratch).
// 2) A robot that learns a maze by trial and error (tabular Q-learning).

const ORANGE = [255, 154, 60], TEAL = [57, 217, 184];
const rnd = (a = 1) => (Math.random() * 2 - 1) * a;
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2832 * v); };

// ---------------- datasets ----------------
export function makeData(kind, n = 160) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const c = i % 2;
    let x, y;
    if (kind === 'circles') { const r = c ? 0.62 + Math.random() * 0.3 : Math.random() * 0.38, a = Math.random() * 6.283; x = r * Math.cos(a); y = r * Math.sin(a); }
    else if (kind === 'xor') { x = rnd(0.9); y = rnd(0.9); const s = x * y > 0 ? 1 : 0; pts.push({ x: x + gauss() * 0.03, y: y + gauss() * 0.03, c: s }); continue; }
    else if (kind === 'spiral') { const t = 0.2 + (Math.floor(i / 2) / (n / 2)) * 0.8, a = t * 3.6 * Math.PI + c * Math.PI; x = t * 0.95 * Math.cos(a) + gauss() * 0.03; y = t * 0.95 * Math.sin(a) + gauss() * 0.03; }
    else { x = (c ? 0.45 : -0.45) + gauss() * 0.2; y = (c ? 0.35 : -0.35) + gauss() * 0.2; }
    pts.push({ x, y, c });
  }
  return pts;
}

// ---------------- tiny neural network ----------------
const feats = (x, y) => [x, y, x * x, y * y, x * y, Math.sin(3 * x), Math.sin(3 * y)];
export class Net {
  constructor(sizes = [7, 8, 6, 1]) {
    this.sizes = sizes;
    this.W = []; this.b = []; this.mW = []; this.vW = []; this.mb = []; this.vb = [];
    for (let l = 1; l < sizes.length; l++) {
      const i = sizes[l - 1], o = sizes[l], s = Math.sqrt(2 / (i + o));
      this.W.push(Array.from({ length: o }, () => Array.from({ length: i }, () => gauss() * s)));
      this.b.push(new Array(o).fill(0));
      this.mW.push(Array.from({ length: o }, () => new Array(i).fill(0)));
      this.vW.push(Array.from({ length: o }, () => new Array(i).fill(0)));
      this.mb.push(new Array(o).fill(0)); this.vb.push(new Array(o).fill(0));
    }
    this.t = 0;
  }
  forward(inp) {
    const acts = [inp];
    let a = inp;
    for (let l = 0; l < this.W.length; l++) {
      const last = l === this.W.length - 1;
      a = this.W[l].map((row, j) => { let s = this.b[l][j]; for (let i = 0; i < row.length; i++) s += row[i] * a[i]; return last ? 1 / (1 + Math.exp(-s)) : Math.tanh(s); });
      acts.push(a);
    }
    return acts;
  }
  predict(x, y) { return this.forward(feats(x, y)).pop()[0]; }
  // one full-batch Adam step; returns { loss, acc }
  step(data, lr = 0.03) {
    const L = this.W.length;
    const gW = this.W.map((m) => m.map((r) => new Array(r.length).fill(0)));
    const gb = this.b.map((r) => new Array(r.length).fill(0));
    let loss = 0, ok = 0;
    for (const p of data) {
      const acts = this.forward(feats(p.x, p.y));
      const out = acts[L][0];
      loss += -(p.c * Math.log(out + 1e-9) + (1 - p.c) * Math.log(1 - out + 1e-9));
      if ((out > 0.5 ? 1 : 0) === p.c) ok++;
      let delta = [out - p.c];
      for (let l = L - 1; l >= 0; l--) {
        const prev = acts[l];
        for (let j = 0; j < delta.length; j++) { gb[l][j] += delta[j]; for (let i = 0; i < prev.length; i++) gW[l][j][i] += delta[j] * prev[i]; }
        if (l > 0) {
          const nd = new Array(prev.length).fill(0);
          for (let i = 0; i < prev.length; i++) { let s = 0; for (let j = 0; j < delta.length; j++) s += this.W[l][j][i] * delta[j]; nd[i] = s * (1 - prev[i] * prev[i]); }
          delta = nd;
        }
      }
    }
    this.t++;
    const n = data.length, b1 = 0.9, b2 = 0.999, c1 = 1 - Math.pow(b1, this.t), c2 = 1 - Math.pow(b2, this.t);
    for (let l = 0; l < L; l++) for (let j = 0; j < this.W[l].length; j++) {
      for (let i = 0; i < this.W[l][j].length; i++) {
        const g = gW[l][j][i] / n;
        this.mW[l][j][i] = b1 * this.mW[l][j][i] + (1 - b1) * g; this.vW[l][j][i] = b2 * this.vW[l][j][i] + (1 - b2) * g * g;
        this.W[l][j][i] -= (lr * (this.mW[l][j][i] / c1)) / (Math.sqrt(this.vW[l][j][i] / c2) + 1e-8);
      }
      const g = gb[l][j] / n;
      this.mb[l][j] = b1 * this.mb[l][j] + (1 - b1) * g; this.vb[l][j] = b2 * this.vb[l][j] + (1 - b2) * g * g;
      this.b[l][j] -= (lr * (this.mb[l][j] / c1)) / (Math.sqrt(this.vb[l][j] / c2) + 1e-8);
    }
    return { loss: loss / n, acc: ok / n };
  }
}

// ---------------- Q-learning maze ----------------
export class Maze {
  constructor(cols = 8, rows = 6) {
    this.cols = cols; this.rows = rows;
    this.start = [0, rows - 1]; this.goal = [cols - 1, 0];
    this.walls = new Set(['3,5', '3,4', '3,3', '5,0', '5,1', '5,2', '1,1', '2,1']);
    this.lava = new Set(['4,5', '6,3', '6,4']);
    this.reset();
  }
  reset() { this.Q = Array.from({ length: this.cols * this.rows }, () => [0, 0, 0, 0]); this.episodes = 0; this.hist = []; this.eps = 0.35; }
  idx(x, y) { return y * this.cols + x; }
  key(x, y) { return x + ',' + y; }
  step(x, y, a) {
    const dx = [0, 1, 0, -1][a], dy = [-1, 0, 1, 0][a];
    let nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows || this.walls.has(this.key(nx, ny))) { nx = x; ny = y; return { nx, ny, r: -0.1, done: false }; }
    if (this.lava.has(this.key(nx, ny))) return { nx, ny, r: -1, done: true };
    if (nx === this.goal[0] && ny === this.goal[1]) return { nx, ny, r: 1, done: true };
    return { nx, ny, r: -0.04, done: false };
  }
  best(x, y) { const q = this.Q[this.idx(x, y)]; let b = 0; for (let a = 1; a < 4; a++) if (q[a] > q[b] + 1e-9) b = a; return b; }
  episode(explore = true) {
    let [x, y] = this.start, steps = 0, reward = 0, reached = false;
    while (steps < 80) {
      const a = explore && Math.random() < this.eps ? Math.floor(Math.random() * 4) : this.best(x, y);
      const { nx, ny, r, done } = this.step(x, y, a);
      const qn = done ? 0 : Math.max(...this.Q[this.idx(nx, ny)]);
      const q = this.Q[this.idx(x, y)];
      q[a] += 0.5 * (r + 0.95 * qn - q[a]);
      x = nx; y = ny; steps++; reward += r;
      if (done) { reached = x === this.goal[0] && y === this.goal[1]; break; }
    }
    if (explore) { this.episodes++; this.eps = Math.max(0.05, this.eps * 0.995); this.hist.push(reached ? 1 : 0); if (this.hist.length > 60) this.hist.shift(); }
    return { steps, reward, reached };
  }
  greedyPath() {
    let [x, y] = this.start; const path = [[x, y]];
    for (let i = 0; i < 40; i++) {
      const a = this.best(x, y), { nx, ny, done } = this.step(x, y, a);
      if (nx === x && ny === y) break;
      x = nx; y = ny; path.push([x, y]);
      if (done) break;
    }
    return path;
  }
}

// ---------------- UI wiring ----------------
export function wireLiveLab(root) {
  const $ = (s) => root.querySelector(s);
  // ===== neural network playground =====
  const nc = $('#nn-board');
  if (nc) {
    const g = nc.getContext('2d'), S = nc.width, cell = 10;
    let kind = 'circles', data = makeData(kind), net = new Net(), run = false, raf = 0, epoch = 0, hist = [];
    const info = $('#nn-info'), chart = $('#nn-loss').getContext('2d');
    const draw = (loss, acc) => {
      for (let cy = 0; cy < S; cy += cell) for (let cx = 0; cx < S; cx += cell) {
        const p = net.predict(((cx + cell / 2) / S) * 2 - 1, ((cy + cell / 2) / S) * 2 - 1);
        const a = p > 0.5 ? TEAL : ORANGE, k = 0.12 + Math.abs(p - 0.5) * 0.7;
        g.fillStyle = `rgba(${a[0]},${a[1]},${a[2]},${k})`; g.fillRect(cx, cy, cell, cell);
      }
      g.fillStyle = 'rgba(29,20,66,.0)';
      data.forEach((p) => { const c = p.c ? TEAL : ORANGE; g.beginPath(); g.arc(((p.x + 1) / 2) * S, ((p.y + 1) / 2) * S, 4, 0, 7); g.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.stroke(); });
      if (loss != null) info.innerHTML = `Epoch <strong>${epoch}</strong> · loss <strong>${loss.toFixed(3)}</strong> · accuracy on these points <strong>${(acc * 100).toFixed(0)}%</strong>`;
      chart.fillStyle = '#1d1442'; chart.fillRect(0, 0, 300, 50);
      chart.strokeStyle = '#7df0ff'; chart.lineWidth = 2; chart.beginPath();
      hist.forEach((v, i) => { const x = (i / Math.max(1, hist.length - 1)) * 296 + 2, y = 46 - Math.min(1, v / 0.8) * 42; i ? chart.lineTo(x, y) : chart.moveTo(x, y); });
      chart.stroke();
    };
    const reset = () => { net = new Net(); epoch = 0; hist = []; draw(null); info.textContent = 'Press Train and watch the network carve out the pattern.'; };
    const loop = () => {
      if (!run) return;
      let r; for (let i = 0; i < 4; i++) { r = net.step(data); epoch++; }
      hist.push(r.loss); if (hist.length > 150) hist.shift();
      draw(r.loss, r.acc);
      raf = requestAnimationFrame(loop);
    };
    $('#nn-run').addEventListener('click', (e) => { run = !run; e.target.textContent = run ? '⏸ Pause' : '▶ Train'; if (run) loop(); });
    $('#nn-reset').addEventListener('click', reset);
    root.querySelectorAll('#nn-sets button').forEach((b) => b.addEventListener('click', () => {
      kind = b.dataset.k; data = makeData(kind); root.querySelectorAll('#nn-sets button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); reset();
    }));
    reset();
    root.addEventListener('lab-hide', () => { run = false; cancelAnimationFrame(raf); const r = $('#nn-run'); if (r) r.textContent = '▶ Train'; });
  }
  // ===== robot learns a maze =====
  const mc = $('#rl-board');
  if (mc) {
    const m = new Maze(), g = mc.getContext('2d'), W = mc.width, H = mc.height, cw = W / m.cols, ch = H / m.rows;
    const info = $('#rl-info');
    let run = false, raf = 0, bot = null, watch = null;
    const draw = () => {
      g.fillStyle = '#1d1442'; g.fillRect(0, 0, W, H);
      let mx = 0.01; m.Q.forEach((q) => { mx = Math.max(mx, Math.max(...q)); });
      for (let y = 0; y < m.rows; y++) for (let x = 0; x < m.cols; x++) {
        const k = m.key(x, y), px = x * cw, py = y * ch;
        if (m.walls.has(k)) { g.fillStyle = '#4a3a90'; g.fillRect(px + 1, py + 1, cw - 2, ch - 2); continue; }
        if (m.lava.has(k)) { g.fillStyle = '#ff5a3c'; g.fillRect(px + 1, py + 1, cw - 2, ch - 2); g.fillStyle = '#fff'; g.font = '16px sans-serif'; g.textAlign = 'center'; g.fillText('🔥', px + cw / 2, py + ch / 2 + 6); continue; }
        const v = Math.max(0, Math.max(...m.Q[m.idx(x, y)])) / mx;
        g.fillStyle = `rgba(57,217,184,${0.08 + v * 0.55})`; g.fillRect(px + 1, py + 1, cw - 2, ch - 2);
        if (m.episodes > 0 && !(x === m.goal[0] && y === m.goal[1])) {
          const a = m.best(x, y), q = m.Q[m.idx(x, y)];
          if (Math.max(...q) !== 0) { g.fillStyle = 'rgba(255,255,255,.75)'; g.font = '14px sans-serif'; g.textAlign = 'center'; g.fillText(['↑', '→', '↓', '←'][a], px + cw / 2, py + ch / 2 + 5); }
        }
      }
      g.font = '22px sans-serif'; g.textAlign = 'center';
      g.fillText('⭐', m.goal[0] * cw + cw / 2, m.goal[1] * ch + ch / 2 + 8);
      const b = bot || m.start; g.fillText('🤖', b[0] * cw + cw / 2, b[1] * ch + ch / 2 + 8);
      const rate = m.hist.length ? Math.round((m.hist.reduce((p, q) => p + q, 0) / m.hist.length) * 100) : 0;
      info.innerHTML = `Episodes <strong>${m.episodes}</strong> · reached ⭐ in <strong>${rate}%</strong> of the last ${m.hist.length} tries · curiosity (random moves) <strong>${Math.round(m.eps * 100)}%</strong>`;
    };
    const loop = () => { if (!run) return; for (let i = 0; i < 6; i++) m.episode(true); draw(); raf = requestAnimationFrame(loop); };
    $('#rl-run').addEventListener('click', (e) => { run = !run; e.target.textContent = run ? '⏸ Pause' : '▶ Learn'; if (run) loop(); });
    $('#rl-watch').addEventListener('click', () => {
      if (watch) return;
      const path = m.greedyPath(); let i = 0;
      watch = setInterval(() => { bot = path[i++]; draw(); if (i >= path.length) { clearInterval(watch); watch = null; setTimeout(() => { bot = null; draw(); }, 700); } }, 260);
    });
    $('#rl-reset').addEventListener('click', () => { m.reset(); bot = null; draw(); });
    mc.addEventListener('pointerdown', (e) => {
      const r = mc.getBoundingClientRect(), x = Math.floor(((e.clientX - r.left) / r.width) * m.cols), y = Math.floor(((e.clientY - r.top) / r.height) * m.rows), k = m.key(x, y);
      if ((x === m.start[0] && y === m.start[1]) || (x === m.goal[0] && y === m.goal[1]) || m.lava.has(k)) return;
      m.walls.has(k) ? m.walls.delete(k) : m.walls.add(k);
      m.reset(); draw();
    });
    draw();
    root.addEventListener('lab-hide', () => { run = false; cancelAnimationFrame(raf); const r = $('#rl-run'); if (r) r.textContent = '▶ Learn'; });
  }
}
