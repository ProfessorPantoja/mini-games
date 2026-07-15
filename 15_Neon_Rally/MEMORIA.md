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

**Core reescrito (v2)** — feedback “péssimo” da v1 (tank control + corredor apertado + óleo fraco + câmera colada).

### O que roda hoje (v2)

| Peça | Status |
|------|--------|
| Mapa compacto **inteiro na tela** (leitura imediata) | OK |
| Movimento **4 direções** (estilo Namco / Rally-X) | OK |
| Fumaça contínua (segurar botão) → **spin real** no caçador | OK |
| **3 caçadores** com BFS + você mais rápido | OK |
| Flags + score + radar clássico | OK |
| Duo local (P1 WASD+Espaço · P2 setas+Enter) | OK |
| Shake, float text, flash | OK |
| Listado no portal | OK |

### Controles

- **VS IA:** WASD ou setas (4 dirs) · **segure Espaço** = fumaça · **P** pausa · **R** menu  
- **Duo:** P1 `WASD`+Espaço · P2 setas+Enter  

### Lição da v1

Não misturar “física de carro” com labirinto estreito. Clássico ganha com **leitura, direção clara e arma de chão que castiga**.

### Stack

HTML + CSS + Canvas 2D vanilla. Sem build.

### Backlog

1. Posto / reabastecimento de fumaça (pressão de recurso).
2. Fases com mapas diferentes + ranking de tempo.
3. Touch / gamepad.
4. Juice sonoro.
5. Online só depois do duo viciar.

## Arquivos

```
15_Neon_Rally/
  index.html
  css/style.css
  js/game.js
  MEMORIA.md
  PROMPT.md
```
