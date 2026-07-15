/**
 * Ranking local de speedrun — localStorage (como Neon Strike).
 * Ordenação: vitória completa primeiro → menor tempo → mais kills.
 */

export const RANK_KEY = "horda_infernal_rank_v1";
export const PREF_KEY = "horda_infernal_player_pref";
export const RANK_MAX = 15;

export const FLAGS = [
  { code: "BR", emoji: "🇧🇷", name: "Brasil" },
  { code: "PT", emoji: "🇵🇹", name: "Portugal" },
  { code: "US", emoji: "🇺🇸", name: "EUA" },
  { code: "AR", emoji: "🇦🇷", name: "Argentina" },
  { code: "MX", emoji: "🇲🇽", name: "México" },
  { code: "ES", emoji: "🇪🇸", name: "Espanha" },
  { code: "JP", emoji: "🇯🇵", name: "Japão" },
  { code: "DE", emoji: "🇩🇪", name: "Alemanha" },
  { code: "FR", emoji: "🇫🇷", name: "França" },
  { code: "IT", emoji: "🇮🇹", name: "Itália" },
  { code: "GB", emoji: "🇬🇧", name: "Reino Unido" },
  { code: "CA", emoji: "🇨🇦", name: "Canadá" },
  { code: "CL", emoji: "🇨🇱", name: "Chile" },
  { code: "CO", emoji: "🇨🇴", name: "Colômbia" },
  { code: "UY", emoji: "🇺🇾", name: "Uruguai" },
  { code: "XX", emoji: "🏳️", name: "Outro" },
];

export function flagMeta(code) {
  return FLAGS.find((f) => f.code === code) || FLAGS[0];
}

export function loadPlayerPref() {
  try {
    const p = JSON.parse(localStorage.getItem(PREF_KEY) || "{}") || {};
    return {
      name: String(p.name || "").slice(0, 14),
      flag: FLAGS.some((f) => f.code === p.flag) ? p.flag : "BR",
    };
  } catch {
    return { name: "", flag: "BR" };
  }
}

export function savePlayerPref(name, flag) {
  try {
    localStorage.setItem(
      PREF_KEY,
      JSON.stringify({
        name: String(name || "").slice(0, 14),
        flag: FLAGS.some((f) => f.code === flag) ? flag : "BR",
      }),
    );
  } catch { /* ignore */ }
}

export function loadRanking() {
  try {
    const list = JSON.parse(localStorage.getItem(RANK_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveRanking(list) {
  try {
    localStorage.setItem(RANK_KEY, JSON.stringify(list.slice(0, RANK_MAX)));
  } catch { /* ignore */ }
}

/**
 * @param {object} recap — de game.getRunRecap()
 * @param {boolean} victory
 * @param {string} name
 * @param {string} flag
 */
export function buildEntry(recap, victory, name, flag) {
  const cleanName = String(name || "HERÓI").trim().slice(0, 14) || "HERÓI";
  const flagCode = FLAGS.some((f) => f.code === flag) ? flag : "BR";
  return {
    name: cleanName,
    flag: flagCode,
    time: recap.time | 0,
    kills: recap.kills | 0,
    level: recap.level | 0,
    className: recap.className || "—",
    maxCombo: recap.maxCombo | 0,
    damage: recap.damage | 0,
    completed: !!victory,
    stage: recap.stage || "—",
    date: new Date().toISOString(),
  };
}

function compareEntries(a, b) {
  // completou primeiro
  if (!!b.completed !== !!a.completed) return b.completed ? 1 : -1;
  // menor tempo vence (só entre vitórias; DNF usa tempo também mas fica abaixo)
  if (a.time !== b.time) return a.time - b.time;
  // mais kills
  if (b.kills !== a.kills) return b.kills - a.kills;
  return b.level - a.level;
}

export function addToRanking(entry) {
  const list = loadRanking();
  list.push(entry);
  list.sort(compareEntries);
  const next = list.slice(0, RANK_MAX);
  saveRanking(next);
  const pos = next.findIndex(
    (e) => e.date === entry.date && e.name === entry.name && e.time === entry.time,
  );
  return { list: next, position: pos >= 0 ? pos + 1 : -1 };
}

export function formatTime(secs) {
  const s = Math.max(0, secs | 0);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
