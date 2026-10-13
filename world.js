// =====================================================================
//  world.js — twilight tech island: a walking robot explores an AI
//  campus (AI Lab tower, About, Projects, Achievements, Resume, Contact)
//  surrounded by floating islands and waterfalls.
//  Loaded with a dynamic import from main.js so the site still works
//  (menu + panels + chat) if Three.js or WebGL is unavailable.
// =====================================================================
import * as THREE from 'three';
import { STATIONS } from './data.js';

const ISLAND_R = 48;
const WALK_R = 44;
const WALK = 6.5;
const RUN = 11;
const GRAV = 24;
const JUMP_V = 8.5;
const START = { x: 0, z: 22 };
const HUB = { x: 0, z: 6 };
const PLAT_R = 8;
const PONDS = [
  { x: -14, z: 14, r: 5 },
  { x: 14, z: 30, r: 5 },
];

const rand = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const glowTexture = () =>
  canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.3, 'rgba(255,255,255,0.35)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
  });

function windowTexture(seed, tint) {
  const r = rand(seed);
  const t = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#0d1630';
    g.fillRect(0, 0, w, h);
    const cols = ['#67e8f9', '#fbbf24', '#c4b5fd', tint];
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 6; x++) {
        g.fillStyle = r() < 0.45 ? cols[(r() * cols.length) | 0] : '#16224a';
        g.fillRect(6 + x * 20, 6 + y * 15, 12, 9);
      }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function stoneTexture(segments, hubs) {
  const S = 1024;
  const k = S / 2 / ISLAND_R;
  return canvasTex(S, S, (g) => {
    g.fillStyle = '#1a2646';
    g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(70,100,170,.28)';
    g.lineWidth = 1;
    for (let i = 0; i <= S; i += 32) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, S);
      g.moveTo(0, i);
      g.lineTo(S, i);
      g.stroke();
    }
    // mossy glow toward the edge
    const gr = g.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S / 2);
    gr.addColorStop(0, 'rgba(20,80,70,0)');
    gr.addColorStop(1, 'rgba(20,110,90,.75)');
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
    const px = (v) => S / 2 + v * k;
    g.lineCap = 'round';
    // paths: dark edge, light stone, glowing centre line
    [['#0c1430', 6.4], ['#34477a', 5.2]].forEach(([col, w]) => {
      g.strokeStyle = col;
      g.fillStyle = col;
      g.lineWidth = w * k;
      segments.forEach(([a, b]) => {
        g.beginPath();
        g.moveTo(px(a.x), px(a.z));
        g.lineTo(px(b.x), px(b.z));
        g.stroke();
      });
      hubs.forEach((h) => {
        g.beginPath();
        g.arc(px(h.x), px(h.z), (h.r + (w > 6 ? 0.7 : 0)) * k, 0, 7);
        g.fill();
      });
    });
    g.strokeStyle = 'rgba(56,189,248,.55)';
    g.lineWidth = 0.16 * k;
    segments.forEach(([a, b]) => {
      g.beginPath();
      g.moveTo(px(a.x), px(a.z));
      g.lineTo(px(b.x), px(b.z));
      g.stroke();
    });
    hubs.forEach((h) => {
      g.beginPath();
      g.arc(px(h.x), px(h.z), (h.r - 0.5) * k, 0, 7);
      g.stroke();
    });
  });
}

function labelSprite(text, css, sx = 6.4, fontPx = 56) {
  const tex = canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = 'rgba(6,12,34,0.9)';
    g.strokeStyle = css;
    g.lineWidth = 8;
    const r = 26;
    g.beginPath();
    g.moveTo(r, 6);
    g.arcTo(w - 6, 6, w - 6, h - 6, r);
    g.arcTo(w - 6, h - 6, 6, h - 6, r);
    g.arcTo(6, h - 6, 6, 6, r);
    g.arcTo(6, 6, w - 6, 6, r);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = '#fff';
    g.font = `800 ${fontPx}px system-ui, Segoe UI, Roboto, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 3);
  });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  sp.scale.set(sx, sx / 4, 1);
  return sp;
}

function doorMaterial(hex) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(hex) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float uTime; uniform vec3 uColor;
      void main(){ vec2 p=(vUv-.5)*2.; float r=length(p); float a=atan(p.y,p.x);
        float sw=sin(a*5.+r*9.-uTime*2.)*.5+.5; float gl=smoothstep(1.2,0.,r);
        vec3 col=mix(uColor*.45,uColor+vec3(.35),sw*gl)+vec3(.1)*gl;
        float al=(.5+.5*gl)*smoothstep(1.3,.95,r);
        gl_FragColor=vec4(col,al); }`,
  });
}

