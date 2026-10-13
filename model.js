// =====================================================================
//  model.js — a simplified 3D illustration of the ESP32 line-follower
//  (ESP32 DevKit, TB6612FNG driver, N20 motors, 8-channel IR array,
//  2S Li-ion pack). Used twice: a small display next to the Projects
//  portal in the world, and a rotatable viewer in the Projects panel.
// =====================================================================
import * as THREE from 'three';

export function buildLineFollower() {
  const g = new THREE.Group();
  const std = (c, m = 0.4, r = 0.5) => new THREE.MeshStandardMaterial({ color: c, metalness: m, roughness: r });
  const box = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  const glow = (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });

  // chassis PCB
  box(7, 0.25, 11, std(0x0f4d36, 0.2, 0.6), 0, 1.3, 0);
  // ESP32 DevKit (rear) with metal shield and antenna keep-out
  box(2.9, 0.18, 5.4, std(0x151a24, 0.3, 0.5), 0, 1.6, -2.4);
  box(1.9, 0.3, 2.4, std(0xc9d1d9, 0.9, 0.3), 0, 1.8, -1.6);
  box(2.1, 0.06, 1.2, std(0x1b4a8a, 0.2, 0.6), 0, 1.72, -4.5);
  // TB6612FNG motor driver (mid)
  box(2.3, 0.2, 2.6, std(0xb91c1c, 0.2, 0.6), 0, 1.6, 1.3);
  box(0.9, 0.18, 0.9, std(0x0b0b0b, 0.2, 0.7), 0, 1.78, 1.3);
  // 2S Li-ion: two cells side by side on top
  [-0.95, 0.95].forEach((x) => {
    const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 6.6, 20).rotateX(Math.PI / 2), std(0x2563eb, 0.3, 0.45));
    cell.position.set(x, 2.55, -0.4);
    cell.castShadow = true;
    g.add(cell);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.15, 12).rotateX(Math.PI / 2), std(0xd1d5db, 0.9, 0.3));
    cap.position.set(x, 2.55, 2.95);
    g.add(cap);
  });
  // N20 motors + wheels
  const wheels = [];
  [-1, 1].forEach((s) => {
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 3, 14).rotateZ(Math.PI / 2), std(0xb8c0cc, 0.9, 0.3));
    motor.position.set(s * 2.9, 1.05, 0.4);
    g.add(motor);
    box(1.2, 1.1, 1.7, std(0xcaa84a, 0.7, 0.4), s * 4.2, 1.05, 0.4);
    const wheel = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 0.95, 28).rotateZ(Math.PI / 2), std(0x111114, 0.1, 0.9));
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1, 16).rotateZ(Math.PI / 2), std(0xd1d5db, 0.9, 0.3));
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.25, 1.5), std(0x555b66, 0.8, 0.4));
    wheel.add(tire, hub, spoke);
    wheel.position.set(s * 5.1, 1.75, 0.4);
    tire.castShadow = true;
    g.add(wheel);
    wheels.push(wheel);
  });
  // front IR sensor array (8 channels)
  box(8.6, 0.16, 1.9, std(0x0f4d36, 0.2, 0.6), 0, 0.95, 6.4);
  box(0.25, 0.2, 2.2, std(0x0f4d36, 0.2, 0.6), -2.5, 1.1, 5.5);
  box(0.25, 0.2, 2.2, std(0x0f4d36, 0.2, 0.6), 2.5, 1.1, 5.5);
  const emitters = [];
  for (let i = 0; i < 8; i++) {
    const x = -3.5 + i;
    box(0.5, 0.35, 0.5, std(0x101010, 0.2, 0.6), x, 0.7, 6.55);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), glow(0xff3b3b));
    led.position.set(x, 0.5, 6.1);
    g.add(led);
    emitters.push(led);
  }
  // rear caster ball
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 12), std(0xd1d5db, 0.9, 0.2));
  ball.position.set(0, 0.6, -5);
  g.add(ball);
  box(0.5, 0.7, 0.5, std(0x333a47, 0.5, 0.5), 0, 1.0, -5);
  // a few wires
  const wireMat = [0xef4444, 0xfacc15, 0x22c55e, 0x3b82f6].map((c) => new THREE.MeshBasicMaterial({ color: c }));
  wireMat.forEach((m, i) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.2, 6).rotateX(Math.PI / 2), m);
    w.position.set(-1.1 + i * 0.7, 1.55, 4.1);
    g.add(w);
  });
  g.userData = { wheels, emitters };
  return g;
}

function floorTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#f2f4f8';
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = '#111';
  g.lineWidth = 46;
  g.lineCap = 'round';
  g.beginPath();
  for (let y = 0; y <= 512; y += 8) {
    const x = 256 + Math.sin((y / 512) * Math.PI * 2) * 60;
    y === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
  }
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Rotatable viewer for a <canvas>. Returns { dispose }.
export function createModelViewer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x20304a, 1.3));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(8, 14, 10);
  key.castShadow = true;
  scene.add(key);

  const tex = floorTexture();
  tex.repeat.set(1, 1);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(16, 48), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const bot = buildLineFollower();
  scene.add(bot);
  const orbit = { yaw: 0.7, pitch: 0.5, dist: 26, auto: true };
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
    orbit.pitch = Math.min(1.4, Math.max(0.1, orbit.pitch + (e.clientY - drag.y) * 0.008));
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
      orbit.dist = Math.min(40, Math.max(14, orbit.dist + e.deltaY * 0.02));
      e.preventDefault();
    },
    { passive: false }
  );

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf = 0;
  let last = performance.now();
  let t = 0;
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
    if (orbit.auto && !reduce) orbit.yaw += dt * 0.35;
    if (!reduce) {
      bot.userData.wheels.forEach((w) => (w.rotation.x += dt * 6));
      tex.offset.y += dt * 0.25; // the floor slides back: the robot "follows" the line
      bot.position.y = Math.sin(t * 8) * 0.03;
    }
    bot.userData.emitters.forEach((l, i) => (l.material.color.setHex(Math.sin(t * 4 + i) > 0.2 ? 0xff3b3b : 0x992222)));
    const cp = Math.cos(orbit.pitch);
    camera.position.set(Math.sin(orbit.yaw) * cp * orbit.dist, Math.sin(orbit.pitch) * orbit.dist, Math.cos(orbit.yaw) * cp * orbit.dist);
    camera.lookAt(0, 1.5, 1);
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
