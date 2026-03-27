// utils/sendTyping.js

async function sendTyping(chatId) {
  try {
    console.log(`⌨️ [sendTyping] Simulando digitação para ${chatId}...`);
    await new Promise((resolve) => setTimeout(resolve, 3000));
    console.log(`⌨️ [sendTyping] Finalizado para ${chatId}`);
  } catch (error) {
    console.error(`🚨 [sendTyping] Erro ao simular digitação para ${chatId}: ${error.message}`);
  }
}

module.exports = { sendTyping };
