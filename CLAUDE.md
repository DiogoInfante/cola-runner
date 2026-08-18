# Cola Runner — contexto do projeto

Jogo web de auto-runner (estilo Hell Kid: corre sozinho, toque pra pular) pra
uma banca de colagens no Mercado São José. A pessoa scannea um QR na banca,
joga na hora, e conforme a distância desbloqueia faixas de prêmio (marcador,
postal, combo) que resgata seguindo o @ da artista e mostrando na banca.

O jogo é uma **isca de atenção e memória**, não um vendedor. Prioridades, nesta
ordem: (1) abrir instantâneo e nunca travar em celular ruim/4G, (2) ser sticky
("só mais uma"), (3) fazer a arte dela brilhar, (4) o loop prêmio→follow.

## Stack e princípios

- Vite + TypeScript **sem framework**. Canvas 2D puro pro jogo; DOM só pras
  telas de menu/CTA (links de follow precisam ser `<a>` tappável de verdade).
- Sem dependências de runtime. Bundle atual ~4KB gzip; manter minúsculo.
- Física em **timestep fixo** (`STEP` em `main.ts`), unidades por segundo.
  Estável em qualquer FPS. Não meça física por frame.
- Todos os parâmetros de feel ficam em `src/config.ts`. Ajuste ali.
- Portrait, `touch-action: none`, DPR limitado a 2 (perf/bateria).

## Arquitetura

- `main.ts` — canvas, escala "contain", input, loop, wiring da UI.
- `game.ts` — máquina de estado (ready/playing/dead), spawner, near-miss,
  score, orquestração. Expõe callbacks (`onStateChange/onScore/onReveal`).
- `entities/player.ts` — gravidade, pulo, coyote time, jump buffer, double
  jump, **hitbox honesta** (menor que o sprite).
- `entities/obstacle.ts` — obstáculos low/tall vindo da direita.
- `systems/parallax.ts` — camadas de fundo + reveal por marco de distância.
- `systems/util.ts` — overlap AABB, rand, lerp.
- `assets.ts` — loader com fallback: sem arquivo, desenha retângulo rotulado.
  Nomes dos slots batem com `public/assets/`.

## Convenções

- Comentários e copy em pt-BR. Código/identificadores em inglês.
- Sem magic numbers no meio do código: tudo em `config.ts`.
- A identidade visual vem das colagens dela. Placeholders são neutros de
  propósito; não invente um estilo que não é o dela.

## Roadmap sugerido (próximos passos)

Já feito: loop, física, parallax, aceleração progressiva, near-miss, colisão,
restart zero-fricção, faixas de prêmio, CTA de follow, recorde local.

Próximo (bom pedir pro Claude Code, mais ou menos nesta ordem):
1. **Feedback de morte** — pequeno flash/shake + pausa de ~250ms antes da tela
   de fim, pra leitura clara do que matou. Respeitar `prefers-reduced-motion`.
2. **Reveal real de obra** — em `parallax.ts`, trocar `bg-0` inteiro por marco
   (array de imagens por milestone) com crossfade curto. Hoje só muda paleta.
3. **Near-miss visível** — partícula/“+12m” subindo quando raspa. Reforça o
   comportamento de arriscar.
4. **Onboarding de 1 toque** — na tela ready, um obstáculo fantasma mostrando o
   pulo, some no primeiro toque. Zero texto de tutorial.
5. **Compartilhar pontuação** — botão "mandar minha pontuação" (Web Share API
   com fallback pra copiar). Torna o jogo viral na banca.
6. **Áudio opcional** — um som curto de pulo/near-miss/morte via WebAudio,
   mutado por padrão (mercado é barulhento; não pode tocar som sozinho alto).
7. **v2 — ranking do dia** — placar do evento. Precisa de backend simples
   (ex: um KV/Supabase). Maior pontuação leva peça original. Deixar por último.

## Cuidados de design (não regredir)

- Primeira corrida mais generosa (`speed.firstRunFactor`): ninguém pode morrer
  em 2s e largar o celular. Dificuldade sobe rápido, começo acolhedor.
- Restart tem que ser 1 toque. Nada de botão longe ou animação bloqueante.
- Hitbox honesta sempre. Morte injusta faz largar o jogo.
- Nada de `<form>`, nada de dados pessoais, nada que precise de login.

## Trocar antes de publicar

- `config.ts` → `instagram.handle` e `instagram.url` (estão com placeholder).
- `public/assets/` → colocar as colagens dela (ver README de lá).
- `index.html` → trocar "[nome dela]" no eyebrow.
- Faixas de prêmio (`config.ts` → `tiers`) conforme o que sobrou da gráfica.
