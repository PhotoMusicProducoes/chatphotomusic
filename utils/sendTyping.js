// utils/sendTyping.js

const { estaEmModoSombra, estaEmModoSilencioso } = require("./sendText.js");

async function sendTyping(chatId) {
  try {
    const phone = chatId.endsWith("@c.us") ? chatId.replace("@c.us", "") : chatId;

    // 🔇 Modo Silencioso ou 🎭 Modo Sombra: pula o delay
    if (estaEmModoSilencioso(phone) || estaEmModoSombra(phone)) {
      return;
    }

    console.log(`⌨️ [sendTyping] Simulando digitação para ${chatId}...`);
    await new Promise((resolve) => setTimeout(resolve, 3000));
    console.log(`⌨️ [sendTyping] Finalizado para ${chatId}`);
  } catch (error) {
    console.error(`🚨 [sendTyping] Erro ao simular digitação para ${chatId}: ${error.message}`);
  }
}

module.exports = { sendTyping };