export function createWorld(canvas, opts = {}) {
  const isMobile = matchMedia('(pointer:coarse)').matches || innerWidth < 760;
  const lowEnd = (navigator.hardwareConcurrency || 4) <= 4;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const timeScale = reduceMotion ? 0.15 : 1;
  let qualityMode = 'auto';
  let quality = isMobile || lowEnd ? 'low' : 'high';

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === 'high', powerPreference: 'default' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    opts.onError && opts.onError('The graphics context was lost. Reload the page, or use the menu to browse.');
  });

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x15335a, 0.0075);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1200);

  const lam = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
  const std = (c, m = 0.6, r = 0.45) => new THREE.MeshStandardMaterial({ color: c, metalness: m, roughness: r });
  const basic = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false, ...extra });
  const mesh = (geo, mat, cast = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast;
    m.receiveShadow = true;
    return m;
  };
  const anims = [];
  const glowTex = glowTexture();
  const glowSprite = (hex, size, opacity = 0.8) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: hex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity }));
    s.scale.set(size, size, 1);
    s.raycast = () => {};
    return s;
  };

  // ---------------- lights ----------------
  scene.add(new THREE.HemisphereLight(0x7fb2ff, 0x1a2a4a, 1.0));
  const moonLight = new THREE.DirectionalLight(0xaec6ff, 1.5);
  moonLight.position.set(-30, 45, 20);
  moonLight.shadow.mapSize.set(1024, 1024);
  const sc = moonLight.shadow.camera;
  sc.left = sc.bottom = -34;
  sc.right = sc.top = 34;
  sc.near = 1;
  sc.far = 120;
  scene.add(moonLight, moonLight.target);
  const rim = new THREE.DirectionalLight(0x8b5cf6, 0.5);
  rim.position.set(25, 14, -30);
  scene.add(rim);

  // ---------------- sky ----------------
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(550, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader:
        'varying vec3 vP; void main(){ float h=normalize(vP).y; vec3 top=vec3(.02,.05,.17); vec3 mid=vec3(.08,.24,.46); vec3 hor=vec3(.28,.62,.74); vec3 c=mix(hor,mid,smoothstep(0.,.3,h)); c=mix(c,top,smoothstep(.25,.85,h)); gl_FragColor=vec4(c,1.); }',
    })
  );
  scene.add(sky);
  const starCount = 600;
  const sp = new Float32Array(starCount * 3);
  const rs = rand(7);
  for (let i = 0; i < starCount; i++) {
    const u = rs() * Math.PI * 2;
    const v = Math.acos(0.15 + rs() * 0.85);
    sp[i * 3] = 500 * Math.sin(v) * Math.cos(u);
    sp[i * 3 + 1] = 500 * Math.cos(v);
    sp[i * 3 + 2] = 500 * Math.sin(v) * Math.sin(u);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xcfe0ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 }));
  scene.add(stars);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(22, 24, 16), basic(0xe6eeff, { fog: false }));
  const moonGlow = glowSprite(0x7aa2ff, 140, 0.6);
  moonGlow.material.fog = false;
  moon.add(moonGlow);
  scene.add(moon);

  // ---------------- layout helpers ----------------
  const defs = STATIONS.map((d) => {
    const dx = START.x - d.x;
    const dz = START.z - d.z;
    const l = Math.hypot(dx, dz) || 1;
    const dir = { x: dx / l, z: dz / l };
    const doorDist = d.foot + (d.big ? 2.8 : 1.7);
    return { ...d, dir, door: { x: d.x + dir.x * doorDist, z: d.z + dir.z * doorDist }, reach: d.foot + (d.big ? 5 : 4) };
  });
  const segments = [[{ x: 0, z: PLAT_R + 2 }, HUB], ...defs.map((d) => [HUB, d.door])];
  const hubs = [
    { x: HUB.x, z: HUB.z, r: 6 },
    { x: START.x, z: START.z, r: PLAT_R + 1 },
    ...defs.map((d) => ({ x: d.door.x, z: d.door.z, r: 2.9 })),
  ];

  // ---------------- island ----------------
  const rock = lam(0x1e2748, { flatShading: true });
  const ground = mesh(
    new THREE.CylinderGeometry(ISLAND_R, ISLAND_R - 2, 1.2, 72),
    [rock, new THREE.MeshStandardMaterial({ map: stoneTexture(segments, hubs), metalness: 0.35, roughness: 0.7 }), rock],
    false
  );
  ground.position.y = -0.6;
  scene.add(ground);
  const under = mesh(new THREE.ConeGeometry(ISLAND_R - 2, 34, 24), rock, false);
  under.rotation.x = Math.PI;
  under.position.y = -18;
  scene.add(under);
  const edge = new THREE.Mesh(new THREE.TorusGeometry(ISLAND_R - 0.3, 0.16, 8, 120), basic(0x38bdf8));
  edge.rotation.x = Math.PI / 2;
  edge.position.y = 0.05;
  scene.add(edge);

  // waterfalls (scrolling streak texture)
  const wfTex = canvasTex(64, 256, (g, w, h) => {
    const r = rand(5);
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      g.fillStyle = `rgba(190,235,255,${0.25 + r() * 0.5})`;
      g.fillRect(r() * w, r() * h, 2 + r() * 4, 30 + r() * 90);
    }
  });
  wfTex.wrapS = wfTex.wrapT = THREE.RepeatWrapping;
  wfTex.repeat.set(1, 3);
  const wfMat = new THREE.MeshBasicMaterial({ map: wfTex, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, color: 0x9fd8ff });
  const waterfalls = [];
  function waterfall(x, y, z, nx, nz, w, h) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wfMat);
    m.position.set(x, y - h / 2, z);
    m.rotation.y = Math.atan2(nx, nz);
    scene.add(m);
    const mist = glowSprite(0xbfe9ff, w * 3.2, 0.35);
    mist.position.set(x + nx * 1.5, y - h, z + nz * 1.5);
    scene.add(mist);
    waterfalls.push(m, mist);
  }
  [-0.9, 0.55, 2.5].forEach((a) => waterfall(Math.sin(a) * ISLAND_R, 0, -Math.cos(a) * ISLAND_R, Math.sin(a), -Math.cos(a), 5, 70));
  anims.push((t) => (wfTex.offset.y = -((t * 0.5) % 1)));

  // ponds
  const pondMat = basic(0x1fb6d6, { transparent: true, opacity: 0.75 });
  PONDS.forEach((p) => {
    const w = new THREE.Mesh(new THREE.CircleGeometry(p.r, 36), pondMat);
    w.rotation.x = -Math.PI / 2;
    w.position.set(p.x, 0.07, p.z);
    scene.add(w);
    const rim2 = new THREE.Mesh(new THREE.RingGeometry(p.r, p.r + 0.5, 36), lam(0x3a4d85));
    rim2.rotation.x = -Math.PI / 2;
    rim2.position.set(p.x, 0.09, p.z);
    rim2.receiveShadow = true;
    scene.add(rim2);
  });
  anims.push((t) => (pondMat.opacity = 0.65 + Math.sin(t * 1.3) * 0.1));

  // ---------------- colliders ----------------
  const statics = [];
  const addStatic = (x, z, r) => statics.push({ x, z, r });
  PONDS.forEach((p) => addStatic(p.x, p.z, p.r + 0.4));

  // ---------------- start platform ----------------
  const plat = new THREE.Group();
  plat.position.set(START.x, 0, START.z);
  plat.add(mesh(new THREE.CylinderGeometry(PLAT_R, PLAT_R + 0.4, 0.3, 56).translate(0, 0.05, 0), std(0x1b2442, 0.7, 0.4)));
  [[PLAT_R - 0.5, 0.12, 0x38bdf8], [PLAT_R - 2.2, 0.1, 0xff9a3c], [3, 0.08, 0x38bdf8]].forEach(([r, w, c]) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, w, 8, 72), basic(c));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.22;
    plat.add(ring);
  });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 2.6), basic(0x38bdf8, { transparent: true, opacity: 0.6 }));
    seg.position.set(Math.sin(a) * 5.6, 0.2, Math.cos(a) * 5.6);
    seg.rotation.y = a;
    plat.add(seg);
  }
  const platGlow = glowSprite(0x38bdf8, 20, 0.35);
  platGlow.position.set(0, 0.5, 0);
  plat.add(platGlow);
  scene.add(plat);

  // ---------------- stations ----------------
  const stationGroups = [];
  const doorMats = [];
  function buildStation(def) {
    const big = !!def.big;
    const g = new THREE.Group();
    const accent = basic(def.hex);
    const W = big ? 14 : def.id === 'contact' ? 4.2 : 4.8;
    const H = big ? 6 : { about: 5.6, projects: 4.4, achievements: 6.4, resume: 4.4, contact: 3.8 }[def.id];
    const D = big ? 10 : 4.4;
    const tint = '#' + def.hex.toString(16).padStart(6, '0');
    const add = (m, x, y, z) => {
      m.position.set(x, y, z);
      g.add(m);
      return m;
    };
    const winMat = (w, h, seed) => {
      const t = windowTexture(seed, tint);
      t.repeat.set(w, h);
      t.needsUpdate = true;
      return new THREE.MeshLambertMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.9 });
    };
    const seed = 100 + defs.indexOf(def) * 17;
    const metal = std(0x1c2a4e, 0.6, 0.45);
    // base platform with glowing edge
    add(mesh(new THREE.CylinderGeometry(big ? 10.5 : 4.6, big ? 11 : 5, 0.5, 8), std(0x141c38, 0.7, 0.4)), 0, 0.25, 0);
    const baseRing = new THREE.Mesh(new THREE.TorusGeometry(big ? 10.4 : 4.55, 0.09, 6, 8), accent);
    baseRing.rotation.set(Math.PI / 2, 0, Math.PI / 8);
    add(baseRing, 0, 0.52, 0);
    // body
    const side = winMat(W / 4, H / 3.5, seed);
    const front = winMat(W / 4, H / 3.5, seed + 3);
    add(mesh(new THREE.BoxGeometry(W, H, D), [side, side, metal, metal, front, front]), 0, 0.5 + H / 2, 0);
    [0.7, 0.5 + H - 0.18].forEach((y) => add(new THREE.Mesh(new THREE.BoxGeometry(W + 0.2, 0.16, D + 0.2), accent), 0, y, 0));
    // door
    const dw = big ? 4.2 : 1.9;
    const dh = big ? 5 : 3.2;
    const zf = D / 2 + 0.04;
    add(new THREE.Mesh(new THREE.PlaneGeometry(dw, dh), basic(0x050a18)), 0, 0.5 + dh / 2, zf);
    const dm = doorMaterial(def.hex);
    doorMats.push(dm);
    add(new THREE.Mesh(new THREE.PlaneGeometry(dw, dh), dm), 0, 0.5 + dh / 2, zf + 0.03);
    [-1, 1].forEach((s) => add(mesh(new THREE.BoxGeometry(0.28, dh, 0.35), metal), s * (dw / 2 + 0.14), 0.5 + dh / 2, zf + 0.1));
    add(mesh(new THREE.BoxGeometry(dw + 0.8, 0.3, 0.4), metal), 0, 0.5 + dh + 0.1, zf + 0.1);
    add(new THREE.Mesh(new THREE.BoxGeometry(dw + 0.8, 0.07, 0.42), accent), 0, 0.5 + dh + 0.28, zf + 0.1);
    add(Object.assign(glowSprite(def.hex, big ? 11 : 6, 0.55), {}), 0, 0.5 + dh * 0.5, zf + 1.2);

    const topY = 0.5 + H;
    let signY = topY + 1.6;
    switch (def.id) {
      case 'about': {
        add(mesh(new THREE.BoxGeometry(W + 0.8, 0.3, D + 0.8), metal), 0, topY + 0.15, 0);
        add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 2, 6), metal), 1.4, topY + 1.3, 0);
        const bulb = add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), accent), 1.4, topY + 2.4, 0);
        anims.push((t) => (bulb.scale.setScalar(1 + Math.sin(t * 3) * 0.25)));
        signY = topY + 3.4;
        break;
      }
      case 'projects': {
        add(mesh(new THREE.BoxGeometry(W + 0.8, 0.3, D + 0.8), metal), 0, topY + 0.15, 0);
        const cubes = [0, 1, 2].map(() => add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), basic(def.hex, { wireframe: true })), 0, topY + 2, 0));
        anims.push((t) =>
          cubes.forEach((c, i) => {
            c.position.set((i - 1) * 1.5, topY + 1.8 + Math.sin(t * 1.3 + i) * 0.3, 0);
            c.rotation.set(t + i, t * 0.8 + i, 0);
          })
        );
        signY = topY + 3.4;
        break;
      }
      case 'achievements': {
        add(mesh(new THREE.ConeGeometry(2.4, 2, 8), metal), 0, topY + 1, 0);
        const gold = basic(0xfbbf24);
        const tr = new THREE.Group();
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.28, 0.7, 14), gold);
        cup.position.y = 0.55;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.4, 8), gold);
        const tb = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.6), gold);
        tb.position.y = -0.2;
        tr.add(cup, stem, tb);
        add(tr, 0, topY + 3, 0);
        anims.push((t) => {
          tr.rotation.y = t * 1.1;
          tr.position.y = topY + 3 + Math.sin(t * 1.4) * 0.2;
        });
        signY = topY + 4.6;
        break;
      }
      case 'resume': {
        add(mesh(new THREE.BoxGeometry(W + 0.8, 0.3, D + 0.8), metal), 0, topY + 0.15, 0);
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.4), basic(def.hex, { transparent: true, opacity: 0.85 }));
        scr.rotation.x = -0.3;
        add(scr, 0, topY + 1.3, 0.8);
        signY = topY + 3.2;
        break;
      }
      case 'contact': {
        add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.6, 8), metal), 0, topY + 0.8, 0);
        const dish = new THREE.Group();
        const bowl = mesh(new THREE.SphereGeometry(1.2, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(0xe8eefc, 0.3, 0.4));
        bowl.material.side = THREE.DoubleSide;
        bowl.rotation.x = Math.PI * 0.75;
        dish.add(bowl, new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), accent));
        add(dish, 0, topY + 2, 0);
        anims.push((t) => (dish.rotation.y = Math.sin(t * 0.5) * 1.2));
        signY = topY + 4;
        break;
      }
      case 'lab': {
        // upper tiers
        const t2 = add(mesh(new THREE.BoxGeometry(9, 6, 7), [winMat(2, 1.6, 211), winMat(2, 1.6, 212), metal, metal, winMat(2, 1.6, 213), winMat(2, 1.6, 214)]), 0, 0.5 + H + 3, 0);
        add(new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.16, 7.2), accent), 0, 0.5 + H + 0.1, 0);
        add(mesh(new THREE.BoxGeometry(5.4, 7, 4.6), [winMat(1.4, 2, 221), winMat(1.4, 2, 222), metal, metal, winMat(1.4, 2, 223), winMat(1.4, 2, 224)]), 0, 0.5 + H + 6 + 3.5, 0);
        add(new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.16, 4.8), accent), 0, 0.5 + H + 6 + 0.1, 0);
        add(mesh(new THREE.CylinderGeometry(0.15, 0.35, 5, 8), metal), 0, 0.5 + H + 13 + 2.5, 0);
        const orb = add(new THREE.Mesh(new THREE.SphereGeometry(0.7, 14, 10), accent), 0, 0.5 + H + 13 + 5.2, 0);
        anims.push((t) => orb.scale.setScalar(1 + Math.sin(t * 2.2) * 0.2));
        [[7.2, 12.5, 1.3], [5, 18, 1.1]].forEach(([r, y, s]) => {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.12, 8, 56), accent);
          ring.rotation.x = Math.PI / 2;
          g.add(ring);
          anims.push((t) => {
            ring.position.y = y + Math.sin(t * 0.8 * s) * 0.5;
            ring.rotation.z = t * 0.5 * s;
          });
        });
        // side wings
        [-1, 1].forEach((s2) => {
          add(mesh(new THREE.BoxGeometry(3.4, 4, 6), [winMat(1, 1.2, 231 + s2), winMat(1, 1.2, 233 + s2), metal, metal, winMat(1, 1.2, 235 + s2), winMat(1, 1.2, 237 + s2)]), s2 * 8.6, 2.5, -1);
        });
        add(Object.assign(glowSprite(0x38bdf8, 40, 0.28), {}), 0, 18, 0);
        const aiWorld = labelSprite('AI WORLD', def.css, 8.5, 62);
        aiWorld.position.set(0, 0.5 + H + 13 + 8.4, 0);
        g.add(aiWorld);
        signY = 0.5 + dh + 1.7;
        const fronts = labelSprite('AI LAB', def.css, 6.4, 62);
        fronts.position.set(0, signY, D / 2 + 1);
        g.add(fronts);
        signY = -1;
        void t2;
        break;
      }
    }
    if (signY > 0) {
      const sign = labelSprite(def.label, def.css, 5.8);
      sign.position.set(0, signY + 0.4, 0);
      g.add(sign);
    }
    // interaction pad in front of the door
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.7, 2.0, 40), basic(def.hex, { transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.raycast = () => {};
    const dd = Math.hypot(def.door.x - def.x, def.door.z - def.z);
    ring.position.set(0, 0.06, dd);
    g.add(ring);

    g.position.set(def.x, 0, def.z);
    g.rotation.y = Math.atan2(def.dir.x, def.dir.z);
    g.userData = { stationId: def.id, ring };
    scene.add(g);
    stationGroups.push(g);
    if (big) {
      addStatic(def.x, def.z, 6.4);
      addStatic(def.x - 4.8, def.z, 4.4);
      addStatic(def.x + 4.8, def.z, 4.4);
      addStatic(def.x - 8.6, def.z - 1, 2.6);
      addStatic(def.x + 8.6, def.z - 1, 2.6);
    } else addStatic(def.x, def.z, def.foot);
  }
  defs.forEach(buildStation);
  anims.push((t) => doorMats.forEach((m) => (m.uniforms.uTime.value = t)));

  // station point light (high quality only)
  const labDef = defs.find((d) => d.id === 'lab');
  const labLight = new THREE.PointLight(0x38bdf8, 260, 70, 2);
  labLight.position.set(labDef.x, 8, labDef.z + 9);
  scene.add(labLight);

  // ---------------- trees, lamps ----------------
  const segDist = (px, pz, a, b) => {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const t = clamp(((px - a.x) * dx + (pz - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
    return Math.hypot(px - (a.x + dx * t), pz - (a.z + dz * t));
  };
  const blocked = (x, z, m) =>
    segments.some(([a, b]) => segDist(x, z, a, b) < m + 2.6) ||
    hubs.some((h) => Math.hypot(x - h.x, z - h.z) < h.r + m) ||
    PONDS.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + m) ||
    defs.some((d) => Math.hypot(x - d.x, z - d.z) < d.foot + m + 2) ||
    Math.hypot(x - START.x, z - START.z) < PLAT_R + m;
  const m4 = new THREE.Matrix4();
  const qn = new THREE.Quaternion();
  const col = new THREE.Color();
  const rt = rand(77);
  const spots = [];
  for (let tries = 0; tries < 1500 && spots.length < 46; tries++) {
    const a = rt() * Math.PI * 2;
    const r = 8 + rt() * (WALK_R - 10);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (blocked(x, z, 2.2) || spots.some((s) => Math.hypot(s.x - x, s.z - z) < 4.5)) continue;
    spots.push({ x, z, s: 0.8 + rt() * 0.8 });
  }
  const foliage = new THREE.InstancedMesh(new THREE.ConeGeometry(1.6, 4, 7).translate(0, 3.6, 0), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x0a4a52, emissiveIntensity: 0.9 }), spots.length);
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.35, 1.8, 6).translate(0, 0.9, 0), lam(0x3a2a4a), spots.length);
  foliage.castShadow = trunks.castShadow = true;
  const tcols = [0x1f9d8a, 0x2bb6a0, 0x6d4bd0, 0x2f7fd0];
  spots.forEach((t, i) => {
    m4.compose(new THREE.Vector3(t.x, 0, t.z), qn, new THREE.Vector3(t.s, t.s, t.s));
    foliage.setMatrixAt(i, m4);
    trunks.setMatrixAt(i, m4);
    foliage.setColorAt(i, col.setHex(tcols[i % 4]));
    addStatic(t.x, t.z, 0.8 * t.s);
  });
  scene.add(foliage, trunks);

  // lamp posts along the paths
  const lampPts = [];
  segments.forEach(([a, b]) => {
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const nx = -(b.z - a.z) / len;
    const nz = (b.x - a.x) / len;
    for (let d = 5; d < len - 3; d += 8) {
      const x = a.x + ((b.x - a.x) * d) / len;
      const z = a.z + ((b.z - a.z) * d) / len;
      [-1, 1].forEach((s) => {
        const px = x + nx * 3.4 * s;
        const pz = z + nz * 3.4 * s;
        if (!PONDS.some((p) => Math.hypot(px - p.x, pz - p.z) < p.r + 1) && !defs.some((q) => Math.hypot(px - q.x, pz - q.z) < q.foot + 1.5)) lampPts.push({ x: px, z: pz });
      });
    }
  });
  const lampPoles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.12, 2.4, 6).translate(0, 1.2, 0), lam(0x232f58), lampPts.length);
  const lampHeads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.3, 10, 8), basic(0x67e8f9), lampPts.length);
  lampPts.forEach((p, i) => {
    m4.compose(new THREE.Vector3(p.x, 0, p.z), qn, new THREE.Vector3(1, 1, 1));
    lampPoles.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(p.x, 2.55, p.z), qn, new THREE.Vector3(1, 1, 1));
    lampHeads.setMatrixAt(i, m4);
  });
  scene.add(lampPoles, lampHeads);

  // ---------------- floating islands + city skyline ----------------
  const islands = [];
  const ri = rand(2024);
  const towerWin = windowTexture(999, '#c4b5fd');
  towerWin.repeat.set(1, 2.4);
  const towerMat = new THREE.MeshLambertMaterial({ map: towerWin, emissiveMap: towerWin, emissive: 0xffffff, emissiveIntensity: 0.85 });
  for (let i = 0; i < 13; i++) {
    const a = (-0.5 + i / 12) * Math.PI * 1.55 + (ri() - 0.5) * 0.2 + Math.PI; // spread across the northern half
    const ang = a - Math.PI;
    const r = 78 + ri() * 55;
    const s = 6 + ri() * 9;
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(s, s * 0.85, 1.4, 14), new THREE.MeshLambertMaterial({ color: 0x14465a, emissive: 0x062a33, emissiveIntensity: 0.6 }), false));
    const bot = mesh(new THREE.ConeGeometry(s * 0.85, s * 1.8, 10), rock, false);
    bot.rotation.x = Math.PI;
    bot.position.y = -0.7 - s * 0.9;
    g.add(bot);
    const nT = 2 + ((ri() * 4) | 0);
    for (let k = 0; k < nT; k++) {
      const tw = 2 + ri() * 2.4;
      const th = 7 + ri() * 22;
      const tower = mesh(new THREE.BoxGeometry(tw, th, tw), towerMat, false);
      const ox = (ri() - 0.5) * s * 1.1;
      const oz = (ri() - 0.5) * s * 1.1;
      tower.position.set(ox, 0.7 + th / 2, oz);
      g.add(tower);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(tw + 0.2, 0.25, tw + 0.2), basic(ri() < 0.5 ? 0x38bdf8 : 0xa855f7));
      cap.position.set(ox, 0.7 + th, oz);
      g.add(cap);
    }
    for (let k = 0; k < 3; k++) {
      const tr = new THREE.Mesh(new THREE.ConeGeometry(1, 3, 6), new THREE.MeshLambertMaterial({ color: 0x1f9d8a, emissive: 0x0a4a52, emissiveIntensity: 0.9 }));
      tr.position.set((ri() - 0.5) * s * 1.4, 2.2, (ri() - 0.5) * s * 1.4);
      g.add(tr);
    }
    const y = 4 + ri() * 36;
    g.position.set(Math.sin(ang) * r, y, -Math.cos(ang) * r);
    const phase = ri() * 6;
    anims.push((t) => (g.position.y = y + Math.sin(t * 0.35 + phase) * 0.7));
    scene.add(g);
    islands.push(g);
    if (i % 3 === 0) waterfall(g.position.x + Math.sin(ang) * (s - 0.5), y, g.position.z - Math.cos(ang) * (s - 0.5), Math.sin(ang), -Math.cos(ang), 3, 55);
  }

  // spaceship flying a loop
  const ship = new THREE.Group();
  const hull = mesh(new THREE.ConeGeometry(0.9, 4, 8).rotateX(Math.PI / 2), std(0xcfd8ff, 0.5, 0.3), false);
  const wing = mesh(new THREE.BoxGeometry(5, 0.12, 1.4), std(0x2a3a6b, 0.6, 0.4), false);
  wing.position.z = -0.5;
  ship.add(hull, wing);
  [-1, 1].forEach((s) => {
    const e = glowSprite(0x38bdf8, 2.2, 0.9);
    e.position.set(s * 1.8, 0, -1.5);
    ship.add(e);
  });
  scene.add(ship);
  anims.push((t) => {
    const a = t * 0.12;
    ship.position.set(Math.cos(a) * 70, 30 + Math.sin(t * 0.7) * 2, -10 + Math.sin(a) * 60);
    ship.rotation.y = Math.atan2(-Math.sin(a) * 70, Math.cos(a) * 60);
    ship.rotation.z = Math.sin(t * 0.7) * 0.15;
  });

  // ---------------- robot ----------------
  const robot = new THREE.Group();
  const white = std(0xeef2ff, 0.25, 0.3);
  const darkR = std(0x151d3a, 0.5, 0.4);
  const cyan = basic(0x38bdf8);
  const body = mesh(new THREE.CapsuleGeometry(0.42, 0.45, 4, 14), white);
  body.position.y = 1.0;
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.34, 0.08), darkR);
  chest.position.set(0, 1.08, 0.4);
  const chestGlow = new THREE.Mesh(new THREE.CircleGeometry(0.09, 14), cyan);
  chestGlow.position.set(0, 1.08, 0.45);
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.1, 14), darkR);
  belt.position.y = 0.72;
  const head = mesh(new THREE.SphereGeometry(0.56, 20, 16), white);
  head.position.y = 1.95;
  head.scale.set(1.08, 0.95, 1);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), std(0x0a1130, 0.9, 0.15));
  visor.scale.set(1.15, 0.78, 0.55);
  visor.position.set(0, 1.97, 0.38);
  const pack = mesh(new THREE.BoxGeometry(0.6, 0.7, 0.28), darkR);
  pack.position.set(0, 1.1, -0.48);
  robot.add(body, chest, chestGlow, belt, head, visor, pack);
  [-0.17, 0.17].forEach((x) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), cyan);
    e.scale.set(1, 1.2, 0.6);
    e.position.set(x, 1.99, 0.63);
    robot.add(e);
  });
  [-1, 1].forEach((s) => {
    const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.16, 16).rotateZ(Math.PI / 2), darkR);
    ear.position.set(s * 0.6, 1.95, 0);
    const earRing = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 6, 20).rotateY(Math.PI / 2), cyan);
    earRing.position.set(s * 0.69, 1.95, 0);
    robot.add(ear, earRing);
  });
  const limb = (x, y, len, rad, mat) => {
    const piv = new THREE.Group();
    piv.position.set(x, y, 0);
    const m = mesh(new THREE.CapsuleGeometry(rad, len, 4, 10), mat);
    m.position.y = -len / 2 - rad * 0.4;
    piv.add(m);
    robot.add(piv);
    return piv;
  };
  const armL = limb(-0.6, 1.35, 0.32, 0.12, white);
  const armR = limb(0.6, 1.35, 0.32, 0.12, white);
  const legL = limb(-0.22, 0.7, 0.3, 0.15, white);
  const legR = limb(0.22, 0.7, 0.3, 0.15, white);
  [legL, legR].forEach((l) => {
    const boot = mesh(new THREE.BoxGeometry(0.34, 0.2, 0.5), darkR);
    boot.position.set(0, -0.55, 0.08);
    l.add(boot);
  });
  robot.position.set(START.x, 0, START.z);
  robot.scale.setScalar(1.05);
  scene.add(robot);

  const marker = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.65, 24), basic(0x67e8f9, { transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  marker.rotation.x = -Math.PI / 2;
  marker.visible = false;
  scene.add(marker);

  // ---------------- state & input ----------------
  const p = { x: START.x, z: START.z, y: 0, vy: 0, heading: Math.PI };
  const cam = { yaw: 0, pitch: 0.3, dist: 8 };
  const keys = {};
  const joy = { x: 0, y: 0 };
  let runHold = false;
  let target = null;
  let pending = null;
  let nearby = null;
  let locked = false;
  let frozen = false;
  let intro = false;
  let phase = 0;
  let moving = false;

  const isTyping = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '');
  const onButton = () => document.activeElement && /^(BUTTON|A)$/.test(document.activeElement.tagName);
  addEventListener('keydown', (e) => {
    if (isTyping(e)) return;
    keys[e.code] = true;
    if (!e.repeat) {
      if (e.code === 'KeyE' || (e.code === 'Enter' && !onButton())) interact();
      if (e.code === 'Space' && !onButton()) jump();
      if (e.code === 'KeyR' && !locked) api.reset();
    }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && !onButton()) e.preventDefault();
  });
  addEventListener('keyup', (e) => (keys[e.code] = false));
  addEventListener('blur', () => Object.keys(keys).forEach((k) => (keys[k] = false)));

  function jump() {
    if (!locked && !frozen && p.y <= 0.001) p.vy = JUMP_V;
  }
  function interact() {
    if (locked || frozen || !nearby) return;
    opts.onInteract && opts.onInteract(nearby);
  }

  // pointer: drag = look, tap = walk there / open station
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (drag) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
    drag.moved = true;
    cam.yaw -= (e.clientX - drag.x) * 0.005;
    cam.pitch = clamp(cam.pitch + (e.clientY - drag.y) * 0.004, 0.08, 1.15);
    drag.x = e.clientX;
    drag.y = e.clientY;
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const tap = !drag.moved && e.type === 'pointerup';
    drag = null;
    if (tap && !locked && !frozen) tapAt(e.clientX, e.clientY);
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener(
    'wheel',
    (e) => {
      cam.dist = clamp(cam.dist + e.deltaY * 0.01, 4.5, 16);
      e.preventDefault();
    },
    { passive: false }
  );

  function resolvePoint(pt) {
    const l = Math.hypot(pt.x, pt.z);
    if (l > WALK_R - 1) {
      pt.x *= (WALK_R - 1) / l;
      pt.z *= (WALK_R - 1) / l;
    }
    statics.forEach((c) => {
      const dx = pt.x - c.x;
      const dz = pt.z - c.z;
      const d = Math.hypot(dx, dz) || 0.001;
      if (d < c.r + 0.8) {
        pt.x = c.x + (dx / d) * (c.r + 0.8);
        pt.z = c.z + (dz / d) * (c.r + 0.8);
      }
    });
    return pt;
  }
  function travelTo(id, openOnArrive = true) {
    const d = defs.find((s) => s.id === id);
    if (!d) return;
    target = { x: d.door.x, z: d.door.z, t: 0 };
    pending = openOnArrive ? id : null;
  }
  function tapAt(cx, cy) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(stationGroups, true);
    for (const h of hits) {
      let o = h.object;
      while (o && !(o.userData && o.userData.stationId)) o = o.parent;
      if (o) {
        travelTo(o.userData.stationId, true);
        return;
      }
    }
    const pt = new THREE.Vector3();
    if (ray.ray.intersectPlane(plane, pt)) {
      target = { ...resolvePoint({ x: pt.x, z: pt.z }), t: 0 };
      pending = null;
    }
  }

  // ---------------- quality ----------------
  function applyQuality(q) {
    quality = q;
    const dpr = window.devicePixelRatio || 1;
    renderer.setPixelRatio(q === 'high' ? Math.min(dpr, 2) : Math.min(dpr, 1));
    renderer.setSize(innerWidth, innerHeight, false);
    const sh = q === 'high';
    renderer.shadowMap.enabled = sh;
    moonLight.castShadow = sh;
    labLight.visible = sh;
    scene.traverse((o) => {
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => (m.needsUpdate = true));
    });
    starGeo.setDrawRange(0, sh ? starCount : 250);
    islands.forEach((g, i) => (g.visible = sh || i % 2 === 0));
    foliage.count = trunks.count = sh ? spots.length : Math.floor(spots.length / 2);
    opts.onQuality && opts.onQuality(q, qualityMode);
  }
  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);

  // ---------------- main loop ----------------
  const tmp = new THREE.Vector3();
  const lookAt = new THREE.Vector3(START.x, 1.8, START.z);
  let clock = 0;
  let last = 0;
  let raf = 0;
  let fpsAcc = 0;
  let fpsFrames = 0;
  let lowStrikes = 0;

  function update(dt) {
    clock += dt * timeScale;
    let f = 0;
    let s = 0;
    if (!locked) {
      f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) + joy.y;
      s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.x;
    }
    const len = Math.hypot(f, s);
    let mx = 0;
    let mz = 0;
    let speed = WALK;
    if (len > 0.05) {
      target = null;
      pending = null;
      const k = len > 1 ? 1 / len : 1;
      const fx = -Math.sin(cam.yaw);
      const fz = -Math.cos(cam.yaw);
      const rx = Math.cos(cam.yaw);
      const rz = -Math.sin(cam.yaw);
      mx = (fx * f + rx * s) * k;
      mz = (fz * f + rz * s) * k;
      if (keys.ShiftLeft || keys.ShiftRight || runHold || Math.hypot(joy.x, joy.y) > 0.92) speed = RUN;
      else if (joy.x || joy.y) speed = WALK * (0.6 + 0.4 * Math.min(1, Math.hypot(joy.x, joy.y)));
    } else if (target && !locked) {
      const dx = target.x - p.x;
      const dz = target.z - p.z;
      const d = Math.hypot(dx, dz);
      target.t += dt;
      if (d < 0.5 || target.t > 12) {
        target = null;
        if (pending) {
          const id = pending;
          pending = null;
          opts.onInteract && opts.onInteract(id);
        }
      } else {
        mx = dx / d;
        mz = dz / d;
        speed = 8.5;
      }
    }
    moving = mx !== 0 || mz !== 0;
    if (moving) {
      p.x += mx * speed * dt;
      p.z += mz * speed * dt;
      let diff = Math.atan2(mx, mz) - p.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      p.heading += diff * Math.min(1, dt * 12);
    }
    statics.forEach((c) => {
      const dx = p.x - c.x;
      const dz = p.z - c.z;
      const d = Math.hypot(dx, dz) || 0.001;
      const min = c.r + 0.5;
      if (d < min) {
        p.x = c.x + (dx / d) * min;
        p.z = c.z + (dz / d) * min;
      }
    });
    const rl = Math.hypot(p.x, p.z);
    if (rl > WALK_R) {
      p.x *= WALK_R / rl;
      p.z *= WALK_R / rl;
    }
    if (p.y > 0 || p.vy > 0) {
      p.vy -= GRAV * dt;
      p.y = Math.max(0, p.y + p.vy * dt);
      if (p.y === 0) p.vy = 0;
    }

    // robot pose
    phase += moving ? dt * speed * 1.6 : 0;
    const sw = moving ? Math.sin(phase) * (speed > WALK + 1 ? 0.95 : 0.7) : 0;
    legL.rotation.x = sw;
    legR.rotation.x = -sw;
    armL.rotation.x = -sw * 0.9;
    armR.rotation.x = sw * 0.9;
    const bob = moving ? Math.abs(Math.sin(phase)) * 0.09 : Math.sin(clock * 2) * 0.025;
    robot.position.set(p.x, p.y + bob, p.z);
    robot.rotation.y = p.heading;
    head.rotation.y = moving ? 0 : Math.sin(clock * 0.8) * 0.25;
    if (target) {
      marker.visible = true;
      marker.position.set(target.x, 0.08, target.z);
      marker.scale.setScalar(1 + Math.sin(clock * 6) * 0.15);
    } else marker.visible = false;

    // nearest station
    let best = null;
    let bd = Infinity;
    defs.forEach((d) => {
      const dist = Math.hypot(d.x - p.x, d.z - p.z);
      if (dist < d.reach && dist < bd) {
        bd = dist;
        best = d.id;
      }
    });
    if (best !== nearby) {
      nearby = best;
      opts.onNearby && opts.onNearby(best);
    }
    stationGroups.forEach((g) => {
      const on = g.userData.stationId === nearby;
      g.userData.ring.material.opacity = on ? 0.6 + Math.sin(clock * 4) * 0.25 : 0.3;
    });

    anims.forEach((fn) => fn(clock));

    // camera
    const portrait = camera.aspect < 1;
    if (intro) {
      cam.yaw = Math.sin(clock * 0.25) * 0.55;
      cam.pitch = 0.22;
    }
    const dist = (intro ? 10 : cam.dist) * (portrait ? 1.3 : 1);
    const cp = Math.cos(cam.pitch);
    tmp.set(p.x + Math.sin(cam.yaw) * cp * dist, p.y * 0.5 + 1.8 + Math.sin(cam.pitch) * dist, p.z + Math.cos(cam.yaw) * cp * dist);
    tmp.y = Math.max(tmp.y, 0.8);
    camera.position.lerp(tmp, 1 - Math.exp(-dt * 8));
    lookAt.lerp(tmp.set(p.x, 1.9 + p.y * 0.5 + (intro ? 3 : 0), p.z), 1 - Math.exp(-dt * 8));
    camera.lookAt(lookAt);
    const fov = portrait ? 70 : 58;
    if (Math.abs(camera.fov - fov) > 0.05) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    sky.position.copy(camera.position);
    stars.position.copy(camera.position);
    moon.position.set(camera.position.x - 230, 150, camera.position.z - 380);
    moonLight.position.set(p.x - 30, 45, p.z + 20);
    moonLight.target.position.set(p.x, 0, p.z);
  }

  function frame(now) {
    if (frozen) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    update(dt);
    renderer.render(scene, camera);
    fpsAcc += dt;
    fpsFrames++;
    if (fpsAcc >= 2) {
      const fps = fpsFrames / fpsAcc;
      fpsAcc = fpsFrames = 0;
      if (qualityMode === 'auto' && quality === 'high') {
        lowStrikes = fps < 28 ? lowStrikes + 1 : 0;
        if (lowStrikes >= 2) applyQuality('low');
      }
    }
  }
  function setFrozen(v) {
    if (v === frozen) return;
    frozen = v;
    if (!v) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    } else cancelAnimationFrame(raf);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) setFrozen(true);
    else if (!api.userPaused) setFrozen(false);
  });

  const api = {
    userPaused: false,
    setLocked(v) {
      locked = !!v;
      if (locked) {
        target = null;
        pending = null;
      }
    },
    setIntro(v) {
      intro = !!v;
      if (!v) {
        cam.yaw = 0;
        cam.pitch = 0.3;
      }
    },
    setFrozen(v) {
      api.userPaused = !!v;
      setFrozen(!!v);
    },
    setJoystick(x, y) {
      joy.x = x;
      joy.y = y;
    },
    setRun: (v) => (runHold = !!v),
    jump,
    interact,
    travelTo,
    reset() {
      p.x = START.x;
      p.z = START.z;
      p.y = 0;
      p.vy = 0;
      p.heading = Math.PI;
      cam.yaw = 0;
      cam.pitch = 0.3;
      target = null;
      pending = null;
    },
    setQuality(mode) {
      qualityMode = mode;
      applyQuality(mode === 'auto' ? (isMobile || lowEnd ? 'low' : 'high') : mode);
    },
    getState: () => ({
      x: p.x,
      z: p.z,
      heading: p.heading,
      nearby,
      quality,
      qualityMode,
      worldRadius: ISLAND_R,
      stations: defs.map((d) => ({ id: d.id, css: d.css, x: d.x, z: d.z })),
    }),
  };

  resize();
  applyQuality(quality);
  raf = requestAnimationFrame((t) => {
    last = t;
    frame(t);
  });
  opts.onReady && opts.onReady();
  return api;
}
