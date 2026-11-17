import '@fontsource/fredoka/latin-400.css';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import '@fontsource/fredoka/latin-ext-400.css'; // macrons in Tūtū, koholā
import '@fontsource/fredoka/latin-ext-500.css';
import '@fontsource/fredoka/latin-ext-600.css';
import '@fontsource/fredoka/latin-ext-700.css';
import './style.css';
import { Game } from './game/game.js';
import { registerPWA } from './pwa.js';

async function boot() {
  // The signpost and atlas stamps draw text to canvases, so the face must be ready first.
  try {
    await Promise.race([
      Promise.all(['500 16px Fredoka', '600 30px Fredoka', '700 26px Fredoka'].map((f) => document.fonts.load(f, 'Tūtū waʻa'))),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch { /* fall back to the system rounded face */ }
  // Let the title paint before the world build blocks the main thread.
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  const game = new Game(document.getElementById('scene'), document.getElementById('ui'));
  if (import.meta.env.DEV) import('./dev/autopilot.js').then((m) => m.installAutopilot(game));
  game.begin();
}

registerPWA();
boot();
