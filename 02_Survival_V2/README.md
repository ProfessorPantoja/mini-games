# Survival V2

Jogo de sobrevivência **top-down** no navegador.

## Como jogar

```bash
python3 -m http.server 8080
# http://localhost:8080
```

### Controles

| Tecla | Ação |
|--------|------|
| **WASD** / setas | Mover |
| **1 / 2 / 3** | Carta no level-up |
| **R** | Reiniciar (fim de jogo) |
| **M** | Mutar som (no menu) |

### Objetivo

Mate **2 elites** (ou ~90s) e derrote o **chefão**.

## Builds

### Tanque (azul)
Órbitas + pulso · vida alta · cartas de área/tank

### Batedor (laranja)
Golpes melee automáticos · knockback · cartas de dano/cadência/combo

### Futuro
**Atirador** — projéteis e kiting

## Estrutura

```
js/
  audio.js     — SFX procedural (Web Audio)
  builds.js    — builds + cartas
  game.js      — loop e sistemas
  entities.js  — player, inimigos, juice visual
  …
```
