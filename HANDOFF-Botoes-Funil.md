<!-- ChatPhotoMusic/HANDOFF-Botoes-Funil.md -->
# HANDOFF - Botões no ChatBot + fim da fuga no funil de orçamento

> **Frente 1** (PhotoMusic Pro + ChatBot). Criado **15/07/2026**.
> **Objetivo do Mario:** *"ter botão pra gente parar de ter fuga no fluxo, cliente que não conclui a solicitação de orçamento."*
> Nada codado ainda. Este documento é o plano.

---

## 1. A verdade incômoda, antes de qualquer botão

O pedido é botão. Mas ao abrir o funil real, **nem toda fuga é por digitação**. Tem três causas diferentes, e botão só resolve uma:

| Causa | Botão resolve? | O que resolve |
|---|---|---|
| **Atrito de digitar** (menu, sim/não, escolher serviço) | ✅ Sim | Botão / lista |
| **Funil comprido demais** (~25 passos até o orçamento sair) | ❌ Não | Cortar e reordenar passos |
| **Ordem errada** (campo opcional bloqueia a entrega) | ❌ Não | Entregar antes, perguntar depois |

**Se só embotoar, a fuga cai um pouco e o problema principal fica de pé.** O plano abaixo trata as três.

## 2. Evidência real (não é achismo, está no código)

`jobs/lembreteOrcamento.js` já detecta abandono **por passo** e documenta casos reais:

| Caso | Onde travou | O que revela |
|---|---|---|
| **Heciomar/Susteiner** (07/07) | `aguardando_opcao` | Nem começou. Recebeu o menu 1-8 e sumiu. Uma reunião de negócio não avançava por causa disso. |
| **Caso 28/06** | `orcamento_confirmar` e `orcamento_escolher_servico` | **Reta final.** Deu TODOS os dados e não recebeu nada. A fuga mais cara que existe. |
| **Rayane** (26/06) | `coletar_email_opcional` / `coletar_nascimento_opcional` | 🚨 **O orçamento não foi entregue porque ela não respondeu um campo OPCIONAL.** |

Some-se o [[fix_correcao_numeros_dois_digitos]]: digitar **10/11/12** no menu de correção era lido como dígito solto. **Prova de que a digitação numérica já causou bug real em produção.**

## 3. 🚨 O bug de design mais caro (arrumar PRIMEIRO, é de graça)

`coletar_email_opcional` e `coletar_nascimento_opcional` são **opcionais**, mas o orçamento **só é entregue depois deles**. Ou seja: a cliente responde 20 perguntas, chega no fim, não quer dar o e-mail, e **sai sem o orçamento**.

**Isso não é problema de botão, é ordem errada.** Correções, da melhor pra pior:
1. **Entregar o orçamento e PEDIR o e-mail depois** ("quer que eu mande em PDF também?"). O opcional deixa de ser pedágio.
2. Se tiver que ficar antes: **botão "Pular" bem visível** (hoje a pessoa tem que *digitar* a palavra "pular", o que é pior que a pergunta).

**Esse item sozinho pode valer mais que todos os botões juntos**, porque recupera quem já fez o funil inteiro.

## 4. O funil hoje: ~25 passos

`orcamento_nome` → `orcamento_nome_confirmar` → `orcamento_celebracao` (→ `_outros`) → `orcamento_convidados` → `orcamento_dias` → (`orcamento_horarios_iguais` → `orcamento_datas_multiplas` → `orcamento_dia_data` → `orcamento_dia_hora_inicio` → `orcamento_dia_hora_fim`) → `orcamento_data` → `orcamento_hora_inicio` → `orcamento_hora_fim` → `orcamento_cidade` → `orcamento_bairro` → `orcamento_salao` → `orcamento_detalhes` (→ `_texto`) → `orcamento_onde_encontrou` → `coletar_email_opcional` → `coletar_nascimento_opcional` → `orcamento_confirmar` (→ `orcamento_corrigir_escolher` → `_valor`) → `orcamento_escolher_servico` → **orçamento entregue** → `orcamento_mais_servicos`

