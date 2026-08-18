# Configuração do Placar de Líderes (Google Sheets)

Para habilitar o ranking online e gratuito para que todos os jogadores vejam e comparem suas pontuações, siga os passos abaixo para conectar o jogo a uma planilha do Google Sheets.

---

## Passo 1: Criar a Planilha do Google

1. Abra o [Google Planilhas](https://sheets.google.com) e crie uma planilha em branco.
2. Dê um nome para a planilha (ex: `Cola Runner - Placar`).
3. Renomeie a primeira aba/página (no canto inferior esquerdo) para **`Placar`**.
4. Defina o cabeçalho na primeira linha com as seguintes colunas (opcional, mas recomendado para organização):
   - A1: `Nome`
   - B1: `Pontuacao`
   - C1: `Timestamp`

---

## Passo 2: Adicionar o Google Apps Script

1. No menu superior da planilha, clique em **Extensões** -> **Apps Script**.
2. Apague qualquer código existente no editor e cole o seguinte código:

```javascript
function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Placar");
  
  // Se a aba "Placar" não existir, cria ou pega a ativa
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  }
  
  // Se a planilha estiver vazia, cria os cabeçalhos
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Nome", "Pontuacao", "Timestamp"]);
  }

  var action = e.parameter.action;
  var output = "";
  
  if (action === "add") {
    var name = e.parameter.name;
    var score = parseInt(e.parameter.score);
    
    if (name && !isNaN(score)) {
      // Limita o nome a 30 caracteres por segurança
      name = name.substring(0, 30).trim();
      if (name.length >= 3) {
        sheet.appendRow([name, score, new Date().toISOString()]);
        output = JSON.stringify({ status: "success", name: name, score: score });
      } else {
        output = JSON.stringify({ status: "error", message: "Name too short" });
      }
    } else {
      output = JSON.stringify({ status: "error", message: "Invalid parameters" });
    }
  } else {
    // Ação padrão: buscar ranking (get)
    var data = [];
    try {
      data = sheet.getDataRange().getValues();
    } catch (err) {
      // Se falhar ao ler dados da planilha vazia
    }
    
    var scores = [];
    // Pula a primeira linha (cabeçalhos)
    if (data && data.length > 1) {
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (row && row[0] && !isNaN(row[1])) {
          scores.push({
            name: String(row[0]).trim(),
            score: parseInt(row[1]),
            timestamp: row[2]
          });
        }
      }
    }
    
    // Agrupa por nome único, mantendo apenas a maior pontuação
    var maxScoresMap = {};
    for (var j = 0; j < scores.length; j++) {
      var s = scores[j];
      if (!maxScoresMap[s.name] || s.score > maxScoresMap[s.name]) {
        maxScoresMap[s.name] = s.score;
      }
    }
    
    // Converte de volta para array
    var uniqueScores = [];
    for (var nameKey in maxScoresMap) {
      uniqueScores.push({
        name: nameKey,
        score: maxScoresMap[nameKey]
      });
    }
    
    // Ordena de forma decrescente pela pontuação
    uniqueScores.sort(function(a, b) {
      return b.score - a.score;
    });
    
    // Pega as 10 melhores pontuações
    var top10 = uniqueScores.slice(0, 10);
    output = JSON.stringify(top10);
  }
  
  // Google Apps Script adiciona o cabeçalho Access-Control-Allow-Origin: * automaticamente
  return ContentService.createTextOutput(output)
    .setMimeType(ContentService.MimeType.JSON);
}
```

3. Clique no botão de **Salvar** (ícone de disquete) ou aperte `Ctrl+S` / `Cmd+S`.

---

## Passo 3: Implantar como Web App

1. No canto superior direito da tela do Apps Script, clique em **Implantar** (Deploy) -> **Nova implantação** (New deployment).
2. Clique na engrenagem ao lado de "Selecione o tipo" e escolha **App da Web** (Web app).
3. Preencha as configurações:
   - **Descrição**: `Placar do Jogo`
   - **Executar como**: **Eu** (sua conta de e-mail)
   - **Quem tem acesso**: **Qualquer pessoa** (isso é crítico para permitir que os celulares dos jogadores enviem os dados anonimamente).
4. Clique em **Implantar** (Deploy).
5. Se for solicitado, clique em **Autorizar acesso** e selecione sua conta Google para conceder as permissões necessárias para ler/gravar na planilha. (Se o Google disser que o app não foi verificado, clique em "Avançado" -> "Acessar... (inseguro)" para continuar).
6. Copie a **URL do App da Web** gerada. Ela deve se parecer com:
   `https://script.google.com/macros/s/XXXXXX-YYYYYY/exec`

---

## Passo 4: Conectar o Jogo

1. Abra o arquivo `src/config.ts` no seu projeto.
2. Cole a URL copiada na propriedade `leaderboardUrl`:

```typescript
export const CONFIG = {
  // ... outras configurações ...
  leaderboardUrl: "SUA_URL_DO_WEB_APP_AQUI",
  // ...
} as const;
```

---

## Pronto! 🏆

- Agora, **toda corrida** envia automaticamente a pontuação para a planilha (fire-and-forget).
- A planilha acumula todas as entradas; o script agrega por nome e retorna apenas a melhor de cada jogador.
- A tela de ranking lê os dados em tempo real da planilha, com cache em memória para exibição instantânea.
- Você pode abrir a planilha a qualquer momento para excluir linhas, apagar nomes ofensivos, ou filtrar por data.

---

## 💰 Garantia de Custo Zero

O Google Apps Script é **100% gratuito** e **não possui mecanismo de cobrança automática**.

### Cotas diárias (contas pessoais @gmail.com):
| Recurso | Limite |
|---------|--------|
| Execuções por dia | ~20.000 |
| Tempo total de execução por dia | 90 minutos |
| Chamadas simultâneas | 30 |

### O que acontece se a cota for atingida?
- O script **retorna um erro HTTP** (geralmente 429 ou 503).
- O jogo detecta isso e **exibe o placar local em cache** — a feature degrada graciosamente.
- **Nenhuma cobrança é gerada**, nunca. Não existe cartão de crédito vinculado ao Apps Script.
- As cotas resetam diariamente à meia-noite no fuso horário do Pacífico (PDT).

### Para um evento de banca:
- 20.000 requisições/dia suportam facilmente **milhares de jogadores** (cada jogada gera ~2 requisições: 1 submit + 1 fetch do ranking).
- Se o evento crescer muito, a feature simplesmente para de funcionar até o dia seguinte — sem surpresas financeiras.

