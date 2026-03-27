// utils/resetSession.js
const { sendTyping } = require("./sendTyping.js");

function resetSession(chatId, sessions) {
  try {
    if (sessions[chatId]) {
      delete sessions[chatId];
      console.log(`🔄 [resetSession] Sessão resetada para ${chatId}`);
    } else {
      console.log(`ℹ️ [resetSession] Nenhuma sessão ativa encontrada para ${chatId}`);
    }

    sendTyping(chatId); // apenas simula digitação
  } catch (error) {
    console.error(`🚨 [resetSession] Erro ao resetar sessão para ${chatId}: ${error.message}`);
  }
}

module.exports = { resetSession };
