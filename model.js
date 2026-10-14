// =====================================================================
//  model.js — a 3D model of Shubham's real ESP32 line-follower, built to
//  match his photos: perfboard chassis, two pink Li-ion cells in a black
//  holder, ESP32 dev board, rainbow ribbon + jumper wires, two chunky rear
//  wheels, three blue IR sensor modules on black tape at the front, and an
//  HC-SR04 ultrasonic sensor on a blue SG90 servo.
//  It is a hand-built look-alike (not a scan), so small details differ.
//  Used in the world (next to the Projects portal) and as a rotatable
//  viewer in the Projects panel, where it drives around a full circle track.
// =====================================================================
import * as THREE from 'three';

export function buildLineFollower() {
  const g = new THREE.Group();
  const std = (c, m = 0.3, r = 0.6) => new THREE.MeshStandardMaterial({ color: c, metalness: m, roughness: r });
  const box = (w, h, d, mat, x, y, z, parent = g) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  const cyl = (rt, rb, h, mat, x, y, z, rot, parent = g) => {
    const geo = new THREE.CylinderGeometry(rt, rb, h, 20);
    if (rot === 'x') geo.rotateX(Math.PI / 2); // axis along z
    if (rot === 'z') geo.rotateZ(Math.PI / 2); // axis along x
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  const glow = (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
  const blue = std(0x1f5fd0, 0.2, 0.55);
  const black = std(0x101114, 0.2, 0.7);
  const tapeMat = std(0x16171a, 0.1, 0.45);
  const silver = std(0xc9d1d9, 0.9, 0.3);

  // perfboard chassis (tan, with a grid of holes suggested by a dark pattern)
  box(7, 0.25, 12, std(0xc9a56a, 0.1, 0.7), 0, 1.3, 0);
  for (let i = 0; i < 9; i++) box(6.4, 0.02, 0.05, std(0x8a6b3a, 0, 0.9), 0, 1.44, -5 + i * 1.2);

  // battery holder (black) with two pink/purple cells running front-to-back
  box(3.9, 0.9, 6.6, black, 0, 1.95, -3.2);
  [-0.95, 0.95].forEach((x) => {
    cyl(0.9, 0.9, 6.2, std(0xc04fd0, 0.25, 0.4), x, 2.85, -3.2, 'x');
    cyl(0.9, 0.9, 0.5, std(0x7a2a8a, 0.3, 0.5), x, 2.85, -6.4, 'x'); // wrapper end
  });

  // ESP32 dev board with metal shield, antenna and pin headers
  box(3.2, 0.18, 5.4, black, 0, 1.65, 1.6);
  box(2.0, 0.28, 2.3, silver, 0, 1.85, 2.0);
  box(2.2, 0.05, 1.1, std(0x1b4a8a, 0.2, 0.6), 0, 1.76, 4.0);
  [-1.5, 1.5].forEach((x) => box(0.25, 0.35, 5.0, black, x, 1.85, 1.6));

  // 'rainbow' ribbon cable from ESP32 toward the front sensors
  [0xef4444, 0xf59e0b, 0xfacc15, 0x22c55e, 0x3b82f6, 0x8b5cf6, 0x92400e].forEach((c, i) => box(0.12, 0.1, 3.4, std(c, 0, 0.7), 0.7 + i * 0.13, 2.1, 5.0));

  // loose jumper wires (curved tubes)
  const wire = (pts, color) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.07, 6, false), new THREE.MeshStandardMaterial({ color, roughness: 0.6 })));
  };
  wire([[-2.6, 1.6, -1], [-3.4, 3.2, 1], [-1.5, 3.8, 3.5], [0.6, 2.6, 5.2]], 0xef4444);
  wire([[2.6, 1.6, -0.5], [3.6, 3.4, 2], [1.8, 4.2, 4], [0.2, 3.2, 5.6]], 0xf97316);
  wire([[-2.2, 1.6, 2.5], [-3.8, 2.8, 4], [-3.2, 1.8, 6.2]], 0x111111);
  wire([[2.0, 1.6, 3], [3.9, 2.6, 4.4], [3.4, 1.8, 6.2]], 0x7c3aed);
  wire([[0, 2.2, -6], [2.5, 4.6, -3], [3.0, 5.0, 0], [0.5, 4.0, 4.5]], 0x6b4a3a);
  wire([[-1.5, 2.0, 0], [-2.6, 4.2, 1.5], [-0.8, 4.4, 4.2]], 0xe5e7eb);

  // big black rubber wheels at the rear sides (+ N20 motors inside)
  const wheels = [];
  [-1, 1].forEach((s) => {
    cyl(0.62, 0.62, 3, silver, s * 2.9, 1.0, -1.8, 'z');
    const wheel = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 1.2, 28).rotateZ(Math.PI / 2), std(0x0b0b0c, 0.05, 0.95));
    tire.castShadow = true;
    wheel.add(tire);
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      const lug = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.18, 0.5), std(0x1a1a1c, 0, 0.9));
      lug.position.set(0, Math.cos(a) * 1.85, Math.sin(a) * 1.85);
      lug.rotation.x = -a;
      wheel.add(lug);
    }
    wheel.add(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.3, 16).rotateZ(Math.PI / 2), std(0x2b2d33, 0.5, 0.5)));
    wheel.position.set(s * 4.5, 1.8, -1.8);
    g.add(wheel);
    wheels.push(wheel);
  });

  // black tape wrap at the front of the board, with three blue IR modules
  box(7.4, 0.3, 2.2, tapeMat, 0, 1.0, 5.6);
  box(2.2, 0.3, 3.6, tapeMat, -3.2, 1.05, 5.9);
  box(2.2, 0.3, 3.6, tapeMat, 3.2, 1.05, 5.9);
  const emitters = [];
  const ir = (x, z, rotY) => {
    const m = new THREE.Group();
    box(1.9, 0.14, 1.3, blue, 0, 0, 0, m); // blue module board
    box(0.35, 0.3, 0.25, black, 0.4, 0.2, -0.3, m); // comparator chip
    box(0.5, 0.25, 0.3, std(0x2563eb, 0.6, 0.3), -0.45, 0.2, -0.3, m); // trimmer pot
    // IR LED (clear) + photodiode (dark) hanging below the board edge
    const led = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.55, 10), glow(0xffd9d9));
    led.position.set(-0.4, -0.3, 0.55);
    m.add(led);
    emitters.push(led);
    cyl(0.17, 0.17, 0.55, black, 0.4, -0.3, 0.55, null, m);
    m.position.set(x, 0.95, z);
    m.rotation.y = rotY;
    g.add(m);
  };
  ir(-3.7, 7.1, 0.35);
  ir(3.7, 7.1, -0.35);
  ir(0, 7.8, 0);

  // SG90 servo (blue) carrying an HC-SR04 ultrasonic sensor
  box(2.3, 1.7, 1.2, std(0x1d4ed8, 0.2, 0.5), 0, 2.15, 5.5);
  box(2.9, 0.12, 0.9, std(0x1d4ed8, 0.2, 0.5), 0, 2.4, 5.5);
  box(0.5, 0.4, 0.35, std(0xf1e0b8, 0, 0.6), 0, 3.05, 5.9); // servo horn
  box(0.45, 1.3, 0.3, std(0xe9d8ad, 0, 0.5), 0, 3.5, 6.5);
  const us = new THREE.Group();
  box(5.0, 2.3, 0.2, std(0x1651b8, 0.2, 0.55), 0, 0, 0, us);
  [-1.3, 1.3].forEach((x) => {
    cyl(0.9, 0.9, 0.9, silver, x, 0, 0.5, 'x', us);
    cyl(0.62, 0.62, 0.05, std(0x2a2d33, 0.4, 0.6), x, 0, 0.97, 'x', us);
  });
  box(0.9, 0.14, 0.14, silver, 0, -0.9, 0.1, us);
  us.position.set(0, 4.3, 6.2);
  g.add(us);
  box(0.9, 0.5, 0.3, std(0xf5f5f5, 0, 0.6), 0, 5.7, 5.8); // 4-pin white connector

  // small front skid so the nose does not dip
  const skid = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), silver);
  skid.position.set(0, 0.4, 3.6);
  g.add(skid);

  g.userData = { wheels, emitters };
  return g;
}

