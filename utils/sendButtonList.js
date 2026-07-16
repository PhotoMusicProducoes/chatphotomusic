// utils/sendButtonList.js — Envio de BOTÕES de resposta via Z-API
//
// Diferença para o sendOptionList:
//   BOTÃO (aqui)  → até 3 opções, ficam À VISTA, um toque só.
//   LISTA (lá)    → até 10 opções, mas exige abrir a lista antes.
// Regra prática: 2 ou 3 opções = botão. 4 a 10 = lista.
//
// (Limite de 3 confirmado observando o bot do Padre Paulo Ricardo em
// 15/07/2026: todas as perguntas dele vêm com exatamente 3 opções.)
//
// 🔑 MESMA REGRA DE OURO do sendOptionList — botão é CAMADA, nunca substituto:
//   1. O menu numerado vai SEMPRE no corpo da mensagem. Se o botão não
//      renderizar, o cliente lê e digita o número, como sempre fez.
//   2. Os `id` são os próprios números do menu ("1","2","3"). O webhook
//      devolve buttonsResponseMessage.buttonId = "1", que o server.js entrega
//      ao fluxo como texto digitado. O index.js não sabe que existe botão.
//   3. Se a Z-API falhar, cai sozinho no sendText. Pior caso = hoje.
//
// ⚠️ NUNCA colocar informação que o cliente precise COPIAR no rótulo do botão
// (chave PIX, link, valor): rótulo de botão não é texto selecionável e não dá
// para copiar. Isso vai no corpo da mensagem.

const fetch = require("node-fetch");
const { API_URL } = require("./config.js");
const {
  sendText,
  estaEmModoSombra,
  estaEmModoSilencioso
} = require("./sendText.js");

// 🔑 Client-token fornecido pela Z-API (mesmo do sendText)
const CLIENT_TOKEN = "Fa05a9aeb57414a1db749a469ca145c02S";

// Limite do WhatsApp para botões de resposta.
const MAX_BOTOES = 3;

function textoNumerado(pergunta, opcoes) {
  const linhas = opcoes.map(o => `*${o.id}* - ${o.label}`).join("\n");
  return `${pergunta}\n\n${linhas}`;
}

/**
 * Envia uma pergunta com até 3 botões de resposta.
 *
 * @param {string} chatId
 * @param {string} pergunta
 * @param {Array<{id:string, label:string}>} opcoes - máx. 3
 */
async function sendButtonList(chatId, pergunta, opcoes) {
  const phone = chatId.endsWith("@c.us") ? chatId.replace("@c.us", "") : chatId;
  const texto = textoNumerado(pergunta, opcoes);

  // Botão não faz sentido para o operador (modo sombra) nem no replay de
  // conversa (modo silencioso) — nesses casos vai o texto puro.
  if (estaEmModoSilencioso(phone) || estaEmModoSombra(phone)) {
    await sendText(chatId, texto);
    return;
  }

  if (!Array.isArray(opcoes) || opcoes.length === 0 || opcoes.length > MAX_BOTOES) {
    console.warn(`⚠️ [sendButtonList] ${opcoes?.length || 0} opções (máx ${MAX_BOTOES}). Enviando como texto.`);
    await sendText(chatId, texto);
    return;
  }

  try {
    const body = {
      phone,
      // Menu numerado no corpo de propósito: é o que salva quem não vê o botão.
      message: texto,
      buttonList: {
        buttons: opcoes.map(o => ({
          id: String(o.id),
          label: o.label
        }))
      }
    };

    const response = await fetch(`${API_URL}/send-button-list`, {
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

    console.log(`✅ [sendButtonList] ${opcoes.length} botões enviados para ${phone}`);

  } catch (error) {
    console.error(`🚨 [sendButtonList] Falhou para ${phone}: ${error.message}. Caindo para texto.`);
    await sendText(chatId, texto);
  }
}

module.exports = { sendButtonList };
