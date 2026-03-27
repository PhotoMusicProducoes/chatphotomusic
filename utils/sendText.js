// utils/sendText.js — Função utilitária para envio de mensagens de texto via Z-API

const fetch = require("node-fetch");
const { API_URL, INSTANCE_ID, TOKEN } = require("./config.js");

// 🔑 Client-token fornecido pela Z-API
const CLIENT_TOKEN = "Fa05a9aeb57414a1db749a469ca145c02S";

/**
 * Envia uma mensagem de texto para um chatId específico.
 * @param {string} chatId - ID do chat no formato correto (ex.: 5521999999999@c.us).
 * @param {string} text - Conteúdo da mensagem a ser enviada.
 */
async function sendText(chatId, text) {
  try {
    // Garantir que o chatId está no formato correto
    const phone = chatId.endsWith("@c.us") ? chatId.replace("@c.us", "") : chatId;

    console.log("➡️ [sendText] Preparando envio para:", chatId);
    console.log("📝 [sendText] Conteúdo:", text);

    const response = await fetch(
      `${API_URL}/send-text`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "client-token": CLIENT_TOKEN
        },
        body: JSON.stringify({
          phone: phone,
          message: text
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("🚨 [sendText] Erro HTTP:", response.status, data);
      throw new Error(`Erro HTTP: ${response.status} - ${JSON.stringify(data)}`);
    }

    console.log(`✅ [sendText] Mensagem enviada para ${chatId}`);
    console.log("📦 [sendText] Resposta da API:", data);
  } catch (error) {
    console.error(`🚨 [sendText] Erro ao enviar mensagem para ${chatId}: ${error.message}`);
  }
}

module.exports = { sendText };
