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
export const SKILLS = ['Electronics and embedded systems', 'ESP32', 'PID control', 'HTML/CSS/JavaScript', 'Firebase Realtime Database', 'FastAPI'];

// status: 'Completed' | 'In progress' | 'Concept' | '' (not set)
// Leave links '' to hide them. contribution = what YOU actually did.
export const PROJECTS = [
  {
    id: 'quiz-arena',
    title: 'Quiz Arena',
    summary: 'A live quiz competition app: a host creates a room with a code, students join on their phones and compete.',
    problem: '', // TODO
    tech: ['Firebase Realtime Database', 'JavaScript'],
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
    id: 'sentinel-1',
    title: 'SENTINEL-1 (SIH 2026)',
    summary: 'AI-based satellite health monitoring: an ESP32 FlatSat with autoencoder anomaly detection.',
    problem: 'Spotting faults in satellite telemetry early.',
    tech: ['ESP32', 'Autoencoder', 'Telemetry simulator'],
    contribution: '',
    status: 'In progress',
    image: '',
    demo: '',
    github: '',
  },
  {
    id: 'voiceguard',
    title: 'VOICEGUARD (SIH 2026)',
    summary: 'Real-time voice cloning and impersonation detection with a three-layer fusion design.',
    problem: '',
    tech: ['FastAPI', 'JavaScript dashboard'],
    contribution: '',
    status: '',
    image: '',
    demo: '',
    github: '',
  },
  {
    id: 'intellix-rfid',
    title: 'Intellix RFID Member Cards',
    summary: "RFID member cards and a system for the Intellix AI Club's 15 students.",
    problem: '',
    tech: ['RFID'],
    contribution: '',
    status: 'In progress',
    image: '',
    demo: '',
    github: '',
  },
  {
    id: 'sg-emporium',
    title: 'SG Emporium (Shopify store)',
    summary: 'An Indian Shopify dropshipping store for home decor and lighting.',
    problem: '',
    tech: ['Shopify', 'Razorpay', 'Meta Ads research'],
    contribution: '',
    status: 'Live',
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
export const ACHIEVEMENTS = [
  { title: 'First prize with the ESP32 line-following robot', type: 'Competition', issuer: '', date: '', url: '' }, // TODO: add the competition name and date
];

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
// Knowledge the assistant can answer from. Only facts Shubham has stated. Add more any time.
// keys = words/phrases that trigger it; open = a zone the answer can link to.
export const KNOWLEDGE = [
  { keys: ['who are you', 'who is shubham', 'about shubham', 'introduce', 'yourself'], a: 'Shubham Reddy is a second-year Diploma student in AI & Machine Learning who likes building practical hardware and web projects: robots, ESP32 systems, quiz apps and an online store.', open: 'about' },
  { keys: ['college', 'institute', 'rit', 'school', 'where does he study', 'where study', 'diploma', 'year', 'branch', 'aiml'], a: "He studies Artificial Intelligence & Machine Learning (AIML branch), second year, at Rajarambapu Institute of Technology Polytechnic, Maharashtra.", open: 'about' },
  { keys: ['club', 'intellix', 'head', 'leader', 'leadership', 'position', 'role'], a: "Shubham is the Hardware Head of the Intellix AI Club, and he is also a member of his college robotics club's hardware department.", open: 'about' },
  { keys: ['robotics', 'robot club', 'hardware'], a: "He is part of the college robotics club's hardware department, which gives him access to better equipment for his builds. He has hands-on electronics and embedded systems experience.", open: 'projects' },
  { keys: ['line follower', 'line-follower', 'line following', 'pid', 'tb6612', 'n20', 'motor'], a: "His ESP32 line follower is a high-speed robot with a TB6612FNG motor driver, N20 1000 RPM motors, an 8-channel analog IR sensor array (4 channels used), a 2S Li-ion battery and PID control with calibration. He worked through wiring, driver and power debugging, ADC2/WiFi conflicts and motor stalls. It won first prize in a competition.", open: 'projects' },
  { keys: ['prize', 'won', 'win', 'award', 'achievement', 'competition', 'first prize'], a: "Verified so far: first prize in a competition with his ESP32 line-following robot. The competition name and date are still to be added, and I won't invent anything else.", open: 'achievements' },
  { keys: ['quiz', 'arena', 'firebase'], a: "Quiz Arena is a live quiz competition app he built on his phone with Firebase Realtime Database. A host creates a room with a code, students join and compete. Questions show on a smart board while each student's phone shows only the answer options, shuffled differently on every phone. It has been used for batch-based Marathi/Hindi vocabulary quizzes.", open: 'projects' },
  { keys: ['sih', 'smart india', 'hackathon', 'cybertitans', 'team'], a: "For Smart India Hackathon 2026 his team is called CyberTitans. Project tracks he has worked on: SENTINEL-1 (satellite health monitoring) and VOICEGUARD (voice-clone detection).", open: 'projects' },
  { keys: ['sentinel', 'satellite', 'cubesat', 'flatsat', 'autoencoder', 'anomaly'], a: "SENTINEL-1 is an AI-based satellite health monitoring project: an ESP32 FlatSat plus a physics-based LEO cubesat telemetry simulator and an unsupervised autoencoder for anomaly detection. In his simulated testing it reached 23/24 correct fault attribution. The deliverables include firmware, a dashboard, a 3D model, a presentation deck and a procurement workbook.", open: 'projects' },
  { keys: ['voiceguard', 'voice', 'clone', 'impersonation', 'deepfake', 'fastapi'], a: "VOICEGUARD is a real-time voice cloning / impersonation detection system with a three-layer fusion architecture. The repository has a FastAPI backend and a JavaScript dashboard.", open: 'projects' },
  { keys: ['rfid', 'id card', 'member card'], a: "He is building RFID member cards and a system around them for the 15 students of the Intellix AI Club.", open: 'projects' },
  { keys: ['shopify', 'store', 'sg emporium', 'dropship', 'business', 'ecommerce', 'e-commerce', 'instagram', 'entrepreneur'], a: "He runs SG Emporium, an Indian Shopify dropshipping store for home decor and lighting with a navy-gold look. It is set up with Razorpay and COD, and he built a two-agent product-scouting tool to find trending products. Instagram: sg_emporium06.", open: 'projects' },
  { keys: ['esp32-cam', 'face attendance', 'attendance', 'camera'], a: 'The ESP32-CAM Face Attendance System is a concept/work in progress: face-based attendance using an ESP32-CAM.', open: 'projects' },
  { keys: ['leo', 'idea board'], a: 'Leo Club Idea Board is a community idea-sharing web application. Details are still to be added by Shubham.', open: 'projects' },
  { keys: ['this site', 'this portfolio', 'ai world', 'three.js', 'threejs', 'how was this made', 'website'], a: "This portfolio is plain HTML, CSS and JavaScript with Three.js, built and tested on an Android phone. It has floating islands, a robot, a dog (me, Byte!) and mini-games on every island.", open: 'projects' },
  { keys: ['esp32', 'arduino', 'embedded', 'electronics', 'iot', 'sensor'], a: 'He has hands-on electronics and embedded-systems experience, mainly with ESP32 boards: line follower, ESP32-CAM, a FlatSat for SENTINEL-1 and RFID work.', open: 'projects' },
  { keys: ['python', 'javascript', 'web', 'html', 'code', 'coding', 'programming', 'language'], a: 'He works with Python, HTML/CSS/JavaScript, Firebase and FastAPI, plus Arduino-style firmware on ESP32.', open: 'projects' },
  { keys: ['digit', 'neural', 'trained', 'train', 'mlp', 'handwritten', 'mnist'], a: 'The AI/ML Lab has a digit reader: a small neural network (64-64-10) trained on the scikit-learn digits dataset. It scored about 98% on 450 held-out test images from that dataset. Redrawn on a canvas through the drawing pipeline of this page it got about 91%, and real finger drawings can differ. It was trained as a demo, not part of his other projects.', open: 'lab' },
  { keys: ['ai ', 'ml', 'machine learning', 'artificial', 'model', 'learning'], a: "He is studying AI & ML and has applied it to anomaly detection (autoencoder) in SENTINEL-1 and voice-clone detection in VOICEGUARD.", open: 'lab' },
  { keys: ['hire', 'internship', 'job', 'opportunit', 'available', 'work with'], a: "Shubham is looking for internship and hands-on opportunities, especially in AI/ML, embedded systems and web projects. Use the Contact zone to reach him.", open: 'contact' },
  { keys: ['what can you do', 'help', 'what do you know', 'how to use'], a: "I'm Byte, a rule-based assistant (not a large AI model). I know Shubham's education, clubs, projects, hardware, hackathons, store and goals. Ask me about any of them!", open: '' },
  { keys: ['thank', 'thanks', 'great', 'nice', 'cool', 'awesome'], a: "You're welcome! Woof! Ask me anything else about Shubham.", open: '' },
  { keys: ['bye', 'goodbye', 'see you'], a: 'Bye! Come back and explore more islands soon.', open: '' },
  { keys: ['hello', 'hey', 'hi'], a: "Woof! I'm Byte, Shubham's robot dog. Ask me about his projects, clubs, hackathons, store or how to contact him.", open: '' },
];

export const CHAT = {
  endpoint: '',
  suggestions: [
    'What is Shubham learning?',
    'What projects has he built?',
    'What technologies has he used?',
    'How can I contact him?',
    'What is his educational background?',
    'Tell me about his line follower',
    'What is SENTINEL-1?',
    'Which clubs is he in?',
    'What is SG Emporium?',
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
