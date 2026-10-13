// =====================================================================
//  ui.js — HUD, navigation menu, station panels, recruiter mode,
//  joystick and minimap. Works even if the 3D world fails to load.
// =====================================================================
import { SITE, STATIONS, ABOUT, SKILLS, PROJECTS, ACHIEVEMENTS, LINKS, RESUME_URL, ML_STEPS } from './data.js';

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
  return `<p class="note"><strong>No machine-learning model is connected yet.</strong> The lab will only show real predictions once a real model is added. Until then, nothing here is a prediction. The explorer below is educational content.</p>
  <h3>MACHINE LEARNING WORKFLOW EXPLORER</h3>
  <div class="steps" id="ml-steps">${ML_STEPS.map(([t], i) => `<button type="button" data-i="${i}" aria-pressed="false">${i + 1}. ${esc(t)}</button>`).join('')}</div>
  <p id="ml-desc" class="card" style="margin-top:10px" aria-live="polite">Select a step to read what happens there.</p>`;
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
  projects: () => ({ html: PROJECTS.map(projectCard).join('') }),
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

function wireLab(root) {
  const desc = root.querySelector('#ml-desc');
  root.querySelectorAll('#ml-steps button').forEach((b) =>
    b.addEventListener('click', () => {
      root.querySelectorAll('#ml-steps button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      const [t, d] = ML_STEPS[+b.dataset.i];
      desc.innerHTML = `<strong>${esc(t)}</strong><br>${esc(d)}`;
    })
  );
}

// ---------- UI controller ----------
export function initUI() {
  let world = null;
  let openId = null;
  let lastFocus = null;
  let nearbyId = null;
  const touch = matchMedia('(pointer:coarse)').matches;
  if (touch) document.body.classList.add('touch');

  const panel = $('#panel');
  const backdrop = $('#panel-backdrop');
  const menu = $('#nav-menu');
  const menuBtn = $('#menu-btn');
  const prompt = $('#prompt');

  // nav list
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
  $('#nav-recruiter').addEventListener('click', () => {
    toggleMenu(false);
    openStation('recruiter');
  });
  $('#nav-welcome').addEventListener('click', () => {
    document.body.classList.remove('started');
    toggleMenu(false);
  });
  $('#recruiter-btn').addEventListener('click', () => openStation('recruiter'));
  $('#start-btn').addEventListener('click', () => document.body.classList.add('started'));

  function openStation(id) {
    const r = RENDER[id];
    if (!r) return;
    const def = STATIONS.find((s) => s.id === id);
    const out = r();
    lastFocus = document.activeElement;
    openId = id;
    $('#panel-title').textContent = out.title || def.label;
    panel.style.setProperty('--accent', def ? def.css : '#22d3ee');
    $('#panel-body').innerHTML = out.html;
    out.after && out.after($('#panel-body'));
    backdrop.hidden = false;
    document.body.classList.add('started');
    world && world.setLocked(true);
    panel.focus();
  }
  function closePanel() {
    if (backdrop.hidden) return;
    backdrop.hidden = true;
    openId = null;
    world && world.setLocked(false);
    lastFocus && lastFocus.focus && lastFocus.focus();
  }
  $('#panel-close').addEventListener('click', closePanel);
  backdrop.addEventListener('pointerdown', (e) => {
    if (e.target === backdrop) closePanel();
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!backdrop.hidden) closePanel();
      else if (!menu.hidden) toggleMenu(false);
    }
    if (e.key === 'Tab' && !backdrop.hidden) {
      const f = [...panel.querySelectorAll('button:not([disabled]),a[href]')];
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

  // proximity prompt
  function setNearby(id) {
    nearbyId = id;
    if (!id) {
      prompt.hidden = true;
      return;
    }
    const def = STATIONS.find((s) => s.id === id);
    prompt.textContent = touch ? `Open ${def.label}` : `Press E · Enter ${def.label}`;
    prompt.hidden = false;
  }
  prompt.addEventListener('click', () => nearbyId && openStation(nearbyId));

  // joystick
  const joy = $('#joystick');
  const stick = $('#stick');
  let joyId = null;
  const setStick = (dx, dy) => {
    stick.style.transform = `translate(${dx}px,${dy}px)`;
  };
  const joyMove = (e) => {
    const r = joy.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const max = r.width / 2 - 10;
    const l = Math.hypot(dx, dy);
    if (l > max) {
      dx *= max / l;
      dy *= max / l;
    }
    setStick(dx, dy);
    const nx = dx / max;
    const ny = -dy / max;
    world && world.setJoystick(Math.hypot(nx, ny) < 0.12 ? 0 : nx, Math.hypot(nx, ny) < 0.12 ? 0 : ny);
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
  $('#jump-btn').addEventListener('click', () => world && world.jump());

  // pause / reset / quality
  const pauseOv = $('#pause-overlay');
  const setPaused = (v) => {
    pauseOv.hidden = !v;
    world && world.setFrozen(v);
    $('#pause-btn').textContent = v ? 'Resume' : 'Pause';
    if (v) $('#resume-btn').focus();
  };
  $('#pause-btn').addEventListener('click', () => setPaused(pauseOv.hidden));
  $('#resume-btn').addEventListener('click', () => setPaused(false));
  addEventListener('keydown', (e) => {
    if (e.code === 'KeyP' && !/^(INPUT|TEXTAREA)$/.test(e.target.tagName) && world) setPaused(pauseOv.hidden);
  });
  $('#reset-btn').addEventListener('click', () => world && world.reset());
  const modes = ['auto', 'high', 'low'];
  let mode = 0;
  $('#quality-btn').addEventListener('click', () => {
    mode = (mode + 1) % 3;
    world && world.setQuality(modes[mode]);
    setQualityLabel();
  });
  function setQualityLabel(actual) {
    const m = modes[mode];
    $('#quality-btn').textContent = `Graphics: ${m === 'auto' ? 'Auto' + (actual ? ` (${actual})` : '') : m === 'high' ? 'High' : 'Low'}`;
  }

  // minimap
  const mm = $('#minimap');
  const g = mm.getContext('2d');
  function drawMap() {
    if (!world || mm.offsetParent === null) return;
    const s = world.getState();
    const W = mm.width;
    const c = W / 2;
    const k = (c - 10) / s.islandRadius;
    g.clearRect(0, 0, W, W);
    g.fillStyle = '#0b1330';
    g.beginPath();
    g.arc(c, c, c - 4, 0, 7);
    g.fill();
    g.strokeStyle = '#22d3ee';
    g.lineWidth = 3;
    g.stroke();
    g.fillStyle = '#38bdf8';
    g.beginPath();
    g.arc(c, c, 6 * k, 0, 7);
    g.fill();
    s.stations.forEach((st) => {
      g.fillStyle = st.css;
      g.beginPath();
      g.arc(c + st.x * k, c + st.z * k, st.id === s.nearby ? 11 : 8, 0, 7);
      g.fill();
    });
    g.save();
    g.translate(c + s.x * k, c + s.z * k);
    g.rotate(-s.heading + Math.PI);
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(0, 12);
    g.lineTo(8, -8);
    g.lineTo(-8, -8);
    g.closePath();
    g.fill();
    g.restore();
  }
  setInterval(drawMap, 100);

  return {
    setNearby,
    openStation,
    setQualityLabel,
    attachWorld(w) {
      world = w;
      w.setQuality('auto');
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
