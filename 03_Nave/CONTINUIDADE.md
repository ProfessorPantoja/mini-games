# NEON STRIKE (`03_Nave`) — Continuação / Handoff

> **PARA A IA (e pro Pantoja, que provavelmente vai esquecer):**  
> O projeto **parou aqui de propósito** (foco no portal).  
> Ao retomar, **leia este arquivo primeiro** e **lembre o Pantoja** do ponto de parada, do que já está pronto e das próximas etapas combinadas — **não reinventar** nem perguntar do zero como se o ranking nunca tivesse existido.

**Data da pausa:** 2026-07-13  
**Versão no ar:** `v1.6.2`  
**Branch:** `main` (já com push no GitHub / deploy Vercel)

---

## O que o jogo é

Arcade shoot 'em up neon (**NEON STRIKE**), missão curta, foco em diversão (modo **Casual** implícito).  
Stack: HTML + CSS + Canvas JS (`index.html`, `css/style.css`, `js/game.js`, `js/audio.js`).  
Sem backend no momento.

---

## O que JÁ ESTÁ PRONTO (MVP local)

| Item | Status | Notas |
|------|--------|--------|
| Missão **5 waves** | ✅ | `MISSION_WAVE = 5` em `js/game.js` (depois sobe pra 10) |
| Stats da run | ✅ | score, kills, combo, tempo, hits, bombas, bosses, itens, arma, wave |
| **Zero damage** | ✅ | contador `hitsTaken` em `damagePlayer`; badge na tela de vitória |
| Rank **C → B → A → S → S+** | ✅ | **S+** = missão limpa + zero damage |
| **1–3 estrelas** | ✅ | destaque visual + aparece no ranking |
| Nome do piloto | ✅ | digita no fim da run (bug de teclado **já corrigido** em v1.6.1) |
| Bandeiras (5) | ✅ | 🇧🇷 BR · 🇺🇸 US · 🇨🇳 CN · 🇯🇵 JP · 🇲🇽 MX |
| **Ranking local** top 10 | ✅ | `localStorage` chave `neonstrike_rank_mission5` |
| Preferência nome/bandeira | ✅ | `neonstrike_player_pref` |
| Endless após vitória | ✅ | botão continuar endless |
| Canvas mais alto no celular | ✅ | v1.6.2 — quase tela cheia (`100dvh`/`100svh`), sobe um pouco |
| Login Google | ❌ | **de propósito** — só se o jogo bombear (última coisa) |
| Ranking online | ❌ | backlog |
| Casual / Sério | ❌ | backlog prioritário |

### Commits relevantes (histórico recente)

- `e25065d` — v1.6.0 ranking local, stats, missão 5  
- `b356494` — v1.6.1 nome no input, S+, 3 estrelas, freeze do tempo  
- `ae91e2b` — v1.6.2 canvas mais alto no celular  

---

## Decisões de produto já travadas

1. **Sem Google login agora** — nome + bandeira basta.  
2. **Ranking local primeiro** — só no aparelho; online só depois se a galera curtir.  
3. **Cada dificuldade = ranking próprio** (quando existir Casual/Sério).  
4. **Sério deve ser apertado, não chato** — divertido, dá pra melhorar e bater recorde.  
5. **Missão 5** é de propósito (teste rápido); **10 waves** fica pro futuro.  
6. **Zero damage** é feature de orgulho (badge + caminho pro S+).  
7. Commits atômicos; **push só com pedido explícito**.

### Local vs online (glossário pro Pantoja)

- **Local** = placar no browser da pessoa (`localStorage`).  
- **Online** = servidor + top mundial. Ainda **não** temos.

---

## Onde paramos (conversa de “próximas etapas”)

Combinamos **pausar o projeto** (prioridade: portal).  
Antes de pausar, o feedback do Pantoja: **ficou top** (ranking, stats, mobile).

### Trilhas possíveis (ainda **sem decisão final** do próximo passo)

| Trilha | Ordem sugerida |
|--------|----------------|
| **A · Vício local** (recomendada na conversa) | Casual/Sério → missão 10 → polish |
| **B · Mundo** | Ranking online → depois Casual/Sério |
| **C · Conteúdo** | Missão 10 → ranking endless → speedrun |

**Recomendação da última conversa:** Trilha **A**.  
**Pantoja ainda não escolheu** a trilha fechada — ao voltar, **perguntar de novo** com este contexto.

### 3 perguntas em aberto (quando retomar)

1. Próximo grande passo: **Casual/Sério**, **missão 10**, ou **ranking online**?  
2. Missão **5** continua como modo rápido, ou some quando subir pra 10?  
3. Foco: **testar com amigos** ou **já puxar gente de fora**?

---

## Backlog priorizado (quando voltar)

### P1 — Casual / Sério
- Seletor no início da missão  
- Knobs: HP/dano/velocidade/power-ups (sério apertado, não chato)  
- **Ranking separado** por dificuldade  
- S+ / zero damage ainda mais “flex” no Sério  

### P2 — Missão 10 waves
- `MISSION_WAVE = 10` (ou seletor 5 / 10)  
- Recalibrar limiares de rank S/S+ se necessário  
- Textos de intro/menu  

### P3 — Ranking online
- Backend leve (Supabase / Firebase / Cloudflare)  
- Mesmo payload (nome, bandeira, score, stats)  
- Validação básica anti-score absurdo  
- Ainda **sem** login Google  

### P4 — Modos extras
- Ranking do **Endless**  
- **Speedrun** (critério = tempo)  

### P5 — Login Google
- **Último da fila** — só se o jogo tiver tração  

### Polish contínuo
- Feedback extra no S+  
- Sons / UX  
- Ajustes finos de UI mobile  

---

## Arquivos importantes

| Arquivo | Papel |
|---------|--------|
| `js/game.js` | motor, missão, stats, ranking, ranks/estrelas |
| `index.html` | telas (title, intro, victory, over, ranking) |
| `css/style.css` | UI + layout mobile (v1.6.2) |
| `js/audio.js` | áudio + mute em localStorage |
| `PRINTS_TEST/` | prints de referência (PC + celular) |
| **`CONTINUIDADE.md`** | **este handoff — ler ao retomar** |

### Chaves `localStorage`

- `neonstrike_hiscore`  
- `neonstrike_achievements`  
- `neonstrike_rank_mission5`  
- `neonstrike_player_pref`  
- `neonstrike_muted`  

---

## Como testar rápido

```bash
cd 03_Nave && python3 -m http.server 8765
# http://127.0.0.1:8765/
```

Ou deploy: portal / `games-jet.vercel.app` (conforme monorepo).

---

## Checklist ao retomar (IA)

1. [ ] Ler **este arquivo**  
2. [ ] Lembrar o Pantoja: *“paramos no v1.6.2 com MVP local top; sem Casual/Sério e sem online ainda”*  
3. [ ] Confirmar trilha (A/B/C) e as 3 perguntas em aberto  
4. [ ] Só então implementar — commits atômicos, push só se pedir  

---

*Gerado na pausa do projeto para o portal. Atualize este arquivo quando retomar e fechar novas decisões.*
