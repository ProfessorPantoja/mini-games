/**
 * Catálogo do portal — fonte única de verdade.
 *
 * Como ativar / desativar um jogo no menu:
 *   1. Ache o item pelo id
 *   2. Mude `active: true`  → aparece no portal como JOGÁVEL
 *   3. Mude `active: false` → some do portal (pasta do jogo continua no disco)
 *
 * Ordem do array = ordem dos cards no menu.
 * `status`: "live" | "soon"  (soon = card cinza “EM BREVE”, sem link)
 * Jogos com active:false nem entram no HTML — não poluem o menu.
 */
window.GAMES_CATALOG = [
  {
    id: "neon-rally",
    active: true,
    status: "live",
    title: "NEON RALLY",
    path: "/15_Neon_Rally/",
    theme: "rally",
    desc: "Labirinto top-down estilo Rally-X — colete flags, solte óleo e faça o rival derrapar.",
    icon: "rally",
  },
  {
    id: "neon-serpent",
    active: true,
    status: "live",
    title: "NEON SERPENT",
    path: "/14_Neon_Serpent/",
    theme: "serpent",
    desc: "Snake com direção — fases, poderes e a Hidra no caminho. Simples e viciante.",
    icon: "serpent",
  },
  {
    id: "horda-infernal",
    active: true,
    status: "live",
    title: "HORDA INFERNAL",
    path: "/13_Horda_Infernal/",
    theme: "horda",
    desc: "ARPG de sessão — mate a horda, equipe loot e derrote o senhor do abismo.",
    icon: "horda",
  },
  {
    id: "neon-drive",
    active: true,
    status: "live",
    title: "NEON DRIVE",
    path: "/12_Neon_Drive/",
    theme: "drive",
    desc: "Corrida arcade neon — desvie do trânsito, near-miss, nitro e score infinito.",
    icon: "drive",
  },
  {
    id: "neon-strike",
    active: true,
    status: "live",
    title: "NEON STRIKE",
    path: "/03_Nave/",
    theme: "nave",
    desc: "Shoot 'em up arcade com ondas, power-ups, especial e bosses.",
    icon: "nave",
  },
  {
    id: "pocket-boss",
    active: false, // desativado: fraco no momento — reativar quando melhorar
    status: "live",
    title: "POCKET BOSS",
    path: "/04_Pocket_Boss/",
    theme: "boss",
    desc: "Chefe diário em ~3 min. Aprenda o pattern, sobreviva e compartilhe o resultado.",
    icon: "boss",
  },
  {
    id: "breakout",
    active: true,
    status: "live",
    title: "BREAKOUT",
    path: "/05_Breakout/",
    theme: "breakout",
    desc: "Clássico de rebote e blocos — física afiada, combos, power-ups e juice visual.",
    icon: "breakout",
  },
  {
    id: "combinacao",
    active: true,
    status: "live",
    title: "COMBINAÇÃO",
    path: "/06_Combinacao/",
    theme: "match",
    desc: "Match-3 de orbes coloridas — troque, combine em 3+, faça cascata e combos.",
    icon: "match",
  },
  {
    id: "estoura",
    active: true,
    status: "live",
    title: "ESTOURA",
    path: "/07_Estoura/",
    theme: "estoura",
    desc: "Bubble shooter clássico — mire, atire, estoure grupos e derrube clusters soltos.",
    icon: "estoura",
  },
  {
    id: "pendulo",
    active: true,
    status: "live",
    title: "PÊNDULO",
    path: "/08_Pendulo/",
    theme: "pendulo",
    desc: "Física de corda — balance, solte no ângulo certo e aterrise na plataforma dourada.",
    icon: "pendulo",
  },
  {
    id: "gelatina",
    active: true,
    status: "live",
    title: "GELATINA",
    path: "/09_Gelatina/",
    theme: "gelatina",
    desc: "Soft-body elástico — estique, solte, ricocheteie e leve o blob até o portal.",
    icon: "gelatina",
  },
  {
    id: "domino",
    active: false, // desativado: fraco no momento — reativar quando melhorar
    status: "live",
    title: "DOMINÓ",
    path: "/10_Domino/",
    theme: "domino",
    desc: "Monte uma cadeia de colisões, aperte play e derrube o troféu dourado.",
    icon: "domino",
  },
  {
    id: "gravidade",
    active: false, // desativado: fraco no momento — reativar quando melhorar
    status: "live",
    title: "GRAVIDADE",
    path: "/11_Gravidade/",
    theme: "gravidade",
    desc: "Pinte campos vetoriais e guie a partícula até o portal com a lei do universo.",
    icon: "gravidade",
  },
  {
    id: "survival",
    active: true,
    status: "soon",
    title: "Survival",
    path: null,
    theme: "soon",
    desc: "Ainda em desenvolvimento — entra no portal quando estiver aprovado.",
    icon: "soon",
  },
];