// Full circular track: a white board with a thick black ring.
function floorTexture(trackR, boardR) {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = '#eef1f6';
  g.fillRect(0, 0, 1024, 1024);
  g.strokeStyle = '#0b0b0d';
  g.lineWidth = 56;
  g.beginPath();
  g.arc(512, 512, (trackR / boardR) * 512, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = '#c3cad6';
  g.lineWidth = 8;
  g.strokeRect(6, 6, 1012, 1012);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Rotatable viewer for a <canvas>. The robot drives round the full circle.
export function createModelViewer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 300);
  scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x20304a, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(16, 34, 18);
  key.castShadow = true;
  key.shadow.camera.left = key.shadow.camera.bottom = -30;
  key.shadow.camera.right = key.shadow.camera.top = 30;
  scene.add(key);

  const TRACK_R = 14;
  const BOARD_R = 24;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_R * 2, BOARD_R * 2), new THREE.MeshStandardMaterial({ map: floorTexture(TRACK_R, BOARD_R), roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const bot = buildLineFollower();
  const rig = new THREE.Group(); // moves round the circle
  rig.add(bot);
  scene.add(rig);
  const orbit = { yaw: 0.6, pitch: 0.95, dist: 62, auto: true };
  let drag = null;
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', (e) => {
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    orbit.auto = false;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    orbit.yaw -= (e.clientX - drag.x) * 0.01;
    orbit.pitch = Math.min(1.5, Math.max(0.15, orbit.pitch + (e.clientY - drag.y) * 0.008));
    drag.x = e.clientX;
    drag.y = e.clientY;
  });
  const end = () => {
    drag = null;
    setTimeout(() => !drag && (orbit.auto = true), 2500);
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener(
    'wheel',
    (e) => {
      orbit.dist = Math.min(90, Math.max(20, orbit.dist + e.deltaY * 0.04));
      e.preventDefault();
    },
    { passive: false }
  );

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf = 0;
  let last = performance.now();
  let t = 0;
  let ang = 0;
  const SPEED = 9; // units per second along the line
  function resize() {
    const w = canvas.clientWidth || 300;
    const h = canvas.clientHeight || 240;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize);
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    if (orbit.auto && !reduce) orbit.yaw += dt * 0.12;
    if (!reduce) {
      ang += (SPEED / TRACK_R) * dt; // counter-clockwise seen from above
      bot.userData.wheels.forEach((w) => (w.rotation.x += (SPEED / 1.8) * dt));
    }
    // sit on the circle, nose pointing along the line. The rear axle sits
    // about 1.8 behind the model origin, so shift to keep wheels on the line.
    rig.position.set(Math.cos(ang) * TRACK_R, 0, -Math.sin(ang) * TRACK_R);
    rig.rotation.y = ang + Math.PI; // tangent heading (+z forward)
    bot.position.set(0, Math.sin(t * 9) * 0.02, -3);
    bot.userData.emitters.forEach((l, i) => l.material.color.setHex(Math.sin(t * 5 + i * 2) > 0 ? 0xffe0e0 : 0xff4b4b));
    const cp = Math.cos(orbit.pitch);
    camera.position.set(Math.sin(orbit.yaw) * cp * orbit.dist, Math.sin(orbit.pitch) * orbit.dist, Math.cos(orbit.yaw) * cp * orbit.dist);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);
  return {
    dispose() {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
      renderer.dispose();
      renderer.forceContextLoss && renderer.forceContextLoss();
    },
  };
}
