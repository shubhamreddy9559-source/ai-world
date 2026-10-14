// robotlab.js — Robotics Lab: a PID line-follower SIMULATION (top-down), inspired by Shubham's ESP32 line-following robot.
// Everything is computed live in the browser. It is a simulation, not telemetry from the real robot.

export const CX = 160, CY = 160, LINE_W = 16;

// closed track: a smooth wavy loop around the centre
export function makeTrack(n = 480) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const r = 98 + 22 * Math.sin(2 * t + 0.6) + 12 * Math.sin(3 * t + 2.1);
    pts.push([CX + r * Math.cos(t), CY + r * 0.82 * Math.sin(t)]);
  }
  return pts;
}

export class Sim {
  constructor() { this.track = makeTrack(); this.params = { kp: 2, ki: 0, kd: 3, speed: 1.4 }; this.reset(); this.best = null; }
  reset() {
    const a = this.track[0], b = this.track[1];
    this.x = a[0]; this.y = a[1]; this.th = Math.atan2(b[1] - a[1], b[0] - a[0]);
    this.I = 0; this.prevE = 0; this.D = 0; this.diff = 0; this.lastE = 0; this.t = 0; this.lapStart = 0; this.laps = 0; this.lostT = 0; this.lost = false; this.crashes = 0;
    this.ang = Math.atan2(this.y - CY, (this.x - CX) / 0.82); this.angAcc = 0; this.flips = []; this.lastSign = 0; this.sens = new Array(7).fill(0); this.err = 0; this.trail = [];
    this.lapTimes = [];
  }
  dist(x, y) { let m = 1e9; for (const p of this.track) { const d = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (d < m) m = d; } return Math.sqrt(m); }
  step(dt) {
    const { kp, ki, kd, speed } = this.params;
    // 7 IR sensors in a row ahead of the axle
    const SP = 4.5, AHEAD = 14, c = Math.cos(this.th), s = Math.sin(this.th);
    let sum = 0, wsum = 0;
    for (let i = 0; i < 7; i++) {
      const off = (i - 3) * SP;
      const sx = this.x + c * AHEAD - s * off, sy = this.y + s * AHEAD + c * off;
      const on = this.dist(sx, sy) < LINE_W / 2 ? 1 : 0;
      this.sens[i] = on; sum += on; wsum += on * (i - 3);
    }
    let e;
    if (sum > 0) { e = wsum / sum; this.lostT = 0; this.lost = false; this.lastE = e; }
    else { this.lostT += dt; e = Math.sign(this.lastE || 1) * 3.4; if (this.lostT > 0.25) this.lost = true; }
    this.err = e;
    this.I = Math.max(-6, Math.min(6, this.I + e * dt));
    const rawD = (e - this.prevE) / dt; this.prevE = e;
    this.D += (rawD - this.D) * (1 - Math.exp(-dt / 0.05)); // smoothed derivative
    const turn = kp * e + ki * this.I + kd * this.D * 0.08;
    const base = 100 * speed, target = Math.max(-base * 1.2, Math.min(base * 1.2, turn * 14));
    this.diff += (target - this.diff) * (1 - Math.exp(-dt / 0.09)); // motors take time to respond
    const diff = this.diff;
    const vr = base + diff, vl = base - diff; // positive error = line on the robot's right => turn right
    const v = (vl + vr) / 2, w = (vr - vl) / 18;
    this.th += w * dt; this.x += Math.cos(this.th) * v * dt; this.y += Math.sin(this.th) * v * dt;
    this.t += dt;
    const sg = Math.sign(e); if (sg && sg !== this.lastSign && Math.abs(e) > 0.45) { this.flips.push(this.t); this.lastSign = sg; }
    this.flips = this.flips.filter((q) => this.t - q < 1.5);
    // lap counting by angle around the centre
    const a = Math.atan2(this.y - CY, (this.x - CX) / 0.82); let d = a - this.ang; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
    this.angAcc += d; this.ang = a;
    if (Math.abs(this.angAcc) >= Math.PI * 2 - 0.05 && !this.lost) { this.angAcc = 0; this.laps++; const lt = this.t - this.lapStart; this.lapStart = this.t; this.lapTimes.push(lt); if (this.best == null || lt < this.best) this.best = lt; }
    // wandered away from the line for too long: it "crashes" and restarts at the start line
    if (this.lostT > 1.2) { this.crashes++; const keep = { best: this.best, crashes: this.crashes, laps: this.laps, lapTimes: this.lapTimes }; this.reset(); Object.assign(this, keep); }
    if (!this.trail.length || (this.x - this.trail[this.trail.length - 1][0]) ** 2 + (this.y - this.trail[this.trail.length - 1][1]) ** 2 > 9) { this.trail.push([this.x, this.y]); if (this.trail.length > 160) this.trail.shift(); }
  }
  advice() {
    if (this.lost) return '😵 It lost the line! Try a higher Kp, or a lower speed.';
    if (this.flips.length >= 7) return '🌀 Wobbling side to side. Lower Kp, or raise Kd to calm it down.';
    if (this.crashes && this.t < 2) return '💥 It left the track and restarted. Slow it down or raise Kp.';
    if (this.laps >= 1) return '🏁 Clean laps! Now raise Speed to chase a faster lap time.';
    return '🙂 Following the line. Change the sliders and watch what happens.';
  }
}

