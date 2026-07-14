/**
 * Compartilhamento estilo Wordle.
 */

export function buildShareText(result) {
  const hearts = formatHearts(result.livesLeft ?? result.lives, 3);
  const status = result.won ? "VITÓRIA" : "DERROTA";
  const time = formatTime(result.timeMs);
  const score = (result.score || 0).toLocaleString("pt-BR");

  const lines = [
    `Pocket Boss ${result.dayKey}`,
    `${status} ${hearts}`,
    `⚔️ ${result.bossName}`,
    `⚡ ${score} pts · ⏱ ${time}`,
    result.perfects
      ? `✨ ${result.perfects} perfect · 🔥 combo ${result.comboMax}`
      : `🔥 combo máx ${result.comboMax}`,
    "",
    "Um chefe por dia.",
  ];
  return lines.join("\n");
}

function formatHearts(left, max) {
  const l = Math.max(0, Math.min(max, left ?? 0));
  return "❤️".repeat(l) + "🖤".repeat(max - l);
}

function formatTime(ms) {
  const t = Math.max(0, Math.floor((ms || 0) / 1000));
  const m = Math.floor(t / 60);
  const s = String(t % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export async function shareResult(text) {
  if (navigator.share) {
    try {
      await navigator.share({ text, title: "Pocket Boss" });
      return { ok: true, method: "share" };
    } catch (e) {
      if (e && e.name === "AbortError") return { ok: false, method: "share", aborted: true };
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return { ok: true, method: "clipboard" };
  } catch {
    return { ok: false, method: "none", text };
  }
}
