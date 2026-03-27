// utils/sessions.js

// ======================================================
// GERENCIAMENTO DE SESSÕES
// ======================================================
const sessions = {};

function getSession(chatId) {
  if (!sessions[chatId]) {
    sessions[chatId] = {
      step: "inicio",
      nome: null,
      orcamento: {
        celebracaoId: null,
        convidados: null,
        horasCorporativo: null,
        dias: 1,
        servicosEnviados: []
      },
      pausado: false,
      primeiraRodadaFinalizada: false,
      segundaRodadaFinalizada: false,
      enviandoOrcamentos: false
    };
  }
  return sessions[chatId];
}

function deleteSession(chatId) {
  if (sessions[chatId]) {
    delete sessions[chatId];
    console.log(`✅ Sessão deletada: ${chatId}`);
  }
}

module.exports = { sessions, getSession, deleteSession };