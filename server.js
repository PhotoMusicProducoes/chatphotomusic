// server.js — Entrada principal do Chatbot PhotoMusic (Z-API)

const express = require("express");
const bodyParser = require("body-parser");
const { handleIncomingMessage } = require("./index");
const { inicializarScheduler } = require("./jobs/mensagensComemorativas");
const { inicializarFollowupLeads } = require("./jobs/followupLeads");
const { inicializarLembreteOrcamento } = require("./jobs/lembreteOrcamento");
const { inicializarPausaEspecial } = require("./utils/index.js");

const app = express();
app.use(bodyParser.json());

// ======================================================
// NORMALIZAÇÃO DO TEXTO RECEBIDO
// Alguns aparelhos/encaminhamentos entregam o texto percent-encoded
// (%20, %C3%A1...) e/ou com acento quebrado (UTF-8 lido como Latin-1:
// "OlÃ¡" em vez de "Olá"). Sem tratar, uma mensagem como
// "Olá! Recebi seu orçamento e desejo contratar" chega ilegível e o bot
// não entende a intenção. Esta função conserta os dois casos com segurança.
// ======================================================
function temMojibakeUtf8(s){
  // marcadores de UTF-8 lido como Latin-1: 0xC2/0xC3 seguidos de 0x80-0xBF
  for (let i = 0; i < s.length - 1; i++) {
    const a = s.charCodeAt(i), b = s.charCodeAt(i + 1);
    if ((a === 0xC2 || a === 0xC3) && b >= 0x80 && b <= 0xBF) return true;
  }
  return false;
}

function normalizarTextoRecebido(raw) {
  let s = String(raw == null ? "" : raw);

  // 1) Percent-encoding (%20, %C3%A1...). So tenta se houver o padrao %XX.
  if (/%[0-9A-Fa-f]{2}/.test(s)) {
    try { s = decodeURIComponent(s); } catch (_) { /* mantem como esta */ }
  }

  // 2) Mojibake: UTF-8 lido como Latin-1 ("OlÃ¡" -> "Ola"). So age se houver
  //    marcadores e se o conserto NAO introduzir caractere de substituicao
  //    (evita corromper texto que ja estava correto).
  if (temMojibakeUtf8(s)) {
    try {
      const fixed = Buffer.from(s, "latin1").toString("utf8");
      if (fixed.indexOf(String.fromCharCode(0xFFFD)) === -1) s = fixed;
    } catch (_) { /* mantem como esta */ }
  }

  return s;
}

// ================= INICIALIZAR SISTEMAS =================
console.log("\n🚀 Iniciando sistema integrado (ChatBot + Comemorações + Pausa Especial)...\n");
inicializarPausaEspecial();
inicializarScheduler();
inicializarFollowupLeads();
inicializarLembreteOrcamento();

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

      // Texto da mensagem (normalizado: corrige percent-encoding e mojibake)
      body: normalizarTextoRecebido(payload.text?.message || payload.body || ""),
      text: payload.text
        ? { ...payload.text, message: normalizarTextoRecebido(payload.text.message || "") }
        : null,

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