**Cada passo é uma porta de saída.** Perguntas a fazer antes de embotoar:
- `orcamento_nome_confirmar` **existe por quê?** A pessoa acabou de digitar o nome. É um passo inteiro pra confirmar o que ela escreveu 2 segundos atrás.
- `orcamento_onde_encontrou` é pergunta **nossa** (marketing), não dela. **Por que está ANTES da entrega?** Deveria vir depois, junto com o e-mail.
- `orcamento_salao` e `orcamento_detalhes` são necessários **antes** do preço?

> **Regra:** tudo que serve a NÓS (e-mail, nascimento, como nos conheceu, detalhes) vai **depois** do orçamento entregue. Antes do preço, só o que muda o preço.

## 5. Mapa: o que vira botão e o que não vira

### ✅ Vira botão / lista
| Passo | Hoje | Vira |
|---|---|---|
| `aguardando_opcao` | menu 1-8 digitado | **Lista** (8 itens, cabe em 10) ⚠️ caso Heciomar |
| `orcamento_celebracao` | 9 opções digitadas | **Lista** (9 itens, cabe em 10) |
| `orcamento_nome_confirmar` | 1 Sim / 2 Não | 2 botões (**ou some, ver §4**) |
| `orcamento_horarios_iguais` | 1 Sim / 2 Não | 2 botões |
| `orcamento_detalhes` | 1 Sim / 2 Não | 2 botões |
| `orcamento_confirmar` | 1 Sim / 2 Corrigir | 2 botões ⚠️ **caso 28/06, reta final** |
| `orcamento_corrigir_escolher` | número (deu bug c/ 10-12) | **Lista** (mata o bug na raiz) |
| `orcamento_onde_encontrou` | digitado | **Lista** |
| `orcamento_dias` | número | Botões 1/2/3 + "mais" |
| `coletar_email_opcional` / `_nascimento` | digitar "pular" | Botão **"Pular"** ⚠️ **caso Rayane** |
| `orcamento_salao` | digitar "pular" | Botão **"Pular"** |
| `orcamento_mais_servicos` | 1 Sim / 2 Não | 2 botões |

### ❌ Não vira (texto livre por natureza)
`orcamento_nome`, `orcamento_convidados`, `orcamento_data`, `orcamento_hora_inicio`, `orcamento_hora_fim`, `orcamento_cidade`, `orcamento_bairro`, `orcamento_detalhes_texto`

### ⚠️ O caso difícil: `orcamento_escolher_servico`
Hoje é **múltipla escolha digitada** (`1,3,5` ou `124`), 8 serviços. **A lista do WhatsApp é escolha ÚNICA** - não existe multi-select nativo. Opções:
- **(A)** Lista escolhe 1 → botões "➕ Adicionar outro / ✅ Só isso". Natural (é carrinho de e-commerce) e **mantém a venda múltipla**, mas adiciona passos pra quem quer 3 serviços.
- **(B)** Manter digitado, só melhorando o texto. Zero risco, zero ganho.
- **(C)** Lista com os **combos mais vendidos** ("Cabine + 360", "Cabine + DJ") + "Montar o meu". Reduz passos pro caso comum e **empurra o combo**, que já é regra de negócio ([[project_regras_parcelamento_desconto]]: 2 svc = 6x, 3 svc = 9x, combo R$100).
- **Recomendação: (C) com (A) como saída.** Combo é o que a empresa quer vender mesmo. Decisão do Mario.

## 6. ⚠️ O risco da Z-API (ler antes de prometer)

Pesquisado em 15/07 (mesma investigação da paróquia):
- Endpoints existem: `/send-option-list`, `/send-button-list`, `/send-button-actions`, `/send-button-otp` (copiar), `/send-button-pix`, `/send-button-list-image`.
- **A própria Z-API avisa:** botões **sofrem instabilidade**; o comportamento depende de **tipo de conta + destino + aceite dos termos**; *"futuras atualizações do WhatsApp podem alterar esse comportamento"*. Doc do blog é de **ago/2024**.
- **Lista não funciona em grupo** (nosso caso é conversa individual, ok).
- **3 tipos de botão juntos quebram no WhatsApp Web.**

