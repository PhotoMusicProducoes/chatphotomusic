// server.js — Entrada principal do Chatbot PhotoMusic (Z-API)

const express = require("express");
const bodyParser = require("body-parser");
const { handleIncomingMessage } = require("./index");
const { inicializarScheduler } = require("./jobs/mensagensComemorativas");
const { inicializarFollowupLeads } = require("./jobs/followupLeads");
const { inicializarPausaEspecial } = require("./utils/index.js");

const app = express();
app.use(bodyParser.json());

// ================= INICIALIZAR SISTEMAS =================
console.log("\n🚀 Iniciando sistema integrado (ChatBot + Comemorações + Pausa Especial)...\n");
inicializarPausaEspecial();
inicializarScheduler();
inicializarFollowupLeads();

// ================= FILA SEQUENCIAL POR USUÁRIO =================
// Garante que duas mensagens do mesmo número nunca sejam processadas
// ao mesmo tempo — a segunda sempre espera a primeira terminar.
// Isso evita race conditions quando o usuário digita rápido
// (ex: "7" e "1" antes do bot responder com as opções de evento).
const userQueues = new Map(); // Map<telefone, Promise>

function processarComFila(telefone, fn) {
  const atual = userQueues.get(telefone) || Promise.resolve();

  const proxima = atual
    .then(() => fn())
    .catch(err => console.error(`🚨 Erro na fila [${telefone}]:`, err));

  userQueues.set(telefone, proxima);

  // Auto-limpeza: remove da Map quando a fila deste usuário esvazia
  proxima.finally(() => {
    if (userQueues.get(telefone) === proxima) {
      userQueues.delete(telefone);
    }
  });

  return proxima;
}

// Função central de processamento do webhook Z-API
async function processarWebhook(req, res) {
  try {
    // Log detalhado do payload bruto recebido da Z-API
    console.log("📩 Payload recebido da Z-API:", JSON.stringify(req.body, null, 2));

    const payload = req.body;

    // Monta o objeto message no formato que o index.js espera
    const message = {
      // Número de quem enviou a mensagem
      from: payload.phone ? payload.phone + "@c.us" : null,
      phone: payload.phone || null,

      // Número da instância (bot)
      to: payload.connectedPhone ? payload.connectedPhone + "@c.us" : null,

      // Texto da mensagem
      body: payload.text?.message || payload.body || "",
      text: payload.text || null,

      // Indica se é grupo
      isGroup: payload.isGroup || false,
      isGroupMsg: payload.isGroup || payload.isGroupMsg || false,

      // Em grupo, quem REALMENTE enviou a mensagem (autor). No privado fica
      // nulo e usamos o phone. Usado para autorizar operadores por número.
      participantPhone: payload.participantPhone || payload.participantLid || null,

      // ESSENCIAL: distingue bot (fromApi=true) de operador (fromApi=false/undefined)
      fromMe: payload.fromMe || false,
      fromApi: payload.fromApi || false,

      // ID único da mensagem (deduplicador)
      messageId: payload.messageId || payload.id || null,
      id: payload.messageId || payload.id || null,

      // Tipo e metadados
      type: payload.type || null,
      isNewsletter: payload.isNewsletter || false,
      isEdit: payload.isEdit || false,
      chatName: payload.chatName || null,
      senderName: payload.senderName || null,

      // ESSENCIAL: captura mensagens citadas (para pegar o cliente automaticamente)
      quotedMsg: payload.quotedMsg || payload.quotedMessage || null,
      quotedMessage: payload.quotedMessage || payload.quotedMsg || null
    };

    // Log do objeto message já normalizado
    console.log("📩 Objeto message montado:", JSON.stringify(message, null, 2));

    // ✅ Responde ao webhook IMEDIATAMENTE para não dar timeout na Z-API.
    // O processamento real acontece de forma assíncrona na fila do usuário.
    res.sendStatus(200);

    // Chave da fila: telefone do remetente (ou "desconhecido" como fallback)
    const chaveFilai = payload.phone || payload.from || "desconhecido";

    // Enfileira o processamento desta mensagem — garante ordem FIFO por usuário
    processarComFila(chaveFilai, () => handleIncomingMessage(message));

  } catch (error) {
    console.error("🚨 Erro ao processar mensagem:", error);
    // res.sendStatus já foi chamado — não chamar novamente
  }
}

// Rotas do webhook — /webhook e /message são equivalentes
app.post("/webhook", processarWebhook);
app.post("/message", processarWebhook);

// Porta configurável via variável de ambiente (Fly.io injeta PORT=8080)
const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
  console.log(`✅ ChatBot + Comemorações rodando juntos em 1 processo\n`);
});
