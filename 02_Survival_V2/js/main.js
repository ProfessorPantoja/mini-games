import { Game } from "./game.js";

const canvas = document.getElementById("game");
const game = new Game(canvas);

let last = performance.now();

function frame(now) {
  const raw = (now - last) / 1000;
  last = now;
  // cap de dt evita teleporte se a aba ficar em background
  const dt = Math.min(raw, 0.05);
  game.update(dt);
  game.draw();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
