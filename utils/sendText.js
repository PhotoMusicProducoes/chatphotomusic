// utils/sendText.js — Função utilitária para envio de mensagens de texto via Z-API

const fetch = require("node-fetch");
const { API_URL, INSTANCE_ID, TOKEN } = require("./config.js");

// 🔑 Client-token fornecido pela Z-API
const CLIENT_TOKEN = "Fa05a9aeb57414a1db749a469ca145c02S";

// ======================================================
// 🎭 MODO SOMBRA
// Map: numeroCliente (só dígitos) → numeroOperador (só dígitos)
// Quando ativo, sendText redireciona as msgs do bot para o operador.
// ======================================================
const modoSombraMap = new Map();

function ativarModoSombra(clienteNum, operadorNum) {
  const c = clienteNum.replace(/\D/g, "");
  const o = operadorNum.replace(/\D/g, "");
  modoSombraMap.set(c, o);
  console.log(`🎭 [Modo Sombra] ATIVADO para ${c} → operador ${o}`);
}

function desativarModoSombra(clienteNum) {
  const c = clienteNum.replace(/\D/g, "");
  modoSombraMap.delete(c);
  console.log(`🎭 [Modo Sombra] DESATIVADO para ${c}`);
}

function estaEmModoSombra(clienteNum) {
  const c = clienteNum.replace(/\D/g, "");
  return modoSombraMap.has(c);
}

// ======================================================
// 🔇 MODO SILENCIOSO
// Set: numeroCliente (só dígitos)
// Quando ativo, sendText descarta a mensagem completamente.
// Usado no replay de conversa para reconstruir a sessão
// sem reenviar mensagens que o cliente já recebeu.
// ======================================================
const modoSilenciosoSet = new Set();

function ativarModoSilencioso(clienteNum) {
  const c = clienteNum.replace(/\D/g, "");
  modoSilenciosoSet.add(c);
  console.log(`🔇 [Modo Silencioso] ATIVADO para ${c}`);
}

function desativarModoSilencioso(clienteNum) {
  const c = clienteNum.replace(/\D/g, "");
  modoSilenciosoSet.delete(c);
  console.log(`🔇 [Modo Silencioso] DESATIVADO para ${c}`);
}

function estaEmModoSilencioso(clienteNum) {
  const c = clienteNum.replace(/\D/g, "");
  return modoSilenciosoSet.has(c);
}

/**
 * Envia uma mensagem de texto.
 * Em Modo Sombra redireciona a msg para o operador (em vez do cliente),
 * com prefixo visual para o operador saber o que o bot enviaria.
 */
async function sendText(chatId, text) {
  try {
    const phone = chatId.endsWith("@c.us") ? chatId.replace("@c.us", "") : chatId;

    // 🔇 Verificar Modo Silencioso (descarta completamente)
    if (modoSilenciosoSet.has(phone)) {
      console.log(`🔇 [Modo Silencioso] Msg suprimida para ${phone}: "${String(text).substring(0, 60)}"`);
      return;
    }

    // 🎭 Verificar Modo Sombra (redireciona para operador)
    const operadorRedirect = modoSombraMap.get(phone);
    if (operadorRedirect) {
      console.log(`🎭 [Modo Sombra] Msg de bot para ${phone} redirecionada ao operador`);
      // Envia para o OPERADOR com indicação clara
      const destino = operadorRedirect;
      await _enviar(destino, `🤖 *[Bot→cliente]*:\n${text}`);
      return;
    }

    console.log("➡️ [sendText] Preparando envio para:", chatId);
    console.log("📝 [sendText] Conteúdo:", text);
    await _enviar(phone, text);

  } catch (error) {
    console.error(`🚨 [sendText] Erro ao enviar mensagem para ${chatId}: ${error.message}`);
  }
}

async function _enviar(phone, text) {
  const response = await fetch(
    `${API_URL}/send-text`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "client-token": CLIENT_TOKEN
      },
      body: JSON.stringify({ phone, message: text })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error("🚨 [sendText] Erro HTTP:", response.status, data);
    throw new Error(`Erro HTTP: ${response.status} - ${JSON.stringify(data)}`);
  }

  console.log(`✅ [sendText] Mensagem enviada para ${phone}`);
}

module.exports = {
  sendText,
  ativarModoSombra, desativarModoSombra, estaEmModoSombra,
  ativarModoSilencioso, desativarModoSilencioso, estaEmModoSilencioso
};
