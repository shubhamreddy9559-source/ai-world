// main.js — entry point. Loads the 3D world defensively so the menu and
// panels keep working if WebGL or the Three.js CDN is unavailable.
import { initUI } from './ui.js';

const ui = initUI();
const canvas = document.getElementById('world');

(async () => {
  try {
    const { createWorld } = await import('./world.js');
    const world = createWorld(canvas, {
      onNearby: (id) => ui.setNearby(id),
      onInteract: (id) => ui.openStation(id),
      onQuality: (q) => ui.setQualityLabel(q),
      onError: (m) => ui.showFallback(m),
      onReady: () => ui.hideLoading(),
      onDogTap: () => ui.openChat(),
    });
    ui.attachWorld(world);
  } catch (err) {
    console.error(err);
    ui.showFallback('The 3D view could not start (' + ((err && err.message) || err) + '). Use the menu to browse the portfolio.');
  }
})();
