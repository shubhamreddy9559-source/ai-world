// =====================================================================
//  world.js — a bright toy-car playground. Drive onto a pad to open a
//  portfolio section; shove letters, crates, cones and a ball around.
//  Light custom 2D physics (no physics library) so it runs on phones.
//  Loaded with a dynamic import from main.js so the site still works
//  (menu + panels + chat) if Three.js or WebGL is unavailable.
// =====================================================================
import * as THREE from 'three';
import { STATIONS } from './data.js';

const WORLD_R = 62; // drivable radius
const GROUND_R = 72;
const ZONE_R = 5;
const DWELL = 1.1; // seconds to hold still on a pad to open it
const MAX_V = 17;
const BOOST_V = 26;
const ACC = 16;
const BRAKE = 34;
const REV_V = 6;
const TURN = 1.9;
const SPAWN = { x: 0, z: 12, th: Math.PI };

const rand = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const zonePos = (d) => {
  const a = (d.angle * Math.PI) / 180;
  return { x: Math.sin(a) * d.radius, z: -Math.cos(a) * d.radius };
};
function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz), 0, 1);
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function groundTexture(zones) {
  const S = 1024;
  const k = S / 2 / GROUND_R;
  return canvasTex(S, S, (g) => {
    g.fillStyle = '#8fd18a';
    g.fillRect(0, 0, S, S);
    const r = rand(5);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = i % 2 ? 'rgba(110,185,105,.35)' : 'rgba(175,230,145,.32)';
      g.beginPath();
      g.arc(r() * S, r() * S, 10 + r() * 40, 0, 7);
      g.fill();
    }
    g.lineCap = 'round';
    [['#cdb985', 8.2], ['#eadcae', 6.6]].forEach(([col, w]) => {
      g.strokeStyle = col;
      g.fillStyle = col;
      g.lineWidth = w * k;
      zones.forEach((z) => {
        g.beginPath();
        g.moveTo(S / 2, S / 2);
        g.lineTo(S / 2 + z.x * k, S / 2 + z.z * k);
        g.stroke();
      });
      g.beginPath();
      g.arc(S / 2, S / 2, (w === 8.2 ? 11 : 10) * k, 0, 7);
      g.fill();
      zones.forEach((z) => {
        g.beginPath();
        g.arc(S / 2 + z.x * k, S / 2 + z.z * k, (ZONE_R + (w === 8.2 ? 1.8 : 1.3)) * k, 0, 7);
        g.fill();
      });
    });
  });
}

function labelSprite(text, css) {
  const tex = canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = 'rgba(8,14,40,0.92)';
    g.strokeStyle = css;
    g.lineWidth = 8;
    const r = 30;
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
    g.font = '800 56px system-ui, Segoe UI, Roboto, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 3);
  });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  sp.scale.set(7.2, 1.8, 1);
  return sp;
}