> 🔑 **REGRA DE OURO: botão é CAMADA, nunca substituto.**
> **Todo menu com botão continua aceitando o número digitado.** Os textos numerados de hoje ficam como estão. Se o botão não renderizar, o cliente digita 1 e o fluxo segue igual. **Zero regressão.**

Consequência: isso reforça a migração pra **Meta Cloud API** (lá botão/lista são oficiais e estáveis). A Z-API já deve ficar **atrás de camada própria** (`utils/`), então a troca vira config.

## 7. Ordem de ataque (por dor real, não por facilidade)

| # | O quê | Por quê | Custo |
|---|---|---|---|
| **1** | **Entregar orçamento ANTES do e-mail/nascimento** | Caso Rayane. Recupera quem já fez tudo. **Não precisa de botão.** | Baixo |
| **2** | **Botões em `orcamento_confirmar` + `orcamento_escolher_servico`** | Caso 28/06. Reta final = fuga mais cara. | Médio |
| **3** | **Lista no `aguardando_opcao`** | Caso Heciomar. Entrada do funil, maior volume. | Baixo |
| **4** | **Botão "Pular"** nos opcionais e no salão | Tirar o pedágio. | Baixo |
| **5** | **Lista no `orcamento_celebracao` e `orcamento_corrigir_escolher`** | Mata o bug dos 2 dígitos na raiz. | Baixo |
| **6** | **Cortar passos** (`nome_confirmar`, mover `onde_encontrou` pro fim) | Funil mais curto > funil embotoado. | Médio |

## 8. Como saber se funcionou (fazer no item 1)

Hoje **não há contagem de abandono por passo** - o `lembreteOrcamento.js` já sabe quem abandonou e onde, mas só avisa o operador, **não acumula**. Sem número, "melhorou" vira opinião.

**Antes de mexer:** persistir um registro por abandono (`chatId`, `step`, timestamp). O job já tem essa informação na mão; é só gravar. Com 2 semanas de dado dá pra ranquear os passos pela fuga real, e aí o item 7 acima deixa de ser meu palpite e vira fato.

## 8b. 🧪 TESTE NA 1ª EUCARISTIA — **JÁ CODADO (15/07), FALTA FTP/DEPLOY + TESTE REAL**

**Ideia do Mario:** testar botão no fluxo da **1ª Eucaristia**, que está **parado até 2027**. **Laboratório perfeito: se quebrar, ninguém perde venda.**

**E é melhor do que parecia:** `services/eucaristia.js` já atende a **Paróquia São José** com as **mesmas 5 capelas** do calendário que a Maju mandou (Matriz, Santa Teresinha, Bonsucesso, Penha, Santo Antônio). Ou seja, é ensaio **na mesma paróquia, com o mesmo público** (pais, avós, catequistas — os idosos que motivaram o pedido). Ver [[project_paroquia_pro]].

### A descoberta que deixou a implementação trivial
O webhook da Z-API devolve `listResponseMessage.selectedRowId` / `buttonsResponseMessage.buttonId` **com o mesmo id que enviamos**. Usando os **próprios números do menu como id**, o clique chega **idêntico ao texto digitado** → **nenhum passo do `index.js` precisou mudar**. A ponte inteira são 3 linhas no `server.js`.

### O que foi feito
| Arquivo | O quê |
|---|---|
| `utils/sendOptionList.js` | **NOVO.** Envia lista clicável. **O menu numerado vai no corpo da mensagem** (fallback de quem não vê a lista). Respeita modo sombra e modo silencioso (senão quebra o replay do `respondercliente`). Cai sozinho no `sendText` se a Z-API falhar ou se passar de 10 opções. |
| `utils/webhookPayload.js` | **NOVO.** `extrairRespostaDeClique()` — isolado aqui para ser testável. |
| `server.js` | Requer o novo util; clique vira `body`, como se fosse digitado. |
| `utils/index.js` | Exporta `sendOptionList` e `textoNumerado`. |
| `index.js` | Importa `sendOptionList`; `eucaristia_paroquia` (2 opções) e `eucaristia_capela` (5/3 opções, lista **dinâmica** = mesmo padrão do menu da paróquia) passam a mandar lista. **A validação de resposta não mudou.** |

