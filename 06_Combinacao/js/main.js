import { Game, GOAL_SCORE, START_MOVES } from "./game.js";
import { UI, wireControls } from "./ui.js";

const ui = new UI();
const game = new Game(ui);

// Populate title meta from constants
document.getElementById("title-goal").textContent = GOAL_SCORE.toLocaleString("pt-BR");
document.getElementById("title-moves").textContent = String(START_MOVES);
ui.updateTitle(game);

wireControls(game, ui);
ui.showScreen("title");
