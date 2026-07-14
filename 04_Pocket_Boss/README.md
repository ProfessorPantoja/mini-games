# Pocket Boss

Mini-jogo web: **chefe diário** em ~3 minutos.

## Conceito

- Todo dia um boss diferente (seed do dia — meia-noite local)
- 3 vidas por run
- Aprende o pattern, melhora, sobe no ranking local
- Compartilhar resultado (estilo Wordle)
- Foco em juice de combate e sensação premium no browser

## Status

**v1.0.0** — MVP jogável

## Como rodar

Qualquer servidor estático na pasta do projeto:

```bash
# Python
python3 -m http.server 5173

# Node (se tiver)
npx --yes serve -l 5173
```

Abra `http://localhost:5173`.

> Módulos ES (`type="module"`) precisam de HTTP — abrir o `index.html` via `file://` pode falhar no browser.

## Controles

| Ação    | Teclado              | Toque        |
|---------|----------------------|--------------|
| Esquiva ← | `A` / `←`          | botão        |
| Esquiva → | `D` / `→`          | botão        |
| Ataque    | `J` / `Espaço`     | botão        |
| Parry     | `K` / `Shift`      | botão        |
| Pausar    | `P` / `Esc`        | Ⅱ            |

### Defesas

- **Swipe da esquerda** → esquiva para a **direita**
- **Swipe da direita** → esquiva para a **esquerda**
- **Slam** (rosa) → **parry** no timing
- **Barrage** (ciano) → qualquer esquiva

Após defender, há uma janela curta para **contra-atacar**. Perfects dão hit-stop, pontos e juice.

## Stack

- HTML + CSS + JS vanilla (ES modules)
- Web Audio API (SFX procedural)
- Canvas 2D (partículas)
- `localStorage` (melhor run por dia + histórico)

Sem build step, sem dependências.

## Estrutura

```
index.html
css/style.css
js/
  main.js      # UI / telas
  combat.js    # state machine de combate
  boss.js      # geração do boss diário
  seed.js      # day key + PRNG
  storage.js   # ranking local
  audio.js     # SFX
  juice.js     # shake, flash, partículas
  share.js     # texto estilo Wordle
```

## Seed diário

A chave do dia é `YYYY-MM-DD` no fuso **local**. Meia-noite local troca o boss. O mesmo dia = mesmo nome, HP, cores e pattern base.