### ✅ Testado
- `node --check` nos 4 arquivos; **o servidor sobe limpo**.
- **10 testes** de `extrairRespostaDeClique` com os **payloads exatos da doc da Z-API** (lista, botão, texto comum não vira clique, id numérico, id vazio, trim) + formato do fallback. **10/10.**

### ❌ NÃO testado (só dá com celular na mão)
- **Se a lista renderiza**, e **o que aparece quando não renderiza** ← a pergunta que motivou tudo
- O envio real (precisa de instância Z-API ativa)

### 📋 Roteiro do teste real
1. Deploy (ver §9) e mandar `1` (ou o gatilho da Eucaristia) pro bot.
2. Repetir em: **Android novo, Android velho, iPhone, WhatsApp Web**. Se der, um **aparelho de idoso** (o público-alvo).
3. Em cada um, anotar: a lista abriu? deu pra clicar? **se não abriu, o que apareceu?** o clique andou o fluxo?
4. **Testar o fallback de propósito: digitar o número em vez de clicar.** Tem que funcionar igual.
5. **Bônus:** pedir pra **Dani e Maju** testarem — são da São José, é o fluxo da paróquia delas, e elas veem o sistema de pé antes da reunião de 24/07.
6. O resultado decide o desenho na paróquia **e** no orçamento.

## 8c. 📚 LIÇÕES DO BOT DO PADRE PAULO RICARDO (observado pelo Mario, 15/07)

Operação grande de vendas por WhatsApp. O que dá para roubar:

| O que eles fazem | Por que importa |
|---|---|
| **Sempre 3 opções** ("Sim, podemos / Saber mais / Bloquear número") | **Confirma o limite: botão = máx. 3.** Acima disso, lista. |
| **Botão de saída** ("Bloquear número") | Porta educada. Quem sai por ali **não denuncia como spam**. É o "Está ótimo, por enquanto é só" da Adriana — ela chegou sozinha na mesma conclusão de uma operação profissional. |
| **Mensagens curtas em sequência**, ideia por ideia, e só então a pergunta | O oposto do nosso bloco de 80 arquivos. |
| **Botão que vende** ("Link do Anual (40%)") | Fechamento em 1 toque. |

**⚠️ Achado do Mario:** o **rótulo do botão não é texto copiável** (não tem hora, não dá para selecionar) — é metadado da mensagem, não conteúdo. **Regra que sai disso: NUNCA colocar no rótulo do botão informação que o cliente precise copiar** (chave PIX, link, valor). Isso vai no corpo da mensagem. Vale para o item 8 da paróquia (dados bancários).

**Regra de ferramenta que ficou:** **2 ou 3 opções → botão** (à vista, 1 toque). **4 a 10 → lista** (precisa abrir).

## 8d. ✅ FLUXO DA ADRIANA — CODADO 15/07, ⏳ FALTA DEPLOY + TESTE REAL

**A ideia:** entregar o **orçamento logo depois da prova social** e deixar os detalhes (fotos/vídeos) **sob demanda**. É o espelho da regra do §4: antes do preço só vai o que muda o preço; **depois do preço, tudo é opcional**.

### O que tornou isso barato
1. Os 8 services **já separavam internamente** detalhes (`enviarFluxoX`) de orçamento (`enviarOrcamentoX`); o wrapper é que juntava.
2. **Já existia a flag `_envioMultiplo.apenasFluxo`** (usada no multi-dia): manda fotos, pula o PDF. Bastou criar o **espelho `apenasOrcamento`**: manda o PDF, pula as fotos. Simétrico, e segue a convenção que o código já tinha.

### Os 3 menus do Mario são 1 menu dinâmico
```
existe orçado ainda NÃO detalhado → "Quero mais detalhes"
existe serviço ainda NÃO orçado   → "Quero mais orçamento"
sempre                            → "Está ótimo, por enquanto é só"
```
Quando tudo foi detalhado, a 1ª opção **some sozinha** e sobram 2 — que é exatamente o 3º menu que ele desenhou. **Nunca passa de 3 opções → sempre cabe em botão.** Se sobrar só a saída, o bot **nem pergunta**, encerra.