window.GAME_ICONS = {
  rally: `<svg viewBox="0 0 64 64" fill="none">
    <rect x="10" y="10" width="44" height="44" rx="4" stroke="#8b5cff" stroke-width="2.5" fill="none" opacity="0.7"/>
    <path d="M18 22 H30 V42 H18 Z" fill="none" stroke="#8b5cff" stroke-width="2"/>
    <path d="M34 22 H46 V30 H34 Z" fill="none" stroke="#8b5cff" stroke-width="2"/>
    <path d="M34 34 H46 V42 H34 Z" fill="none" stroke="#8b5cff" stroke-width="2"/>
    <rect x="26" y="28" width="14" height="10" rx="3" fill="#00f0ff" transform="rotate(-20 33 33)"/>
    <circle cx="48" cy="48" r="5" fill="#ffc857" opacity="0.9"/>
    <path d="M14 48 Q20 44 28 50" stroke="#ff2bd6" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.85"/>
  </svg>`,
  serpent: `<svg viewBox="0 0 64 64" fill="none">
    <circle cx="14" cy="34" r="7" fill="#00f0ff"/>
    <circle cx="28" cy="34" r="7" fill="#4d9fff"/>
    <circle cx="42" cy="34" r="7" fill="#8b5cff"/>
    <circle cx="50" cy="22" r="7" fill="#ff2bd6"/>
    <circle cx="52" cy="20" r="2" fill="#eef6ff"/>
    <circle cx="18" cy="18" r="5" fill="#00f0ff" opacity="0.9"/>
  </svg>`,
  horda: `<svg viewBox="0 0 64 64" fill="none">
    <circle cx="32" cy="34" r="18" fill="#1a080c"/>
    <path d="M22 40 L32 14 L42 40 Z" fill="#ff5a1f"/>
    <circle cx="32" cy="36" r="5" fill="#c41e3a"/>
    <path d="M18 22 L14 12 M46 22 L50 12" stroke="#f0c14b" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M24 48 Q32 54 40 48" stroke="#ff5a1f" stroke-width="2" fill="none" stroke-linecap="round"/>
  </svg>`,
  drive: `<svg viewBox="0 0 64 64" fill="none">
    <rect x="24" y="10" width="16" height="40" rx="4" fill="#00f0ff"/>
    <rect x="26" y="18" width="12" height="10" rx="2" fill="#041018"/>
    <rect x="18" y="40" width="8" height="14" rx="2" fill="#ff2bd6"/>
    <rect x="38" y="40" width="8" height="14" rx="2" fill="#ff2bd6"/>
    <rect x="28" y="48" width="3" height="4" fill="#ffc857"/>
    <rect x="33" y="48" width="3" height="4" fill="#ffc857"/>
    <path d="M20 8 L24 14 M44 8 L40 14" stroke="#ffc857" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
  nave: `<svg viewBox="0 0 64 64" fill="none">
    <path d="M32 8 L44 48 L32 40 L20 48 Z" fill="#00f0ff" opacity="0.95"/>
    <path d="M32 40 L38 52 L32 48 L26 52 Z" fill="#4d7cff"/>
    <circle cx="32" cy="28" r="3" fill="#eef6ff"/>
    <path d="M18 36 L10 40 L18 42" stroke="#ff2bd6" stroke-width="2" stroke-linecap="round"/>
    <path d="M46 36 L54 40 L46 42" stroke="#ff2bd6" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
  boss: `<svg viewBox="0 0 64 64" fill="none">
    <circle cx="32" cy="30" r="16" fill="#ff5d7a"/>
    <circle cx="26" cy="28" r="3" fill="#1a0a10"/>
    <circle cx="38" cy="28" r="3" fill="#1a0a10"/>
    <path d="M24 38 Q32 44 40 38" stroke="#1a0a10" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M20 18 L16 10 M44 18 L48 10 M32 12 L32 6" stroke="#ff9f43" stroke-width="2.5" stroke-linecap="round"/>
    <rect x="22" y="46" width="20" height="8" rx="3" fill="#ff9f43"/>
  </svg>`,
  breakout: `<svg viewBox="0 0 64 64" fill="none">
    <rect x="10" y="12" width="14" height="10" rx="2" fill="#56d6ff"/>
    <rect x="26" y="12" width="14" height="10" rx="2" fill="#8b7cff"/>
    <rect x="42" y="12" width="12" height="10" rx="2" fill="#ff6bcb"/>
    <rect x="14" y="24" width="14" height="10" rx="2" fill="#8b7cff"/>
    <rect x="30" y="24" width="14" height="10" rx="2" fill="#56d6ff"/>
    <circle cx="34" cy="42" r="5" fill="#eef6ff"/>
    <rect x="18" y="52" width="28" height="5" rx="2.5" fill="#56d6ff"/>
  </svg>`,
  match: `<svg viewBox="0 0 64 64" fill="none">
    <circle cx="20" cy="20" r="9" fill="#ff6bcb"/>
    <circle cx="44" cy="20" r="9" fill="#56d6ff"/>
    <circle cx="20" cy="44" r="9" fill="#ffc857"/>
    <circle cx="44" cy="44" r="9" fill="#ff6bcb"/>
    <circle cx="20" cy="20" r="3" fill="rgba(255,255,255,0.5)"/>
    <circle cx="44" cy="20" r="3" fill="rgba(255,255,255,0.5)"/>
    <circle cx="20" cy="44" r="3" fill="rgba(255,255,255,0.5)"/>
    <circle cx="44" cy="44" r="3" fill="rgba(255,255,255,0.5)"/>
  </svg>`,
  estoura: `<svg viewBox="0 0 64 64" fill="none">
    <circle cx="22" cy="18" r="8" fill="#7dffb3"/>
    <circle cx="40" cy="16" r="7" fill="#56d6ff"/>
    <circle cx="50" cy="30" r="7" fill="#ff6bcb"/>
    <circle cx="18" cy="34" r="7" fill="#ffc857"/>
    <circle cx="34" cy="32" r="8" fill="#8b7cff"/>
    <path d="M32 48 L36 56 L32 54 L28 56 Z" fill="#eef6ff"/>
    <line x1="32" y1="48" x2="40" y2="38" stroke="#eef6ff" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
  pendulo: `<svg viewBox="0 0 64 64" fill="none">
    <circle cx="32" cy="12" r="5" fill="#ffc857"/>
    <line x1="32" y1="17" x2="44" y2="42" stroke="#56d6ff" stroke-width="3" stroke-linecap="round"/>
    <circle cx="44" cy="48" r="10" fill="#ff6bcb"/>
    <circle cx="41" cy="45" r="3" fill="rgba(255,255,255,0.45)"/>
    <path d="M14 52 Q28 44 40 50" stroke="rgba(255,200,87,0.5)" stroke-width="2" stroke-dasharray="3 3" fill="none"/>
  </svg>`,
  gelatina: `<svg viewBox="0 0 64 64" fill="none">
    <ellipse cx="32" cy="34" rx="20" ry="16" fill="#7dffb3"/>
    <ellipse cx="32" cy="34" rx="14" ry="11" fill="rgba(255,255,255,0.18)"/>
    <circle cx="25" cy="32" r="3.2" fill="#0a0614"/>
    <circle cx="39" cy="32" r="3.2" fill="#0a0614"/>
    <circle cx="26" cy="31" r="1" fill="#fff"/>
    <circle cx="40" cy="31" r="1" fill="#fff"/>
    <path d="M26 40 Q32 45 38 40" stroke="#0a0614" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M12 28 Q8 20 14 18" stroke="#9b7cff" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    <path d="M52 28 Q56 20 50 18" stroke="#9b7cff" stroke-width="2.5" stroke-linecap="round" fill="none"/>
  </svg>`,
  domino: `<svg viewBox="0 0 64 64" fill="none">
    <g transform="rotate(-18 24 34)">
      <rect x="16" y="14" width="14" height="40" rx="3" fill="#ffc857"/>
      <circle cx="23" cy="24" r="2" fill="#1a1400"/>
      <circle cx="23" cy="40" r="2" fill="#1a1400"/>
    </g>
    <g transform="rotate(12 40 34)">
      <rect x="34" y="14" width="14" height="40" rx="3" fill="#56d6ff"/>
      <circle cx="41" cy="24" r="2" fill="#041018"/>
      <circle cx="41" cy="40" r="2" fill="#041018"/>
    </g>
    <circle cx="52" cy="48" r="5" fill="#ff6bcb"/>
  </svg>`,
  gravidade: `<svg viewBox="0 0 64 64" fill="none">
    <circle cx="32" cy="32" r="22" stroke="#8b7cff" stroke-width="2.5" fill="none" opacity="0.7"/>
    <circle cx="32" cy="32" r="14" stroke="#56d6ff" stroke-width="2" fill="none" opacity="0.5"/>
    <circle cx="32" cy="32" r="5" fill="#56d6ff"/>
    <path d="M32 8 L35 16 L32 14 L29 16 Z" fill="#ffc857"/>
    <path d="M56 32 L48 35 L50 32 L48 29 Z" fill="#ff6bcb"/>
    <path d="M32 56 L29 48 L32 50 L35 48 Z" fill="#7dffb3"/>
    <path d="M8 32 L16 29 L14 32 L16 35 Z" fill="#8b7cff"/>
  </svg>`,
  soon: `<svg viewBox="0 0 64 64" fill="none">
    <rect x="12" y="18" width="40" height="28" rx="6" stroke="#8a96b8" stroke-width="2.5" fill="none"/>
    <path d="M24 30 H40 M24 38 H34" stroke="#8a96b8" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="48" cy="16" r="6" fill="#5a6480"/>
  </svg>`,
};
