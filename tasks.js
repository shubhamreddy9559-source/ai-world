// =====================================================================
//  tasks.js — a quick mini-game on each island before its info opens.
//  Every task has a "Skip task" button (added by ui.js) and Recruiter
//  mode never asks, so no portfolio information is locked behind a game.
//  Each task: { title, hint, run(container, done) -> cleanup() }
// =====================================================================
const mk = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
const live = (el) => {
  el.setAttribute('aria-live', 'polite');
  return el;
};

// tiny beeps (optional: silently does nothing if audio is unavailable)
let actx = null;
function beep(freq = 440, ms = 140, type = 'sine', vol = 0.06) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g);
    g.connect(actx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + ms / 1000);
    o.stop(actx.currentTime + ms / 1000 + 0.02);
  } catch (e) {
    /* no audio */
  }
}
const confetti = (box) => {
  const c = mk('div', 'task-confetti');
  for (let i = 0; i < 24; i++) {
    const s = mk('i');
    s.style.left = Math.random() * 100 + '%';
    s.style.background = ['#ff8be0', '#7df0ff', '#ffe27a', '#b69bff', '#7ee0c3'][i % 5];
    s.style.animationDelay = Math.random() * 0.3 + 's';
    c.appendChild(s);
  }
  box.appendChild(c);
};

