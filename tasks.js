// =====================================================================
//  tasks.js — a tiny unlock task for each portal. Every task has a
//  "Skip task" button in the panel (and Recruiter mode never asks), so
//  no portfolio information is ever locked behind a game.
//  Each task: { title, hint, run(container, done) -> cleanup() }
// =====================================================================
const mk = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);

export const TASKS = {
  // Simon-style memory pattern
  about: {
    title: 'Wake the robot',
    hint: 'Watch the lights, then repeat the pattern.',
    run(box, done) {
      const cols = ['#3b82f6', '#a855f7', '#22d3ee', '#f59e0b'];
      const names = ['Blue', 'Purple', 'Cyan', 'Orange'];
      const seq = Array.from({ length: 3 }, () => (Math.random() * 4) | 0);
      const status = mk('p', 'task-status', 'Watch…');
      status.setAttribute('aria-live', 'polite');
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
      box.append(status, grid);
      let timers = [];
      let input = [];
      let live = true;
      const flash = (i, ms = 420) => {
        btns[i].classList.add('on');
        timers.push(setTimeout(() => btns[i].classList.remove('on'), ms));
      };
      const play = () => {
        input = [];
        btns.forEach((b) => (b.disabled = true));
        status.textContent = 'Watch… (' + seq.map((i) => names[i]).join(', ') + ')';
        seq.forEach((v, k) => timers.push(setTimeout(() => live && flash(v), 500 + k * 700)));
        timers.push(
          setTimeout(() => {
            if (!live) return;
            status.textContent = 'Your turn!';
            btns.forEach((b) => (b.disabled = false));
          }, 500 + seq.length * 700)
        );
      };
      btns.forEach((b, i) =>
        b.addEventListener('click', () => {
          flash(i, 200);
          input.push(i);
          const k = input.length - 1;
          if (input[k] !== seq[k]) {
            status.textContent = 'Not quite. Watch again.';
            timers.push(setTimeout(play, 700));
          } else if (input.length === seq.length) {
            status.textContent = 'Unlocked!';
            btns.forEach((x) => (x.disabled = true));
            timers.push(setTimeout(done, 500));
          }
        })
      );
      play();
      return () => {
        live = false;
        timers.forEach(clearTimeout);
      };
    },
  },

  // tap numbered nodes in order
  projects: {
    title: 'Connect the circuit',
    hint: 'Tap the nodes in order: 1, 2, 3, 4.',
    run(box, done) {
      const status = mk('p', 'task-status', 'Next: 1');
      status.setAttribute('aria-live', 'polite');
      const grid = mk('div', 'task-grid g3');
      const cells = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, 4);
      let next = 1;
      for (let i = 0; i < 9; i++) {
        const k = cells.indexOf(i);
        if (k < 0) {
          grid.appendChild(mk('span', 'task-gap'));
          continue;
        }
        const b = mk('button', 'task-node', String(k + 1));
        b.type = 'button';
        b.addEventListener('click', () => {
          if (k + 1 === next) {
            b.classList.add('ok');
            b.disabled = true;
            next++;
            if (next > 4) {
              status.textContent = 'Connected!';
              setTimeout(done, 450);
            } else status.textContent = 'Next: ' + next;
          } else {
            status.textContent = 'Wrong order. Start again at 1.';
            next = 1;
            grid.querySelectorAll('.task-node').forEach((n) => {
              n.classList.remove('ok');
              n.disabled = false;
            });
          }
        });
        grid.appendChild(b);
      }
      box.append(status, grid);
      return () => {};
    },
  },

  // a real (educational) ML question
  lab: {
    title: 'Quick ML question',
    hint: 'Pick the best answer.',
    run(box, done) {
      box.appendChild(mk('p', 'task-q', 'Which data should you keep aside to check how a model performs on examples it has never seen?'));
      const status = mk('p', 'task-status', '');
      status.setAttribute('aria-live', 'polite');
      const opts = shuffle([
        ['The test set', true],
        ['The training set', false],
        ['Only the first 10 rows', false],
      ]);
      const list = mk('div', 'task-opts');
      opts.forEach(([t, ok]) => {
        const b = mk('button', 'task-opt', t);
        b.type = 'button';
        b.addEventListener('click', () => {
          if (ok) {
            b.classList.add('ok');
            status.textContent = 'Correct! The test set is held out for evaluation.';
            list.querySelectorAll('button').forEach((x) => (x.disabled = true));
            setTimeout(done, 700);
          } else {
            b.disabled = true;
            status.textContent = 'Not that one. Try again.';
          }
        });
        list.appendChild(b);
      });
      box.append(list, status);
      return () => {};
    },
  },

  // catch stars
  achievements: {
    title: 'Catch 5 stars',
    hint: 'Tap each star as it appears.',
    run(box, done) {
      const status = mk('p', 'task-status', 'Stars: 0 / 5');
      status.setAttribute('aria-live', 'polite');
      const field = mk('div', 'task-field');
      box.append(status, field);
      let n = 0;
      const spawn = () => {
        field.innerHTML = '';
        const b = mk('button', 'task-star', '★');
        b.type = 'button';
        b.setAttribute('aria-label', 'Star');
        b.style.left = 8 + Math.random() * 78 + '%';
        b.style.top = 6 + Math.random() * 70 + '%';
        b.addEventListener('click', () => {
          n++;
          status.textContent = `Stars: ${n} / 5`;
          if (n >= 5) {
            field.innerHTML = '';
            status.textContent = 'All caught!';
            setTimeout(done, 450);
          } else spawn();
        });
        field.appendChild(b);
      };
      spawn();
      return () => {};
    },
  },

  // type a short code
  resume: {
    title: 'Enter the access code',
    hint: 'Type the code shown below.',
    run(box, done) {
      const code = 'AI-' + (1000 + ((Math.random() * 9000) | 0));
      box.appendChild(mk('p', 'task-code', code));
      const status = mk('p', 'task-status', '');
      status.setAttribute('aria-live', 'polite');
      const form = mk('form', 'task-form');
      const input = mk('input');
      input.type = 'text';
      input.autocomplete = 'off';
      input.setAttribute('aria-label', 'Access code');
      input.placeholder = 'Code';
      const go = mk('button', 'btn primary', 'Unlock');
      go.type = 'submit';
      form.append(input, go);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (input.value.trim().toUpperCase() === code) {
          status.textContent = 'Access granted.';
          setTimeout(done, 400);
        } else status.textContent = 'That is not the code. Check and try again.';
      });
      box.append(form, status);
      setTimeout(() => input.focus(), 50);
      return () => {};
    },
  },

  // slider
  contact: {
    title: 'Boost the signal',
    hint: 'Slide all the way to 100%.',
    run(box, done) {
      const status = mk('p', 'task-status', 'Signal: 0%');
      status.setAttribute('aria-live', 'polite');
      const range = mk('input', 'task-range');
      range.type = 'range';
      range.min = 0;
      range.max = 100;
      range.value = 0;
      range.setAttribute('aria-label', 'Signal strength');
      range.addEventListener('input', () => {
        status.textContent = `Signal: ${range.value}%`;
        if (+range.value >= 100) {
          range.disabled = true;
          status.textContent = 'Connected!';
          setTimeout(done, 450);
        }
      });
      box.append(range, status);
      return () => {};
    },
  },
};
