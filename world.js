// =====================================================================
//  world.js — the 3D island: scene, portal, stations, robot, controls.
//  Loaded with a dynamic import from main.js so that if Three.js fails
//  to load, the rest of the site still works (menu + panels).
// =====================================================================
import * as THREE from 'three';
import { STATIONS } from './data.js';

const ISLAND_R = 29;
const WALK = 6;
const RUN = 10.5;
const CLICK_SPEED = 8;
const GRAVITY = 22;
const JUMP_V = 8;
const INTERACT_R = 7.5;
const START = { x: 0, z: 10 };
const PORTAL_R = 5.6;
const BUILDING_R = 3.3;

const rand = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

function stationPos(d) {
  const a = (d.angle * Math.PI) / 180;
  return { x: Math.sin(a) * d.radius, z: -Math.cos(a) * d.radius };
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

function glowTexture() {
  return canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.3, 'rgba(255,255,255,0.35)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
  });
}

function gridTexture() {
  const t = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#0b1330';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(60,120,220,0.45)';
    g.lineWidth = 2;
    g.strokeRect(0, 0, w, h);
    g.strokeStyle = 'rgba(60,120,220,0.18)';
    g.lineWidth = 1;
    for (let i = 64; i < w; i += 64) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, h);
      g.moveTo(0, i);
      g.lineTo(w, i);
      g.stroke();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(12, 12);
  return t;
}