export const TASKS = {
  // ---- About: Simon-style robot memory game with tones ----
  about: {
    title: '🤖 Wake up the robot!',
    hint: 'Watch the lights and sounds, then copy the pattern. 3 rounds!',
    run(box, done) {
      const cols = ['#ff7ad9', '#6fe8ff', '#ffe27a', '#a78bff'];
      const names = ['Pink', 'Cyan', 'Yellow', 'Purple'];
      const tones = [330, 392, 523, 659];
      const status = live(mk('p', 'task-status', 'Watch…'));
      const face = mk('div', 'task-face', '😴');
      const grid = mk('div', 'task-grid');
      const btns = cols.map((c, i) => {
        const b = mk('button', 'task-pad');
        b.type = 'button';
        b.style.setProperty('--c', c);
        b.setAttribute('aria-label', names[i]);
        b.disabled = true;
        grid.appendChild(b);
        return b;
      });
      box.append(face, status, grid);
      let seq = [];
      let round = 0;
      let input = [];
      const timers = [];
      let alive = true;
      const later = (fn, ms) => timers.push(setTimeout(() => alive && fn(), ms));
      const flash = (i, ms = 380) => {
        btns[i].classList.add('on');
        beep(tones[i], ms);
        later(() => btns[i].classList.remove('on'), ms);
      };
      const play = () => {
        input = [];
        btns.forEach((b) => (b.disabled = true));
        status.textContent = `Round ${round + 1} of 3 · watch…`;
        face.textContent = '👀';
        seq.forEach((v, k) => later(() => flash(v), 600 + k * 650));
        later(() => {
          status.textContent = 'Your turn!';
          face.textContent = '🤔';
          btns.forEach((b) => (b.disabled = false));
        }, 600 + seq.length * 650);
      };
      const nextRound = () => {
        seq.push((Math.random() * 4) | 0);
        play();
      };
      btns.forEach((b, i) =>
        b.addEventListener('click', () => {
          flash(i, 200);
          input.push(i);
          const k = input.length - 1;
          if (input[k] !== seq[k]) {
            status.textContent = 'Oops! Watch again.';
            face.textContent = '😵';
            beep(150, 300, 'sawtooth');
            btns.forEach((x) => (x.disabled = true));
            later(play, 900);
          } else if (input.length === seq.length) {
            btns.forEach((x) => (x.disabled = true));
            round++;
            if (round >= 3) {
              status.textContent = 'The robot is awake!';
              face.textContent = '🤩';
              confetti(box);
              later(done, 900);
            } else {
              status.textContent = 'Nice! One more…';
              face.textContent = '😀';
              later(nextRound, 900);
            }
          }
        })
      );
      seq = [(Math.random() * 4) | 0, (Math.random() * 4) | 0];
      later(play, 400);
      return () => {
        alive = false;
        timers.forEach(clearTimeout);
      };
    },
  },

  // ---- Projects: drive a line follower along a curvy track ----
  projects: {
    title: '🏁 Line-follower challenge',
    hint: 'Hold the LEFT or RIGHT side of the box to steer. Keep the robot on the black line to fill the meter!',
    run(box, done) {
      const W = 300;
      const H = 300;
      const status = live(mk('p', 'task-status', 'Stay on the line!'));
      const meter = mk('div', 'task-meter');
      const fillEl = mk('i');
      meter.appendChild(fillEl);
      const cv = mk('canvas', 'task-canvas');
      cv.width = W;
      cv.height = H;
      cv.style.touchAction = 'none';
      box.append(status, meter, cv);
      const g = cv.getContext('2d');
      let steer = 0;
      let x = W / 2;
      let t = 0;
      let prog = 0;
      let raf = 0;
      let last = performance.now();
      let ended = false;
      const lineX = (y, tt) => W / 2 + Math.sin((y + tt * 120) / 55) * 70 + Math.sin((y + tt * 120) / 23) * 14;
      const setSteer = (e) => {
        const r = cv.getBoundingClientRect();
        steer = e.clientX - r.left < r.width / 2 ? -1 : 1;
      };
      cv.addEventListener('pointerdown', (e) => {
        cv.setPointerCapture(e.pointerId);
        setSteer(e);
      });
      cv.addEventListener('pointermove', (e) => {
        if (steer !== 0) setSteer(e);
      });
      const stop = () => (steer = 0);
      cv.addEventListener('pointerup', stop);
      cv.addEventListener('pointercancel', stop);
      const keyHandler = (e) => {
        if (e.type === 'keyup') {
          steer = 0;
          return;
        }
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') steer = -1;
        if (e.code === 'ArrowRight' || e.code === 'KeyD') steer = 1;
      };
      addEventListener('keydown', keyHandler);
      addEventListener('keyup', keyHandler);
      const frame = (now) => {
        raf = requestAnimationFrame(frame);
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        t += dt;
        // the robot also drifts a little, so you have to react
        const drift = Math.sin(t * 1.7) * 18;
        x = Math.min(W - 20, Math.max(20, x + (steer * 130 + drift) * dt));
        g.fillStyle = '#f4f1ff';
        g.fillRect(0, 0, W, H);
        g.strokeStyle = '#17142e';
        g.lineWidth = 34;
        g.lineCap = 'round';
        g.beginPath();
        for (let y = -10; y <= H + 10; y += 6) {
          const lx = lineX(y, t);
          if (y === -10) g.moveTo(lx, y);
          else g.lineTo(lx, y);
        }
        g.stroke();
        const ly = H - 60;
        const on = Math.abs(x - lineX(ly, t)) < 26;
        g.save();
        g.translate(x, ly);
        g.fillStyle = on ? '#22c55e' : '#ff5a8a';
        g.fillRect(-14, -22, 28, 44);
        g.fillStyle = '#111';
        g.fillRect(-20, -14, 6, 18);
        g.fillRect(14, -14, 6, 18);
        g.fillStyle = '#ffe27a';
        g.fillRect(-10, -26, 20, 6);
        g.restore();
        prog = Math.max(0, Math.min(1, prog + (on ? 0.255 : -0.15) * dt));
        fillEl.style.width = prog * 100 + '%';
        if (!ended) status.textContent = on ? 'Great! Keep going…' : 'Off the line! Steer back!';
        if (prog >= 1 && !ended) {
          ended = true;
          cancelAnimationFrame(raf);
          status.textContent = 'Lap complete! 🏆';
          beep(660, 200);
          confetti(box);
          setTimeout(done, 900);
        }
      };
      raf = requestAnimationFrame(frame);
      return () => {
        cancelAnimationFrame(raf);
        removeEventListener('keydown', keyHandler);
        removeEventListener('keyup', keyHandler);
      };
    },
  },

  // ---- AI/ML Lab: match the ML words with what they mean ----
  lab: {
    title: '🧠 Match the ML words',
    hint: 'Tap a word, then tap its meaning. Match all 3 pairs!',
    run(box, done) {
      const pairs = [
        ['Training data', 'Examples the model learns from'],
        ['Test data', 'Fresh examples that check how well it learned'],
        ['Overfitting', 'Memorising the examples instead of learning the pattern'],
      ];
      const status = live(mk('p', 'task-status', 'Pick a word on the left'));
      const cols = mk('div', 'task-match');
      const left = mk('div');
      const right = mk('div');
      cols.append(left, right);
      box.append(status, cols);
      let selL = null;
      let matched = 0;
      const mkBtn = (txt, side, idx) => {
        const b = mk('button', 'task-opt', txt);
        b.type = 'button';
        b.dataset.i = idx;
        b.addEventListener('click', () => {
          if (b.classList.contains('ok')) return;
          if (side === 'L') {
            left.querySelectorAll('button').forEach((x) => x.classList.remove('sel'));
            b.classList.add('sel');
            selL = idx;
            status.textContent = 'Now tap its meaning';
            beep(520, 90);
          } else if (selL == null) {
            status.textContent = 'Pick a word first!';
          } else if (selL === idx) {
            const l = left.querySelector(`[data-i="${idx}"]`);
            l.classList.remove('sel');
            l.classList.add('ok');
            b.classList.add('ok');
            selL = null;
            matched++;
            beep(784, 160);
            status.textContent = matched >= 3 ? 'All matched! 🎉' : 'Match! Pick the next word.';
            if (matched >= 3) {
              confetti(box);
              setTimeout(done, 900);
            }
          } else {
            b.classList.add('bad');
            beep(160, 200, 'sawtooth');
            setTimeout(() => b.classList.remove('bad'), 400);
            status.textContent = 'Not that one, try again.';
          }
        });
        return b;
      };
      pairs.forEach(([w], i) => left.appendChild(mkBtn(w, 'L', i)));
      shuffle(pairs.map((p, i) => [p[1], i])).forEach(([m, i]) => right.appendChild(mkBtn(m, 'R', i)));
      return () => {};
    },
  },

  // ---- Achievements: catch falling stars ----
  achievements: {
    title: '⭐ Star catcher',
    hint: 'Tap 7 falling stars. Dodge the rocks!',
    run(box, done) {
      const status = live(mk('p', 'task-status', 'Stars: 0 / 7'));
      const field = mk('div', 'task-field');
      box.append(status, field);
      let n = 0;
      let alive = true;
      let spawnT = 0;
      let raf = 0;
      let last = performance.now();
      const items = [];
      const spawn = () => {
        const rock = Math.random() < 0.25;
        const b = mk('button', rock ? 'task-star rock' : 'task-star', rock ? '🪨' : '★');
        b.type = 'button';
        b.setAttribute('aria-label', rock ? 'Rock, avoid' : 'Star');
        const it = { b, y: -14, v: 22 + Math.random() * 18 };
        b.style.left = 6 + Math.random() * 80 + '%';
        b.addEventListener('click', () => {
          if (!alive) return;
          if (rock) {
            n = Math.max(0, n - 1);
            beep(150, 200, 'sawtooth');
          } else {
            n++;
            beep(600 + n * 40, 120);
          }
          status.textContent = `Stars: ${n} / 7`;
          it.dead = true;
          b.remove();
          if (n >= 7) {
            alive = false;
            status.textContent = 'All caught! 🌟';
            confetti(box);
            setTimeout(done, 900);
          }
        });
        field.appendChild(b);
        items.push(it);
      };
      const frame = (now) => {
        raf = requestAnimationFrame(frame);
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (!alive) return;
        spawnT -= dt;
        if (spawnT <= 0) {
          spawn();
          spawnT = 0.55 + Math.random() * 0.4;
        }
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i];
          if (it.dead) {
            items.splice(i, 1);
            continue;
          }
          it.y += it.v * dt;
          it.b.style.top = it.y + '%';
          if (it.y > 104) {
            it.b.remove();
            items.splice(i, 1);
          }
        }
      };
      raf = requestAnimationFrame(frame);
      return () => {
        alive = false;
        cancelAnimationFrame(raf);
      };
    },
  },

  // ---- Resume: put the resume sections in order ----
  resume: {
    title: '📄 Build the resume',
    hint: 'Tap the sections in the order a resume usually reads, top to bottom.',
    run(box, done) {
      const order = ['Name & contact', 'Education', 'Skills', 'Projects'];
      const status = live(mk('p', 'task-status', 'Tap #1 first…'));
      const paper = mk('div', 'task-paper');
      const slots = order.map((_, i) => paper.appendChild(mk('div', 'task-slot', String(i + 1))));
      const choices = mk('div', 'task-opts');
      box.append(status, paper, choices);
      let next = 0;
      shuffle(order).forEach((txt) => {
        const b = mk('button', 'task-opt', txt);
        b.type = 'button';
        b.addEventListener('click', () => {
          if (txt === order[next]) {
            slots[next].textContent = txt;
            slots[next].classList.add('ok');
            b.disabled = true;
            b.classList.add('ok');
            beep(500 + next * 120, 130);
            next++;
            if (next >= order.length) {
              status.textContent = 'Resume ready! ✅';
              confetti(box);
              setTimeout(done, 900);
            } else status.textContent = `Great! Now #${next + 1}…`;
          } else {
            beep(160, 200, 'sawtooth');
            b.classList.add('bad');
            setTimeout(() => b.classList.remove('bad'), 400);
            status.textContent = `Not that one. What goes at #${next + 1}?`;
          }
        });
        choices.appendChild(b);
      });
      return () => {};
    },
  },

  // ---- Contact: tune the radio to find the signal ----
  contact: {
    title: '📡 Tune the signal',
    hint: 'Slide the dial. Find the spot where the signal bar is full and hold it there!',
    run(box, done) {
      const target = 15 + Math.random() * 70;
      const status = live(mk('p', 'task-status', 'Searching for signal…'));
      const bars = mk('div', 'task-bars');
      const barEls = Array.from({ length: 10 }, () => bars.appendChild(mk('i')));
      const noise = mk('p', 'task-noise', 'ksshhh… bzzt…');
      const range = mk('input', 'task-range');
      range.type = 'range';
      range.min = 0;
      range.max = 100;
      range.step = 0.5;
      range.value = 5;
      range.setAttribute('aria-label', 'Radio dial');
      box.append(status, bars, noise, range);
      let timer = null;
      let ended = false;
      const read = () => {
        if (ended) return;
        const d = Math.abs(+range.value - target);
        const q = Math.max(0, 1 - d / 35);
        const lit = Math.round(q * 10);
        barEls.forEach((b, i) => b.classList.toggle('on', i < lit));
        const garbled = 'ksshhh… bzzt… '.slice(0, Math.max(0, Math.round((1 - q) * 14)));
        noise.textContent = d < 3 ? 'Hello from Shubham! 👋' : garbled || '…';
        status.textContent = d < 3 ? 'Locked on! Hold still…' : d < 12 ? 'Getting warmer…' : 'Searching for signal…';
        if (d < 3) {
          if (!timer)
            timer = setTimeout(() => {
              ended = true;
              status.textContent = 'Connected! 📡';
              beep(880, 250);
              confetti(box);
              setTimeout(done, 700);
            }, 800);
        } else {
          if (timer) {
            clearTimeout(timer);
            timer = null;
          }
          beep(200 + q * 500, 40, 'triangle', 0.02);
        }
      };
      range.addEventListener('input', read);
      read();
      return () => timer && clearTimeout(timer);
    },
  },
};
