# NEON RALLY — Memória do jogo

## Essência (1 frase)

**Carrinho em labirinto top-down:** fuja, colete, solte **óleo/fumaça no chão** para fazer o rival derrapar — perseguição e trapaça limpa, estilo **Rally-X**, feito para **pessoas vs pessoas**.

## Por que este jogo existe

- Clássicos simples eram poderosos pela **ideia**, não pelo polígono.
- Rally-X: labirinto + fuga + item de chão que atrapalha quem vem atrás = fantástico.
- No portal: remake espiritual **melhorado** (efeitos, poderes, multi), sem perder a leitura imediata.
- **PvP nasce aqui** — não enxertado em Snake de campanha.

## Pilares

1. Labirinto legível (corredores, cantos, atalhos).
2. Velocidade e deriva — errar curva custa.
3. **Botão de ação** — óleo / fumaça / rastro que atrapalha o outro (e a IA no solo).
4. Coleta / flags / combustível ou meta clara (volta ao “posto”, limpar mapa, etc. — decidir no build).
5. Multi: **mesmo dispositivo (duo)** primeiro espírito; online quando o core estiver viciante.
6. Visual neon do portal, sem copiar pasta de outro mini-game.

## Fora de escopo (por agora)

- Abrir/copiar outros mini-games do monorepo.
- MMO, 8 players, metagame enorme.
- Campanha de 20 horas antes do duelo de 2 minutos funcionar.

## Status

**Core jogável (rodada 1).**

### O que roda hoje

| Peça | Status |
|------|--------|
| Labirinto top-down conectado | OK |
| Carro com aceleração / freio / curva arcade | OK |
| Óleo no chão + derrapagem (grip baixo + fumaça) | OK |
| Flags coletáveis · limpar mapa = vitória | OK |
| VS IA (perseguição + drop de óleo) | OK |
| Duo local (P1 WASD+Espaço · P2 setas+Enter) | OK |
| Visual neon, HUD, menu, pausa | OK |
| Listado no portal (`games.js`) | OK |

### Controles

- **VS IA:** WASD ou setas · **Espaço** = óleo · **P** pausa · **R** menu  
- **Duo:** P1 `WASD` + Espaço · P2 `↑←↓→` + Enter  

### Stack

HTML + CSS + Canvas 2D vanilla (`index.html`, `css/style.css`, `js/game.js`). Sem build.

### Backlog (próximas rodadas)

1. Juice extra: screen shake ao bater, combo de flags, radar mini-mapa (estilo Rally-X).
2. Tanque de óleo / posto de reabastecimento como meta secundária.
3. Mais oponentes IA ou “especial” curto (boost / fumaça densa).
4. Touch / gamepad para mobile e controles de sofá.
5. Online só depois do duo local viciar de verdade.
6. Fases com labirintos diferentes + ranking de tempo.

## Arquivos

```
15_Neon_Rally/
  index.html
  css/style.css
  js/game.js
  MEMORIA.md
  PROMPT.md
```
