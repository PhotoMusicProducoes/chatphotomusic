// utils/sendOptionList.js — Envio de LISTA DE OPÇÕES clicável via Z-API
//
// Por que existe: o cliente clica em vez de digitar. Igreja (1ª Eucaristia) e
// paróquia têm muito idoso com dificuldade de digitar; no funil de orçamento,
// cada campo digitado é uma chance de o cliente sumir.
//
// 🔑 REGRA DE OURO — botão é CAMADA, nunca substituto:
//   1. O `message` SEMPRE leva o menu numerado no texto. Se a lista não
//      renderizar (aparelho antigo, WhatsApp Web, instabilidade da Z-API),
//      o cliente ainda lê as opções e digita o número, como sempre fez.
//   2. Os `id` das opções são os MESMOS números do menu ("1", "2", ...).
//      O webhook devolve `listResponseMessage.selectedRowId` = "1", que o
//      server.js entrega ao fluxo como se fosse texto digitado. Resultado:
//      NENHUM passo do index.js precisa saber que existe lista.
//   3. Se a Z-API falhar, cai sozinho no sendText com o mesmo texto.
//      Pior caso = comportamento de hoje. Zero regressão.
//
// ⚠️ A própria Z-API avisa que botões/listas sofrem instabilidade e que
// "futuras atualizações do WhatsApp podem alterar esse comportamento".
// Por isso o fallback acima não é luxo, é o que mantém o bot de pé.

const fetch = require("node-fetch");
const { API_URL } = require("./config.js");
const {
  sendText,
  estaEmModoSombra,
  estaEmModoSilencioso
} = require("./sendText.js");

// 🔑 Client-token fornecido pela Z-API (mesmo do sendText)
const CLIENT_TOKEN = "Fa05a9aeb57414a1db749a469ca145c02S";

// Limite de itens de uma lista no WhatsApp. A doc da Z-API não declara,
// mas o padrão da plataforma é 10. Acima disso, mandamos só texto.
const MAX_OPCOES = 10;

/**
 * Monta o texto numerado que acompanha a lista (e vira o fallback).
 * @param {string} pergunta
 * @param {Array<{id:string, title:string}>} opcoes
 */
function textoNumerado(pergunta, opcoes) {
  const linhas = opcoes.map(o => `*${o.id}* - ${o.title}`).join("\n");
  return `${pergunta}\n\n${linhas}`;
}

/**
 * Envia uma pergunta com lista de opções clicável.
 *
 * @param {string} chatId      - "5521999999999@c.us" ou só dígitos
 * @param {string} pergunta    - texto da pergunta
 * @param {Array<{id:string, title:string, description?:string}>} opcoes
 * @param {object} [cfg]
 * @param {string} [cfg.buttonLabel] - rótulo do botão que abre a lista
 * @param {string} [cfg.title]       - título do topo da lista
 */
async function sendOptionList(chatId, pergunta, opcoes, cfg = {}) {
  const phone = chatId.endsWith("@c.us") ? chatId.replace("@c.us", "") : chatId;
  const texto = textoNumerado(pergunta, opcoes);

  // Modo sombra e modo silencioso são tratados dentro do sendText. Uma lista
  // clicável não faz sentido para o operador (modo sombra) nem no replay de
  // conversa (modo silencioso), então nesses casos vai o texto puro.
  if (estaEmModoSilencioso(phone) || estaEmModoSombra(phone)) {
    await sendText(chatId, texto);
    return;
  }

  // Acima do limite da plataforma, lista não é opção: manda texto.
  if (!Array.isArray(opcoes) || opcoes.length === 0 || opcoes.length > MAX_OPCOES) {
    console.warn(`⚠️ [sendOptionList] ${opcoes?.length || 0} opções (máx ${MAX_OPCOES}). Enviando como texto.`);
    await sendText(chatId, texto);
    return;
  }

  try {
    const body = {
      phone,
      // O menu numerado vai NO CORPO de propósito: é o que salva quem não
      // enxerga a lista. Ver regra de ouro no topo.
      message: texto,
      optionList: {
        title: cfg.title || "Escolha uma opção",
        buttonLabel: cfg.buttonLabel || "Ver opções",
        options: opcoes.map(o => ({
          id: String(o.id),
          title: o.title,
          ...(o.description ? { description: o.description } : {})
        }))
      }
    };

    const response = await fetch(`${API_URL}/send-option-list`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "client-token": CLIENT_TOKEN
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} - ${JSON.stringify(data)}`);
    }

    console.log(`✅ [sendOptionList] Lista com ${opcoes.length} opções enviada para ${phone}`);

  } catch (error) {
    // Falhou a lista? O cliente NÃO pode ficar sem a pergunta.
    console.error(`🚨 [sendOptionList] Falhou para ${phone}: ${error.message}. Caindo para texto.`);
    await sendText(chatId, texto);
  }
}

module.exports = { sendOptionList, textoNumerado };
