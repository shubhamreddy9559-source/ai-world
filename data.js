// =====================================================================
//  data.js — ALL editable portfolio content lives here.
//  Empty strings / empty arrays are placeholders. Nothing here is
//  invented: fill in only what is true and verifiable.
// =====================================================================

export const SITE = {
  name: 'Shubham Reddy',
  worldTitle: "SHUBHAM'S AI WORLD",
  tagline: 'EXPLORE. LEARN. INNOVATE.',
  role: 'AI/ML Student | Developer | Problem Solver',
  summary:
    'Diploma student in Artificial Intelligence and Machine Learning with interests in Python, web development, robotics, embedded systems and automation.',
  education: {
    degree: 'Diploma in Artificial Intelligence and Machine Learning',
    school: "K. E. Society's Rajarambapu Institute of Technology Polytechnic",
    years: '2025–2028',
  },
};

// Links: leave '' to hide. Email is used for a mailto: link.
export const LINKS = {
  email: '', // TODO: e.g. 'you@example.com'
  github: '', // TODO: e.g. 'https://github.com/yourname'
  linkedin: '', // TODO: e.g. 'https://www.linkedin.com/in/yourname'
  other: [
    // { label: 'Portfolio on Devpost', url: 'https://...' },
  ],
};

// Put your real PDF at assets/resume.pdf and set this to 'assets/resume.pdf'.
// While empty, the download button stays disabled (no broken link).
export const RESUME_URL = '';

export const ABOUT = {
  intro:
    "I'm a Diploma student in AI & Machine Learning who likes building practical things: web apps, embedded projects and interactive digital experiences.",
  interests: [
    'Artificial intelligence and machine learning',
    'Python and web development',
    'Interactive digital experiences',
    'Robotics and embedded systems',
    'Automation',
    'Innovative student projects',
    'Hackathons and practical problem-solving',
  ],
  journey: [], // TODO: e.g. [{ when: '2025', what: 'Started AIML diploma' }]
  approach: '', // TODO: 1–2 sentences on how you solve problems
  goals: [], // TODO: e.g. ['Learn PyTorch', 'Build a real image classifier']
};

// Verified skills only. No proficiency bars are shown on purpose.
export const SKILLS = []; // TODO: e.g. ['Python', 'HTML/CSS/JS', 'ESP32 (Arduino)']

// status: 'Completed' | 'In progress' | 'Concept' | '' (not set)
// Leave links '' to hide them. contribution = what YOU actually did.
export const PROJECTS = [
  {
    id: 'quiz-arena',
    title: 'Quiz Arena',
    summary: 'An interactive student quiz platform.',
    problem: '', // TODO
    tech: [], // TODO
    contribution: '', // TODO
    status: '', // TODO
    image: '', // TODO: 'assets/quiz-arena.png'
    demo: '',
    github: '',
  },
  {
    id: 'leo-idea-board',
    title: 'Leo Club Idea Board',
    summary: 'A community idea-sharing web application.',
    problem: '',
    tech: [],
    contribution: '',
    status: '',
    image: '',
    demo: '',
    github: '',
  },
  {
    id: 'ai-world',
    title: 'AI/ML Portfolio (this site)',
    summary: 'An immersive 3D portfolio built with Three.js.',
    problem: 'Showing projects in a memorable, explorable way instead of a standard page.',
    tech: ['HTML', 'CSS', 'JavaScript', 'Three.js'],
    contribution: '',
    status: 'In progress',
    image: '',
    demo: '',
    github: '',
  },
  {
    id: 'esp32-cam-attendance',
    title: 'ESP32-CAM Face Attendance System',
    summary: 'Face-based attendance using an ESP32-CAM.',
    problem: '',
    tech: ['ESP32-CAM'],
    contribution: '',
    status: 'Concept', // TODO: change if it is further along
    image: '',
    demo: '',
    github: '',
  },
  {
    id: 'esp32-line-follower',
    title: 'ESP32 Line-Following Robot',
    summary: 'A high-speed line-following robot built around an ESP32 with PID control.',
    problem: '',
    tech: ['ESP32 DevKit', 'TB6612FNG motor driver', 'N20 motors', '8-channel IR sensor array', '2S Li-ion', 'PID control'],
    contribution: '', // TODO: list only features actually implemented
    status: 'Built', // TODO: change if needed (e.g. 'Completed')
    image: '',
    demo: '',
    github: '',
  },
];

// Add ONLY verified entries. { title, type, issuer, date, url }
// type: 'Certificate' | 'Hackathon' | 'Competition' | 'Workshop' | 'Milestone' | 'Award'
export const ACHIEVEMENTS = [];

// Educational content for the AI/ML Lab workflow explorer (not a model demo).
export const ML_STEPS = [
  ['Collect data', 'Gather examples that represent the problem: images, text, sensor readings.'],
  ['Clean & label', 'Fix errors, remove duplicates and attach the correct answer (label) to each example.'],
  ['Split the data', 'Separate training, validation and test sets so results are measured on unseen data.'],
  ['Train a model', 'The algorithm adjusts its parameters to reduce error on the training data.'],
  ['Evaluate', 'Measure accuracy and other metrics on the test set; look for overfitting.'],
  ['Deploy & monitor', 'Use the model in an app and keep checking it as real-world data changes.'],
];

// Optional chatbot settings.
// endpoint: leave '' to use the built-in rule-based assistant (answers only from this file).
// To use a real AI model, deploy a small backend (e.g. a Cloudflare Worker) that keeps the API key
// secret and replies with JSON { "reply": "..." } to POST { "message": "..." }, then put its https URL here.
// NEVER put an API key in this file.
export const CHAT = {
  endpoint: '',
  suggestions: [
    'What is Shubham learning?',
    'What projects has he built?',
    'What technologies has he used?',
    'How can I contact him?',
    'What is his educational background?',
  ],
};

// Portals in the world. x,z = position on the island (start platform is at x:0, z:28, the AI Lab is far north).
// Each portal faces the start platform. Walk into a portal (or press E near it) to open it.
export const STATIONS = [
  { id: 'about', label: 'ABOUT ME', hex: 0xa855f7, css: '#a855f7', x: -34, z: -8, foot: 4 },
  { id: 'projects', label: 'PROJECTS', hex: 0xf59e0b, css: '#f59e0b', x: -13, z: -20, foot: 4 },
  { id: 'lab', label: 'AI/ML LAB', hex: 0x38bdf8, css: '#38bdf8', x: 0, z: -46, foot: 9, big: true },
  { id: 'achievements', label: 'ACHIEVEMENTS', hex: 0x22d3a6, css: '#22d3a6', x: 13, z: -20, foot: 4 },
  { id: 'resume', label: 'RESUME', hex: 0xff5a3c, css: '#ff5a3c', x: 34, z: -8, foot: 4 },
  { id: 'contact', label: 'CONTACT', hex: 0xec4899, css: '#ec4899', x: 35, z: 18, foot: 4 },
];
