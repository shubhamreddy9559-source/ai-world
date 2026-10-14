// =====================================================================
//  world.js — a candy-sunset sky world. A little robot (and its robot
//  dog Byte) explores separate floating islands, one per portfolio
//  section, joined by glowing bridges. You can also fly between them.
//  Loaded with a dynamic import from main.js so the site still works
//  (menu + panels + chat) if Three.js or WebGL is unavailable.
// =====================================================================
import * as THREE from 'three';
import { STATIONS } from './data.js';
import { buildLineFollower } from './model.js';

const WALK = 7;
const RUN = 12;
const FLY_SPEED = 14;
const FLY_FAST = 22;
const FLY_UP = 9;
const GRAV = 24;
const JUMP_V = 9;
const WORLD_R = 150; // minimap radius
const START = { x: 0, z: 5 };

// Where each section's floating island sits (x, z, height y, radius r).
const HUB = { id: 'hub', x: 0, z: 0, y: 0, r: 20 };
const LAYOUT = {
  about: { ix: -92, iz: -9, iy: 3, ir: 16 },
  projects: { ix: -56, iz: -72, iy: 8, ir: 17 },
  lab: { ix: 0, iz: -124, iy: 14, ir: 26 },
  achievements: { ix: 56, iz: -72, iy: 8, ir: 17 },
  resume: { ix: 92, iz: -9, iy: 3, ir: 16 },
  contact: { ix: 0, iz: 88, iy: -4, ir: 16 },
};
const BRIDGES = [
  ['hub', 'about'],
  ['hub', 'projects'],
  ['hub', 'achievements'],
  ['hub', 'resume'],
  ['hub', 'contact'],
  ['projects', 'lab'],
  ['achievements', 'lab'],
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
const cloudTexture = () =>
  canvasTex(256, 128, (g) => {
    [[70, 74, 46], [118, 56, 56], [172, 72, 44], [100, 88, 40], [150, 90, 40], [205, 88, 30]].forEach(([x, y, r]) => {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,.95)');
      gr.addColorStop(0.6, 'rgba(255,255,255,.55)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(x, y, r, 0, 7);
      g.fill();
    });
  });

function windowTexture(seed, tint) {
  const r = rand(seed);
  const t = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#3a2f78';
    g.fillRect(0, 0, w, h);
    const cols = ['#9ff3ff', '#ffe27a', '#ffc2f0', tint];
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 6; x++) {
        g.fillStyle = r() < 0.5 ? cols[(r() * cols.length) | 0] : '#53459a';
        g.beginPath();
        g.roundRect ? g.roundRect(6 + x * 20, 6 + y * 15, 13, 10, 4) : g.rect(6 + x * 20, 6 + y * 15, 13, 10);
        g.fill();
      }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// soft pastel island-top pattern (grey-scale: tinted per island)
function topTexture() {
  const t = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(120,110,190,.22)';
    g.lineWidth = 3;
    [60, 120, 180, 235].forEach((r) => {
      g.beginPath();
      g.arc(256, 256, r, 0, 7);
      g.stroke();
    });
    g.fillStyle = 'rgba(120,110,190,.16)';
    for (let a = 0; a < 24; a++) {
      const ang = (a / 24) * Math.PI * 2;
      for (let r = 90; r < 240; r += 50) {
        g.beginPath();
        g.arc(256 + Math.cos(ang + r) * r, 256 + Math.sin(ang + r) * r, 5, 0, 7);
        g.fill();
      }
    }
    const gr = g.createRadialGradient(256, 256, 160, 256, 256, 256);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(1, 'rgba(255,255,255,0.15)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
  return t;
}

function deckTexture() {
  const t = canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = '#efeaff';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#8fe3ff';
    g.lineWidth = 6;
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(10, 90);
    g.lineTo(32, 60);
    g.lineTo(54, 90);
    g.stroke();
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function labelSprite(text, css, sx = 6.4, fontPx = 56) {
  const tex = canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = 'rgba(255,255,255,0.94)';
    g.strokeStyle = css;
    g.lineWidth = 10;
    const r = 52;
    g.beginPath();
    g.moveTo(r, 6);
    g.arcTo(w - 6, 6, w - 6, h - 6, r);
    g.arcTo(w - 6, h - 6, 6, h - 6, r);
    g.arcTo(6, h - 6, 6, 6, r);
    g.arcTo(6, 6, w - 6, 6, r);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = '#2a1f5c';
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
        vec3 col=mix(uColor*.55,uColor+vec3(.4),sw*gl)+vec3(.12)*gl;
        float al=(.55+.45*gl)*smoothstep(1.3,.95,r);
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
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    opts.onError && opts.onError('The graphics context was lost. Reload the page, or use the menu to browse.');
  });

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xb07fb8, 0.0033);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1500);

  const lam = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
  const std = (c, m = 0.2, r = 0.5) => new THREE.MeshStandardMaterial({ color: c, metalness: m, roughness: r });
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
  const niceGlows = []; // decorative glow sprites hidden in low quality

  // ---------------- lights ----------------
  scene.add(new THREE.HemisphereLight(0xffd9ee, 0x6a58b0, 1.35));
  const sun = new THREE.DirectionalLight(0xffd7a8, 2.3);
  sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -42;
  sc.right = sc.top = 42;
  sc.near = 1;
  sc.far = 200;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0x9dbbff, 0.7);
  fill.position.set(40, 20, 60);
  scene.add(fill);

  // ---------------- candy sunset sky ----------------
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP; void main(){
        vec3 d=normalize(vP); float h=d.y;
        vec3 top=vec3(.12,.09,.36); vec3 mid=vec3(.52,.30,.66); vec3 hor=vec3(1.,.64,.50); vec3 low=vec3(.45,.30,.68);
        vec3 c = h>0. ? mix(hor,mid,smoothstep(0.,.32,h)) : mix(hor,low,smoothstep(0.,.45,-h));
        c = mix(c,top,smoothstep(.28,.9,h));
        vec3 sd=normalize(vec3(-.45,.09,-.88)); float s=max(dot(d,sd),0.);
        c += vec3(1.,.78,.52)*pow(s,6.)*.35 + vec3(1.,.92,.75)*pow(s,300.)*1.8;
        gl_FragColor=vec4(c,1.); }`,
    })
  );
  scene.add(sky);
  const starCount = 300;
  const sp = new Float32Array(starCount * 3);
  const rs = rand(7);
  for (let i = 0; i < starCount; i++) {
    const u = rs() * Math.PI * 2;
    const v = Math.acos(0.35 + rs() * 0.65);
    sp[i * 3] = 800 * Math.sin(v) * Math.cos(u);
    sp[i * 3 + 1] = 800 * Math.cos(v);
    sp[i * 3 + 2] = 800 * Math.sin(v) * Math.sin(u);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xfff1ff, size: 1.8, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.7 }));
  scene.add(stars);

  // sea of clouds far below the islands
  const cloudTex = cloudTexture();
  const clouds = [];
  const rc = rand(31);
  for (let i = 0; i < 46; i++) {
    const a = rc() * Math.PI * 2;
    const r = 25 + rc() * 260;
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: cloudTex, color: i % 3 === 0 ? 0xffd0ec : i % 3 === 1 ? 0xffe8f6 : 0xd9c8ff, transparent: true, opacity: 0.8, depthWrite: false })
    );
    const w = 80 + rc() * 90;
    s.scale.set(w, w * 0.5, 1);
    s.position.set(Math.cos(a) * r, -38 + rc() * 16, Math.sin(a) * r);
    s.raycast = () => {};
    scene.add(s);
    clouds.push(s);
  }

  // ---------------- layout ----------------
  const defs = STATIONS.map((d) => {
    const L = LAYOUT[d.id];
    const dx = HUB.x - L.ix;
    const dz = HUB.z - L.iz;
    const l = Math.hypot(dx, dz) || 1;
    const dir = { x: dx / l, z: dz / l }; // front: toward the hub / incoming bridge
    const big = d.id === 'lab';
    const back = L.ir * 0.34;
    const x = L.ix - dir.x * back;
    const z = L.iz - dir.z * back;
    const doorDist = big ? 3 : 1.6;
    return {
      ...d,
      ...L,
      big,
      dir,
      x,
      z,
      y: L.iy,
      door: { x: x + dir.x * doorDist, z: z + dir.z * doorDist },
      reach: big ? 11 : 7,
      trig: big ? 4.2 : 2.2,
    };
  });
  const islands = [HUB, ...defs.map((d) => ({ id: d.id, x: d.ix, z: d.iz, y: d.iy, r: d.ir }))];
  const islandById = Object.fromEntries(islands.map((i) => [i.id, i]));
  const bridges = BRIDGES.map(([a, b]) => {
    const A = islandById[a];
    const B = islandById[b];
    const dx = B.x - A.x;
    const dz = B.z - A.z;
    const len0 = Math.hypot(dx, dz);
    const ux = dx / len0;
    const uz = dz / len0;
    const ax = A.x + ux * (A.r - 1.2);
    const az = A.z + uz * (A.r - 1.2);
    const bx = B.x - ux * (B.r - 1.2);
    const bz = B.z - uz * (B.r - 1.2);
    return { a, b, ax, az, ay: A.y, bx, bz, by: B.y, ux, uz, len: Math.hypot(bx - ax, bz - az), w: 3.6 };
  });

  function groundAt(x, z) {
    for (const i of islands) if ((x - i.x) * (x - i.x) + (z - i.z) * (z - i.z) < i.r * i.r) return i.y;
    for (const b of bridges) {
      const px = x - b.ax;
      const pz = z - b.az;
      const s = px * b.ux + pz * b.uz;
      const lat = Math.abs(px * -b.uz + pz * b.ux);
      if (s >= -0.5 && s <= b.len + 0.5 && lat < b.w / 2) return b.ay + (b.by - b.ay) * clamp(s / b.len, 0, 1);
    }
    return null;
  }

  // ---------------- islands ----------------
  const topTex = topTexture();
  const rockMat = lam(0xa28ee8, { flatShading: true, emissive: 0x5a3fa8, emissiveIntensity: 0.6 });
  const walkables = [];
  const colliders = [];
  const statics = colliders;
  const addStatic = (x, z, r) => statics.push({ x, z, r });
  const crystalGeo = new THREE.OctahedronGeometry(1, 0);
  const crystalCols = [0x7df0ff, 0xff8be0, 0xffe27a, 0xb69bff];

  function crystal(parent, x, y, z, s, hex, withGlow = true) {
    const c = new THREE.Mesh(crystalGeo, basic(hex, { transparent: true, opacity: 0.92 }));
    c.scale.set(0.55 * s, 1.3 * s, 0.55 * s);
    c.position.set(x, y + 1.3 * s, z);
    parent.add(c);
    const ph = x * 0.7 + z;
    anims.push((t) => (c.rotation.y = t * 0.6 + ph));
    if (withGlow) {
      const gl = glowSprite(hex, s * 4.5, 0.4);
      gl.position.set(x, y + 1.3 * s, z);
      parent.add(gl);
      niceGlows.push(gl);
    }
    return c;
  }
  function mushroom(parent, x, y, z, hex) {
    const g = new THREE.Group();
    const stem = mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.8, 8), lam(0xfff1e0), false);
    stem.position.y = 0.4;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), lam(hex, { emissive: hex, emissiveIntensity: 0.75 }));
    cap.position.y = 0.78;
    g.add(stem, cap);
    g.position.set(x, y, z);
    parent.add(g);
  }


  // a natural, lumpy rock body for the underside of a floating island (not a cone)
  const sideMat = lam(0x93725a, { flatShading: true });
  const rockV = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const stoneMat = lam(0x7b6a72, { flatShading: true });
  const moss = lam(0x62c47c, { flatShading: true });
  function rockBody(r, depth, seed) {
    const geo = new THREE.SphereGeometry(1, 30, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    const pos = geo.attributes.position;
    const rr = rand(seed);
    const ph = [rr() * 6, rr() * 6, rr() * 6, rr() * 6];
    const col = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    const cA = new THREE.Color(0x6fae72);
    const cB = new THREE.Color(0xa07e5e);
    const cC = new THREE.Color(0x85737a);
    const cD = new THREE.Color(0x5f5478);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const d = clamp(-y, 0, 1);
      const rho = Math.hypot(x, z);
      const n = Math.sin(x * 3.1 + ph[0]) * Math.cos(z * 2.7 + ph[1]) + 0.6 * Math.sin(x * 6.3 + z * 5.1 + ph[2]) + 0.4 * Math.sin(d * 9 + x * 4 + ph[3]);
      const R = Math.pow(Math.max(0, 1 - Math.pow(d, 1.6)), 0.55) * (1 + 0.17 * n * (0.3 + d));
      const k = rho > 1e-4 ? R / rho : 0;
      const jit = d > 0.8 ? Math.sin(x * 17 + ph[0]) * 0.08 : 0;
      pos.setXYZ(i, (x * k + jit) * r, -d * depth * (1 + 0.24 * n), (z * k - jit) * r);
      if (d < 0.1) c.copy(cA).lerp(cB, d / 0.1);
      else if (d < 0.55) c.copy(cB).lerp(cC, (d - 0.1) / 0.45);
      else c.copy(cC).lerp(cD, (d - 0.55) / 0.45);
      const b = 1 + 0.1 * Math.sin(n * 3 + i);
      col[i * 3] = c.r * b;
      col[i * 3 + 1] = c.g * b;
      col[i * 3 + 2] = c.b * b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, rockV);
  }
  function stalactites(g, r, depth, rr, n) {
    for (let k = 0; k < n; k++) {
      const a = rr() * Math.PI * 2;
      const f = 0.12 + rr() * 0.72;
      const d = Math.pow(Math.max(0.02, 1 - Math.pow(f, 1.8)), 1 / 1.6);
      const len = (1.5 + rr() * 5.5) * (0.6 + (1 - f));
      const rad = 0.35 + rr() * 0.7;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(rad, len, 6), stoneMat);
      cone.rotation.x = Math.PI;
      cone.rotation.z = (rr() - 0.5) * 0.4;
      cone.position.set(Math.cos(a) * f * r * 0.97, -1.2 - d * depth * 0.97 - len / 2 + 0.9, Math.sin(a) * f * r * 0.97);
      g.add(cone);
    }
  }

  function buildIsland(isl, hex, def) {
    const g = new THREE.Group();
    g.position.set(isl.x, isl.y, isl.z);
    const r = isl.r;
    const tint = new THREE.Color(hex).lerp(new THREE.Color(0x8fe0a8), 0.5).lerp(new THREE.Color(0xffffff), 0.22);
    const topMat = new THREE.MeshLambertMaterial({ color: tint, map: topTex });
    const top = mesh(new THREE.CylinderGeometry(r, r * 0.97, 1.2, 56).translate(0, -0.6, 0), [sideMat, topMat, sideMat], false);
    g.add(top);
    walkables.push(top);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(r - 0.1, 0.55, 8, 72), moss);
    lip.rotation.x = Math.PI / 2;
    lip.scale.z = 0.7;
    lip.position.y = -0.2;
    g.add(lip);
    const glowEdge = new THREE.Mesh(new THREE.TorusGeometry(r * 0.985, 0.06, 6, 72), basic(new THREE.Color(hex).lerp(new THREE.Color(0xffffff), 0.4)));
    glowEdge.rotation.x = Math.PI / 2;
    glowEdge.position.y = -1.0;
    g.add(glowEdge);
    const depth = r * 0.85;
    const rr = rand(Math.floor(r * 100 + isl.x * 7 + isl.z * 3 + 11));
    const body = rockBody(r * 0.97, depth, Math.floor(r * 31 + Math.abs(isl.x) * 3 + Math.abs(isl.z) + 5));
    body.position.y = -1.2;
    g.add(body);
    stalactites(g, r, depth, rr, 9);
    // hanging vines around the rim
    for (let k = 0; k < 26; k++) {
      const a2 = (k / 26) * Math.PI * 2 + rr() * 0.2;
      const len = 0.8 + rr() * 2.2;
      const vine = new THREE.Mesh(new THREE.ConeGeometry(0.11 + rr() * 0.08, len, 5), moss);
      vine.rotation.x = Math.PI;
      vine.position.set(Math.cos(a2) * (r - 0.1), -0.5 - len / 2, Math.sin(a2) * (r - 0.1));
      g.add(vine);
    }
    // glowing crystals poking out of the underside
    for (let k = 0; k < 6; k++) {
      const a3 = rr() * Math.PI * 2;
      const f = 0.3 + rr() * 0.4;
      const d = Math.pow(Math.max(0.02, 1 - Math.pow(f, 1.8)), 1 / 1.6);
      const hc = 2.5 + rr() * 3.5;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5 + rr() * 0.4, hc, 5), basic(crystalCols[k % 4], { transparent: true, opacity: 0.92 }));
      cone.rotation.x = Math.PI;
      cone.rotation.z = (rr() - 0.5) * 0.3;
      cone.position.set(Math.cos(a3) * f * r * 0.97, -1.2 - d * depth - hc / 2 + 1.2, Math.sin(a3) * f * r * 0.97);
      g.add(cone);
    }
    const under2 = glowSprite(0xff9bd8, r * 3.2, 0.2);
    under2.position.y = -depth * 0.9;
    g.add(under2);
    niceGlows.push(under2);

    // decorations: a few crystals and glowing mushrooms near the edge
    const avoid = [];
    if (def) {
      avoid.push({ x: def.x - isl.x, z: def.z - isl.z, r: def.big ? 12 : 6.5 });
      avoid.push({ x: def.x - isl.x + def.dir.x * 6, z: def.z - isl.z + def.dir.z * 6, r: 4 });
    }
    bridges.forEach((b) => {
      if (b.a === isl.id) avoid.push({ x: b.ax - isl.x, z: b.az - isl.z, r: 5 });
      if (b.b === isl.id) avoid.push({ x: b.bx - isl.x, z: b.bz - isl.z, r: 5 });
    });
    const ok = (x, z, m) => !avoid.some((a) => Math.hypot(x - a.x, z - a.z) < a.r + m);
    let placed = 0;
    for (let tries = 0; tries < 80 && placed < 9; tries++) {
      const a = rr() * Math.PI * 2;
      const rad = r * (0.72 + rr() * 0.18);
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      if (!ok(x, z, 1.2)) continue;
      const kind = placed % 5;
      if (kind === 0 || kind === 2) crystal(g, x, 0, z, 0.9 + rr() * 0.7, crystalCols[placed % 4]);
      else if (kind === 3) {
        const rock = mesh(new THREE.DodecahedronGeometry(0.6 + rr() * 0.7, 0), stoneMat);
        rock.position.set(x, 0.3, z);
        rock.rotation.set(rr() * 3, rr() * 3, 0);
        rock.scale.y = 0.7;
        g.add(rock);
      } else mushroom(g, x, 0, z, [0xff8be0, 0x7df0ff, 0xffe27a][placed % 3]);
      placed++;
    }
    scene.add(g);
    return g;
  }

  // waterfalls: a few soft streams falling into the clouds
  const wfTex = canvasTex(64, 256, (g, w, h) => {
    const r = rand(5);
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      g.fillStyle = `rgba(210,240,255,${0.3 + r() * 0.5})`;
      g.fillRect(r() * w, r() * h, 2 + r() * 4, 30 + r() * 90);
    }
  });
  wfTex.wrapS = wfTex.wrapT = THREE.RepeatWrapping;
  wfTex.repeat.set(1, 3);
  const wfMat = new THREE.MeshBasicMaterial({ map: wfTex, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, color: 0xbfe8ff });
  anims.push((t) => (wfTex.offset.y = -((t * 0.5) % 1)));
  function waterfall(isl, ang) {
    const nx = Math.cos(ang);
    const nz = Math.sin(ang);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 45), wfMat);
    m.position.set(isl.x + nx * isl.r, isl.y - 22.5, isl.z + nz * isl.r);
    m.rotation.y = Math.atan2(nx, nz);
    scene.add(m);
    niceGlows.push(m);
  }

  // hub island + one island per section
  buildIsland(HUB, 0x7ee0c3);
  defs.forEach((d) => buildIsland({ id: d.id, x: d.ix, z: d.iz, y: d.iy, r: d.ir }, d.hex, d));
  waterfall(HUB, Math.PI * 0.75);
  waterfall(islandById.about, Math.PI * 1.05);
  waterfall(islandById.resume, -0.05);
  waterfall(islandById.lab, Math.PI * 1.5);

  // ---------------- bridges ----------------
  const deckBase = deckTexture();
  const postGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.9, 6);
  const orbGeo = new THREE.SphereGeometry(0.24, 10, 8);
  const lampList = [];
  bridges.forEach((b) => {
    const g = new THREE.Group();
    const ay = b.ay + 0.08;
    const by = b.by + 0.08;
    g.position.set((b.ax + b.bx) / 2, (ay + by) / 2, (b.az + b.bz) / 2);
    g.lookAt(b.bx, by, b.bz);
    const tex = deckBase.clone();
    tex.needsUpdate = true;
    tex.repeat.set(1, b.len / 5);
    const deck = mesh(new THREE.BoxGeometry(b.w, 0.36, b.len), [lam(0xdcd2ff), lam(0xdcd2ff), new THREE.MeshLambertMaterial({ map: tex }), lam(0xb9a8ff), lam(0xdcd2ff), lam(0xdcd2ff)], false);
    deck.position.y = -0.18;
    g.add(deck);
    walkables.push(deck);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(b.w - 1, 0.05, b.len), basic(0x8fe3ff, { transparent: true, opacity: 0.7 }));
    glow.position.y = -0.4;
    g.add(glow);
    [-1, 1].forEach((s) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, b.len), basic(0x8fe3ff));
      rail.position.set(s * (b.w / 2 - 0.05), 0.75, 0);
      g.add(rail);
    });
    anims.push((t) => (tex.offset.y = -((t * 0.35) % 1)));
    scene.add(g);
    for (let s = -b.len / 2 + 3; s < b.len / 2 - 2; s += 6) [-1, 1].forEach((side) => lampList.push({ b, s, side, g }));
  });
  {
    const posts = new THREE.InstancedMesh(postGeo, lam(0xffffff), lampList.length);
    const orbs = new THREE.InstancedMesh(orbGeo, basic(0xffa8e8), lampList.length);
    const m4 = new THREE.Matrix4();
    const v = new THREE.Vector3();
    lampList.forEach((L, i) => {
      v.set(L.side * (L.b.w / 2 - 0.05), 0.35, L.s);
      L.g.localToWorld(v);
      m4.makeTranslation(v.x, v.y, v.z);
      posts.setMatrixAt(i, m4);
      v.set(L.side * (L.b.w / 2 - 0.05), 0.9, L.s);
      L.g.localToWorld(v);
      m4.makeTranslation(v.x, v.y, v.z);
      orbs.setMatrixAt(i, m4);
    });
    scene.add(posts, orbs);
  }
  // signposts where a bridge leaves an island
  bridges.forEach((b) => {
    const target = defs.find((d) => d.id === b.b);
    if (!target) return;
    const lbl = labelSprite(target.label, target.css, 5);
    lbl.position.set(b.ax + b.ux * 1.5, b.ay + 3.6, b.az + b.uz * 1.5);
    scene.add(lbl);
  });

  // ---------------- hub decorations ----------------
  {
    const hub = new THREE.Group();
    hub.position.set(HUB.x, 0, HUB.z);
    [[HUB.r - 2.2, 0.14, 0xffa8e8], [HUB.r - 5, 0.1, 0x8fe3ff], [5.5, 0.1, 0xffe27a]].forEach(([r, w, c]) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, w, 8, 72), basic(c));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.06;
      hub.add(ring);
    });
    // central crystal
    const cc = new THREE.Group();
    cc.position.set(0, 0, -5);
    const big = new THREE.Mesh(crystalGeo, basic(0x8fe3ff, { transparent: true, opacity: 0.9 }));
    big.scale.set(1.6, 3.6, 1.6);
    big.position.y = 4.4;
    const small = new THREE.Mesh(crystalGeo, basic(0xff9be6, { transparent: true, opacity: 0.9 }));
    small.scale.set(0.8, 1.7, 0.8);
    small.position.set(2.2, 1.9, 0.8);
    const small2 = small.clone();
    small2.position.set(-2.1, 1.7, 0.4);
    const pad = mesh(new THREE.CylinderGeometry(2.8, 3.2, 0.7, 16), lam(0xe9e1ff), false);
    pad.position.y = 0.35;
    cc.add(pad, big, small, small2);
    const cg = glowSprite(0x8fe3ff, 16, 0.5);
    cg.position.y = 4.4;
    cc.add(cg);
    niceGlows.push(cg);
    anims.push((t) => {
      big.rotation.y = t * 0.5;
      big.position.y = 4.4 + Math.sin(t * 1.2) * 0.25;
      small.rotation.y = -t * 0.8;
      small2.rotation.y = t * 0.7;
    });
    const sign = labelSprite("SHUBHAM'S AI WORLD", '#ff8be0', 12, 50);
    sign.position.set(0, 10.4, 0);
    cc.add(sign);
    const sub = labelSprite('EXPLORE. LEARN. INNOVATE.', '#8fe3ff', 9, 34);
    sub.position.set(0, 8.6, 0);
    cc.add(sub);
    hub.add(cc);
    scene.add(hub);
    addStatic(HUB.x, HUB.z - 5, 3.2);
  }

  // ---------------- portals (one per island) ----------------
  const stationGroups = [];
  const doorMats = [];
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xd6eeff, transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0.1, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false, emissive: 0x335577, emissiveIntensity: 0.4 });
  const hull = (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.28, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.2, emissive: new THREE.Color(c).multiplyScalar(0.3) });
  const beamMat = (hex, op = 0.22) => new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const lerp = (a, b, t) => a + (b - a) * t;
  const toWorld = (d, lx, lz) => {
    const th = Math.atan2(d.dir.x, d.dir.z);
    return { x: d.x + lx * Math.cos(th) + lz * Math.sin(th), z: d.z - lx * Math.sin(th) + lz * Math.cos(th) };
  };
  function buildStation(def) {
    const big = !!def.big;
    const R = big ? 5 : 2.6;
    const g = new THREE.Group();
    const accent = basic(def.hex);
    const pastel = std(0xf6f1ff, 0.1, 0.4);
    const tint = '#' + def.hex.toString(16).padStart(6, '0');
    const add = (m, x, y, z) => {
      m.position.set(x, y, z);
      g.add(m);
      return m;
    };
    // soft glowing pad
    add(mesh(new THREE.CylinderGeometry(R + 2.4, R + 2.6, 0.3, 28), pastel, false), 0, 0.15, 0);
    const padRing = new THREE.Mesh(new THREE.TorusGeometry(R + 2.4, 0.09, 6, 40), accent);
    padRing.rotation.x = Math.PI / 2;
    add(padRing, 0, 0.32, 0);
    const floorGlow = new THREE.Mesh(new THREE.CircleGeometry(R * 0.95, 36), basic(def.hex, { transparent: true, opacity: 0.2, depthWrite: false }));
    floorGlow.rotation.x = -Math.PI / 2;
    add(floorGlow, 0, 0.36, R * 0.25);

    // round capsule pylons
    const pr = big ? 1.0 : 0.55;
    const pxo = R + pr + 0.5;
    const ph = 2 * R + 1.4;
    [-1, 1].forEach((s) => {
      add(mesh(new THREE.CapsuleGeometry(pr, ph - 2 * pr, 6, 14), pastel), s * pxo, 0.3 + ph / 2, 0);
      [0.25, 0.5, 0.75].forEach((f) => {
        const band = new THREE.Mesh(new THREE.TorusGeometry(pr + 0.04, 0.07, 6, 18), accent);
        band.rotation.x = Math.PI / 2;
        add(band, s * pxo, 0.3 + ph * f, 0);
      });
      const orb = add(new THREE.Mesh(new THREE.SphereGeometry(big ? 0.7 : 0.4, 14, 10), accent), s * pxo, 0.3 + ph + (big ? 0.5 : 0.3), 0);
      anims.push((t) => orb.scale.setScalar(1 + Math.sin(t * 2.4 + s) * 0.18));
      const bm = add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, big ? 0.35 : 0.2, 30, 10, 1, true), beamMat(def.hex, 0.3)), s * pxo, 0.3 + ph + 15, 0);
      anims.push((t) => (bm.material.opacity = 0.22 + Math.sin(t * 2 + s) * 0.08));
    });

    // the portal ring
    const cy = 0.3 + R + 0.7;
    add(mesh(new THREE.TorusGeometry(R, big ? 0.5 : 0.3, 14, 56), pastel), 0, cy, 0);
    add(new THREE.Mesh(new THREE.TorusGeometry(R - 0.45, 0.08, 8, 56), accent), 0, cy, 0.02);
    const spin = add(new THREE.Mesh(new THREE.TorusGeometry(R - 0.2, 0.06, 8, 56, Math.PI * 1.3), basic(0xffffff, { transparent: true, opacity: 0.9 })), 0, cy, 0.06);
    anims.push((t) => (spin.rotation.z = t * 1.1));
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      add(new THREE.Mesh(new THREE.SphereGeometry(big ? 0.28 : 0.15, 8, 6), accent), Math.sin(a) * (R + (big ? 1.1 : 0.6)), cy + Math.cos(a) * (R + (big ? 1.1 : 0.6)), 0);
    }
    add(new THREE.Mesh(new THREE.CircleGeometry(R - 0.45, 48), basic(0x1a1040, { transparent: true, opacity: 0.8, depthWrite: false })), 0, cy, -0.04);
    const dm = doorMaterial(def.hex);
    doorMats.push(dm);
    add(new THREE.Mesh(new THREE.CircleGeometry(R - 0.45, 48), dm), 0, cy, 0.02);
    const pg = glowSprite(def.hex, R * 6, 0.5);
    add(pg, 0, cy, -0.6);
    niceGlows.push(pg);
    // outer ring of light segments + effects used by the enter animation
    const seg = new THREE.Group();
    const segR = R + (big ? 1.9 : 1.1);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const bx = new THREE.Mesh(new THREE.BoxGeometry(big ? 0.9 : 0.5, big ? 0.22 : 0.12, 0.12), basic(0xffffff, { transparent: true, opacity: 0.85 }));
      bx.position.set(Math.sin(a) * segR, Math.cos(a) * segR, 0);
      bx.rotation.z = -a;
      seg.add(bx);
    }
    add(seg, 0, cy, 0.05);
    anims.push((t) => (seg.rotation.z = -t * 0.35));
    const shock = new THREE.Mesh(new THREE.TorusGeometry(R, 0.14, 8, 48), basic(def.hex, { transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    shock.visible = false;
    add(shock, 0, cy, 0.1);
    const flash = glowSprite(0xffffff, R * 9, 0);
    add(flash, 0, cy, 0.5);
    def.cy = cy;
    def.fx = { shock, flash, shockT: -1, flashTarget: 0 };

    // floating icon / sign above the ring
    const iconY = cy + R + (big ? 2.6 : 1.8);
    let signY = iconY + 1.6;
    const sideX = pxo + (big ? 5.5 : 4);
    switch (def.id) {
      case 'about': {
        {
          const bz = -4.4;
          add(mesh(new THREE.CylinderGeometry(3.1, 3.4, 4.2, 28), hull(0xf6f1ff)), 0, 2.4, bz);
          add(new THREE.Mesh(new THREE.CylinderGeometry(3.15, 3.15, 0.55, 28, 1, true), basic(def.hex, { transparent: true, opacity: 0.85, side: THREE.DoubleSide })), 0, 2.7, bz);
          add(new THREE.Mesh(new THREE.TorusGeometry(3.15, 0.1, 8, 40), accent).rotateX(Math.PI / 2), 0, 4.5, bz);
          add(new THREE.Mesh(new THREE.SphereGeometry(3.0, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), glassMat), 0, 4.5, bz);
          const core2 = add(new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), accent), 0, 5.6, bz);
          anims.push((t) => core2.scale.setScalar(1 + Math.sin(t * 2) * 0.15));
          const scope = new THREE.Group();
          const tube = mesh(new THREE.CylinderGeometry(0.3, 0.42, 2.6, 14), hull(0xffffff), false);
          tube.rotation.z = -1.1;
          tube.position.set(1.0, 0.5, 0);
          scope.add(tube);
          add(scope, 0, 5.2, bz);
          anims.push((t) => (scope.rotation.y = t * 0.4));
          const wpB = toWorld(def, 0, bz);
          addStatic(wpB.x, wpB.z, 3.6);
        }
        const orb = add(mesh(new THREE.SphereGeometry(0.8, 18, 14), std(0xffffff, 0.1, 0.3)), 0, iconY, 0);
        add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), accent), 0, iconY + 0.05, 0.72);
        anims.push((t) => (orb.rotation.y = Math.sin(t * 0.8) * 0.5));
        // a round cozy "hello" signpost + two flower-crystals
        add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 2, 8), pastel), -sideX, 1, 1.5);
        const board = add(mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.2, 24).rotateX(Math.PI / 2), pastel), -sideX, 2.4, 1.5);
        board.rotation.y = 0.3;
        const hi = labelSprite('HELLO!', def.css, 2.6, 52);
        add(hi, -sideX, 2.45, 1.8);
        break;
      }
      case 'projects': {
        {
          const bz = -4.4;
          add(mesh(new THREE.CylinderGeometry(3.0, 3.4, 5.4, 6), hull(0xfff3e0)), 0, 3.0, bz);
          [1.5, 3.4, 5.2].forEach((y) => add(new THREE.Mesh(new THREE.CylinderGeometry(3.45 - y * 0.06, 3.45 - y * 0.06, 0.14, 6), accent), 0, y + 0.3, bz));
          add(mesh(new THREE.CylinderGeometry(2.2, 3.0, 0.8, 6), hull(0xffd9a8)), 0, 6.4, bz);
          const gear = new THREE.Group();
          gear.add(mesh(new THREE.TorusGeometry(1.5, 0.3, 8, 28), hull(0xffffff), false));
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            const tooth = mesh(new THREE.BoxGeometry(0.5, 0.7, 0.5), hull(0xffffff), false);
            tooth.position.set(Math.cos(a) * 1.95, Math.sin(a) * 1.95, 0);
            tooth.rotation.z = a - Math.PI / 2;
            gear.add(tooth);
          }
          gear.add(mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.5, 16).rotateX(Math.PI / 2), accent, false));
          add(gear, 0, 8.7, bz + 0.2);
          anims.push((t) => (gear.rotation.z = t * 0.6));
          add(mesh(new THREE.CylinderGeometry(0.1, 0.14, 2.4, 8), hull(0xffffff), false), 1.7, 7.9, bz);
          const wpB = toWorld(def, 0, bz);
          addStatic(wpB.x, wpB.z, 3.6);
        }
        const cubes = [0, 1, 2].map(() => add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), basic(def.hex, { wireframe: true })), 0, iconY, 0));
        anims.push((t) =>
          cubes.forEach((c, i) => {
            c.position.set((i - 1) * 1.3, iconY + Math.sin(t * 1.3 + i) * 0.3, 0);
            c.rotation.set(t + i, t * 0.8 + i, 0);
          })
        );
        // a little circle test-track where the line-follower keeps driving
        const tx = sideX;
        const tz = 5;
        const trackR = 3.2;
        const trackTex = canvasTex(256, 256, (c2, w, h) => {
          c2.fillStyle = '#f4f1ff';
          c2.fillRect(0, 0, w, h);
          c2.strokeStyle = '#17142e';
          c2.lineWidth = 26;
          c2.beginPath();
          c2.arc(128, 128, 88, 0, 7);
          c2.stroke();
        });
        const trackMesh = mesh(new THREE.CylinderGeometry(trackR + 1, trackR + 1, 0.25, 36), [lam(0xdcd2ff), new THREE.MeshLambertMaterial({ map: trackTex }), lam(0xdcd2ff)], false);
        add(trackMesh, tx, 0.12, tz);
        const lf = buildLineFollower();
        const sc2 = 0.2;
        lf.scale.setScalar(sc2);
        const rig = new THREE.Group();
        rig.add(lf);
        lf.position.set(0, 0, -0.6);
        add(rig, tx, 0.3, tz);
        anims.push((t) => {
          const a = t * 0.9;
          rig.position.set(tx + Math.cos(a) * trackR * 0.88 * 1.0, 0.3, tz - Math.sin(a) * trackR * 0.88);
          rig.rotation.y = a + Math.PI;
          lf.userData.wheels.forEach((w) => (w.rotation.x += 0.15));
        });
        add(labelSprite('LINE FOLLOWER', def.css, 4.6, 44), tx, 3.2, tz);
        const wp = toWorld(def, tx, tz);
        addStatic(wp.x, wp.z, trackR + 0.8);
        break;
      }
      case 'achievements': {
        {
          const bz = -4.2;
          [[3.4, 0xffffff], [2.8, 0xffe9a8], [2.2, 0xffffff]].forEach(([rad, c], i) => add(mesh(new THREE.CylinderGeometry(rad, rad + 0.2, 0.95, 28), hull(c)), 0, 0.3 + 0.48 + i * 0.95, bz));
          add(new THREE.Mesh(new THREE.TorusGeometry(3.45, 0.07, 6, 40), accent).rotateX(Math.PI / 2), 0, 1.3, bz);
          const gr = add(new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.3, 12, 40), basic(0xffd24a)), 0, 6.6, bz);
          anims.push((t) => {
            gr.rotation.set(Math.PI / 2 + Math.sin(t * 0.8) * 0.4, t * 0.9, 0);
            gr.position.y = 6.6 + Math.sin(t * 1.2) * 0.25;
          });
          add(glowSprite(0xffe27a, 9, 0.5), 0, 6.6, bz);
          [-2.7, 2.7].forEach((x, i) => {
            const bm = add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.5, 14, 12, 1, true), beamMat(0xffd24a, 0.3)), x, 7.3, bz);
            anims.push((t) => (bm.material.opacity = 0.22 + Math.sin(t * 2.5 + i) * 0.1));
          });
          const wpB = toWorld(def, 0, bz);
          addStatic(wpB.x, wpB.z, 3.5);
        }
        const gold = basic(0xffd24a);
        const tr = new THREE.Group();
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.3, 0.75, 16), gold);
        cup.position.y = 0.55;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.4, 8), gold);
        const tb = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.14, 0.65), gold);
        tb.position.y = -0.2;
        tr.add(cup, stem, tb);
        add(tr, 0, iconY, 0);
        anims.push((t) => {
          tr.rotation.y = t * 1.1;
          tr.position.y = iconY + Math.sin(t * 1.4) * 0.2;
        });
        // podium with three steps and floating stars
        const px = -sideX;
        const pz = 5;
        [[0, 1.6, 0xffd24a], [-1.3, 1.1, 0xdfe6f5], [1.3, 0.8, 0xffb58a]].forEach(([ox, hh, c]) => {
          const st = mesh(new THREE.BoxGeometry(1.2, hh, 1.2), lam(c, { emissive: c, emissiveIntensity: 0.25 }));
          add(st, px + ox, hh / 2 + 0.2, pz);
        });
        const stars3 = [0, 1, 2].map((i) => {
          const s = glowSprite(0xffe27a, 1.3, 0.9);
          g.add(s);
          return s;
        });
        anims.push((t) => stars3.forEach((s, i) => s.position.set(px + Math.cos(t + i * 2.1) * 2, 3.4 + Math.sin(t * 1.5 + i) * 0.4, pz + Math.sin(t + i * 2.1) * 2)));
        const wp = toWorld(def, px, pz);
        addStatic(wp.x, wp.z, 2.4);
        break;
      }
      case 'resume': {
        {
          const bz = -4.2;
          const wm = (sd) => {
            const t = windowTexture(sd, tint);
            t.repeat.set(2, 1.6);
            t.needsUpdate = true;
            return new THREE.MeshLambertMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.85 });
          };
          [[3.0, 0], [2.5, 0.45], [2.0, 0.9]].forEach(([w, rot], i) => {
            const m = wm(310 + i);
            const b = mesh(new THREE.BoxGeometry(w, 3, w), [m, m, hull(0xfff0ec), hull(0xfff0ec), m, m]);
            b.position.set(0, 0.3 + 1.5 + i * 3.15, bz);
            b.rotation.y = rot;
            add(b);
            const rim2 = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.14, w + 0.2), accent);
            rim2.position.set(0, 0.3 + 3.07 + i * 3.15, bz);
            rim2.rotation.y = rot;
            add(rim2);
          });
          add(mesh(new THREE.CylinderGeometry(0.08, 0.14, 2.6, 8), hull(0xffffff), false), 0, 11.4, bz);
          const bo = add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), accent), 0, 12.8, bz);
          anims.push((t) => bo.scale.setScalar(1 + Math.sin(t * 3) * 0.2));
          const pages = [0, 1, 2, 3].map((i) => {
            const pg2 = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.5), basic(i % 2 ? 0xffffff : def.hex, { transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
            g.add(pg2);
            return pg2;
          });
          anims.push((t) =>
            pages.forEach((pg2, i) => {
              const a = t * 0.6 + i * 1.57;
              pg2.position.set(Math.cos(a) * 3.8, 5 + i * 1.2 + Math.sin(t + i) * 0.3, bz + Math.sin(a) * 3.8);
              pg2.rotation.y = -a + Math.PI / 2;
            })
          );
          const wpB = toWorld(def, 0, bz);
          addStatic(wpB.x, wpB.z, 3.3);
        }
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.2), basic(def.hex, { transparent: true, opacity: 0.88, side: THREE.DoubleSide }));
        add(scr, 0, iconY, 0);
        anims.push((t) => (scr.rotation.y = t * 0.9));
        // a stack of friendly paper cards
        for (let i = 0; i < 4; i++) {
          const card = mesh(new THREE.BoxGeometry(2.2, 0.16, 1.6), lam(i % 2 ? 0xffffff : 0xffd9cf), false);
          add(card, sideX, 0.4 + i * 0.2, 5);
          card.rotation.y = i * 0.35;
        }
        const wp = toWorld(def, sideX, 5);
        addStatic(wp.x, wp.z, 1.7);
        break;
      }
      case 'contact': {
        const dish = new THREE.Group();
        const bowl = mesh(new THREE.SphereGeometry(0.95, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), hull(0xf0f4ff));
        bowl.material.side = THREE.DoubleSide;
        bowl.rotation.x = Math.PI + 0.7;
        dish.add(bowl, new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), accent));
        add(dish, 0, iconY, 0);
        anims.push((t) => (dish.rotation.y = Math.sin(t * 0.5) * 1.2));
        // signal spire: slim tower with spinning discs and radio waves
        const bz = -4.2;
        add(mesh(new THREE.CylinderGeometry(0.4, 1.2, 11, 16), hull(0xfdf2f8)), 0, 5.8, bz);
        [[3.5, 2.3], [6.4, 1.8], [9.2, 1.4]].forEach(([y, rad], i) => {
          add(mesh(new THREE.CylinderGeometry(rad, rad, 0.14, 24), hull(0xffffff), false), 0, y, bz);
          const rim3 = add(new THREE.Mesh(new THREE.TorusGeometry(rad, 0.08, 6, 36), accent), 0, y, bz);
          rim3.rotation.x = Math.PI / 2;
          anims.push((t) => (rim3.rotation.z = t * (0.6 + i * 0.3)));
        });
        const top = add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), accent), 0, 11.6, bz);
        anims.push((t) => top.scale.setScalar(1 + Math.sin(t * 3) * 0.2));
        add(glowSprite(def.hex, 6, 0.6), 0, 11.6, bz);
        const waves = [0, 1, 2].map(() => {
          const w = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 36), basic(def.hex, { transparent: true, opacity: 0.6, depthWrite: false }));
          w.rotation.x = Math.PI / 2;
          add(w, 0, 11.6, bz);
          return w;
        });
        anims.push((t) =>
          waves.forEach((w, i) => {
            const k = (t * 0.6 + i / 3) % 1;
            w.scale.setScalar(0.5 + k * 4.5);
            w.material.opacity = 0.6 * (1 - k);
          })
        );
        const wpB = toWorld(def, 0, bz);
        addStatic(wpB.x, wpB.z, 2.4);
        break;
      }
      case 'lab': {
        const tz = -6.5;
        const wm = (rep) => {
          const t = windowTexture(211, tint);
          t.repeat.set(rep, 2);
          t.needsUpdate = true;
          return new THREE.MeshLambertMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.85 });
        };
        add(mesh(new THREE.CylinderGeometry(5.2, 5.6, 8, 24), wm(8)), 0, 4.3, tz);
        add(new THREE.Mesh(new THREE.TorusGeometry(5.3, 0.16, 8, 40), accent).rotateX(Math.PI / 2), 0, 8.3, tz);
        add(mesh(new THREE.CylinderGeometry(3.8, 4.2, 6, 24), wm(6)), 0, 11.3, tz);
        add(new THREE.Mesh(new THREE.TorusGeometry(3.9, 0.14, 8, 40), accent).rotateX(Math.PI / 2), 0, 14.3, tz);
        add(mesh(new THREE.CylinderGeometry(2.4, 2.8, 5, 20), wm(4)), 0, 17, tz);
        add(mesh(new THREE.SphereGeometry(2.5, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), pastel), 0, 19.5, tz);
        add(mesh(new THREE.CylinderGeometry(0.12, 0.25, 4, 8), pastel), 0, 22, tz);
        const orb = add(new THREE.Mesh(new THREE.SphereGeometry(0.8, 14, 10), accent), 0, 24.2, tz);
        anims.push((t) => orb.scale.setScalar(1 + Math.sin(t * 2.2) * 0.2));
        [[8.5, 12, 1.3], [6.2, 18, 1.1]].forEach(([r, y, s2]) => {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.14, 8, 56), accent);
          ring.rotation.x = Math.PI / 2;
          g.add(ring);
          anims.push((t) => {
            ring.position.set(0, y + Math.sin(t * 0.8 * s2) * 0.5, tz);
            ring.rotation.z = t * 0.5 * s2;
          });
        });
        const gl = glowSprite(def.hex, 40, 0.28);
        add(gl, 0, 14, tz);
        niceGlows.push(gl);
        add(labelSprite('AI WORLD', def.css, 9, 62), 0, 27.4, tz);
        const sats = [0, 1, 2, 3, 4].map((i) => {
          const m = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), basic(i % 2 ? 0xff8be0 : 0x7df0ff));
          g.add(m);
          return m;
        });
        anims.push((t) => sats.forEach((m, i) => m.position.set(Math.cos(t * 0.7 + i * 1.256) * 9.5, 12 + Math.sin(t * 1.1 + i) * 2, tz + Math.sin(t * 0.7 + i * 1.256) * 9.5)));
        const topBeam = add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.9, 40, 12, 1, true), beamMat(def.hex, 0.25)), 0, 45, tz);
        anims.push((t) => (topBeam.material.opacity = 0.2 + Math.sin(t * 2) * 0.07));
        add(labelSprite('AI LAB', def.css, 7, 62), 0, cy + R + 2.6, 0);
        signY = -1;
        const wpT = toWorld(def, 0, tz);
        addStatic(wpT.x, wpT.z, 5.9);
        // a floating "neural network": three layers of glowing nodes
        const net = new THREE.Group();
        const layers = [3, 4, 2];
        const nodes = [];
        layers.forEach((n, li) =>
          Array.from({ length: n }).forEach((_, ni) => {
            const node = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), basic(li === 1 ? 0xff8be0 : 0x7df0ff));
            node.position.set((li - 1) * 2.6, (ni - (n - 1) / 2) * 1.5, 0);
            net.add(node);
            nodes.push([li, node]);
          })
        );
        const pts = [];
        nodes.forEach(([la, a]) => nodes.forEach(([lb, b]) => lb === la + 1 && pts.push(a.position.clone(), b.position.clone())));
        net.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })));
        net.position.set(-pxo - 6, 4.2, 7);
        g.add(net);
        anims.push((t) => {
          net.rotation.y = Math.sin(t * 0.4) * 0.5;
          net.position.y = 4.2 + Math.sin(t) * 0.3;
        });
        break;
      }
    }
    if (signY > 0) add(labelSprite(def.label, def.css, 5.4), 0, signY + 0.3, 0);

    // pad ring in front of the portal (glows when you are near)
    const ring = new THREE.Mesh(new THREE.RingGeometry(big ? 2.8 : 1.7, big ? 3.2 : 2.0, 40), basic(def.hex, { transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.raycast = () => {};
    add(ring, 0, 0.4, R + (big ? 3.6 : 2.4));

    g.position.set(def.x, def.y, def.z);
    g.rotation.y = Math.atan2(def.dir.x, def.dir.z);
    g.userData = { stationId: def.id, ring };
    scene.add(g);
    stationGroups.push(g);
    [-1, 1].forEach((s) => {
      const w = toWorld(def, s * pxo, 0);
      addStatic(w.x, w.z, pr + 0.25);
    });
  }
  defs.forEach(buildStation);
  anims.push((t) => doorMats.forEach((m) => (m.uniforms.uTime.value = t)));

  // ---------------- far away mini islands + airships ----------------
  const farIslands = [];
  const rf = rand(2024);
  for (let i = 0; i < 9; i++) {
    const ang = (i / 9) * Math.PI * 2 + rf() * 0.4;
    const r = 130 + rf() * 70;
    const s = 5 + rf() * 6;
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(s, s * 0.97, 1.2, 14).translate(0, -0.6, 0), [sideMat, lam(i % 2 ? 0x9fe3a8 : 0xc9e8a0), sideMat], false));
    const fb = rockBody(s * 0.97, s * 0.85, i * 13 + 5);
    fb.position.y = -1.2;
    g.add(fb);
    stalactites(g, s, s * 0.85, rf, 4);
    crystal(g, 0, 0, 0, s * 0.35, crystalCols[i % 4], false);
    g.position.set(Math.cos(ang) * r, -8 + rf() * 44, Math.sin(ang) * r);
    const y0 = g.position.y;
    const ph = rf() * 6;
    anims.push((t) => (g.position.y = y0 + Math.sin(t * 0.35 + ph) * 0.8));
    scene.add(g);
    farIslands.push(g);
  }

  const blimps = [];
  function buildBlimp(hex, i) {
    const g = new THREE.Group();
    const body = mesh(new THREE.SphereGeometry(1, 20, 12), lam(0xfff1d6), false);
    body.scale.set(4, 1.7, 1.7);
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(1.72, 0.12, 6, 28), basic(hex));
    stripe.rotation.y = Math.PI / 2;
    stripe.scale.set(1, 1, 1);
    g.add(body, stripe);
    const gond = mesh(new THREE.BoxGeometry(2.2, 0.8, 0.9), lam(0x8a5a3a), false);
    gond.position.y = -2.1;
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 0.95), basic(0xffe9a8));
    win.position.y = -2.05;
    g.add(gond, win);
    [-0.6, 0.6].forEach((x) => {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 4), basic(0x6b4a3a));
      rope.position.set(x, -1.2, 0);
      g.add(rope);
    });
    [[0, 1.5, 0], [0, -1.5, 0]].forEach(([x, y]) => {
      const fin = mesh(new THREE.BoxGeometry(1.2, 1.6, 0.12), lam(hex), false);
      fin.position.set(-3.7, y * 0.5, 0);
      fin.rotation.z = y > 0 ? -0.5 : 0.5;
      g.add(fin);
    });
    const prop = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.4, 0.2), basic(0xdddddd));
    prop.position.set(-4.1, 0, 0);
    g.add(prop);
    const lantern = glowSprite(0xffd37a, 4, 0.7);
    lantern.position.y = -2.1;
    g.add(lantern);
    g.scale.setScalar(1.6);
    const R0 = 95 + i * 22;
    const y0 = 12 + i * 9;
    const sp0 = 0.05 + i * 0.012;
    scene.add(g);
    anims.push((t) => {
      const a = t * sp0 + i * 2.1;
      g.position.set(Math.cos(a) * R0, y0 + Math.sin(t * 0.6 + i) * 1.2, Math.sin(a) * R0);
      g.rotation.y = -a;
      prop.rotation.x = t * 12;
    });
    blimps.push(g);
  }
  [0xff7ad9, 0x6fe8ff, 0xffc94a].forEach(buildBlimp);

  // ---------------- robot ----------------
  const robot = new THREE.Group();
  robot.rotation.order = 'YXZ';
  const gloss = (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.25, metalness: 0.02, clearcoat: 1, clearcoatRoughness: 0.15, emissive: new THREE.Color(c).multiplyScalar(0.32) });
  const white = gloss(0x39d9b8);
  const pinkG = gloss(0xffd24d);
  const cyanG = gloss(0xfff2a8);
  const darkR = std(0x4a3a90, 0.2, 0.4);
  const cyan = basic(0xfff06a);
  const pinkB = basic(0xff9a3c);
  // torso: glossy white with a glowing heart-core
  const body = mesh(new THREE.CapsuleGeometry(0.4, 0.36, 6, 18), white);
  body.position.y = 0.98;
  const belly = mesh(new THREE.SphereGeometry(0.3, 16, 12), gloss(0xbff7e8), false);
  belly.scale.set(1, 1.1, 0.45);
  belly.position.set(0, 0.95, 0.33);
  const core = new THREE.Mesh(new THREE.CircleGeometry(0.1, 20), pinkB);
  core.position.set(0, 1.0, 0.5);
  const coreRing = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.022, 8, 24), cyan);
  coreRing.position.set(0, 1.0, 0.5);
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.41, 0.08, 18), pinkG);
  belt.position.y = 0.68;
  robot.add(body, belly, core, coreRing, belt);
  // big friendly head with a glossy visor face
  const head = new THREE.Group();
  head.position.y = 2.0;
  const skull = mesh(new THREE.SphereGeometry(0.7, 30, 22), white);
  skull.scale.set(1.12, 0.96, 1.02);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.56, 26, 18), new THREE.MeshPhysicalMaterial({ color: 0x1a1240, roughness: 0.1, metalness: 0.6, clearcoat: 1 }));
  face.scale.set(1.12, 0.78, 0.5);
  face.position.set(0, 0.02, 0.5);
  head.add(skull, face);
  const eyesG = new THREE.Group();
  eyesG.position.set(0, 0.07, 0.78);
  [-1, 1].forEach((sx) => {
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 6, 16, Math.PI), cyan);
    eye.position.set(sx * 0.22, 0.02, 0);
    eyesG.add(eye);
  });
  const smile = new THREE.Mesh(new THREE.CircleGeometry(0.15, 20, Math.PI, Math.PI), basic(0xff7a9a));
  smile.position.set(0, -0.1, 0.775);
  const smileEdge = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.02, 6, 20, Math.PI), cyan);
  smileEdge.rotation.z = Math.PI;
  smileEdge.position.set(0, -0.1, 0.78);
  head.add(smileEdge);
  head.add(eyesG, smile);
  [-1, 1].forEach((sx) => {
    const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.065, 14), new THREE.MeshBasicMaterial({ color: 0xff9a7a, transparent: true, opacity: 0.85 }));
    cheek.position.set(sx * 0.38, -0.08, 0.735);
    cheek.rotation.y = sx * 0.6;
    const pod = mesh(new THREE.SphereGeometry(0.17, 16, 12), white);
    pod.scale.set(0.7, 1, 1);
    pod.position.set(sx * 0.8, 0, 0);
    const podRing = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 6, 20).rotateY(Math.PI / 2), pinkB);
    podRing.position.set(sx * 0.9, 0, 0);
    head.add(cheek, pod, podRing);
  });
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 6), darkR);
  stalk.position.y = 0.8;
  const antOrb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), pinkB);
  antOrb.position.y = 1.0;
  const antGlow = glowSprite(0xff8be0, 0.8, 0.7);
  antGlow.position.y = 1.0;
  head.add(stalk, antOrb, antGlow);
  robot.add(head);
  // scarf
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.085, 10, 26), pinkG);
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.42;
  const scarfTail = new THREE.Group();
  scarfTail.position.set(0.2, 1.4, -0.3);
  const tailM = mesh(new THREE.BoxGeometry(0.17, 0.55, 0.05), pinkG, false);
  tailM.position.y = -0.27;
  scarfTail.add(tailM);
  robot.add(scarf, scarfTail);
  anims.push((t) => {
    eyesG.scale.y = t % 3.6 > 3.47 ? 0.1 : 1;
    antOrb.scale.setScalar(1 + Math.sin(t * 4) * 0.2);
    scarfTail.rotation.x = Math.sin(t * 5) * 0.2 + (moving ? 0.55 : 0);
    scarfTail.rotation.z = Math.sin(t * 3) * 0.12;
  });
  const limb = (x, y, len, rad, mat, end) => {
    const piv = new THREE.Group();
    piv.position.set(x, y, 0);
    const m = mesh(new THREE.CapsuleGeometry(rad, len, 4, 10), mat);
    m.position.y = -len / 2 - rad * 0.4;
    piv.add(m, end(len, rad));
    robot.add(piv);
    return piv;
  };
  const glove = (len, rad) => {
    const m = mesh(new THREE.SphereGeometry(rad * 1.35, 14, 10), cyanG);
    m.position.y = -len - rad * 1.2;
    return m;
  };
  const boot = (len, rad) => {
    const m = mesh(new THREE.SphereGeometry(0.2, 14, 10), pinkG);
    m.scale.set(1.05, 0.7, 1.55);
    m.position.set(0, -len - rad * 0.9, 0.1);
    return m;
  };
  const armL = limb(-0.58, 1.3, 0.3, 0.11, white, glove);
  const armR = limb(0.58, 1.3, 0.3, 0.11, white, glove);
  const legL = limb(-0.21, 0.72, 0.28, 0.14, white, boot);
  const legR = limb(0.21, 0.72, 0.28, 0.14, white, boot);
  [-1, 1].forEach((sx) => {
    const sh = mesh(new THREE.SphereGeometry(0.14, 12, 10), pinkG, false);
    sh.position.set(sx * 0.56, 1.32, 0);
    robot.add(sh);
  });
  // jet-pack with glowing thrusters
  const pack = mesh(new THREE.BoxGeometry(0.62, 0.7, 0.26), gloss(0x8f78d8));
  pack.position.set(0, 1.08, -0.5);
  robot.add(pack);
  [-1, 1].forEach((sx) => {
    const th = mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.28, 12), cyanG, false);
    th.position.set(sx * 0.17, 0.62, -0.5);
    robot.add(th);
  });
  const flames = [-0.17, 0.17].map((x) => {
    const f = glowSprite(0xffa040, 1.1, 0.95);
    f.position.set(x, 0.4, -0.5);
    robot.add(f);
    return f;
  });
  robot.scale.setScalar(1.1);
  scene.add(robot);
  const shadowDisc = new THREE.Mesh(new THREE.CircleGeometry(0.7, 20), basic(0x1a1040, { transparent: true, opacity: 0.35, depthWrite: false }));
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.raycast = () => {};
  scene.add(shadowDisc);

  // ---------------- robot dog companion (opens the chat) ----------------
  // A glossy white robot puppy: segmented limbs, big blue eyes, floppy
  // dark ears, black nose, open smiling mouth and a curly tail.
  const dogG = new THREE.Group();
  const dogFlames = [];
  {
    const W = gloss(0xfdfbff);
    const silver = new THREE.MeshPhysicalMaterial({ color: 0xd9d4e2, metalness: 0.3, roughness: 0.35, emissive: 0x5a566a });
    const taupe = gloss(0x6d5a5c);
    const blk = new THREE.MeshPhysicalMaterial({ color: 0x111114, roughness: 0.3, clearcoat: 1 });
    const tongueM = gloss(0xff6f9f);
    const blueEye = new THREE.MeshPhysicalMaterial({ color: 0x3f8cff, roughness: 0.05, metalness: 0.2, clearcoat: 1, emissive: 0x1a4fb0, emissiveIntensity: 0.7 });
    const torso = mesh(new THREE.CapsuleGeometry(0.34, 0.62, 8, 18).rotateX(Math.PI / 2), W);
    torso.position.set(0, 0.9, 0);
    torso.scale.set(1, 0.92, 1);
    dogG.add(torso);
    [-0.25, 0.1].forEach((z) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.348, 0.012, 6, 32), silver);
      ring.position.set(0, 0.9, z);
      ring.scale.y = 0.92;
      dogG.add(ring);
    });
    const neck = mesh(new THREE.CapsuleGeometry(0.17, 0.28, 6, 12), W);
    neck.position.set(0, 1.12, 0.6);
    neck.rotation.x = 0.7;
    dogG.add(neck);
    const neckJoint = mesh(new THREE.SphereGeometry(0.19, 12, 10), silver, false);
    neckJoint.position.set(0, 1.0, 0.52);
    dogG.add(neckJoint);
    const headG = new THREE.Group();
    headG.position.set(0, 1.45, 0.95);
    const skull = mesh(new THREE.SphereGeometry(0.4, 26, 20), W);
    skull.scale.set(1, 0.92, 1.08);
    const muzzle = mesh(new THREE.CapsuleGeometry(0.15, 0.16, 6, 12).rotateX(Math.PI / 2), W);
    muzzle.position.set(0, -0.1, 0.4);
    muzzle.scale.set(1, 0.85, 1);
    const jaw = mesh(new THREE.CapsuleGeometry(0.1, 0.14, 4, 10).rotateX(Math.PI / 2), W);
    jaw.position.set(0, -0.27, 0.38);
    jaw.rotation.x = 0.25;
    const mouth = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0x2a0f1e }));
    mouth.scale.set(0.12, 0.05, 0.19);
    mouth.position.set(0, -0.2, 0.47);
    const tongue = mesh(new THREE.CapsuleGeometry(0.045, 0.1, 4, 8).rotateX(Math.PI / 2), tongueM, false);
    tongue.position.set(0, -0.215, 0.5);
    const nose = mesh(new THREE.SphereGeometry(0.08, 14, 10), blk, false);
    nose.position.set(0, -0.04, 0.64);
    const noseShine = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), basic(0xffffff));
    noseShine.position.set(0.025, -0.01, 0.7);
    headG.add(skull, muzzle, jaw, mouth, tongue, nose, noseShine);
    const ears = [];
    [-1, 1].forEach((sx) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 14), blueEye);
      eye.position.set(sx * 0.2, 0.1, 0.3);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), blk);
      pupil.position.set(sx * 0.2, 0.1, 0.415);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), basic(0xffffff));
      shine.position.set(sx * 0.17, 0.15, 0.43);
      const ear = mesh(new THREE.SphereGeometry(1, 14, 10), taupe);
      ear.scale.set(0.07, 0.3, 0.17);
      ear.position.set(sx * 0.4, 0.04, -0.03);
      ear.rotation.z = sx * 0.3;
      ear.userData.base = sx * 0.3;
      ears.push(ear);
      headG.add(eye, pupil, shine, ear);
    });
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 6), silver);
    ant.position.set(0, 0.46, -0.05);
    const antTip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), basic(0x7df0ff));
    antTip.position.set(0, 0.58, -0.05);
    headG.add(ant, antTip);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 8, 22), tongueM);
    collar.position.set(0, 1.12, 0.62);
    collar.rotation.x = Math.PI / 2 - 0.75;
    const tail = new THREE.Group();
    tail.position.set(0, 1.0, -0.66);
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.12, -0.25), new THREE.Vector3(0, 0.38, -0.42), new THREE.Vector3(0, 0.62, -0.36), new THREE.Vector3(0, 0.72, -0.2)]);
    tail.add(mesh(new THREE.TubeGeometry(curve, 16, 0.055, 8, false), taupe, false));
    const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), basic(0x7df0ff));
    tailTip.position.set(0, 0.74, -0.18);
    tail.add(tailTip);
    const legs = [[-0.22, 0.42], [0.22, 0.42], [-0.22, -0.42], [0.22, -0.42]].map(([x, z]) => {
      const piv = new THREE.Group();
      piv.position.set(x, 0.9, z);
      const joint = mesh(new THREE.SphereGeometry(0.13, 12, 10), silver, false);
      const upper = mesh(new THREE.CapsuleGeometry(0.095, 0.2, 4, 10), W);
      upper.position.set(0, -0.2, 0);
      const knee = mesh(new THREE.SphereGeometry(0.1, 12, 10), silver, false);
      knee.position.set(0, -0.38, z > 0 ? 0.02 : -0.03);
      const lower = mesh(new THREE.CapsuleGeometry(0.08, 0.22, 4, 10), W);
      lower.position.set(0, -0.58, 0);
      const paw = mesh(new THREE.SphereGeometry(0.13, 14, 10), W);
      paw.scale.set(1, 0.65, 1.35);
      paw.position.set(0, -0.8, 0.05);
      const pad = mesh(new THREE.SphereGeometry(0.06, 8, 6), blk, false);
      pad.scale.set(1.2, 0.35, 1);
      pad.position.set(0, -0.865, 0.03);
      piv.add(joint, upper, knee, lower, paw, pad);
      [-1, 0, 1].forEach((tx) => {
        const toe = mesh(new THREE.SphereGeometry(0.03, 6, 5), blk, false);
        toe.scale.set(1, 0.4, 1);
        toe.position.set(tx * 0.06, -0.855, 0.16);
        piv.add(toe);
      });
      dogG.add(piv);
      return piv;
    });
    dogG.add(headG, collar, tail);
    [-0.2, 0.2].forEach((x) => {
      const f = glowSprite(0xffa040, 0.7, 0.9);
      f.position.set(x, 0.45, -0.6);
      f.visible = false;
      dogG.add(f);
      dogFlames.push(f);
    });
    dogG.userData = { legs, tail, headG, ears };
  }
  const dogBubble = labelSprite('Woof! Ask me', '#ffa04a', 3.8, 46);
  dogBubble.position.set(0, 3.0, 0.3);
  dogBubble.visible = false;
  dogG.add(dogBubble);
  dogG.scale.setScalar(1.15);
  scene.add(dogG);
  const dog = { x: START.x + 2.6, z: START.z + 2.6, y: 0, heading: Math.PI, phase: 0, bubble: 5 };
  dogG.position.set(dog.x, 0, dog.z);

  const marker = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.65, 24), basic(0xffffff, { transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  marker.rotation.x = -Math.PI / 2;
  marker.visible = false;
  scene.add(marker);

  // ---------------- state & input ----------------
  const p = { x: START.x, z: START.z, y: 0, vy: 0, heading: Math.PI, fly: false };
  const cam = { yaw: 0, pitch: 0.3, dist: 9 };
  const keys = {};
  const joy = { x: 0, y: 0 };
  let runHold = false;
  let jumpHold = false;
  let downHold = false;
  let target = null;
  let pending = null;
  let nearby = null;
  let locked = false;
  let frozen = false;
  let intro = false;
  let phase = 0;
  let moving = false;
  let warp = null;
  let fovKick = 0;
  let leaning = 0;
  let armSpread = 0;
  const inPortal = {};

  const isTyping = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '');
  const onButton = () => document.activeElement && /^(BUTTON|A)$/.test(document.activeElement.tagName);
  addEventListener('keydown', (e) => {
    if (isTyping(e)) return;
    keys[e.code] = true;
    if (!e.repeat) {
      if (e.code === 'KeyE' || (e.code === 'Enter' && !onButton())) interact();
      if (e.code === 'Space' && !onButton()) jump();
      if (e.code === 'KeyF' && !locked) setFly(!p.fly);
      if (e.code === 'KeyR' && !locked) api.reset();
    }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && !onButton()) e.preventDefault();
  });
  addEventListener('keyup', (e) => (keys[e.code] = false));
  addEventListener('blur', () => Object.keys(keys).forEach((k) => (keys[k] = false)));

  function setFly(v) {
    v = !!v;
    if (v === p.fly) return;
    // do not drop out of the sky over empty space
    if (!v && groundAt(p.x, p.z) == null) return;
    p.fly = v;
    if (v) p.vy = 2;
    opts.onFly && opts.onFly(v);
  }
  function jump() {
    if (locked || frozen || p.fly) return;
    const g = groundAt(p.x, p.z);
    if (g != null && p.y <= g + 0.05) p.vy = JUMP_V;
  }
  function interact() {
    if (locked || frozen || !nearby || warp) return;
    travelTo(nearby, true);
  }

  // pointer: drag = look, tap = fly/walk there / open station
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
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
    cam.pitch = clamp(cam.pitch + (e.clientY - drag.y) * 0.004, -0.2, 1.2);
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
      cam.dist = clamp(cam.dist + e.deltaY * 0.01, 4.5, 24);
      e.preventDefault();
    },
    { passive: false }
  );

  function travelTo(id, openOnArrive = true) {
    const d = defs.find((s) => s.id === id);
    if (!d) return;
    target = { x: d.door.x, z: d.door.z, y: d.y, t: 0 };
    pending = openOnArrive ? id : null;
  }
  function tapAt(cx, cy) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (ray.intersectObject(dogG, true).length) {
      opts.onDogTap && opts.onDogTap();
      return;
    }
    const hits = ray.intersectObjects(stationGroups, true);
    for (const h of hits) {
      let o = h.object;
      while (o && !(o.userData && o.userData.stationId)) o = o.parent;
      if (o) {
        travelTo(o.userData.stationId, true);
        return;
      }
    }
    const gh = ray.intersectObjects(walkables, false)[0];
    if (gh) {
      target = { x: gh.point.x, z: gh.point.z, y: gh.point.y, t: 0 };
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
    sun.castShadow = sh;
    scene.traverse((o) => {
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => (m.needsUpdate = true));
    });
    starGeo.setDrawRange(0, sh ? starCount : 120);
    clouds.forEach((c, i) => (c.visible = sh || i % 2 === 0));
    farIslands.forEach((g, i) => (g.visible = sh || i % 2 === 0));
    blimps.forEach((g, i) => (g.visible = sh || i < 2));
    niceGlows.forEach((g, i) => (g.visible = sh || i % 3 === 0));
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

  function updateDog(dt) {
    const hx = Math.sin(p.heading);
    const hz = Math.cos(p.heading);
    const tx = p.x - hx * 3.2 + hz * 1.5;
    const tz = p.z - hz * 3.2 - hx * 1.5;
    const dx = tx - dog.x;
    const dz = tz - dog.z;
    const d = Math.hypot(dx, dz);
    if (d > 40) {
      dog.x = tx;
      dog.z = tz;
      dog.y = p.y;
    }
    let speed = 0;
    if (d > 1.3) {
      speed = Math.min(20, 3 + d * 2.6);
      dog.x += (dx / d) * speed * dt;
      dog.z += (dz / d) * speed * dt;
      let df = Math.atan2(dx, dz) - dog.heading;
      df = Math.atan2(Math.sin(df), Math.cos(df));
      dog.heading += df * Math.min(1, dt * 10);
    } else {
      let df = Math.atan2(p.x - dog.x, p.z - dog.z) - dog.heading;
      df = Math.atan2(Math.sin(df), Math.cos(df));
      dog.heading += df * Math.min(1, dt * 3);
    }
    statics.forEach((c) => {
      const ox = dog.x - c.x;
      const oz = dog.z - c.z;
      const dd = Math.hypot(ox, oz) || 0.001;
      const min = c.r + 0.55;
      if (dd < min) {
        dog.x = c.x + (ox / dd) * min;
        dog.z = c.z + (oz / dd) * min;
      }
    });
    const g = groundAt(dog.x, dog.z);
    const hover = p.fly || !!target || g == null || Math.abs(p.y - (g ?? p.y)) > 1.5;
    const ty = hover ? p.y + 0.3 : g;
    dog.y += (ty - dog.y) * Math.min(1, dt * 6);
    const airborne = hover && dog.y > (g ?? -99) + 0.6;
    dogFlames.forEach((f) => {
      f.visible = airborne;
      f.scale.setScalar(0.6 + Math.sin(clock * 30) * 0.12);
    });
    dog.phase += dt * speed * 1.5;
    const sw = speed > 0.3 && !airborne ? Math.sin(dog.phase) * 0.8 : 0;
    const L = dogG.userData.legs;
    L[0].rotation.x = sw;
    L[3].rotation.x = sw;
    L[1].rotation.x = -sw;
    L[2].rotation.x = -sw;
    dogG.userData.tail.rotation.y = Math.sin(clock * (speed > 0.3 ? 16 : 9)) * 0.55;
    dogG.userData.headG.rotation.y = speed > 0.3 ? 0 : Math.sin(clock * 0.9) * 0.3;
    dogG.userData.ears.forEach((e) => (e.rotation.z = e.userData.base + Math.sin(clock * 9 + e.userData.base * 5) * (speed > 0.3 ? 0.22 : 0.05) * Math.sign(e.userData.base)));
    dogG.position.set(dog.x, dog.y + (speed > 0.3 && !airborne ? Math.abs(Math.sin(dog.phase)) * 0.1 : airborne ? Math.sin(clock * 3) * 0.08 : 0), dog.z);
    dogG.rotation.y = dog.heading;
    dog.bubble -= dt;
    if (dog.bubble < 0 && speed < 0.3 && !locked) {
      dogBubble.visible = true;
      if (dog.bubble < -4) {
        dogBubble.visible = false;
        dog.bubble = 14;
      }
    } else if (speed > 0.3 || locked) dogBubble.visible = false;
  }

  function respawn() {
    warp = null;
    fovKick = 0;
    robot.visible = true;
    robot.scale.setScalar(1.1);
    p.x = START.x;
    p.z = START.z;
    p.y = 0;
    p.vy = 0;
    p.heading = Math.PI;
    p.fly = false;
    opts.onFly && opts.onFly(false);
    target = null;
    pending = null;
    dog.x = START.x + 2.6;
    dog.z = START.z + 2.6;
    dog.y = 0;
  }

  function startWarp(id) {
    if (warp || locked) return;
    const d = defs.find((x) => x.id === id);
    if (!d) return;
    inPortal[id] = true;
    warp = { id, d, t: 0, phase: 'in', sx: p.x, sy: p.y, sz: p.z, spin: p.heading, seenLock: false };
    target = null;
    pending = null;
    opts.onPortalFx && opts.onPortalFx(d.css);
  }
  function stepWarp(dt) {
    const w = warp;
    const d = w.d;
    w.t += dt;
    const cyw = d.y + d.cy - 1.1;
    if (w.phase === 'in') {
      const k = Math.min(1, w.t / 0.9);
      const e = k * k * (3 - 2 * k);
      const px = lerp(w.sx, d.x, e);
      const pz = lerp(w.sz, d.z, e);
      robot.position.set(px, lerp(w.sy, cyw, e) + Math.sin(k * Math.PI) * 0.6, pz);
      p.x = px;
      p.z = pz;
      robot.scale.setScalar(1.1 * (1 - 0.96 * e * e));
      w.spin += dt * (6 + 30 * e);
      robot.rotation.set(0.3 * e, w.spin, 0);
      flames.forEach((fl) => (fl.visible = true));
      fovKick = 16 * e;
      d.fx.flashTarget = e;
      shadowDisc.visible = false;
      if (k >= 1) {
        w.phase = 'wait';
        w.t = 0;
        robot.visible = false;
        d.fx.shockT = 0;
        d.fx.flashTarget = 0;
        opts.onInteract && opts.onInteract(w.id);
      }
    } else if (w.phase === 'wait') {
      robot.visible = false;
      shadowDisc.visible = false;
      fovKick *= Math.exp(-dt * 4);
      if (locked) w.seenLock = true;
      if ((w.seenLock && !locked) || w.t > 5) {
        w.phase = 'out';
        w.t = 0;
        p.x = d.x + d.dir.x * (d.trig + 0.7);
        p.z = d.z + d.dir.z * (d.trig + 0.7);
        p.y = d.y;
        p.vy = 0;
        p.heading = Math.atan2(d.dir.x, d.dir.z);
        robot.visible = true;
        d.fx.shockT = 0;
        d.fx.flashTarget = 0.7;
      }
    } else {
      const k = Math.min(1, w.t / 0.65);
      const c1 = 1.70158;
      const e = 1 + (c1 + 1) * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
      robot.position.set(p.x, p.y + (1 - k) * 0.5, p.z);
      robot.scale.setScalar(Math.max(0.01, 1.1 * e));
      robot.rotation.set(0, p.heading + (1 - k) * 8, 0);
      shadowDisc.visible = true;
      shadowDisc.position.set(p.x, p.y + 0.06, p.z);
      fovKick = 8 * (1 - k);
      d.fx.flashTarget = 0.7 * (1 - k);
      if (k >= 1) {
        warp = null;
        robot.scale.setScalar(1.1);
        d.fx.flashTarget = 0;
      }
    }
  }
  function stepFx(dt) {
    defs.forEach((d) => {
      const f = d.fx;
      if (f.shockT >= 0) {
        f.shockT += dt;
        const k = f.shockT / 0.8;
        if (k >= 1) {
          f.shockT = -1;
          f.shock.visible = false;
        } else {
          f.shock.visible = true;
          f.shock.scale.setScalar(0.4 + k * 2.6);
          f.shock.material.opacity = 0.9 * (1 - k);
        }
      }
      f.flash.material.opacity += (f.flashTarget - f.flash.material.opacity) * Math.min(1, dt * 8);
    });
  }

  function update(dt) {
    clock += dt * timeScale;
    let f = 0;
    let s = 0;
    if (!locked && !warp) {
      f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) + joy.y;
      s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.x;
    }
    const upKey = !locked && (keys.Space || jumpHold);
    const downKey = !locked && (keys.KeyC || keys.KeyQ || downHold);
    const len = Math.hypot(f, s);
    const manual = len > 0.05;
    let mx = 0;
    let mz = 0;
    let speed = WALK;
    let auto = false;
    if (manual) {
      target = null;
      pending = null;
      const k = len > 1 ? 1 / len : 1;
      const fx = -Math.sin(cam.yaw);
      const fz = -Math.cos(cam.yaw);
      const rx = Math.cos(cam.yaw);
      const rz = -Math.sin(cam.yaw);
      mx = (fx * f + rx * s) * k;
      mz = (fz * f + rz * s) * k;
      const fast = keys.ShiftLeft || keys.ShiftRight || runHold || Math.hypot(joy.x, joy.y) > 0.92;
      if (p.fly) speed = fast ? FLY_FAST : FLY_SPEED;
      else if (fast) speed = RUN;
      else if (joy.x || joy.y) speed = WALK * (0.6 + 0.4 * Math.min(1, Math.hypot(joy.x, joy.y)));
    } else if (target && !locked && !warp) {
      const dx = target.x - p.x;
      const dz = target.z - p.z;
      const d = Math.hypot(dx, dz);
      target.t += dt;
      if (d < 0.5 || target.t > 20) {
        const done = d < 3;
        target = null;
        if (pending && done) {
          const id = pending;
          pending = null;
          startWarp(id);
        }
        pending = null;
      } else {
        auto = true;
        mx = dx / d;
        mz = dz / d;
        speed = d > 14 ? 15 : 9;
      }
    }
    moving = mx !== 0 || mz !== 0;
    let nx = p.x;
    let nz = p.z;
    if (moving) {
      nx += mx * speed * dt;
      nz += mz * speed * dt;
      let diff = Math.atan2(mx, mz) - p.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      p.heading += diff * Math.min(1, dt * 12);
    }
    statics.forEach((c) => {
      const dx = nx - c.x;
      const dz = nz - c.z;
      const d = Math.hypot(dx, dz) || 0.001;
      const min = c.r + 0.5;
      if (d < min) {
        nx = c.x + (dx / d) * min;
        nz = c.z + (dz / d) * min;
        if (auto && target) {
          // autopilot: slide around the obstacle instead of pushing straight into it
          const tx = -dz / d;
          const tz = dx / d;
          const sgn = tx * (target.x - p.x) + tz * (target.z - p.z) >= 0 ? 1 : -1;
          nx += tx * sgn * speed * dt;
          nz += tz * sgn * speed * dt;
        }
      }
    });
    // invisible railings: walking never takes you off an island or bridge
    const gHere = groundAt(p.x, p.z);
    if (!p.fly && !auto && gHere != null && (nx !== p.x || nz !== p.z) && groundAt(nx, nz) == null) {
      if (groundAt(nx, p.z) != null) nz = p.z;
      else if (groundAt(p.x, nz) != null) nx = p.x;
      else {
        nx = p.x;
        nz = p.z;
      }
    }
    p.x = nx;
    p.z = nz;
    const rl = Math.hypot(p.x, p.z);
    if (rl > 130) {
      p.x *= 130 / rl;
      p.z *= 130 / rl;
    }

    // vertical movement
    const g = groundAt(p.x, p.z);
    if (auto) {
      p.y += (target.y - p.y) * Math.min(1, dt * 3.5);
      p.vy = 0;
    } else if (p.fly) {
      const tv = upKey ? FLY_UP : downKey ? -FLY_UP : 0;
      p.vy += (tv - p.vy) * Math.min(1, dt * 6);
      p.y = clamp(p.y + p.vy * dt, -30, 70);
      if (g != null && p.y <= g) {
        p.y = g;
        if (downKey) setFly(false);
      }
    } else {
      p.vy -= GRAV * dt;
      p.y += p.vy * dt;
      if (g != null && p.y <= g + (p.vy <= 0 ? 0.5 : 0)) {
        if (p.vy <= 0) {
          p.y = g;
          p.vy = 0;
        }
      }
      if (p.y < -60) respawn();
    }

    // robot pose
    const grounded = !p.fly && g != null && p.y <= g + 0.06;
    const flying = p.fly || (auto && Math.hypot(target.x - p.x, target.z - p.z) > 8);
    phase += moving && grounded ? dt * speed * 1.6 : 0;
    const sw = moving && grounded ? Math.sin(phase) * (speed > WALK + 1 ? 0.95 : 0.7) : 0;
    legL.rotation.x = sw;
    legR.rotation.x = -sw;
    armL.rotation.x = -sw * 0.9;
    armR.rotation.x = sw * 0.9;
    armSpread += ((flying ? 1.1 : 0) - armSpread) * Math.min(1, dt * 8);
    armL.rotation.z = -armSpread;
    armR.rotation.z = armSpread;
    leaning += ((flying && moving ? 0.45 : 0) - leaning) * Math.min(1, dt * 6);
    const bob = grounded ? (moving ? Math.abs(Math.sin(phase)) * 0.09 : Math.sin(clock * 2) * 0.025) : flying ? Math.sin(clock * 3) * 0.1 : 0;
    robot.position.set(p.x, p.y + bob, p.z);
    robot.rotation.y = p.heading;
    robot.rotation.x = leaning;
    head.rotation.y = moving ? 0 : Math.sin(clock * 0.8) * 0.25;
    flames.forEach((fl) => {
      fl.visible = flying;
      fl.scale.setScalar(0.8 + Math.sin(clock * 34) * 0.18);
    });
    if (g != null) {
      shadowDisc.visible = true;
      shadowDisc.position.set(p.x, g + 0.06, p.z);
      shadowDisc.scale.setScalar(Math.max(0.35, 1 - (p.y - g) * 0.04));
    } else shadowDisc.visible = false;
    if (target) {
      marker.visible = true;
      marker.position.set(target.x, target.y + 0.1, target.z);
      marker.scale.setScalar(1 + Math.sin(clock * 6) * 0.15);
    } else marker.visible = false;
    if (warp) stepWarp(dt);
    else fovKick *= Math.exp(-dt * 6);

    // nearest station (must be on the same island level)
    let best = null;
    let bd = Infinity;
    defs.forEach((d) => {
      const dist = Math.hypot(d.x - p.x, d.z - p.z);
      if (dist < d.reach && Math.abs(p.y - d.y) < 6 && dist < bd) {
        bd = dist;
        best = d.id;
      }
    });
    if (best !== nearby) {
      nearby = best;
      opts.onNearby && opts.onNearby(best);
    }
    updateDog(dt);
    // flying or walking into a portal opens it (once per entry)
    if (!locked && !warp) {
      defs.forEach((d) => {
        const dist = Math.hypot(d.x - p.x, d.z - p.z);
        const inside = dist < d.trig && Math.abs(p.y - d.y) < 4;
        if (inside && !inPortal[d.id]) {
          inPortal[d.id] = true;
          if (pending === d.id) pending = null;
          startWarp(d.id);
        } else if (!inside && dist > d.trig + 1.2) inPortal[d.id] = false;
      });
    }
    stationGroups.forEach((g2) => {
      const on = g2.userData.stationId === nearby;
      g2.userData.ring.material.opacity = on ? 0.6 + Math.sin(clock * 4) * 0.25 : 0.35;
    });

    stepFx(dt);
    anims.forEach((fn) => fn(clock));

    // camera
    const portrait = camera.aspect < 1;
    if (intro) {
      cam.yaw = Math.sin(clock * 0.25) * 0.6;
      cam.pitch = 0.2;
    }
    const dist = (intro ? 15 : cam.dist) * (portrait ? 1.3 : 1);
    const cp = Math.cos(cam.pitch);
    tmp.set(p.x + Math.sin(cam.yaw) * cp * dist, p.y + 1.8 + Math.sin(cam.pitch) * dist, p.z + Math.cos(cam.yaw) * cp * dist);
    camera.position.lerp(tmp, 1 - Math.exp(-dt * 8));
    lookAt.lerp(tmp.set(p.x, p.y + 1.9 + (intro ? 3 : 0), p.z), 1 - Math.exp(-dt * 8));
    camera.lookAt(lookAt);
    const fov = (portrait ? 70 : 58) + fovKick;
    if (Math.abs(camera.fov - fov) > 0.05) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    sky.position.copy(camera.position);
    stars.position.copy(camera.position);
    sun.position.set(p.x - 30, p.y + 55, p.z + 35);
    sun.target.position.set(p.x, p.y, p.z);
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
    setJumpHold: (v) => (jumpHold = !!v),
    setDownHold: (v) => (downHold = !!v),
    setFly,
    toggleFly: () => setFly(!p.fly),
    jump,
    interact,
    travelTo,
    reset() {
      respawn();
      cam.yaw = 0;
      cam.pitch = 0.3;
    },
    setQuality(mode) {
      qualityMode = mode;
      applyQuality(mode === 'auto' ? (isMobile || lowEnd ? 'low' : 'high') : mode);
    },
    getState: () => ({
      x: p.x,
      y: p.y,
      z: p.z,
      heading: p.heading,
      flying: p.fly,
      nearby,
      quality,
      qualityMode,
      worldRadius: WORLD_R,
      stations: defs.map((d) => ({ id: d.id, css: d.css, x: d.x, z: d.z })),
      islands: islands.map((i) => ({ x: i.x, z: i.z, r: i.r })),
      bridges: bridges.map((b) => [b.ax, b.az, b.bx, b.bz]),
    }),
    _groundAt: groundAt,
    _teleport(x, z, y) {
      p.x = x;
      p.z = z;
      p.y = y ?? groundAt(x, z) ?? 0;
      p.vy = 0;
      dog.x = x + 2;
      dog.z = z + 2;
      dog.y = p.y;
    },
    _camera(yaw, pitch, dist) {
      cam.yaw = yaw;
      cam.pitch = pitch;
      cam.dist = dist;
    },
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
