// utils/sessions.js

const fs   = require("fs");
const path = require("path");

// /data é o volume persistente do Fly.io (sobrevive a deploys)
// Fallback para pasta local em desenvolvimento
const DATA_DIR = fs.existsSync("/data") ? "/data" : path.join(__dirname, "..");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");

// ======================================================
// CARREGAR SESSÕES DO ARQUIVO (ao iniciar)
// ======================================================
let sessions = {};

try {
  if (fs.existsSync(SESSIONS_FILE)) {
    const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf8"));
    if (data && typeof data === "object") {
      sessions = data;
      console.log(`✅ ${Object.keys(sessions).length} sessões carregadas do arquivo`);
    }
  }
} catch (e) {
  console.error("⚠️ Erro ao carregar sessions.json:", e.message);
  sessions = {};
}

// ======================================================
// SALVAR SESSÕES (chamado periodicamente e ao deletar)
// ======================================================
function salvarSessions() {
  try {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions), "utf8");
  } catch (e) {
    console.error("⚠️ Erro ao salvar sessions.json:", e.message);
  }
}

// Salva a cada 5 segundos para capturar qualquer mutação direta no objeto
setInterval(salvarSessions, 5000);

// ======================================================
// GERENCIAMENTO DE SESSÕES
// ======================================================
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
    salvarSessions();
    console.log(`✅ Sessão deletada: ${chatId}`);
  }
}

module.exports = { sessions, getSession, deleteSession };
