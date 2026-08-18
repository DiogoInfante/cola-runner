# Assets — colagens dela entram aqui

O jogo roda 100% sem nenhum arquivo (cada slot vira um retângulo rotulado).
Pra trocar pelo real, coloque PNGs com **exatamente** estes nomes:

| Arquivo             | O que é                              | Tamanho sugerido | Notas |
|---------------------|--------------------------------------|------------------|-------|
| `player.png`        | recorte dela correndo (ou objeto)    | 78×92            | fundo transparente |
| `obstacle-low.png`  | obstáculo baixo (pula por cima)      | 56×64            | transparente |
| `obstacle-tall.png` | obstáculo alto                       | 62×108           | transparente |
| `ground.png`        | faixa do chão (opcional)             | 540×140          | tileável na horizontal |
| `bg-0.png`          | colagem de fundo (mais distante)     | 540×960          | camada lenta do parallax |
| `bg-1.png`          | colagem do meio                      | 540×960          | camada média |
| `bg-2.png`          | colagem da frente                    | 540×960          | camada rápida |

## Dicas
- Mantenha os nomes; o código busca por eles em `src/assets.ts`.
- Fundo transparente nos sprites (player/obstáculos) pra não aparecer caixa.
- As três camadas de parallax não precisam ser 3 obras diferentes — podem ser
  recortes da mesma colagem separados em profundidade (céu / meio / chão).
- O "revelar obra por distância" hoje troca só a paleta do fallback. Quando
  houver arte real, dá pra evoluir pra trocar `bg-0` inteiro por marco (ver CLAUDE.md).
- Se a arte dela for fotográfica/alta resolução, remova `image-rendering: pixelated`
  do `#game` em `src/styles.css`.
