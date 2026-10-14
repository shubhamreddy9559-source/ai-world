// =====================================================================
//  ui.js — HUD, navigation menu, station panels, recruiter mode,
//  joystick and minimap. Works even if the 3D world fails to load.
// =====================================================================
import { SITE, STATIONS, ABOUT, SKILLS, PROJECTS, ACHIEVEMENTS, LINKS, RESUME_URL, CHAT } from './data.js?v=12';
import { ask } from './chat.js?v=12';
import { TASKS } from './tasks.js?v=12';

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

function labHTML() {
  return `<div class="lab-tabs" id="lab-tabs" role="tablist">
    <button type="button" role="tab" data-t="game" aria-selected="true">🎮 Teach the Bot</button>
    <button type="button" role="tab" data-t="robot" aria-selected="false">🤖 Robot tuning</button>
  </div>
  <section class="lab-pane" data-p="game">
    <p class="note"><strong>You are the teacher.</strong> Label creatures as Friendly or Grumpy. A real AI learner (k-nearest neighbours) learns only from <em>your</em> examples, then guesses new ones. Few or wrong examples make a bad bot!</p>
    <div class="lab-tools" id="mg-lvls"><button type="button" aria-pressed="true">Level 1</button><button type="button" aria-pressed="false">Level 2</button><button type="button" aria-pressed="false">Level 3</button></div>
    <p class="card"><strong id="mg-level"></strong><br><span id="mg-rule"></span><br><small id="mg-best"></small></p>
    <canvas id="mg-card" width="320" height="170" class="viewer lab-sq2" aria-label="Creature to label"></canvas>
    <div id="mg-teach" class="lab-tools">
      <button type="button" id="mg-friend">😊 Friendly</button>
      <button type="button" id="mg-grump">😠 Grumpy</button>
      <button type="button" id="mg-done">🎓 Test the bot</button>
    </div>
    <p id="mg-status" class="card" aria-live="polite"></p>
    <div id="mg-result" class="card" hidden aria-live="polite"></div>
    <canvas id="mg-map" width="240" height="240" class="viewer lab-sq" hidden aria-label="Map of what the bot learned"></canvas>
    <div class="lab-tools"><button type="button" id="mg-retry">↺ Try again</button><button type="button" id="mg-next">Next level ▶</button></div>
    <h3>WHAT IS THIS TEACHING?</h3>
    <p class="card">This is how machine learning works: a model learns from labelled examples you give it. <strong>More good examples</strong> make it more accurate. <strong>Mistakes in labels</strong> or missing kinds of examples make it worse. The bot never sees the real rule, only your examples.</p>
  </section>
  <section class="lab-pane" data-p="robot" hidden>
    <p class="note"><strong>Simulation</strong> inspired by my ESP32 line-following robot. Not real telemetry. Tap a preset, then drag the sliders below.</p>
  <div class="lab-tools" id="rb-presets">
    <button type="button" data-p="calm">🙂 Balanced</button>
    <button type="button" data-p="wobble">🌀 Wobbly</button>
    <button type="button" data-p="lazy">😴 Too lazy</button>
    <button type="button" data-p="fast">🚀 Race tune</button>
  </div>
  <canvas id="rb-board" width="320" height="320" class="viewer lab-sq" aria-label="Top-down simulation of a line-following robot on a looping track"></canvas>
  <p id="rb-stats" class="card" aria-live="off"></p>
  <p id="rb-advice" class="card" aria-live="polite"></p>
  <div class="rb-sliders">
    <label>Kp · reaction strength <b id="rb-kp-v"></b><input id="rb-kp" type="range" min="0" max="12" step="0.1" value="2"></label>
    <label>Kd · calming (damping) <b id="rb-kd-v"></b><input id="rb-kd" type="range" min="0" max="12" step="0.1" value="3"></label>
    <label>Ki · fixes steady drift <b id="rb-ki-v"></b><input id="rb-ki" type="range" min="0" max="1" step="0.05" value="0"></label>
    <label>Speed <b id="rb-speed-v"></b><input id="rb-speed" type="range" min="0.5" max="3" step="0.1" value="1.4"></label>
  </div>
  <div class="lab-tools"><button type="button" id="rb-reset">↺ Restart robot</button></div>
  <h3>WHAT AM I SEEING?</h3>
  <p class="card">The robot (pink) reads the line with a row of 7 IR sensors (the dots in front of it; blue = sees the line). If the line drifts to one side, a <strong>PID controller</strong> steers back. The orange trail shows where it has been.<br><br><strong>Kp</strong> reacts to how far off the line the robot is. Too low and it drifts off; too high and it swings side to side.<br><strong>Kd</strong> looks at how fast the error is changing and calms the swinging.<br><strong>Ki</strong> slowly corrects a steady lean. Usually small.<br><strong>Challenge:</strong> beat your best lap time without crashing. Your best is saved on this device only.</p>
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
  import('./model.js?v=12')
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
    tabs.forEach((x) => x.setAttribute('aria-selected', String(x === t)));
    panes.forEach((p) => { p.hidden = p.dataset.p !== t.dataset.t; });
  }));
  import('./mlgame.js?v=12').then((m) => m.wireMLGame(root)).catch(() => {
    const n = root.querySelector('#mg-card');
    if (n) n.insertAdjacentHTML('afterend', '<p class="card">The game could not load (mlgame.js missing). Upload mlgame.js next to ui.js.</p>');
  });
  import('./robotlab.js?v=12').then((m) => m.wireRobotLab(root)).catch(() => {
    const n = root.querySelector('#rb-board');
    if (n) n.insertAdjacentHTML('afterend', '<p class="card">The simulator could not load (robotlab.js missing). Upload robotlab.js next to ui.js.</p>');
  });
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