function labelSprite(text, css) {
  const tex = canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = 'rgba(5,10,30,0.78)';
    g.strokeStyle = css;
    g.lineWidth = 6;
    const r = 22;
    g.beginPath();
    g.moveTo(r, 6);
    g.arcTo(w - 6, 6, w - 6, h - 6, r);
    g.arcTo(w - 6, h - 6, 6, h - 6, r);
    g.arcTo(6, h - 6, 6, 6, r);
    g.arcTo(6, 6, w - 6, 6, r);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = '#ffffff';
    g.font = '700 54px system-ui, Segoe UI, Roboto, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 3);
  });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
  sp.scale.set(5.2, 1.3, 1);
  return sp;
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
  scene.fog = new THREE.FogExp2(0x141a40, 0.011);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 900);

  // ---------------- lights ----------------
  scene.add(new THREE.HemisphereLight(0x6c8cff, 0x1a1030, 0.9));
  const sun = new THREE.DirectionalLight(0x9bb7ff, 1.3);
  sun.position.set(-22, 32, 16);
  sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -34;
  sc.right = sc.top = 34;
  sc.near = 1;
  sc.far = 90;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x8b5cf6, 0.55);
  rim.position.set(20, 12, -25);
  scene.add(rim);

  // ---------------- sky ----------------
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(450, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader:
        'varying vec3 vP; void main(){ float h=normalize(vP).y; vec3 top=vec3(.02,.04,.13); vec3 mid=vec3(.08,.12,.34); vec3 hor=vec3(.45,.25,.6); vec3 c=mix(hor,mid,smoothstep(0.,.25,h)); c=mix(c,top,smoothstep(.2,.8,h)); gl_FragColor=vec4(c,1.); }',
    })
  );
  scene.add(sky);

  const starCount = 700;
  const starPos = new Float32Array(starCount * 3);
  const rs = rand(7);
  for (let i = 0; i < starCount; i++) {
    const u = rs() * Math.PI * 2;
    const v = Math.acos(0.05 + rs() * 0.95);
    starPos[i * 3] = 400 * Math.sin(v) * Math.cos(u);
    starPos[i * 3 + 1] = 400 * Math.cos(v);
    starPos[i * 3 + 2] = 400 * Math.sin(v) * Math.sin(u);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xbcd0ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 }));
  scene.add(stars);

  const glowTex = glowTexture();
  const moon = new THREE.Mesh(new THREE.SphereGeometry(18, 24, 16), new THREE.MeshBasicMaterial({ color: 0xdfe8ff, fog: false, toneMapped: false }));
  moon.position.set(-170, 120, -300);
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x7aa2ff, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
  moonGlow.scale.set(110, 110, 1);
  moon.add(moonGlow);
  scene.add(moon);

  // ---------------- materials ----------------
  const metal = new THREE.MeshStandardMaterial({ color: 0x1a2744, metalness: 0.65, roughness: 0.45 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0e1630, metalness: 0.5, roughness: 0.6 });
  const rock = new THREE.MeshStandardMaterial({ color: 0x1a1f3a, roughness: 1, flatShading: true });
  const basic = (hex, extra = {}) => new THREE.MeshBasicMaterial({ color: hex, toneMapped: false, ...extra });
  const mesh = (geo, mat, cast = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast;
    m.receiveShadow = true;
    return m;
  };
  const anims = [];

  // ---------------- island ----------------
  const ground = mesh(
    new THREE.CylinderGeometry(ISLAND_R, ISLAND_R - 1, 1, 64),
    [rock, new THREE.MeshStandardMaterial({ map: gridTexture(), metalness: 0.4, roughness: 0.7 }), rock],
    false
  );
  ground.position.y = -0.5;
  scene.add(ground);
  const under = mesh(new THREE.ConeGeometry(ISLAND_R - 1, 18, 24), rock, false);
  under.rotation.x = Math.PI;
  under.position.y = -10;
  scene.add(under);
  const edge = new THREE.Mesh(new THREE.TorusGeometry(ISLAND_R - 0.4, 0.14, 8, 96), basic(0x22d3ee));
  edge.rotation.x = Math.PI / 2;
  edge.position.y = 0.05;
  scene.add(edge);

  // ground rings + paths
  const ringMat = basic(0x22d3ee, { transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
  [[6.2, 6.4], [11, 11.12]].forEach(([a, b]) => {
    const r = new THREE.Mesh(new THREE.RingGeometry(a, b, 72), ringMat);
    r.rotation.x = -Math.PI / 2;
    r.position.y = 0.03;
    scene.add(r);
  });
  const pathMat = basic(0x22d3ee, { transparent: true, opacity: 0.22, depthWrite: false });

  // ---------------- portal ----------------
  const portal = new THREE.Group();
  scene.add(portal);
  const pedestal = mesh(new THREE.CylinderGeometry(5, 5.4, 0.6, 48), metal);
  pedestal.position.y = 0.3;
  portal.add(pedestal);
  const pedRing = new THREE.Mesh(new THREE.TorusGeometry(5, 0.1, 8, 64), basic(0x38bdf8));
  pedRing.rotation.x = Math.PI / 2;
  pedRing.position.y = 0.62;
  portal.add(pedRing);
  const arch = mesh(new THREE.TorusGeometry(3.6, 0.3, 12, 64), metal);
  arch.position.y = 4.4;
  portal.add(arch);
  const archInner = new THREE.Mesh(new THREE.TorusGeometry(3.05, 0.07, 8, 64), basic(0x67e8f9));
  archInner.position.y = 4.4;
  portal.add(archInner);
  const spinRing = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.05, 8, 64, Math.PI * 1.4), basic(0xa78bfa));
  spinRing.position.y = 4.4;
  portal.add(spinRing);
  [-1, 1].forEach((s) => {
    const p = mesh(new THREE.BoxGeometry(0.7, 1.4, 0.9), metal);
    p.position.set(s * 3.6, 0.9, 0);
    portal.add(p);
  });
  const portalMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float uTime;
      void main(){ vec2 p=vUv-.5; float r=length(p)*2.; float a=atan(p.y,p.x);
        float sw=sin(a*6.+r*10.-uTime*2.)*.5+.5; float gl=smoothstep(1.,0.,r);
        vec3 c=mix(vec3(0.,.4,1.),vec3(.2,1.,1.),sw*gl);
        c+=vec3(.5,.2,1.)*smoothstep(.9,.6,r)*.2*sin(uTime+a*3.);
        float al=smoothstep(1.,.85,r)*(.35+.65*gl);
        gl_FragColor=vec4(c,al); }`,
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(3.05, 48), portalMat);
  disc.position.y = 4.4;
  portal.add(disc);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 3, 14, 32, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })
  );
  beam.position.y = 7;
  portal.add(beam);
  const portalLight = new THREE.PointLight(0x38bdf8, 70, 32, 2);
  portalLight.position.set(0, 4.4, 2.5);
  portal.add(portalLight);
  const portalGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x38bdf8, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  portalGlow.scale.set(14, 14, 1);
  portalGlow.position.y = 4.4;
  portalGlow.raycast = () => {};
  portal.add(portalGlow);
  anims.push((t) => {
    portalMat.uniforms.uTime.value = t;
    spinRing.rotation.z = t * 0.8;
    portalGlow.material.opacity = 0.75 + Math.sin(t * 1.6) * 0.15;
  });

  // ---------------- stations ----------------
  const stationGroups = [];
  const colliders = [{ x: 0, z: 0, r: PORTAL_R }];

  function buildStation(def) {
    const pos = stationPos(def);
    const g = new THREE.Group();
    const accent = basic(def.hex);
    const h = def.height;
    const add = (m, x, y, z) => {
      m.position.set(x, y, z);
      g.add(m);
      return m;
    };
    add(mesh(new THREE.CylinderGeometry(3.5, 3.9, 0.5, 8), dark), 0, 0.25, 0);
    add(mesh(new THREE.BoxGeometry(3.6, h, 3.2), metal), 0, 0.5 + h / 2, 0);
    [0.7, 0.5 + h - 0.2].forEach((y) => add(new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.18, 3.4), accent), 0, y, 0));
    add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.4, 0.1), dark), 0, 1.7, 1.6);
    add(new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.2), accent), 0, 1.65, 1.66);
    for (let i = 0; i < 3; i++) {
      [-1, 1].forEach((s) => {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.35), accent);
        w.rotation.y = s * (Math.PI / 2);
        w.position.set(s * 1.81, 1.6 + i * Math.max(0.9, (h - 2.4) / 3), 0);
        g.add(w);
      });
    }
    const topY = 0.5 + h;
    let extra = 0;
    switch (def.id) {
      case 'about': {
        const dome = mesh(new THREE.SphereGeometry(1.9, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), metal);
        add(dome, 0, topY, 0);
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 6), accent), 0, topY + 2.3, 0);
        extra = 2.6;
        break;
      }
      case 'lab': {
        add(mesh(new THREE.BoxGeometry(1.7, 5, 1.7), metal), 0, topY + 2.5, 0);
        add(new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), accent), 0, topY + 5.6, 0);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.06, 8, 40), accent);
        add(ring, 0, topY + 3.6, 0);
        ring.rotation.x = Math.PI / 2;
        anims.push((t) => {
          ring.rotation.z = t * 1.2;
          ring.position.y = topY + 3.6 + Math.sin(t) * 0.5;
        });
        extra = 6.4;
        break;
      }
      case 'projects': {
        add(mesh(new THREE.BoxGeometry(4.2, 0.3, 3.8), dark), 0, topY + 0.15, 0);
        const cubes = [0, 1, 2].map((i) => {
          const c = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), basic(def.hex, { wireframe: true }));
          add(c, (i - 1) * 1.3, topY + 1.4, 0);
          return c;
        });
        anims.push((t) =>
          cubes.forEach((c, i) => {
            c.rotation.x = t + i;
            c.rotation.y = t * 0.8 + i;
            c.position.y = topY + 1.4 + Math.sin(t * 1.3 + i) * 0.25;
          })
        );
        extra = 2.4;
        break;
      }
      case 'achievements': {
        add(mesh(new THREE.ConeGeometry(1.8, 2.6, 8), metal), 0, topY + 1.3, 0);
        const trophy = new THREE.Group();
        const gold = basic(0xfbbf24);
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.25, 0.6, 14), gold);
        cup.position.y = 0.5;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.4, 8), gold);
        stem.position.y = 0.05;
        const tb = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.6), gold);
        tb.position.y = -0.15;
        trophy.add(cup, stem, tb);
        add(trophy, 0, topY + 3.6, 0);
        anims.push((t) => {
          trophy.rotation.y = t * 1.1;
          trophy.position.y = topY + 3.6 + Math.sin(t * 1.4) * 0.2;
        });
        extra = 4.6;
        break;
      }
      case 'resume': {
        add(mesh(new THREE.BoxGeometry(4, 0.3, 3.6), dark), 0, topY + 0.15, 0);
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.3), basic(def.hex, { transparent: true, opacity: 0.85 }));
        add(scr, 0, topY + 1.1, 1.0);
        scr.rotation.x = -0.25;
        extra = 2.3;
        break;
      }
      case 'contact': {
        add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.6, 8), metal), 0, topY + 0.8, 0);
        const dish = new THREE.Group();
        const bowl = mesh(new THREE.SphereGeometry(1.1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), metal);
        bowl.rotation.x = Math.PI * 0.8;
        dish.add(bowl);
        dish.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), accent));
        add(dish, 0, topY + 1.8, 0);
        anims.push((t) => (dish.rotation.y = Math.sin(t * 0.4) * 1.2));
        extra = 3.2;
        break;
      }
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: def.hex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
    glow.scale.set(5, 5, 1);
    glow.position.set(0, 1.7, 2.3);
    glow.raycast = () => {};
    g.add(glow);

    const label = labelSprite(def.label, def.css);
    label.position.set(0, topY + extra + 1.2, 0);
    g.add(label);

    const ring = new THREE.Mesh(new THREE.RingGeometry(4.55, 4.8, 48), basic(def.hex, { transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    ring.raycast = () => {};
    g.add(ring);

    g.position.set(pos.x, 0, pos.z);
    g.rotation.y = Math.atan2(-pos.x, -pos.z); // door faces the portal
    g.userData = { stationId: def.id, ring };
    scene.add(g);
    stationGroups.push(g);
    colliders.push({ x: pos.x, z: pos.z, r: BUILDING_R });

    // glowing path from portal to station
    const d = { x: Math.sin((def.angle * Math.PI) / 180), z: -Math.cos((def.angle * Math.PI) / 180) };
    const r0 = 6.4;
    const r1 = def.radius - 4.2;
    const len = r1 - r0;
    const path = new THREE.Mesh(new THREE.PlaneGeometry(1.2, len).rotateX(-Math.PI / 2), pathMat);
    path.position.set(d.x * (r0 + len / 2), 0.02, d.z * (r0 + len / 2));
    path.rotation.y = Math.atan2(d.x, d.z);
    scene.add(path);
  }
  STATIONS.forEach(buildStation);

  // ---------------- decoration ----------------
  const farFromBuildings = (x, z, m) => colliders.every((c) => Math.hypot(x - c.x, z - c.z) > c.r + m);
  const rd = rand(42);
  const crystalMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, emissive: 0x2563eb, emissiveIntensity: 0.7, roughness: 0.3 });
  const crystals = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.5), crystalMat, 36);
  const treeMat = new THREE.MeshStandardMaterial({ color: 0x0f3d4a, emissive: 0x0e7490, emissiveIntensity: 0.25, flatShading: true });
  const trees = new THREE.InstancedMesh(new THREE.ConeGeometry(0.9, 2.6, 6), treeMat, 40);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const fill = (inst, n, rMin, rMax, yOff, scaleFn) => {
    let i = 0;
    let tries = 0;
    while (i < n && tries++ < 600) {
      const a = rd() * Math.PI * 2;
      const r = rMin + rd() * (rMax - rMin);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (!farFromBuildings(x, z, 2.2)) continue;
      const s = scaleFn();
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rd() * 6.28);
      m4.compose(new THREE.Vector3(x, yOff * s.y, z), q, new THREE.Vector3(s.x, s.y, s.x));
      inst.setMatrixAt(i++, m4);
    }
    inst.count = i;
    inst.userData.full = i;
    inst.instanceMatrix.needsUpdate = true;
  };
  fill(crystals, 36, 22, 27.5, 1, () => ({ x: 0.5 + rd() * 0.7, y: 1.2 + rd() * 2 }));
  fill(trees, 40, 18, 27, 1.3, () => ({ x: 0.7 + rd() * 0.6, y: 0.8 + rd() * 0.9 }));
  scene.add(crystals, trees);

  const islands = [];
  const ri = rand(99);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + ri();
    const r = 48 + ri() * 30;
    const g = new THREE.Group();
    const s = 3 + ri() * 4;
    const top = mesh(new THREE.CylinderGeometry(s, s * 0.9, 0.8, 12), new THREE.MeshStandardMaterial({ color: 0x12304a, roughness: 0.9, flatShading: true }), false);
    const bot = mesh(new THREE.ConeGeometry(s * 0.9, s * 1.6, 10), rock, false);
    bot.rotation.x = Math.PI;
    bot.position.y = -0.8 - s * 0.8;
    g.add(top, bot);
    for (let k = 0; k < 3; k++) {
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 6), treeMat);
      t.position.set((ri() - 0.5) * s, 1.2, (ri() - 0.5) * s);
      g.add(t);
    }
    const y = -4 + ri() * 14;
    g.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    const phase = ri() * 6;
    anims.push((t) => (g.position.y = y + Math.sin(t * 0.4 + phase) * 0.6));
    scene.add(g);
    islands.push(g);
  }

  // ---------------- robot ----------------
  const robot = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xe8eefc, metalness: 0.2, roughness: 0.35 });
  const darkR = new THREE.MeshStandardMaterial({ color: 0x111a33, metalness: 0.4, roughness: 0.5 });
  const eyeMat = basic(0x22d3ee);
  const body = mesh(new THREE.CapsuleGeometry(0.38, 0.5, 4, 12), white);
  body.position.y = 0.95;
  const head = mesh(new THREE.SphereGeometry(0.4, 18, 14), white);
  head.position.y = 1.75;
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.33, 16, 12), darkR);
  visor.scale.set(1, 0.75, 0.6);
  visor.position.set(0, 1.77, 0.24);
  const pack = mesh(new THREE.BoxGeometry(0.5, 0.6, 0.2), darkR);
  pack.position.set(0, 1.0, -0.38);
  const chest = new THREE.Mesh(new THREE.CircleGeometry(0.09, 12), eyeMat);
  chest.position.set(0, 1.05, 0.385);
  robot.add(body, head, visor, pack, chest);
  [-0.13, 0.13].forEach((x) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), eyeMat);
    e.position.set(x, 1.78, 0.45);
    robot.add(e);
  });
  const limb = (x, y, len, rad) => {
    const piv = new THREE.Group();
    piv.position.set(x, y, 0);
    const m = mesh(new THREE.CapsuleGeometry(rad, len, 4, 8), white);
    m.position.y = -len / 2 - rad * 0.5;
    piv.add(m);
    robot.add(piv);
    return piv;
  };
  const armL = limb(-0.52, 1.3, 0.35, 0.1);
  const armR = limb(0.52, 1.3, 0.35, 0.1);
  const legL = limb(-0.2, 0.62, 0.3, 0.13);
  const legR = limb(0.2, 0.62, 0.3, 0.13);
  robot.position.set(START.x, 0, START.z);
  scene.add(robot);

  const marker = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.65, 24), basic(0x67e8f9, { transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  marker.rotation.x = -Math.PI / 2;
  marker.visible = false;
  scene.add(marker);

  // ---------------- state & input ----------------
  const p = { x: START.x, z: START.z, y: 0, vy: 0, heading: Math.PI };
  const cam = { yaw: 0, pitch: 0.42, dist: 9 };
  const keys = {};
  const joy = { x: 0, y: 0 };
  let target = null;
  let pending = null;
  let nearby = null;
  let locked = false;
  let frozen = false;
  let phase = 0;
  let moving = false;

  const isTyping = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '');
  const onKey = (down) => (e) => {
    if (isTyping(e)) return;
    keys[e.code] = down;
    if (down && !e.repeat) {
      const onButton = document.activeElement && /^(BUTTON|A)$/.test(document.activeElement.tagName);
      if (e.code === 'KeyE' || (e.code === 'Enter' && !onButton)) interact();
      if (e.code === 'Space' && !onButton) jump();
    }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && !(document.activeElement && /^(BUTTON|A)$/.test(document.activeElement.tagName))) e.preventDefault();
  };
  addEventListener('keydown', onKey(true));
  addEventListener('keyup', onKey(false));
  addEventListener('blur', () => Object.keys(keys).forEach((k) => (keys[k] = false)));

  function jump() {
    if (!locked && !frozen && p.y <= 0.001) p.vy = JUMP_V;
  }
  function interact() {
    if (locked || frozen || !nearby) return;
    opts.onInteract && opts.onInteract(nearby);
  }

  // pointer: drag = look, tap = travel / open
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (drag) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    drag.moved = true;
    cam.yaw -= (e.clientX - (drag.lx ?? drag.x)) * 0.005;
    cam.pitch = Math.min(1.1, Math.max(0.12, cam.pitch + (e.clientY - (drag.ly ?? drag.y)) * 0.004));
    drag.lx = e.clientX;
    drag.ly = e.clientY;
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const wasTap = !drag.moved && e.type === 'pointerup';
    drag = null;
    if (wasTap && !locked && !frozen) tapAt(e.clientX, e.clientY);
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener(
    'wheel',
    (e) => {
      cam.dist = Math.min(16, Math.max(5, cam.dist + e.deltaY * 0.01));
      e.preventDefault();
    },
    { passive: false }
  );

  function resolvePoint(pt) {
    const l = Math.hypot(pt.x, pt.z);
    if (l > ISLAND_R - 1.5) {
      pt.x *= (ISLAND_R - 1.5) / l;
      pt.z *= (ISLAND_R - 1.5) / l;
    }
    colliders.forEach((c) => {
      const dx = pt.x - c.x;
      const dz = pt.z - c.z;
      const d = Math.hypot(dx, dz) || 0.001;
      if (d < c.r + 0.9) {
        pt.x = c.x + (dx / d) * (c.r + 0.9);
        pt.z = c.z + (dz / d) * (c.r + 0.9);
      }
    });
    return pt;
  }

  function travelTo(id, openOnArrive = true) {
    const def = STATIONS.find((s) => s.id === id);
    if (!def) return;
    const sp = stationPos(def);
    const dl = Math.hypot(sp.x, sp.z) || 1;
    target = { x: sp.x - (sp.x / dl) * 4.8, z: sp.z - (sp.z / dl) * 4.8, t: 0, noResolve: true };
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
    sun.castShadow = sh;
    scene.traverse((o) => {
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => (m.needsUpdate = true));
    });
    starGeo.setDrawRange(0, sh ? starCount : 300);
    islands.forEach((g, i) => (g.visible = sh || i < 3));
    [crystals, trees].forEach((m) => (m.count = sh ? m.userData.full : Math.floor(m.userData.full / 2)));
    opts.onQuality && opts.onQuality(q, qualityMode);
  }

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.fov = camera.aspect < 1 ? 72 : 60;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);

  // ---------------- update loop ----------------
  const tmp = new THREE.Vector3();
  const lookAt = new THREE.Vector3(START.x, 1.6, START.z);
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
      const run = keys.ShiftLeft || keys.ShiftRight || Math.hypot(joy.x, joy.y) > 0.92;
      speed = run ? RUN : WALK;
    } else if (target && !locked) {
      const dx = target.x - p.x;
      const dz = target.z - p.z;
      const d = Math.hypot(dx, dz);
      target.t += dt;
      if (d < 0.5 || target.t > 10) {
        target = null;
        marker.visible = false;
        if (pending) {
          const id = pending;
          pending = null;
          opts.onInteract && opts.onInteract(id);
        }
      } else {
        mx = dx / d;
        mz = dz / d;
        speed = CLICK_SPEED;
      }
    }
    moving = mx !== 0 || mz !== 0;
    if (moving) {
      p.x += mx * speed * dt;
      p.z += mz * speed * dt;
      const want = Math.atan2(mx, mz);
      let diff = want - p.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      p.heading += diff * Math.min(1, dt * 12);
    }
    // collisions
    colliders.forEach((c) => {
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
    if (rl > ISLAND_R - 1) {
      p.x *= (ISLAND_R - 1) / rl;
      p.z *= (ISLAND_R - 1) / rl;
    }
    // jump
    if (p.y > 0 || p.vy > 0) {
      p.vy -= GRAVITY * dt;
      p.y = Math.max(0, p.y + p.vy * dt);
      if (p.y === 0) p.vy = 0;
    }
    // robot pose
    phase += moving ? dt * speed * 1.7 : 0;
    const sw = moving ? Math.sin(phase) * 0.7 : 0;
    legL.rotation.x = sw;
    legR.rotation.x = -sw;
    armL.rotation.x = -sw * 0.8;
    armR.rotation.x = sw * 0.8;
    const bob = moving ? Math.abs(Math.sin(phase)) * 0.08 : Math.sin(clock * 2) * 0.03;
    robot.position.set(p.x, p.y + bob, p.z);
    robot.rotation.y = p.heading;
    if (target) {
      marker.visible = true;
      marker.position.set(target.x, 0.06, target.z);
      marker.scale.setScalar(1 + Math.sin(clock * 6) * 0.15);
    } else marker.visible = false;

    // nearest station
    let best = null;
    let bd = INTERACT_R;
    STATIONS.forEach((d) => {
      const sp = stationPos(d);
      const dist = Math.hypot(sp.x - p.x, sp.z - p.z);
      if (dist < bd) {
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
      g.userData.ring.material.opacity = on ? 0.55 + Math.sin(clock * 4) * 0.2 : 0.25;
    });

    anims.forEach((fn) => fn(clock));

    // camera
    const cp = Math.cos(cam.pitch);
    tmp.set(p.x + Math.sin(cam.yaw) * cp * cam.dist, p.y * 0.5 + 1.6 + Math.sin(cam.pitch) * cam.dist, p.z + Math.cos(cam.yaw) * cp * cam.dist);
    tmp.y = Math.max(tmp.y, 0.8);
    const k = 1 - Math.exp(-dt * 8);
    camera.position.lerp(tmp, k);
    lookAt.lerp(tmp.set(p.x, 1.6 + p.y * 0.5, p.z), k);
    camera.lookAt(lookAt);
    sky.position.copy(camera.position);
    stars.position.copy(camera.position);
    moon.position.set(camera.position.x - 170, 120, camera.position.z - 300);
  }

  function frame(now) {
    if (frozen) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    update(dt);
    renderer.render(scene, camera);
    // automatic quality drop when the frame rate is poor
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
    setLocked: (v) => {
      locked = !!v;
      if (locked) {
        target = null;
        pending = null;
      }
    },
    setFrozen: (v) => {
      api.userPaused = !!v;
      setFrozen(!!v);
    },
    setJoystick: (x, y) => {
      joy.x = x;
      joy.y = y;
    },
    jump,
    interact,
    travelTo,
    reset: () => {
      p.x = START.x;
      p.z = START.z;
      p.y = 0;
      p.vy = 0;
      p.heading = Math.PI;
      cam.yaw = 0;
      cam.pitch = 0.42;
      cam.dist = 9;
      target = null;
      pending = null;
    },
    setQuality: (mode) => {
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
      islandRadius: ISLAND_R,
      stations: STATIONS.map((d) => ({ id: d.id, css: d.css, ...stationPos(d) })),
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
