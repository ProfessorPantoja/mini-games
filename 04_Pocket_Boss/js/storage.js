/**
 * Persistência local — melhor run por dia + histórico.
 */

const KEY = "pocket-boss:v1";

const defaultState = () => ({
  version: 1,
  runs: {}, // dayKey -> { score, won, livesLeft, perfects, comboMax, timeMs, bossName, at }
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return defaultState();
    return { ...defaultState(), ...data, runs: data.runs || {} };
  } catch {
    return defaultState();
  }
}

function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota / private mode */
  }
}

export function getDayRun(dayKey) {
  return load().runs[dayKey] || null;
}

/**
 * Salva se for a melhor pontuação do dia (ou primeira).
 * Retorna { saved, best, isNewBest }
 */
export function saveRun(dayKey, run) {
  const state = load();
  const prev = state.runs[dayKey];
  const isNewBest = !prev || run.score > prev.score;
  if (isNewBest) {
    state.runs[dayKey] = {
      score: run.score,
      won: !!run.won,
      livesLeft: run.livesLeft,
      perfects: run.perfects,
      comboMax: run.comboMax,
      timeMs: run.timeMs,
      bossName: run.bossName,
      at: Date.now(),
    };
    save(state);
  }
  return {
    saved: isNewBest,
    best: state.runs[dayKey],
    isNewBest,
  };
}

export function getRanking(limit = 30) {
  const state = load();
  return Object.entries(state.runs)
    .map(([dayKey, run]) => ({ dayKey, ...run }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.at - a.at;
    })
    .slice(0, limit);
}

export function getHistory(limit = 14) {
  const state = load();
  return Object.entries(state.runs)
    .map(([dayKey, run]) => ({ dayKey, ...run }))
    .sort((a, b) => (a.dayKey < b.dayKey ? 1 : -1))
    .slice(0, limit);
}