// ---------------- UI ----------------
export function wireRobotLab(root) {
  const cv = root.querySelector('#rb-board'); if (!cv) return;
  const g = cv.getContext('2d'), sim = new Sim();
  const el = (s) => root.querySelector(s);
  const sl = { kp: el('#rb-kp'), ki: el('#rb-ki'), kd: el('#rb-kd'), speed: el('#rb-speed') };
  const out = { kp: el('#rb-kp-v'), ki: el('#rb-ki-v'), kd: el('#rb-kd-v'), speed: el('#rb-speed-v') };
  const sync = () => { for (const k in sl) { sim.params[k] = +sl[k].value; out[k].textContent = (+sl[k].value).toFixed(k === 'ki' ? 2 : 1); } };
  const setAll = (p) => { for (const k in p) sl[k].value = p[k]; sync(); sim.reset(); sim.best = sim.best; };
  for (const k in sl) sl[k].addEventListener('input', sync);
  sync();
  let best = null; try { best = parseFloat(localStorage.getItem('rb-best')) || null; } catch (e) { /* no storage */ }
  if (best) sim.best = best;
  const PRESETS = { calm: { kp: 2, ki: 0, kd: 3, speed: 1.4 }, wobble: { kp: 8, ki: 0, kd: 0, speed: 2 }, lazy: { kp: 0.3, ki: 0, kd: 0, speed: 1.4 }, fast: { kp: 4, ki: 0, kd: 8, speed: 2.6 } };
  root.querySelectorAll('#rb-presets button').forEach((b) => b.addEventListener('click', () => setAll(PRESETS[b.dataset.p])));
  el('#rb-reset').addEventListener('click', () => { sim.reset(); });
  let last = performance.now(), raf = 0, alive = true;
  function draw() {
    g.fillStyle = '#1d1442'; g.fillRect(0, 0, 320, 320);
    g.strokeStyle = '#ffffff'; g.lineWidth = LINE_W; g.lineJoin = 'round'; g.beginPath();
    sim.track.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.stroke();
    g.strokeStyle = '#2b1d63'; g.lineWidth = 2; g.setLineDash([6, 8]); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#7df0ff'; g.fillRect(sim.track[0][0] - 2, sim.track[0][1] - 16, 4, 32);
    g.strokeStyle = 'rgba(255,154,60,.6)'; g.lineWidth = 2; g.beginPath(); sim.trail.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
    g.save(); g.translate(sim.x, sim.y); g.rotate(sim.th);
    g.fillStyle = sim.lost ? '#ff5a3c' : '#ff7ab8'; g.fillRect(-12, -9, 24, 18);
    g.fillStyle = '#2b1d63'; g.fillRect(-6, -13, 12, 4); g.fillRect(-6, 9, 12, 4);
    for (let i = 0; i < 7; i++) { g.fillStyle = sim.sens[i] ? '#7df0ff' : '#443'; g.beginPath(); g.arc(15, (i - 3) * 5.5, 2, 0, 7); g.fill(); }
    g.restore();
    el('#rb-stats').innerHTML = `Lap <strong>${sim.laps}</strong> · time <strong>${(sim.t - sim.lapStart).toFixed(1)}s</strong> · best <strong>${sim.best ? sim.best.toFixed(1) + 's' : '—'}</strong> · crashes <strong>${sim.crashes}</strong>`;
    el('#rb-advice').textContent = sim.advice();
  }
  function loop(now) {
    if (!alive) return;
    let dt = Math.min(0.05, (now - last) / 1000); last = now;
    while (dt > 0) { const h = Math.min(dt, 1 / 120); sim.step(h); dt -= h; }
    if (sim.best && sim.best !== best) { best = sim.best; try { localStorage.setItem('rb-best', String(best)); } catch (e) { /* ignore */ } }
    draw(); raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);
  // stop when the panel is closed (element removed from the page)
  const chk = setInterval(() => { if (!root.isConnected) { alive = false; cancelAnimationFrame(raf); clearInterval(chk); } }, 700);
}
