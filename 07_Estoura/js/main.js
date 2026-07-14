/**
 * Estoura — entry point
 */

import { Game } from './game.js';

function main() {
  const canvas = document.getElementById('game');
  if (!canvas) {
    console.error('Canvas #game not found');
    return;
  }

  const game = new Game(canvas, {});

  // Score resets on new run / retry / pause-restart (capture phase, before Game handlers)
  const resetScore = () => {
    game.score = 0;
  };
  document.getElementById('btn-start')?.addEventListener('click', resetScore, true);
  document.getElementById('btn-retry')?.addEventListener('click', resetScore, true);
  document.getElementById('btn-restart-pause')?.addEventListener('click', resetScore, true);

  game.init();

  // Debug handle (optional)
  window.__estoura = game;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
