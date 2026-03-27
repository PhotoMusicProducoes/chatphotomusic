// utils/waitForUserResponse.js
// ⚠️ Adaptado para Z-API: como usamos webhook, essa função serve como "promessa"
// que será resolvida quando o webhook capturar a próxima mensagem do cliente.

function waitForUserResponse(chatId) {
  return new Promise((resolve) => {
    console.log(`⏳ [waitForUserResponse] Aguardando resposta do usuário ${chatId}...`);

    // Cria um objeto global para armazenar callbacks de resposta
    global.pendingResponses = global.pendingResponses || {};
    global.pendingResponses[chatId] = (message) => {
      console.log(`📩 [waitForUserResponse] Resposta recebida de ${chatId}: ${message.body}`);
      resolve(message);
      delete global.pendingResponses[chatId]; // limpa após resolver
    };
  });
}

module.exports = { waitForUserResponse };
