# MEMÓRIA — Portal de mini-games

## Direção do portal

Este monorepo **não** é “mais um pack de demos”. É um **portal de jogos simples, mas poderosos**: essência de arcade clássico, ideia clara, loop viciante, remake com respeito ao que já funcionava em 1980–2000 e polimento de hoje (juice, controles, modos).

O que faz um mini-game “poderoso” aqui:

1. **Uma ideia matadora** (não 20 sistemas pela metade).
2. **Essência de um clássico** — Rally-X, River Raid, Enduro, Snake, Breakout… o DNA, não a cópia pixel a pixel.
3. **Leitura imediata** — em 10 segundos o jogador entende o que fazer.
4. **Profundidade** — poderes, fases, bosses, modos, multi — **só quando servem a ideia**.
5. **Modos certos para o jogo certo** — PvP online não entra à força num single de campanha (ex.: Neon Serpent). PvP nasce em jogos feitos para “eu vs você”.

## O que **não** fazer

- Abrir outras pastas de mini-games “para inspiração” e copiar arquitetura.
- Transformar todo jogo em multiplayer genérico.
- Encher de features antes do core divertir sozinho.

## Pipeline mental

| Etapa | Foco |
|--------|------|
| 1 | Essência (1 frase: o que o jogador *sente*) |
| 2 | Core loop jogável solo ou local |
| 3 | Expandir (poderes, fases, juice) |
| 4 | Multi **só se** o design nasceu para confronto |

## Clássicos na mesa (referência de *essência*, não de clone)

| Clássico | Essência | No portal |
|----------|----------|-----------|
| Enduro | corrida sem fim, ritmo, sobrevivência na pista | Neon Drive (já existe, espírito parecido) |
| Snake | crescimento, risco, grade | Neon Serpent |
| **Rally-X** | labirinto top-down, fuga, item no chão que atrapalha o perseguidor | **próximo: Neon Rally** |
| River Raid | scroll vertical, perigo constante, reabastecer | candidato futuro |
| Pac-Man / labirintos | corredores, perseguição, timing | DNA em Rally-X |

## Próximo foco

→ Pasta `15_Neon_Rally/` — remake **espiritual** de Rally-X, já pensado para **pessoas vs pessoas** (não só vs IA).

## Logs por jogo

Cada jogo pode ter o seu `LOG_DEV.html` / `MEMORIA.md` local. Este arquivo é a **bússola do portal**.