function letterMaterial(letter, color) {
  const tex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,.35)';
    g.lineWidth = 6;
    g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = '#fff';
    g.font = '900 88px system-ui, Segoe UI, Roboto, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(letter, w / 2, h / 2 + 6);
  });
  return new THREE.MeshLambertMaterial({ map: tex });
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
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    opts.onError && opts.onError('The graphics context was lost. Reload the page, or use the menu to browse.');
  });

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xcfeaff, 0.0065);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 900);

  const lam = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
  const basic = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, ...extra });
  const mesh = (geo, mat, cast = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast;
    m.receiveShadow = true;
    return m;
  };
  const anims = [];

  // ---------------- lights & sky ----------------
  scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x7a9a5a, 1.15));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
  sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -32;
  sc.right = sc.top = 32;
  sc.near = 1;
  sc.far = 140;
  scene.add(sun, sun.target);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(450, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader:
        'varying vec3 vP; void main(){ float h=normalize(vP).y; vec3 top=vec3(.22,.5,.95); vec3 hor=vec3(.81,.93,1.); gl_FragColor=vec4(mix(hor,top,smoothstep(0.,.6,h)),1.); }',
    })
  );
  scene.add(sky);

  const water = new THREE.Mesh(new THREE.CircleGeometry(900, 48), basic(0x58b9ee));
  water.rotation.x = -Math.PI / 2;
  water.position.y = -1.6;
  scene.add(water);

  const clouds = [];
  const rc = rand(11);
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(5 + rc() * 5, 10, 8), basic(0xffffff, { transparent: true, opacity: 0.92, fog: false }));
      s.position.set(k * 7 - 10, rc() * 2, rc() * 4);
      s.scale.y = 0.6;
      c.add(s);
    }
    const a = rc() * Math.PI * 2;
    c.position.set(Math.cos(a) * (120 + rc() * 120), 55 + rc() * 25, Math.sin(a) * (120 + rc() * 120));
    scene.add(c);
    clouds.push(c);
  }
  anims.push((t) => clouds.forEach((c, i) => (c.position.x += Math.sin(t * 0.05 + i) * 0.01)));

  // ---------------- ground ----------------
  const zoneDefs = STATIONS.map((d) => ({ ...d, ...zonePos(d) }));
  const ground = new THREE.Mesh(new THREE.CircleGeometry(GROUND_R, 72), new THREE.MeshLambertMaterial({ map: groundTexture(zoneDefs) }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(GROUND_R, GROUND_R - 5, 3.6, 72, 1, true), lam(0xd9c28f, { side: THREE.DoubleSide }));
  skirt.position.y = -1.8;
  scene.add(skirt);

  // ---------------- static colliders ----------------
  const statics = [];
  const addStatic = (x, z, r) => statics.push({ x, z, r });
  const nearRoad = (x, z, m) => zoneDefs.some((d) => segDist(x, z, 0, 0, d.x, d.z) < m) || Math.hypot(x, z) < 13;
  const nearZone = (x, z, m) => zoneDefs.some((d) => Math.hypot(x - d.x, z - d.z) < ZONE_R + m);

  // trees
  const rt = rand(77);
  const treeSpots = [];
  for (let tries = 0; tries < 900 && treeSpots.length < 42; tries++) {
    const a = rt() * Math.PI * 2;
    const r = 16 + rt() * (WORLD_R - 20);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (nearRoad(x, z, 6) || nearZone(x, z, 9)) continue;
    if (treeSpots.some((t) => Math.hypot(t.x - x, t.z - z) < 5)) continue;
    treeSpots.push({ x, z, s: 0.8 + rt() * 0.7 });
  }
  const foliage = new THREE.InstancedMesh(new THREE.ConeGeometry(1.7, 3.8, 7).translate(0, 3.4, 0), lam(0xffffff), treeSpots.length);
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.35, 1.8, 6).translate(0, 0.9, 0), lam(0x8a5a35), treeSpots.length);
  foliage.castShadow = trunks.castShadow = true;
  const greens = [0x3fae5a, 0x2f9e4f, 0x56c26a, 0x7ccf6a];
  const m4 = new THREE.Matrix4();
  const qn = new THREE.Quaternion();
  const col = new THREE.Color();
  treeSpots.forEach((t, i) => {
    m4.compose(new THREE.Vector3(t.x, 0, t.z), qn, new THREE.Vector3(t.s, t.s, t.s));
    foliage.setMatrixAt(i, m4);
    trunks.setMatrixAt(i, m4);
    foliage.setColorAt(i, col.setHex(greens[i % greens.length]));
    addStatic(t.x, t.z, 0.9 * t.s);
  });
  scene.add(foliage, trunks);

  // flowers (decoration only)
  const rf = rand(31);
  const flowerSpots = [];
  while (flowerSpots.length < 160) {
    const a = rf() * Math.PI * 2;
    const r = 6 + rf() * (WORLD_R - 8);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (!nearRoad(x, z, 4) && !nearZone(x, z, 3)) flowerSpots.push({ x, z });
  }
  const flowers = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.2), basic(0xffffff), flowerSpots.length);
  const fcols = [0xffffff, 0xffd166, 0xff8fab, 0xc4a1ff];
  flowerSpots.forEach((f, i) => {
    m4.compose(new THREE.Vector3(f.x, 0.22, f.z), qn, new THREE.Vector3(1, 1, 1));
    flowers.setMatrixAt(i, m4);
    flowers.setColorAt(i, col.setHex(fcols[i % 4]));
  });
  scene.add(flowers);

  // colourful fence posts around the edge
  const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.2, 1.3, 8).translate(0, 0.65, 0), lam(0xffffff), 72);
  posts.castShadow = true;
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    m4.compose(new THREE.Vector3(Math.cos(a) * (WORLD_R + 1.2), 0, Math.sin(a) * (WORLD_R + 1.2)), qn, new THREE.Vector3(1, 1, 1));
    posts.setMatrixAt(i, m4);
    posts.setColorAt(i, col.setHex(STATIONS[i % STATIONS.length].hex));
  }
  scene.add(posts);

  // ---------------- zones (pads + signs + props) ----------------
  const zones = [];
  function buildZone(def) {
    const g = new THREE.Group();
    g.position.set(def.x, 0, def.z);
    const disk = new THREE.Mesh(new THREE.CircleGeometry(ZONE_R, 40), basic(def.hex, { transparent: true, opacity: 0.28, depthWrite: false }));
    const ring = new THREE.Mesh(new THREE.RingGeometry(ZONE_R - 0.4, ZONE_R, 56), basic(def.hex, { transparent: true, opacity: 0.95, depthWrite: false }));
    const fill = new THREE.Mesh(new THREE.CircleGeometry(ZONE_R - 0.4, 40), basic(def.hex, { transparent: true, opacity: 0.55, depthWrite: false }));
    [disk, ring, fill].forEach((m, i) => {
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.05 + i * 0.01;
      g.add(m);
    });
    fill.scale.setScalar(0.001);

    const len = Math.hypot(def.x, def.z) || 1;
    const ox = def.x / len;
    const oz = def.z / len;
    // sign
    const sx = ox * (ZONE_R + 1.2);
    const sz = oz * (ZONE_R + 1.2);
    const pole = mesh(new THREE.CylinderGeometry(0.14, 0.14, 4.4, 8).translate(0, 2.2, 0), lam(0x1d2a52));
    pole.position.set(sx, 0, sz);
    g.add(pole);
    const label = labelSprite(def.label, def.css);
    label.position.set(sx, 5.4, sz);
    g.add(label);
    addStatic(def.x + sx, def.z + sz, 0.35);

    // themed prop beside the pad
    const px = ox * (ZONE_R + 1.5) - oz * 4.2;
    const pz = oz * (ZONE_R + 1.5) + ox * 4.2;
    const prop = new THREE.Group();
    prop.position.set(px, 0, pz);
    const accent = basic(def.hex);
    let pr = 1;
    switch (def.id) {
      case 'about': {
        prop.add(mesh(new THREE.CylinderGeometry(0.7, 0.9, 2.2, 14).translate(0, 1.1, 0), lam(0x2a3a6b)));
        const orb = mesh(new THREE.SphereGeometry(0.85, 16, 12), lam(0xffffff));
        orb.position.y = 3;
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), accent);
        eye.position.set(0, 3.05, 0.78);
        prop.add(orb, eye);
        anims.push((t) => (prop.rotation.y = Math.sin(t * 0.6) * 0.5));
        pr = 1;
        break;
      }
      case 'projects': {
        const cubes = [0, 1, 2].map((i) => {
          const c = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), accent);
          prop.add(c);
          return c;
        });
        anims.push((t) =>
          cubes.forEach((c, i) => {
            c.position.set((i - 1) * 1.3, 2.6 + Math.sin(t * 1.4 + i) * 0.35, 0);
            c.rotation.set(t + i, t * 0.8 + i, 0);
          })
        );
        prop.add(mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.4, 20).translate(0, 0.2, 0), lam(0x2a3a6b)));
        pr = 0;
        break;
      }
      case 'lab': {
        prop.add(mesh(new THREE.BoxGeometry(1.8, 7, 1.8).translate(0, 3.5, 0), lam(0xf1f5ff)));
        [1.2, 5.6].forEach((y) => {
          const b = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.35, 1.95), accent);
          b.position.y = y;
          prop.add(b);
        });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.09, 8, 36), accent);
        ring.rotation.x = Math.PI / 2;
        prop.add(ring);
        const top = new THREE.Mesh(new THREE.SphereGeometry(0.7, 14, 10), accent);
        top.position.y = 7.6;
        prop.add(top);
        anims.push((t) => {
          ring.position.y = 4 + Math.sin(t) * 1.6;
          ring.rotation.z = t * 1.4;
        });
        pr = 1.3;
        break;
      }
      case 'achievements': {
        const gold = lam(0xfbbf24);
        const tr = new THREE.Group();
        const cup = mesh(new THREE.CylinderGeometry(1.2, 0.6, 1.5, 16), gold);
        cup.position.y = 2.6;
        const stem = mesh(new THREE.CylinderGeometry(0.18, 0.18, 1, 8), gold);
        stem.position.y = 1.6;
        const base = mesh(new THREE.BoxGeometry(1.8, 0.4, 1.8), gold);
        base.position.y = 0.9;
        const col2 = mesh(new THREE.CylinderGeometry(1, 1.1, 0.7, 12).translate(0, 0.35, 0), lam(0x2a3a6b));
        tr.add(cup, stem, base);
        prop.add(col2, tr);
        anims.push((t) => (tr.rotation.y = t * 1.1));
        pr = 1.1;
        break;
      }
      case 'resume': {
        const tex = canvasTex(128, 170, (g, w, h) => {
          g.fillStyle = '#fff';
          g.fillRect(0, 0, w, h);
          g.fillStyle = '#10b981';
          g.fillRect(12, 14, 60, 10);
          g.fillStyle = '#c9d3e6';
          for (let i = 0; i < 9; i++) g.fillRect(12, 40 + i * 14, i % 3 === 2 ? 60 : 104, 6);
        });
        const doc = mesh(new THREE.BoxGeometry(2.6, 3.4, 0.25), [lam(0xffffff), lam(0xffffff), lam(0xffffff), lam(0xffffff), new THREE.MeshLambertMaterial({ map: tex }), new THREE.MeshLambertMaterial({ map: tex })]);
        doc.position.y = 2.4;
        prop.add(doc, mesh(new THREE.BoxGeometry(2, 0.7, 0.8).translate(0, 0.35, 0), lam(0x2a3a6b)));
        anims.push((t) => (doc.rotation.y = Math.sin(t * 0.7) * 0.4));
        pr = 1.4;
        break;
      }
      case 'contact': {
        prop.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 3, 8).translate(0, 1.5, 0), lam(0x2a3a6b)));
        const dish = new THREE.Group();
        const bowl = mesh(new THREE.SphereGeometry(1.4, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), lam(0xffffff, { side: THREE.DoubleSide }));
        bowl.rotation.x = Math.PI * 0.75;
        dish.add(bowl, new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), accent));
        dish.position.y = 3.2;
        prop.add(dish);
        anims.push((t) => (dish.rotation.y = Math.sin(t * 0.5) * 1.2));
        pr = 0.6;
        break;
      }
    }
    g.add(prop);
    if (pr) addStatic(def.x + px, def.z + pz, pr);
    scene.add(g);
    zones.push({ def, x: def.x, z: def.z, fill });
  }
  zoneDefs.forEach(buildZone);

  // ---------------- pushable toys ----------------
  const objs = [];
  const addObj = (m, x, z, r, mass, kind = 'box') => {
    scene.add(m);
    objs.push({ mesh: m, x, z, vx: 0, vz: 0, r, m: mass, kind, x0: x, z0: z });
    m.position.set(x, 0, z);
  };
  const lcols = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ec4899', '#ef4444'];
  [...'SHUBHAM'].forEach((ch, i) => {
    const plain = lam(parseInt(lcols[i].slice(1), 16));
    const L = letterMaterial(ch, lcols[i]);
    const b = mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6).translate(0, 0.8, 0), [L, L, plain, plain, L, L]);
    addObj(b, (i - 3) * 2.3, 0, 0.95, 2.4);
  });
  // cones
  const coneGeo = new THREE.ConeGeometry(0.38, 1, 10).translate(0, 0.5, 0);
  const coneMat = lam(0xff7a1a);
  for (let i = 0; i < 9; i++) {
    const c = mesh(coneGeo, coneMat);
    addObj(c, (i % 2 ? 1 : -1) * 7, 4 + Math.floor(i / 2) * 3.4, 0.42, 0.4, 'cone');
  }
  // crates near the projects pad
  const pj = zoneDefs.find((d) => d.id === 'projects');
  const rcr = rand(3);
  const crateCols = [0xd9a05b, 0xc98a45, 0xe4b574];
  for (let i = 0; i < 8; i++) {
    const len = Math.hypot(pj.x, pj.z);
    const bx = pj.x - (pj.x / len) * 8.5 + (rcr() - 0.5) * 6;
    const bz = pj.z - (pj.z / len) * 8.5 + (rcr() - 0.5) * 6;
    const c = mesh(new THREE.BoxGeometry(1.3, 1.3, 1.3).translate(0, 0.65, 0), lam(crateCols[i % 3]));
    c.rotation.y = rcr() * 3;
    addObj(c, bx, bz, 0.8, 1.2);
  }
  // barrels near the contact pad
  const ct = zoneDefs.find((d) => d.id === 'contact');
  for (let i = 0; i < 5; i++) {
    const len = Math.hypot(ct.x, ct.z);
    const b = mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.2, 14).translate(0, 0.6, 0), lam(i % 2 ? 0xec4899 : 0x3b82f6));
    addObj(b, ct.x - (ct.x / len) * 8.5 + (i - 2) * 1.6, ct.z - (ct.z / len) * 8.5 + (rcr() - 0.5) * 3, 0.58, 0.9);
  }
  // big ball
  const ball = mesh(new THREE.SphereGeometry(1.35, 20, 16).translate(0, 1.35, 0), lam(0xff6b6b));
  addObj(ball, -9, 22, 1.35, 0.8, 'ball');

  // ---------------- car ----------------
  const car = { x: SPAWN.x, z: SPAWN.z, th: SPAWN.th, vx: 0, vz: 0, vf: 0, vl: 0 };
  const carRoot = new THREE.Group();
  const carBody = new THREE.Group();
  carRoot.add(carBody);
  const addTo = (parent, m, x, y, z) => {
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  addTo(carBody, mesh(new THREE.BoxGeometry(1.7, 0.6, 3.0), lam(0xff6b57)), 0, 0.75, 0);
  addTo(carBody, mesh(new THREE.BoxGeometry(1.4, 0.5, 1.5), lam(0xffe3dc)), 0, 1.3, -0.2);
  addTo(carBody, mesh(new THREE.BoxGeometry(1.85, 0.25, 0.3), lam(0x1d2a52)), 0, 0.55, 1.55);
  addTo(carBody, mesh(new THREE.BoxGeometry(1.85, 0.25, 0.3), lam(0x1d2a52)), 0, 0.55, -1.55);
  [-0.55, 0.55].forEach((x) => {
    addTo(carBody, new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.08), basic(0xfff1a8)), x, 0.88, 1.52);
    addTo(carBody, new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.08), basic(0xff3b3b)), x, 0.88, -1.52);
  });
  const head = addTo(carBody, mesh(new THREE.SphereGeometry(0.4, 16, 12), lam(0xffffff)), 0, 1.95, -0.2);
  addTo(carBody, new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.2), lam(0x111a33)), 0, 1.97, 0.12);
  [-0.12, 0.12].forEach((x) => addTo(carBody, new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), basic(0x22d3ee)), x, 1.98, 0.23));
  addTo(carBody, mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), lam(0x1d2a52)), 0.45, 2.1, -0.3);
  const wheels = [];
  const fronts = [];
  [[-0.98, 1.0, true], [0.98, 1.0, true], [-0.98, -1.0, false], [0.98, -1.0, false]].forEach(([x, z, front]) => {
    const piv = new THREE.Group();
    piv.position.set(x, 0.4, z);
    const w = mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.34, 14).rotateZ(Math.PI / 2), lam(0x1a1f33));
    piv.add(w);
    carRoot.add(piv);
    wheels.push(w);
    if (front) fronts.push(piv);
  });
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 4.6),
    new THREE.MeshBasicMaterial({
      map: canvasTex(64, 64, (g) => {
        const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, 'rgba(0,0,0,.45)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, 64, 64);
      }),
      transparent: true,
      depthWrite: false,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.04;
  carRoot.add(shadow);
  scene.add(carRoot);

  // ---------------- input ----------------
  const keys = {};
  const joy = { x: 0, y: 0 };
  const touchBtn = { brake: false, boost: false };
  let locked = false;
  let frozen = false;
  let nearby = null;
  let armed = true;
  let dwell = 0;
  let audio = null;

  function horn() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = audio.currentTime;
      const gn = audio.createGain();
      gn.gain.setValueAtTime(0.0001, t0);
      gn.gain.exponentialRampToValueAtTime(0.12, t0 + 0.03);
      gn.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
      gn.connect(audio.destination);
      [392, 494].forEach((f) => {
        const o = audio.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.connect(gn);
        o.start(t0);
        o.stop(t0 + 0.42);
      });
    } catch (e) {}
  }
  function interact() {
    if (locked || frozen || !nearby || !armed) return;
    armed = false;
    opts.onInteract && opts.onInteract(nearby);
  }
  const isTyping = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '');
  const onButton = () => document.activeElement && /^(BUTTON|A)$/.test(document.activeElement.tagName);
  addEventListener('keydown', (e) => {
    if (isTyping(e)) return;
    keys[e.code] = true;
    if (!e.repeat) {
      if (e.code === 'KeyE' || (e.code === 'Enter' && !onButton())) interact();
      if (e.code === 'KeyH') horn();
      if (e.code === 'KeyR' && !locked) api.reset(true);
    }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && !onButton()) e.preventDefault();
  });
  addEventListener('keyup', (e) => (keys[e.code] = false));
  addEventListener('blur', () => Object.keys(keys).forEach((k) => (keys[k] = false)));

  // camera drag + zoom
  const cam = { yaw: SPAWN.th + Math.PI, off: 0, pitchOff: 0, dist: 11, h: 6.5 };
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (drag) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    cam.off = clamp(cam.off - (e.clientX - drag.x) * 0.006, -2.6, 2.6);
    cam.pitchOff = clamp(cam.pitchOff + (e.clientY - drag.y) * 0.03, -2.5, 6);
    drag.x = e.clientX;
    drag.y = e.clientY;
  });
  const endDrag = (e) => {
    if (drag && e.pointerId === drag.id) drag = null;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener(
    'wheel',
    (e) => {
      cam.dist = clamp(cam.dist + e.deltaY * 0.01, 7, 18);
      e.preventDefault();
    },
    { passive: false }
  );

  // ---------------- physics ----------------
  const OFFS = [1.0, 0, -1.0];
  const RC = 0.95;
  const CAR_M = 8;

  function stepCar(h, inp) {
    let fx = Math.sin(car.th);
    let fz = Math.cos(car.th);
    let rx = fz;
    let rz = -fx;
    let vf = car.vx * fx + car.vz * fz;
    let vl = car.vx * rx + car.vz * rz;
    const boost = inp.boost;
    const maxV = boost ? BOOST_V : MAX_V;
    if (inp.throttle > 0) {
      if (vf < maxV) vf += ACC * inp.throttle * (boost ? 1.5 : 1) * h;
    } else if (inp.throttle < 0) {
      if (vf > 0.6) vf -= BRAKE * -inp.throttle * h;
      else if (vf > -REV_V) vf += ACC * 0.7 * inp.throttle * h;
    } else vf *= Math.exp(-0.9 * h);
    if (inp.brake) vf *= Math.exp(-1.3 * h);
    vf *= Math.exp(-0.12 * h);
    const lat0 = vl;
    vl *= Math.exp(-(inp.brake ? 1.6 : 9) * h);
    car.th += inp.steer * TURN * clamp(vf / 5, -1, 1) * (inp.brake ? 1.45 : 1) * h;
    fx = Math.sin(car.th);
    fz = Math.cos(car.th);
    rx = fz;
    rz = -fx;
    car.vx = fx * vf + rx * vl;
    car.vz = fz * vf + rz * vl;
    car.x += car.vx * h;
    car.z += car.vz * h;
    car.vf = vf;
    car.vl = vl;
    car.latAcc = (lat0 - vl) / Math.max(h, 1e-3);

    // car circles vs toys / statics / edge
    for (const off of OFFS) {
      const cx = car.x + fx * off;
      const cz = car.z + fz * off;
      for (const o of objs) {
        const dx = o.x - cx;
        const dz = o.z - cz;
        const d = Math.hypot(dx, dz) || 1e-4;
        const min = RC + o.r;
        if (d < min) {
          const nx = dx / d;
          const nz = dz / d;
          const ov = min - d;
          o.x += nx * ov * 0.9;
          o.z += nz * ov * 0.9;
          car.x -= nx * ov * 0.1 * (o.m / CAR_M);
          car.z -= nz * ov * 0.1 * (o.m / CAR_M);
          const vn = (o.vx - car.vx) * nx + (o.vz - car.vz) * nz;
          if (vn < 0) {
            const j = (-(1 + 0.35) * vn) / (1 / CAR_M + 1 / o.m);
            o.vx += (nx * j) / o.m;
            o.vz += (nz * j) / o.m;
            car.vx -= (nx * j) / CAR_M;
            car.vz -= (nz * j) / CAR_M;
          }
        }
      }
      for (const s of statics) {
        const dx = cx - s.x;
        const dz = cz - s.z;
        const d = Math.hypot(dx, dz) || 1e-4;
        const min = RC + s.r;
        if (d < min) {
          const nx = dx / d;
          const nz = dz / d;
          car.x += nx * (min - d);
          car.z += nz * (min - d);
          const vn = car.vx * nx + car.vz * nz;
          if (vn < 0) {
            car.vx -= 1.3 * vn * nx;
            car.vz -= 1.3 * vn * nz;
          }
        }
      }
      const rr = Math.hypot(cx, cz);
      if (rr > WORLD_R - RC) {
        const nx = -cx / rr;
        const nz = -cz / rr;
        car.x += nx * (rr - (WORLD_R - RC));
        car.z += nz * (rr - (WORLD_R - RC));
        const vn = car.vx * nx + car.vz * nz;
        if (vn < 0) {
          car.vx -= 1.4 * vn * nx;
          car.vz -= 1.4 * vn * nz;
        }
      }
    }
    // keep forward speed consistent after collisions
    car.vf = car.vx * fx + car.vz * fz;
  }

  function stepObjs(h) {
    const damp = Math.exp(-2.2 * h);
    for (const o of objs) {
      o.x += o.vx * h;
      o.z += o.vz * h;
      o.vx *= damp;
      o.vz *= damp;
      if (Math.abs(o.vx) + Math.abs(o.vz) < 0.04) o.vx = o.vz = 0;
    }
    for (let i = 0; i < objs.length; i++) {
      const a = objs[i];
      for (let j = i + 1; j < objs.length; j++) {
        const b = objs[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const min = a.r + b.r;
        if (Math.abs(dx) > min || Math.abs(dz) > min) continue;
        const d = Math.hypot(dx, dz) || 1e-4;
        if (d >= min) continue;
        const nx = dx / d;
        const nz = dz / d;
        const ov = min - d;
        const tm = a.m + b.m;
        a.x -= nx * ov * (b.m / tm);
        a.z -= nz * ov * (b.m / tm);
        b.x += nx * ov * (a.m / tm);
        b.z += nz * ov * (a.m / tm);
        const vn = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
        if (vn < 0) {
          const jn = (-(1.3) * vn) / (1 / a.m + 1 / b.m);
          a.vx -= (nx * jn) / a.m;
          a.vz -= (nz * jn) / a.m;
          b.vx += (nx * jn) / b.m;
          b.vz += (nz * jn) / b.m;
        }
      }
      for (const s of statics) {
        const dx = a.x - s.x;
        const dz = a.z - s.z;
        const d = Math.hypot(dx, dz) || 1e-4;
        const min = a.r + s.r;
        if (d < min) {
          const nx = dx / d;
          const nz = dz / d;
          a.x += nx * (min - d);
          a.z += nz * (min - d);
          const vn = a.vx * nx + a.vz * nz;
          if (vn < 0) {
            a.vx -= 1.4 * vn * nx;
            a.vz -= 1.4 * vn * nz;
          }
        }
      }
      const rr = Math.hypot(a.x, a.z);
      if (rr > WORLD_R - a.r) {
        const nx = -a.x / rr;
        const nz = -a.z / rr;
        a.x += nx * (rr - (WORLD_R - a.r));
        a.z += nz * (rr - (WORLD_R - a.r));
        const vn = a.vx * nx + a.vz * nz;
        if (vn < 0) {
          a.vx -= 1.5 * vn * nx;
          a.vz -= 1.5 * vn * nz;
        }
      }
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
    flowers.count = sh ? flowerSpots.length : 70;
    clouds.forEach((c, i) => (c.visible = sh || i < 4));
    opts.onQuality && opts.onQuality(q, qualityMode);
  }
  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);

  // ---------------- main loop ----------------
  const camLook = new THREE.Vector3(SPAWN.x, 1, SPAWN.z);
  const tmp = new THREE.Vector3();
  let clock = 0;
  let last = 0;
  let raf = 0;
  let fpsAcc = 0;
  let fpsFrames = 0;
  let lowStrikes = 0;
  let steerVis = 0;
  let camInit = false;

  function update(dt) {
    clock += dt * timeScale;
    // input
    let throttle = 0;
    let steer = 0;
    let brake = false;
    let boost = false;
    if (!locked) {
      throttle = clamp((keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) + joy.y, -1, 1);
      steer = clamp((keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0) - joy.x, -1, 1);
      brake = !!keys.Space || touchBtn.brake;
      boost = !!(keys.ShiftLeft || keys.ShiftRight) || touchBtn.boost;
    }
    let rem = dt;
    while (rem > 1e-5) {
      const h = Math.min(rem, 1 / 60);
      stepCar(h, { throttle, steer, brake, boost });
      stepObjs(h);
      rem -= h;
    }

    // sync meshes
    carRoot.position.set(car.x, 0, car.z);
    carRoot.rotation.y = car.th;
    carBody.rotation.z = clamp(-(car.latAcc || 0) * 0.004, -0.09, 0.09);
    carBody.rotation.x = clamp(-(throttle * 0.03), -0.05, 0.05);
    head.rotation.y = Math.sin(clock * 1.5) * 0.3;
    steerVis += (steer * 0.45 - steerVis) * Math.min(1, dt * 12);
    fronts.forEach((p) => (p.rotation.y = steerVis));
    wheels.forEach((w) => (w.rotation.x += (car.vf * dt) / 0.4));
    for (const o of objs) {
      o.mesh.position.x = o.x;
      o.mesh.position.z = o.z;
      if (o.kind === 'ball') {
        o.mesh.rotation.x += (o.vz * dt) / o.r;
        o.mesh.rotation.z -= (o.vx * dt) / o.r;
      }
    }

    // zones
    let inside = null;
    let best = ZONE_R - 0.5;
    zones.forEach((z) => {
      const d = Math.hypot(z.x - car.x, z.z - car.z);
      if (d < best) {
        best = d;
        inside = z.def.id;
      }
    });
    if (inside !== nearby) {
      nearby = inside;
      dwell = 0;
      if (!inside) armed = true;
      opts.onNearby && opts.onNearby(inside);
    }
    if (nearby && armed && !locked && Math.hypot(car.vx, car.vz) < 3) {
      dwell += dt;
      if (dwell >= DWELL) interact();
    } else dwell = Math.max(0, dwell - dt * 2);
    zones.forEach((z) => z.fill.scale.setScalar(z.def.id === nearby ? Math.max(0.001, Math.min(1, dwell / DWELL)) : 0.001));

    anims.forEach((fn) => fn(clock));

    // camera
    if (!drag) {
      cam.off *= Math.exp(-dt * 0.7);
      cam.pitchOff *= Math.exp(-dt * 0.7);
    }
    const portrait = camera.aspect < 1;
    const dist = cam.dist * (portrait ? 1.25 : 1);
    const targetYaw = car.th + Math.PI;
    if (!camInit) {
      cam.yaw = targetYaw;
      camInit = true;
    }
    let dy = targetYaw - cam.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    cam.yaw += dy * (1 - Math.exp(-dt * 3));
    const yaw = cam.yaw + cam.off;
    const hgt = clamp(cam.h + cam.pitchOff, 3, 14) * (portrait ? 1.2 : 1);
    tmp.set(car.x + Math.sin(yaw) * dist, hgt, car.z + Math.cos(yaw) * dist);
    if (Math.hypot(tmp.x, tmp.z) > WORLD_R + 25) tmp.multiplyScalar((WORLD_R + 25) / Math.hypot(tmp.x, tmp.z));
    camera.position.lerp(tmp, 1 - Math.exp(-dt * 6));
    const sp = Math.hypot(car.vx, car.vz);
    camLook.lerp(tmp.set(car.x + Math.sin(car.th) * 3, 1.2, car.z + Math.cos(car.th) * 3), 1 - Math.exp(-dt * 6));
    camera.lookAt(camLook);
    const fov = (portrait ? 68 : 58) + (sp / BOOST_V) * 9;
    if (Math.abs(camera.fov - fov) > 0.05) {
      camera.fov += (fov - camera.fov) * Math.min(1, dt * 4);
      camera.updateProjectionMatrix();
    }
    sky.position.copy(camera.position);
    sun.position.set(car.x + 30, 50, car.z + 20);
    sun.target.position.set(car.x, 0, car.z);
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
      const was = locked;
      locked = !!v;
      if (was && !locked) {
        armed = false; // must leave the pad before it can re-open
        dwell = 0;
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
    setBrake: (v) => (touchBtn.brake = !!v),
    setBoost: (v) => (touchBtn.boost = !!v),
    horn,
    interact,
    reset(carOnly) {
      car.x = SPAWN.x;
      car.z = SPAWN.z;
      car.th = SPAWN.th;
      car.vx = car.vz = car.vf = car.vl = 0;
      cam.off = cam.pitchOff = 0;
      cam.yaw = SPAWN.th + Math.PI;
      armed = true;
      if (!carOnly) objs.forEach((o) => ((o.x = o.x0), (o.z = o.z0), (o.vx = o.vz = 0)));
    },
    setQuality(mode) {
      qualityMode = mode;
      applyQuality(mode === 'auto' ? (isMobile || lowEnd ? 'low' : 'high') : mode);
    },
    getState: () => ({
      x: car.x,
      z: car.z,
      heading: car.th,
      nearby,
      quality,
      qualityMode,
      worldRadius: WORLD_R,
      stations: zoneDefs.map((d) => ({ id: d.id, css: d.css, x: d.x, z: d.z })),
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
