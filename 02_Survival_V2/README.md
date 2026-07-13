# Survival V2 — Build Tanque

Jogo de sobrevivência **top-down** no navegador.

## Como jogar

Precisa de um servidor local (módulos ES):

```bash
# na pasta do projeto
python3 -m http.server 8080
# abra http://localhost:8080
```

Ou com Node:

```bash
npx serve .
```

### Controles

| Tecla | Ação |
|--------|------|
| **WASD** / setas | Mover |
| **1 / 2 / 3** | Escolher carta no level-up |
| Clique | Escolher carta |
| **R** | Reiniciar (após game over / vitória) |

### Objetivo

Sobreviva à horda, mate **2 elites** (ou espere ~90s) e derrote o **chefão** na zona laranja.

## Build atual: Tanque

- Órbitas verdes + pulso de área (ataques automáticos)
- Cartas: Escudo, Campo Tóxico, Vampirismo, Magnetismo, etc.
- Personagem mais resistente e movimento “pesado”

## Builds futuras

1. **Batedor** — melee de impacto
2. **Atirador** — projéteis e kiting

## Estrutura

```
index.html
css/style.css
js/
  main.js      — loop
  game.js      — lógica principal
  entities.js  — player, inimigos, gemas, partículas
  cards.js     — cartas Tanque
  world.js     — mapa, zonas
  ui.js        — HUD, minimapa, telas
  config.js    — balanceamento
  utils.js
```