### Fluxo novo
```
prova social (enxuta) → orçamento de cada serviço (apenasOrcamento) → resumo
   → MENU (botões)
        "mais detalhes" → 1 serviço? manda direto : LISTA pra escolher qual
                        → manda detalhes (apenasFluxo) → volta ao MENU
        "mais orçamento" → LISTA dos não orçados → fluxo de sempre
        "é só" → encerra
```

### Arquivos
`utils/sendButtonList.js` (NOVO, até 3 botões, mesma regra de ouro do sendOptionList) · `utils/index.js` (exporta) · `index.js` (`SERVICOS_NOMES`, `servicosParaDetalhar/Orcar`, `registrarServicoDetalhado`, `montarMenuPosOrcamento`, `perguntarPosOrcamento`, `enviarDetalhesServico`, steps `orcamento_pos` e `orcamento_escolher_detalhe`, `apenasOrcamento` no envio) · os **8 services** (respeitam `apenasOrcamento`).

### ✅ Testado / ❌ não testado
- ✅ `node --check` em 11 arquivos, servidor sobe limpo, **6/6 testes** do menu dinâmico cobrindo os 3 cenários do Mario + 3 casos que ele não previu (1 serviço só; tudo orçado e detalhado; tudo orçado com 1 detalhado).
- ❌ **Nenhum orçamento real passou pelo fluxo novo.** O step `orcamento_mais_servicos` (antigo) continua no código para não quebrar sessão em andamento, mas **ninguém mais cai nele** — vale remover depois de confirmar.

## 8e. 🆕 COMANDO MANUAL `#` + FLAG `+completo` (codado 15/07)

**O Mario achou o buraco:** o fluxo novo mudou o automático, mas o comando `#` chamava `enviarOrcamentoUnificado` **sem `_envioMultiplo`** → continuava mandando tudo (~80 msgs) **e terminava sem menu** (não definia step). Não era regressão, era **inconsistência**.

**Decisão do Mario (opção C):** o `#` manda **só o preço por padrão**; a flag **`+completo`** manda a apresentação inteira, como antes.

```
#fotocabine 0,2,120,6,1 +completo -> 5521999999999
```

- Flag do **LOTE**, qualquer posição, case-insensitive, igual ao `->`.
- Com `+completo`, chama `registrarServicoDetalhado` → **o menu não oferece "mais detalhes" do que o cliente acabou de ver**.
- O manual agora **termina com o menu**, igual ao automático.
- ⚠️ **Pegadinha:** a flag tem de sair do corpo **ANTES** do split dos comandos, senão vaza para os parâmetros do último e quebra o parse.
- ✅ **9/9 testes:** sem a flag os comandos saem idênticos a hoje; com a flag os params não mudam; não confunde com telefone internacional (`+5521...`).
- Documentado no cabeçalho do `index.js` e na mensagem de ajuda do operador.

## 9. Arquivos que serão tocados

| Arquivo | O quê |
|---|---|
| `utils/sendText.js` + novos `utils/sendButtons.js`, `utils/sendOptionList.js` | Camada própria por cima da Z-API (nunca chamar a Z-API direto do fluxo) |
| `index.js` | Máquina de estados: aceitar resposta de botão **e** número digitado no mesmo step |
| `jobs/lembreteOrcamento.js` | Gravar o abandono (item 8) |
| `services/*.js` | Textos dos menus |

**Deploy:** [[workflow_deploy_chatbot]] - `git add .` → commit "Atualização do sistema" → push → `flyctl deploy --app chatphotomusic`.

## 10. Pendências / decisões do Mario

- [ ] **`orcamento_escolher_servico`**: opção A, B ou C? (recomendo **C**)
- [ ] **Entregar o orçamento antes do e-mail/nascimento**: confirma? (recomendo **sim**)
- [ ] **`orcamento_nome_confirmar`**: mantém ou some?
- [ ] **`orcamento_onde_encontrou`**: mover pra depois da entrega?
- [ ] Testar botão da Z-API num aparelho real antes de confiar
