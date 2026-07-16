// ✅ CORRETO — utils/index.js
// Centraliza TODAS as funções que os services precisam

const {
  sendText,
  ativarModoSombra, desativarModoSombra, estaEmModoSombra,
  ativarModoSilencioso, desativarModoSilencioso, estaEmModoSilencioso
} = require("./sendText.js");
const { sendOptionList, textoNumerado } = require("./sendOptionList.js");
const { sendButtonList } = require("./sendButtonList.js");
const { sendTyping } = require("./sendTyping.js");
const { sendFileByUrl } = require("./sendFileByUrl.js");
const { sendFileFromUrl } = require("./sendFileFromUrl.js");
const { enviarPdfComLink } = require("./enviarPdfComLink.js");
const { sendLinkPreview } = require("./sendLinkPreview.js");

// Pause control
const { estaPausado, pausarCliente, retomarCliente, obterPausados } = require("./pauseControl.js");

// ✅ NOVO: Pausa Especial Persistente
const { 
  estaPausadoEspecial, 
  pausarEspecial, 
  retomarEspecial, 
  removerPausaEspecial, 
  listarPausadosEspeciais,
  inicializarPausaEspecial
} = require("./pausaEspecialControl.js");

// Utilitários
const { resetSession } = require("./resetSession.js");
const { waitForUserResponse } = require("./waitForUserResponse.js");
const { copyOrcamentoData } = require("./copyOrcamentoData.js");

// Config
const { API_URL, INSTANCE_ID, TOKEN, urlBase, urlBase1, urlBase2, urlBase3 } = require("./config.js");

// Sessions
const { sessions, getSession, deleteSession } = require("./sessions.js");

// YouTube (será importado pelos services que precisam)
// const { extrairIdYoutube, enviarYoutube, enviarYoutubeCompleto, enviarMultiplosYoutubes } = require("./youtubeUtils.js");

// ======================================================
// EXPORTAR TUDO
// ======================================================
module.exports = {
  // Z-API send functions
  sendText,
  sendOptionList,
  sendButtonList,
  textoNumerado,
  sendTyping,
  ativarModoSombra, desativarModoSombra, estaEmModoSombra,
  ativarModoSilencioso, desativarModoSilencioso, estaEmModoSilencioso,
  sendFileByUrl,
  sendFileFromUrl,
  enviarPdfComLink,
  sendLinkPreview,
  
  // Pause control (Normal)
  estaPausado,
  pausarCliente,
  retomarCliente,
  obterPausados,
  
  // ✅ NOVO: Pause control (Especial Persistente)
  estaPausadoEspecial,
  pausarEspecial,
  retomarEspecial,
  listarPausadosEspeciais,
  inicializarPausaEspecial,
  
  // Sessions
  sessions,
  getSession,
  deleteSession,
  
  // Utilities
  resetSession,
  waitForUserResponse,
  copyOrcamentoData,
  
  // Config
  API_URL,
  INSTANCE_ID,
  TOKEN,
  urlBase,
  urlBase1,
  urlBase2,
  urlBase3
};
