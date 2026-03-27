// ✅ CORRIGIDO — enviarPdfComLink.js

// ✅ IMPORTA pauseControl DIRETAMENTE (não como parâmetro)
const { estaPausado } = require("./pauseControl.js");

async function enviarPdfComLink(
  chatId,
  pdfUrl,
  nomeArquivo,
  sendTyping,
  sendText,
  sendFileByUrl
  // ❌ REMOVIDO: clientesPausados como parâmetro
  // ✅ AGORA: usa estaPausado() importado direto
) {
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  try {
    console.log(`📄 [enviarPdfComLink] Iniciando envio de PDF para ${chatId}`);
    
    // Envia o PDF com nome personalizado
    await sendTyping(chatId);
    await delay(300);
    if (estaPausado(chatId)) {
      console.log(`⏸ [enviarPdfComLink] Cliente pausado, interrompendo`);
      return;
    }

    await sendFileByUrl(chatId, pdfUrl, "DOCUMENT", nomeArquivo);

    // Envia o link direto como fallback
    await sendTyping(chatId);
    await delay(300);
    if (estaPausado(chatId)) {
      console.log(`⏸ [enviarPdfComLink] Cliente pausado antes do fallback`);
      return;
    }

    await sendText(
      chatId,
      `🔗 Caso tenha dificuldade para baixar o PDF, aqui está o link direto:\n${pdfUrl}`
    );
    
    console.log(`✅ [enviarPdfComLink] PDF enviado com sucesso para ${chatId}`);
  } catch (error) {
    console.error(`🚨 [enviarPdfComLink] Erro ao enviar PDF: ${error.message}`);
    throw error;
  }
}

module.exports = { enviarPdfComLink };
