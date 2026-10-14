// =====================================================================
//  chat.js — the portfolio assistant.
//  Default: a rule-based assistant that answers ONLY from data.js.
//  It is NOT a large language model and says so in the UI.
//  Optional: set CHAT.endpoint in data.js to your own secure backend
//  (which holds the API key) that returns { "reply": "..." }.
// =====================================================================
import { SITE, ABOUT, SKILLS, PROJECTS, ACHIEVEMENTS, LINKS, RESUME_URL, CHAT, KNOWLEDGE } from './data.js?v=9';

const has = (q, ...words) => words.some((w) => q.includes(w));
const list = (arr) => (arr.length <= 1 ? arr.join('') : arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1]);

function projectLine(p) {
  return p.status ? `${p.title} (${p.status.toLowerCase()})` : p.title;
}

function knowledgeAnswer(q) {
  const padded = ' ' + q.replace(/[^a-z0-9+#\- ]/g, ' ') + ' ';
  let best = null, bestScore = 0;
  for (const k of KNOWLEDGE) {
    let sc = 0;
    for (const key of k.keys) {
      const kk = key.toLowerCase();
      if (kk.endsWith(' ') || kk.length <= 3) { if (padded.includes(' ' + kk.trim() + ' ')) sc += 1 + kk.length / 10; }
      else if (padded.includes(kk)) sc += 1 + kk.length / 10;
    }
    if (sc > bestScore) { bestScore = sc; best = k; }
  }
  if (!best) return null;
  return { text: best.a, actions: best.open ? [{ id: best.open, label: 'Open ' + best.open.replace(/^./, (c) => c.toUpperCase()) }] : [] };
}

export function localAnswer(raw) {
  const q = raw.toLowerCase().trim();
  const kb = knowledgeAnswer(q);
  if (kb) return kb;
  const e = SITE.education;
  const open = (id, label) => ({ id, label });

  // a specific project mentioned by name or tech
  const proj = PROJECTS.find(
    (p) =>
      p.title
        .toLowerCase()
        .split(/[^a-z0-9-]+/)
        .filter((w) => w.length > 3 && !['this', 'site', 'system'].includes(w))
        .some((w) => q.includes(w)) || (p.tech || []).some((t) => t.length > 3 && q.includes(t.toLowerCase()))
  );
  if (proj && !has(q, 'projects', 'technolog')) {
    const bits = [`${proj.title}: ${proj.summary}`];
    if (proj.status) bits.push(`Status: ${proj.status}.`);
    if (proj.tech && proj.tech.length) bits.push(`Technologies: ${list(proj.tech)}.`);
    if (proj.contribution) bits.push(`Shubham's contribution: ${proj.contribution}`);
    else bits.push("Shubham hasn't added contribution details for this project yet.");
    return { text: bits.join(' '), actions: [open('projects', 'Open Projects')] };
  }

  if (has(q, 'contact', 'email', 'reach', 'hire', 'linkedin', 'github', 'connect')) {
    const parts = [];
    if (LINKS.email) parts.push(`email ${LINKS.email}`);
    if (LINKS.github) parts.push('GitHub');
    if (LINKS.linkedin) parts.push('LinkedIn');
    (LINKS.other || []).forEach((o) => parts.push(o.label));
    return {
      text: parts.length ? `You can reach Shubham via ${list(parts)}. The Contact zone has the links.` : "Shubham hasn't added contact links yet. Check back soon.",
      actions: [open('contact', 'Open Contact')],
    };
  }
  if (has(q, 'resume', 'cv')) {
    return {
      text: RESUME_URL ? "Shubham's resume is available to open or download from the Resume zone." : "The resume file hasn't been uploaded yet.",
      actions: [open('resume', 'Open Resume')],
    };
  }
  if (has(q, 'achievement', 'certificate', 'award', 'hackathon', 'competition', 'won')) {
    return {
      text: ACHIEVEMENTS.length ? `Verified entries: ${list(ACHIEVEMENTS.map((a) => a.title))}.` : "No verified achievements are listed yet, so I won't make any up. They'll appear in the Achievements zone once added.",
      actions: [open('achievements', 'Open Achievements')],
    };
  }
  if (has(q, 'technolog', 'tech', 'skill', 'stack', 'language', 'tools', 'used')) {
    const fromProjects = [...new Set(PROJECTS.flatMap((p) => p.tech || []))];
    const text = SKILLS.length
      ? `Verified skills: ${list(SKILLS)}.`
      : fromProjects.length
      ? `A verified skills list hasn't been added yet. His projects mention ${list(fromProjects)}, and his interests include ${list(ABOUT.interests.slice(0, 4)).toLowerCase()}.`
      : 'A verified skills list is not added yet.';
    return { text, actions: [open('projects', 'Open Projects')] };
  }
  if (has(q, 'project', 'built', 'build', 'made', 'work')) {
    return {
      text: `Projects: ${list(PROJECTS.map(projectLine))}. Ask about any one of them for details.`,
      actions: [open('projects', 'Open Projects')],
    };
  }
  if (has(q, 'learn', 'goal', 'studying', 'currently', 'future')) {
    return {
      text: `Shubham is studying for a ${e.degree} (${e.years}). ${ABOUT.goals.length ? 'Current goals: ' + list(ABOUT.goals) + '.' : "He hasn't listed specific learning goals yet."} His interests include ${list(ABOUT.interests.slice(0, 4)).toLowerCase()}.`,
      actions: [open('about', 'Open About Me')],
    };
  }
  if (has(q, 'educat', 'study', 'college', 'diploma', 'school', 'degree', 'background', 'university')) {
    return { text: `${e.degree} at ${e.school}, ${e.years}.`, actions: [open('about', 'Open About Me')] };
  }
  if (has(q, 'interest', 'hobby', 'like')) {
    return { text: `Interests: ${list(ABOUT.interests)}.`, actions: [open('about', 'Open About Me')] };
  }
  if (has(q, 'lab', 'model', 'predict', 'classif')) {
    return { text: 'The AI/ML Lab has a digit reader (a small neural network trained on the scikit-learn digits dataset, about 98% on held-out test images from that dataset, run in your browser), a k-nearest-neighbours playground and a workflow explorer.', actions: [open('lab', 'Open AI/ML Lab')] };
  }
  if (has(q, 'who', 'about', 'hello', 'hi ', 'hey', 'name', 'introduce') || q === 'hi') {
    return { text: `I'm the portfolio assistant. ${SITE.name} is an ${SITE.summary}`, actions: [open('about', 'Open About Me'), open('recruiter', 'Recruiter mode')] };
  }
  return {
    text: "I don't have that in my notes, and I won't guess. I'm a rule-based assistant, not an AI model. Try asking about Shubham's projects (line follower, Quiz Arena, SENTINEL-1, VOICEGUARD), clubs, hackathons, SG Emporium, education or how to contact him.",
    actions: [],
  };
}

// Returns { text, actions, source: 'rules' | 'backend' }
export async function ask(message) {
  const ep = CHAT.endpoint;
  if (ep && /^https:\/\//i.test(ep)) {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 9000);
      const res = await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }), signal: ctl.signal });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.reply === 'string' && data.reply.trim()) return { text: data.reply.trim(), actions: [], source: 'backend' };
      }
    } catch (err) {
      /* fall through to the local assistant */
    }
  }
  return { ...localAnswer(message), source: 'rules' };
}
