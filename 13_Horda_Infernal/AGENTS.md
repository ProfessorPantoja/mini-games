# Horda Infernal — mapa do código (para agentes e humanos)

Objetivo: o projeto pode crescer (10 classes, mais etapas) **sem** um único arquivo monstro.
Abra só o módulo que vai mudar.

## Onde está o quê

| Quer mudar… | Abra |
|---|---|
| Stats / identidade de uma classe | `js/classes/<id>.js` (~80 linhas) |
| Registrar classe nova | `js/classes/registry.js` + arquivo novo |
| Estilo de ataque (melee/ranged) | `js/combat/styles.js` |
| Visual do herói | `js/combat/playerDraw.js` |
| Ondas / boss | `js/stages.js` |
| Poderes de nível | `js/powers.js` |
| Loot / raridade | `js/loot.js` |
| Orquestração da run | `js/game.js` (só se for loop global) |
| HUD / telas | `js/ui.js` + `index.html` + `css/style.css` |

## Como adicionar a 4ª… 10ª classe

1. Copie `js/classes/archer.js` → `js/classes/nova.js`
2. Ajuste `id`, `stats`, `resource`, `style` (`melee` | `ranged` | `caster`)
3. Em `registry.js`: `import` + entrada em `CLASSES` e `CLASS_ORDER`
4. Card no `index.html` (`data-class="nova"`)
5. Se o estilo for novo, estenda `combat/styles.js` (não enfie ifs no `game.js`)

## Regras de manutenção

- **Uma classe = um arquivo.** Não cole stats de classe no `config.js`.
- **`game.js` orquestra**, não especializa. Se um `if (classId === …)` crescer, extraia.
- Commits **atômicos** (um commit por mudança lógica).
- Sem push sem pedido do usuário.

## O que NÃO fazer agora

- Obstáculos que só dificultam sem diversão (pedido do dono).
- Expandir inventário / crafting / lore longo.
- Classes novas sem passar pelo registry (`classes/` + `combat/`).
